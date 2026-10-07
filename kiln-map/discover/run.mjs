// State discovery without Claude: Tavily search -> fetch and trim pages -> local Gemma judge (Ollama) -> report.
// Usage: node --dns-result-order=ipv4first kiln-map/discover/run.mjs FL [--stage=search|fetch|judge|report]
// Every stage caches under research/cache/<st>/, so a rerun only redoes what's missing.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { gate } from "./gate.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const KM = path.resolve(HERE, "..");
const ST = (process.argv[2] || "").toUpperCase();
const ONLY = (process.argv.find((a) => a.startsWith("--stage=")) || "").split("=")[1];
if (!ST) throw new Error("usage: run.mjs <STATE>");
const STATES = JSON.parse(fs.readFileSync(path.join(HERE, "states.json"), "utf8"));
const CFG = STATES[ST];
if (!CFG) throw new Error(`no config for ${ST} in discover/states.json`);
const CACHE = path.join(KM, "research/cache", ST.toLowerCase());
fs.mkdirSync(CACHE, { recursive: true });
const OLLAMA_MODEL = process.env.JUDGE_MODEL || "gemma4:latest";

const env = Object.fromEntries(
  fs.readFileSync(path.join(ROOT, ".dev.vars"), "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "").trim()])
);
const readJson = (f, d) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : d);
// Scraped pages sometimes embed other sites' API tokens; never save them (GitHub push protection rejects them too).
const SECRET = /\b(sk|pk)\.eyJ[A-Za-z0-9._-]{20,}|\b(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|ghp_[A-Za-z0-9]{36}|xox[bp]-[A-Za-z0-9-]{20,})/g;
const writeJson = (f, v) => fs.writeFileSync(f, JSON.stringify(v, null, 2).replace(SECRET, "[redacted-token]"));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 1. search list ----------
function searchList() {
  const S = CFG.name;
  const q = [];
  for (const t of ["raku firing workshop", "horsehair raku workshop", "wood firing anagama workshop", "soda firing workshop", "salt firing workshop", "pit firing workshop", "barrel saggar firing workshop", "gas reduction firing class", "gas kiln firing service for potters", "wood kiln firing crew volunteers"]) q.push(`${t} ${S}`);
  for (const c of CFG.cities) {
    q.push(`raku or wood firing pottery studio ${c} ${ST}`);
    q.push(`${c} ${S} clay studio kiln firing workshop`);
    // Gas reduction lives mostly in membership studios that city raku/wood searches miss.
    q.push(`cone 10 gas reduction community pottery studio membership ${c} ${ST}`);
  }
  for (const s of ["pottery supply store raku firing", "potters guild wood firing", "community college ceramics wood kiln open to public", "anagama kiln", "raku party book a private firing", "ceramics residency atmospheric firing"]) q.push(`${s} ${S}`);
  return [...new Set(q)];
}

// ---------- 2. search (Tavily) ----------
async function tavily(query) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "advanced", max_results: 10, include_raw_content: "text" }),
    signal: AbortSignal.timeout(90000),
  });
  const d = await res.json();
  if (!d.results) throw new Error(`tavily: ${JSON.stringify(d).slice(0, 200)}`);
  return d.results.map((r) => ({ url: r.url, title: r.title, snippet: r.content, raw: (r.raw_content || "").slice(0, 60000) }));
}
async function stageSearch() {
  const f = path.join(CACHE, "search.json");
  const done = readJson(f, {});
  const todo = searchList().filter((q) => !done[q]);
  log(`search: ${todo.length} new of ${searchList().length} (each costs 2 Tavily credits)`);
  for (let i = 0; i < todo.length; i += 4) {
    await Promise.all(todo.slice(i, i + 4).map(async (q) => {
      try { done[q] = await tavily(q); } catch (e) { log("search failed", q, e.message); }
    }));
    writeJson(f, done);
  }
  return done;
}

// ---------- 3. group, dedupe, fetch, trim ----------
const SOCIAL = /(^|\.)(facebook|instagram|youtube|pinterest|reddit|tiktok|x|twitter|linkedin|yelp|tripadvisor|alignable)\.com$/;
const CATALOG = /(^|\.)(eventbrite|activecommunities|civicrec|active|ma\.to|allevents|classbento|coursehorse|airbnb)\.(com|to|in)$/;
const host = (u) => new URL(u).hostname.replace(/^www\./, "");
const keyFor = (u) => (CATALOG.test(host(u)) ? u.split("#")[0] : host(u));
const FIRE = /raku|wood.?fir|woodfir|anagama|noborigama|train kiln|groundhog|bourry|cross.?draft|catenary|soda|salt.?(fir|glaz|kiln)|pit.?fir|barrel|saggar|obvara|horse.?hair|reduction|cone 10|atmospheric|kiln|firing/i;

function knownDomains() {
  const out = new Map();
  for (const [h, st] of Object.entries(readJson(path.join(HERE, "elsewhere.json"), {}))) if (!h.startsWith("_")) out.set(h, `${st}:elsewhere`);
  for (const f of fs.readdirSync(path.join(KM, "sources")).filter((x) => x.endsWith(".json"))) {
    for (const s of readJson(path.join(KM, "sources", f), { sources: [] }).sources || []) {
      for (const u of [...(s.urls || []), s.contact?.website].filter(Boolean)) { try { out.set(host(u), `${f.replace(".json", "")}:${s.id}`); } catch {} }
    }
  }
  return out;
}

const BOT = "FlamingClayFiringsBot";
const lastHit = new Map();
const robots = new Map();
async function allowed(url) {
  const u = new URL(url);
  if (!robots.has(u.origin)) {
    let dis = [];
    try {
      const r = await fetch(`${u.origin}/robots.txt`, { signal: AbortSignal.timeout(10000) });
      if (r.ok) {
        let mine = false;
        for (const line of (await r.text()).split(/\r?\n/)) {
          const m = line.replace(/#.*/, "").trim().match(/^([a-z-]+)\s*:\s*(.*)$/i);
          if (!m) continue;
          if (/^user-agent$/i.test(m[1])) mine = m[2].trim() === "*" || BOT.toLowerCase().includes(m[2].trim().toLowerCase());
          else if (mine && /^disallow$/i.test(m[1]) && m[2].trim()) dis.push(m[2].trim());
        }
      }
    } catch {}
    robots.set(u.origin, dis);
  }
  return !robots.get(u.origin).some((p) => (u.pathname + u.search).startsWith(p.replace(/\*.*$/, "")));
}
async function getPage(url) {
  try {
    if (!(await allowed(url))) return { url, ok: false, error: "robots" };
    const h = new URL(url).host;
    const wait = (lastHit.get(h) || 0) + 1500 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastHit.set(h, Date.now());
    const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(20000), headers: { "User-Agent": `Mozilla/5.0 (Macintosh) Chrome/128.0 Safari/537.36 ${BOT}/0.1 (+https://flamingclay.com)`, Accept: "text/html" } });
    return { url, ok: r.ok, status: r.status, html: r.ok ? await r.text() : "" };
  } catch (e) { return { url, ok: false, error: String(e.cause?.code || e.name) }; }
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—", hellip: "…" };
const toText = (html) => html
  .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
  .replace(/<[^>]+>/g, " ")
  .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => (e[0] === "#" ? String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)) : ENT[e.toLowerCase()] ?? m))
  .replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
function firingLinks(html, base) {
  const out = new Set();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(m[1].replace(/&amp;/g, "&"), base); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || host(u.href) !== host(base) || /\.(jpe?g|png|gif|webp|pdf|zip|mp4)$/i.test(u.pathname)) continue;
    if (/raku|fir(e|ing)|kiln|workshop|class|event|calendar|wood|soda|book|service/i.test(u.pathname + " " + toText(m[2]))) out.add(u.href.split("#")[0]);
  }
  return [...out].filter((u) => u !== base).slice(0, 3);
}
// Keep only lines near firing words, so the judge sees ~1.5k tokens per place.
function trim(text, cap = 6000) {
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2);
  const keep = new Set();
  lines.forEach((l, i) => { if (FIRE.test(l)) for (let j = i - 1; j <= i + 2; j++) if (lines[j] && lines[j].length < 600) keep.add(j); });
  let out = "", seen = new Set();
  for (const i of [...keep].sort((a, b) => a - b)) { if (seen.has(lines[i])) continue; seen.add(lines[i]); out += lines[i] + "\n"; if (out.length > cap) break; }
  return out.slice(0, cap);
}

async function stageFetch(search) {
  const f = path.join(CACHE, "places.json");
  const places = readJson(f, {});
  const known = knownDomains();
  for (const [q, results] of Object.entries(search)) {
    for (const r of results) {
      let k; try { k = keyFor(r.url); } catch { continue; }
      const p = (places[k] ||= { key: k, social: SOCIAL.test(host(r.url)), known: known.get(host(r.url)) || null, hits: [], pages: {} });
      if (!p.hits.some((h) => h.url === r.url && h.q === q)) p.hits.push({ q, url: r.url, title: r.title, snippet: r.snippet });
      if (r.raw && !p.pages[r.url]) p.pages[r.url] = trim(r.raw, 4000);
    }
  }
  const todo = Object.values(places).filter((p) => !p.social && !p.fetched);
  log(`fetch: ${todo.length} places to read (${Object.keys(places).length} total)`);
  let n = 0;
  const worker = async () => {
    while (todo.length) {
      const p = todo.shift();
      const first = p.hits[0].url;
      const home = CATALOG.test(host(first)) ? null : new URL(first).origin + "/";
      const urls = [home, ...p.hits.map((h) => h.url)].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i).slice(0, 3);
      for (const u of urls) {
        if (p.pages[u]) continue;
        const pg = await getPage(u);
        if (pg.ok) {
          p.pages[u] = trim(toText(pg.html), 4000);
          if (u === home) for (const l of firingLinks(pg.html, u)) if (!p.pages[l]) { const x = await getPage(l); if (x.ok) p.pages[l] = trim(toText(x.html), 3000); }
        }
      }
      p.fetched = true;
      if (++n % 10 === 0) { writeJson(f, places); log(`fetch: ${n} read`); }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  writeJson(f, places);
  return places;
}

// ---------- 4. judge (local Gemma via Ollama, no Claude) ----------
const SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" }, city: { type: "string" }, state: { type: "string" },
    decision: { type: "string", enum: ["qualifies", "unclear", "reject"] },
    access: { type: "string", enum: ["dated_events", "by_appointment", "ongoing_class_or_membership", "firing_service_or_rental", "none"] },
    firing_types: { type: "array", items: { type: "string", enum: ["raku", "wood", "soda", "salt", "pit_barrel_saggar", "gas_reduction", "other"] } },
    quote: { type: "string" },
    dates: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reason: { type: "string" },
  },
  required: ["name", "city", "state", "decision", "access", "firing_types", "quote", "dates", "confidence", "reason"],
};
const RULES = `You check whether a place lets members of the public take part in a ceramic kiln firing in ${CFG.name}.
QUALIFIES when the text shows the public can join or book a NON-electric firing (raku, horsehair raku, wood/anagama, soda, salt, pit/barrel/saggar, gas reduction) at a place located in ${CFG.name}: a dated workshop or firing event, a private firing booked by appointment, an ongoing class or studio membership that includes such firings, or a firing service open to outside potters.
A membership, class or studio rental that anyone can sign up for IS public access: do not reject a studio because firing happens through membership or classes.
REJECT: electric-only kilns; places outside ${CFG.name}; generic paint-your-own pottery; blogs, news, shops or directories that don't run firings; firings that ended before 2025; members-only with no way to join.
UNCLEAR: the text hints at such firings but you can't tell whether the public can take part, or where the place is.
"name": the studio, school or organization that runs the firing (if the page is a calendar or directory, the host named in the listing). "city": just the city name. "state": two-letter code.
"quote" must be copied word for word from the text: the single sentence that best proves your decision (empty string if none). "dates": any listed firing dates. Keep "reason" to one short sentence.`;
async function judgeOne(p) {
  const text = Object.entries(p.pages).map(([u, t]) => `--- ${u}\n${t}`).join("\n").slice(0, 9000);
  const snippets = p.hits.slice(0, 3).map((h) => `- ${h.title}: ${h.snippet}`).join("\n");
  const r = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: OLLAMA_MODEL, stream: false, format: SCHEMA, think: false,
      options: { temperature: 0, num_ctx: 8192 },
      messages: [{ role: "system", content: RULES }, { role: "user", content: `PLACE: ${p.key}\nSEARCH SNIPPETS:\n${snippets}\n\nPAGE TEXT:\n${text || "(no readable page text)"}` }],
    }),
    signal: AbortSignal.timeout(300000),
  });
  const d = await r.json();
  return JSON.parse(d.message.content);
}
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
async function stageJudge(places) {
  const todo = Object.values(places).filter((p) => !p.judged && !p.social && (Object.values(p.pages).some((t) => FIRE.test(t)) || p.hits.some((h) => FIRE.test(h.snippet))));
  for (const p of Object.values(places)) if (!p.judged && !p.social && !todo.includes(p)) p.judged = { decision: "reject", reason: "no firing words on any page", auto: true };
  // Places already known to be in another state never reach the judge.
  for (const p of [...todo]) if (p.known && !p.known.startsWith(`${ST}:`)) { p.judged = { decision: "reject", reason: `known place in ${p.known.split(":")[0]}`, auto: true }; todo.splice(todo.indexOf(p), 1); }
  log(`judge: ${todo.length} places for ${OLLAMA_MODEL}`);
  const f = path.join(CACHE, "places.json");
  let n = 0;
  for (const p of todo) {
    const t0 = Date.now();
    try {
      const j = await judgeOne(p);
      const hay = norm(Object.values(p.pages).join(" ") + " " + p.hits.map((h) => h.snippet).join(" "));
      j.quote_verified = !!j.quote && hay.includes(norm(j.quote));
      p.judged = j;
    } catch (e) { p.judged = { decision: "unclear", reason: `judge error: ${e.message}`, error: true }; }
    p.judged.secs = Math.round((Date.now() - t0) / 1000);
    writeJson(f, places);
    log(`judge ${++n}/${todo.length} ${p.key}: ${p.judged.decision} (${p.judged.secs}s)`);
  }
  return places;
}

// ---------- 5. report ----------
function stageReport(places) {
  const all = Object.values(places);
  // Gemma claims the state too readily; code requires the place's own text to name the state.
  const inState = new RegExp(`${CFG.name}|,\\s*${ST}\\b|\\b${ST}\\s+\\d{5}`);
  for (const p of all) if (p.judged) p.judged.state_on_page = inState.test(Object.values(p.pages).join(" ") + " " + p.hits.map((h) => h.title + " " + h.snippet).join(" "));
  // Evidence gate: only firing types the page's own words support; a quote naming no specific firing demotes to unclear.
  for (const p of all) if (p.judged?.decision === "qualifies") {
    const g = gate(p.judged, Object.values(p.pages).join(" ") + " " + p.hits.map((h) => h.snippet).join(" "));
    p.judged.supported_types = g.supported;
    if (g.decision !== "qualifies") { p.judged.decision = "unclear"; p.judged.reason = `${p.judged.reason || ""} [gate: ${g.why}]`.trim(); }
  }
  const ok = all.filter((p) => p.judged?.decision === "qualifies" && p.judged.quote_verified && p.judged.confidence !== "low" && p.judged.state_on_page && (p.judged.state || ST).toUpperCase() === ST);
  const unclear = all.filter((p) => p.judged && !ok.includes(p) && p.judged.decision !== "reject");
  const rej = all.filter((p) => p.judged?.decision === "reject");
  const social = all.filter((p) => p.social);
  const row = (p) => `| ${p.judged.name || p.key} | ${p.judged.city || "?"} | ${(p.judged.supported_types || p.judged.firing_types || []).join(", ")} | ${p.judged.access || ""} | ${p.known ? "on map" : "**new**"} | ${p.key} | "${(p.judged.quote || "").slice(0, 160)}" |`;
  const head = "| Place | City | Types | Access | Map | Site | Quote |\n|---|---|---|---|---|---|---|";
  const md = [
    `# ${CFG.name} discovery report (${new Date().toISOString().slice(0, 10)})`,
    "",
    `Searches: ${Object.keys(readJson(path.join(CACHE, "search.json"), {})).length} (Tavily). Places seen: ${all.length}. Judge: ${OLLAMA_MODEL} on this Mac. No Claude used.`,
    "",
    `## Qualifies (verified quote, ${ok.length})`, "", head, ...ok.map(row), "",
    `## Unclear: needs a second look (${unclear.length})`, "", head, ...unclear.map((p) => row(p) + ` ${p.judged.reason || ""}`), "",
    `## Social-only leads, not read (${social.length})`, "", ...social.map((p) => `- ${p.hits[0].title} — ${p.hits[0].url}`), "",
    `## Rejected (${rej.length})`, "", ...rej.map((p) => `- ${p.key}: ${p.judged.reason}`),
  ].join("\n");
  fs.writeFileSync(path.join(KM, "research", `${ST.toLowerCase()}-report.md`), md);
  // Compact list for the one Claude review pass: one line per place that isn't rejected.
  const line = (t, p) => [t, p.key.slice(0, 45), (p.judged.name || "").slice(0, 30), p.judged.city || "?", p.judged.state_on_page ? ST : "-", (p.judged.supported_types || p.judged.firing_types || []).join(","), p.judged.access, (p.judged.quote || "").replace(/\s+/g, " ").slice(0, 110)].join(" | ");
  fs.writeFileSync(path.join(CACHE, "review.txt"), [...ok.map((p) => line("Q", p)), ...unclear.map((p) => line("U", p))].join("\n"));
  writeJson(path.join(CACHE, "places.json"), places);
  writeJson(path.join(KM, "research", `${ST.toLowerCase()}-discovery.json`), { state: ST, searches: Object.keys(readJson(path.join(CACHE, "search.json"), {})), places: all.map(({ pages, ...p }) => p) });
  log(`report: ${ok.length} qualify, ${unclear.length} unclear, ${rej.length} rejected, ${social.length} social`);
}

// --rejudge=gas: send rejected places whose pages mention gas firing back to the judge (after a rules change).
if (process.argv.includes("--rejudge=gas")) {
  const f = path.join(CACHE, "places.json");
  const P = readJson(f, {});
  let n = 0;
  for (const p of Object.values(P)) if (p.judged?.decision === "reject" && !p.judged.auto && /cone ?10|reduction|gas kiln|gas-fired|gas fired/i.test(Object.values(p.pages).join(" "))) { delete p.judged; n++; }
  writeJson(f, P);
  log(`rejudge: ${n} gas places sent back to the judge`);
}
const search = !ONLY || ONLY === "search" ? await stageSearch() : readJson(path.join(CACHE, "search.json"), {});
let places = !ONLY || ONLY === "fetch" ? await stageFetch(search) : readJson(path.join(CACHE, "places.json"), {});
if (!ONLY || ONLY === "judge") places = await stageJudge(places);
if (!ONLY || ONLY === "report" || ONLY === "judge") stageReport(places);
