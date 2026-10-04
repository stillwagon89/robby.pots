// Kiln Finder: site/firings.html. Built to design_handoff_kiln_finder (turn 3),
// adjusted for real data: a sixth "Full" status, a "who can join" line, link-outs
// instead of email capture. Data: /data/firings.json from kiln-map/build.mjs.
// URL state: ?type=soda&view=locations&sel=<listing or place id>&near=<label>&lat=&lng=&r=60

const TYPE_CHIPS = [["all", "All"], ["soda", "Soda"], ["wood", "Wood"], ["salt", "Salt"], ["raku", "Raku"], ["pit_barrel_saggar", "Pit"], ["gas_reduction", "Gas"], ["rental_service", "Rental"]];
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
const RADII = [["30", "30 mi"], ["60", "60 mi"], ["120", "2 hrs"], ["all", "All CA"]];
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

const state = { type: "all", view: "firings", sel: null, near: null, radius: "60" };

function readUrl() {
  const q = new URLSearchParams(location.search);
  state.type = TYPE_CHIPS.some(([v]) => v === q.get("type")) ? q.get("type") : "all";
  state.view = q.get("view") === "locations" ? "locations" : "firings";
  state.sel = q.get("sel");
  state.near = q.get("lat") && q.get("lng") ? { lat: Number(q.get("lat")), lng: Number(q.get("lng")), label: q.get("near") || "your location" } : null;
  if (RADII.some(([v]) => v === q.get("r"))) state.radius = q.get("r");
}
function writeUrl(push) {
  const q = new URLSearchParams();
  if (state.type !== "all") q.set("type", state.type);
  if (state.view !== "firings") q.set("view", state.view);
  if (state.sel) q.set("sel", state.sel);
  if (state.near) { q.set("near", state.near.label); q.set("lat", state.near.lat.toFixed(4)); q.set("lng", state.near.lng.toFixed(4)); q.set("r", state.radius); }
  const url = `${location.pathname}${q.toString() ? `?${q}` : ""}`;
  history[push ? "pushState" : "replaceState"](null, "", url);
}

// ---------- data helpers ----------

let DATA = null;

function inRange(p) {
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
    if (!p.opportunities.length && placeMatchesType(p)) cards.push({ kind: "place", id: p.id, place: p });
  }
  const rank = (c) => (c.kind === "place" ? "9999" : c.o.start_date || "9998");
  return cards.sort((a, b) => rank(a).localeCompare(rank(b)));
}
const locationCards = () => DATA.places.filter((p) => inRange(p) && placeMatchesType(p)).map((p) => ({ kind: "place", id: p.id, place: p }));

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
function primaryUrl(o, p) {
  if (o.status === "opens_soon") return updatesUrl(p);
  if (o.status === "more_info") return contactUrl(p) || o.source_url;
  if (o.status === "full") return p.contact?.website || o.source_url;
  return o.source_url;
}

// ---------- rendering: list ----------

function cardHtml(c) {
  const sel = state.sel === c.id ? " is-selected" : "";
  if (c.kind === "place") {
    const p = c.place;
    const types = p.firing_types.filter((t) => TYPE_LABEL[t]).map((t) => TYPE_LABEL[t]).join(", ");
    const nothing = !p.opportunities.length;
    const reachable = p.contact?.email || p.contact?.website || p.contact?.instagram;
    return `<button type="button" class="kf-card${nothing ? " is-dashed" : ""}${sel}" data-id="${esc(c.id)}" data-place="${esc(p.id)}">
      <span class="kf-card-top"><span class="kf-card-title">${esc(p.org)}</span>${nothing ? badge("more_info") : `<span class="kf-count">${p.opportunities.length} listing${p.opportunities.length === 1 ? "" : "s"}</span>`}</span>
      <span class="kf-meta">${esc(p.city)}${p.location_precision === "address" ? "" : " (approximate area)"} · ${esc(types)}</span>
      ${nothing ? `<span class="kf-meta">${reachable ? "Dates not posted. Contact them to ask." : "Dates not posted. No public contact yet."}</span>` : ""}
    </button>`;
  }
  const { o, place: p } = c;
  // Card meta stays one line: show "Pay:" only for crew/work trades, and only short prices (the panel has the rest).
  const trade = o.pay_text && /shift|crew|trade|work|stok/i.test(o.pay_text) ? `Pay: ${o.pay_text}` : null;
  const price = o.cost_text && o.cost_text.length <= 32 ? o.cost_text : null;
  const meta = [p.org, fmtDates(o), trade || price].filter(Boolean).join(" · ");
  const tags = [o.first_atmospheric_ok && "First atmospheric OK", o.hosts_groups && "Hosts groups"].filter(Boolean);
  return `<button type="button" class="kf-card${o.status === "more_info" ? " is-dashed" : ""}${sel}" data-id="${esc(o.id)}" data-place="${esc(p.id)}">
    <span class="kf-card-top"><span class="kf-card-title">${esc(o.title)}</span>${badge(o.status)}</span>
    <span class="kf-meta">${esc(meta)}</span>
    ${o.who_can_join ? `<span class="kf-who">${esc(o.who_can_join)}</span>` : ""}
    ${o.key_date ? `<span class="kf-key">${esc(o.key_date)}</span>` : ""}
    ${tags.length ? `<span class="kf-tags">${tags.map((t) => `<span class="kf-tag">${esc(t)}</span>`).join("")}</span>` : ""}
  </button>`;
}

function renderList() {
  const cards = state.view === "firings" ? firingCards() : locationCards();
  const typeWord = state.type === "all" ? "" : `${TYPE_LABEL[state.type].toLowerCase()} `;
  const noun = state.view === "firings" ? "listing" : "kiln location";
  const radiusOn = state.near && state.radius !== "all";
  const where = radiusOn ? ` within ${RADII.find(([v]) => v === state.radius)[1]} of ${state.near.label}` : "";
  document.getElementById("kf-count").textContent = `${cards.length} ${typeWord}${noun}${cards.length === 1 ? "" : "s"}${where}`;
  document.getElementById("kf-sort").textContent = state.view === "firings" ? "Soonest first" : "";
  document.getElementById("kf-list").innerHTML = cards.length
    ? cards.map(cardHtml).join("")
    : `<p class="kf-empty">Nothing ${radiusOn ? "in this area " : ""}for this filter yet. ${radiusOn ? "Try a wider distance or another firing type." : "Try another firing type."}</p>`;
  return cards;
}

// ---------- rendering: panel ----------

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
function unknownsHtml(p) {
  return p.unknowns.length ? `<p class="kf-eyebrow kf-eyebrow-gap">What we don't know</p><ul class="kf-unknowns">${p.unknowns.map((u) => `<li>${esc(u)}</li>`).join("")}</ul>` : "";
}
function contactNote(p) {
  const c = p.contact || {};
  if (c.note) return `<p class="kf-note">${esc(c.note)}</p>`;
  if (!c.email && !c.website && !c.instagram && !c.phone) return `<p class="kf-note">No public contact found yet. If you know how to reach them, <a href="contact.html">tell me</a>.</p>`;
  return "";
}
function clayAiLink(type) {
  const word = { soda: "soda", wood: "wood firing", salt: "salt firing", raku: "raku", pit_barrel_saggar: "pit firing" }[type];
  return word ? `<a class="kf-clayai" href="ask.html">Preparing pots for ${esc(word)}? Ask Clay.AI &rarr;</a>` : "";
}
function whenText(o) {
  if (!o.start_date) return "";
  if (o.date_precision === "month") return `${fmtDates(o)} (exact dates not posted)`;
  return `${fmtDay(o.start_date)}${o.end_date && o.end_date !== o.start_date ? ` – ${fmtDay(o.end_date)}` : ""}`;
}

function listingPanel(o, p) {
  const url = primaryUrl(o, p);
  const tags = [o.first_atmospheric_ok && "First atmospheric OK", o.hosts_groups && "Hosts groups"].filter(Boolean);
  const meta = [p.org, fmtDates(o), o.cost_text].filter(Boolean).join(" · ");
  return `
    <div class="kf-panel-top"><button type="button" class="kf-back" data-close>&larr; All listings</button>${badge(o.status)}</div>
    <p class="kf-eyebrow">${esc(TYPE_LABEL[o.firing_type] || "")} · ${esc(p.city)}</p>
    <h2 class="kf-panel-title">${esc(o.title)}</h2>
    <p class="kf-panel-meta">${esc(meta)}</p>
    ${o.who_can_join ? `<p class="kf-who">${esc(o.who_can_join)}</p>` : ""}
    ${tags.length ? `<p class="kf-tags">${tags.map((t) => `<span class="kf-tag">${esc(t)}</span>`).join("")}</p>` : ""}
    ${o.key_date ? `<p class="kf-key">${esc(o.key_date)}</p>` : ""}
    <div class="kf-actions">
      ${url ? `<a class="btn-cta" href="${esc(url)}" target="_blank" rel="noopener">${esc(STATUS[o.status].action)} ${ext}</a>` : ""}
      ${p.contact?.website && p.contact.website !== url ? `<a class="kf-btn-ghost" href="${esc(p.contact.website)}" target="_blank" rel="noopener">Host's page ${ext}</a>` : ""}
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
    ${aiBox("Clay.AI summary of the host's page", o.summary, o.source_url, o.checked)}
    ${!o.summary ? `<p class="kf-note">${o.added_by === "manual" ? "Added by hand from research" : "Found on"} <a href="${esc(o.source_url)}" target="_blank" rel="noopener">${esc(host(o.source_url))}</a> · checked ${esc(fmtDay(o.checked))} · <a href="contact.html">Is this wrong?</a></p>` : ""}
    ${linksHtml(placeLinks(p, o.source_url))}
    ${contactNote(p)}
    <p class="kf-note"><button type="button" class="kf-linkish" data-open-place="${esc(p.id)}">More about ${esc(p.org)} &rarr;</button></p>
    ${clayAiLink(o.firing_type)}`;
}

function placePanel(p) {
  const types = p.firing_types.filter((t) => TYPE_LABEL[t]);
  const updates = updatesUrl(p);
  return `
    <div class="kf-panel-top"><button type="button" class="kf-back" data-close>&larr; All ${state.view === "firings" ? "listings" : "locations"}</button>${p.opportunities.length ? "" : badge("more_info")}</div>
    <p class="kf-eyebrow">${esc(KIND_LABEL[p.kind] || "Kiln")} · ${esc(p.city)}</p>
    <h2 class="kf-panel-title">${esc(p.org)}</h2>
    <p class="kf-panel-meta">${esc(p.address || `${p.city}, CA`)} <span class="kf-precision">${p.location_precision === "address" ? "Exact address" : "Approximate area"}</span></p>
    ${p.location_note ? `<p class="kf-note">${esc(p.location_note)}</p>` : ""}
    <p class="kf-tags">${types.map((t) => `<span class="kf-tag">${esc(TYPE_LABEL[t])}</span>`).join("")}</p>
    ${detailRows([["How outsiders get in", esc(p.get_in.join(" · ") || "Not posted. Contact them to ask.")]])}
    <p class="kf-eyebrow kf-eyebrow-gap">Upcoming here</p>
    ${p.opportunities.length
      ? `<div class="kf-mini">${p.opportunities.map((o) => `<button type="button" class="kf-mini-row" data-open-listing="${esc(o.id)}"><span>${esc(o.title)}${fmtDates(o) ? ` · ${esc(fmtDates(o))}` : ""}</span>${badge(o.status)}</button>`).join("")}</div>`
      : `<p class="kf-note">No firing dates are posted.</p>`}
    ${aiBox("Clay.AI summary of their website", p.place_summary, p.contact?.website, p.last_checked)}
    ${linksHtml(placeLinks(p, null))}
    ${contactNote(p)}
    ${unknownsHtml(p)}
    ${updates ? `<a class="kf-btn-ghost kf-follow" href="${esc(updates)}" target="_blank" rel="noopener">Get their updates ${ext}</a>` : ""}
    <p class="kf-note">${esc(TRACKING[p.tracking] || "")}${p.last_checked ? ` Last checked ${esc(fmtDay(p.last_checked))}.` : ""} Something wrong? <a href="contact.html">Tell me</a>.</p>`;
}

function renderPanel() {
  const panel = document.getElementById("kf-panel");
  let html = null;
  if (state.sel) {
    for (const p of DATA.places) {
      if (p.id === state.sel) html = placePanel(p);
      const o = p.opportunities.find((x) => x.id === state.sel);
      if (o) html = listingPanel(o, p);
    }
  }
  if (!html) {
    state.sel = null;
    panel.hidden = true;
    document.body.classList.remove("kf-panel-open");
    return;
  }
  panel.innerHTML = html;
  panel.hidden = false;
  panel.scrollTop = 0;
  document.body.classList.add("kf-panel-open");
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
  else MAP.fitBounds(L.latLngBounds(DATA.places.filter((p) => typeof p.lat === "number").map((p) => [p.lat, p.lng])).pad(0.12));
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
    m.on("click", () => select(state.view === "firings" && p.opportunities.length ? firstListingId(p) : p.id, true));
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
  document.getElementById("kf-near-input").value = state.near ? state.near.label : "";
  const cards = renderList();
  renderPanel();
  renderMap(cards);
}

function select(id, push) {
  state.sel = id;
  writeUrl(push);
  render();
  const p = placeForSel();
  if (p && MAP && typeof p.lat === "number" && !MAP.getBounds().contains([p.lat, p.lng])) MAP.panTo([p.lat, p.lng]);
}

async function geocode(text) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=${encodeURIComponent(`${text}, California`)}`;
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
    state.sel = null;
    writeUrl(false);
    render();
  });
  const list = document.getElementById("kf-list");
  list.addEventListener("click", (e) => {
    const card = e.target.closest(".kf-card");
    if (card) select(card.dataset.id, true);
  });
  const hover = (e, on) => {
    const card = e.target.closest(".kf-card");
    if (card) MARKERS.get(card.dataset.place)?.getElement()?.querySelector(".kf-pin")?.classList.toggle("is-hover", on);
  };
  list.addEventListener("mouseover", (e) => hover(e, true));
  list.addEventListener("mouseout", (e) => hover(e, false));
  document.getElementById("kf-panel").addEventListener("click", (e) => {
    if (e.target.closest("[data-close]")) return select(null, true);
    const l = e.target.closest("[data-open-listing]");
    if (l) return select(l.dataset.openListing, true);
    const p = e.target.closest("[data-open-place]");
    if (p) return select(p.dataset.openPlace, true);
  });
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
  readUrl();
  bind();
  initMap();
  render();
  if (state.near) fitMap();
}
