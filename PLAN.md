# Plan: Robby Pots — Ceramics Portfolio & Commerce Site

## Goal (as stated by user)

Build a high-quality portfolio for Robby's ceramics work that shows best-in-class
design principles, and eventually allows someone to:
- Purchase ceramics
- Get in contact with Robby / get his information
- View videos and photos related to his ceramics work

**First stage purpose:** get to a point where ceramics can eventually be sold,
but build the website by hand (custom HTML/CSS/JS, deployed via Cloudflare
Pages) rather than using a platform like Squarespace.

## Current State

- Static site at `robbypots.com`, deployed on Cloudflare Pages (project: `robbypots`)
- Single `index.html` page: hero header, 3-image gallery, commission inquiry
  form (Formspree placeholder, not wired to a real endpoint), footer
- Images: 2 clean studio product shots (speckled green mugs) + 1 real-world
  lifestyle shot (textured cup with coffee)
- No purchasing flow, no video support, no multi-page structure, no design
  system, no real form backend, no photo/video management workflow for Robby
  to self-serve new content

## Rough Direction

1. Establish a design system (type, color, spacing, grid) that reads as
   professional/gallery-quality, not template-y
2. Expand beyond a single page: home/gallery, individual piece detail,
   about/contact, (later) shop
3. Wire the contact/commission form to a real backend
4. Support video alongside photos (process videos, throwing demos, etc.)
5. Lay groundwork for commerce (product data model, cart/checkout) without
   necessarily building full checkout in stage one — stage one is portfolio +
   contact; commerce is the stated end goal, not immediate scope
6. Keep the whole thing hand-built and deployed via Cloudflare Pages, no
   Squarespace/Shopify/Wix

## Premises (confirmed with Robby)

1. Hand-built site (own HTML/CSS/JS on Cloudflare Pages), not a page-builder platform.
2. Stage one = portfolio + contact/commission. Commerce is the end goal, not immediate scope.
3. Robby needs to add new photos/videos himself over time, without hand-editing HTML each time.

---

# CEO Review (Strategy & Scope)

Note: run with Claude reasoning only — `codex` CLI is not installed on this
machine, so no dual-voice consensus table. Single-voice review.

## What already exists

- `index.html`: header/hero, 3-piece gallery (hardcoded `<img>` tags), a
  commission form pointed at a placeholder Formspree endpoint, footer
- Deployed at `robbypots.com` via Cloudflare Pages project `robbypots`
- 3 real photos in the repo (2 clean product shots, 1 lifestyle shot), 69 more
  candidate photos backed up in `../photo-exports/` (unsorted, mixed quality —
  greenware, restaurant plates, and finished pieces mixed together)

## Premise challenge

- "Hand-built, not Squarespace" — reasonable and worth respecting even though
  it's more work: Robby explicitly wants ownership/control and this is framed
  as a learning/craft goal, not just "cheapest way to a website." Not challenged.
- "Commerce is the end goal but not stage one" — correct sequencing. Building
  checkout before there's a settled catalog, pricing, and shipping policy
  would be waste. Confirmed.
- One premise worth surfacing rather than silently assuming: **"self-serve
  content updates" could mean very different things** — anywhere from "Robby
  edits a JSON file and redeploys" to "Robby uses a web form with no terminal
  at all." This changes the eng approach substantially — flagged as a taste
  decision below rather than assumed.

## Alternatives considered (commerce approach)

| Approach | Effort (human / CC) | Pros | Cons |
|---|---|---|---|
| A. Fully custom cart + checkout (Stripe API direct) | ~2-3 weeks / ~2-3 days | Full control, no platform fees beyond Stripe's, matches "build it myself" | Most eng work: inventory state, tax, order emails, PCI scope management |
| B. Headless commerce (Shopify/Snipcart backend, custom frontend) | ~3-5 days / ~half day | Payments, inventory, tax handled for you; frontend still fully custom-designed | Monthly platform fee; "not Squarespace" but still a 3rd-party dependency for the commerce core |
| C. Snipcart / Stripe Checkout bolted onto static pages (no custom backend) | ~1-2 days / ~2-3 hrs | Cheapest path to "buy now" button that actually works; still 100% custom design | Less control over checkout UX; per-transaction fee |

Recommendation for **stage one**: none of these — stage one has no cart yet
(per premise 2). This table is here so the stage-two decision isn't made
blind later. Recorded in TODOS.md as deferred, not decided now.

## Dream state

```
CURRENT                    THIS PLAN (stage 1)              12-MONTH IDEAL
────────────────           ─────────────────────            ──────────────────────
1 page, 3 photos      →    Multi-page portfolio site   →    Full storefront:
Fake form endpoint          Real working contact form         browse → cart → checkout
No content workflow         Robby can add photos/videos       Order emails, inventory,
                             himself (data file, no code)      shipping calc
No video support            Video support (process clips,     Customer accounts /
                             throwing demos)                    order history (maybe)
```

## Scope for this plan (stage one)

**In scope:**
- Design system (type/color/spacing) that reads as gallery-quality
- Multi-page structure: home/gallery, piece detail, about/contact
- Real contact/commission form backend
- Video support
- A content workflow so Robby can add new pieces without hand-writing HTML

**NOT in scope (deferred to TODOS.md):**
- Cart / checkout / payment processing
- Inventory tracking, shipping calculation, tax
- Customer accounts

## Decisions confirmed with Robby

- **Content workflow:** data file (JSON/YAML) + rebuild. New piece = new
  photo file + a few lines in the data file, then redeploy. No CMS/backend
  for content in stage one.
- **Form backend:** Cloudflare Pages Functions + email. No third-party form
  service — stays inside the Cloudflare account.
- **Video hosting:** YouTube (unlisted/public) embeds. No Cloudflare Stream
  cost/setup for stage one.

CEO review complete.

---

# Design Review

Single-voice (no `codex`). UI scope confirmed (this entire plan is UI/design).

## Information hierarchy — what should a visitor see first, second, third?

1. **First:** who made this and what it is — name, one clean hero image or
   small rotating set of best pieces, one-line positioning (not just "Ceramics
   & Custom Commissions" — that's a category, not a hook. Needs to say what
   makes the work distinct: material, technique, aesthetic).
2. **Second:** the gallery — pieces, browsable, filterable later (by type:
   mugs / bowls / vases) once volume grows.
3. **Third:** proof of process — photos/video of the making, not just the
   finished object. This is what separates a craftsperson's site from a
   generic product catalog and is a stated goal ("show videos and photos
   related to my ceramics work").
4. **Fourth:** contact/commission — present but not competing with the work
   itself for attention.

Current `index.html` has this roughly right (hero → gallery → contact) but
it's a single page trying to do all four jobs at once. Multi-page structure
(home, gallery, piece detail, process/about, contact) lets each page do one
job well instead of stacking everything.

## Missing states (currently unspecified — will bite the implementer later if left ambiguous)

| State | Current plan | Risk if left unspecified |
|---|---|---|
| Gallery, 0 pieces / new site | unspecified | Empty white gap looks broken, not "coming soon" |
| Image still loading | unspecified | Layout jump as images pop in |
| Form: submit success | unspecified | Visitor doesn't know if it worked, may submit twice |
| Form: submit failure (network/server error) | unspecified | Visitor thinks it worked, message never arrives |
| Piece detail: no video for that piece | unspecified | Broken embed or blank space if not conditionally rendered |
| Mobile viewport (phone) | unspecified — current CSS is desktop-grid only | Buyers/commissioners are very likely browsing on phone first |

Decision (auto-decided, mechanical — explicit is better than silently
shipping ambiguous states per plan-design-review's own bias toward
completeness): all six states above get explicit handling in the build,
not left to "whatever the browser does by default."

## Responsive strategy

Current CSS (`grid-template-columns: repeat(auto-fit, minmax(300px, 1fr))`)
already reflows reasonably on narrow screens, but hasn't been tested on an
actual phone viewport, and the form/nav weren't designed mobile-first.
Auto-decided: build mobile-first, verify at 375px (phone), 768px (tablet),
1280px (desktop) — not "hope the grid reflows correctly."

## Accessibility

Not addressed at all currently. Auto-decided minimum bar for stage one:
alt text on every piece image (already partially done), visible focus states
on the form inputs and CTA buttons, color contrast that passes WCAG AA for
body text, form labels properly associated (`<label for>`, not just visual
proximity — current form uses plain `<label>` wrapping which is fine, verify
carries through the redesign).

## Trust signals (craftsperson/commerce-adjacent site specific)

Buyers commissioning custom work from an individual (not a brand) look for:
process transparency (photos/video of making — already a stated goal),
a real name and location (already present: "Based in San Francisco"),
and clear expectations on commissions (turnaround time, price range signals)
— **this last one is currently absent from the form and worth adding**: right
now the form just asks "what would you like commissioned" with no framing on
price range or timeline, which risks mismatched-expectation inquiries.
Flagged as a content addition, not a structural change — low effort, real
value. Included in scope.

Design review complete.

---

# Eng Review

Single-voice (no `codex`).

## Architecture

```
                         ┌─────────────────────────┐
                         │   pieces.json (data)      │
                         │   title, images[], video,  │
                         │   glaze/material, story     │
                         └───────────┬──────────────┘
                                     │ read at build time
                                     ▼
   ┌──────────────┐        ┌──────────────────┐        ┌─────────────────┐
   │  Templates    │──────▶│  Static site       │──────▶│  Cloudflare Pages │
   │  (home,       │ build │  generator          │ deploy │  (robbypots.com)  │
   │  gallery,     │       │  (11ty — see D5)    │        │                    │
   │  piece,       │       └──────────────────┘        └────────┬──────────┘
   │  about,       │                                             │
   │  contact)     │                                             │
   └──────────────┘                                             │
                                                                   ▼
                                                        ┌────────────────────┐
                                                        │ Pages Function      │
                                                        │ /functions/contact  │
                                                        │  → sends email      │
                                                        │    (Resend/Mailchannels)
                                                        └────────────────────┘
```

## Taste decision: static site generator vs hand-written HTML per page

With the "data file + rebuild" content workflow confirmed, hand-writing a new
`<div class="piece">...</div>` block per piece across multiple HTML files
doesn't scale and re-introduces exactly the "hand-edit HTML each time" problem
premise 3 rejected. A minimal static site generator (11ty/Eleventy — no
framework lock-in, outputs plain HTML/CSS, still "hand-built" in spirit, just
templated) reads `pieces.json` once and generates the gallery + one detail
page per piece automatically.

Decision confirmed: **Eleventy (11ty)**. Reads `pieces.json`, generates gallery
+ one detail page per piece. Adding a piece from now on is data-only.

## Test plan (scaled to a marketing/portfolio site — no backend services, so
no load testing, no N+1 query analysis, no on-call runbook)

| Codepath | Test |
|---|---|
| Contact form: valid submission | Submits, Robby receives email, visitor sees success state |
| Contact form: empty required field | Browser-native validation blocks submit (already have `required` attrs) |
| Contact form: Pages Function errors/times out | Visitor sees explicit failure state, told to retry or email directly (fallback `mailto:` link) |
| Gallery: 11ty build with 0 pieces in pieces.json | Renders explicit "new work coming soon" state, not a blank grid |
| Gallery: piece with no video | Video block conditionally omitted, not a broken embed |
| Every page at 375px / 768px / 1280px viewport | No horizontal scroll, nav usable, images don't overflow |
| Every image | Has alt text; verify via a quick grep of the generated HTML for `<img` without `alt=` |
| Deploy | `wrangler pages deploy` succeeds and the live site matches local preview |

## Failure modes registry

| Failure | User-visible impact | Mitigation |
|---|---|---|
| Pages Function (contact form) throws/times out | Visitor thinks message sent, it didn't | Explicit error state + fallback `mailto:` link always visible near the form |
| pieces.json has a malformed entry (bad JSON) | 11ty build fails, site doesn't deploy | Build fails loudly locally before push — no silent bad-deploy risk, since deploy is a manual/reviewed step, not auto-triggered on every git push (confirmed: no CI auto-deploy configured) |
| YouTube video unlisted/deleted later | Broken embed on a piece's page | Not solved in stage one — accepted risk, noted in TODOS.md as a "check periodically" item, not an automated one |

Eng review complete. DX review skipped — no developer-facing audience for
this site (Phase 3.5 condition not met).

---

# Completion Summary

**Stage one scope:** design system, multi-page site (home/gallery, piece
detail, about, contact), real contact form (Cloudflare Pages Functions +
email), video support (YouTube embeds), self-serve content workflow (11ty +
`pieces.json`).

**Explicitly deferred (see TODOS.md):** cart/checkout, payment processing,
inventory, shipping/tax, customer accounts, choice of commerce vendor
(custom Stripe vs. Shopify-headless vs. Snipcart — table above, revisit once
there's a real catalog).

**All 5 taste decisions confirmed with Robby:**
D2 content workflow → data file + rebuild · D3 form backend → Cloudflare
Pages Functions + email · D4 video hosting → YouTube embeds · D5 site
generator → Eleventy (11ty).

Review ran single-voice (Claude only) — `codex` CLI not installed on this
machine, so no dual-voice consensus tables were produced. Noted as a
limitation, not blocking.

