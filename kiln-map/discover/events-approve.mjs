// Approves pending upcoming events that really are non-electric firings (a firing word in the event's own title or quote),
// whose place is public, with a verified quote and a future date. Everything else stays pending or goes to rejected (not about a firing).
//   node kiln-map/discover/events-approve.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const today = new Date().toISOString().slice(0, 10);
const publicIds = new Set();
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f)))
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) if ((!s.review || s.review === "approved") && !s.flag_hold) publicIds.add(s.id);
const stats = { approved: 0, notAFiring: 0, placeNotPublic: 0, other: 0 };
for (const f of fs.readdirSync(path.join(KM, "data/pending"))) {
  const fp = path.join(KM, "data/pending", f); const e = JSON.parse(fs.readFileSync(fp, "utf8"));
  const text = `${e.title} ${e.source_quote} ${e.evidence_quote || ""}`;
  const types = Object.keys(TYPE_RE).filter((t) => TYPE_RE[t].test(text));
  if (!types.length) { stats.notAFiring++; if (APPLY && e.found_by === "deep-extract") { fs.mkdirSync(path.join(KM, "data/rejected"), { recursive: true }); e.rejected_why = "No firing word in the event's title or quote (not a firing)."; fs.writeFileSync(path.join(KM, "data/rejected", f), JSON.stringify(e, null, 2) + "\n"); fs.unlinkSync(fp); } continue; }
  if (e.past || !e.start_date || e.start_date < today || e.quote_verified === false || (e.confidence || 0) < 0.8) { stats.other++; continue; }
  if (!publicIds.has(e.source_id)) { stats.placeNotPublic++; continue; }
  stats.approved++;
  if (APPLY) { if (!types.includes(e.firing_type)) e.firing_type = types[0]; e.reviewed = today; e.auto_approved = today; fs.writeFileSync(path.join(KM, "data/approved", f), JSON.stringify(e, null, 2) + "\n"); fs.unlinkSync(fp); }
}
console.log(stats);
