// Moves pending discovered places filed under the wrong state: counts state mentions ("City, ST 12345", "City, ST", full names)
// in the place's saved pages and re-files it where its own pages say it is.   node kiln-map/discover/rehome.mjs [--dry]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATES, stateName } from "../sources.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const codes = Object.keys(STATES).filter((c) => c !== "DC");
const names = codes.map((c) => [c, stateName(c)]).sort((a, b) => b[1].length - a[1].length);
function tally(text) {
  const t = {};
  for (const m of text.matchAll(/,\s*([A-Z]{2})\b(?:\s+\d{5})?/g)) if (codes.includes(m[1])) t[m[1]] = (t[m[1]] || 0) + 1;
  let rest = text;
  for (const [c, n] of names) { const re = new RegExp(`\\b${n}\\b`, "g"); const k = (rest.match(re) || []).length; if (k) { t[c] = (t[c] || 0) + k; rest = rest.replace(re, " "); } }
  return t;
}
const docs = {};
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) docs[f.slice(0, 2)] = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8"));
const caches = {};
const cache = (st) => (caches[st] ||= (() => { const p = path.join(KM, "research/cache", st.toLowerCase(), "places.json"); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}; })());
const moves = [];
for (const [ST, doc] of Object.entries(docs)) for (const s of doc.sources.filter((x) => x.review === "pending" && x.discovered)) {
  const p = cache(ST)[s.discovered.key];
  if (!p) continue;
  const text = Object.values(p.pages).join(" ") + " " + (s.access?.quote || "");
  const t = tally(text);
  const top = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
  if (top && top[0] !== ST && top[1] >= 2 && top[1] >= 2 * (t[ST] || 0)) moves.push({ from: ST, to: top[0], s, n: top[1], own: t[ST] || 0 });
}
for (const m of moves) console.log(`${m.from} -> ${m.to}: ${m.s.org} (${m.n} vs ${m.own})`);
console.log(`${moves.length} misfiled`);
if (!DRY) {
  for (const m of moves) {
    const src = docs[m.from]; const dst = docs[m.to];
    src.sources = src.sources.filter((x) => x !== m.s);
    (src._removed ||= []).push({ id: m.s.id, why: `Filed under the wrong state; its pages say ${m.to}. Moved there. (${new Date().toISOString().slice(0, 10)})` });
    if (!dst) continue;
    const h = host(m.s.contact?.website);
    if (dst.sources.some((x) => host(x.contact?.website) === h)) continue;
    let id = m.s.id; if (dst.sources.some((x) => x.id === id)) id = `${id}-${m.to.toLowerCase()}`;
    Object.assign(m.s, { id, region: stateName(m.to), city: null, geocode: null, location_note: "Location not confirmed; shown at the state.", weak: true });
    delete m.s.lat; delete m.s.lng;
    dst.sources.push(m.s);
  }
  for (const [ST, doc] of Object.entries(docs)) fs.writeFileSync(path.join(KM, "sources", `${ST}.json`), JSON.stringify(doc, null, 2) + "\n");
}
