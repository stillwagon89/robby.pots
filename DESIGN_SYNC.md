# Design Sync Log

Tracks which tool last touched the design/site so Claude Code and Claude Design
don't silently drift out of sync. **Check the top entry before starting new work
in either tool.**

**Claude Design canvas:** https://claude.ai/design/p/805a6fe9-b41f-46a3-818b-7bc737d271ff

## How this works

- **Claude Code** updates this file automatically at the end of any session that
  changes `site/`, `DESIGN.md`, or `styles.css`.
- **Claude Design** has no automatic hook into this repo — when you make changes
  there, tell Claude Code (or hand over a fresh export) and it will log the entry
  and pull the changes in. Until that happens, this log will not reflect Claude
  Design work in progress.
- Before starting new work in Claude Design, check the top entry here — if it
  says Claude Code made the last change, re-export or re-sync the canvas first
  so you're not editing a stale version.
- Before starting new work in Claude Code, ask "has anything changed in Claude
  Design since the last entry?" if it's been a while.

## Log

| Date | Source | What changed | Committed? |
|---|---|---|---|
| 2026-08-30 | Claude Design | v2 handoff exported (white/cobalt "qinghua" palette, torn-paper frames, residency globe, mobile header) — see `_design_export/` | N/A (design file, not code) |
| 2026-08-30 | Claude Code | Implemented v2 design system into `site/` (index, gallery, contact, ask pages, styles.css). Fixed 2 CSS bugs found during testing (invisible progress pills, clobbered container padding). Deployed to robbypots.com. | Yes — `c2a8ade` |

<!-- Add new entries above this line, newest first -->
