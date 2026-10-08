// Writes kiln-map/REVIEW-SOLID.md: solid (not weak) pending places by state, each with its quote and a direct link to the firing page.
//   node kiln-map/discover/review-packet.mjs [ST ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const only = process.argv.slice(2).map((s) => s.toUpperCase());
let out = "# Solid places to review\n\nEach place passed the keyword check, the Claude check with a quoted sentence, and the address check. Reply per state with the numbers to REJECT; everything else gets approved.\n";
let total = 0;
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); if (only.length && !only.includes(ST)) continue;
  const rows = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources.filter((s) => s.review === "pending" && !s.weak && s.verify);
  if (!rows.length) continue;
  out += `\n## ${ST} (${rows.length})\n`;
  rows.forEach((s, i) => {
    const t = Object.entries(s.verify.types || {});
    out += `\n${i + 1}. **${s.org}**${s.city ? `, ${s.city}` : ""} — ${t.map(([k]) => k.replace("_", "/")).join(", ")}\n   "${(t[0]?.[1] || s.access?.quote || "").slice(0, 200)}"\n   ${s.access?.url || s.contact?.website}\n`;
  });
  total += rows.length;
}
fs.writeFileSync(path.join(KM, "REVIEW-SOLID.md"), out.replace("# Solid places to review", `# Solid places to review (${total})`));
console.log(`${total} solid places`);
