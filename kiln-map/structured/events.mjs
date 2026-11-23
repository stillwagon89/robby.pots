// Parsers for machine-readable events and the conversion to pending items (same schema as extract.mjs writes).
import { createHash } from "node:crypto";
import { TYPE_RE } from "../discover/gate.mjs";

const NON_ELECTRIC = ["wood", "soda", "salt", "raku", "pit_barrel_saggar", "gas_reduction"];
const ENT = { amp: "&", quot: '"', apos: "'", nbsp: " ", rsquo: "\u2019", lsquo: "\u2018", ndash: "\u2013", mdash: "\u2014", ldquo: "\u201c", rdquo: "\u201d", hellip: "\u2026" };
const decode = (t) => String(t || "").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const strip = (h) => decode(String(h || "").replace(/<[^>]+>/g, " ")).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
const STRICT = { raku: /\braku\b|horse ?hair|obvara/i, wood: /wood[- ]?(fire|fired|kiln|firing)|train[- ](kiln|fir)|anagama|noborigama|manabigama/i, gas_reduction: /\bgas[- ](fired|kiln|firing|reduction)|reduction[- ](fir|kiln|cooled)|high[- ]fire reduction/i };
const FOOD = /pizza|bbq|barbecue|brew|beer|bread|oven|grill|dinner|tasting|wine|cocktail/i;
const iso = (d) => d.toISOString().slice(0, 10);

// ---- iCalendar (.ics) ----
export function parseIcs(text) {
  const lines = text.replace(/\r/g, "").replace(/\n[ \t]/g, "").split("\n");
  const events = []; let cur = null;
  for (const l of lines) {
    if (l === "BEGIN:VEVENT") cur = {};
    else if (l === "END:VEVENT") { if (cur) events.push(cur); cur = null; }
    else if (cur) {
      const m = l.match(/^([A-Z-]+)((?:;[^:]*)?):(.*)$/); if (!m) continue;
      const v = m[3].replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\;/g, ";").replace(/\\\\/g, "\\");
      if (m[1] === "SUMMARY") cur.title = v;
      else if (m[1] === "DESCRIPTION") cur.description = v;
      else if (m[1] === "LOCATION") cur.location = v;
      else if (m[1] === "URL") cur.url = v;
      else if (m[1] === "RRULE") cur.rrule = v;
      else if (m[1] === "STATUS") cur.status = v;
      else if (m[1] === "DTSTART") { cur.start = dateOf(v); cur.allDay = /VALUE=DATE(?!-)/.test(m[2]) || /^\d{8}$/.test(v); }
      else if (m[1] === "DTEND") cur.end = dateOf(v);
    }
  }
  return events.filter((e) => e.title && e.start).map((e) => {
    let end = e.end || e.start;
    if (e.allDay && e.end) { const d = new Date(`${e.end}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); end = iso(d); } // all-day DTEND is exclusive
    if (end < e.start) end = e.start;
    return { title: e.title, description: e.description || "", url: e.url || null, location: e.location || "", start: e.start, end, recurring: Boolean(e.rrule), cancelled: /CANCEL/i.test(e.status || "") };
  });
}
const dateOf = (v) => { const m = v.match(/(\d{4})(\d{2})(\d{2})/); return m ? `${m[1]}-${m[2]}-${m[3]}` : null; };

// ---- schema.org Event JSON-LD ----
export function fromJsonLd(nodes) {
  return nodes.map((n) => {
    const s = String(n.startDate || "").slice(0, 10), e = String(n.endDate || n.startDate || "").slice(0, 10);
    const offer = [].concat(n.offers || [])[0] || {};
    return { title: strip(n.name), description: strip(n.description), url: typeof n.url === "string" ? n.url : offer.url || null, location: strip(n.location?.name || n.location?.address?.addressLocality || ""), start: s, end: e >= s ? e : s,
      online: /OnlineEventAttendanceMode$/.test(String(n.eventAttendanceMode || "")), cancelled: /Cancelled$/.test(String(n.eventStatus || "")), soldOut: /SoldOut$/.test(String(offer.availability || "")), cost: offer.price ? `${offer.priceCurrency === "USD" || !offer.priceCurrency ? "$" : ""}${offer.price}` : null };
  }).filter((e) => e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.start));
}

// ---- The Events Calendar (WordPress) REST API ----
export function fromTribe(json) {
  return (json.events || []).map((e) => ({ title: strip(e.title), description: strip(e.description), url: e.url || null, location: strip(e.venue?.venue || ""), start: String(e.start_date || "").slice(0, 10), end: String(e.end_date || e.start_date || "").slice(0, 10), cost: strip(e.cost) || null, soldOut: false }))
    .filter((e) => e.title && /^\d{4}-\d{2}-\d{2}$/.test(e.start));
}

// ---- conversion ----
const FULL = /already full|sold.?out|fully booked|no (spots|spaces|openings) (left|remaining)|\bfull\b(?! (day|load|kiln|time|service))/i;
export function toItem(source, ev, via, today) {
  if (ev.cancelled || ev.online || ev.recurring) return null;
  if (ev.end < today) return null;
  const text = `${ev.title}. ${ev.description}`;
  if (/\bonline\b|\bzoom\b|\bvirtual\b/i.test(ev.title) && !/in.person|on.site/i.test(text)) return null;
  // Precision first (these auto-approve): the firing type must be in the TITLE, or in the description of an event whose title is
  // itself about firing/kiln/workshop. Food and "rake" words are not firings.
  const title = decode(ev.title);
  if (FOOD.test(title)) return null;
  const titleOk = /\bfir(e|ed|es|ing)\b|\bkilns?\b|workshop|\bnight\b|\bparty\b|\bsession/i.test(title);
  const types = NON_ELECTRIC.filter((t) => { const re = STRICT[t] || TYPE_RE[t]; return re.test(title) || (titleOk && re.test(ev.description || "")); });
  if (!types.length) return null;
  const firing_type = types.includes("wood") ? "wood" : types[0];
  const sentence = (text.split(/(?<=[.!?])\s+/).find((x) => TYPE_RE[firing_type].test(x)) || ev.title).trim().slice(0, 300);
  const members = /members?[- ]only|for members|member firing/i.test(text), students = /students? only|enrolled students|current students/i.test(text);
  const id = createHash("sha1").update(`${source.id}|${ev.title}|${ev.start}`).digest("hex").slice(0, 12);
  return {
    title: title.slice(0, 140), host_org: source.org, firing_type, access_kind: "dated", audience: students ? "students" : members ? "members_only" : "public",
    date_precision: "exact", start_date: ev.start, end_date: ev.end, registration_status: ev.soldOut || FULL.test(text) ? "sold_out" : ev.url ? "open" : "unknown", crew_needed: /crew|volunteer|help (load|unload|stok)/i.test(text),
    source_url: ev.url || source.urls[0], source_quote: sentence, evidence_sentence: sentence, evidence_quote: sentence, summary: ev.description.slice(0, 400) || null, confidence: 0.9,
    cost_text: ev.cost || (text.match(/\$\d[\d,.]*/) || [null])[0], bring: null, commitment: null, signup_url: ev.url || null, registration_opens: null, signup_deadline: null,
    how_to_join: ev.url ? "Register now" : null, includes: [], source_id: source.id, past: false, quote_verified: true, checked: today, evidence_url: ev.url || source.urls[0], evidence_verified: true, year_on_page: true,
    found_by: `structured:${via}`, id,
  };
}
