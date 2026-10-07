// Second-opinion check: Gemini reads the same cached pages as the first judge and must back every firing type with its own
// word-for-word quote. Code then confirms each quote is really in the pages and each type keyword is in the quote.
//   node kiln-map/discover/verify.mjs [--apply] [ST ...]     (pending discovery sources only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
import { stateName } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = path.resolve(KM, "..");
const env = Object.fromEntries(fs.readFileSync(path.join(ROOT, ".dev.vars"), "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "").trim()]));
const APPLY = process.argv.includes("--apply");
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
verdict "yes": the text shows outsiders (not only enrolled students or existing members) can join, book or sign up for at least one raku, wood/anagama, soda, salt, pit/barrel/saggar or gas-reduction firing, via a workshop, class, membership, rental, firing service or appointment.
verdict "no": electric-only, paint-your-own, a directory/blog/shop that runs no firings, a school with students only, or nothing about such firings.
verdict "unclear": hints but cannot tell.
"types": list ONLY firing types for which you can copy a sentence word for word from the text that names that firing method. No sentence naming it = leave it out. Never guess.
"town_on_page"/"state_on_page"/"street_address": only if written in the text, else empty string.`;

const POOL = (process.env.VERIFY_MODELS || "gemma-4-31b-it,gemini-3.1-flash-lite,gemini-3.5-flash-lite,gemini-3-flash-preview,gemma-4-26b-a4b-it").split(",");
const dead = new Set();
const FORMAT = `Return ONLY one JSON object, no markdown: {"verdict":"yes|unclear|no","why":"one sentence","town_on_page":"","state_on_page":"","street_address":"","types":[{"type":"raku|wood|soda|salt|pit_barrel_saggar|gas_reduction","quote":"word-for-word sentence"}]}`;
let rr = 0;
async function ask(text) {
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

const jobs = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2);
  if (only.length && !only.includes(ST)) continue;
  const doc = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8"));
  const pf = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  const places = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : {};
  for (const s of doc.sources.filter((x) => x.discovered?.by === "discover-v3" && x.review === "pending" && !x.verify)) {
    const p = places[s.discovered.key];
    if (p) jobs.push({ f, ST, doc, s, p });
  }
}
log(`verify: ${jobs.length} places with ${MODEL}`);
const results = [];
let done = 0;
const queue = [...jobs];
const worker = async () => {
  while (queue.length) {
    const j = queue.shift();
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
    await new Promise((res) => setTimeout(res, 800));
  }
};
await Promise.all(Array.from({ length: 2 }, worker));

if (APPLY) {
  const TODAY = new Date().toISOString().slice(0, 10);
  const docs = new Map();
  for (const j of jobs) {
    if (j.v.error) continue;
    docs.set(j.f, j.doc);
    const types = Object.keys(j.v.types);
    j.s.verify = { by: j.v.model || MODEL, date: TODAY, verdict: j.v.verdict, why: j.v.why, types: j.v.types, ...(j.v.street ? { street: j.v.street } : {}) };
    const stOk = !j.v.state || new RegExp(`^(${j.ST}|${stateName(j.ST)})$`, "i").test(j.v.state.trim());
    if ((j.v.verdict === "no" && !/empty|no (readable )?(page )?text|no information|not provided|no content/i.test(j.v.why)) || !stOk) {
      if (!stOk && j.v.verdict !== "no") j.v.why = `page says state is ${j.v.state}, not ${j.ST}`;
      (j.doc._removed ||= []).push({ id: j.s.id, why: `Second check (${j.v.model}): ${j.v.why} (${TODAY})` });
      j.doc.sources = j.doc.sources.filter((x) => x !== j.s);
    } else {
      if (types.length) { j.s.firing_types_guess = types; if (j.s.access) j.s.access.types = types; }
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
  fs.writeFileSync(path.join(KM, "research/cache/verify-last.json"), JSON.stringify(jobs.map((j) => ({ st: j.ST, id: j.s.id, ...j.v })), null, 1));
}
log("verify: done");
