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
