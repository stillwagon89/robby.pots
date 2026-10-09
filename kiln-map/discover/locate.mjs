// Rule-based location check (no AI): reads each pending place's own live pages for a postal address
// (schema.org JSON-LD or "Town, ST 12345"), confirms the state/town, and looks the place up on OpenStreetMap.
//   node kiln-map/discover/locate.mjs [--apply] [ST ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { STATES, stateName } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const only = process.argv.slice(2).filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const UA = "Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36 FlamingClayFiringsBot/0.1 (+https://flamingclay.com)";
const CODES = new Set(Object.keys(STATES));
const lastHit = new Map(), robots = new Map();
const host = (u) => { try { return new URL(u).host; } catch { return ""; } };
async function allowed(u) {
  const o = new URL(u).origin;
  if (!robots.has(o)) {
    let block = false;
    try { const r = await fetch(`${o}/robots.txt`, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": UA } }); if (r.ok) { const t = await r.text(); block = /user-agent:\s*\*\s*\n(?:[^\n]*\n)*?\s*disallow:\s*\/\s*(\n|$)/i.test(t); } } catch {}
    robots.set(o, !block);
  }
  return robots.get(o);
}
async function get(u) {
  try {
    if (!(await allowed(u))) return "";
    const h = host(u); const wait = (lastHit.get(h) || 0) + 1500 - Date.now(); lastHit.set(h, Date.now() + Math.max(wait, 0)); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": UA, Accept: "text/html" } });
    return r.ok ? await r.text() : "";
  } catch { return ""; }
}
function extract(html) {
  const out = [];
  for (const m of html.matchAll(/"addressLocality"\s*:\s*"([^"]+)"[^}]*?"addressRegion"\s*:\s*"([A-Za-z .]+)"|"addressRegion"\s*:\s*"([A-Za-z .]+)"[^}]*?"addressLocality"\s*:\s*"([^"]+)"/g)) {
    const town = m[1] || m[4], reg = (m[2] || m[3] || "").trim();
    const code = CODES.has(reg.toUpperCase()) ? reg.toUpperCase() : Object.keys(STATES).find((c) => stateName(c).toLowerCase() === reg.toLowerCase());
    if (code) out.push({ st: code, town, w: 5, ld: true });
  }
  const text = html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  for (const m of text.matchAll(/([A-Z][A-Za-z.'’-]+(?: [A-Z][A-Za-z.'’-]+){0,2}),?\s+([A-Z]{2})\s+(\d{5})(?:-\d{4})?\b/g)) if (CODES.has(m[2])) out.push({ st: m[2], town: m[1], zip: m[3], w: 2 });
  // Street addresses: "3434 W. Earll Dr., Suite 101, Phoenix, AZ 85017" or "4190 West Highway 80, Douglas, AZ"
  for (const m of text.matchAll(/(\d{1,6}\s+(?:[NSEW]\.?\s+|North\s+|South\s+|East\s+|West\s+)?[A-Za-z0-9.'’ -]{2,40}?\s(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Highway|Hwy|Parkway|Pkwy|Court|Ct|Place|Pl|Circle|Cir|Trail|Trl)\b\.?(?:,?\s*(?:Suite|Ste|Unit|#)\.?\s*[\w-]+)?),?\s+([A-Z][A-Za-z.'’ -]{2,30}),?\s+([A-Z]{2})\b(?:\s+(\d{5}))?/g)) if (CODES.has(m[3])) out.push({ st: m[3], town: m[2].trim(), street: m[1].replace(/\s+/g, " ").trim(), zip: m[4] || "", w: 3 });
  return out;
}
const jobs = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); if (only.length && !only.includes(ST)) continue;
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) if (s.review === "pending" && s.discovered && s.contact?.website) jobs.push({ ST, s });
}
log(`locate: ${jobs.length} places`);
let done = 0;
const queue = [...jobs];
async function worker() {
  while (queue.length) {
    const j = queue.shift();
    const base = j.s.contact.website;
    let html = await get(base);
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)].map((m) => { try { return { u: new URL(m[1], base).href, t: m[2].replace(/<[^>]+>/g, " ") }; } catch { return null; } }).filter((x) => x && host(x.u) === host(base) && /contact|visit|about|location|find|studio|where/i.test(x.u + " " + x.t));
    for (const l of [...new Map(links.map((x) => [x.u, x])).values()].slice(0, 2)) html += " " + (await get(l.u));
    const found = extract(html);
    const tally = {};
    const ldSet = new Set(); const streets = {};
    for (const x of found) { const k = `${x.st}|${x.town}`; tally[k] = (tally[k] || 0) + x.w; if (x.ld) ldSet.add(k); if (x.street) (streets[k] ||= []).push(x); }
    const best = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    j.loc = best ? { st: best[0].split("|")[0], town: best[0].split("|")[1], score: best[1], found: Object.keys(tally).length, ld: ldSet.has(best[0]), street: streets[best[0]]?.[0] || null } : null;
    if (++done % 25 === 0) log(`locate ${done}/${jobs.length}`);
  }
}
const REUSE = process.env.LOCATE_REUSE ? JSON.parse(fs.readFileSync(path.join(KM, "research/cache/locate-last.json"), "utf8")) : null;
if (REUSE) { for (const j of jobs) { const r = REUSE.find((x) => x.st === j.ST && x.id === j.s.id); if (r) { j.loc = r.loc; j.osm = r.osm; } } queue.length = 0; }
await Promise.all(Array.from({ length: 6 }, worker));

// OpenStreetMap lookup (1 request/second): does a place by this name exist near the claimed town?
async function osm(j) {
  const q = `${j.s.org}, ${(j.loc?.town || j.s.city || "")}, ${stateName(j.loc?.st || j.ST)}`;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, { headers: { "User-Agent": "FlamingClayKilnMap/0.1 (kilns@flamingclay.com)" }, signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    return d[0] ? { name: d[0].display_name.slice(0, 120), type: d[0].type } : null;
  } catch { return null; }
}
for (const j of REUSE ? [] : jobs.filter((j) => !j.loc || j.loc.st === j.ST)) { j.osm = await osm(j); await new Promise((r) => setTimeout(r, 1100)); }

// The page's own schema.org address beats any AI reading (Lakeside Pottery: AI said CT, the page says DE). A zip-text address alone also needs the AI reading not to put the place in its filed state.
const claims = (j) => (j.s.verify?.state || "").toUpperCase() === j.ST || (j.s.verify?.state || "").toLowerCase() === stateName(j.ST).toLowerCase();
const mism = jobs.filter((j) => j.loc && j.loc.st !== j.ST && (j.loc.ld || (j.loc.score >= 4 && !claims(j))));
const noAddr = jobs.filter((j) => !j.loc);
log(`locate: ${jobs.length - mism.length - noAddr.length} confirmed in filed state, ${mism.length} in another state, ${noAddr.length} no address found`);
for (const j of mism) console.log(`  ${j.ST} -> ${j.loc.st}: ${j.s.org} (${j.loc.town})`);
if (!REUSE) fs.writeFileSync(path.join(KM, "research/cache/locate-last.json"), JSON.stringify(jobs.map((j) => ({ st: j.ST, id: j.s.id, loc: j.loc, osm: j.osm })), null, 1));
if (APPLY) {
  const TODAY = new Date().toISOString().slice(0, 10);
  const byFile = new Map();
  for (const j of jobs) { if (!byFile.has(j.ST)) byFile.set(j.ST, []); byFile.get(j.ST).push(j); }
  const rehome = [];
  for (const [ST, js] of byFile) {
    const fp = path.join(KM, "sources", `${ST}.json`); const cur = JSON.parse(fs.readFileSync(fp, "utf8"));
    for (const j of js) {
      const s = cur.sources.find((x) => x.id === j.s.id); if (!s) continue;
      s.located = { ...(j.loc ? { state: j.loc.st, town: j.loc.town, score: j.loc.score } : {}), osm: j.osm ? true : false, date: TODAY };
      if (s.confirmed_by_robby || s.review === "approved") { s.located = { ...s.located, kept: true }; continue; }
      if (mism.includes(j)) { cur.sources = cur.sources.filter((x) => x !== s); (cur._removed ||= []).push({ id: s.id, why: `Its own pages give an address in ${j.loc.st} (${j.loc.town}), not ${ST}. Moved. (${TODAY})` }); rehome.push({ to: j.loc.st, s }); continue; }
      // Exact pin when the page itself gives a street address (not for home studios or "private" places).
      if (j.loc?.street && j.loc.st === ST && s.location_precision !== "address" && !/home studio|private residence|my home|by appointment only/i.test(s.access?.quote || "")) {
        const st = j.loc.street; s.location_precision = "address"; s.address = `${st.street}, ${st.town}, ${ST}${st.zip ? " " + st.zip : ""}`; s.city = st.town; s.region = st.town; s.geocode = null; delete s.lat; delete s.lng; s.location_note = "Exact address from their page.";
      } else if (j.loc && j.loc.st === ST && j.loc.town && j.loc.town !== s.city) { s.city = j.loc.town; s.region = j.loc.town; s.geocode = `${j.loc.town}, ${stateName(ST)}`; delete s.lat; delete s.lng; s.location_note = "Shown at the town."; }
      const stated = (s.verify?.state || "").toUpperCase() === ST || (s.verify?.state || "").toLowerCase() === stateName(ST).toLowerCase();
      const solid = s.verify?.verdict === "yes" && Object.keys(s.verify?.types || {}).length && ((j.loc && j.loc.st === ST) || (!j.loc && stated));
      s.weak = !solid;
    }
    fs.writeFileSync(fp, JSON.stringify(cur, null, 2) + "\n");
  }
  for (const m of rehome) {
    const fp = path.join(KM, "sources", `${m.to}.json`); const dst = JSON.parse(fs.readFileSync(fp, "utf8"));
    if (dst.sources.some((x) => host(x.contact?.website) === host(m.s.contact?.website))) continue;
    const id = dst.sources.some((x) => x.id === m.s.id) ? `${m.s.id}-${m.to.toLowerCase()}` : m.s.id;
    Object.assign(m.s, { id, region: m.s.located.town || stateName(m.to), city: m.s.located.town || null, geocode: m.s.located.town ? `${m.s.located.town}, ${stateName(m.to)}` : null, location_note: "Shown at the town." });
    delete m.s.lat; delete m.s.lng; m.s.weak = true;
    dst.sources.push(m.s); fs.writeFileSync(fp, JSON.stringify(dst, null, 2) + "\n");
  }
}
log("locate: done");
