// Builds the gallery feeds from Square's Item Library instead of a hardcoded
// list. Each site section is a Square category, and an item can be in
// several at once:
//   SQUARE_CATEGORY_NAME       ("Website")    -> Ceramics page
//   SQUARE_HOME_CATEGORY       ("Main Page")  -> homepage
//   SQUARE_FOLSOM_CATEGORY     ("Folsom")     -> Folsom Collection page
//   SQUARE_EVERYWHERE_CATEGORY ("Everywhere") -> all three
// Pick a section with ?collection=website|home|folsom (default: website),
// or ?collection=all for every piece (the Shop page).
// // items with inventory tracking on and quantity 0 stay visible but are
// marked soldOut (no price/buy link) rather than being dropped. Result is
// cached in GALLERY_CACHE for CACHE_TTL_SECONDS so normal page loads never
// call Square directly.
//
// NOTE: written against Square's documented API shape without a live token
// to test against — first real run with Robby's credentials will likely
// need small field-name fixes. Kept defensive (optional chaining, try/catch)
// so a Square API surprise degrades to an empty gallery rather than a 500.

interface Env {
  SQUARE_ACCESS_TOKEN: string;
  SQUARE_LOCATION_ID: string;
  SQUARE_CATEGORY_NAME: string;
  SQUARE_HOME_CATEGORY: string;
  SQUARE_FOLSOM_CATEGORY: string;
  SQUARE_EVERYWHERE_CATEGORY: string;
  GALLERY_CACHE: KVNamespace;
}

const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2024-10-17";
const CACHE_KEY = "gallery:v4";
// Square changes must show on the site within 1 minute. KV's own expiry
// can't do that (60s minimum, and reads can lag up to 60s more), so entries
// carry a fetchedAt stamp and are only served while younger than
// FRESH_SECONDS; the KV TTL is just cleanup.
const FRESH_SECONDS = 30;
const CACHE_TTL_SECONDS = 120;
// Payment links, keyed by their idempotency key, kept between rebuilds.
// Without this every rebuild re-POSTed one link per piece, and the Workers
// free plan allows only 50 outbound requests per invocation, so once the
// catalog passed ~47 priced pieces the last few always came back with no
// Buy button. Now only new/changed pieces cost a Square call.
const LINKS_KEY = "paylinks:v1";
// Square calls a single rebuild may spend on new payment links, leaving
// room under the 50-request cap for catalog pages + inventory. Pieces past
// the budget get their link on the next rebuild (~30s later).
const MAX_NEW_LINKS_PER_BUILD = 30;

const COLLECTIONS = ["website", "home", "folsom"] as const;
type Collection = (typeof COLLECTIONS)[number];

interface GalleryPiece {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  // Every photo on the Square item (first one is imageUrl); product page uses them.
  imageUrls: string[];
  price: number | null;
  buyLink: string | null;
  soldOut: boolean;
  collections: Collection[];
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env, request } = context;
  const params = new URL(request.url).searchParams;
  // ?id=<square item id> returns that one piece (product page), any section.
  const pieceId = params.get("id");
  const requested = params.get("collection") || "website";
  // "all" = every piece in any section (the Shop page).
  if (!pieceId && requested !== "all" && !(COLLECTIONS as readonly string[]).includes(requested)) return jsonResponse([]);
  const collection = requested as Collection | "all";

  try {
    // One cache entry holds every section's pieces, so all pages share a
    // single Square fetch; each request just filters it.
    const cached: any = await env.GALLERY_CACHE.get(CACHE_KEY, "json");
    let pieces: GalleryPiece[];
    if (cached?.fetchedAt && Date.now() - cached.fetchedAt < FRESH_SECONDS * 1000) {
      pieces = cached.pieces;
    } else {
      pieces = await buildGallery(env);
      await env.GALLERY_CACHE.put(CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), pieces }), {
        expirationTtl: CACHE_TTL_SECONDS,
      });
    }
    if (pieceId) return jsonResponse(pieces.filter((p) => p.id === pieceId));
    if (collection === "all") return jsonResponse(pieces);
    return jsonResponse(pieces.filter((p) => p.collections.includes(collection)));
  } catch (err) {
    console.error("gallery sync failed", err);
    // Fail soft: an empty gallery is better than a broken page.
    return jsonResponse([]);
  }
};

async function buildGallery(env: Env): Promise<GalleryPiece[]> {
  const objects = await listAllCatalogObjects(env);

  // category id -> the site sections it puts an item in
  const sectionsFor = new Map<string, Collection[]>();
  const categoryNames: [string, Collection[]][] = [
    [env.SQUARE_CATEGORY_NAME || "Website", ["website"]],
    [env.SQUARE_HOME_CATEGORY || "Main Page", ["home"]],
    [env.SQUARE_FOLSOM_CATEGORY || "Folsom", ["folsom"]],
    [env.SQUARE_EVERYWHERE_CATEGORY || "Everywhere", [...COLLECTIONS]],
  ];
  for (const o of objects) {
    if (o.type !== "CATEGORY") continue;
    const name = String(o.category_data?.name || "").trim().toLowerCase();
    const match = categoryNames.find(([n]) => n.toLowerCase() === name);
    if (match) sectionsFor.set(o.id, match[1]);
  }
  if (!sectionsFor.size) return [];

  const images = new Map<string, any>();
  for (const o of objects) {
    if (o.type === "IMAGE") images.set(o.id, o);
  }

  const collectionsOf = (item: any): Collection[] => {
    const found = new Set<Collection>();
    for (const c of item.item_data?.categories || []) {
      for (const s of sectionsFor.get(c?.id) || []) found.add(s);
    }
    return COLLECTIONS.filter((s) => found.has(s));
  };

  const items = objects.filter((o: any) => o.type === "ITEM" && collectionsOf(o).length > 0);

  // variation id -> live inventory count, only fetched for tracked variations
  const trackedVariationIds = items
    .flatMap((item: any) => item.item_data?.variations || [])
    .filter((v: any) => v?.item_variation_data?.track_inventory)
    .map((v: any) => v.id);

  const inventory = trackedVariationIds.length
    ? await batchRetrieveInventory(env, trackedVariationIds)
    : new Map<string, number>();

  const savedLinks: Record<string, string> = (await env.GALLERY_CACHE.get(LINKS_KEY, "json")) || {};
  const usedLinks: Record<string, string> = {};
  let newLinkBudget = MAX_NEW_LINKS_PER_BUILD;
  let linksChanged = false;

  const pieces: (GalleryPiece & { updatedAt: string })[] = [];

  for (const item of items) {
    const variation = item.item_data?.variations?.[0];
    if (!variation) continue;

    const imageId = item.item_data?.image_ids?.[0];
    const imageUrl = imageId ? images.get(imageId)?.image_data?.url : null;
    if (!imageUrl) continue; // no photo, nothing to show

    // Inventory tracking only decides whether a *tracked* item is sold out;
    // it's unrelated to whether the item has a price. A piece can be for
    // sale with a plain price_money and no inventory tracking at all —
    // Square doesn't require tracking to sell something, and this code
    // shouldn't either. Sold-out pieces stay in the gallery (Robby wants
    // them visible, just marked) instead of being dropped.
    const tracked = Boolean(variation.item_variation_data?.track_inventory);
    const trackedSoldOut = tracked && (inventory.get(variation.id) ?? 0) <= 0;

    // Separately, Square's dashboard "Status: Sold out" dropdown (the one
    // most items actually use, rather than turning on full quantity
    // tracking) sets a manual `sold_out` flag on the item's per-location
    // override — nothing to do with track_inventory or the Inventory API.
    // Both mechanisms count as sold out here.
    const locationOverrides: any[] = variation.item_variation_data?.location_overrides || [];
    const override = locationOverrides.find((o: any) => o?.location_id === env.SQUARE_LOCATION_ID);
    const manualSoldOut = Boolean(override?.sold_out);

    const soldOut = trackedSoldOut || manualSoldOut;

    const priceMoney = variation.item_variation_data?.price_money;
    const price = soldOut ? null : priceMoney?.amount != null ? Math.round(priceMoney.amount) / 100 : null;

    let buyLink: string | null = null;
    if (price != null) {
      const key = await paymentLinkKey(variation.id, `${priceMoney.amount}|${item.item_data?.name || ""}|${variation.item_variation_data?.name || ""}`);
      buyLink = savedLinks[key] || null;
      if (!buyLink && newLinkBudget > 0) {
        newLinkBudget--;
        buyLink = await getOrCreatePaymentLink(env, variation.id, key);
        if (buyLink) linksChanged = true;
      }
      if (buyLink) usedLinks[key] = buyLink;
    }

    const imageUrls: string[] = (item.item_data?.image_ids || [])
      .map((id: string) => images.get(id)?.image_data?.url)
      .filter(Boolean);

    pieces.push({
      id: item.id,
      title: item.item_data?.name || "Untitled",
      description: String(item.item_data?.description_plaintext ?? item.item_data?.description ?? "").trim(),
      imageUrl,
      imageUrls,
      price,
      buyLink,
      soldOut,
      collections: collectionsOf(item),
      updatedAt: item.updated_at || "",
    });
  }

  // Store only the links still in use, so stale ones (old prices, retired
  // pieces) drop out instead of piling up.
  if (linksChanged || Object.keys(usedLinks).length !== Object.keys(savedLinks).length) {
    await env.GALLERY_CACHE.put(LINKS_KEY, JSON.stringify(usedLinks));
  }

  pieces.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  return pieces.map(({ updatedAt, ...rest }) => rest);
}

async function listAllCatalogObjects(env: Env): Promise<any[]> {
  const objects: any[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`${SQUARE_API_BASE}/catalog/list`);
    url.searchParams.set("types", "ITEM,IMAGE,CATEGORY");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), { headers: squareHeaders(env) });
    if (!res.ok) throw new Error(`catalog/list failed: ${res.status} ${await res.text()}`);
    const data: any = await res.json();
    objects.push(...(data.objects || []));
    cursor = data.cursor;
  } while (cursor);

  return objects;
}

async function batchRetrieveInventory(env: Env, variationIds: string[]): Promise<Map<string, number>> {
  const res = await fetch(`${SQUARE_API_BASE}/inventory/counts/batch-retrieve`, {
    method: "POST",
    headers: squareHeaders(env),
    body: JSON.stringify({
      catalog_object_ids: variationIds,
      location_ids: [env.SQUARE_LOCATION_ID],
      states: ["IN_STOCK"],
    }),
  });
  if (!res.ok) throw new Error(`inventory batch-retrieve failed: ${res.status} ${await res.text()}`);
  const data: any = await res.json();

  const counts = new Map<string, number>();
  for (const c of data.counts || []) {
    counts.set(c.catalog_object_id, parseInt(c.quantity, 10) || 0);
  }
  return counts;
}

// Deterministic idempotency key: re-syncing returns the same link instead
// of creating a new one each time. The price is part of the key because
// Square snapshots the price into the link's order when it's created;
// without it, a price or name change on the dashboard would keep returning
// the old link (and the old values) forever. Bump the "|ship1" suffix if
// checkout_options change so existing links get regenerated.
async function paymentLinkKey(variationId: string, snapshot: string): Promise<string> {
  return `gallery-${variationId}-${await shortHash(snapshot + "|ship1")}`;
}

async function getOrCreatePaymentLink(env: Env, variationId: string, idempotencyKey: string): Promise<string | null> {
  try {
    const res = await fetch(`${SQUARE_API_BASE}/online-checkout/payment-links`, {
      method: "POST",
      headers: squareHeaders(env),
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        order: {
          location_id: env.SQUARE_LOCATION_ID,
          line_items: [{ catalog_object_id: variationId, quantity: "1" }],
        },
        // Pieces ship, so checkout must collect an address (Google Pay
        // and Apple Pay skip it otherwise). See paymentLinkKey's suffix.
        checkout_options: { ask_for_shipping_address: true },
      }),
    });
    if (!res.ok) {
      console.error("payment link creation failed", res.status, await res.text());
      return null;
    }
    const data: any = await res.json();
    return data.payment_link?.url || null;
  } catch (err) {
    console.error("payment link creation error", err);
    return null;
  }
}

async function shortHash(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function squareHeaders(env: Env): HeadersInit {
  return {
    Authorization: `Bearer ${env.SQUARE_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
    "Square-Version": SQUARE_VERSION,
  };
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
