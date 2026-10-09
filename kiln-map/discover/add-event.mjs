// Writes a hand-checked upcoming listing into kiln-map/data/approved/ (for sites that block the crawler).
//   import { addEvent } from "./add-event.mjs"
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
export function addEvent(e) {
  const item = { access_kind: "dated", date_precision: "exact", registration_status: "open", crew_needed: false, confidence: 1, past: false, quote_verified: true, audience: "public", checked: new Date().toISOString().slice(0, 10), reviewed: new Date().toISOString().slice(0, 10), ...e };
  item.end_date ||= item.start_date;
  item.id = createHash("sha1").update(`${norm(item.title)}|${norm(item.host_org)}|${item.start_date.slice(0, 7)}`).digest("hex").slice(0, 12);
  fs.writeFileSync(path.join(KM, "data/approved", `${item.id}.json`), JSON.stringify(item, null, 2) + "\n");
  return item.id;
}
