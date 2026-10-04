// Crawls each source in kiln-map/sources.json, asks Claude to pull out
// joinable firing opportunities, and writes one JSON file per opportunity to
// kiln-map/data/pending/. See kiln-map/DESIGN-firings.md ("Prototype").
//
//   npm run kiln:extract                 # all sources
//   npm run kiln:extract -- --only=cobb-mountain,laney-college
//   npm run kiln:extract -- --dry        # crawl + extract, write nothing
//   npm run kiln:extract -- --crawl-only # crawl and report readability; no API calls
//
// Reads ANTHROPIC_API_KEY from the environment or from .dev.vars.
// Safe to re-run: items whose id already exists in pending/, approved/ or
// rejected/ are skipped, except that a changed date sends the existing file
// back to pending/ for review.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
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
const TODAY = new Date().toISOString().slice(0, 10);

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

// ---------- fetching ----------

async function fetchPage(url) {
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
  for (const p of pages) {
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
            source_quote: { type: "string", description: "A short verbatim quote (under 300 characters) copied exactly from the page, containing the title and/or date." },
            confidence: { type: "number", description: "0 to 1" },
          },
          required: ["title", "host_org", "firing_type", "access_kind", "audience", "date_precision", "registration_status", "crew_needed", "source_url", "source_quote", "confidence"],
        },
      },
      notes: { type: "string", description: "One or two sentences on what the pages did or did not contain." },
      place_summary: { type: ["string", "null"], description: "Two plain sentences for potters about this place: what kilns it has and how outside potters get in (and where it announces firings, if stated). Only from the pages." },
    },
    required: ["opportunities", "notes", "place_summary"],
  },
};

function buildPrompt(source, pages) {
  let budget = MAX_CHARS_PER_SOURCE;
  const blocks = [];
  for (const p of pages) {
    if (!p.text) continue;
    const text = p.text.slice(0, budget);
    budget -= text.length;
    blocks.push(`<page url="${p.url}">\n${text}\n</page>`);
    if (budget <= 0) break;
  }
  return `Today is ${TODAY}. You are extracting ceramics firing opportunities in California for a public list aimed at studio potters who want to move beyond the studio electric kiln.

Source: ${source.org} (${source.city}, CA). Known firing types here: ${source.firing_types_guess.join(", ")}.

Record an opportunity for each of these, found in the pages below:
- a dated workshop, firing, class, or crew call that involves firing in a kiln or pit (wood, soda, salt, raku, pit/barrel/saggar, gas reduction), dated within the 12 months before today or any time after today;
- an ongoing way in: a firing membership, a class you can enroll in that uses these kilns, a residency, or a kiln rental / firing service.

Rules:
- Record each residency, membership or class ONCE, and list the kilns/firing types it includes in "includes" (do not make one item per firing type).
- For classes, give the term or session start and end dates if the pages state them.
- Set "audience" from the page: members-only firings, student-only classes, resident-only access, or open to the public. A residency's audience is "residents_only"; a college course's audience is "students".
- If a college or school says its ceramics courses use particular kilns (for example a soda or raku kiln), record ONE class_enrollment item for its ceramics courses, audience "students", with those kilns in "includes" and term dates if stated.
- Only record an event as a firing if that event's own description mentions firing, a kiln, or a pit. A venue that hosts firings at other times is not enough.
- If a workshop has no firing component (for example forming, altering or glazing only), skip it. Use firing_type "other" only for firing methods not in the list.
- "Sales ended" or "registration closed" means registration_status "closed", not "sold_out".
- Skip: wheel-throwing or handbuilding classes that don't say the work goes into a soda, wood, salt, raku or pit firing; degree and certificate program listings; gallery shows; social events that aren't firings; anything outside California. Never invent dates, prices or status: use null or "unknown" when the page does not say. "Sold out" or "waitlist" must appear on the page to be used. source_quote must be copied character-for-character from the page text. If nothing qualifies, return an empty list and explain in notes.

${blocks.join("\n\n") || "(no page text could be retrieved)"}`;
}

async function extract(source, pages) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal: AbortSignal.timeout(120000),
    headers: { "x-api-key": API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content: buildPrompt(source, pages) }],
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${JSON.stringify(body.error || body)}`);
  const use = body.content.find((c) => c.type === "tool_use");
  return { ...(use?.input || { opportunities: [], notes: "no tool output" }), usage: body.usage };
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

function findMatch(existing, item) {
  return existing.find(({ item: e }) =>
    e.id === item.id ||
    (e.source_id === item.source_id &&
      e.firing_type === item.firing_type &&
      // Same firing under a longer or shorter title: same start date, or overlapping titles.
      (jaccard(e.title, item.title) >= 0.5 || (e.start_date && e.start_date === item.start_date) || norm(item.title).includes(norm(e.title)) || norm(e.title).includes(norm(item.title))) &&
      (daysApart(e.start_date, item.start_date) <= 3 || (!e.start_date && !item.start_date)))
  );
}

function quoteVerified(quote, pages) {
  const q = squash(quote);
  if (q.length < 8) return false;
  return pages.some((p) => squash(p.text).includes(q));
}

function isPast(item) {
  const end = item.end_date || item.start_date;
  return Boolean(end) && end < TODAY;
}

// ---------- main ----------

async function main() {
  const { sources } = JSON.parse(readFileSync(join(ROOT, "sources.json"), "utf8"));
  const only = typeof args.only === "string" ? args.only.split(",") : null;
  const selected = sources.filter((s) => !only || only.includes(s.id));
  for (const folder of [...FOLDERS, "runs"]) mkdirSync(join(DATA, folder), { recursive: true });

  const existing = loadExisting();
  const run = { date: TODAY, started: new Date().toISOString(), model: MODEL, sources: [] };

  for (const source of selected) {
    const entry = { id: source.id, org: source.org, core: source.core, pages: [], found: 0, written: 0, updated: 0, skipped: 0, notes: "" };
    run.sources.push(entry);
    if (!source.urls.length) {
      entry.notes = "No website on file.";
      console.log(`- ${source.id}: no website on file`);
      continue;
    }
    process.stdout.write(`- ${source.id}: crawling… `);
    const pages = await crawlSource(source);
    entry.pages = pages.map((p) => ({ url: p.url, status: p.status, chars: p.text.length, jsOnly: p.jsOnly, error: p.error }));
    const usable = pages.filter((p) => p.text.length > 200);
    process.stdout.write(`${usable.length}/${pages.length} pages usable; extracting… `);
    if (!usable.length) {
      entry.notes = "No usable page text (blocked, down, or JavaScript-only).";
      console.log("nothing to read");
      continue;
    }
    if (args["crawl-only"]) {
      console.log(`\n${pages.map((p) => `    ${p.ok ? "ok " : "ERR"} ${String(p.status).padEnd(3)} ${String(p.text.length).padStart(6)} chars${p.jsOnly ? " (js-only?)" : ""}  ${p.url}`).join("\n")}`);
      continue;
    }

    let result;
    try {
      result = await extract(source, usable);
    } catch (err) {
      entry.notes = `Extraction failed: ${err.message}`;
      console.log(`extraction failed: ${err.message.slice(0, 300)}`);
      continue;
    }
    entry.notes = result.notes;
    entry.place_summary = result.place_summary || null;
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
      item.past = isPast(item);
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
          const fill = Object.fromEntries(["summary", "pay_text", "bring", "commitment", "kiln_style"].filter((k) => e[k] == null && item[k] != null).map((k) => [k, item[k]]));
          if (Object.keys(fill).length && !args.dry) writeFileSync(match.file, JSON.stringify({ ...e, ...fill }, null, 2) + "\n");
          entry.skipped++;
        }
        continue;
      }
      if (!args.dry) writeFileSync(join(DATA, "pending", `${item.id}.json`), JSON.stringify(item, null, 2) + "\n");
      existing.push({ folder: "pending", file: join(DATA, "pending", `${item.id}.json`), item });
      entry.written++;
    }
    console.log(`${entry.found} found, ${entry.written} new, ${entry.updated} changed, ${entry.skipped} unchanged`);
    if (args.dry) for (const o of result.opportunities) console.log(`    · ${o.firing_type} | ${o.access_kind} | ${o.audience} | ${o.start_date || "-"} | ${o.registration_status} | ${o.title}${o.includes?.length ? ` [${o.includes.join(", ")}]` : ""}`);
  }

  run.finished = new Date().toISOString();
  if (!args.dry && !args["crawl-only"]) writeFileSync(join(DATA, "runs", `${run.started.replace(/[:.]/g, "-")}.json`), JSON.stringify(run, null, 2) + "\n");
  console.log(`\nDone. Review kiln-map/data/pending/, then run: npm run kiln:count`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
