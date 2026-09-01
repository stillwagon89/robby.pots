# Design System — Robby Stillwagon Ceramics

> **Last touched by:** Claude Code — 2026-09-01 (implemented Header v3 into `site/index.html` + `styles.css`). Before editing in Claude Code or Claude Design, update this line and check recent commits so the two don't drift out of sync. (`DESIGN_SYNC.md` and the `bin/design-sync.mjs` stamp comment were removed 2026-09-01 — that tooling doesn't exist in this repo; this line + git/GitHub history are the source of truth for what changed and when.)

## Product Context
- **What this is:** Personal ceramics portfolio + commission showcase for Robby Stillwagon, a ceramicist based in San Francisco
- **Who it's for:** Collectors, interior designers, other ceramicists, people interested in commissioning custom pieces
- **Space/industry:** Craft/ceramics; independent artist portfolio
- **Project type:** Portfolio site + commission inquiry hub
- **Memorable thing:** "This person has a distinct and interesting design sense that translates to their website and they're good at making ceramics"

## Aesthetic Direction
- **Direction:** Post-Digital Craft — Zine-inspired, intentional imperfection. Organized collage, not random. Bright, open, confident.
- **Decoration level:** Intentional — Subtle texture (paper grain, soft shadows on torn edges) supports the collage story without overwhelming the gallery
- **Mood:** Handmade, thoughtful, exploratory. Visitors should feel like they're looking at a curated magazine, not a templated portfolio
- **Reference aesthetic:** La zine culture + contemporary craft design + stop-motion editorial photography

## Typography
- **Display/Hero:** Satoshi (500, 600 weights) — Warm, modern, friendly. Announces who you are. **Not on Google Fonts** — served by Fontshare. Load the variable face (`satoshi@variable`), not static weights — Satoshi's static cuts are 300/400/500/700/900, no static 600, so a static request silently resolves 600 → 700.
  ```html
  <link href="https://api.fontshare.com/v2/css?f[]=satoshi@variable&display=swap" rel="stylesheet">
  ```
- **Body:** DM Sans (400, 500 weights) — Clean, readable, slight quirky personality. Tells your story and commission details.
- **Data/Labels:** JetBrains Mono (400, 500) — Residency eyebrows, metadata, glaze recipes. 10–12px, letter-spacing .04em–.16em, uppercase.
- **Loading strategy:** Fontshare CDN (Satoshi) + Google Fonts CDN (DM Sans, JetBrains Mono)
  ```html
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  ```
- **Applied rules:** Display type (Satoshi 600) carries negative tracking that tightens with size: -0.015em @28px, -0.02em @32px, -0.025em @32px section heads, -0.03em @40px hero. Body line-height 1.6, display line-height 1.04–1.15. Numeric data uses `font-variant-numeric: tabular-nums`. Prose gets `text-wrap: pretty`.
- **Font decision open:** Satoshi is current spec but unconfirmed. Google-hosted alternatives evaluated: Figtree (nearest match), Plus Jakarta Sans (common substitute), Work Sans (warmer), Outfit (more geometric). If Satoshi is dropped, swap the Fontshare link only — everything else holds.
- **Scale:** Modular 1.15x scale
  - xs: 12px
  - sm: 14px
  - base: 16px
  - lg: 18px
  - xl: 21px
  - 2xl: 24px
  - 3xl: 28px
  - 4xl: 32px
  - 5xl: 40px

## Color (v2 — supersedes original cream/taupe direction)
- **Approach:** White & cobalt, drawn from the blue-and-white porcelain (*qinghua*) Robby worked on in Jingdezhen. Every surface is white; depth comes from hairlines and shadows, never tinted fills. The cobalt ramp is a single hue at ~228°, varied only by lightness — deliberate, since cobalt oxide fires in one narrow band. Do not introduce additional hues to the editorial palette.
- **Page:** #FFFFFF (pure white; containers are transparent over it)
- **Paper (torn-paper cutouts):** #FAFAF8 (off-white, a half-step down from page)
- **Border:** #DCE3F0 (hairlines, dividers, chip outlines)
- **Cobalt Ink (dark mode ground only):** #0E1730
- **Cobalt Deep (headings, display type):** #16265C
- **Cobalt (body copy, links, primary button fill, active nav):** #2B4C9B
- **Cobalt Mid (secondary map pins, dashed placeholder borders):** #7C93C4
- **Cobalt Muted (captions, labels, metadata, inactive nav):** #7C8AAB — 3.1:1 contrast on white; large text/non-essential metadata only, never body copy
- **Success:** #5B8A7A
- **Warning:** #B99259
- **Error:** #A2565C
- **Info:** #5C79C4
- **Dark mode strategy:** Ground #0E1730, surfaces #1E2A47, cobalt lifts to #8FA8E0 (body) and #5C79C4 (secondary) for legibility. Previewed, not fully designed.
- **Contrast (measured):** #2B4C9B on white = 6.9:1 (AA body text). White on #2B4C9B = 6.9:1 (AAA large text).

## Spacing
- **Base unit:** 8px
- **Density:** Comfortable (generous breathing room)
- **Spacing scale:**
  - 2xs: 2px
  - xs: 4px
  - sm: 8px (base unit)
  - md: 16px
  - lg: 24px
  - xl: 32px
  - 2xl: 48px
  - 3xl: 64px

## Layout
- **Approach:** Creative-editorial hybrid — Grid structure keeps galleries legible and organized. Asymmetric spacing + overlapping torn-paper frames bring zine energy.
- **Grid:** 12-column base, responsive to 6 columns (tablet) and 3 columns (mobile)
- **Max content width:** 1200px
- **Gutter:** 24px (lg) / 16px (md) / 12px (sm)
- **Border radius hierarchy:**
  - sm: 4px (subtle, small elements)
  - md: 8px (cards, containers)
  - lg: 12px (larger panels)
  - full: 9999px (circular elements, avatars)

## Motion
- **Approach:** Minimal-functional — Only animations that aid comprehension or add polish without distraction
- **Easing:** 
  - Enter: ease-out (starts fast, settles)
  - Exit: ease-in (accelerates away)
  - Move: ease-in-out (smooth back-and-forth)
- **Duration:**
  - Micro: 50-100ms (hover states, small transitions)
  - Short: 150-250ms (fade-ins, slides)
  - Medium: 250-400ms (page transitions, modal opens)
  - Long: 400-700ms (major page animations, scroll reveals)

## Distinctive Design Elements (The Risks)

### 1. Torn-Paper Collage Frames
Each ceramic image sits in a CSS-rendered torn-paper frame. This is the system's one piece of real decoration — it appears nowhere else (not on text blocks, buttons, or panels). Clean execution (not actually rough), but signals "I'm confident enough to break the grid."

Two nested elements. Shadow must live on the **parent** — `box-shadow` on a clipped element is clipped away too; `filter: drop-shadow` follows the clip path instead:

```html
<div style="filter: drop-shadow(3px 5px 6px rgba(22,38,92,.15))">
  <div style="clip-path: polygon(1.5% 2%, 20% 0%, 46% 3%, 70% 0.5%, 98.5% 2%,
              100% 26%, 98% 52%, 100% 76%, 98% 98%, 74% 100%, 50% 97%,
              26% 100%, 2% 98%, 0% 74%, 2.5% 50%, 0% 26%);
              background: #FAFAF8; padding: 16px 16px 18px">
    <img src="…" style="display:block; width:100%; aspect-ratio:4/5; object-fit:cover">
  </div>
</div>
```

- Paper is #FAFAF8 on a #FFFFFF page — the edge reads off the shadow, not a color step; contrast is intentionally almost nothing.
- Padding 14–16px at gallery scale, 12px mobile, 9px avatar scale; bottom padding 2px larger than sides.
- **Vary the polygon per instance.** A single reused polygon reads as a stamped graphic. All polygons follow the same envelope: 16 points, corners inset 0–3%, edge midpoints wandering 0–3%.
- Circular images (avatar) get `border-radius: 9999px` on the `img` inside the torn wrapper.

### 2. Stop-Motion Residency Globe
An interactive element showing a torn-paper-style globe with pins marking: Tokyo, London, Jingdezhen (China), San Francisco.
- **Keyframes:** 4 AI-generated images exist (`globe1-cut.png`…`globe4-cut.png`, in `site/assets/`), one per residency face, read as a coherent eastward rotation: Tokyo (Pacific/Japan) → Jingdezhen (Asia) → London (Europe/Africa) → San Francisco (Americas)
- **Full animation (not yet built):** ~24 tween frames (≈6 per transition) needed for the rotation to read as motion rather than cuts. Generate on a plain white ground, no surrounding objects, cobalt linework on off-white paper, drafting-drawing weight. Sequence with `animation-timing-function: steps(7)` so frames snap.
- **Interaction:** On hover/tap, globe advances to next residency; detail panel swaps. Must also be keyboard-reachable (arrow keys or focusable buttons) — hover alone is not accessible.
- **Detail panel per location:** eyebrow ("Residency 0X/04"), city name, year (dashed placeholder until confirmed), district, description, "Studied" + "Representative piece" rows, 4-pill progress indicator.
- **Pin placement:** hand-placed per image, not projected geographic coordinates. Re-place pins if images are re-cropped.

### 3. Deliberate Typography
Using Satoshi (not system fonts, not Inter) + warm color palette signals intentionality.
- **Signal sent:** "I'm a designer, not using templates"
- **Perceived by:** Other designers and craft professionals immediately recognize this choice

## Pages & Sections

### Home Page
- **Hero:** Small artist photo (top left, circular, torn-paper frame) + name (Satoshi, 5xl) + tagline (DM Sans, xl, muted)
- **Navigation:** Horizontal links to Home, Gallery, Ask, Contact (DM Sans, lg)
- **Featured pieces:** 3-4 ceramic pieces in torn-paper frames, gallery layout
- **Residency globe section:** Stop-motion globe with location hover states
- **Call-to-action:** "Request a Commission" button (warm taupe, Satoshi medium)
- **Footer:** Location (San Francisco) + social/contact links

#### Header v3 (supersedes the hero description above — see `Home Header v3.dc.html`, board 1a)
Full-bleed moon-jar photograph behind the name lockup and nav, replacing the small circular
avatar + separate nav row.

- **Wordmark lockup:** one box, Satoshi 600, color `#16265C`. First line is `STILL` followed by
  the wagon mark (`assets/logo-mark-cobalt.svg`); second line is `WAGON`. The mark's height is
  `0.6em` of the wordmark's font-size and the gap between `STILL` and the mark is `0.18em` — both
  in em, not px, so the whole lockup scales as one unit and the mark can later stand alone at the
  same box size.
- **Nav links:** `Ceramics`, `Ask`, `Contact`, `Instagram` — DM Sans, 19px, color `#2B4C9B`.
  Replaces the old five-item nav (Home/Gallery/Ask/Contact) plus the separate "Request a
  Commission" button — Ask and Contact now carry that role, so the button is removed from the
  header nav.
- **Hover state (nav links and locations):** `border-bottom: 1px solid #16265C` on hover — a dark
  cobalt underline, not the muted rail color, so the hovered target is unambiguous.
- **Locations line:** `Tokyo · London · Jingdezhen · San Francisco`, JetBrains Mono, 11px,
  letter-spacing `.14em`, uppercase, color `#16265C` (full cobalt-deep, not the muted `#7C8AAB`
  used for other metadata — at this small size and mono weight, `#7C8AAB` measured under AA
  contrast; `#16265C` is the fix). Each city name gets the same hover underline as the nav links.
  Locations are labels only in this version — clicking a city does not currently change the
  photo (an earlier draft swapped in the residency-globe image per city; reverted, kept simple).
- **Hero photograph:** `site/moon-jar.jpg`, `object-fit: cover`, `object-position: 88% 34%` — the
  jar is pushed toward the right edge of the frame, not centered, so the lockup and nav sit over
  open space rather than glaze detail.
- **Wash:** a left-to-right white gradient over the photo —
  `linear-gradient(100deg, #FFFFFF 0%, rgba(255,255,255,.94) 38%, rgba(255,255,255,.55) 58%, rgba(255,255,255,0) 76%)`
  — so the left ~40% is solid-white ground for the type, fading out by 76% to let the jar's glaze
  show at full strength on the right.
- **Profile photo:** moves off the home page entirely; used only on the Contact page (not yet
  designed).
- **Open, not decided:** showing the full moon jar (not cropped) with the rest of the gallery
  revealed on scroll past it, in the manner of ingagircyte.com — flagged by Robby, not yet
  designed.

### Gallery Page
- Full grid of ceramic pieces (12-column → 6 → 3 responsive) in torn-paper frames
- Filter by type: Functional, Sculptural, Experimental, Commissions
- Piece detail on click: Hi-res image, description, materials, glaze info

### Ask Page
- Q&A section for commissioning questions
- Form to ask questions, browse existing answers
- Tone: Conversational, not corporate

### Contact Page
- Commission inquiry form (name, project description, timeline, budget range)
- Email submission via Resend (already set up)
- Social links (Instagram for work-in-progress content)

## Design Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-29 | Post-Digital Craft aesthetic with zine/collage sensibility | Matches Robby's design taste, signals thoughtful independent artist |
| 2026-08-29 | Satoshi + DM Sans typography | Warm and distinctive; signals "designed" to designer audience |
| 2026-08-29 | Cream/ivory background, restrained warm palette | Feels like natural light on ceramic, not sterile white |
| 2026-08-29 | CSS torn-paper frames around images | Playful but confident; reinforces handmade aesthetic |
| 2026-08-29 | Stop-motion globe for residency timeline | Ties interactive element to craft; memorable; shareable |
| 2026-08-29 | Comfortable spacing, generous layout | Breathing room signals confidence in the work |
| 2026-08-30 | **Superseded palette:** moved from cream/taupe to white/cobalt ("qinghua") | Drawn from the blue-and-white porcelain Robby worked on in Jingdezhen; single-hue cobalt ramp mirrors how cobalt oxide actually fires — one blue, many dilutions |
| 2026-08-30 | Header cut from 240px stacked hero to 64px single line | Robby's direction: header should cost minimal vertical space so the globe and gallery carry the page |
| 2026-08-30 | Residency globe placed directly below header, ahead of gallery | Robby's stated priority — his education/residencies are the story he wants told first |
| 2026-08-30 | Satoshi loaded from Fontshare (not Google Fonts), variable weight | Satoshi isn't Google-hosted; static cuts have no 600 weight, so the variable face is required for headings to render at spec |
| 2026-08-30 | This file carries a machine-checkable `design-sync` header (version, author, body hash) | Robby's direction: each side must be able to tell whether the other edited more recently. `DESIGN_SYNC.md` records *what* changed in prose; the header records *who and when* in a form a script can verify |
| 2026-09-01 | Live hero subline is "Stoneware and porcelain, shaped across four studios and one practice." | Read from shipped `site/index.html`. Supersedes the earlier board-01 copy ("Four studios, four clay bodies, one practice…"), which was never implemented |
| 2026-09-01 | Design system gains board 00, a render of the live home page, with a notes lane | So annotations are made against what ships rather than against the original spec boards |
| 2026-08-30 | Conflicts are never auto-resolved — both sides stop and ask Robby | Robby's choice. Neither design intent nor implementation constraint automatically outranks the other |
| 2026-09-01 | Home header rebuilt as a full-bleed moon-jar photo behind a stacked STILL/wagon/WAGON wordmark, replacing the circular-avatar + separate-nav-row hero | Robby's direction, following the Gabs Conway (photo-behind-type) and Inga Girčytė (flat cobalt nav list) references |
| 2026-09-01 | "Request a Commission" button removed from the header nav | Ask and Contact pages now carry that call to action; redundant in the header |
| 2026-09-01 | Locations line color changed from muted `#7C8AAB` to `#16265C`; hover underline (`border-bottom: 1px solid #16265C`) added to nav links and locations | Robby's contrast/accessibility feedback — the muted color and the wordmark under it were hard to read against the photo |
| 2026-09-01 | Moon jar repositioned to `object-position: 88% 34%` with a wider white wash | Robby's direction — more open white ground behind the type, jar pushed toward the right edge |
| 2026-09-01 | Header v3 implemented in `site/index.html`/`styles.css`; other pages (`gallery.html`, `ask.html`, `contact.html`) keep the pre-v3 header | Header v3 is scoped to the Home Page section of this file; no v3 spec exists yet for the other pages |
| 2026-09-01 | Header v3's `.hero` section below the header (headline, subline, "Request a Commission" CTA, torn-frame moon-jar image) left unchanged | The v3 spec text only describes the `<header>` element (lockup, nav, locations, full-bleed photo); it doesn't mention the separate hero content block, so it wasn't touched |
| 2026-09-01 | Instagram nav link points to `https://instagram.com/robby.pots` | Handle confirmed by Robby |
| 2026-09-01 | Header v3 layout corrected: near-full-viewport-height photo, wordmark + nav stacked vertically top-left, locations line pinned bottom-left (not the top-right horizontal row first implemented) | The v3 spec text described the pieces (lockup, nav, locations) but not their arrangement; Robby supplied reference screenshots showing the actual layout after the first pass was wrong |
| 2026-09-01 | Everything on the home page below the header removed (`<main>` now empty) — old "Four Years." hero copy/CTA/torn-frame image, residency globe section, "Recent Work" gallery preview, and footer all deleted, along with the now-unused globe JS | Robby's direction ("remove everything below tokyo london jindezhen and san francisco") — none of it matched Header v3's direction and no replacement is spec'd yet. `.hero`, `.globe-section`, and residency CSS in `styles.css` are now unused but left in place since gallery/ask/contact still reference shared classes; not yet redesigned or replaced |

## Sync Protocol
This file is the single source of truth for design values, and exists in two places
that must stay identical: the design project (visual decisions) and this repo
(implementation). Design decisions are made in the design project and written here
first; Claude Code implements from this file and never invents values. If a needed
value is missing, stop and ask rather than approximating. Every change gets a row in
the Design Decisions Log. If implementation forces a compromise, amend this file with
a log row explaining why, so the design side picks it up on its next read. When the
`.dc.html` mockups and this file disagree, this file wins.

## Implementation Status
Verified against `site/` at commit `ebb5bcf` on 2026-09-01. Board 00 of
`Design System v2.dc.html` is a faithful render of the shipped home page and is the
reference for what is actually live.

| Area | Spec | Live in `site/` | Notes |
|------|------|-----------------|-------|
| Cobalt palette (v2) | yes | yes | `--cobalt-deep`, `--cobalt` set in `styles.css` |
| Satoshi variable via Fontshare | yes | yes | Loaded on all four pages; font choice still unconfirmed |
| Torn-paper frames | yes | yes | Verify polygons vary per instance |
| Residency globe | yes (4 keyframes) | yes | `globe1-cut.png` in `index.html`; needs ~24 tween frames for real motion |
| 64px single-line header | yes | yes | |
| Gallery grid 12→6→3 | yes | yes | |
| Dark mode | strategy only | no | Ground/surface values recorded, not designed |
| Globe keyboard access | yes | unverified | Arrow keys / focusable buttons required, not hover-only |

## Implementation Notes
- Torn-paper effect: nested div + `clip-path: polygon(...)` + `filter: drop-shadow(...)` on the parent (see technique above). Vary the polygon per image instance — do not reuse one polygon.
- Stop-motion globe: 4 keyframes exist (AI-generated via Gemini) in `site/assets/globe1-cut.png`…`globe4-cut.png`. Full rotation tweening (~24 more frames) not yet built — current implementation cross-fades/steps between the 4 existing frames.
- Responsive breakpoints: 1200px (desktop) → 768px (tablet) → 375px (mobile). No horizontal scroll at any width.
- Performance: Optimize ceramic and globe images (WebP where practical, lazy loading, `aspect-ratio` reserved to avoid layout jump on load).
- Accessibility: Alt text on all images, ARIA labels on interactive elements, keyboard navigation for all buttons — including the globe (arrow keys/focusable buttons, not hover-only), 44px minimum touch target throughout.
- **Full implementation handoff** (exact pixel values, per-screen specs, open questions) lives in `_design_export/design_handoff_ceramics_design_system/README.md` and the source `Design System v2.dc.html`.
- **Open questions blocking full launch polish:** final font choice (Satoshi vs. Google alternative), residency years (all four currently blank/dashed — do not invent), Nakameguro studio name, fourth London studio name, "Four Years." headline confirmation, Jingdezhen gallery photograph.
