// Builds the gallery feed from Square's Item Library instead of a hardcoded
// list. Items tagged with the SQUARE_CATEGORY_NAME category show up here;
// items with inventory tracking on and quantity 0 stay visible but are
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
  GALLERY_CACHE: KVNamespace;
}

const SQUARE_API_BASE = "https://connect.squareup.com/v2";
const SQUARE_VERSION = "2024-10-17";
const CACHE_KEY = "gallery:v1";
const CACHE_TTL_SECONDS = 600;

interface GalleryPiece {
  title: string;
  imageUrl: string;
  price: number | null;
  buyLink: string | null;
  soldOut: boolean;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { env } = context;

  try {
    const cached = await env.GALLERY_CACHE.get(CACHE_KEY, "json");
    if (cached) {
      return jsonResponse(cached);
    }

    const pieces = await buildGallery(env);
    await env.GALLERY_CACHE.put(CACHE_KEY, JSON.stringify(pieces), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
    return jsonResponse(pieces);
  } catch (err) {
    console.error("gallery sync failed", err);
    // Fail soft: an empty gallery is better than a broken page.
    return jsonResponse([]);
  }
};

async function buildGallery(env: Env): Promise<GalleryPiece[]> {
  const objects = await listAllCatalogObjects(env);

  const categoryName = (env.SQUARE_CATEGORY_NAME || "Website").toLowerCase();
  const category = objects.find(
    (o: any) => o.type === "CATEGORY" && String(o.category_data?.name || "").toLowerCase() === categoryName
  );
  if (!category) return [];

  const images = new Map<string, any>();
  for (const o of objects) {
    if (o.type === "IMAGE") images.set(o.id, o);
  }

  const items = objects.filter((o: any) => {
    if (o.type !== "ITEM") return false;
    const categoryList: any[] = o.item_data?.categories || [];
    return categoryList.some((c) => c?.id === category.id);
  });

  // variation id -> live inventory count, only fetched for tracked variations
  const trackedVariationIds = items
    .flatMap((item: any) => item.item_data?.variations || [])
    .filter((v: any) => v?.item_variation_data?.track_inventory)
    .map((v: any) => v.id);

  const inventory = trackedVariationIds.length
    ? await batchRetrieveInventory(env, trackedVariationIds)
    : new Map<string, number>();

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
    const soldOut = tracked && (inventory.get(variation.id) ?? 0) <= 0;

    const priceMoney = variation.item_variation_data?.price_money;
    const price = soldOut ? null : priceMoney?.amount != null ? Math.round(priceMoney.amount) / 100 : null;

    let buyLink: string | null = null;
    if (price != null) {
      buyLink = await getOrCreatePaymentLink(env, variation.id);
    }

    pieces.push({
      title: item.item_data?.name || "Untitled",
      imageUrl,
      price,
      buyLink,
      soldOut,
      updatedAt: item.updated_at || "",
    });
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

async function getOrCreatePaymentLink(env: Env, variationId: string): Promise<string | null> {
  try {
    const res = await fetch(`${SQUARE_API_BASE}/online-checkout/payment-links`, {
      method: "POST",
      headers: squareHeaders(env),
      // Deterministic idempotency key: re-syncing returns the same link
      // instead of creating a new one each time.
      body: JSON.stringify({
        idempotency_key: `gallery-${variationId}`,
        order: {
          location_id: env.SQUARE_LOCATION_ID,
          line_items: [{ catalog_object_id: variationId, quantity: "1" }],
        },
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
