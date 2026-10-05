# Kiln Locator: expanding from California to the whole US

Written 2026-10-05. Status: plan, nothing built yet. Companion to `DESIGN-firings.md`.

## Where we are (the baseline this plan scales from)

| | California today |
|---|---|
| Places | 16 (hand-researched), 22 live listings |
| Crawl | 1 weekly GitHub run, sources one at a time, ~3 minutes |
| AI cost | ~13.7k input + 1.4k output tokens per place per run on Claude Haiku 4.5 ($1 / $5 per million) ≈ **$0.02 per place per week** |
| Review | Robby, ~15 minutes a week, every new item by hand |
| Page data | one `firings.json`, ~4 KB per place (63 KB total), whole file loads in the browser |
| Sources | websites (16), newsletters (8 sign-ups), Instagram (5 handles) |

## What changes at national scale

A rough size for the US: the Simon Levin wood-kiln map has 209 pins worldwide and the Flash & Ash directory
85 kilns, both mostly wood. Adding soda/salt/raku/pit programs at art centers, colleges and studios, a
realistic US source list is **600–1,500 places**, 40–90× California. Everything that worked because
California is small has to change.

### 1. Finding the places (the biggest new problem)
California's 16 places were researched by hand. Nobody can hand-research 1,000. Discovery has to become a
pipeline: **find candidates → check they really offer joinable firings → Robby approves the source**.
- **Seed lists:** the Levin map (KML export), the Flash & Ash directory, national craft schools with
  atmospheric kilns (e.g. Penland, Arrowmont, Haystack, Anderson Ranch, Watershed, Archie Bray, Peters
  Valley, Touchstone), state and regional potters' guilds, college ceramics programs, community art centers.
- **AI-assisted search, state by state:** for each state, search for "wood firing workshop", "soda kiln
  rental", "raku night", "anagama crew", etc., and add new places as *candidates* only.
- **Visitor and kiln-owner submissions** (the planned submit form with bot protection): needed at this
  scale, because the people who run small kilns are the best source.
- **Candidate check:** crawl the candidate once; keep it only if a verbatim quote names a firing type
  (the same evidence rule as listings). Robby approves sources in batches ("approve all 40 Oregon
  candidates except 3, 9").

### 2. Robby's review time (the hard limit)
California produces ~5–10 review items a week. The US would produce 200–500, far beyond 15 minutes. So
**most items must be approved automatically**, and Robby reviews only what's risky:
- **Auto-apply:** blank details filled in (prices, what to bring), past firings removed, dead links hidden.
  These already happen without review.
- **Auto-approve new listings only when every check passes:** the source is already approved, the quote
  is verified on the page *and* names the firing type, any date includes a year that's on the page, the
  sign-up status is stated, and it isn't a near-duplicate.
- **Human review:** new sources, changed dates or status on approved listings, anything failing a check,
  low AI confidence.
- **Spot checks:** 10 random auto-approved items a week go into Robby's list, to keep measuring
  accuracy. Auto-approval turns on only after **95% of 50 sampled items** are right (the gate already in
  `DESIGN-firings.md`), and switches off per source if its error rate rises.
- **Later, if needed:** trusted regional reviewers (volunteers) with the same numbered-list flow.

### 3. Crawl size, time and cost
- **Time:** ~11 s per place one at a time → 1,000 places ≈ 3 hours, inside GitHub's 6-hour job limit but
  fragile. Split the run into parallel jobs by region, and check places on a **freshness schedule**:
  weekly for places with upcoming or changing dates, monthly for places that rarely change.
- **Cost (Haiku 4.5, at today's token use):**

  | Places | Weekly, standard | Monthly, standard | Monthly with Batch API (50% off) |
  |---|---|---|---|
  | 16 (today) | $0.33 | ~$1.40 | ~$0.70 |
  | 600 | $12.60 | ~$55 | ~$27 |
  | 1,500 | $31.50 | ~$135 | ~$68 |

  Discovery searches add a one-time cost per state. The freshness schedule cuts these numbers roughly in
  half. Extraction isn't urgent, so it can move to the **Message Batches API** (50% off, results within 24
  hours).
- **Instagram:** Meta limits how many calls an app can make per hour. ~500 handles a week must be spread
  out across the run. Check Meta's current limits before Phase 3.
- **Newsletters:** signing up hundreds of times is real work. Prioritize places that announce dates
  *only* by email; the matching rules already handle mail services.

### 4. Being a good citizen at scale
- **Respect robots.txt**, which the crawler doesn't check today. Limit requests per host, keep the
  honest bot name, and never get around blocks.
- **Private kilns:** keep pinning them at the town, never the property.
- **Opt-out:** a clear "remove my kiln" path, since we'll list people who never asked to be listed.

### 5. Data and code that assume California (all need changing)
- **The AI's instructions** say "California" and "(city, CA)", and tell it to skip anything outside
  California (`extract.mjs`).
- **The "Near" search** adds ", California" to every place typed (`firings.js`).
- **The map** opens zoomed to California and builds addresses with ", CA" (`firings.js`).
- **Page text** reads "starting in California" (`firings.html`, `tools.html`).
- **`sources.json`** is one file with no state field. Split it per state (`kiln-map/sources/OR.json`, ...)
  and add `state`.
- **Dates:** firings across 6 time zones. Store dates as written and show the place's local date. A
  "today" cutoff should use the place's time zone.

### 6. The page at 1,000 places
- **Data:** at ~4 KB per place, one file would be ~4 MB. That's too slow on phones. Split it into a small
  **index** (name, type, status, position, about 300 bytes a place) loaded first, plus **per-state
  detail** files loaded when a card opens.
- **Map:** group nearby pins into numbered clusters when zoomed out (Leaflet's marker-cluster plugin).
  Open at the visitor's area when they share location, otherwise the whole US with "Near" prominent.
- **List:** add a **state filter**. Distance sorting matters more than "soonest" nationally, so make
  Near + distance the default once a location is set. Load more cards as you scroll instead of
  rendering 1,000 at once.

### 7. Quality tracking per source
Track accuracy per source: approved unchanged / edited / rejected. Noisy sources get
review-only status; reliable ones earn auto-approval. The weekly review shows the five
worst sources so Robby can fix or drop them.

## Execution plan

Each phase has a gate. The next phase starts only when the gate is met. Robby's time per phase is
listed, because his time is the scarcest resource.

### Phase 0: Remove the California assumptions (about 1 week of building; ~30 min of Robby's time)
- Make the state a setting in the AI instructions, the "Near" search, map bounds, addresses and page text.
- Split `sources.json` by state and add `state` and a time zone per place.
- Add robots.txt checks and per-host rate limits. Move extraction to the Batch API.
- Store per-source accuracy history.
- **Gate:** a California run gives the same listings as before (no regressions), and cost per place is
  down by about half.

### Phase 1: Pilot two regions (3–4 weeks; ~30 min/week for Robby)
Pick two strong atmospheric-firing scenes, e.g. the **Pacific Northwest (OR, WA)** and **North
Carolina** (Seagrove and the Penland area).
- Build the discovery pipeline: seed lists, AI search by state, candidate check, batch source approval.
- Run the weekly crawl on the pilot states with today's manual review, to measure real volumes.
- **Gate:** review stays under 30 min/week for three states, and accuracy is at least 80% items
  approved unchanged.

### Phase 2: Auto-approval with spot checks (2–3 weeks; ~15 min/week)
- Turn on auto-apply and the strict auto-approve rules, plus 10 sampled spot checks a week.
- Show auto-approved items on the site with "checked automatically" in the evidence box.
- **Gate:** at least 95% of 50 sampled auto-approvals are correct. Review time back under 15 min/week.

### Phase 3: Make the page national (1–2 weeks; review designs only)
- Split the data into an index plus per-state detail. Add map clustering, the state filter and
  distance-first sorting near you. Open the map on the visitor's area.
- Update the page text ("starting in California" goes away), map bounds, and the Toolkit card.
- **Gate:** the page loads in under 2 s on a phone with 1,000 test places.

### Phase 4: Roll out region by region (about 2 weeks per region; ~15 min/week plus batch source approvals)
West → Southwest and Mountain → Midwest → South → Mid-Atlantic and Northeast → Alaska and Hawaii.
For each region: run discovery, approve sources in batches, sign up for its key newsletters, add Instagram
handles, then turn on its crawl.
- **Gate per region:** the same accuracy and review-time gates hold with the new region added.

### Phase 5: Let kilns list themselves
- A submit and "remove my kiln" form, with bot protection, going into the same review queue.
- Optional email alerts for visitors (the earlier "Phase 2" idea: a separate Worker, never reusing the
  waitlist storage).

## Decisions for Robby
1. **Pilot regions:** Pacific Northwest and North Carolina, or others you know better?
2. **Monthly budget ceiling** for AI and hosting (estimate: $30–70/month at full US scale with the Batch API).
3. **Auto-approval:** are you comfortable with listings going live without your review once the 95% gate is met?
4. **Help:** do you know potters in other regions who'd review their area's list?
5. **Scope:** keep it to joinable firings (wood, soda, salt, raku, pit, gas), or also kiln rentals and firing services?
