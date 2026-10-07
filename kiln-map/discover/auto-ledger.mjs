// Builds research/<st>-ledger.md without a human/Claude read: every non-rejected place whose firing type survives the evidence gate.
// The second-opinion check (verify.mjs --apply) then removes wrong-state, students-only and no-evidence places.
//   node kiln-map/discover/auto-ledger.mjs IL MN ...   then   promote.mjs IL MN   then   verify.mjs --apply IL MN
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gate } from "./gate.mjs";
import { stateName } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const JUNK = /mapquest|findglocal|yelp|patch\.com|magazine|gazette|news|wikipedia|tripadvisor|facebook|roundtable|smilepolitely|kdnk|realwoodstock|in-chicagocity|visit|tourism|chamber|\.gov$|eventbrite\.com\/e\/|ceramicartsnetwork|ceramicsnow|claydirectory|digitalfire|reddit|clayfinder|findapotteryclass|stayhappening|happeningnext|allevents|getrelaxing|activekids|classbento|coursehorse|enrichment\.kids|blogspot|wordpress|sites\.google|myshopify/i;
const ACCESS = { dated_events: "Dated workshop or firing event", by_appointment: "By appointment", ongoing_class_or_membership: "Classes or membership", firing_service_or_rental: "Firing service", none: "See site" };
for (const ST of process.argv.slice(2).map((s) => s.toUpperCase())) {
  const st = ST.toLowerCase();
  const places = JSON.parse(fs.readFileSync(path.join(KM, "research/cache", st, "places.json"), "utf8"));
  const inState = new RegExp(`${stateName(ST)}|,\\s*${ST}\\b|\\b${ST}\\s+\\d{5}`);
  const rows = [];
  // A site already filed under another state (by an earlier run) is skipped: the search returns the same out-of-state pages for many states.
  const otherHosts = new Set();
  for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f) && f !== `${ST}.json`))
    for (const x of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) { try { otherHosts.add(new URL(x.contact?.website || x.urls?.[0]).hostname.replace(/^www\./, "")); } catch {} }
  for (const p of Object.values(places)) {
    const j = p.judged;
    if (!j || p.social || j.decision === "reject" || j.error) continue;
    if (p.known && !p.known.startsWith(`${ST}:`)) continue;
    if (p.known) continue; // already on the map
    if (JUNK.test(p.key) || otherHosts.has(p.key.replace(/^https?:\/\/(www\.)?/, "").split("/")[0])) continue;
    const text = Object.values(p.pages).join(" ") + " " + p.hits.map((h) => h.title + " " + h.snippet).join(" ");
    const g = gate({ ...j, decision: "qualifies" }, text);
    if (!g.supported.length) continue;
    if ((j.state || "").toUpperCase() && (j.state || "").toUpperCase() !== ST && !inState.test(text)) continue;
    const name = (j.name && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(j.name) ? j.name : p.key.replace(/\.(com|org|net|edu|studio|art)$/, "")).replace(/\|/g, "/");
    const dup = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (dup) { dup.sites.push(p.key); dup.types = [...new Set([...dup.types, ...g.supported])]; if (dup.town === "?" && j.city) dup.town = j.city; continue; }
    rows.push({ name, town: j.city || "?", types: g.supported, access: ACCESS[j.access] || "See site", sites: [p.key] });
  }
  const md = `# ${stateName(ST)} firings ledger (${new Date().toISOString().slice(0, 10)}, discovery v3, automatic)\n\nBuilt by auto-ledger.mjs from every non-rejected place with a gate-supported firing type; verify.mjs --apply prunes it.\n\n## Qualifies\n| # | Place | Town | Firing | Access | Site |\n|---|---|---|---|---|---|\n${rows.map((r, i) => `| ${i + 1} | ${r.name} | ${r.town} | ${r.types.join(", ")} | ${r.access} | ${r.sites.join(", ")} |`).join("\n")}\n`;
  fs.writeFileSync(path.join(KM, "research", `${st}-ledger.md`), md);
  console.log(`${ST}: ${rows.length} candidates`);
}
