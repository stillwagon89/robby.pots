// Writes kiln-map/REVIEW-SOLID.md: solid (not weak) pending places by state, each with its quote and a direct link to the firing page.
//   node kiln-map/discover/review-packet.mjs [ST ...]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATUS = { upcoming: "Upcoming event", ongoing: "Open now (classes, membership or invitation)", coming_soon: "Workshops coming soon", annual: "Held every year", past_only: "Previously hosted only (no upcoming firing found)" };
const pendDir = path.join(KM, "data/pending");
const pending = fs.existsSync(pendDir) ? fs.readdirSync(pendDir).map((f) => JSON.parse(fs.readFileSync(path.join(pendDir, f), "utf8"))) : [];
const todayStr = new Date().toISOString().slice(0, 10);
const eventsFor = (id) => pending.filter((e) => e.source_id === id && !e.past && (!e.start_date || (e.end_date || e.start_date) >= todayStr));
const only = process.argv.slice(2).map((s) => s.toUpperCase());
const today = new Date();
const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const pastDate = (q) => { for (const m of q.matchAll(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:\s*[-–]\s*\d{1,2})?,?\s+(20\d\d)/gi)) { if (new Date(+m[2], MON[m[1].toLowerCase()], 28) < today) return m[0]; } const y = q.match(/\b(20[0-2]\d)\b/); return y && +y[1] < today.getFullYear() ? y[1] : null; };
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const PARTICIPATE = /class|workshop|register|sign up|signup|membership|member|rent|book|appointment|contact|email|invite|enroll|open studio|firing service|fire your|bring/i;
function concerns(s, quote) {
  const c = [];
  const pd = pastDate(quote); if (pd) c.push(`the example firing in its quote (${pd}) is already over. The place may still be fine, but it should show as a place, not an event`);
  if (!PARTICIPATE.test(quote)) c.push("the quote only mentions the technique; check the page offers a way for outsiders to take part");
  if (s.kind === "college") c.push("it is a college or school; check the firing is open to the public, not only students");
  if (s.location_precision !== "address") c.push("no street address was found on its pages, so the pin is only at the town");
  if (hostOf(s.access?.url) && hostOf(s.access?.url) !== hostOf(s.contact?.website)) c.push(`the evidence page is on a different site (${hostOf(s.access?.url)}) than the place's own site`);
  if (s.agree?.result === "split" && !(s.agree.verdict === "yes" && s.verify?.verdict === "yes")) c.push(`the two AI models did not both say yes (first said ${s.verify?.verdict}, second said ${s.agree.verdict})`);
  if (s.hold) c.push(s.hold);
  if (s.flags) c.unshift(`FLAGGED by ${s.flags.visitors} visitor${s.flags.visitors > 1 ? "s" : ""}${s.flags.hold ? " (held out of the public map until you check it)" : ""}${s.flags.reasons?.length ? `. Reasons given: ${s.flags.reasons.map((r) => `"${r}"`).join("; ")}` : ""}`);
  return c;
}
let out = `# Solid places to review

## What these are and why you are reviewing them
Each entry is a place (studio, guild, school, art center) that an AI search found and that the checks say lets the public take part in a non-electric firing (raku, wood, soda, salt, pit/saggar or gas reduction). If you approve it, it appears on the public Flaming Clay map as a pin with the quoted sentence and a link to the page that describes the firing.
You review because every step so far was automated. A wrong entry sends a potter to a place that cannot help them and puts Flaming Clay's name on it. Your yes is the last gate.
**What the checks already did:** a firing word appears in the quote; Claude read the live page and copied a sentence showing outsiders can take part; the address on the page is in the filed state.
**Under each place** you will see "Why it is here" (the quote and link) and "Look at" (specific reasons to doubt it). No "Look at" line means no known concern. Reply per state: numbers to REJECT, plus any notes; everything else is approved.
`;
let total = 0;
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); if (only.length && !only.includes(ST)) continue;
  const rows = JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources.filter((s) => (s.review === "pending" && !s.weak && s.verify) || s.needs_recheck).sort((a, b) => (b.needs_recheck ? 1 : 0) - (a.needs_recheck ? 1 : 0));
  if (!rows.length) continue;
  out += `\n## ${ST} (${rows.length})\n`;
  rows.forEach((s, i) => {
    const t = Object.entries(s.verify.types || {});
    const q = t[0]?.[1] || s.access?.quote || "";
    const cs = concerns(s, q);
    const evs = eventsFor(s.id);
    out += `\n${i + 1}. **${s.org}**${s.city ? `, ${s.city}` : ""} — ${t.map(([k]) => k.replace("_", "/")).join(", ")}\n   Why it is here: "${q.slice(0, 220)}"\n   Page: ${s.access?.url || s.contact?.website}\n   Status: ${STATUS[s.access?.status] || "Open now"}. Pin: ${s.location_precision === "address" ? `exact address (${s.address})` : "town only"}.\n${evs.length ? evs.map((e) => `   Upcoming: ${e.title}, ${e.start_date || e.date_precision}${e.cost_text ? `, ${e.cost_text}` : ""} (${e.registration_status || "status unknown"})${e.signup_url ? ` - signup ${e.signup_url}` : ""} - source ${e.source_url}\n`).join("") : ""}${cs.length ? `   Look at: ${cs.join("; ")}.\n` : ""}`;
  });
  total += rows.length;
}
fs.writeFileSync(path.join(KM, "REVIEW-SOLID.md"), out.replace("# Solid places to review", `# Solid places to review (${total})`));
console.log(`${total} solid places`);
