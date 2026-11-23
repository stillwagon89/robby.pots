// Reads machine-readable events from every place's own site (no AI, no cost) and files the firing ones as pending items.
//   node kiln-map/structured/harvest.mjs [--only id1,id2] [--dry]
// Runs in the weekly job before triage.mjs, which approves clear items at public places.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSources, todayIn } from "../sources.mjs";
import { get } from "./fetch.mjs";
import { jsonLdEvents, signals } from "./detect.mjs";
import { parseIcs, fromJsonLd, fromTribe, toItem } from "./events.mjs";

const KM = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;

const existing = [];
for (const f of ["pending", "approved", "rejected"]) { const d = join(KM, "data", f); if (existsSync(d)) for (const x of readdirSync(d).filter((x) => x.endsWith(".json"))) { try { existing.push(JSON.parse(readFileSync(join(d, x), "utf8"))); } catch { /* skip */ } } }
const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 86400000;
const words = (t) => new Set(String(t || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(" ").filter((w) => w.length > 2));
const similar = (a, b) => { const A = words(a), B = words(b); const n = [...A].filter((w) => B.has(w)).length; return n / (Math.min(A.size, B.size) || 1) >= 0.5; };
// Same place, within 3 days, and either the same type or a similar title (the AI reader and the feed may type one event differently).
const known = (it) => existing.some((e) => e.id === it.id || (e.source_id === it.source_id && e.start_date && days(e.start_date, it.start_date) <= 3 && (e.firing_type === it.firing_type || similar(e.title, it.title))));

let sources = loadSources().filter((s) => !s.hold && !s.flag_hold && s.urls?.length && (!only || only.includes(s.id)));
const stats = { places: 0, with_events: 0, firing_items: 0, new_items: 0, by: {} };
const perPlace = {};
let next = 0;

async function one(s) {
  const today = todayIn(s.tz); const found = []; const seenUrl = new Set();
  const add = (via, evs) => { for (const e of evs) { const it = toItem(s, e, via, today); if (it) found.push(it); } stats.by[via] = (stats.by[via] || 0) + evs.length; };
  const urls = [...new Set(s.urls)].slice(0, 3); const feeds = [];
  let sig = new Set();
  for (const u of urls) {
    const p = await get(u, { accept: "text/html" }); if (!p.ok) continue;
    add("jsonld", fromJsonLd(jsonLdEvents(p.text)));
    const g = signals(p.text, p.url || u); g.signals.forEach((x) => sig.add(x));
    for (const [kind, link] of g.links) if (link && !seenUrl.has(link)) { seenUrl.add(link); if (kind === "ics") feeds.push(link); if (kind === "gcal") { const id = link.startsWith("http") ? (new URL(link).searchParams.get("src") || "") : link; if (id) feeds.push(`https://calendar.google.com/calendar/ical/${encodeURIComponent(id)}/public/basic.ics`); } }
  }
  for (const f of feeds.slice(0, 3)) { const r = await get(f, { accept: "text/calendar" }); if (r.ok && /BEGIN:VCALENDAR/.test(r.text)) add("ics", parseIcs(r.text).map((e) => ({ ...e, online: false }))); }
  if (sig.has("tribe")) {
    const t = await get(`${new URL(urls[0]).origin}/wp-json/tribe/events/v1/events?per_page=50&start_date=${today}`, { accept: "application/json" });
    if (t.ok) { try { add("tribe", fromTribe(JSON.parse(t.text))); } catch { /* not json */ } }
  }
  // Squarespace and other event-list platforms are measured by probe.mjs; adapters are added where they pay off.
  const uniq = [...new Map(found.map((i) => [i.id, i])).values()];
  stats.places++; if (stats.by) perPlace[s.id] = { signals: [...sig], events: uniq.length };
  if (uniq.length) stats.with_events++;
  stats.firing_items += uniq.length;
  for (const it of uniq) if (!known(it)) { stats.new_items++; existing.push(it); if (!DRY) { mkdirSync(join(KM, "data", "pending"), { recursive: true }); writeFileSync(join(KM, "data", "pending", `${it.id}.json`), JSON.stringify(it, null, 2) + "\n"); } else console.log(`  would add: ${s.org}: ${it.title} ${it.start_date} (${it.firing_type}, via ${it.found_by})`); }
}
async function worker() { while (next < sources.length) { const s = sources[next++]; try { await one(s); } catch (e) { console.log(`skip ${s.id}: ${e.message}`); } } }
await Promise.all(Array.from({ length: 8 }, worker));
if (!DRY) writeFileSync(join(KM, "data", "structured-last.json"), JSON.stringify({ at: new Date().toISOString(), stats, places: perPlace }, null, 1));
console.log(`structured: ${stats.places} places read, ${stats.with_events} with firing events, ${stats.firing_items} firing events found (${JSON.stringify(stats.by)}), ${stats.new_items} new.`);
