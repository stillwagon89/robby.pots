// Clears the flag hold on a place or listing after Robby has checked it: node kiln-map/discover/flag-clear.mjs <place-or-listing-id>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const id = process.argv[2]; const now = new Date().toISOString();
let done = 0;
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const fp = path.join(KM, "sources", f); const d = JSON.parse(fs.readFileSync(fp, "utf8")); const s = d.sources.find((x) => x.id === id);
  if (s) { delete s.flag_hold; delete s.needs_recheck; s.flag_cleared = now; fs.writeFileSync(fp, JSON.stringify(d, null, 2) + "\n"); done++; }
}
const ap = path.join(KM, "data/approved", `${id}.json`);
if (fs.existsSync(ap)) { const it = JSON.parse(fs.readFileSync(ap, "utf8")); delete it.flag_hold; delete it.needs_recheck; it.flag_cleared = now; fs.writeFileSync(ap, JSON.stringify(it, null, 2) + "\n"); done++; }
console.log(done ? `cleared ${id}` : `no place or listing with id ${id}`);
