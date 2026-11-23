// Measures how many places expose machine-readable events. Writes kiln-map/data/structured-probe.json.
//   node kiln-map/structured/probe.mjs [--limit N]
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSources } from "../sources.mjs";
import { get } from "./fetch.mjs";
import { jsonLdEvents, signals } from "./detect.mjs";
const ROOT = dirname(fileURLToPath(import.meta.url));
const lim = Number(process.argv[process.argv.indexOf("--limit") + 1]) || 0;
let sources = loadSources().filter((s) => !s.hold && s.urls?.length);
if (lim) sources = sources.slice(0, lim);
const results = []; let i = 0;
async function one(s) {
  const r = { id: s.id, org: s.org, state: s.state, pages: 0, jsonld_events: 0, signals: [], links: [], tribe_api: null, sample: null, errors: 0 };
  const urls = [...new Set(s.urls)].slice(0, 3);
  for (const u of urls) {
    const p = await get(u, { accept: "text/html" }); r.pages++;
    if (!p.ok) { r.errors++; continue; }
    const ev = jsonLdEvents(p.text); r.jsonld_events += ev.length; if (ev.length && !r.sample) r.sample = ev[0].name || null;
    const sg = signals(p.text, p.url || u); r.signals.push(...sg.signals); r.links.push(...sg.links.slice(0, 4));
  }
  r.signals = [...new Set(r.signals)];
  if (r.signals.includes("tribe") || r.signals.includes("mec")) {
    const o = new URL(urls[0]).origin; const t = await get(`${o}/wp-json/tribe/events/v1/events?per_page=5`, { accept: "application/json" });
    if (t.ok) { try { const j = JSON.parse(t.text); r.tribe_api = (j.events || []).length; } catch { /* not json */ } }
  }
  return r;
}
async function worker() { while (i < sources.length) { const s = sources[i++]; results.push(await one(s)); if (results.length % 25 === 0) console.log(`${results.length}/${sources.length}`); } }
await Promise.all(Array.from({ length: 8 }, worker));
mkdirSync(join(ROOT, "..", "data"), { recursive: true });
writeFileSync(join(ROOT, "..", "data", "structured-probe.json"), JSON.stringify({ at: new Date().toISOString(), results }, null, 1));
const n = results.length, c = (f) => results.filter(f).length;
console.log(`places ${n}; reachable ${c((r) => r.errors < r.pages)}; JSON-LD events ${c((r) => r.jsonld_events)}; ics ${c((r) => r.signals.includes("ics"))}; tribe api ${c((r) => r.tribe_api)}; gcal ${c((r) => r.signals.includes("gcal"))}; eventbrite ${c((r) => r.signals.includes("eventbrite"))}; bookeo ${c((r) => r.signals.includes("bookeo"))}; squarespace ${c((r) => r.signals.includes("squarespace"))}; wix ${c((r) => r.signals.includes("wix-events"))}; mindbody ${c((r) => r.signals.includes("mindbody"))}`);
