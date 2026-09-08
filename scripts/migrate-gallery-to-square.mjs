// One-time migration: uploads the 9 pieces currently hardcoded in
// site/gallery.js into Square's Item Library, tagged with the "Website"
// category, so the site's gallery can switch over to being fully
// Square-driven (see functions/api/gallery.ts).
//
// Run once, locally:
//   SQUARE_ACCESS_TOKEN=... SQUARE_LOCATION_ID=... node scripts/migrate-gallery-to-square.mjs
//
// Safe to re-run: item creation is idempotent per piece (idempotency key is
// derived from the title), so re-running after a partial failure won't
// create duplicates for pieces that already made it in.
//
// NOTE: written against Square's documented API shape without a live token
// to test against. If a call fails, the error response is printed in full —
// expect to fix a field name or two on the first real run.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(__dirname, "..", "site");

const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2024-10-17";
const CATEGORY_NAME = "Website";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID;

if (!ACCESS_TOKEN || !LOCATION_ID) {
  console.error("Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID env vars before running.");
  process.exit(1);
}

// Mirrors GALLERY_PIECES in site/gallery.js at the time this script was
// written. price is in whole dollars; omit it for portfolio-only pieces.
const PIECES = [
  { title: "Moon Jar", img: "moon-jar.jpg" },
  { title: "Matching Mug Set", img: "mug2.png" },
  { title: "Serving Tray", img: "assets/gallery/serving-tray.jpg" },
  { title: "Speckled Cream Mug", img: "assets/gallery/mug-cream.jpg" },
  { title: "Black Glazed Mug", img: "assets/gallery/mug-black.jpg" },
  { title: "Blue Lidded Jar", img: "assets/gallery/jar-blue.jpg" },
  { title: "White Tumbler", img: "assets/gallery/tumbler-white.jpg" },
  { title: "Wave Teapot", img: "assets/gallery/teapot-green.jpg" },
  { title: "Gong Fu Style Teapot", img: "assets/gallery/teapot-gongfu.jpg", price: 100 },
];

function headers(extra = {}) {
  return {
    Authorization: `Bearer ${ACCESS_TOKEN}`,
    "Square-Version": SQUARE_VERSION,
    ...extra,
  };
}

async function squareFetch(path, options = {}) {
  const res = await fetch(`${SQUARE_API_BASE}${path}`, options);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} -> ${res.status}\n${text}`);
  }
  return text ? JSON.parse(text) : {};
}

async function findOrCreateCategory() {
  const list = await squareFetch(`/catalog/list?types=CATEGORY`, { headers: headers() });
  const existing = (list.objects || []).find(
    (o) => o.category_data?.name?.toLowerCase() === CATEGORY_NAME.toLowerCase()
  );
  if (existing) {
    console.log(`Using existing "${CATEGORY_NAME}" category (${existing.id})`);
    return existing.id;
  }

  console.log(`Creating "${CATEGORY_NAME}" category...`);
  const res = await squareFetch(`/catalog/object`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      idempotency_key: `migrate-category-website`,
      object: {
        type: "CATEGORY",
        id: "#website-category",
        category_data: { name: CATEGORY_NAME },
      },
    }),
  });
  return res.catalog_object.id;
}

async function uploadImage(piece) {
  const filePath = path.join(SITE_DIR, piece.img);
  const bytes = readFileSync(filePath);
  const ext = path.extname(piece.img).toLowerCase();
  const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" }[ext];

  const form = new FormData();
  form.append(
    "request",
    JSON.stringify({
      idempotency_key: `migrate-image-${slug(piece.title)}`,
      image: { type: "IMAGE", id: "#image", image_data: { caption: piece.title } },
    })
  );
  form.append("file", new Blob([bytes], { type: mime }), path.basename(piece.img));

  const res = await fetch(`${SQUARE_API_BASE}/catalog/images`, {
    method: "POST",
    headers: headers(), // no Content-Type: fetch sets the multipart boundary
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`image upload failed for "${piece.title}": ${JSON.stringify(data)}`);
  return data.image.id;
}

function slug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function upsertItem(piece, categoryId, imageId) {
  const forSale = piece.price != null;
  const itemTempId = "#item";
  const variationTempId = "#variation";

  const res = await squareFetch(`/catalog/object`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      idempotency_key: `migrate-item-${slug(piece.title)}`,
      object: {
        type: "ITEM",
        id: itemTempId,
        item_data: {
          name: piece.title,
          categories: [{ id: categoryId }],
          image_ids: [imageId],
          variations: [
            {
              type: "ITEM_VARIATION",
              id: variationTempId,
              item_variation_data: {
                item_id: itemTempId,
                name: "Regular",
                pricing_type: forSale ? "FIXED_PRICING" : "VARIABLE_PRICING",
                ...(forSale
                  ? { price_money: { amount: Math.round(piece.price * 100), currency: "USD" } }
                  : {}),
                track_inventory: forSale,
              },
            },
          ],
        },
      },
    }),
  });

  const variation = res.catalog_object.item_data.variations[0];
  return variation.id;
}

async function setInventory(variationId) {
  await squareFetch(`/inventory/changes/batch-create`, {
    method: "POST",
    headers: headers({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      idempotency_key: `migrate-inventory-${variationId}`,
      changes: [
        {
          type: "PHYSICAL_COUNT",
          physical_count: {
            catalog_object_id: variationId,
            location_id: LOCATION_ID,
            quantity: "1",
            state: "IN_STOCK",
            occurred_at: new Date().toISOString(),
          },
        },
      ],
    }),
  });
}

async function main() {
  const categoryId = await findOrCreateCategory();

  for (const piece of PIECES) {
    try {
      console.log(`\n${piece.title}`);
      console.log("  uploading photo...");
      const imageId = await uploadImage(piece);
      console.log("  creating catalog item...");
      const variationId = await upsertItem(piece, categoryId, imageId);
      if (piece.price != null) {
        console.log("  setting inventory to 1...");
        await setInventory(variationId);
      }
      console.log(`  done (${piece.price != null ? "for sale, $" + piece.price : "portfolio only"})`);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
  }

  console.log("\nMigration pass complete. Verify in the Square Dashboard, then check /api/gallery.");
}

main();
