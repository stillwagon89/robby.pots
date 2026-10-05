// Fills lat/lng in kiln-map/sources/<STATE>.json from each source's street address
// (location_precision "address") or town (location_precision "approximate",
// via the `geocode` field). Uses OpenStreetMap's Nominatim, one request per
// second as its usage policy asks. Only sources without lat/lng are looked up;
// pass --all to redo every source.
//
//   npm run kiln:geocode

import { loadSources, saveSources, stateName } from "./sources.mjs";

const ALL = process.argv.includes("--all");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sources = loadSources();
for (const s of sources) {
  if (!ALL && typeof s.lat === "number") continue;
  // Add the state when the address or town doesn't already name it, so "Springfield" lands in the right state.
  const raw = s.location_precision === "address" ? s.address : s.geocode;
  const q = raw && !new RegExp(`\\b(${s.state}|${stateName(s.state)})\\b`, "i").test(raw) ? `${raw}, ${stateName(s.state)}` : raw;
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
saveSources(sources);
