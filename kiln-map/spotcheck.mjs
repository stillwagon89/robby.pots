// Weekly spot-check (Stage 4): picks 5 places from the published feed, preferring ones with upcoming dated listings, and
// writes a short checklist (kiln-map/data/spotcheck.md) for a GitHub issue. Takes Robby about 5 minutes. Free, no AI.
// Each tick is evidence: "correct" or "wrong". The running error rate lives in the issue history.
//   node kiln-map/spotcheck.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const feed = JSON.parse(readFileSync(join(ROOT, "site/data/firings.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
// Deterministic shuffle seeded by the date, so a rerun the same day picks the same places.
const rank = (p) => createHash("sha256").update(today + p.id).digest("hex");
const byRank = (a, b) => rank(a).localeCompare(rank(b));
const withDates = feed.places.filter((p) => p.opportunities.some((o) => o.start_date));
const rest = feed.places.filter((p) => !withDates.includes(p) && p.trust !== "unverified");
const picks = [...withDates.sort(byRank).slice(0, 4), ...rest.sort(byRank).slice(0, 1)];
let md = `Five places picked at random from the live site. For each: open their own website, then tick **correct** if our card matches it, or **wrong** and say what differs in a comment. About five minutes.\n\nIf one is wrong, tell Claude the place name and it gets fixed or held.\n`;
for (const p of picks) {
  const o = p.opportunities.find((x) => x.start_date);
  const web = p.contact?.website || o?.source_url || "";
  md += `\n### ${p.org} (${p.city || p.region}, ${p.state})\n- Trust tier shown: ${p.trust}\n- Their site: ${web || "none listed"}\n- Our card: https://flamingclay.com/firings.html?view=locations&sel=${encodeURIComponent(p.id)}\n`;
  md += o ? `- Claimed listing: "${o.title}" on ${o.start_date}${o.end_date && o.end_date !== o.start_date ? ` to ${o.end_date}` : ""}, status ${o.status || "unknown"}\n` : `- Claimed: ${(p.firing_types || []).join(", ") || "firing types"} are available to the public\n`;
  md += `- [ ] correct\n- [ ] wrong\n`;
}
writeFileSync(join(ROOT, "kiln-map/data/spotcheck.md"), md);
console.log(`Spot-check list written for ${picks.length} places: ${picks.map((p) => p.id).join(", ")}`);
