// Finds places outside the US from OpenStreetMap (ODbL) and keeps those whose OWN website names a non-electric firing.
// Free, no AI: candidates come from OSM craft=pottery/ceramics and shop=ceramics nodes with a website; a place is kept only if its
// site text matches a firing word in TERMS (any language). Results go to kiln-map/sources/intl/<CC>.json as "limited evidence"
// places (location only, no firing cards, "check with them first") until the studio or a visitor confirms them.
//   node kiln-map/global/seed-osm.mjs [--countries GB,CA] [--limit 60]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COUNTRIES, tzFor } from "../sources.mjs";
import { get } from "../structured/fetch.mjs";
import { TERMS, typesIn, quoteFor } from "./terms.mjs";

const KM = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const arg = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const countries = (arg("--countries") || Object.keys(COUNTRIES).filter((c) => c !== "US").join(",")).split(",");
const limit = Number(arg("--limit")) || 0;
const today = new Date().toISOString().slice(0, 10);
const UA = "FlamingClayFiringsBot/0.1 (+https://flamingclay.com)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

async function overpass(cc) {
  const q = `[out:json][timeout:90];area["ISO3166-1"="${cc}"]->.a;(nwr["craft"~"^(pottery|ceramics)$"]["website"](area.a);nwr["shop"="ceramics"]["website"](area.a););out center tags;`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch("https://overpass-api.de/api/interpreter", { method: "POST", headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" }, body: "data=" + encodeURIComponent(q), signal: AbortSignal.timeout(120000) });
      if (r.ok) return (await r.json()).elements || [];
    } catch { /* retry */ }
    await pause(15000 * (attempt + 1));
  }
  return [];
}
const slug = (t) => String(t).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "place";
const ENT = { amp: "&", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", ndash: "\u2013", mdash: "\u2014", ldquo: "\u201c", rdquo: "\u201d", hellip: "\u2026" };
const decode = (t) => t.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const textOf = (html) => decode(html.replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, "\n")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
const LINKS = /workshop|class|course|firing|brand|kiln|ofen|four|forno|horno|raku|wood|anagama|about|ueber|über|kurs|atelier|cours|corsi|taller|keramik|töpfer|cer[aá]mi|studio|event|news|窯|工房|教室/i;
async function evidence(site) {
  const home = await get(site, { accept: "text/html" }); if (!home.ok) return null;
  const pages = [{ url: home.url || site, text: textOf(home.text) }];
  const base = new URL(home.url || site); const seen = new Set([base.href]);
  for (const m of home.text.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)) {
    if (pages.length >= 5) break;
    let u; try { u = new URL(m[1], base); } catch { continue; }
    if (u.origin !== base.origin || seen.has(u.href) || /\.(pdf|jpe?g|png|gif|zip)$/i.test(u.pathname)) continue;
    if (!LINKS.test(m[1] + " " + m[2].replace(/<[^>]+>/g, ""))) continue;
    seen.add(u.href); const p = await get(u.href, { accept: "text/html" }); if (p.ok) pages.push({ url: u.href, text: textOf(p.text) });
  }
  for (const pg of pages) { const types = typesIn(pg.text); for (const t of types) { const q = quoteFor(t, pg.text); if (q) return { type: t, types, quote: q, url: pg.url }; } }
  return null;
}

mkdirSync(join(KM, "sources", "intl"), { recursive: true });
let total = 0;
for (const cc of countries) {
  if (!COUNTRIES[cc] || cc === "US") continue;
  const els = await overpass(cc); await pause(5000);
  const byHost = new Map();
  for (const e of els) {
    const t = e.tags || {}; const lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon; if (!t.name || !t.website || lat == null) continue;
    let host; try { host = new URL(/^https?:/i.test(t.website) ? t.website : "https://" + t.website).host.replace(/^www\./, ""); } catch { continue; }
    if (/facebook|instagram|etsy|google|linktr/i.test(host)) continue;
    if (!byHost.has(host)) byHost.set(host, { ...e, lat, lng });
  }
  let cands = [...byHost.values()]; if (limit) cands = cands.slice(0, limit);
  const file = join(KM, "sources", "intl", `${cc}.json`);
  const doc = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : { _note: `Places in ${COUNTRIES[cc].name} from OpenStreetMap (ODbL) whose own site names a non-electric firing. Seeded by kiln-map/global/seed-osm.mjs.`, sources: [] };
  const have = new Set(doc.sources.map((s) => s.id)); const haveUrls = new Set(doc.sources.map((s) => (s.urls || [])[0]));
  let added = 0, i = 0;
  async function worker() {
    while (i < cands.length) {
      const e = cands[i++]; const t = e.tags; const site = /^https?:/i.test(t.website) ? t.website : "https://" + t.website;
      if (haveUrls.has(site)) continue;
      const id = `${cc.toLowerCase()}-${slug(t.name)}`; if (have.has(id)) continue;
      let ev; try { ev = await evidence(site); } catch { ev = null; }
      if (!ev) continue;
      const addr = t["addr:street"] && t["addr:housenumber"] ? `${t["addr:street"]} ${t["addr:housenumber"]}, ${t["addr:postcode"] || ""} ${t["addr:city"] || ""}`.replace(/\s+/g, " ").trim() : null;
      have.add(id);
      doc.sources.push({
        id, org: t.name, kind: "studio", core: false, public: true, firing_types_guess: ev.types, region: t["addr:state"] || t["addr:city"] || COUNTRIES[cc].name, city: t["addr:city"] || null,
        urls: [site], notes: "From OpenStreetMap; its own site names this firing type. Not yet confirmed that outsiders can join.", location_precision: addr ? "address" : "approximate", address: addr || undefined,
        lat: Math.round(e.lat * 1e5) / 1e5, lng: Math.round(e.lng * 1e5) / 1e5, location_note: addr ? undefined : "Shown at the town.",
        contact: { website: site, ...(t.email || t["contact:email"] ? { email: t.email || t["contact:email"] } : {}) },
        access: { how: "See site", note: "See site", quote: ev.quote, url: ev.url, types: [ev.type], checked: today, status: null },
        review: "pending", weak: true, verify: { by: "osm+site-text", date: today, verdict: "unclear", why: "Site text names the firing type; whether outsiders can join is not confirmed." },
        discovered: { by: "osm-global", date: today, licence: "OpenStreetMap contributors, ODbL" },
      });
      added++;
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker));
  if (added) writeFileSync(file, JSON.stringify(doc, null, 2) + "\n");
  total += added;
  console.log(`${cc}: ${els.length} OSM places, ${cands.length} unique sites checked, ${added} new places whose site names a firing`);
}
console.log(`total new: ${total}`);
