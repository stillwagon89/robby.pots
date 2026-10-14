// Applies Robby's standing listing rules (WORKFLOW.md > "Listing rules") to every pending item, so he only reviews real judgement calls.
//   node kiln-map/triage.mjs [--apply]
// Outcomes: reject (past / names no firing type), approve (rules satisfied, place already public), or stay pending ("look").
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./discover/gate.mjs";
import { FIRING_WORDS } from "./firing-words.mjs";

const KM = path.dirname(fileURLToPath(import.meta.url));
const APPLY = process.argv.includes("--apply");
const today = new Date().toISOString().slice(0, 10);
const NON_ELECTRIC = ["wood", "soda", "salt", "raku", "pit_barrel_saggar", "gas_reduction"];

const publicIds = new Set();
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f)))
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources)
    if ((!s.review || s.review === "approved") && !s.weak && !s.flag_hold) publicIds.add(s.id);

const FULL = /already full|sold.?out|fully booked|no (spots|spaces|openings) (left|remaining)|\bfull\b(?! (day|load|kiln|time|service))/i;
const RECURRING = /(first|second|third|fourth|last|1st|2nd|3rd|4th)\s+(mon|tues|wednes|thurs|fri|satur|sun)day/i;
const stats = { approve: 0, reject_past: 0, reject_no_type: 0, look: 0, marked_full: 0, retyped: 0 };
const reasons = new Map();
const look = (e, why) => { stats.look++; reasons.set(why, (reasons.get(why) || 0) + 1); e._look = why; };
const outcomes = [];

for (const f of fs.readdirSync(path.join(KM, "data/pending")).filter((f) => f.endsWith(".json"))) {
  const fp = path.join(KM, "data/pending", f);
  const e = JSON.parse(fs.readFileSync(fp, "utf8"));
  const text = [e.title, e.source_quote, e.evidence_quote, e.evidence_sentence, e.summary, ...(e.includes || [])].filter(Boolean).join(" ");
  // Strict match (gate.mjs) decides approvals; the looser word list only decides whether anything firing-related is named at all.
  const strict = Object.keys(TYPE_RE).filter((t) => NON_ELECTRIC.includes(t) && TYPE_RE[t].test(text));
  const types = strict.length ? strict : NON_ELECTRIC.filter((t) => FIRING_WORDS[t].test(text));
  let verdict;

  // Rule: a firing in the past is not listed (a one-day or dateless-end session that started before today is past too).
  if (e.end_date ? e.end_date < today : e.start_date && e.start_date < today && ["dated", "class_enrollment"].includes(e.access_kind)) verdict = ["reject", "Already past."];
  // (online-only items are rejected in the next rule)
  // Rule: selling kilns/equipment is not a firing.
  else if (/\bonline\b/i.test(e.title) && !/in.person|on.site/i.test(e.title)) verdict = ["reject", "Online-only; no firing you can join."];
  else if (/kiln sales|kilns? for sale|buy (a |your )?kiln|equipment sales/i.test(`${e.title} ${e.summary || ""}`) && !/fir(e|ing) (service|party|workshop)/i.test(e.title)) verdict = ["reject", "Sells kilns or equipment; not a firing you can join."];
  // Rule: if no firing type is named anywhere, drop it.
  else if (!types.length) verdict = ["reject", "No firing type (raku, wood, soda, salt, pit/saggar, gas) named anywhere in the title, quote or description."];
  else {
    // Rule: a type shown in a "firing service" or class is the real firing type, not "rental_service".
    if (!NON_ELECTRIC.includes(e.firing_type) || !types.includes(e.firing_type)) { if (e.firing_type === "rental_service") e.access_kind = e.access_kind === "dated" ? "dated" : "rental_service"; e.firing_type = types[0]; stats.retyped++; }
    // Rule: full / sold-out firings are still listed, with the "full" status.
    if (FULL.test(`${e.source_quote} ${e.evidence_quote} ${e.summary || ""}`) && !/waitlist/i.test(text) && e.registration_status !== "sold_out") { e.registration_status = "sold_out"; stats.marked_full++; }
    // Rule: "3rd Monday monthly"-style schedules are exact dates (recurs) when they carry no calendar date.
    const m = !e.start_date && RECURRING.exec(`${e.title} ${e.source_quote} ${e.evidence_quote} ${e.commitment || ""}`);
    const pub = publicIds.has(e.source_id);
    const typeInTitleOrQuote = NON_ELECTRIC.some((t) => TYPE_RE[t].test(`${e.title} ${e.source_quote}`) || /wood.?(salt|soda)|salt.?soda/i.test(e.title));
    // Rule: the quote check is only a warning. If the title/quote names the type and the source quote is on the page, it's fine.
    const ok = typeInTitleOrQuote && e.quote_verified !== false && (e.confidence || 0) >= 0.75;
    if (!pub) look(e, "place not yet approved");
    else if (!ok) look(e, "type or quote not clearly on the page");
    else if (e.access_kind === "dated" && !e.start_date && !m) look(e, "dated listing with no date");
    else if (e.access_kind === "dated" && e.date_precision !== "exact" && !m) look(e, "date is only a month or season");
    else if (e.year_on_page === false) look(e, "year not written on the page");
    else {
      if (m) { const N = { first: 1, "1st": 1, second: 2, "2nd": 2, third: 3, "3rd": 3, fourth: 4, "4th": 4, last: -1 }; const W = ["mon", "tues", "wednes", "thurs", "fri", "satur", "sun"]; e.recurs = { nth: N[m[1].toLowerCase()], weekday: W.indexOf(m[2].toLowerCase()) + 1, months: 4 }; }
      // Rule: undated residencies, and undated members-only / invitation-only / residents-only offers, are a location only (no firing card).
      if (!e.start_date && !m && (e.access_kind === "residency" || ["members_only", "invitation_only", "residents_only"].includes(e.audience))) e.location_only = true;
      verdict = ["approve", ""];
    }
  }
  if (!verdict) { outcomes.push({ f, why: e._look, e }); if (APPLY && (e.registration_status || e.firing_type)) { delete e._look; fs.writeFileSync(fp, JSON.stringify(e, null, 2) + "\n"); } continue; }
  if (verdict[0] === "reject") { stats[verdict[1].startsWith("Already") ? "reject_past" : "reject_no_type"]++; }
  else stats.approve++;
  if (APPLY) {
    delete e._look;
    if (verdict[0] === "approve") { e.reviewed = today; e.auto_approved = today; e.approved_by_rules = "WORKFLOW.md listing rules"; fs.writeFileSync(path.join(KM, "data/approved", f), JSON.stringify(e, null, 2) + "\n"); }
    else { fs.mkdirSync(path.join(KM, "data/rejected"), { recursive: true }); e.rejected_why = verdict[1]; e.rejected_by_rules = today; fs.writeFileSync(path.join(KM, "data/rejected", f), JSON.stringify(e, null, 2) + "\n"); }
    fs.unlinkSync(fp);
  }
}
console.log(stats);
console.log([...reasons].sort((a, b) => b[1] - a[1]).map(([k, v]) => `  ${v}  ${k}`).join("\n"));
