// Writes kiln-map/REVIEW-STATUS.md: which states Robby has checked off (review-checked.json) and what is left in each.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checked = JSON.parse(fs.readFileSync(path.join(KM, "review-checked.json"), "utf8"));
const rows = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2), src = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources;
  rows.push({ ST, approved: src.filter((s) => !s.review || s.review === "approved").length, solid: src.filter((s) => s.review === "pending" && !s.weak && s.verify).length, weak: src.filter((s) => s.review === "pending" && s.weak).length, held: src.filter((s) => s.hold).length });
}
const done = rows.filter((r) => checked[r.ST]), todo = rows.filter((r) => !checked[r.ST] && r.solid > 0), none = rows.filter((r) => !checked[r.ST] && !r.solid);
let out = `# Review status\n\n${done.length} states checked off, ${todo.length} with solid places still to review, ${none.length} with nothing solid yet.\n\n## Checked off\n`;
out += done.map((r) => `- **${r.ST}** (${checked[r.ST].date}): ${r.approved} public. ${checked[r.ST].note}`).join("\n") || "(none yet)";
out += `\n\n## To review (solid places waiting)\n| State | Solid to review | Already public | Weak (hidden) |\n|---|---|---|---|\n` + todo.map((r) => `| ${r.ST} | ${r.solid} | ${r.approved} | ${r.weak} |`).join("\n");
out += `\n\n## Nothing solid yet (needs tips or more search)\n${none.map((r) => `${r.ST} (${r.weak} weak)`).join(", ")}\n`;
fs.writeFileSync(path.join(KM, "REVIEW-STATUS.md"), out);
console.log(`${done.length} done, ${todo.length} to review, ${none.length} empty`);
