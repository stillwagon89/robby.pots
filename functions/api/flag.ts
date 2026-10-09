// "Is this listing wrong?" flags from the Kiln Locator. A flag never removes anything: it is saved to KV
// (key "flag:<time>:<id>", kept 2 years) so Robby can review the list any time (npm run kiln:flags writes kiln-map/FLAGS.md),
// and a best-effort email goes out through Resend (test mode delivers only to the Resend account owner until
// flamingclay.com is verified there; a failed email never fails the flag).

interface Env {
  GALLERY_CACHE: KVNamespace;
  RATE_LIMIT?: KVNamespace;
  RESEND_API_KEY?: string;
}

const NOTIFY_TO = "robert.stillwagon@gmail.com";
const FROM_ADDRESS = "onboarding@resend.dev";
const clip = (v: unknown, n: number) => String(v ?? "").slice(0, n);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let b: Record<string, unknown>;
  try { b = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }

  const flag = {
    at: new Date().toISOString(),
    place_id: clip(b.place_id, 120),
    listing_id: clip(b.listing_id, 120),
    place_name: clip(b.place_name, 200),
    place_where: clip(b.place_where, 120),
    listing_when: clip(b.listing_when, 120),
    firing_type: clip(b.firing_type, 40),
    view_url: clip(b.view_url, 400),
    title: clip(b.title, 300),
    section: clip(b.section, 120),
    shown_text: clip(b.shown_text, 600),
    page_url: clip(b.page_url, 400),
    source_url: clip(b.source_url, 400),
    ua: clip(request.headers.get("User-Agent"), 160),
  };
  if (!flag.place_id && !flag.listing_id) return json({ error: "Nothing to flag" }, 400);

  // A few flags per visitor per hour, so a script cannot fill the list.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (env.RATE_LIMIT) {
    const k = `flagrate:${ip}:${new Date().toISOString().slice(0, 13)}`;
    const n = Number((await env.RATE_LIMIT.get(k)) || 0);
    if (n >= 8) return json({ ok: true, noted: true }, 200);
    await env.RATE_LIMIT.put(k, String(n + 1), { expirationTtl: 3700 });
  }

  const key = `flag:${flag.at}:${crypto.randomUUID().slice(0, 8)}`;
  try { await env.GALLERY_CACHE.put(key, JSON.stringify(flag), { expirationTtl: 2 * 365 * 24 * 60 * 60 }); } catch (e) { console.error("flag store failed", e); }

  if (env.RESEND_API_KEY) {
    const what = flag.listing_id ? `LISTING: ${flag.title}${flag.listing_when ? ` (${flag.listing_when})` : ""}${flag.firing_type ? `, ${flag.firing_type}` : ""}` : "PLACE (the place itself, not one of its dated listings)";
    const lines = [
      `Someone flagged this as wrong:`, ``, what, `AT: ${flag.place_name}${flag.place_where ? `, ${flag.place_where}` : ""}`, ``,
      `WHICH PART: ${flag.section || "the listing card"}`, flag.shown_text && `TEXT SHOWN: "${flag.shown_text}"`, flag.source_url && `SOURCE LINK SHOWN: ${flag.source_url}`, ``,
      `OPEN IT: ${flag.view_url || flag.page_url}`, `IDs: place=${flag.place_id}${flag.listing_id ? ` listing=${flag.listing_id}` : ""}`, `When: ${flag.at}`,
    ].filter((x) => x !== undefined && x !== false).join("\n");
    try {
      await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to: NOTIFY_TO, from: `Kiln Locator <${FROM_ADDRESS}>`, subject: `Flagged: ${flag.place_name}${flag.title ? ` / ${flag.title}` : " (place)"}`, text: lines }) });
    } catch { /* the flag is already saved */ }
  }
  return json({ ok: true, noted: true }, 200);
};

const json = (data: unknown, status: number) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
