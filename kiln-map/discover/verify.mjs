// Second-opinion check: Gemini reads the same cached pages as the first judge and must back every firing type with its own
// word-for-word quote. Code then confirms each quote is really in the pages and each type keyword is in the quote.
//   node kiln-map/discover/verify.mjs [--apply] [ST ...]     (pending discovery sources only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
import { stateName, STATES } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(KM, "..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".dev.vars"), "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "").trim()]));
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const LIVE = process.argv.includes("--live"); // weak places only: re-read their live site (home + class/workshop/firing pages), not the trimmed cache
const only = process.argv.slice(2).filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());
const MODEL = process.env.VERIFY_MODEL || "gemini-3.5-flash";
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const SCHEMA = {
  type: "OBJECT",
  properties: {
    verdict: { type: "STRING", enum: ["yes", "unclear", "no"] },
    why: { type: "STRING" },
    town_on_page: { type: "STRING" },
    state_on_page: { type: "STRING" },
    street_address: { type: "STRING" },
    types: { type: "ARRAY", items: { type: "OBJECT", properties: { type: { type: "STRING", enum: ["raku", "wood", "soda", "salt", "pit_barrel_saggar", "gas_reduction"] }, quote: { type: "STRING" } }, required: ["type", "quote"] } },
  },
  required: ["verdict", "why", "town_on_page", "state_on_page", "street_address", "types"],
};
const PROMPT = `You fact-check one listing for a map of places where the PUBLIC can take part in a NON-electric ceramic firing.
Read ONLY the page text given. Do not use outside knowledge.
verdict "yes": the text shows outsiders (not only enrolled students or existing members) can join, book or sign up for at least one raku, wood/anagama, soda, salt, pit/barrel/saggar or gas-reduction firing, via a workshop, class, membership, rental, firing service, appointment, or an open invitation to email/contact them to join a firing (an open invitation COUNTS as public access).
verdict "no": electric-only, paint-your-own, a directory/blog/shop that runs no firings, a school with students only, or nothing about such firings.
verdict "unclear": hints but cannot tell.
"types": list ONLY firing types where you can copy a sentence word for word showing a way for outsiders to take part in THAT firing type (class, workshop, membership, rental, firing service, or an invitation to contact them to join). A bare mention of a technique (e.g. a menu item, a photo caption, "we also do raku") does not count. No such sentence = leave it out. Never guess.
"state_on_page": the two-letter state where THIS place itself is located, taken from its own address or contact details (not from where an instructor, event, or other site is). Empty string if the text does not say. "town_on_page" and "street_address": same rule.`;

const POOL = (process.env.VERIFY_MODELS || "gemma-4-31b-it,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3-flash-preview,gemma-4-26b-a4b-it").split(",");
const dead = new Set();
const FORMAT = `Return ONLY one JSON object, no markdown: {"verdict":"yes|unclear|no","why":"one sentence","town_on_page":"","state_on_page":"","street_address":"","types":[{"type":"raku|wood|soda|salt|pit_barrel_saggar|gas_reduction","quote":"word-for-word sentence"}]}`;
let rr = 0;
async function askLocal(text) {
  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    body: JSON.stringify({ model: "gemma4:latest", stream: false, format: "json", think: false, options: { temperature: 0, num_ctx: 8192 }, messages: [{ role: "user", content: `${PROMPT}\n\n${FORMAT}\n\n${text.slice(0, 9000)}` }] }),
    signal: AbortSignal.timeout(300000),
  });
  const j = JSON.parse((await r.json()).message.content);
  j._model = "gemma4-local";
  return j;
}
let spent = { inTok: 0, outTok: 0 };
async function askClaude(text) {
  for (let a = 0; a < 8; a++) {
    let r;
    try {
      r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 900, temperature: 0, system: PROMPT, messages: [{ role: "user", content: `${FORMAT}\n\n${text}` }] }),
        signal: AbortSignal.timeout(120000),
      });
    } catch { await new Promise((res) => setTimeout(res, 3000)); continue; }
    if (r.status === 429 || r.status >= 500) { await new Promise((res) => setTimeout(res, 5000 * (a + 1))); continue; }
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    spent.inTok += d.usage?.input_tokens || 0; spent.outTok += d.usage?.output_tokens || 0;
    if (spent.inTok * 1 + spent.outTok * 5 > 8e6) throw new Error("cost cap reached (~$8)");
    const m = (d.content?.[0]?.text || "").match(/\{[\s\S]*\}/);
    if (!m) continue;
    const j = JSON.parse(m[0]); j._model = "claude-haiku-4.5"; return j;
  }
  throw new Error("claude: no usable answer");
}
async function ask(text) {
  if (process.env.VERIFY_PROVIDER === "claude") return askClaude(text);
  if (process.env.VERIFY_LOCAL) return askLocal(text);
  for (let a = 0; a < 12; a++) {
    const live = POOL.filter((m) => !dead.has(m));
    if (!live.length) throw new Error("all models out of quota");
    const model = live[rr++ % live.length];
    let r;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: `${PROMPT}\n\n${FORMAT}\n\n${text}` }] }], generationConfig: { temperature: 0 } }),
        signal: AbortSignal.timeout(120000),
      });
    } catch { continue; }
    const raw = await r.text();
    let d; try { d = JSON.parse(raw); } catch { d = null; }
    if (r.status === 429) {
      const msg = d?.error?.message || "";
      if (/PerDay|per day|retry in \d+h|limit: \d+, model/i.test(msg) && !/PerMinute/i.test(msg)) dead.add(model);
      else await new Promise((res) => setTimeout(res, 10000));
      continue;
    }
    if (r.status === 404 || r.status === 400) { dead.add(model); continue; }
    if (r.status >= 500 || !d) { await new Promise((res) => setTimeout(res, 5000)); continue; }
    const t = d.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const m = t.match(/\{[\s\S]*\}/);
    if (!m) continue;
    try { const j = JSON.parse(m[0]); j._model = model; return j; } catch { continue; }
  }
  throw new Error("no usable answer");
}

const UA = "Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36 FlamingClayFiringsBot/0.1 (+https://flamingclay.com)";
const lastHit = new Map(), robotsOk = new Map();
async function liveGet(u) {
  try {
    const o = new URL(u).origin;
    if (!robotsOk.has(o)) { let ok = true; try { const r = await fetch(`${o}/robots.txt`, { signal: AbortSignal.timeout(8000) }); if (r.ok) ok = !/user-agent:\s*\*\s*\n(?:[^\n]*\n)*?\s*disallow:\s*\/\s*(\n|$)/i.test(await r.text()); } catch {} robotsOk.set(o, ok); }
    if (!robotsOk.get(o)) return "";
    const h = new URL(u).host; const w = (lastHit.get(h) || 0) + 1200 - Date.now(); lastHit.set(h, Date.now() + Math.max(w, 0)); if (w > 0) await new Promise((r) => setTimeout(r, w));
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": UA, Accept: "text/html" } });
    return r.ok ? await r.text() : "";
  } catch { return ""; }
}
const toText = (h) => h.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
async function livePages(base) {
  const pages = {};
  const home = await liveGet(base); if (!home) return pages;
  pages[base] = toText(home).slice(0, 3500);
  const links = [...home.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)].map((m) => { try { return { u: new URL(m[1], base).href, t: m[2].replace(/<[^>]+>/g, " ") }; } catch { return null; } })
    .filter((x) => x && new URL(x.u).host === new URL(base).host && !/\.(jpe?g|png|pdf|zip)$/i.test(x.u) && /class|workshop|fir(e|ing)|kiln|member|event|calendar|raku|wood|soda|gas|program|schedule|rent|service|studio|about|visit/i.test(x.u + " " + x.t));
  for (const l of [...new Map(links.map((x) => [x.u, x])).values()].slice(0, 5)) { const t = toText(await liveGet(l.u)); if (t) pages[l.u] = t.slice(0, 3500); }
  return pages;
}
const jobs = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2);
  if (only.length && !only.includes(ST)) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8"));
  const pf = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  const places = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : {};
  for (const s of doc.sources.filter((x) => x.discovered?.by === "discover-v3" && x.review === "pending" && (FORCE || LIVE || !x.verify) && (!LIVE || x.weak))) {
    const p = places[s.discovered.key];
    if (p) jobs.push({ f, ST, doc, s, p: LIVE ? { ...p, pages: {} } : p });
  }
}
log(`verify: ${jobs.length} places with ${MODEL}`);
const results = [];
let done = 0;
const queue = [...jobs];
const worker = async () => {
  while (queue.length) {
    const j = queue.shift();
    if (LIVE && !Object.keys(j.p.pages).length) j.p.pages = await livePages(j.s.contact?.website || j.s.urls?.[0]);
    const pages = Object.entries(j.p.pages).map(([u, t]) => `--- ${u}\n${t}`).join("\n").slice(0, 14000);
    const hay = norm(pages + " " + j.p.hits.map((h) => h.snippet).join(" "));
    try {
      const snips = j.p.hits.slice(0, 4).map((h) => `- ${h.title}: ${h.snippet}`).join("\n");
      const v = await ask(`PLACE: ${j.s.org}\nSITE: ${j.p.key}\n\nSEARCH SNIPPETS:\n${snips}\n\nPAGE TEXT:\n${pages || "(none)"}`);
      // Code check: quote must be in the pages AND name the firing type.
      const good = {};
      for (const t of v.types || []) if (!good[t.type] && hay.includes(norm(t.quote)) && TYPE_RE[t.type].test(t.quote)) good[t.type] = t.quote.replace(/\s+/g, " ").slice(0, 300);
      j.v = { model: v._model, verdict: v.verdict, why: v.why, town: v.town_on_page, state: v.state_on_page, street: v.street_address, types: good };
    } catch (e) { j.v = { error: String(e.message).slice(0, 120) }; }
    log(`verify ${++done}/${jobs.length} ${j.ST} ${j.s.id}: ${j.v.verdict || "ERR " + j.v.error} [${Object.keys(j.v.types || {}).join(",")}]${j.v.verdict === "no" ? " — " + j.v.why : ""}`);
    if (process.env.VERIFY_PROVIDER !== "claude") await new Promise((res) => setTimeout(res, 800));
  }
};
await Promise.all(Array.from({ length: +process.env.VERIFY_WORKERS || 2 }, worker));

if (APPLY) {
  const TODAY = new Date().toISOString().slice(0, 10);
  const docs = new Map();
  const rehome = [];
  for (const j of jobs) {
    if (j.v.error) continue;
    docs.set(j.f, j.doc);
    const types = Object.keys(j.v.types);
    j.s.verify = { by: j.v.model || MODEL, date: TODAY, verdict: j.v.verdict, why: j.v.why, types: j.v.types, state: j.v.state || "", town: j.v.town || "", ...(j.v.street ? { street: j.v.street } : {}) };
    const stOk = !j.v.state || new RegExp(`^(${j.ST}|${stateName(j.ST)})$`, "i").test(j.v.state.trim());
    if ((j.v.verdict === "no" && !/empty|no (readable )?(page )?text|no information|not provided|no content/i.test(j.v.why)) || !stOk) {
      if (!stOk && j.v.verdict !== "no") j.v.why = `page says state is ${j.v.state}, not ${j.ST}`;
      (j.doc._removed ||= []).push({ id: j.s.id, why: `Second check (${j.v.model}): ${j.v.why} (${TODAY})` });
      const dstCode = (j.v.state || "").trim().toUpperCase();
      if (!stOk && j.v.verdict !== "no" && STATES[dstCode] && dstCode !== j.ST) rehome.push({ to: dstCode, s: { ...j.s, verify: { by: j.v.model || MODEL, date: TODAY, verdict: j.v.verdict, why: j.v.why, types: j.v.types, state: dstCode, town: j.v.town || "" } } });
      j.doc.sources = j.doc.sources.filter((x) => x !== j.s);
    } else {
      if (types.length) {
        j.s.firing_types_guess = types; if (j.s.access) j.s.access.types = types;
        // Link people straight to the page that talks about the firing, not the homepage.
        const q = norm(Object.values(j.v.types)[0]);
        const pg = Object.entries(j.p.pages).find(([, t]) => norm(t).includes(q));
        if (pg && j.s.access) j.s.access.url = pg[0];
      }
      if (j.v.verdict !== "yes" || !types.length || !(j.v.town || j.s.city)) j.s.weak = true;
      if (j.v.town && !j.s.city) { j.s.city = j.v.town; j.s.region = j.v.town; j.s.geocode = `${j.v.town}, ${stateName(j.ST)}`; }
    }
  }
  // Re-read each file right before writing and merge by id, so geocoding or promotion that ran meanwhile is never overwritten.
  for (const [f] of docs) {
    const fp = path.join(KM, "sources", f);
    const cur = JSON.parse(fs.readFileSync(fp, "utf8"));
    const mine = docs.get(f);
    const removed = new Set((mine._removed || []).map((r) => r.id));
    const byId = new Map(mine.sources.map((x) => [x.id, x]));
    cur.sources = cur.sources.filter((x) => !removed.has(x.id)).map((x) => {
      const m = byId.get(x.id);
      return m && m.verify ? { ...x, firing_types_guess: m.firing_types_guess, access: m.access ?? x.access, verify: m.verify, ...(m.weak ? { weak: true } : {}), ...(m.city && !x.city ? { city: m.city, region: m.region, geocode: m.geocode } : {}) } : x;
    });
    cur._removed = [...(cur._removed || []), ...(mine._removed || []).filter((r) => !(cur._removed || []).some((c) => c.id === r.id))];
    fs.writeFileSync(fp, JSON.stringify(cur, null, 2) + "\n");
  }
  // Re-file places whose own pages say they are in another state (state-level pin until the town is geocoded).
  for (const m of rehome) {
    const fp = path.join(KM, "sources", `${m.to}.json`);
    const dst = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf8")) : { _note: `${m.to} firing sources.`, sources: [] };
    const h = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
    if (dst.sources.some((x) => h(x.contact?.website) === h(m.s.contact?.website))) continue;
    let id = m.s.id; if (dst.sources.some((x) => x.id === id)) id = `${id}-${m.to.toLowerCase()}`;
    const town = m.s.verify.town;
    Object.assign(m.s, { id, region: town || stateName(m.to), city: town || null, geocode: town ? `${town}, ${stateName(m.to)}` : null, location_note: town ? "Shown at the town." : "Location not confirmed; shown at the state.", weak: true });
    delete m.s.lat; delete m.s.lng;
    dst.sources.push(m.s);
    fs.writeFileSync(fp, JSON.stringify(dst, null, 2) + "\n");
  }
  fs.writeFileSync(path.join(KM, "research/cache/verify-last.json"), JSON.stringify(jobs.map((j) => ({ st: j.ST, id: j.s.id, ...j.v })), null, 1));
}
log(`verify: done (Claude tokens in/out: ${spent.inTok}/${spent.outTok} ≈ $${((spent.inTok * 1 + spent.outTok * 5) / 1e6).toFixed(2)})`);
