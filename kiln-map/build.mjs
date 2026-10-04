// Builds site/data/firings.json (what site/firings.html and site/kiln.html
// read) from kiln-map/sources.json and the approved items in
// kiln-map/data/approved/. Past firings are left out; places with nothing
// posted stay in, with a plain note on what isn't known and who to contact.
//
//   npm run kiln:build      # then commit site/data/firings.json and push

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "..", "site", "data", "firings.json");
const TODAY = new Date().toISOString().slice(0, 10);
const read = (f) => JSON.parse(readFileSync(f, "utf8"));

const { sources } = read(join(ROOT, "sources.json"));
const approvedDir = join(ROOT, "data", "approved");
const approved = existsSync(approvedDir) ? readdirSync(approvedDir).filter((f) => f.endsWith(".json")).map((f) => read(join(approvedDir, f))) : [];

// Each source's most recent run entry, to say whether its site can be checked automatically.
const runsDir = join(ROOT, "data", "runs");
const lastRun = new Map();
if (existsSync(runsDir)) for (const f of readdirSync(runsDir).sort()) for (const e of read(join(runsDir, f)).sources) lastRun.set(e.id, { ...e, date: f.slice(0, 10) });

const ITEM_FIELDS = ["summary", "pay_text", "bring", "commitment", "id", "firing_type", "kiln_style", "access_kind", "audience", "start_date", "end_date", "date_precision", "signup_deadline", "registration_status", "registration_opens", "cost_text", "how_to_join", "includes", "crew_needed", "first_atmospheric_ok", "source_url", "evidence_sentence", "evidence_quote", "evidence_url", "signup_url", "checked", "added_by"];

// Titles often carry status and dates already shown elsewhere: "(WAITLIST) MEMBERS | X | October 7 - 9".
function cleanTitle(t) {
  return t
    .replace(/^\s*\((?:waitlist|sold out|full)\)\s*/i, "")
    .replace(/^\s*members\s*\|\s*/i, "")
    .split("|")[0]
    .replace(/\s+[—–-]\s+[A-Z][a-z]{2,8}\.? \d{1,2}\b.*$/, "")
    .trim();
}

const ONGOING_KINDS = ["ongoing_membership", "class_enrollment", "residency", "rental_service"];
const AUDIENCE_LINE = { members_only: "Members only", students: "Enrolled students only", residents_only: "Residents only", invitation_only: "By invitation only" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const short = (iso) => { const [, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}`; };

// The handoff's status scale (one cobalt, six weights): open · opens_soon · waitlist · full · ongoing · more_info.
// Systemic link rule: if the last crawl found a place's website down, the site doesn't link to it (no dead ends).
// The next crawl re-checks, so the link returns on its own when the site is back.
const HEALTH = existsSync(join(ROOT, "data", "link-health.json")) ? JSON.parse(readFileSync(join(ROOT, "data", "link-health.json"), "utf8")) : {};
function contactFor(s) {
  const c = { ...(s.contact || {}) };
  if (HEALTH[s.id]?.status === "down" && c.website) {
    delete c.website;
    c.note = [c.note, "Their website wasn't loading when last checked."].filter(Boolean).join(" ");
  }
  return c;
}

function displayStatus(i) {
  if (i.registration_status === "waitlist" || (/waitlist/i.test(i.title) && i.registration_status === "sold_out")) return "waitlist";
  if (i.registration_status === "sold_out" || i.registration_status === "closed") return "full";
  if (ONGOING_KINDS.includes(i.access_kind)) {
    // A single dated session listed as a class (e.g. a monthly raku night) is a dated firing, not ongoing access.
    const oneSession = i.access_kind === "class_enrollment" && i.start_date && (!i.end_date || i.end_date === i.start_date);
    if (!oneSession) return "ongoing";
  }
  if (i.registration_status === "open") return "open";
  if (i.registration_status === "not_yet_open") return "opens_soon";
  // The page often shows a "Register now" button without saying "open": treat that, on a future date, as open.
  if (i.registration_status === "unknown" && i.start_date && i.start_date >= TODAY && /register|sign.?up|enroll|book|buy|reserve/i.test(i.how_to_join || "")) return "open";
  return "more_info";
}

function keyDate(i, status) {
  if (status === "opens_soon") return i.registration_opens ? `Sign-up opens ${short(i.registration_opens)}` : "Sign-up date to be announced";
  if (i.signup_deadline && i.signup_deadline >= TODAY) return `Sign up by ${short(i.signup_deadline)}`;
  if (status === "more_info") return "Sign-up status not posted";
  if (status === "ongoing" && i.start_date && i.start_date >= TODAY) return `Next term starts ${short(i.start_date)}`;
  return null;
}

const isPast = (i) => {
  const end = i.end_date || i.start_date;
  return Boolean(end) && end < TODAY;
};

function trackingFor(source) {
  if (!source.urls.length) return "no_website";
  const r = lastRun.get(source.id);
  if (!r) return "not_checked";
  return r.pages?.some((p) => p.chars > 200) ? "auto" : "blocked";
}

const places = sources.map((s) => {
  const items = approved
    .filter((i) => i.source_id === s.id && !isPast(i))
    .map((i) => ({
      ...Object.fromEntries(ITEM_FIELDS.map((k) => [k, i[k] ?? null])),
      title: cleanTitle(i.title),
      // A "(WAITLIST)" title means the waitlist is open, which is more useful than "sold out".
      registration_status: /waitlist/i.test(i.title) && i.registration_status === "sold_out" ? "waitlist" : i.registration_status,
      status: displayStatus(i),
      key_date: keyDate(i, displayStatus(i)),
      who_can_join: AUDIENCE_LINE[i.audience] || null,
    }))
    .sort((a, b) => (a.start_date || "9999").localeCompare(b.start_date || "9999"));

  const tracking = trackingFor(s);
  const dated = items.filter((i) => i.start_date && i.access_kind !== "residency");
  const unknowns = [];
  if (!dated.length) unknowns.push(tracking === "auto" ? "No upcoming firing dates are posted on their website." : "Firing dates aren't posted anywhere we can check.");
  if (dated.some((i) => i.registration_status === "unknown" && !i.registration_opens)) unknowns.push("Sign-up status isn't posted for some dates.");
  if (s.location_precision === "approximate") unknowns.push(s.location_note || "No public street address.");
  if (!s.contact?.email && !s.contact?.website && !s.contact?.phone && !s.contact?.instagram && !/no public/i.test(s.contact?.note || "")) unknowns.push("No public contact found yet.");
  if (tracking === "blocked") unknowns.push("Their website blocks automatic checks, so this listing may lag behind.");

  const firingTypes = [...new Set([...items.map((i) => i.firing_type), ...items.flatMap((i) => (i.includes || []).join(" ").toLowerCase().match(/wood|soda|salt|raku|pit/g) || []), ...s.firing_types_guess])]
    .map((t) => (t === "pit" ? "pit_barrel_saggar" : t))
    .filter((t, idx, arr) => arr.indexOf(t) === idx);

  return {
    id: s.id,
    org: s.org,
    kind: s.kind,
    public: s.public,
    region: s.region,
    city: s.city,
    lat: s.lat,
    lng: s.lng,
    location_precision: s.location_precision,
    address: s.location_precision === "address" ? s.address : null,
    location_note: s.location_note || null,
    contact: contactFor(s),
    newsletter_url: s.newsletter_url || null,
    place_summary: lastRun.get(s.id)?.place_summary || null,
    firing_evidence: lastRun.get(s.id)?.firing_evidence || [],
    get_in: [...new Set(items.map((i) => ({ dated: "Workshops and firings", ongoing_membership: "Membership", class_enrollment: "Classes", residency: "Residencies", rental_service: "Kiln rental" })[i.access_kind]).filter(Boolean))],
    firing_types: firingTypes,
    tracking,
    last_checked: lastRun.get(s.id)?.date || null,
    unknowns,
    opportunities: items,
  };
});

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ generated: TODAY, places }, null, 2) + "\n");
const n = places.reduce((sum, p) => sum + p.opportunities.length, 0);
console.log(`Wrote site/data/firings.json: ${places.length} places, ${n} listings (past firings left out).`);
