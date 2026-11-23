// Owner update form for the Kiln Locator. The link carries ?p=<place id>&t=<token>; the server checks the token.
const q = new URLSearchParams(location.search);
const placeId = q.get("p") || "", token = q.get("t") || "";
const $ = (id) => document.getElementById(id);
const TYPES = [["wood", "Wood / anagama"], ["soda", "Soda"], ["salt", "Salt"], ["raku", "Raku"], ["pit_barrel_saggar", "Pit / barrel / saggar"], ["gas_reduction", "Gas reduction"], ["other", "Other non-electric"]];
const AUD = [["public", "Open to the public"], ["members_only", "Members only"], ["students", "Enrolled students only"], ["invitation_only", "By invitation only"]];
const STAT = [["open", "Sign-up open"], ["waitlist", "Waitlist"], ["sold_out", "Full"], ["not_yet_open", "Opens later"], ["unknown", "Not sure"]];
const opts = (l) => l.map(([v, t]) => `<option value="${v}">${t}</option>`).join("");
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function addFiring() {
  const n = $("ku-firings").children.length;
  if (n >= 6) return;
  const d = document.createElement("fieldset");
  d.className = "ku-firing";
  d.style.cssText = "border:1px solid rgba(255,255,255,.18);border-radius:10px;padding:.9rem;margin-bottom:1rem";
  d.innerHTML = `<legend>Firing ${n + 1}</legend>
    <div class="field"><label>Name (e.g. "Spring soda firing")</label><input class="f-title" maxlength="120"></div>
    <div class="field"><label>Type</label><select class="f-type">${opts(TYPES)}</select></div>
    <div class="field"><label>First day</label><input type="date" class="f-start"></div>
    <div class="field"><label>Last day (same day if one day)</label><input type="date" class="f-end"></div>
    <div class="field"><label>Who can join</label><select class="f-aud">${opts(AUD)}</select></div>
    <div class="field"><label>Sign-up status</label><select class="f-stat">${opts(STAT)}</select></div>
    <div class="field"><label>Cost (optional)</label><input class="f-cost" maxlength="80" placeholder="$150"></div>
    <div class="field"><label>Sign-up link (optional)</label><input type="url" class="f-url" maxlength="300" placeholder="https://"></div>
    <div class="field"><label>Details (optional)</label><textarea class="f-det" rows="2" maxlength="400"></textarea></div>`;
  $("ku-firings").appendChild(d);
}

async function init() {
  if (!placeId || !token) { $("ku-bad").hidden = false; return; }
  const ok = await fetch(`/api/kiln-owner?p=${encodeURIComponent(placeId)}&t=${encodeURIComponent(token)}`).then((r) => r.json()).then((j) => j.ok).catch(() => false);
  if (!ok) { $("ku-bad").hidden = false; return; }
  try {
    const d = await fetch("/data/firings.json").then((r) => r.json());
    const p = d.places.find((x) => x.id === placeId);
    if (p) $("ku-place").textContent = `${p.org}${p.city ? `, ${p.city}` : ""}${p.state ? ` ${p.state}` : ""}`;
  } catch { /* the name is only a courtesy */ }
  $("ku-form").hidden = false;
  addFiring();
}
$("ku-add").addEventListener("click", addFiring);
$("ku-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const st = $("ku-status"); st.className = "status"; st.textContent = "";
  const firings = [...document.querySelectorAll(".ku-firing")].map((f) => ({
    title: f.querySelector(".f-title").value, firing_type: f.querySelector(".f-type").value, start_date: f.querySelector(".f-start").value, end_date: f.querySelector(".f-end").value,
    audience: f.querySelector(".f-aud").value, registration_status: f.querySelector(".f-stat").value, cost_text: f.querySelector(".f-cost").value, signup_url: f.querySelector(".f-url").value, details: f.querySelector(".f-det").value,
  })).filter((f) => f.title.trim());
  if (firings.some((f) => !f.start_date)) { st.className = "status error"; st.textContent = "Please give each firing a first day, or clear its name."; return; }
  const btn = $("ku-submit"); btn.disabled = true; btn.textContent = "Saving...";
  try {
    const r = await fetch("/api/kiln-owner", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      place_id: placeId, token, still_active: document.querySelector('input[name="active"]:checked').value !== "no", firings,
      contact_email: $("ku-email").value, contact_website: $("ku-web").value, contact_instagram: $("ku-ig").value, note: $("ku-note").value, your_name: $("ku-name").value }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { st.className = "status success"; st.textContent = "Thank you! Your listing will be updated on the Kiln Locator within a week."; }
    else { st.className = "status error"; st.textContent = j.error || "Something went wrong. Please try again."; }
  } catch { st.className = "status error"; st.textContent = "Network error. Please try again."; }
  btn.disabled = false; btn.textContent = "Save my listing";
});
init();
