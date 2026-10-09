// Directory mining (free): find a state's potters guilds, ceramics associations, studio trails and craft schools, read their member/
// studio lists, and add every outbound studio website as a seed (q: "dir:<host>").  node kiln-map/discover/dir-seed.mjs ST ...
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const KM = path.resolve(HERE, "..");
const STATES = JSON.parse(fs.readFileSync(path.join(HERE, "states.json"), "utf8"));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SKIP = /(^|\.)(facebook|instagram|youtube|pinterest|twitter|x|linkedin|yelp|tiktok|google|goo\.gl|wikipedia|amazon|etsy|eventbrite|wixsite|squarespace|weebly|mailchimp|paypal|shopify|apple|bing|gmail|constantcontact|vimeo|flickr|tripadvisor|mapquest|patch|reddit|wordpress|blogspot|medium)\.(com|org|net)$/;
const HINT = /pottery|potter|clay|ceramic|kiln|studio|fire|earth|mud|glaze|raku|wheel|stoneware|porcelain|arts|craft|guild|center|school/i;
const BOT = "FlamingClayFiringsBot";
const lastHit = new Map(), robots = new Map();
async function allowed(u) {
  const o = new URL(u).origin;
  if (!robots.has(o)) { let ok = true; try { const r = await fetch(`${o}/robots.txt`, { signal: AbortSignal.timeout(8000) }); if (r.ok) ok = !/user-agent:\s*\*\s*\n(?:[^\n]*\n)*?\s*disallow:\s*\/\s*(\n|$)/i.test(await r.text()); } catch {} robots.set(o, ok); }
  return robots.get(o);
}
async function get(u) {
  try {
    if (!(await allowed(u))) return "";
    const h = new URL(u).host; const w = (lastHit.get(h) || 0) + 1500 - Date.now(); lastHit.set(h, Date.now() + Math.max(w, 0)); if (w > 0) await new Promise((r) => setTimeout(r, w));
    const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": `Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36 ${BOT}/0.1 (+https://flamingclay.com)`, Accept: "text/html" } });
    return r.ok ? await r.text() : "";
  } catch { return ""; }
}
function search(q) {
  try { const d = JSON.parse(execFileSync(path.join(HERE, ".venv/bin/python"), [path.join(HERE, "ddg_search.py"), q], { encoding: "utf8", timeout: 120000 })); return Array.isArray(d) ? d : []; } catch { return []; }
}
for (const ST of process.argv.slice(2).map((s) => s.toUpperCase())) {
  const S = STATES[ST]?.name; if (!S) continue;
  const qs = [`${S} potters guild member studios list`, `${S} ceramics association studio directory`, `${S} pottery trail studio tour participating studios`, `${S} clay arts guild members`, `${S} community clay center ceramics studios list`, `${S} craft school ceramics kiln open to public`, `${S} wood fire kiln potters directory`, `${S} potters council members`, `list of pottery studios in ${S}`];
  const dirs = new Map();
  for (const q of qs) { for (const r of search(q)) if (!SKIP.test(host(r.url)) && !dirs.has(host(r.url))) dirs.set(host(r.url), r.url); await new Promise((r) => setTimeout(r, 2500 + Math.random() * 2000)); }
  const f = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const places = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {};
  let added = 0, pages = 0;
  for (const [dh, du] of [...dirs].slice(0, 14)) {
    let html = await get(du); if (!html) continue; pages++;
    const links = [...html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)].map((m) => { try { return { u: new URL(m[1], du).href, t: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }; } catch { return null; } }).filter(Boolean);
    // one hop into member/studio list pages on the same site
    for (const l of links.filter((l) => host(l.u) === dh && /member|studio|directory|artist|potter|find|list|trail|tour|partner/i.test(l.u + " " + l.t)).slice(0, 3)) html += " " + (await get(l.u)), pages++;
    const all = [...html.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"'#]+)["'][^>]*>([\s\S]{0,120}?)<\/a>/gi)].map((m) => ({ u: m[1], t: m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
    for (const l of all) {
      const k = host(l.u); if (!k || k === dh || SKIP.test(k) || !(HINT.test(k) || HINT.test(l.t))) continue;
      const p = (places[k] ||= { key: k, social: false, known: null, hits: [], pages: {} });
      if (!p.hits.some((h) => h.q === `dir:${dh}`)) { p.hits.push({ q: `dir:${dh}`, url: new URL(l.u).origin + "/", title: l.t || k, snippet: `Listed on ${dh}: ${l.t}` }); p.osm ||= { name: l.t || k, city: "", state: "" }; delete p.fetched; added++; }
    }
  }
  fs.writeFileSync(f, JSON.stringify(places, null, 2));
  console.log(`${ST}: ${dirs.size} directory pages found, ${pages} read, ${added} new studio seeds`);
}
