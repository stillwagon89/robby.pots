// Crawls each source in kiln-map/sources/<STATE>.json, asks Claude to pull out
// joinable firing opportunities, and writes one JSON file per opportunity to
// kiln-map/data/pending/. See kiln-map/DESIGN-firings.md ("Prototype").
//
//   npm run kiln:extract                 # all sources
//   npm run kiln:extract -- --only=cobb-mountain,laney-college
//   npm run kiln:extract -- --states=MT,CO     # only places in these states
//   npm run kiln:extract -- --dry        # crawl + extract, write nothing
//   npm run kiln:extract -- --crawl-only # crawl and report readability; no API calls
//
// Reads ANTHROPIC_API_KEY from the environment or from .dev.vars.
// Safe to re-run: items whose id already exists in pending/, approved/ or
// rejected/ are skipped, except that a changed date sends the existing file
// back to pending/ for review.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { namesType } from "./firing-words.mjs";
import { loadSources, todayIn, stateName } from "./sources.mjs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA = join(ROOT, "data");
const FOLDERS = ["pending", "approved", "rejected"];
const MODEL = "claude-haiku-4-5-20251001";
const FETCH_TIMEOUT_MS = 20000;
const MAX_SUBPAGES = 5;
const MAX_CHARS_PER_PAGE = 20000;
const MAX_CHARS_PER_SOURCE = 60000;
// Links worth following: firing/ceramics words score high; generic event words only count on the same site.
const STRONG_LINK = /kiln|firing|woodfire|wood-fire|soda|salt|raku|anagama|ceramic|clay|potter|pit-fir|pit fir/i;
const MEDIUM_LINK = /workshop|event|calendar|\bresiden|member/i;
const CATALOG_HOSTS = ["activecommunities.com", "civicrec.com", "eventbrite.com", "active.com", "ma.to"];
const TODAY = new Date().toISOString().slice(0, 10); // run date; each place's own "today" comes from todayIn(source.tz)

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

function loadApiKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  const devVars = join(ROOT, "..", ".dev.vars");
  if (existsSync(devVars)) {
    const m = readFileSync(devVars, "utf8").match(/^ANTHROPIC_API_KEY\s*=\s*"?([^"\n]+)"?/m);
    if (m) return m[1].trim();
  }
  console.error("Set ANTHROPIC_API_KEY or add it to .dev.vars.");
  process.exit(1);
}
const API_KEY = args["crawl-only"] ? null : loadApiKey();

// Optional settings from the environment or .dev.vars (the weekly GitHub run passes them as secrets).
function setting(name) {
  if (process.env[name]) return process.env[name];
  const devVars = join(ROOT, "..", ".dev.vars");
  const m = existsSync(devVars) && readFileSync(devVars, "utf8").match(new RegExp(`^${name}\\s*=\\s*"?([^"\\n]+)"?`, "m"));
  return m ? m[1].trim() : null;
}
const INBOX_URL = "https://flamingclay-kiln-inbox.robert-stillwagon.workers.dev/messages";
const INBOX_TOKEN = setting("KILN_INBOX_TOKEN");
const IG_TOKEN = setting("IG_ACCESS_TOKEN");
const IG_USER_ID = setting("IG_USER_ID");
const LOOKBACK_DAYS = 120;
const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();

// ---------- fetching ----------

// ---------- politeness: robots.txt and a pause between requests to the same site ----------

const BOT = "FlamingClayFiringsBot";
const MIN_GAP_MS = 1500;
const robotsCache = new Map(); // origin -> { rules: [{allow, path}], delay }
const lastHit = new Map(); // host -> time of last request

function parseRobots(text) {
  // Use the group for our bot if present, else "*". Longest matching rule wins; Allow wins ties.
  const groups = [];
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === "user-agent") {
      if (!current || current.rules.length || current.delay != null) groups.push((current = { agents: [], rules: [], delay: null }));
      current.agents.push(val.toLowerCase());
    } else if (current && (key === "allow" || key === "disallow")) {
      if (val) current.rules.push({ allow: key === "allow", path: val });
    } else if (current && key === "crawl-delay") current.delay = Number(val) || null;
  }
  return groups.find((g) => g.agents.some((a) => a !== "*" && BOT.toLowerCase().includes(a))) || groups.find((g) => g.agents.includes("*")) || { rules: [], delay: null };
}
const ruleMatches = (rule, path) => {
  const re = new RegExp("^" + rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
  return re.test(path);
};
async function robotsFor(origin) {
  if (robotsCache.has(origin)) return robotsCache.get(origin);
  let group = { rules: [], delay: null };
  try {
    const res = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": `${BOT}/0.1 (+https://flamingclay.com)` }, signal: AbortSignal.timeout(10000) });
    if (res.ok) group = parseRobots(await res.text());
  } catch {}
  robotsCache.set(origin, group);
  return group;
}
async function allowedByRobots(url) {
  const u = new URL(url);
  const { rules } = await robotsFor(u.origin);
  const path = u.pathname + u.search;
  const hits = rules.filter((r) => ruleMatches(r, path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return !hits.length || hits[0].allow;
}
async function pace(url) {
  const u = new URL(url);
  const { delay } = await robotsFor(u.origin);
  const gap = Math.max(MIN_GAP_MS, Math.min((delay || 0) * 1000, 10000));
  const wait = (lastHit.get(u.host) || 0) + gap - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(u.host, Date.now());
}

async function fetchPage(url) {
  try {
    if (!(await allowedByRobots(url))) return { url, status: 0, ok: false, html: "", error: "robots.txt asks bots not to read this page", robots: true };
    await pace(url);
  } catch {}
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 FlamingClayFiringsBot/0.1 (+https://flamingclay.com)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    const html = await res.text();
    return { url, status: res.status, ok: res.ok, html };
  } catch (err) {
    return { url, status: 0, ok: false, html: "", error: String(err.cause?.code || err.name || err) };
  }
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', ndash: "–", mdash: "—", hellip: "…" };

function htmlToText(html) {
  return html
    .replace(/<(script|style|noscript|svg|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#\d+|#x[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function candidateLinks(html, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try {
      u = new URL(m[1].replace(/&amp;/g, "&"), base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    const sameHost = u.hostname.replace(/^www\./, "") === base.hostname.replace(/^www\./, "");
    const catalog = CATALOG_HOSTS.some((h) => u.hostname.endsWith(h));
    if (!sameHost && !catalog) continue;
    if (/\.(jpe?g|png|gif|webp|pdf|zip|mp4)$/i.test(u.pathname)) continue;
    const label = htmlToText(m[2]);
    const hay = `${u.pathname} ${label}`;
    const score = STRONG_LINK.test(hay) ? 2 : sameHost && MEDIUM_LINK.test(hay) ? 1 : 0;
    if (!score) continue;
    u.hash = "";
    const key = u.toString();
    if (seen.has(key) || key === baseUrl) continue;
    seen.add(key);
    out.push({ key, score });
  }
  return out.sort((a, b) => b.score - a.score).map((l) => l.key);
}

const SIGNUP_LINK = /register|sign.?up|enrol|apply|ticket|buy|reserve|book|mato\.|eventbrite|active\.com|activecommunities|civicrec/i;
function signupLinks(html, baseUrl) {
  const out = new Map();
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, "&"), baseUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const label = htmlToText(m[2]).slice(0, 80);
    if (!SIGNUP_LINK.test(`${label} ${u.hostname}${u.pathname}`)) continue;
    if (!out.has(u.toString())) out.set(u.toString(), label);
  }
  return [...out].slice(0, 12).map(([url, label]) => ({ label, url }));
}

// Link that scrolls to and highlights the quoted text on the page (browser "text fragment"); harmless where unsupported.
function textFragmentUrl(url, quote) {
  const words = (quote || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length < 3) return url;
  const enc = (w) => encodeURIComponent(w.join(" ")).replace(/-/g, "%2D");
  const frag = words.length <= 8 ? enc(words) : `${enc(words.slice(0, 4))},${enc(words.slice(-4))}`;
  return `${url.split("#")[0]}#:~:text=${frag}`;
}

// Where a place posts updates: Instagram handles and newsletter sign-ups found in its pages (homepage included),
// saved to the run so `npm run kiln:signups` can list what Robby should follow or join.
const IG_SKIP = new Set(["p", "reel", "reels", "explore", "accounts", "stories", "tv", "sharer", "share"]);
const NEWSLETTER_HOST = /list-manage\.com|eepurl\.com|mailchi\.mp|constantcontact\.com|ccsend\.com|substack\.com|mailerlite|klaviyo|beehiiv|convertkit|kit\.com|flodesk|emailoctopus|buttondown|campaign-archive/i;
function findSignups(html, pageUrl) {
  const instagram = new Set();
  const newsletter = new Set();
  for (const m of html.matchAll(/href=["']([^"']+)["']/gi)) {
    let u;
    try { u = new URL(m[1].replace(/&amp;/g, "&"), pageUrl); } catch { continue; }
    if (/(^|\.)instagram\.com$/i.test(u.hostname)) {
      const h = u.pathname.split("/").filter(Boolean)[0];
      if (h && !IG_SKIP.has(h.toLowerCase()) && /^[A-Za-z0-9._]{2,30}$/.test(h)) instagram.add(h.toLowerCase());
    } else if (NEWSLETTER_HOST.test(u.hostname) || /newsletter|subscribe|mailing-list|e-news/i.test(u.pathname)) newsletter.add(u.toString());
  }
  // A sign-up form on the page itself (an email box near "newsletter"/"subscribe").
  if (!newsletter.size && /<form[\s\S]{0,3000}?type=["']email["']/i.test(html) && /newsletter|subscribe|mailing list|stay in touch|stay connected|sign up for (our )?(email|update|news)/i.test(html)) newsletter.add(`${pageUrl} (sign-up form on this page)`);
  return { instagram: [...instagram], newsletter: [...newsletter] };
}

async function crawlSource(source) {
  const pages = [];
  for (const url of source.urls) {
    const page = await fetchPage(url);
    pages.push(page);
    if (page.ok) {
      const links = candidateLinks(page.html, url).filter((l) => !source.urls.includes(l));
      for (const link of links.slice(0, MAX_SUBPAGES)) {
        if (pages.some((p) => p.url === link)) continue;
        pages.push(await fetchPage(link));
      }
    }
  }
  // Also read the homepage for sign-ups (newsletter forms and Instagram links usually live in its header or footer).
  const site = source.contact?.website || source.urls[0];
  if (site) {
    const home = new URL(site).origin + "/";
    if (!pages.some((p) => p.url === home)) {
      const h = await fetchPage(home);
      if (h.ok) pages.signupHome = findSignups(h.html, home);
    }
  }
  const ig = new Set(pages.signupHome?.instagram || []), nl = new Set(pages.signupHome?.newsletter || []);
  for (const p of pages) if (p.ok) { const f = findSignups(p.html, p.url); f.instagram.forEach((x) => ig.add(x)); f.newsletter.forEach((x) => nl.add(x)); }
  pages.signups = { instagram: [...ig], newsletter: [...nl].slice(0, 5) };
  for (const p of pages) {
    p.links = p.ok ? signupLinks(p.html, p.url) : [];
    p.text = p.ok ? htmlToText(p.html).slice(0, MAX_CHARS_PER_PAGE) : "";
    // A page that returns lots of HTML but almost no text is rendered by JavaScript.
    p.jsOnly = p.ok && p.html.length > 20000 && p.text.length < 400;
    delete p.html;
  }
  return pages;
}

// ---------- extraction ----------

const FIRING_TYPES = ["wood", "soda", "salt", "raku", "pit_barrel_saggar", "gas_reduction", "electric", "rental_service", "other"];

const TOOL = {
  name: "record_opportunities",
  description: "Record every firing opportunity found in the pages.",
  input_schema: {
    type: "object",
    properties: {
      opportunities: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            host_org: { type: "string", description: "The organization running the firing, not the page it was found on." },
            firing_type: { type: "string", enum: FIRING_TYPES },
            kiln_style: { type: ["string", "null"], description: "e.g. anagama, train, catenary, crossdraft, bourry box" },
            access_kind: { type: "string", enum: ["dated", "ongoing_membership", "class_enrollment", "residency", "rental_service"] },
            start_date: { type: ["string", "null"], description: "YYYY-MM-DD. For month/season precision, the first day of the period." },
            end_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
            date_precision: { type: "string", enum: ["exact", "month", "season", "none"] },
            signup_deadline: { type: ["string", "null"], description: "YYYY-MM-DD" },
            registration_status: { type: "string", enum: ["open", "sold_out", "waitlist", "closed", "not_yet_open", "unknown"], description: "closed = sign-ups ended (e.g. 'Sales ended') without saying sold out." },
            audience: { type: "string", enum: ["public", "members_only", "students", "residents_only", "invitation_only", "unknown"], description: "Who can take part, as stated on the page." },
            includes: { type: "array", items: { type: "string" }, description: "For memberships, residencies and classes: the kilns / firing types included, as stated on the page." },
            registration_opens: { type: ["string", "null"], description: "YYYY-MM-DD if stated" },
            cost_text: { type: ["string", "null"] },
            how_to_join: { type: ["string", "null"] },
            first_atmospheric_ok: { type: ["boolean", "null"], description: "True only if the page says no prior wood/soda/atmospheric experience is needed." },
            crew_needed: { type: "boolean", description: "True if the page asks for stokers, crew or volunteers." },
            hosts_groups: { type: ["boolean", "null"], description: "True if the page says outside groups or studios can arrange a firing." },
            pay_text: { type: ["string", "null"], description: "How participants pay, as stated: price, crew shifts, work trade, or both." },
            bring: { type: ["string", "null"], description: "What participants bring (e.g. bisqued pots, wadding), if stated." },
            commitment: { type: ["string", "null"], description: "Time commitment, e.g. 'Fri load · Sat fire · Mon unload' or '12 Thursdays', if stated." },
            summary: { type: ["string", "null"], description: "One or two plain sentences for a potter deciding whether to join, using only what the page says." },
            source_url: { type: "string", description: "The exact page URL the item was found on." },
            evidence_sentence: { type: "string", description: "One plain sentence (under 25 words) telling a potter how the page shows this includes this kind of firing, e.g. 'The workshops page lists it as a soda firing with Casey Beck.'" },
            evidence_quote: { type: "string", description: "A verbatim sentence or phrase copied exactly from the page that names the firing type or kiln (soda, wood, salt, raku, pit, gas, anagama, kiln...). Prefer this over a title-only quote." },
            signup_url: { type: ["string", "null"], description: "The URL where someone actually registers or enrolls for THIS item, copied exactly from the page's <links> list. Null if there is no specific one. Never a general homepage or department page." },
            source_quote: { type: "string", description: "A short verbatim quote (under 300 characters) copied exactly from the page, containing the title and/or date." },
            confidence: { type: "number", description: "0 to 1" },
          },
          required: ["title", "host_org", "firing_type", "access_kind", "audience", "date_precision", "registration_status", "crew_needed", "source_url", "source_quote", "evidence_sentence", "evidence_quote", "confidence"],
        },
      },
      notes: { type: "string", description: "One or two sentences on what the pages did or did not contain." },
      place_summary: { type: ["string", "null"], description: "At most two plain sentences, only about firing: which kilns or firing types this place has and how an outside potter can take part in them. Do NOT describe general classes, memberships, studio locations, or amenities unless that is the way into a firing." },
      firing_evidence: {
        type: "array",
        description: "One entry per firing type (wood, soda, salt, raku, pit_barrel_saggar, gas_reduction) that the pages show this place offers.",
        items: {
          type: "object",
          properties: {
            firing_type: { type: "string", enum: FIRING_TYPES },
            sentence: { type: "string", description: "One sentence (under 25 words) saying what the page says about this firing type here and how a potter takes part." },
            quote: { type: "string", description: "Verbatim text from the page that names this firing type or its kiln." },
          },
          required: ["firing_type", "sentence", "quote"],
        },
      },
    },
    required: ["opportunities", "notes", "place_summary", "firing_evidence"],
  },
};

function buildPrompt(source, pages) {
  let budget = MAX_CHARS_PER_SOURCE;
  const blocks = [];
  for (const p of pages) {
    if (!p.text) continue;
    const text = p.text.slice(0, budget);
    budget -= text.length;
    const links = p.links?.length ? `\n<links>\n${p.links.map((l) => `${l.label} | ${l.url}`).join("\n")}\n</links>` : "";
    blocks.push(`<page url="${p.url || `newsletter: ${p.label}`}">\n${text}${links}\n</page>`);
    if (budget <= 0) break;
  }
  return `Today is ${todayIn(source.tz)}. You are extracting ceramics firing opportunities in the United States for a public list aimed at studio potters who want to move beyond the studio electric kiln.

Source: ${source.org} (${source.city}, ${stateName(source.state)}). Known firing types here: ${source.firing_types_guess.join(", ")}.

Pages below may be website pages, newsletter emails, or Instagram posts. Record an opportunity for each of these, found in them:
- a dated workshop, firing, class, or crew call that involves firing in a kiln or pit (wood, soda, salt, raku, pit/barrel/saggar, gas reduction), dated within the 12 months before today or any time after today;
- an ongoing way in: a firing membership, a class you can enroll in that uses these kilns, a residency, or a kiln rental / firing service.

Rules:
- Record each residency, membership or class ONCE, and list the kilns/firing types it includes in "includes" (do not make one item per firing type).
- For classes, give the term or session start and end dates if the pages state them.
- Set "audience" from the page: members-only firings, student-only classes, resident-only access, or open to the public. A residency's audience is "residents_only"; a college course's audience is "students".
- If a college or school says its ceramics courses use particular kilns (for example a soda or raku kiln), record ONE class_enrollment item for its ceramics courses, audience "students", with those kilns in "includes" and term dates if stated.
- Only record an event as a firing if that event's own description mentions firing, a kiln, or a pit. A venue that hosts firings at other times is not enough.
- If a workshop has no firing component (for example forming, altering or glazing only), skip it. Use firing_type "other" only for firing methods not in the list.
- Every item and every firing_evidence entry must be backed by text on the pages: copy a verbatim quote that names the firing type or kiln. If you cannot quote text that shows a place offers that firing type, do not list it.
- Never repeat yourself. place_summary says only what is true of the place as a whole (which kilns or firing types, who runs them, the general way in). Each firing_evidence sentence gives only a fact specific to that firing type that place_summary does not already say; if it would just restate place_summary, make it a short note on where on the page the firing is mentioned.
- Write for a potter looking for a specific kind of firing. Say only what matters for taking part in that firing (kiln, dates, who can join, how to sign up). Leave out general class, membership and studio descriptions.
- signup_url must be copied from a <links> list and lead to registration for that item. If the only link is a general or department page, use null.
- Never infer a year. Use a date only if the page states it with its year, or the year is clear from the same listing (e.g. a dated calendar). If a listing gives weekdays or months but no year, set start_date and end_date to null and date_precision "none".
- "Sales ended" or "registration closed" means registration_status "closed", not "sold_out".
- A live "Register", "Register Now", "Sign up", "Enroll" or "Add to cart" button or link on a future-dated listing means registration_status "open". Use "unknown" only when the page gives no sign of whether you can sign up.
- Skip: wheel-throwing or handbuilding classes that don't say the work goes into a soda, wood, salt, raku or pit firing; degree and certificate program listings; gallery shows; social events that aren't firings; anything outside the United States. Never invent dates, prices or status: use null or "unknown" when the page does not say. "Sold out" or "waitlist" must appear on the page to be used. source_quote must be copied character-for-character from the page text. If nothing qualifies, return an empty list and explain in notes.

${blocks.join("\n\n") || "(no page text could be retrieved)"}`;
}

const API_HEADERS = () => ({ "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" });
const requestParams = (source, pages) => ({
  model: MODEL,
  max_tokens: 12000,
  tools: [TOOL],
  tool_choice: { type: "tool", name: TOOL.name },
  messages: [{ role: "user", content: buildPrompt(source, pages) }],
});
function parseMessage(body) {
  const use = body.content.find((c) => c.type === "tool_use");
  if (body.stop_reason === "max_tokens") throw new Error("output cut off (max_tokens)");
  return { opportunities: [], firing_evidence: [], ...(use?.input || { notes: "no tool output" }), usage: body.usage };
}

async function extract(source, pages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    headers: API_HEADERS(),
    body: JSON.stringify(requestParams(source, pages)),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(body.error || body)}`);
  return parseMessage(body);
}

// Message Batches API: half the price, results usually within the hour (up to 24 h). Used for runs of 3+ places;
// --no-batch forces one-at-a-time calls (quick local tests).
const BATCH_POLL_MS = 30000;
const BATCH_MAX_WAIT_MS = 5 * 3600 * 1000; // stay inside GitHub's 6-hour job limit
async function extractAll(jobs) {
  const out = new Map();
  if (!jobs.length) return out;
  if (args["no-batch"] || jobs.length < 3) {
    for (const j of jobs) {
      try { out.set(j.source.id, await extract(j.source, j.usable)); } catch (err) { out.set(j.source.id, { error: err.message }); }
    }
    return out;
  }
  const create = await fetch("https://api.anthropic.com/v1/messages/batches", {
    method: "POST",
    headers: API_HEADERS(),
    body: JSON.stringify({ requests: jobs.map((j) => ({ custom_id: j.source.id, params: requestParams(j.source, j.usable) })) }),
  });
  let batch = await create.json();
  if (!create.ok) throw new Error(`Batch create failed ${create.status}: ${JSON.stringify(batch.error || batch)}`);
  console.log(`Batch ${batch.id}: ${jobs.length} places submitted; waiting for results…`);
  const started = Date.now();
  while (batch.processing_status !== "ended") {
    if (Date.now() - started > BATCH_MAX_WAIT_MS) throw new Error(`Batch ${batch.id} still running after 5 hours`);
    await new Promise((r) => setTimeout(r, BATCH_POLL_MS));
    const res = await fetch(`https://api.anthropic.com/v1/messages/batches/${batch.id}`, { headers: API_HEADERS() });
    if (res.ok) batch = await res.json();
  }
  const results = await fetch(batch.results_url, { headers: API_HEADERS() });
  if (!results.ok) throw new Error(`Batch results failed ${results.status}`);
  // Results come back in any order; match them by custom_id (the source id).
  for (const line of (await results.text()).split("\n").filter(Boolean)) {
    const r = JSON.parse(line);
    if (r.result?.type === "succeeded") {
      try { out.set(r.custom_id, parseMessage(r.result.message)); } catch (err) { out.set(r.custom_id, { error: err.message }); }
    } else out.set(r.custom_id, { error: `batch ${r.result?.type}: ${JSON.stringify(r.result?.error || "")}` });
  }
  console.log(`Batch ${batch.id} done in ${Math.round((Date.now() - started) / 60000)} min.`);
  return out;
}

// ---------- ids, dedup, writing ----------

const norm = (s) => (s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const squash = (s) => norm(s).replace(/ /g, "");

function itemId(item) {
  const month = (item.start_date || "").slice(0, 7) || item.access_kind;
  return createHash("sha1").update(`${norm(item.title)}|${norm(item.host_org)}|${month}`).digest("hex").slice(0, 12);
}

function jaccard(a, b) {
  const A = new Set(norm(a).split(" ")), B = new Set(norm(b).split(" "));
  const inter = [...A].filter((x) => B.has(x)).length;
  return inter / (A.size + B.size - inter || 1);
}

function daysApart(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(new Date(a) - new Date(b)) / 86400000;
}

function loadExisting() {
  const items = [];
  for (const folder of FOLDERS) {
    const dir = join(DATA, folder);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      items.push({ folder, file: join(dir, f), item: JSON.parse(readFileSync(join(dir, f), "utf8")) });
    }
  }
  return items;
}

// ---------- newsletters and Instagram ----------

const baseDomain = (h) => (h || "").toLowerCase().replace(/^www\./, "").split(".").slice(-2).join(".");
function sourceDomains(source) {
  const hosts = [source.contact?.website, ...(source.urls || [])].filter(Boolean).map((u) => { try { return baseDomain(new URL(u).hostname); } catch { return null; } });
  return new Set([...hosts, ...(source.newsletter_from || []).map((x) => x.toLowerCase())].filter(Boolean));
}
// Which stored emails belong to this source: sender domain matches its website, or a sender listed in newsletter_from.
function emailMatches(source, msg) {
  const from = (msg.from || "").toLowerCase();
  const keys = sourceDomains(source);
  // Mail services often encode the sender's domain in the address (info-vergeart.com@shared1.ccsend.com).
  return keys.has(from) || keys.has(baseDomain(from.split("@")[1])) || [...keys].some((k) => k.includes(".") && from.includes(k)) || (source.contact?.email || "").toLowerCase() === from;
}
async function loadInbox() {
  if (!INBOX_TOKEN) return { messages: [], note: "Newsletter inbox not connected (no KILN_INBOX_TOKEN)." };
  try {
    const res = await fetch(`${INBOX_URL}?since=${encodeURIComponent(sinceIso)}`, { headers: { authorization: `Bearer ${INBOX_TOKEN}` }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    if (!res.ok) return { messages: [], note: `Newsletter inbox returned ${res.status}.` };
    return { messages: (await res.json()).messages || [], note: null };
  } catch (err) {
    return { messages: [], note: `Newsletter inbox unreachable: ${err.message}` };
  }
}
const emailPage = (m) => ({ url: m.web_url || null, label: `Newsletter email "${m.subject}" from ${m.from} (${(m.date || m.received || "").slice(0, 10)})`, status: 200, ok: true, links: [], text: `Subject: ${m.subject}\nDate: ${m.date}\n\n${m.text}`.slice(0, MAX_CHARS_PER_PAGE) });

// Instagram Business Discovery: reads recent public posts of Business/Creator accounts through Robby's own
// Instagram professional account. Needs IG_ACCESS_TOKEN and IG_USER_ID; see kiln-map/INSTAGRAM-SETUP.md.
async function instagramPages(handle) {
  if (!IG_TOKEN || !IG_USER_ID || !handle) return { pages: [], note: null };
  const fields = `business_discovery.username(${handle}){media.limit(25){caption,timestamp,permalink}}`;
  const url = `https://graph.facebook.com/${IG_USER_ID}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(IG_TOKEN)}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = await res.json();
    if (!res.ok) return { pages: [], note: `Instagram @${handle}: ${body.error?.message || res.status}` };
    const posts = (body.business_discovery?.media?.data || []).filter((m) => m.caption && m.timestamp >= sinceIso);
    return { pages: posts.map((m) => ({ url: m.permalink, label: `Instagram post by @${handle} (${m.timestamp.slice(0, 10)})`, status: 200, ok: true, links: [], text: `Instagram post by @${handle} on ${m.timestamp.slice(0, 10)}:\n${m.caption}` })), note: null };
  } catch (err) {
    return { pages: [], note: `Instagram @${handle}: ${err.message}` };
  }
}

// Link health for the host's main website (the link the site shows). Only "down" hides it, and only when the
// site gives no answer or a server error twice. Any 4xx can be bot filtering (some sites answer bots with 404),
// so the link stays and the review lists it as "unclear" for a human check. We never disguise the crawler.
async function checkWebsite(url, already) {
  let page = already || (await fetchPage(url));
  if (!page.ok && !page.robots && (page.status === 0 || page.status >= 500)) {
    await new Promise((r) => setTimeout(r, 3000));
    page = await fetchPage(url);
  }
  const status = page.ok ? "ok" : page.robots ? "unclear" : page.status === 0 || page.status >= 500 ? "down" : "unclear";
  return { checked: TODAY, url, status, http: page.status };
}

// Every word of the shorter title appears in the longer one ("Wood-Fire Residency" within "Wood-Fire Artist-in-Residence (1 year)").
const STOP = new Set(["the", "a", "an", "of", "in", "and", "for", "with", "at", "artist", "program"]);
const stem = (w) => w.replace(/^residence$/, "residency").replace(/s$/, "");
const titleWords = (t) => norm(t).replace(/\b20\d\d\b/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
function wordsWithin(shorter, longer) {
  const A = titleWords(shorter), B = new Set(titleWords(longer));
  return A.length > 0 && A.length <= B.size && A.every((w) => B.has(w));
}
const ONGOING = ["ongoing_membership", "class_enrollment", "residency", "rental_service"];
function findMatch(existing, item) {
  return existing.find(({ item: e }) => {
    if (e.id === item.id) return true;
    if (e.source_id !== item.source_id || e.firing_type !== item.firing_type) return false;
    // Ongoing access (classes, memberships, residencies) has no fixed date, and the AI words it differently each run,
    // so dates never tell two of them apart. A school's classes are one listing per firing type; memberships and
    // residencies match on title.
    if (ONGOING.includes(item.access_kind) && e.access_kind === item.access_kind) {
      return item.access_kind === "class_enrollment" || jaccard(e.title, item.title) >= 0.5 || wordsWithin(e.title, item.title) || wordsWithin(item.title, e.title);
    }
    // Same dated firing under a longer or shorter title: same start date, or overlapping titles, within 3 days.
    return (jaccard(e.title, item.title) >= 0.5 || (e.start_date && e.start_date === item.start_date) || norm(item.title).includes(norm(e.title)) || norm(e.title).includes(norm(item.title))) &&
      (daysApart(e.start_date, item.start_date) <= 3 || (!e.start_date && !item.start_date));
  });
}

function quoteVerified(quote, pages) {
  const q = squash(quote);
  if (q.length < 8) return false;
  return pages.some((p) => squash(p.text).includes(q));
}

function isPast(item, today) {
  const end = item.end_date || item.start_date;
  return Boolean(end) && end < today;
}

// ---------- main ----------

async function main() {
  const sources = loadSources();
  const only = typeof args.only === "string" ? args.only.split(",") : null;
  const states = typeof args.states === "string" ? args.states.toUpperCase().split(",") : null;
  const selected = sources.filter((s) => (!only || only.includes(s.id)) && (!states || states.includes(s.state)));
  for (const folder of [...FOLDERS, "runs"]) mkdirSync(join(DATA, folder), { recursive: true });

  const existing = loadExisting();
  const SIGNUPS_FILE = join(DATA, "signups.json");
  const signups = existsSync(SIGNUPS_FILE) ? JSON.parse(readFileSync(SIGNUPS_FILE, "utf8")) : {};
  const HEALTH_FILE = join(DATA, "link-health.json");
  const health = existsSync(HEALTH_FILE) ? JSON.parse(readFileSync(HEALTH_FILE, "utf8")) : {};
  const run = { date: TODAY, started: new Date().toISOString(), model: MODEL, sources: [] };
  const inbox = await loadInbox();
  if (inbox.note) console.log(inbox.note);
  run.inbox_note = inbox.note;
  const usedEmails = new Set();
  const jobs = [];

  for (const source of selected) {
    const entry = { id: source.id, org: source.org, core: source.core, pages: [], found: 0, written: 0, updated: 0, skipped: 0, notes: "" };
    run.sources.push(entry);
    process.stdout.write(`- ${source.id}: `);
    const pages = source.urls.length ? await crawlSource(source) : [];
    entry.signups = pages.signups || { instagram: [], newsletter: [] };
    if (pages.signups) signups[source.id] = { checked: TODAY, ...pages.signups };
    const site = source.contact?.website || source.urls[0];
    if (site) health[source.id] = await checkWebsite(site, pages.find((p) => p.url === site));
    const emails = inbox.messages.filter((m) => emailMatches(source, m));
    emails.forEach((m) => usedEmails.add(m));
    const ig = await instagramPages(source.contact?.instagram);
    if (ig.note) entry.instagram_note = ig.note;
    pages.push(...emails.map(emailPage), ...ig.pages);
    entry.pages = pages.map((p) => ({ url: p.url, label: p.label, status: p.status, chars: p.text.length, jsOnly: p.jsOnly, error: p.error }));
    entry.emails = emails.length;
    entry.instagram_posts = ig.pages.length;
    if (!pages.length) {
      entry.notes = "No website, newsletter or Instagram posts on file.";
      console.log("nothing on file");
      continue;
    }
    const usable = pages.filter((p) => p.text.length > 200);
    process.stdout.write(`${usable.length}/${pages.length} pages usable; `);
    if (!usable.length) {
      entry.notes = "No usable page text (blocked, down, or JavaScript-only).";
      console.log("nothing to read");
      continue;
    }
    if (args["crawl-only"]) {
      console.log(`\n${pages.map((p) => `    ${p.ok ? "ok " : "ERR"} ${String(p.status).padEnd(3)} ${String(p.text.length).padStart(6)} chars${p.jsOnly ? " (js-only?)" : ""}  ${p.url}`).join("\n")}`);
      continue;
    }

    jobs.push({ source, entry, usable });
    console.log("queued");
  }

  // Extraction for every place at once (Batch API), then each place's results are checked and filed.
  const results = await extractAll(jobs);
  for (const { source, entry, usable } of jobs) {
    const result = results.get(source.id);
    if (!result || result.error) {
      entry.notes = `Extraction failed: ${result?.error || "no result returned"}`;
      console.log(`- ${source.id}: extraction failed: ${entry.notes.slice(0, 300)}`);
      continue;
    }
    entry.notes = result.notes;
    entry.place_summary = result.place_summary || null;
    const pageHolding = (quote) => usable.find((p) => quote && squash(quote).length >= 8 && squash(p.text).includes(squash(quote)));
    const allLinks = new Set(usable.flatMap((p) => p.links.map((l) => l.url)));
    entry.firing_evidence = (result.firing_evidence || []).map((f) => {
      const page = namesType(f.firing_type, f.quote) && pageHolding(f.quote);
      return page ? { firing_type: f.firing_type, sentence: f.sentence, quote: f.quote, url: page.url ? textFragmentUrl(page.url, f.quote) : null, via: page.label || null } : null;
    }).filter(Boolean);
    entry.usage = result.usage;
    entry.found = result.opportunities.length;

    for (const raw of result.opportunities) {
      const item = {
        ...raw,
        source_id: source.id,
        past: false,
        quote_verified: quoteVerified(raw.source_quote, usable),
        checked: TODAY,
      };
      const evPage = pageHolding(raw.evidence_quote) || pageHolding(raw.source_quote);
      item.evidence_url = evPage?.url ? textFragmentUrl(evPage.url, pageHolding(raw.evidence_quote) ? raw.evidence_quote : raw.source_quote) : null;
      item.evidence_via = evPage?.label || null;
      if (!/^https?:/.test(item.source_url || "")) item.source_url = evPage?.url || source.contact?.website || null;
      // Verified = the quote is on the page AND it names the firing type (not just a title the AI interpreted).
      item.evidence_verified = Boolean(pageHolding(raw.evidence_quote)) && namesType(raw.firing_type, raw.evidence_quote);
      item.signup_url = raw.signup_url && allLinks.has(raw.signup_url) ? raw.signup_url : null;
      // "includes" entries (kilns/firing types in a membership, class or residency) must appear in the crawled text.
      if (Array.isArray(item.includes)) {
        const all = usable.map((p) => p.text).join("\n");
        item.includes = item.includes.filter((x) => { const key = (x.match(/wood|soda|salt|raku|pit|barrel|saggar|anagama|train|catenary|gas|electric|reduction/i) || [x])[0]; return new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(all); });
      }
      // A date's year must be written on a crawled page; the AI has added years the page never states.
      const yr = (item.start_date || "").slice(0, 4);
      item.year_on_page = !yr || usable.some((p) => p.text.includes(yr));
      item.past = isPast(item, todayIn(source.tz));
      item.id = itemId(item);
      item._original = { ...raw };

      const match = findMatch(existing, item);
      if (match) {
        const e = match.item;
        // A blank value in a new extraction never overrides a date Robby filled in by hand.
        // Filling a blank isn't a change, and a blank never overrides an existing value.
        const same = (k) => (e[k] ?? null) === null || (item[k] ?? null) === null || e[k] === item[k];
        // A rejected item only comes back if its dates change; an edited approved item keeps Robby's edits.
        const changed = !same("start_date") || !same("end_date") || (match.folder !== "rejected" && !same("registration_status") && !e.reviewed);
        if (changed) {
          // Something changed: keep the reviewed fields, update the facts, and send it back for review.
          const updated = { ...e, start_date: item.start_date ?? e.start_date, end_date: item.end_date ?? e.end_date, registration_status: item.registration_status, past: item.past, checked: TODAY, changed_from: { start_date: e.start_date, end_date: e.end_date, registration_status: e.registration_status } };
          if (!args.dry) {
            writeFileSync(match.file, JSON.stringify(updated, null, 2) + "\n");
            if (match.folder !== "pending") renameSync(match.file, join(DATA, "pending", `${e.id}.json`));
          }
          entry.updated++;
        } else {
          // Nothing reviewable changed. Fill in descriptive fields an earlier run didn't collect.
          const fill = Object.fromEntries(["summary", "pay_text", "bring", "commitment", "kiln_style", "evidence_sentence", "evidence_quote", "evidence_url", "signup_url"].filter((k) => e[k] == null && item[k] != null).map((k) => [k, item[k]]));
          if (Object.keys(fill).length && !args.dry) writeFileSync(match.file, JSON.stringify({ ...e, ...fill }, null, 2) + "\n");
          entry.skipped++;
        }
        continue;
      }
      // New items only (listings already reviewed are never dropped): no firing shown, no listing: the evidence quote must name the firing type (for "other", a firing or kiln).
      if (!namesType(item.firing_type, raw.evidence_quote) && !namesType(item.firing_type, raw.source_quote)) {
        (entry.dropped ||= []).push({ title: item.title, reason: "evidence does not show a firing", quote: raw.evidence_quote });
        continue;
      }
      if (!args.dry) writeFileSync(join(DATA, "pending", `${item.id}.json`), JSON.stringify(item, null, 2) + "\n");
      existing.push({ folder: "pending", file: join(DATA, "pending", `${item.id}.json`), item });
      entry.written++;
    }
    console.log(`- ${source.id}: ${entry.found} found, ${entry.written} new, ${entry.updated} changed, ${entry.skipped} unchanged`);
    if (args.dry) for (const o of result.opportunities) console.log(`    · ${o.firing_type} | ${o.access_kind} | ${o.audience} | ${o.start_date || "-"} | ${o.registration_status} | ${o.title}${o.includes?.length ? ` [${o.includes.join(", ")}]` : ""}`);
  }

  // Unmatched means no place anywhere claims the sender (not just the places in this run).
  run.unmatched_emails = inbox.messages.filter((m) => !sources.some((src) => emailMatches(src, m))).map((m) => ({ from: m.from, subject: m.subject, date: m.date }));
  run.finished = new Date().toISOString();
  if (!args.dry) writeFileSync(HEALTH_FILE, JSON.stringify(health, null, 2) + "\n");
  if (!args.dry) writeFileSync(SIGNUPS_FILE, JSON.stringify(signups, null, 2) + "\n");
  if (!args.dry && !args["crawl-only"]) writeFileSync(join(DATA, "runs", `${run.started.replace(/[:.]/g, "-")}.json`), JSON.stringify(run, null, 2) + "\n");
  console.log(`\nDone. Review kiln-map/data/pending/, then run: npm run kiln:count`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
