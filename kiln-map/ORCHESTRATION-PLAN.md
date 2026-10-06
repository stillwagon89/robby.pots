# Kiln Locator: state-by-state research orchestration (v3, fits the Pro plan)

**Goal:** every state researched to California depth (`research/ca-firings-ledger.md`) inside Robby's Claude
Pro allowance, with no extra API spend.

**Why this exists (2026-10-05):** the "nationwide" round never searched most states. Florida got one place,
and Atlantic Pottery Supply (Orange Park, FL: private raku firings by appointment) turned up in one Google
search and was never seen. Places you can book any time count as much as dated events.

## What v1 taught us (California benchmark, 3 runs)

| Run | Agents | Tokens processed | Result |
|---|---|---|---|
| 1 | 25 | ~30M | 7 of 16 known places |
| 2 | 47 | ~56M | 10 of 16; 35 places qualify, many new |
| 3 | 147 (61 failed) | ~76M | hit the 5-hour limit mid-run |

- **95% of tokens were agents re-reading their own context** on every tool call (instructions, tools, every
  page fetched so far). ~290k tokens to check one place, ~115k to run one search.
- **Search depth decides recall:** standard search never showed Cobb Mountain; extended search found it first try.
- **Most of the search grid was wasted** (run 2, 136 searches): only "workshop" searches (5), city searches
  (4) and named places/seeds (6) found qualifying places nothing else found. "Class", "community firing",
  "private firing" and "by appointment" searches found 0 unique places. 66 of 136 searches found nothing useful.

## v3 design: few turns, small contexts, code does everything mechanical

| Step | Who | How it stays cheap |
|---|---|---|
| 1. Search list | Code | Pruned grid, ~45 per big state, ~25 per small: 10 firing types × "workshop" (extended), 3 searches per main city, 6 specials (supply store raku, guild wood firing, community college kiln, anagama crew, raku party, residency). |
| 2. Search | **Haiku** agents, 10 searches each | All 10 searches in **one turn as parallel calls**, then one answer. 2 turns instead of 10+. Returns URL, name, city, one-line reason. |
| 3. Dedupe | Code | By website; skip places already on the map, rejected, or checked within 30 days. |
| 4. Fetch and trim | Code (`discover/fetch.mjs`, existing crawler rules) | Homepage plus up to 4 linked pages whose links mention firing words; keep only paragraphs near firing words; ~1.5k tokens per place. No agent ever reads a raw page. |
| 5. Judge | **Haiku** agents, 10 places each, **no tools** | Trimmed text goes in the prompt; one turn, structured answer (decision, access kind, verbatim quote, dated items, named places). |
| 6. Second look | **Sonnet**, same no-tools format | Only unclear, low-confidence, and by-appointment vs rental cases. |
| 7. Named places + recall test | Code + one Haiku search agent | Names from articles become targeted searches; 8 potter-style searches ("florida raku firings") must hit only places already seen. |
| 8. Unreadable sites | **Sonnet** agent with tools | Only sites code can't read (JavaScript-only, blocked). Cap 6 per state. |
| 9. Verify | Code | Quote is on the page, year is on the page, links work, geocode. |
| 10. Review | **Opus**, in a fresh, short session | Reads a code-built one-page state report. |

Estimated per big state: ~10 small agents and ~1M tokens processed, against ~56M in run 2. Small states
about half that. These are estimates until Florida is measured.

## Working inside the allowance
- **Measure, don't guess:** read plan usage before and after every state; the Florida pilot sets the real
  cost per state.
- **Reserve:** stop research at 90% weekly so Robby keeps room for other work.
- **Run in a fresh session:** the coordinating session reloads its whole context on every turn. A new
  session that reads this plan and the state report costs a fraction of a long one.
- **Cache everything:** search results, fetched pages and decisions are saved under `research/cache/`, so a
  rerun only redoes what changed (the California rescore reuses v1's cached results).

## Schedule
**Now until the weekly reset (16% left):**
1. Build `discover/` (search list, dedupe, fetch and trim, report) and test it on cached California data
   (~1–2%).
2. California rescore: judge v1's cached candidates with the new no-tools judges. Target 14 of 16 (~1%).
3. Florida pilot: must find Atlantic Pottery Supply blind; measure exact usage (~1–2%).
4. If Florida costs what's estimated, run as many top-priority states as fit before 90%: Texas, New York,
   North Carolina, Pennsylvania, Georgia, Ohio, Michigan, Washington, Oregon, Colorado.

**Each week after the reset:** a fixed share of the weekly allowance (set after Florida, likely 20–30%),
working down the priority list (most potters and most single-place states first). Robby reviews each state's
borderline list; high-confidence places with verified quotes are auto-approved.

## Outputs per state
- `research/<state>-ledger.md` in California format.
- `research/<state>-discovery.json`: every search, every URL seen, and what happened to it.
