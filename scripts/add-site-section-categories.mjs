// One-time setup for the site sections (see functions/api/gallery.ts):
//   1. creates the "Main Page", "Folsom" and "Everywhere" categories in
//      Square if they don't exist yet;
//   2. sorts the current "Website" items: anything with "cage" or
//      "sculpture" in its name moves to "Folsom" only (off the Ceramics
//      page and homepage); everything else keeps "Website" and gains
//      "Main Page" (the homepage is now opt-in).
//
// Dry run by default: prints what it would do and changes nothing.
//   SQUARE_ACCESS_TOKEN=... node scripts/add-site-section-categories.mjs
// Apply:
//   SQUARE_ACCESS_TOKEN=... node scripts/add-site-section-categories.mjs --apply
//
// Safe to re-run: existing categories are reused and items that already
// are already sorted are skipped.

const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2024-10-17";
const WEBSITE_CATEGORY = "Website";
const HOME_CATEGORY = "Main Page";
const FOLSOM_CATEGORY = "Folsom";
const NEW_CATEGORIES = [HOME_CATEGORY, FOLSOM_CATEGORY, "Everywhere"];
const FOLSOM_NAME_PATTERN = /cage|sculpture/i;

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const APPLY = process.argv.includes("--apply");

if (!ACCESS_TOKEN) {
  console.error("Set SQUARE_ACCESS_TOKEN before running.");
  process.exit(1);
}

async function squareFetch(path, options = {}) {
  const res = await fetch(`${SQUARE_API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${options.method || "GET"} ${path} -> ${res.status}\n${text}`);
  return text ? JSON.parse(text) : {};
}

async function listAll(types) {
  const objects = [];
  let cursor;
  do {
    const data = await squareFetch(`/catalog/list?types=${types}${cursor ? `&cursor=${cursor}` : ""}`);
    objects.push(...(data.objects || []));
    cursor = data.cursor;
  } while (cursor);
  return objects;
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function main() {
  console.log(APPLY ? "APPLYING changes to Square.\n" : "Dry run (no changes). Re-run with --apply to make them.\n");

  const objects = await listAll("ITEM,CATEGORY");
  const byName = (name) =>
    objects.find((o) => o.type === "CATEGORY" && String(o.category_data?.name || "").trim().toLowerCase() === name.toLowerCase());

  const website = byName(WEBSITE_CATEGORY);
  if (!website) throw new Error(`No "${WEBSITE_CATEGORY}" category found in Square.`);

  const categoryIds = {};
  for (const name of NEW_CATEGORIES) {
    const existing = byName(name);
    if (existing) {
      console.log(`Category "${name}" already exists`);
      categoryIds[name] = existing.id;
    } else if (APPLY) {
      const res = await squareFetch(`/catalog/object`, {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: `site-section-category-${slug(name)}`,
          object: { type: "CATEGORY", id: `#${slug(name)}`, category_data: { name } },
        }),
      });
      categoryIds[name] = res.catalog_object.id;
      console.log(`Created category "${name}"`);
    } else {
      console.log(`Would create category "${name}"`);
    }
  }

  const items = objects.filter(
    (o) => o.type === "ITEM" && (o.item_data?.categories || []).some((c) => c?.id === website.id)
  );
  const homeId = categoryIds[HOME_CATEGORY];
  const folsomId = categoryIds[FOLSOM_CATEGORY];
  const has = (item, id) => Boolean(id) && (item.item_data.categories || []).some((c) => c?.id === id);

  const toFolsom = items.filter((o) => FOLSOM_NAME_PATTERN.test(o.item_data?.name || ""));
  const toHome = items.filter((o) => !toFolsom.includes(o) && !has(o, homeId));

  console.log(`\n${toFolsom.length} items ${APPLY ? "moving" : "would move"} to "${FOLSOM_CATEGORY}" only:`);
  for (const item of toFolsom) console.log(`  - ${item.item_data?.name}`);
  console.log(`\n${toHome.length} items ${APPLY ? "getting" : "would get"} "${HOME_CATEGORY}" (keeping "${WEBSITE_CATEGORY}"):`);
  for (const item of toHome) console.log(`  - ${item.item_data?.name}`);
  if (!APPLY) return;

  // batch-upsert takes the full object back, so send each item as read
  // with only its categories changed. version guards against overwriting
  // an edit made on the dashboard since the list call.
  const updated = [
    ...toFolsom.map((item) => {
      const categories = (item.item_data.categories || []).filter((c) => c?.id !== website.id);
      if (!has(item, folsomId)) categories.push({ id: folsomId });
      const item_data = { ...item.item_data, categories };
      // The reporting category must be one of the item's categories.
      if (item_data.reporting_category?.id === website.id) item_data.reporting_category = { id: folsomId };
      return { ...item, item_data };
    }),
    ...toHome.map((item) => ({
      ...item,
      item_data: { ...item.item_data, categories: [...(item.item_data.categories || []), { id: homeId }] },
    })),
  ];
  for (let i = 0; i < updated.length; i += 100) {
    await squareFetch(`/catalog/batch-upsert`, {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: `site-section-sort-${Date.now()}-${i}`,
        batches: [{ objects: updated.slice(i, i + 100) }],
      }),
    });
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
