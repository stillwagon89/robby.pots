// Turns the "Qualifies" table of research/<st>-ledger.md into map sources in sources/<ST>.json.
// Evidence (quote, page) comes from the discovery cache. Rows marked "(on map)" and hosts already listed are skipped.
// New sources carry review: "pending" until Robby approves them.
//   node kiln-map/discover/promote.mjs FL TX ...   then   npm run kiln:geocode && npm run kiln:build
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateName } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TODAY = new Date().toISOString().slice(0, 10);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const slug = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
const TYPE_WORDS = [[/raku|horsehair|obvara/i, "raku"], [/wood|anagama|manabigama/i, "wood"], [/soda/i, "soda"], [/salt/i, "salt"], [/pit|barrel|saggar|smoke|primitive/i, "pit_barrel_saggar"], [/gas|reduction|cone 10/i, "gas_reduction"]];

const allIds = new Set();
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f)))
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) allIds.add(s.id);

for (const ST of process.argv.slice(2).map((s) => s.toUpperCase())) {
  const st = ST.toLowerCase();
  const lf = ["discovery-ledger", "ledger"].map((n) => path.join(KM, "research", `${st}-${n}.md`)).find((p) => fs.existsSync(p) && /^## Qualifies/m.test(fs.readFileSync(p, "utf8")));
  const ledger = fs.readFileSync(lf, "utf8");
  const places = JSON.parse(fs.readFileSync(path.join(KM, "research/cache", st, "places.json"), "utf8"));
  const srcFile = path.join(KM, "sources", `${ST}.json`);
  const doc = fs.existsSync(srcFile) ? JSON.parse(fs.readFileSync(srcFile, "utf8")) : { _note: `${ST} firing sources.`, sources: [] };
  const haveHosts = new Set(doc.sources.flatMap((s) => [...(s.urls || []), s.contact?.website].filter(Boolean).map(host)));
  const section = ledger.split(/^## Qualifies.*$/m)[1]?.split(/^## /m)[0] || "";
  let added = 0, skipped = [];
  for (const line of section.split("\n").filter((l) => /^\|\s*\d+/.test(l))) {
    const [, , placeRaw, town, firing, access, siteCol] = line.split("|").map((c) => c.trim());
    if (/\(on map\)/i.test(placeRaw)) continue;
    const org = placeRaw.replace(/\*\*/g, "").trim();
    const sites = siteCol.replace(/\*\*/g, "").split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    // Find the cached place for the first site that matches; prefer one with a verified quote.
    const cands = sites.flatMap((s) => Object.values(places).filter((p) => p.key === s || p.key.includes(s) || s.includes(p.key)));
    const p = cands.find((c) => c.judged?.quote_verified) || cands[0];
    if (!p) { skipped.push(`${org} (no cached page for ${siteCol})`); continue; }
    const firstUrl = p.hits[0]?.url || `https://${p.key}/`;
    const isCatalog = p.key.startsWith("http");
    const website = isCatalog ? firstUrl : `https://${host(firstUrl) ? new URL(firstUrl).host : p.key}/`;
    if (haveHosts.has(host(website)) && !isCatalog) { skipped.push(`${org} (already listed)`); continue; }
    const quote = p.judged?.quote_verified ? p.judged.quote.replace(/\s+/g, " ").trim() : null;
    const quoteUrl = quote && (Object.entries(p.pages).find(([, t]) => norm(t).includes(norm(quote)))?.[0] || firstUrl);
    const guess = [...new Set(TYPE_WORDS.filter(([re]) => re.test(firing)).map(([, t]) => t))];
    let id = slug(org);
    if (allIds.has(id)) id = `${id}-${st}`;
    allIds.add(id);
    const townOk = town && !/^\(|^\?|^[A-Z]{2}$|area|coast|^southern|wilds/i.test(town);
    const kind = /college|university|uwf|utsa|cc\b/i.test(org) ? "college" : /guild|center|centre|museum|school|city of|arts|association|society|institute|league|co-?op|collective|club/i.test(org) ? "city_arts" : "studio";
    doc.sources.push({
      id, org, kind, core: false, public: true, firing_types_guess: guess.length ? guess : (p.judged?.firing_types || []),
      region: townOk ? town : stateName(ST), city: townOk ? town.split(/\s*[\/(]/)[0] : null,
      urls: [website],
      notes: `${access}. Found by discovery v3 on ${TODAY}; not yet reviewed.`,
      location_precision: "approximate",
      geocode: townOk ? `${town.split(/\s*[\/(]/)[0]}, ${stateName(ST)}` : null,
      location_note: townOk ? "Shown at the town." : "Location not confirmed; shown at the state.",
      contact: { website },
      ...(quote ? { access: { how: access, note: access, quote, url: quoteUrl, types: (p.judged?.firing_types || []).filter((t) => t !== "other"), checked: TODAY } } : {}),
      review: "pending",
      discovered: { by: "discover-v3", date: TODAY, key: p.key },
    });
    haveHosts.add(host(website));
    added++;
  }
  fs.writeFileSync(srcFile, JSON.stringify(doc, null, 2) + "\n");
  console.log(`${ST}: added ${added}${skipped.length ? `; skipped ${skipped.length}: ${skipped.join("; ")}` : ""}`);
}
