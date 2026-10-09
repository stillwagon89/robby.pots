// Applies Robby's rulings to every non-confirmed place at once:
//  1. yes/yes "splits" (both models said yes, they only quoted different evidence) become solid;
//  2. each place gets an access status from its evidence dates and words:
//     upcoming (a future dated event: needs event details), coming_soon, annual, ongoing (classes/membership/invite), past_only (only events already over).
//   node kiln-map/discover/classify.mjs [--apply]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stateName } from "../sources.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");
const today = new Date();
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function dates(t) {
  const out = [];
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:\s*[-–&]\s*\d{1,2})?(?:st|nd|rd|th)?,?\s+(20\d\d)/gi)) out.push(new Date(+m[3], MON[m[1].toLowerCase()], +m[2]));
  for (const m of t.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(20\d\d)\b/gi)) out.push(new Date(+m[2], MON[m[1].toLowerCase()], 28));
  return out;
}
const ONGOING = /member|open studio|monthly|weekly|every (week|month|sat|sun|fri)|classes|class schedule|enroll|rent|firing service|by appointment|invite|email us|contact us|sign up for/i;
const tally = {}; let upgraded = 0; const upcoming = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2);
  const fp = path.join(KM, "sources", f); const doc = JSON.parse(fs.readFileSync(fp, "utf8"));
  const pf = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  const places = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : {};
  for (const s of doc.sources) {
    if (!s.discovered || s.confirmed_by_robby || s.review === "approved") continue;
    // 1. yes/yes splits -> solid when the state is confirmed
    const stated = (s.verify?.state || "").toUpperCase() === ST || (s.verify?.state || "").toLowerCase() === stateName(ST).toLowerCase();
    if (s.weak && s.agree?.result === "split" && s.agree.verdict === "yes" && s.verify?.verdict === "yes" && Object.keys(s.verify.types || {}).length && ((s.located?.state === ST) || stated)) { delete s.weak; s.agree.result = "agree-yes (both said yes)"; upgraded++; }
    // 2. status
    const p = places[s.discovered?.key];
    const text = [s.access?.quote, ...Object.values(s.verify?.types || {}), ...Object.values(p?.pages || {})].filter(Boolean).join(" ");
    const ds = dates(text), fut = ds.filter((d) => d >= today).length, past = ds.filter((d) => d < today).length;
    let status = /coming soon/i.test(text) ? "coming_soon" : fut ? "upcoming" : /annual/i.test(text) && !ONGOING.test(s.access?.quote || "") ? "annual" : ONGOING.test(text) ? "ongoing" : past ? "past_only" : "ongoing";
    if (past && !fut && !ONGOING.test((s.access?.quote || "") + " " + Object.values(s.verify?.types || {}).join(" "))) status = /coming soon/i.test(text) ? "coming_soon" : "past_only";
    tally[status] = (tally[status] || 0) + 1;
    if (APPLY) { s.access = { ...(s.access || {}), status }; }
    if (status === "upcoming") upcoming.push(`${ST}:${s.id}`);
  }
  if (APPLY) fs.writeFileSync(fp, JSON.stringify(doc, null, 2) + "\n");
}
console.log({ upgraded, ...tally });
fs.writeFileSync(path.join(KM, "research/cache/upcoming-candidates.txt"), upcoming.join("\n"));
