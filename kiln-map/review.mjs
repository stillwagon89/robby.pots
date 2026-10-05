// Writes the weekly review list (kiln-map/REVIEW.md): every pending item as a numbered, plain-language line,
// plus anything that needs Robby's attention (dead links, unmatched newsletters, Instagram errors).
//   npm run kiln:review
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadSources } from "./sources.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, "data");
const read = (f) => JSON.parse(readFileSync(f, "utf8"));
const sources = loadSources();
const org = (id) => sources.find((s) => s.id === id)?.org || id;
const TYPE = { wood: "Wood", soda: "Soda", salt: "Salt", raku: "Raku", pit_barrel_saggar: "Pit", gas_reduction: "Gas", electric: "Electric", rental_service: "Rental", other: "Other" };

const pending = readdirSync(join(DATA, "pending")).filter((f) => f.endsWith(".json")).map((f) => read(join(DATA, "pending", f)))
  .sort((a, b) => org(a.source_id).localeCompare(org(b.source_id)) || (a.start_date || "").localeCompare(b.start_date || ""));
const runs = existsSync(join(DATA, "runs")) ? readdirSync(join(DATA, "runs")).sort() : [];
const run = runs.length ? read(join(DATA, "runs", runs.at(-1))) : null;
const health = existsSync(join(DATA, "link-health.json")) ? read(join(DATA, "link-health.json")) : {};

const lines = [`# Kiln Locator weekly review (${new Date().toISOString().slice(0, 10)})`, ""];
if (!pending.length) lines.push("Nothing new to review this week.", "");
else {
  lines.push(`${pending.length} item${pending.length === 1 ? "" : "s"} to review. Reply with the numbers to **reject** (and why) or **fix**. Everything else gets approved.`, "");
  pending.forEach((i, n) => {
    const when = i.start_date ? `${i.start_date}${i.end_date && i.end_date !== i.start_date ? ` to ${i.end_date}` : ""}` : "no date";
    const changed = i.changed_from ? ` **Changed** (was ${[i.changed_from.start_date, i.changed_from.registration_status].filter(Boolean).join(", ")}).` : "";
    lines.push(`${n + 1}. **${org(i.source_id)}: ${i.title}** (${TYPE[i.firing_type] || i.firing_type}, ${when}, sign-up: ${i.registration_status}).${changed}`);
    lines.push(`   Why listed: ${i.evidence_sentence || "(no reason given)"}`);
    if (i.year_on_page === false) lines.push(`   **Check the date:** the year ${i.start_date.slice(0, 4)} isn't written on their page; the AI may have guessed it.`);
    lines.push(`   Their ${i.evidence_via ? "post/email" : "page"} says: "${i.evidence_quote || i.source_quote}"${i.evidence_verified === false ? " (**check:** quote not found on the page, or it doesn't name the firing type)" : ""}`);
    lines.push(`   Source: ${i.evidence_url || i.source_url || i.evidence_via}`);
  });
  lines.push("");
}
const down = Object.entries(health).filter(([, h]) => h.status === "down");
const unclear = Object.entries(health).filter(([, h]) => h.status === "unclear");
if (unclear.length) lines.push("**Websites that refused our crawler** (links stay up; worth a quick check in your browser):", ...unclear.map(([id, h]) => `- ${org(id)}: ${h.url} (answered ${h.http})`), "");
if (down.length) lines.push("**Websites not loading** (links hidden on the site until they're back):", ...down.map(([id, h]) => `- ${org(id)}: ${h.url}`), "");
if (run?.inbox_note) lines.push(`**Newsletter inbox:** ${run.inbox_note}`, "");
if (run?.unmatched_emails?.length) lines.push("**Newsletters from senders I can't match to a kiln** (tell me which place each belongs to):", ...run.unmatched_emails.map((m) => `- ${m.from}: "${m.subject}" (${(m.date || "").slice(0, 10)})`), "");
// The AI sometimes describes a dated firing in its notes but records nothing: flag those for a human look.
const latestBySource = new Map();
for (const f of runs) for (const e of read(join(DATA, "runs", f)).sources) latestBySource.set(e.id, e);
const MONTH = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d{1,2}|sign-?ups? (is |are )?open|registration (is )?open|shift sign-?up/i;
const missed = [...latestBySource.values()].filter((e) => !e.found && MONTH.test(e.notes || "") && !/past|already (happened|passed)|before today/i.test(e.notes || ""));
if (missed.length) lines.push("**Possible missed listings** (their page mentions dates but nothing was recorded; worth a look):", ...missed.map((e) => `- ${org(e.id)}: ${(e.notes || "").slice(0, 220)}`), "");
const ig = (run?.sources || []).filter((s) => s.instagram_note);
if (ig.length) lines.push("**Instagram problems:**", ...ig.map((s) => `- ${s.org}: ${s.instagram_note}`), "");

const out = lines.join("\n");
writeFileSync(join(ROOT, "REVIEW.md"), out + "\n");
console.log(out);
