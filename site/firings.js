// Kiln Finder: site/firings.html. Built to design_handoff_kiln_finder (turn 3),
// adjusted for real data: a sixth "Full" status, a "who can join" line, link-outs
// instead of email capture. Data: /data/firings.json from kiln-map/build.mjs.
// URL state: ?type=soda&view=locations&sel=<listing or place id>&near=<label>&lat=&lng=&r=60

const TYPE_CHIPS = [["all", "All"], ["soda", "Soda"], ["wood", "Wood"], ["salt", "Salt"], ["raku", "Raku"], ["pit_barrel_saggar", "Pit"], ["gas_reduction", "Gas"]];
const TYPE_LABEL = { wood: "Wood", soda: "Soda", salt: "Salt", raku: "Raku", pit_barrel_saggar: "Pit", gas_reduction: "Gas", electric: "Electric", rental_service: "Rental", other: "Other" };
const STATUS = {
  open: { label: "Open now", action: "Sign up on host's page" },
  opens_soon: { label: "Opens soon", action: "Get their updates" },
  waitlist: { label: "Waitlist", action: "Join waitlist" },
  full: { label: "Full", action: "See their next dates" },
  ongoing: { label: "Ongoing", action: "Enroll / apply" },
  more_info: { label: "More info needed", action: "Contact host" },
};
const KIND_LABEL = { residency: "Residency / art center", college: "College", city_arts: "Community arts center", studio: "Studio", private_kiln: "Private kiln" };
const TRACKING = {
  auto: "Checked automatically from their website.",
  blocked: "Their website blocks automatic checks, so this may lag behind.",
  no_website: "No website. Listed from public kiln maps.",
  not_checked: "Not checked yet.",
};
const RADII = [["30", "30 mi"], ["60", "60 mi"], ["120", "2 hrs"], ["all", "Any distance"]];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };
const ext = `<span aria-hidden="true">&nearr;</span>`;

function fmtDates(o) {
  if (!o.start_date) return "";
  const [y1, m1, d1] = o.start_date.split("-").map(Number);
  if (o.date_precision === "month") return `${MONTHS[m1 - 1]} ${y1}`;
  if (!o.end_date || o.end_date === o.start_date) return `${MONTHS[m1 - 1]} ${d1}`;
  const [, m2, d2] = o.end_date.split("-").map(Number);
  return m1 === m2 ? `${MONTHS[m1 - 1]} ${d1}–${d2}` : `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}`;
}
function fmtDay(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
function miles(a, b) {
  const R = 3958.8, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
const badge = (status) => `<span class="kf-badge kf-${status}">${esc(STATUS[status].label)}</span>`;

// ---------- state ----------

const state = { type: "all", view: "firings", sel: null, pin: null, near: null, radius: "60", st: "all" };
const STATE_NAMES = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const stateLabel = (c) => STATE_NAMES[c] || c;

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.type = TYPE_CHIPS.some(([v]) => v === q.get("type")) ? q.get("type") : "all";
  state.view = q.get("view") === "locations" ? "locations" : "firings";
  state.sel = q.get("sel");
  state.near = q.get("lat") && q.get("lng") ? { lat: Number(q.get("lat")), lng: Number(q.get("lng")), label: q.get("near") || "your location" } : null;
  if (RADII.some(([v]) => v === q.get("r"))) state.radius = q.get("r");
  state.st = q.get("st") || "all";
}
function writeUrl(push) {
  const q = new URLSearchParams();
  if (state.type !== "all") q.set("type", state.type);
  if (state.view !== "firings") q.set("view", state.view);
  if (state.st !== "all") q.set("st", state.st);
  if (state.sel) q.set("sel", state.sel);
  if (state.near) { q.set("near", state.near.label); q.set("lat", state.near.lat.toFixed(4)); q.set("lng", state.near.lng.toFixed(4)); q.set("r", state.radius); }
  const url = `${location.pathname}${q.toString() ? `?${q}` : ""}`;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

// ---------- data helpers ----------

let DATA = null;

function inRange(p) {
  if (state.st !== "all" && p.state !== state.st) return false;
  if (!state.near || state.radius === "all" || typeof p.lat !== "number") return true;
  return miles(state.near, p) <= Number(state.radius);
}
const typeMatch = (t) => state.type === "all" || t === state.type;
const placeMatchesType = (p) => state.type === "all" || p.firing_types.includes(state.type) || p.opportunities.some((o) => o.firing_type === state.type);

// Firings view: every posted listing, plus a "More info needed" card for places with nothing posted.
function firingCards() {
  const cards = [];
  for (const p of DATA.places) {
    if (!inRange(p)) continue;
    for (const o of p.opportunities.filter((x) => typeMatch(x.firing_type))) cards.push({ kind: "listing", id: o.id, place: p, o });
    // Places without listings live in the Kiln locations view; the Firings view counts them in a footnote.
  }
  // What can a visitor actually do soonest? Open sign-ups first (by date), then ongoing access, then sign-ups opening soon,
  // waitlists, unclear status, and full ones last. Places with no listings come after every listing.
  const TIER = { open: 0, ongoing: 1, opens_soon: 2, waitlist: 3, more_info: 4, full: 5 };
  const today = new Date().toISOString().slice(0, 10);
  const rank = (c) => {
    if (c.kind === "place") return "9|9999";
    const o = c.o;
    const upcoming = o.start_date && o.start_date >= today ? o.start_date : "9998";
    const tier = o.status === "ongoing" && upcoming === "9998" ? 1.5 : TIER[o.status] ?? 4;
    return `${tier}|${upcoming}`;
  };
  return cards.sort((a, b) => { const [ta, da] = rank(a).split("|"), [tb, db] = rank(b).split("|"); return Number(ta) - Number(tb) || (da + a.id).localeCompare(db + b.id); });
}
// A place reached through "View all firings" is pinned first so it shows at the top; normal clicks never reorder the list.
const locationCards = () => DATA.places.filter((p) => inRange(p) && placeMatchesType(p)).map((p) => ({ kind: "place", id: p.id, place: p }))
  .sort((a, b) => (b.id === state.pin) - (a.id === state.pin));

function placeLinks(p, signupUrl) {
  const c = p.contact || {};
  const links = [];
  if (signupUrl) links.push([signupUrl, "Sign-up page"]);
  if (c.website && c.website !== signupUrl) links.push([c.website, "Host website"]);
  if (p.newsletter_url && p.newsletter_url !== c.website) links.push([p.newsletter_url, "Newsletter, where dates are announced"]);
  if (c.instagram) links.push([`https://www.instagram.com/${c.instagram}/`, `Instagram @${c.instagram}`]);
  if (c.email) links.push([`mailto:${c.email}`, `Email ${c.email}`]);
  if (c.phone) links.push([`tel:${c.phone.replace(/[^\d+]/g, "")}`, `Call ${c.phone}`]);
  return links;
}
function updatesUrl(p) {
  const c = p.contact || {};
  return p.newsletter_url || (c.instagram && `https://www.instagram.com/${c.instagram}/`) || c.website || (c.email && `mailto:${c.email}`) || null;
}
function contactUrl(p) {
  const c = p.contact || {};
  return (c.email && `mailto:${c.email}`) || c.website || (c.instagram && `https://www.instagram.com/${c.instagram}/`) || (c.phone && `tel:${c.phone.replace(/[^\d+]/g, "")}`) || null;
}
// The evidence for a listing: its own, else the place's evidence for that firing type.
function evidenceFor(o, p) {
  if (o.evidence_url) return { sentence: o.evidence_sentence, quote: o.evidence_quote, url: o.evidence_url };
  const f = (p.firing_evidence || []).find((x) => x.firing_type === o.firing_type);
  return f ? { sentence: f.sentence, quote: f.quote, url: f.url } : null;
}
// Say what the button really does: a registration page only when we found one, otherwise the exact spot on their site that mentions this firing.
const hasSignup = (o) => Boolean(o.signup_url);
function primaryLabel(o) {
  if (["open", "ongoing"].includes(o.status)) return "Website";
  return STATUS[o.status].action;
}
function primaryUrl(o, p) {
  if (o.status === "opens_soon") return updatesUrl(p);
  if (o.status === "more_info") return contactUrl(p) || o.source_url;
  if (o.status === "full") return p.contact?.website || o.source_url;
  return o.signup_url || evidenceFor(o, p)?.url || o.source_url;
}

// ---------- rendering: list ----------

function cardHtml(c) {
  const sel = state.sel === c.id ? " is-selected" : "";
  if (c.kind === "place") {
    const p = c.place;
    const types = p.firing_types.filter((t) => TYPE_LABEL[t]).map((t) => TYPE_LABEL[t]).join(", ");
    const nothing = !p.opportunities.length;
    const reachable = p.contact?.email || p.contact?.website || p.contact?.instagram;
    return `<div class="kf-card${nothing ? " is-dashed" : ""}${sel}" data-id="${esc(c.id)}" data-place="${esc(p.id)}">
      <button type="button" class="kf-card-head" aria-expanded="${!!sel}"><span class="kf-card-top"><span class="kf-card-title">${esc(p.org)}</span>${nothing ? badge("more_info") : `<span class="kf-count">${p.opportunities.length} listing${p.opportunities.length === 1 ? "" : "s"}</span>`}</span>
      <span class="kf-meta">${esc(p.city)}${p.location_precision === "address" ? "" : " (approximate area)"} · ${esc(types)}</span>
      ${nothing ? `<span class="kf-meta">${reachable ? "Dates not posted. Contact them to ask." : "Dates not posted. No public contact yet."}</span>` : ""}
      <span class="kf-chevron" aria-hidden="true"></span></button>
      ${sel ? `<div class="kf-card-body">${placeDetail(p)}</div>` : ""}
    </div>`;
  }
  const { o, place: p } = c;
  // Card meta stays one line: show "Pay:" only for crew/work trades, and only short prices (the panel has the rest).
  const trade = o.pay_text && /shift|crew|trade|work|stok/i.test(o.pay_text) ? `Pay: ${o.pay_text}` : null;
  const price = o.cost_text && o.cost_text.length <= 32 ? o.cost_text : null;
  const meta = [p.org, fmtDates(o), trade || price].filter(Boolean).join(" · ");
  const tags = [o.first_atmospheric_ok && "First atmospheric OK", o.hosts_groups && "Hosts groups"].filter(Boolean);
  return `<div class="kf-card${o.status === "more_info" ? " is-dashed" : ""}${sel}" data-id="${esc(o.id)}" data-place="${esc(p.id)}">
    <button type="button" class="kf-card-head" aria-expanded="${!!sel}"><span class="kf-card-top"><span class="kf-card-title">${esc(o.title)}</span>${badge(o.status)}</span>
    <span class="kf-meta">${esc(meta)}</span>
    ${o.who_can_join ? `<span class="kf-who">${esc(o.who_can_join)}</span>` : ""}
    ${o.key_date ? `<span class="kf-key">${esc(o.key_date)}</span>` : ""}
    ${tags.length ? `<span class="kf-tags">${tags.map((t) => `<span class="kf-tag">${esc(t)}</span>`).join("")}</span>` : ""}
    <span class="kf-chevron" aria-hidden="true"></span></button>
    ${sel ? `<div class="kf-card-body">${listingDetail(o, p)}</div>` : ""}
  </div>`;
}

// Places with matching kilns but no firing listings (shown in Kiln locations, counted under the Firings list).
const placesWithoutListings = () => DATA.places.filter((p) => inRange(p) && placeMatchesType(p) && !p.opportunities.some((o) => typeMatch(o.firing_type))).length;

function renderList() {
  const cards = state.view === "firings" ? firingCards() : locationCards();
  const typeWord = state.type === "all" ? "" : `${TYPE_LABEL[state.type].toLowerCase()} `;
  const noun = state.view === "firings" ? "listing" : "kiln location";
  const radiusOn = state.near && state.radius !== "all";
  const where = radiusOn ? ` within ${RADII.find(([v]) => v === state.radius)[1]} of ${state.near.label}` : "";
  document.getElementById("kf-count").textContent = `${cards.length} ${typeWord}${noun}${cards.length === 1 ? "" : "s"}${where}`;
  document.getElementById("kf-sort").textContent = state.view === "firings" ? "Available soonest first" : "";
  document.getElementById("kf-list").innerHTML = cards.length
    ? cards.map(cardHtml).join("")
    : `<p class="kf-empty">No firing listings ${radiusOn ? "in this area " : ""}for this filter yet. ${radiusOn ? "Try a wider distance or another firing type." : "Try another firing type."}</p>`;
  const more = state.view === "firings" ? placesWithoutListings() : 0;
  if (more) document.getElementById("kf-list").insertAdjacentHTML("beforeend", `<p class="kf-note kf-more"><button type="button" class="kf-linkish" data-show-locations>${more} more place${more === 1 ? " has" : "s have"} these kilns but no firing dates posted &rarr;</button></p>`);
  return cards;
}

// ---------- rendering: expanded details ----------

function detailRows(rows) {
  const html = rows.filter(([, v]) => v).map(([k, v]) => `<div class="kf-row"><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join("");
  return html ? `<dl class="kf-rows">${html}</dl>` : "";
}
function linksHtml(links) {
  return links.length ? `<p class="kf-eyebrow kf-eyebrow-gap">Links</p><ul class="kf-links">${links.map(([u, t]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(t)}</span>${ext}</a></li>`).join("")}</ul>` : "";
}
function aiBox(title, text, sourceUrl, checked) {
  if (!text) return "";
  return `<div class="kf-ai">
    <p class="kf-ai-head"><span class="kf-ai-dot"></span>${esc(title)}</p>
    <p class="kf-ai-body">${esc(text)}</p>
    <p class="kf-ai-foot">${sourceUrl ? `${esc(host(sourceUrl))} · ` : ""}${checked ? `checked ${esc(fmtDay(checked))} · ` : ""}<a href="contact.html">Is this wrong?</a></p>
  </div>`;
}
const wordSet = (t) => new Set((t || "").toLowerCase().replace(/[^a-z ]+/g, " ").split(" ").filter((w) => w.length > 3));
function sameIdea(a, b) { const A = wordSet(a), B = wordSet(b); return [...A].filter((w) => B.has(w)).length / (Math.min(A.size, B.size) || 1) >= 0.5; }
const bare = (u) => (u || "").split("#")[0];
// One source line per claim: show what their page says; add a link only if it isn't the button already above.
function evidenceBox(title, text, ev, primary, checked, fallbackUrl) {
  const srcUrl = ev?.url || fallbackUrl;
  if (!text && !ev?.quote) return "";
  const link = srcUrl && bare(srcUrl) !== bare(primary) ? ` <a href="${esc(srcUrl)}" target="_blank" rel="noopener">See it on the page ${ext}</a> ·` : "";
  return `<div class="kf-ai">
    <p class="kf-ai-head"><span class="kf-ai-dot"></span>${esc(title)}</p>
    ${text ? `<p class="kf-ai-body">${esc(text)}</p>` : ""}
    ${ev?.quote ? `<p class="kf-quote">Their page says: &ldquo;${esc(ev.quote)}&rdquo;</p>` : ""}
    <p class="kf-ai-foot">${srcUrl ? `${esc(host(srcUrl))} ·` : ""}${link} ${checked ? `checked ${esc(fmtDay(checked))} · ` : ""}<a href="contact.html">Is this wrong?</a></p>
  </div>`;
}
function contactLine(p) {
  const c = p.contact || {};
  const parts = [];
  if (c.email) parts.push(`<a href="mailto:${esc(c.email)}">Email</a>`);
  if (c.phone) parts.push(`<a href="tel:${esc(c.phone.replace(/[^\d+]/g, ""))}">Call</a>`);
  if (c.instagram) parts.push(`<a href="https://www.instagram.com/${esc(c.instagram)}/" target="_blank" rel="noopener">Instagram</a>`);
  if (p.newsletter_url) parts.push(`<a href="${esc(p.newsletter_url)}" target="_blank" rel="noopener">Newsletter</a>`);
  return parts.length ? `<p class="kf-note">Contact the host: ${parts.join(" · ")}</p>` : "";
}
function unknownsHtml(p) {
  return p.unknowns.length ? `<p class="kf-eyebrow kf-eyebrow-gap">What we don't know</p><ul class="kf-unknowns">${p.unknowns.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : "";
}
function contactNote(p) {
  const c = p.contact || {};
  if (c.note) return `<p class="kf-note">${esc(c.note)}</p>`;
  if (!c.email && !c.website && !c.instagram && !c.phone) return `<p class="kf-note">No public contact found yet. If you know how to reach them, <a href="contact.html">tell me</a>.</p>`;
  return "";
}
function whenText(o) {
  if (!o.start_date) return "";
  if (o.date_precision === "month") return `${fmtDates(o)} (exact dates not posted)`;
  return `${fmtDay(o.start_date)}${o.end_date && o.end_date !== o.start_date ? ` – ${fmtDay(o.end_date)}` : ""}`;
}

function placeEvidence(p) {
  if (!p.place_summary && !(p.firing_evidence || []).length) return "";
  const lines = (p.firing_evidence || []).filter((f) => state.type === "all" || f.firing_type === state.type)
    .map((f) => `<li><strong>${esc(TYPE_LABEL[f.firing_type] || f.firing_type)}:</strong> ${f.sentence ? `${esc(f.sentence)} ` : "Source: "}<a href="${esc(f.url)}" target="_blank" rel="noopener">See the exact text ${ext}</a></li>`).join("");
  return `<div class="kf-ai">
    <p class="kf-ai-head"><span class="kf-ai-dot"></span>Clay.AI summary of their website</p>
    ${p.place_summary ? `<p class="kf-ai-body">${esc(p.place_summary)}</p>` : ""}
    ${lines ? `<ul class="kf-evidence">${lines}</ul>` : ""}
    <p class="kf-ai-foot">${p.last_checked ? `checked ${esc(fmtDay(p.last_checked))} · ` : ""}<a href="contact.html">Is this wrong?</a></p>
  </div>`;
}

function listingDetail(o, p) {
  const url = primaryUrl(o, p);
  return `
    <div class="kf-actions">
      ${url ? `<a class="btn-cta" href="${esc(url)}" target="_blank" rel="noopener">${esc(primaryLabel(o))} ${ext}</a>` : ""}
    </div>
    ${detailRows([
      ["When", esc(whenText(o))],
      ["Pay", esc(o.pay_text || o.cost_text)],
      ["Kiln", esc(o.kiln_style)],
      ["Includes", o.includes?.length ? esc(o.includes.join(", ")) : ""],
      ["Bring", esc(o.bring)],
      ["Commitment", esc(o.commitment)],
      ["How to join", esc(o.how_to_join)],
      ["Crew", o.crew_needed ? "Participants help load, stoke and unload." : ""],
    ])}
    ${(() => { const ev = evidenceFor(o, p); return evidenceBox("Clay.AI: why this is listed", [ev?.sentence, o.summary].filter(Boolean).filter((t, i, a) => !a.slice(0, i).some((u) => sameIdea(t, u))).join(" "), ev, url, o.checked, o.source_url); })()}
    ${contactLine(p)}
    ${contactNote(p)}
    <p class="kf-note"><button type="button" class="kf-linkish" data-open-place="${esc(p.id)}">View all firings &rarr;</button></p>`;
}

function placeDetail(p) {
  const types = p.firing_types.filter((t) => TYPE_LABEL[t]);
  const updates = updatesUrl(p);
  return `
    <p class="kf-addr">${esc(p.address || `${p.city}, ${p.state || ""}`)} <span class="kf-precision">${p.location_precision === "address" ? "Exact address" : "Approximate area"}</span></p>
    ${p.location_note ? `<p class="kf-note">${esc(p.location_note)}</p>` : ""}
    <p class="kf-tags">${types.map((t) => `<span class="kf-tag">${esc(TYPE_LABEL[t])}</span>`).join("")}</p>
    ${p.access ? evidenceBox("Clay.AI: how you can use their kilns", p.access.note, { quote: p.access.quote, url: p.access.url }, null, null, p.access.url) : ""}
    ${detailRows([["How outsiders get in", esc(p.get_in.join(" · ") || (updatesUrl(p) || contactUrl(p) ? "Not posted. Contact them to ask." : "No public way in found yet. Know how to reach them? Tell me below."))]])}
    <p class="kf-eyebrow kf-eyebrow-gap">Upcoming here</p>
    ${p.opportunities.length
      ? `<div class="kf-mini">${p.opportunities.map((o) => `<button type="button" class="kf-mini-row" data-open-listing="${esc(o.id)}"><span>${esc(o.title)}${fmtDates(o) ? ` · ${esc(fmtDates(o))}` : ""}</span>${badge(o.status)}</button>`).join("")}</div>`
      : `<p class="kf-note">No firing dates are posted.</p>`}
    ${placeEvidence(p)}
    ${linksHtml(placeLinks(p, null))}
    ${contactNote(p)}
    ${unknownsHtml(p)}
    ${updates ? `<a class="kf-btn-ghost kf-follow" href="${esc(updates)}" target="_blank" rel="noopener">Get their updates ${ext}</a>` : ""}
    <p class="kf-note">${esc(TRACKING[p.tracking] || "")}${p.last_checked ? ` Last checked ${esc(fmtDay(p.last_checked))}.` : ""} Something wrong? <a href="contact.html">Tell me</a>.</p>`;
}

// ---------- map ----------

let MAP = null;
const MARKERS = new Map();
let RADIUS_LAYER = null;

function pinIcon(p, mode) {
  const label = mode === "selected" ? `<span class="kf-pin-label">${esc(p.org.replace(/\s*\(.*\)$/, ""))}</span>` : "";
  return L.divIcon({
    className: "kf-pin-wrap",
    html: `<span class="kf-pin kf-pin-${mode}${p.location_precision === "address" ? "" : " is-private"}"></span>${label}`,
    iconSize: [0, 0],
  });
}

function placeForSel() {
  if (!state.sel) return null;
  return DATA.places.find((p) => p.id === state.sel || p.opportunities.some((o) => o.id === state.sel)) || null;
}

function renderMap(cards) {
  if (!MAP) return;
  const shown = new Set(cards.map((c) => c.place.id));
  const selPlace = placeForSel();
  for (const p of DATA.places) {
    const m = MARKERS.get(p.id);
    if (!m) continue;
    const mode = selPlace?.id === p.id ? "selected" : shown.has(p.id) ? "match" : "other";
    if (mode === "other") { m.remove(); continue; }
    if (!MAP.hasLayer(m)) m.addTo(MAP);
    m.setIcon(pinIcon(p, mode));
    m.setZIndexOffset(mode === "selected" ? 1000 : mode === "match" ? 500 : 0);
    m.setOpacity(inRange(p) ? 1 : 0.35);
  }
  if (RADIUS_LAYER) { RADIUS_LAYER.remove(); RADIUS_LAYER = null; }
  if (state.near && state.radius !== "all") {
    RADIUS_LAYER = L.circle([state.near.lat, state.near.lng], { radius: Number(state.radius) * 1609.34, color: "#7C93C4", weight: 1.5, dashArray: "4 5", fill: false, interactive: false }).addTo(MAP);
  }
}

function fitMap() {
  if (!MAP) return;
  if (RADIUS_LAYER) MAP.fitBounds(RADIUS_LAYER.getBounds().pad(0.05));
  else {
    // Every place in view (one state, or all of them), so new states show up without code changes.
    // "All states" frames the lower 48; Hawaii and Alaska are framed when picked in the state filter.
    const pts = DATA.places.filter((p) => typeof p.lat === "number" && (state.st === "all" ? !["HI", "AK"].includes(p.state) : p.state === state.st)).map((p) => [p.lat, p.lng]);
    if (pts.length) MAP.fitBounds(L.latLngBounds(pts).pad(0.08));
  }
}

function firstListingId(p) {
  const l = p.opportunities.find((o) => typeMatch(o.firing_type)) || p.opportunities[0];
  return l ? l.id : p.id;
}

function initMap() {
  const el = document.getElementById("kf-map");
  if (typeof L === "undefined") { el.innerHTML = `<p class="kf-empty">The map couldn't load. The list still works.</p>`; return; }
  MAP = L.map(el, { scrollWheelZoom: false });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 18,
    className: "kf-tiles",
  }).addTo(MAP);
  for (const p of DATA.places) {
    if (typeof p.lat !== "number") continue;
    const m = L.marker([p.lat, p.lng], { icon: pinIcon(p, "match"), keyboard: true, title: p.org, alt: p.org });
    m.on("click", () => select(state.view === "firings" && p.opportunities.length ? firstListingId(p) : p.id, true, { scroll: true }));
    m.addTo(MAP);
    MARKERS.set(p.id, m);
  }
  fitMap();
}

// ---------- interactions ----------

function render() {
  document.querySelectorAll("#kf-types .filter-chip").forEach((b) => b.classList.toggle("active", b.dataset.type === state.type));
  document.querySelectorAll("#kf-view button").forEach((b) => {
    const on = b.dataset.view === state.view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", String(on));
  });
  document.getElementById("kf-radius").value = state.radius;
  document.getElementById("kf-state").value = state.st;
  document.getElementById("kf-near-input").value = state.near ? state.near.label : "";
  const cards = renderList();
  renderMap(cards);
}

function select(id, push, { toggle = false, scroll = false } = {}) {
  state.sel = toggle && state.sel === id ? null : id;
  writeUrl(push);
  render();
  if (state.sel && scroll) document.querySelector(`.kf-card[data-id="${CSS.escape(state.sel)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const p = placeForSel();
  if (p && MAP && typeof p.lat === "number" && !MAP.getBounds().contains([p.lat, p.lng])) MAP.panTo([p.lat, p.lng]);
}

async function geocode(text) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const [hit] = await res.json();
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), label: text } : null;
}

function setNear(near) {
  state.near = near;
  if (near && state.radius === "all") state.radius = "60";
  writeUrl(false);
  render();
  fitMap();
}

function bind() {
  document.getElementById("kf-types").addEventListener("click", (e) => {
    const b = e.target.closest("[data-type]");
    if (!b) return;
    state.type = b.dataset.type;
    state.sel = null;
    writeUrl(false);
    render();
  });
  document.getElementById("kf-view").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    state.view = b.dataset.view;
    state.pin = null;
    state.sel = null;
    writeUrl(false);
    render();
  });
  const list = document.getElementById("kf-list");
  list.addEventListener("click", (e) => {
    const l = e.target.closest("[data-open-listing]");
    if (l) { state.view = "firings"; state.type = "all"; return select(l.dataset.openListing, true, { scroll: true }); }
    const pl = e.target.closest("[data-open-place]");
    if (pl) {
      state.view = "locations"; state.type = "all"; state.pin = pl.dataset.openPlace;
      select(state.pin, true);
      return document.getElementById("kf-count").scrollIntoView({ block: "start" });
    }
    if (e.target.closest("[data-show-locations]")) { state.view = "locations"; state.sel = null; writeUrl(true); render(); return document.getElementById("kf-count").scrollIntoView({ block: "start" }); }
    const head = e.target.closest(".kf-card-head");
    if (head) { const id = head.closest(".kf-card").dataset.id; if (id !== state.pin) state.pin = null; select(id, true, { toggle: true }); }
  });
  const hover = (e, on) => {
    const card = e.target.closest(".kf-card");
    if (card) MARKERS.get(card.dataset.place)?.getElement()?.querySelector(".kf-pin")?.classList.toggle("is-hover", on);
  };
  list.addEventListener("mouseover", (e) => hover(e, true));
  list.addEventListener("mouseout", (e) => hover(e, false));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.sel) select(null, true); });

  const status = document.getElementById("kf-near-status");
  document.getElementById("kf-near").addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = document.getElementById("kf-near-input").value.trim();
    if (!text) return setNear(null);
    status.textContent = "Finding…";
    try {
      const hit = await geocode(text);
      status.textContent = hit ? "" : "Couldn't find that place. Try a city or zip.";
      if (hit) setNear(hit);
    } catch {
      status.textContent = "Location search isn't available right now.";
    }
  });
  document.getElementById("kf-locate").addEventListener("click", () => {
    if (!navigator.geolocation) { status.textContent = "Your browser can't share location."; return; }
    status.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition(
      (pos) => { status.textContent = ""; setNear({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location" }); },
      () => { status.textContent = "Location wasn't shared. Type a city or zip instead."; },
      { timeout: 10000 }
    );
  });
  document.getElementById("kf-state").addEventListener("change", (e) => {
    state.st = e.target.value;
    state.sel = null;
    writeUrl(false);
    render();
    fitMap();
  });
  document.getElementById("kf-radius").addEventListener("change", (e) => {
    state.radius = e.target.value;
    writeUrl(false);
    render();
    fitMap();
  });
  window.addEventListener("popstate", () => { readUrl(); render(); });
}

async function renderKilnFinder() {
  document.getElementById("kf-types").innerHTML = TYPE_CHIPS.map(([v, label]) => `<button type="button" class="filter-chip" data-type="${v}">${esc(label)}</button>`).join("");
  document.getElementById("kf-radius").innerHTML = RADII.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("");
  try {
    const res = await fetch("/data/firings.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(String(res.status));
    DATA = await res.json();
  } catch {
    document.getElementById("kf-list").innerHTML = `<p class="kf-empty">The list couldn't load. Please try again in a minute.</p>`;
    return;
  }
  document.getElementById("kf-updated").textContent = fmtDay(DATA.generated);
  const states = [...new Set(DATA.places.map((p) => p.state).filter(Boolean))].sort((a, b) => stateLabel(a).localeCompare(stateLabel(b)));
  document.getElementById("kf-state").innerHTML = [`<option value="all">All states</option>`, ...states.map((c) => `<option value="${esc(c)}">${esc(stateLabel(c))}</option>`)].join("");
  readUrl();
  bind();
  initMap();
  render();
  if (state.near) fitMap();
}
