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
