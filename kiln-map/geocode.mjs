// Fills lat/lng in kiln-map/sources.json from each source's street address
// (location_precision "address") or town (location_precision "approximate",
// via the `geocode` field). Uses OpenStreetMap's Nominatim, one request per
// second as its usage policy asks. Only sources without lat/lng are looked up;
// pass --all to redo every source.
//
//   npm run kiln:geocode

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FILE = join(dirname(fileURLToPath(import.meta.url)), "sources.json");
const ALL = process.argv.includes("--all");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const data = JSON.parse(readFileSync(FILE, "utf8"));
for (const s of data.sources) {
  if (!ALL && typeof s.lat === "number") continue;
  const q = s.location_precision === "address" ? s.address : s.geocode;
  if (!q) {
    console.log(`- ${s.id}: no address or town to look up`);
    continue;
  }
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { "User-Agent": "FlamingClayFiringsMap/0.1 (+https://flamingclay.com)" }, signal: AbortSignal.timeout(20000) });
  const [hit] = await res.json();
  if (!hit) {
    console.log(`- ${s.id}: NOT FOUND for "${q}"`);
  } else {
    s.lat = Number(Number(hit.lat).toFixed(5));
    s.lng = Number(Number(hit.lon).toFixed(5));
    console.log(`- ${s.id}: ${s.lat}, ${s.lng}  (${hit.display_name.slice(0, 90)})`);
  }
  await sleep(1100);
}
writeFileSync(FILE, JSON.stringify(data, null, 2) + "\n");
