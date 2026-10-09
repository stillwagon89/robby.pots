// Turns visitor flags (data/flags.json, from `npm run kiln:flags`) into decisions about each place or listing.
//   1 visitor            -> needs_recheck (goes to the top of the review list, and I re-verify it)
//   3+ different visitors, or 2+ with a serious reason (closed, wrong date/address, not open...) -> flag_hold: the PUBLIC build leaves it out
//                           until Robby clears it (node kiln-map/discover/flag-clear.mjs <id>)
// A flag alone never removes anything. Flags from before an item's flag_cleared date are ignored.   node kiln-map/discover/flag-triage.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const flags = fs.existsSync(path.join(KM, "data/flags.json")) ? JSON.parse(fs.readFileSync(path.join(KM, "data/flags.json"), "utf8")) : [];
const SERIOUS = /closed|cancel|no longer|doesn.?t exist|does not exist|out of business|not open|wrong (date|address|place|location|state)|moved|fake|scam|sold out|private|members only/i;
const group = new Map();
for (const f of flags) { const k = f.listing_id ? `L:${f.listing_id}` : `P:${f.place_id}`; if (!group.has(k)) group.set(k, []); group.get(k).push(f); }
function verdict(fl, cleared) {
  const live = fl.filter((f) => !cleared || f.at > cleared);
  const who = new Set(live.map((f) => f.who || f.at + f.ua));
  const reasons = live.map((f) => f.reason).filter(Boolean);
  const serious = new Set(live.filter((f) => f.reason && SERIOUS.test(f.reason)).map((f) => f.who || f.at)).size;
  if (!live.length) return null;
  return { n: live.length, visitors: who.size, last: live.map((f) => f.at).sort().pop(), reasons: reasons.slice(-5), hold: who.size >= 3 || (who.size >= 2 && serious >= 1) };
}
let rechecks = 0, holds = 0;
// places
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const fp = path.join(KM, "sources", f); const doc = JSON.parse(fs.readFileSync(fp, "utf8")); let ch = false;
  for (const s of doc.sources) {
    const v = verdict(group.get(`P:${s.id}`) || [], s.flag_cleared);
    if (!v) { if (s.needs_recheck || s.flag_hold) { delete s.needs_recheck; delete s.flag_hold; delete s.flags; ch = true; } continue; }
    s.flags = v; s.needs_recheck = true; if (v.hold) s.flag_hold = true; else delete s.flag_hold; ch = true; rechecks++; holds += v.hold ? 1 : 0;
  }
  if (ch) fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + "\n");
}
// listings (approved events)
const ad = path.join(KM, "data/approved");
for (const f of fs.readdirSync(ad)) {
  const fp = path.join(ad, f); const it = JSON.parse(fs.readFileSync(fp, "utf8"));
  const v = verdict(group.get(`L:${it.id}`) || [], it.flag_cleared);
  if (!v) { if (it.needs_recheck || it.flag_hold) { delete it.needs_recheck; delete it.flag_hold; delete it.flags; fs.writeFileSync(fp, JSON.stringify(it, null, 2) + "\n"); } continue; }
  it.flags = v; it.needs_recheck = true; if (v.hold) it.flag_hold = true; else delete it.flag_hold; fs.writeFileSync(fp, JSON.stringify(it, null, 2) + "\n"); rechecks++; holds += v.hold ? 1 : 0;
}
console.log(`${flags.length} flags: ${rechecks} places/listings to re-check, ${holds} held out of the public build`);
