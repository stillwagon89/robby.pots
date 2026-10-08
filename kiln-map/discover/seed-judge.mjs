// For OSM-seeded places with no judge verdict: keep those whose fetched pages name a non-electric firing type (keyword gate), reject the rest.
// Real judging happens later in verify.mjs (Claude).   node kiln-map/discover/seed-judge.mjs ST ...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const ST of process.argv.slice(2).map((s) => s.toUpperCase())) {
  const f = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  if (!fs.existsSync(f)) continue;
  const P = JSON.parse(fs.readFileSync(f, "utf8"));
  let kept = 0, drop = 0;
  for (const p of Object.values(P)) {
    if (p.judged || !p.osm) continue;
    const text = Object.values(p.pages).join(" ");
    const types = Object.keys(TYPE_RE).filter((t) => TYPE_RE[t].test(text));
    if (types.length) { p.judged = { name: p.osm.name || p.key, city: p.osm.city || "", state: ST, decision: "unclear", access: "none", firing_types: types, quote: "", dates: [], confidence: "low", reason: "OpenStreetMap seed; firing words on its pages", seed: true }; kept++; }
    else { p.judged = { decision: "reject", reason: "OSM seed: no firing words on its pages", auto: true }; drop++; }
  }
  fs.writeFileSync(f, JSON.stringify(P, null, 2));
  console.log(`${ST}: ${kept} OSM seeds kept, ${drop} dropped`);
}
