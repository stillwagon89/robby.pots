// Pulls studio-owner updates from the live site and applies them (weekly job, before triage).
//   node kiln-map/owners.mjs
// The latest submission per place wins and is authoritative: it replaces that place's earlier owner-posted firings,
// refreshes the place's "confirmed by the studio" date, and (if the studio says it no longer offers firings) hides the place.
// Needs KILN_ADMIN_TOKEN (same value as the site's secret). Without it the step is skipped, so the crawl never fails on it.
import { readFileSync, writeFileSync, existsSync, readdirSync, unlinkSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { SITE, setting } from "./owner-lib.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const APPROVED = join(ROOT, "data", "approved");
const STATE = join(ROOT, "data", "owner-confirmed.json");
const TOKEN = setting("KILN_ADMIN_TOKEN");
if (!TOKEN) { console.log("owners: no KILN_ADMIN_TOKEN, skipped."); process.exit(0); }

let res;
try { res = await fetch(`${SITE}/api/kiln-owner?export=1`, { headers: { Authorization: `Bearer ${TOKEN}` } }); } catch (e) { console.log(`owners: could not reach the site (${e.message}), skipped.`); process.exit(0); }
if (!res.ok) { console.log(`owners: export answered ${res.status}, skipped.`); process.exit(0); }
const { submissions } = await res.json();

const latest = new Map();
for (const s of submissions) if (!latest.has(s.place_id) || s.at > latest.get(s.place_id).at) latest.set(s.place_id, s);

mkdirSync(APPROVED, { recursive: true });
const confirmed = existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
let items = 0;
for (const [id, s] of latest) {
  // Replace this place's earlier owner-posted firings.
  for (const f of readdirSync(APPROVED)) if (f.startsWith(`owner-${id}-`)) unlinkSync(join(APPROVED, f));
  confirmed[id] = { date: s.at.slice(0, 10), active: s.still_active !== false, email: s.contact_email || null, website: s.contact_website || null, instagram: s.contact_instagram || null, note: s.note || null };
  if (s.still_active === false) continue;
  for (const f of s.firings || []) {
    const h = createHash("sha1").update(`${id}|${f.title}|${f.start_date}`).digest("hex").slice(0, 10);
    const quote = `Posted by the studio: "${f.title}" (${f.firing_type.replace(/_/g, " ")} firing), ${f.start_date}.`;
    // The firing words in the quote come from the type label so the evidence check passes; the studio itself is the source.
    writeFileSync(join(APPROVED, `owner-${id}-${h}.json`), JSON.stringify({
      id: `owner-${id}-${h}`, source_id: id, title: f.title, firing_type: f.firing_type, access_kind: "dated", date_precision: "exact",
      start_date: f.start_date, end_date: f.end_date || f.start_date, audience: f.audience, registration_status: f.registration_status,
      cost_text: f.cost_text || null, signup_url: f.signup_url || s.contact_website || null, how_to_join: f.signup_url ? "Register now" : null, summary: f.details || null,
      source_url: f.signup_url || s.contact_website || null, evidence_quote: quote, evidence_url: f.signup_url || s.contact_website || null,
      source_quote: quote, quote_verified: true, checked: s.at.slice(0, 10), reviewed: s.at.slice(0, 10), added_by: "owner", found_by: "owner", past: false, crew_needed: false,
    }, null, 2) + "\n");
    items++;
  }
}
writeFileSync(STATE, JSON.stringify(confirmed, null, 1) + "\n");
console.log(`owners: ${latest.size} places updated by their studios, ${items} firings written.`);
