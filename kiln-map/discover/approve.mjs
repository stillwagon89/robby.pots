// Approves solid pending places in a state, except the numbers (from REVIEW-SOLID.md order) you reject.
//   node kiln-map/discover/approve.mjs MA [--reject 3,7]     Approved places get review: "approved" and appear on the public map after merge to main.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ST = (process.argv[2] || "").toUpperCase();
const rej = new Set(((process.argv.indexOf("--reject") > 0 && process.argv[process.argv.indexOf("--reject") + 1]) || "").split(",").filter(Boolean).map(Number));
const fp = path.join(KM, "sources", `${ST}.json`);
const doc = JSON.parse(fs.readFileSync(fp, "utf8"));
let i = 0, ok = 0;
for (const s of [...doc.sources]) if (s.review === "pending" && !s.weak && s.verify) {
  i++;
  if (rej.has(i)) { doc.sources = doc.sources.filter((x) => x !== s); (doc._removed ||= []).push({ id: s.id, why: `Rejected by Robby on review. (${new Date().toISOString().slice(0, 10)})` }); }
  else { s.review = "approved"; s.approved = new Date().toISOString().slice(0, 10); ok++; }
}
fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + "\n");
console.log(`${ST}: approved ${ok}, rejected ${rej.size}`);
