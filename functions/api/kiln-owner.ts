// Studio-owner updates for the Kiln Locator.
//
// Each place gets a private update link: /kiln-update.html?p=<place id>&t=<token>, where the token is an HMAC of the
// place id made with OWNER_SECRET. Anyone holding the link is treated as the place's owner, so nothing is stored per
// place and a link can be re-created at any time (kiln-map/outreach.mjs). Submissions are validated, saved to KV
// ("owner:<place id>:<time>", 2 years) and mailed to Robby best-effort. The weekly job pulls them with
// GET /api/kiln-owner?export=1 and a bearer KILN_ADMIN_TOKEN (kiln-map/owners.mjs).

interface Env {
  GALLERY_CACHE: KVNamespace;
  RATE_LIMIT?: KVNamespace;
  RESEND_API_KEY?: string;
  OWNER_SECRET?: string;
  KILN_ADMIN_TOKEN?: string;
}

const NOTIFY_TO = "robert.stillwagon@gmail.com";
const FROM_ADDRESS = "onboarding@resend.dev";
const TYPES = ["wood", "soda", "salt", "raku", "pit_barrel_saggar", "gas_reduction", "other"];
const AUDIENCES = ["public", "members_only", "students", "invitation_only", "residents_only"];
const STATUSES = ["open", "waitlist", "sold_out", "not_yet_open", "unknown"];
const clip = (v: unknown, n: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

export async function ownerToken(secret: string, placeId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`kiln-owner:${placeId}`));
  return [...new Uint8Array(sig)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

const okDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const okUrl = (s: string) => { try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const url = new URL(request.url);
  // Export for the weekly job.
  if (url.searchParams.get("export")) {
    const auth = request.headers.get("Authorization") || "";
    if (!env.KILN_ADMIN_TOKEN || !same(auth, `Bearer ${env.KILN_ADMIN_TOKEN}`)) return json({ error: "Not allowed" }, 401);
    const out: unknown[] = [];
    let cursor: string | undefined;
    do {
      const page = await env.GALLERY_CACHE.list({ prefix: "owner:", cursor });
      for (const k of page.keys) { const raw = await env.GALLERY_CACHE.get(k.name); if (raw) out.push({ key: k.name, ...JSON.parse(raw) }); }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return json({ submissions: out });
  }
  // Link check for the form: does this token belong to this place?
  const p = url.searchParams.get("p") || "", t = url.searchParams.get("t") || "";
  if (!env.OWNER_SECRET || !p || !t) return json({ ok: false }, 400);
  return json({ ok: same(t, await ownerToken(env.OWNER_SECRET, p)) });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.OWNER_SECRET) return json({ error: "Not set up yet" }, 503);
  let b: Record<string, any>;
  try { b = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  const placeId = clip(b.place_id, 120);
  if (!placeId || !same(clip(b.token, 64), await ownerToken(env.OWNER_SECRET, placeId))) return json({ error: "This update link isn't valid. Ask for a new one." }, 403);

  // A handful of submissions per place per day, so a leaked link can't fill the queue.
  if (env.RATE_LIMIT) {
    const k = `ownerrate:${placeId}:${new Date().toISOString().slice(0, 10)}`;
    const n = Number((await env.RATE_LIMIT.get(k)) || 0);
    if (n >= 10) return json({ error: "Too many updates today. Try again tomorrow." }, 429);
    await env.RATE_LIMIT.put(k, String(n + 1), { expirationTtl: 90000 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 800 * 86400000).toISOString().slice(0, 10);
  const firings = (Array.isArray(b.firings) ? b.firings : []).slice(0, 6).map((f: Record<string, unknown>) => {
    const start = clip(f.start_date, 10), end = clip(f.end_date, 10) || start;
    const signup = clip(f.signup_url, 300);
    return {
      title: clip(f.title, 120),
      firing_type: TYPES.includes(String(f.firing_type)) ? String(f.firing_type) : "other",
      start_date: start, end_date: end,
      audience: AUDIENCES.includes(String(f.audience)) ? String(f.audience) : "public",
      registration_status: STATUSES.includes(String(f.registration_status)) ? String(f.registration_status) : "unknown",
      cost_text: clip(f.cost_text, 80),
      signup_url: signup && okUrl(signup) ? signup : "",
      details: clip(f.details, 400),
    };
  }).filter((f) => f.title);
  for (const f of firings) {
    if (!okDate(f.start_date) || !okDate(f.end_date)) return json({ error: `"${f.title}": please give the dates as year-month-day.` }, 400);
    if (f.end_date < f.start_date) return json({ error: `"${f.title}": the end date is before the start date.` }, 400);
    if (f.end_date < today || f.start_date > horizon) return json({ error: `"${f.title}": that date is in the past or too far ahead.` }, 400);
  }
  const web = clip(b.contact_website, 300);
  const sub = {
    at: new Date().toISOString(),
    place_id: placeId,
    still_active: b.still_active === false || b.still_active === "no" ? false : true,
    firings,
    contact_email: clip(b.contact_email, 120),
    contact_website: web && okUrl(web) ? web : "",
    contact_instagram: clip(b.contact_instagram, 60).replace(/^@/, ""),
    note: clip(b.note, 600),
    by: clip(b.your_name, 80),
  };
  const key = `owner:${placeId}:${sub.at}`;
  await env.GALLERY_CACHE.put(key, JSON.stringify(sub), { expirationTtl: 2 * 365 * 24 * 60 * 60 });

  if (env.RESEND_API_KEY) {
    const lines = [`A studio updated its Kiln Locator listing.`, ``, `Place id: ${placeId}${sub.by ? `  (from ${sub.by})` : ""}`, `Still offering firings: ${sub.still_active ? "yes" : "NO"}`, ...firings.map((f) => `- ${f.title} (${f.firing_type}) ${f.start_date}${f.end_date !== f.start_date ? ` to ${f.end_date}` : ""}, ${f.audience}, ${f.registration_status}${f.signup_url ? `, ${f.signup_url}` : ""}`), sub.note && `Note: ${sub.note}`, ``, `It goes live with the next Monday crawl (or sooner if you run the weekly job).`].filter(Boolean).join("\n");
    try { await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ to: NOTIFY_TO, from: `Kiln Locator <${FROM_ADDRESS}>`, subject: `Studio update: ${placeId}`, text: lines }) }); } catch { /* saved already */ }
  }
  return json({ ok: true });
};
