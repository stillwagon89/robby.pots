# How long kiln-map jobs are run (standing rules, from the 2026-10-07 overnight retrospective)

1. **Never idle while a job runs.** Before starting a long job, list every independent task and do them while it runs: verify finished
   units, spot-check samples, review weak/removed lists, test fixes, write notes, tidy docs. Ending a turn to "wait" is only right when
   nothing else is left.
2. **Pipeline per unit, not per batch.** Each state flows search → fetch → judge → ledger → promote → verify → geocode as soon as ITS
   previous step is done. Don't wait for the whole batch (the overnight run waited ~1h at the end for Alaska/Hawaii).
3. **Writers never clobber.** Any script that edits `sources/*.json` re-reads the file just before writing and merges by id
   (verify.mjs does). Geocode/build can then run any time.
4. **Spot-check before reporting counts.** After each wave open 8–10 random promoted places' pages, record the miss rate in
   `research/cache/spotcheck.md`, and stop the wave if it is above 10%.
5. **Add every bad case to `discover/gold.json`** and run `node kiln-map/discover/gate.test.mjs` before committing discovery code.
6. **Test the cheap thing first** on 1–2 units before launching a multi-hour run; patch, then launch once (the overnight run was
   restarted three times, losing ~40 minutes).
7. **Commit + hand over a plain status** at least every 2 hours of unattended work.

## Publishing guard (added 2026-10-08)
`npm run kiln:build` is the PUBLIC build: it leaves out every source with `review: "pending"` or `weak`. `npm run kiln:build:dev`
(= `KILN_DEV=1`) includes them for the dev map. The review branch commits the DEV build. **Before merging anything to main, run
`npm run kiln:build` and commit that firings.json**, so only approved places go live. Approve places with
`node kiln-map/discover/approve.mjs ST [--reject 3,7]` (numbers from REVIEW-SOLID.md).

## Visitor flags (added 2026-10-09)
"Is this listing wrong?" saves a flag and then asks the visitor for a reason (optional). `npm run kiln:flags` pulls them and runs
`flag-triage.mjs`: any flag puts the place/listing at the top of the review packet and in my re-check queue (`needs_recheck`);
3+ different visitors, or 2+ with a serious reason (closed, wrong date or address, not open...), sets `flag_hold` and the PUBLIC build
leaves it out until Robby clears it (`node kiln-map/discover/flag-clear.mjs <id>`). A single flag never removes anything. Flagged places are never auto-approved.

## Listing rules from Robby (2026-10-13)
- **Location vs firing.** A place can be listed (location) without any firing listing. A *firing* needs a specific date or a stated repeat schedule.
- **Residencies / long programs with no dated firing** = location only (the build already keeps `residency` items out of the firing schedule).
- **College / student-only classes** = location; any listing shows "Enrolled students only" (`audience: "students"`), never as open to the public.
- **Recurring firings** ("3rd Monday monthly", "first Saturday") are exact dates: store `recurs: {nth, weekday (1=Mon..7=Sun), months}`; build.mjs expands them into the next occurrences.
- **Open-house / drop-in firings** where visitors can bring their own bisque or pick a piece are firings AND locations.
- **Firing services for hire count** if they fire non-electric (raku, gas, wood, soda...). Electric-only services do not.
- **Full / sold-out firings are still listed**, with the existing "full" status (waitlist stays "waitlist").
- **Community kilns where you pay by volume and/or work a shift** (Lancaster-style) count as locations and firings.
- **Mobile / at-home services** (they bring the kiln) count. Location = their home-base address (town if no street is published); status "open" so they surface in searches.
- **Drop an item that names no firing type anywhere** (title, quote, description). Electric-only, online-only and kiln/equipment sales are not firings.
- **The "quote found on page" check is only a warning.** If the title or quote names the firing type and the source quote is on the page, the item is fine.
- **Past firings are never shown to Robby** (end date, or start date for one-day sessions, before today).

### How these rules run
`node kiln-map/triage.mjs --apply` (step in the weekly workflow, right after extract) applies all of the above: rejects, approves items at already-public places,
marks full, expands repeats. What is left in `data/pending/` is only real judgement calls plus items at places Robby hasn't approved yet.
`review.mjs` lists only the first group, most informative first. Spot-check ~10 triage approvals each run; if more than 1 in 10 is wrong, tighten the rule.

### Closed, full and members-only offerings (Robby, 2026-10-13/14)
- **Always a location.** A place that can fire non-electric but is open only to enrolled students, members or invitees, or whose class is full, still appears as a location.
- **Also a firing card when there is a term or date**, shown as **Closed to public** (students / members / invitation / residents only; the "who can join" line says which) or **Full**. They rank below every open, ongoing, opens-soon and waitlist listing, so they never crowd out what a visitor can actually join.
- **Location only (no firing card)** when it is undated and restricted: "occasional" member firings, undated residencies, members-only monthly raku with no date. The place's card carries the quote; `location_only: true` on the item does this.
- **Open-by-application** programs (residencies, wood-kiln groups) with a date are firings and locations; "By application" in the who-can-join line.
- **Specific seasonal dates** ("Winter 2026/27") are listed with the "Opens soon" status.
- **Group bookings on request** (no date) are not a firing; mention them in the place summary.
