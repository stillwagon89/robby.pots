// Writes kiln-map/PENDING-REVIEW.md: every pending place by state, with the verified quote and a weak flag.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const by = {}; let n = 0, weak = 0;
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f)))
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) if (s.review === "pending") { (by[f.slice(0, 2)] ||= []).push(s); n++; if (s.weak) weak++; }
let out = `# Places pending review (${n}; ${weak} flagged weak)\n\nGenerated ${new Date().toISOString().slice(0, 10)}. "Weak" = the second check was unsure or could not quote a firing type. Reply with names to reject.\n`;
for (const [st, a] of Object.entries(by).sort()) {
  out += `\n## ${st} (${a.length})\n\n| Place | Town | Firing (quoted) | Check | Site |\n|---|---|---|---|---|\n`;
  for (const s of a) out += `| ${s.org} | ${s.city || "?"} | ${(s.firing_types_guess || []).join(", ") || "-"} | ${s.weak ? "WEAK" : s.verify ? "verified" : "first pass only"} | ${(s.contact?.website || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")} |\n`;
}
fs.writeFileSync(path.join(KM, "PENDING-REVIEW.md"), out);
console.log(`${n} pending, ${weak} weak`);
