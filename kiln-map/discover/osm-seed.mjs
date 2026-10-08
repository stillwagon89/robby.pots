// Coverage seeds from OpenStreetMap (free): every pottery/ceramics studio mapped in a state that lists a website.
// They are added to research/cache/<st>/places.json as search hits (q: "osm"), then fetched and run through the same gate, ledger, promote, verify.
//   node kiln-map/discover/osm-seed.mjs ST ...      then   run.mjs ST --stage=fetch   and   seed-judge.mjs ST
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const SOCIAL = /(^|\.)(facebook|instagram|youtube|pinterest|twitter|x|linkedin|yelp|tiktok)\.com$/;
for (const ST of process.argv.slice(2).map((s) => s.toUpperCase())) {
  const q = `[out:json][timeout:120];area["ISO3166-2"="US-${ST}"]->.a;(nwr["craft"~"pottery|ceramics"](area.a);nwr["shop"~"pottery|ceramics"](area.a);nwr["name"~"pottery|ceramic|clay|kiln",i]["website"](area.a););out tags center 3000;`;
  let d;
  for (let a = 0; a < 3 && !d; a++) {
    try { const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: "data=" + encodeURIComponent(q), headers: { "User-Agent": "FlamingClayKilnMap/0.1 (kilns@flamingclay.com)" }, signal: AbortSignal.timeout(150000) }); d = await r.json(); } catch { await new Promise((s) => setTimeout(s, 15000)); }
  }
  if (!d) { console.log(`${ST}: overpass failed`); continue; }
  const f = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const places = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  let added = 0, seen = 0;
  for (const e of d.elements || []) {
    const t = e.tags || {}; let w = t.website || t["contact:website"];
    if (!w) continue; if (!/^https?:/.test(w)) w = "https://" + w;
    let k; try { k = host(w); } catch { continue; }
    if (SOCIAL.test(k)) continue;
    seen++;
    const p = (places[k] ||= { key: k, social: false, known: null, hits: [], pages: {} });
    if (!p.hits.some((h) => h.q === "osm")) { p.hits.push({ q: "osm", url: w, title: t.name || k, snippet: `OpenStreetMap: ${t.name || ""} ${t["addr:city"] || ""} ${t["addr:state"] || ""}`.trim() }); p.osm = { name: t.name, city: t["addr:city"], state: t["addr:state"] }; added++; delete p.fetched; }
  }
  fs.writeFileSync(f, JSON.stringify(places, null, 2));
  console.log(`${ST}: ${seen} OSM studios with a website, ${added} new to the cache`);
  await new Promise((s) => setTimeout(s, 6000));
}
