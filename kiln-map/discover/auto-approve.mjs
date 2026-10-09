// Marks as approved the solid places that are appropriate to publish without Robby's line-by-line review:
// verified by Claude with a quoted sentence, state confirmed by the page, a way for outsiders to take part, not a college, no hold.
// They are tagged auto_approved so they can be told apart from places Robby confirmed.   node kiln-map/discover/auto-approve.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateName } from "../sources.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const PART = /class|workshop|register|sign up|signup|membership|member|rent|book|appointment|contact|email|invite|enroll|open studio|firing service|fire your|bring|join|participate|fire/i;
const squash = (t) => (t || "").toLowerCase().replace(/[^a-z0-9]/g, "");
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
// A listing page on someone else's site (aggregator, foundation page, event host) gets the wrong name or place: the org name must show up in the site's own address.
function nameMatchesHost(org, host) {
  const h = squash(host), words = (org || "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !/^(the|studio|studios|center|centre|arts?|school|guild|clay|pottery|ceramics?|workshop|company|association|college|university)$/.test(w));
  const o = squash(org);
  return (words.length ? words.some((w) => h.includes(w)) : false) || (o.length >= 6 && (h.includes(o.slice(0, 8)) || o.includes(h.split(".")[0].slice(0, 8)))) || (words.length === 0 && h.includes(squash(org).slice(0, 5)));
}
let n = 0, skipped = {};
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); const fp = path.join(KM, "sources", f); const doc = JSON.parse(fs.readFileSync(fp, "utf8"));
  for (const s of doc.sources) {
    if (APPLY && s.auto_approved && !s.confirmed_by_robby) { s.review = "pending"; delete s.auto_approved; }
    if (s.review !== "pending" || s.weak || !s.verify || s.hold) continue;
    const q = Object.values(s.verify.types || {}).join(" ");
    const stated = (s.verify.state || "").toUpperCase() === ST || (s.verify.state || "").toLowerCase() === stateName(ST).toLowerCase() || s.located?.state === ST;
    const why = s.verify.verdict !== "yes" ? "not yes" : !Object.keys(s.verify.types || {}).length ? "no type" : !stated ? "state" : s.kind === "college" ? "college" : !nameMatchesHost(s.org, hostOf(s.contact?.website)) ? "name not on its own site" : !(PART.test(q) || s.agree?.result?.startsWith("agree-yes")) ? "mention only" : null;
    if (why) { skipped[why] = (skipped[why] || 0) + 1; continue; }
    n++;
    if (APPLY) { s.review = "approved"; s.auto_approved = new Date().toISOString().slice(0, 10); if (s.access?.status === "past_only" && !s.access.note) s.access.note = "Has hosted firings here before. Check with them for the next one."; }
  }
  if (APPLY) fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + "\n");
}
console.log({ wouldApprove: n, skipped });
