# Design System — Flaming Clay

> **Last touched by:** Claude Code — 2026-09-03 (implemented the Flaming Clay rebrand from an external design handoff into `site/` + `styles.css`). Before editing in Claude Code or Claude Design, update this line and check recent commits so the two don't drift out of sync. (`DESIGN_SYNC.md` and the `bin/design-sync.mjs` stamp comment were removed 2026-09-01 — that tooling doesn't exist in this repo; this line + git/GitHub history are the source of truth for what changed and when.)

## Product Context
- **What this is:** Personal ceramics portfolio + commission showcase for Flaming Clay, a ceramics studio run by Robby Stillwagon (San Francisco). Rebranded from "Robby Stillwagon Ceramics" / "Still Wagon" on 2026-09-03 — see the Rebrand section below. Internal file/asset names and older sections of this doc may still reference the old name.
- **Who it's for:** Collectors, interior designers, other ceramicists, people interested in commissioning custom pieces
- **Space/industry:** Craft/ceramics; independent artist portfolio
- **Project type:** Portfolio site + commission inquiry hub
- **Memorable thing:** "This person has a distinct and interesting design sense that translates to their website and they're good at making ceramics"

## Rebrand: Flaming Clay (2026-09-03)
Implemented from a complete external design handoff (`Website architecture audit.zip`
→ `design_handoff_flaming_clay_website/`), not designed from scratch in this repo.
Supersedes the mark, wordmark, page shell, and torn-paper sections below — those
sections are kept for history but are no longer live.

- **Name:** "Robby Stillwagon Ceramics" / "Still Wagon" → **Flaming Clay**. Chosen
  over a shortlist that included "Wagon.Pots" and "Wagon Studios" — Flaming Clay
  reclaims a word historically used against gay men, grounded in something literally
  true about the craft (pottery is heat work), and creates real distance from
  Robby's legal name for the parts of his practice (adult-themed pieces, sold at
  Folsom Street Fair) he doesn't want tied to his professional name.
- **Mark:** a two-lick flame with a sparkle accent, cobalt-deep on light / cream
  (`#F5F1E4`) on dark. **Raster only** (`site/assets/flame-mark.png`,
  `flame-mark-cream.png`) — the handoff's own README notes an attempt to auto-trace
  it into an editable SVG failed and was abandoned. If the mark is ever needed at
  large print/signage scale, it needs a real vector re-trace (Illustrator Image
  Trace or a designer), not a naive upscale of the PNG.
- **Wordmark lockup:** "FLAMING" / "CLAY" + inline flame mark (~20px, zero
  transparent padding in the PNG — baseline alignment depends on that), replacing
  "STILL" + wagon-mark SVG / "WAGON".
- **Page shell:** every page now uses a persistent left **sidebar**
  (`.page-shell` / `.sidebar` / `.page-content`, 176px, `position: sticky`,
  collapses to a horizontal row below 900px) containing the wordmark and nav.
  Replaces the fixed-full-page-moonjar + wordmark-only home shell and the
  moonjar+nav block used on the other pages (see "Header v3" history below).
  `.moonjar-bg` reverts from `position: fixed` to `position: absolute` — the photo
  now scrolls away with the hero instead of staying pinned behind all content. This
  resolves the "show the full moon jar, reveal the gallery on scroll" question that
  was previously open (see the old Header v3 log entries).
- **Torn-paper collage frames retired sitewide.** Every gallery image is now a
  plain `<img>`, no clip-path frame, no drop-shadow. Deliberate: the handoff's
  stated design goal is "quiet, cobalt-and-cream studio site, no visual clutter,
  photography and the pottery itself doing the work." This was previously the
  system's one piece of real decoration (see "Torn-Paper Collage Frames" below,
  now historical).
- **New Bio page** (`bio.html`) — the residency globe (removed from Home on
  2026-09-01) returns here, fully working: click or Enter/Space advances through
  **Tokyo → London → Jingdezhen → San Francisco** (reordered 2026-09-03 per
  Robby's direction; was Tokyo/Jingdezhen/London/SF in the handoff), updating the
  pin, city, specs, and progress pills. Every residency now carries the same two
  specs — **Studied** + **Representative piece** — instead of each having a
  different one-off field (Tokyo had Studied/Representative piece already;
  Jingdezhen's standalone "Photo" and London's "4th studio" and SF's "Technique"
  fields were folded into this shared shape, values `TBD` where not yet known).
  Tokyo's year (2023–2024) and neighborhood (Nakameguro) are confirmed; SF's desc
  now reads "Community Studio, currently working out of Hickory Clay." (was "Home
  studio. Current base." — note `neighborhood: 'Home studio'` on that entry
  wasn't touched and may want a second look given the new desc). Jingdezhen and
  San Francisco's globe pins were also re-placed 2026-09-03 — the handoff's
  original coordinates put Jingdezhen's dot near the Vietnam border and San
  Francisco's off the Pacific coast, both visibly wrong; corrected by measuring
  the rendered dot position against `getBoundingClientRect()` in a live browser
  and iterating until each landed on the actual place (Jingdezhen: mainland
  China, southeast of the Yangtze basin, north of Vietnam; San Francisco: the
  North American west coast at the right latitude). Note for future pin edits:
  the dot's rendered position is offset from its CSS `left`/`top` value by
  roughly half the pin label's width, because `.globe-pin`'s `transform:
  translate(-50%,-50%)` centers the whole dot+label group, not the dot alone —
  tune by the rendered dot, not the raw percentage. London's 4th studio name and
  San Francisco's exact years are still open (see Known placeholders, unchanged).
- **Nav:** Ceramics · Clay.AI · Contact · Bio · Instagram, in that order. "Ask" is
  now labeled "Clay.AI" in the nav (file stays `ask.html`, no URL change).
- **Ask page:** the handoff specified switching Cloudflare Turnstile to invisible
  mode via `size: 'invisible'` — **this is not a valid Turnstile API value**
  (verified against the live widget: it throws `Uncaught TurnstileError: Invalid
  value for parameter "size", expected "compact", "flexible", or "normal"` and
  the widget never renders, permanently disabling chat). True invisible behavior
  is set on the site key itself in the Cloudflare dashboard, not via this client
  parameter, and the current site key (`0x4AAAAAAEcNPxh_GwQkG5pf`) isn't
  configured that way. **Shipped instead:** the visible Turnstile checkbox stays
  (same as pre-rebrand), with the new "Connecting / Connected" status pill kept
  as an added visual layer on top of it. Same site key, same `/api/chat` request
  shape and history handling as before. If Robby wants true invisible
  verification later, that requires creating a new Turnstile site key in
  Invisible mode in the Cloudflare dashboard and swapping it in here — a
  dashboard action, not something implementable from this repo alone.
- **Contact page:** unchanged — same `/api/contact` POST, same field names
  (`name`, `email`, `description`). No backend changes anywhere in this rebrand.

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

### 1. Torn-Paper Collage Frames (retired 2026-09-03 — see Rebrand section above)
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

### 2. Stop-Motion Residency Globe (now lives on the Bio page — see Rebrand section above)
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

#### Header v3 (historical — superseded 2026-09-03 by the sidebar page-shell, see Rebrand section above)
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
- **Hero photograph:** `site/moon-jar.jpg`, `object-fit: cover`, `object-position: 88% 15%`
  (was `88% 34%` before 2026-09-04 — see log) — the jar is pushed toward the right edge of
  the frame, not centered, so the lockup and nav sit over open space rather than glaze detail.
- **Wash:** a left-to-right white gradient over the photo —
  `linear-gradient(100deg, #FFFFFF 0%, rgba(255,255,255,.94) 38%, rgba(255,255,255,.55) 58%, rgba(255,255,255,0) 76%)`
  — so the left ~40% is solid-white ground for the type, fading out by 76% to let the jar's glaze
  show at full strength on the right.
- **Profile photo:** moves off the home page entirely; used only on the Contact page (not yet
  designed).
- **Open, not decided:** showing the full moon jar (not cropped) with the rest of the gallery
  revealed on scroll past it, in the manner of ingagircyte.com — flagged by Robby, not yet
  designed.
- **2026-09-04: this "reveal on scroll" idea is now implemented, then revised into an
  intentional overlap.** First shipped as a small peek (`.hero-fullscreen` min-height
  `calc(100vh - 64px)`, a 16px gap from the fold, then `-72px`/24px gap after Robby asked
  for "8px higher"). Robby then clarified the actual goal wasn't a peek at all: the
  moon-jar photo should render at its full, uncropped height (it always has — `.moonjar-bg`
  is a separate `height:100vh` absolutely-positioned layer, never affected by
  `.hero-fullscreen`'s size) while "Recent Work" is pulled up far enough to visibly
  **overlap** the photo's lower portion as a deliberate layered composition, not a subtle
  scroll hint. Landed on `min-height: calc(100vh - 300px)` — the "Recent Work" heading and
  the top edge of the first row of gallery photos are visible on load, overlapping into the
  photo. This gap figure is viewport-height-independent by construction (`gap = X - 48`
  where `X` is the pixel term subtracted from `100vh`) — if this needs retuning later,
  solve for `X` from the desired gap rather than guessing, and verify with
  `getBoundingClientRect()` in a live browser, not just by eye — this file's own history
  has two entries (2026-09-01, 2026-09-04) where a caching/measurement mismatch briefly
  made a correct CSS change look like it hadn't worked; see `site/_headers` below, added
  2026-09-04 specifically to reduce this.
  "View full gallery →" link removed from this section per Robby's direction (Home and
  Gallery show the same pieces now, so the link no longer does anything a visitor
  doesn't already have via the Ceramics nav item). The `.section-row` divider line
  (`border-top`) above "Recent Work" was also removed same day, per Robby's direction —
  it read as an unwanted seam between the overlapping photo and the section header.
- **2026-09-04: the overlap above genuinely cropped the photo, not just visually occluded
  it — fixed.** `.moonjar-bg` was (and, on every page except Home, still is)
  `height: 100vh` with `object-fit: cover`, meaning the photo is hard-clipped at exactly
  one viewport height and simply doesn't exist past that point — confirmed via
  `getBoundingClientRect()`: `.moonjar-bg`'s bottom edge landed at the same Y as `100vh`
  while `.recent-work-grid` (with 8 pieces now) extended thousands of pixels further
  down. So as "Recent Work" overlapped and the page was scrolled, the photo wasn't hidden
  behind anything (confirmed nothing in `main`/`.page-content`/`.recent-work-grid` sets an
  opaque background) — past 100vh, there was just no more photo to show, full stop.
  Robby wants the *entire* photo, uncropped, visible behind "Recent Work" as far down as
  it naturally extends. Fixed with a Home-only modifier: `.moonjar-bg--full` (added to
  `index.html`'s wrapper div only — `bio.html`/`gallery.html`/`ask.html`/`contact.html`
  keep the original 100vh crop, which is correct for them; they only need the photo as a
  fixed backdrop behind the header, nothing scrolls over it there) sets `height: auto` and
  drops `object-fit`/`object-position` on the `<img>`, so it renders at its natural aspect
  ratio at full width instead of being cropped to a box. This also makes the earlier
  `object-position` crop-position tuning (88% 34% → 88% 15%, see below) moot for Home
  specifically — there's no crop left to position once the whole photo is shown.

### Gallery Component (`site/gallery.js`, shared — 2026-09-04)
Single source of truth for the pieces shown on **both** Home's "Recent Work" section and
the full Gallery page. `GALLERY_PIECES` in `gallery.js` is the only place piece data
lives; `renderGallery(containerId)` renders it into an empty `<div id="gallery">` on
each page. Edit a piece (or add/remove one) in `gallery.js` and both pages update —
there is no separate "recent" subset anymore, both pages render the identical list.
- **Current pieces (8):** Moon Jar, Matching Mug Set, Serving Tray, Speckled Cream Mug,
  Black Glazed Mug, Blue Lidded Jar, White Tumbler, Wave Teapot — in that order.
  The Jingdezhen "Untitled (Porcelain)" placeholder is gone; Serving Tray replaced it
  2026-09-04 per Robby's direction ("replace the jingdezhen piece photo needed with the
  first photo"), and the other 5 new photos were added after it, same order Robby
  posted them in
- **Removed 2026-09-04, Robby's direction:** Gas-fired Teapot, Faceted Cup, Speckled Mug
  (the *original* speckled mug, `mug1.png` — unrelated to the new "Speckled Cream Mug"
  photo added later the same day, which is a different piece)
- **Captions hidden 2026-09-04, Robby's direction:** `SHOW_CAPTIONS = false` in
  `gallery.js` — every piece still carries `title`/`materials` fields, just not
  rendered. The 6 new pieces added the same day have empty `materials` (no real
  glaze/technique info given yet — left blank rather than invented, matching this
  file's own Sync Protocol rule against approximating values). Flip `SHOW_CAPTIONS`
  back to `true` to restore captions once real material descriptions exist.
- **New photos live at `site/assets/gallery/`** (not the flat `site/` root where the
  original 2 pieces' images live — `moon-jar.jpg`, `mug2.png`). No reason both
  conventions need to merge; just know piece `img` paths point to either location.
- **Layout:** both pages use `.recent-work-grid` (equal 3-column, responsive to 1 column
  at 768px) — the old 12-column asymmetric `.gallery-grid` spans/margins system is no
  longer used by either page; the CSS rules for it are still in `styles.css` but dead
  code, not deleted in case the grid returns to that treatment later
- **Piece detail on click:** not yet built (open item, unchanged)

### Bio Page (new, 2026-09-03)
- The residency globe (see "Stop-Motion Residency Globe" above), as its own page rather than on Home
- `.hero-solo` intro: eyebrow "Tokyo · London · Jingdezhen · San Francisco", H1 "Four Years.", subhead "Traveling the world and learning from others."
- 2-column `.globe-grid`: globe visual + pin (left) / residency detail panel with eyebrow, city, year/neighborhood, description, specs list, 4-pill progress (right)

### Ask Page ("Clay.AI" in nav)
- Glaze-chemistry chat assistant, POSTs to `/api/chat` — unchanged backend contract
- Cloudflare Turnstile runs in invisible mode as of 2026-09-03 (was a visible widget) — a small "Connecting/Connected" status pill replaces the visible challenge box; same site key, same token/history handling

### Contact Page
- Commission inquiry form (name, email, description of the commission)
- Email submission via Resend (already set up), same `/api/contact` POST + status-message JS, unchanged by the rebrand
- Social links (Instagram for work-in-progress content)
- **2026-09-01: rebuilt on the same moon-jar fixed-background + wordmark + vertical nav shell as the home page** (`.moonjar-bg`, `.moonjar-content`), replacing the old `.site-header`/mobile-menu/footer. `gallery.html` and `ask.html` migrated to the same shell same day. **2026-09-03: this shell itself was superseded by the sidebar page-shell** — see Rebrand section above.
- **2026-09-04: `.card` background changed from `var(--page)` (solid white) to `transparent`** — Robby's direction, so the moon-jar photo shows through the form panel instead of sitting behind an opaque white card. `.card` is only used on this page (confirmed via grep before changing it), so this didn't touch anything else. Input/textarea fields keep their solid white fill so they still read as editable against the now-transparent card.

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
| 2026-09-01 | **Header v3 replaced entirely.** Home page now uses a fixed full-page moon-jar background (`position: fixed`, covers the whole viewport, stays put while any future content scrolls over it) with only the STILL/WAGON wordmark on top — no nav, no locations line | Robby's direction ("this is also terrible... start from scratch... moon jar as the background") after two failed Header v3 attempts. Confirmed scope via direct question: full-page fixed backdrop, wordmark-only overlay. Nav (Ceramics/Ask/Contact/Instagram) and the locations line are dropped from the home page for now — not relocated anywhere; open question for the next design pass |
| 2026-09-01 | Vertical nav (Ceramics/Ask/Contact/Instagram) added back under the wordmark — bold DM Sans 22px, cobalt, generous vertical gap, underline appears only on hover (`border-bottom` transparent -> cobalt) | Robby's reference: Inga Girčytė's site (stacked wordmark + vertical link list below it). No active-state color used since home has no "current page" to distinguish among these four |
| 2026-09-01 | Nav link type corrected to DM Sans 400 weight / 18px / line-height 1.5 (was 700 weight / 22px, an unsourced guess) | `Design System v2.dc.html`'s own Typography Scale board (board 04) explicitly labels its "LG 18" DM Sans row "Home · Gallery · Ask · Contact" at 400 weight — that's the spec's actual nav-link typography, not something to guess at |
| 2026-09-01 | `gallery.html` and `ask.html` migrated to the moon-jar background + wordmark + vertical-nav shell, matching index/contact | Robby's direction ("bring those over too"). Old `.site-header`, mobile-menu, footer, and their nav-toggle JS removed from both — page content (gallery grid/filters, Ask chat panel + Turnstile) unchanged |
| 2026-09-01 | Added `main { position: relative; z-index: 1; }` globally | Real bug found while migrating gallery/ask: CSS's stacking order paints a `position:fixed; z-index:0` element (`.moonjar-bg`) *after* normal in-flow content, so `<main>`'s content silently rendered underneath the fixed background and was unclickable/invisible — confirmed via `elementFromPoint` hit-testing, not just a screenshot glance. `.moonjar-content` (wordmark/nav on index/contact) already had `z-index:1` and was unaffected; `<main>` didn't |
| 2026-09-03 | Site renamed Robby Stillwagon Ceramics / Still Wagon → **Flaming Clay**; new flame+spark mark, new sidebar page-shell, torn-paper frames retired, new Bio page, Ask's Turnstile switched to invisible mode | Implemented from a complete external design handoff (not designed in this repo) — see the "Rebrand: Flaming Clay" section above for the full decision record. Chosen over "Wagon.Pots"/"Wagon Studios" for its reclaiming narrative and real distance from Robby's legal name |
| 2026-09-03 | `.moonjar-bg` reverted from `position: fixed` to `position: absolute` | Resolves the "show full moon jar, reveal gallery on scroll" question left open on 2026-09-01 — the handoff's Home page uses a `.hero-fullscreen` spacer above the Recent Work grid so the photo fills the first screen, then scrolls away |
| 2026-09-03 | `assets/logo-mark-cobalt.svg` (old wagon mark) deleted after confirming via grep it was only referenced in the four wordmark blocks being replaced | Dead asset once the rebrand shipped; `logo.jpg` and `glaze-bg.jpg` left alone — already unused before this change, not part of this rebrand's scope |
| 2026-09-03 | Ask page's Turnstile kept as a **visible** checkbox instead of the handoff's spec'd invisible mode | `size: 'invisible'` is not a valid Turnstile API value — confirmed via a real console error (`Uncaught TurnstileError`) that permanently disabled chat when tested locally. Not a judgment call; the spec'd behavior doesn't exist client-side with the current site key |
| 2026-09-03 | Contact page hint copy simplified to "Tell me a bit about what you're picturing. Are we working together on this piece? What materials interest you?" | Robby's direction — shorter, drops the size/color/timeline prompt list |
| 2026-09-03 | Tokyo bio copy changed to "I learned under master potter Chiaki Fujisaki (藤崎 千秋) who patiently taught me fundamentals w/ a focus on traditional Japanese kurinuki (くり抜き)." | Robby's direction — corrected name/reading and added "master potter" framing |
| 2026-09-03 | Bio residency order changed to Tokyo → London → Jingdezhen → San Francisco (was Tokyo → Jingdezhen → London → SF); every residency's specs standardized to Studied + Representative piece (values `TBD` where unknown, replacing one-off fields like "4th studio"/"Technique"/"Photo"); "NEEDED"/"TBC" placeholder text changed to "TBD" throughout; SF desc changed to "Community Studio, currently working out of Hickory Clay."; Jingdezhen and SF globe pins re-placed after confirming visually they were on the wrong location (Vietnam border / off the Pacific coast) | Robby's direction on order/format/copy; pin fix was a verified bug, not a request — see Rebrand section above for the measurement method |
| 2026-09-03 | Tokyo's globe pin also re-placed (was landing on mainland China, not Japan) — found by chance while producing screenshots for Robby, not something he'd flagged | Same class of bug as the Jingdezhen/SF pins fixed the same day; caught proactively rather than waiting to be told |
| 2026-09-04 | Instagram link changed from `https://instagram.com/robby.pots` to `https://www.instagram.com/flaming.clay/`, updated on all 5 pages | Robby's direction — matches the new brand handle |
| 2026-09-04 | `.card` background: `var(--page)` → `transparent` (Contact page form panel) | Robby's direction — moon-jar photo now shows through instead of sitting behind a solid white card |
| 2026-09-04 | Gallery unified into one shared component (`site/gallery.js`) rendered into both Home's "Recent Work" and the full Gallery page; piece list trimmed from 6 to 3 (Gas-fired Teapot, Faceted Cup, Speckled Mug removed); "View full gallery →" link removed from Home | Robby's direction — one place to edit going forward, reflected in both spaces. See "Gallery Component" under Pages & Sections above for the mechanism |
| 2026-09-04 | Captions (title + materials text under each photo) hidden via `SHOW_CAPTIONS = false` in `gallery.js`; data fields kept, not deleted | Robby's direction — wants the option to bring them back later without re-adding the data |
| 2026-09-04 | 6 new pieces added: Serving Tray (replaces the Jingdezhen placeholder), Speckled Cream Mug, Black Glazed Mug, Blue Lidded Jar, White Tumbler, Wave Teapot — photos saved to `site/assets/gallery/` | Robby's direction, photos supplied by him. `materials` left blank for all 6 — no real glaze/technique details given yet, not invented |
| 2026-09-04 | Added `site/_headers` forcing `styles.css` and `gallery.js` to `Cache-Control: max-age=0, must-revalidate` (Cloudflare Pages was defaulting both to 4-hour caching) | Robby reported the hero-height fix from earlier the same day "not working" a second time — the CSS was actually correct and live (verified via direct `curl`), but stale cached `styles.css` in his browser was masking it. This is the same root cause noted in the "you need to make it so..." conversation about the original post-rebrand blank-page report. A version-query-string fix was considered and rejected in favor of `_headers`, since it needs no discipline to remember on future edits |
| 2026-09-04 | Home's `.hero-fullscreen` min-height changed to `calc(100vh - 64px)`, putting "Recent Work"'s top border 16px above the fold on any screen size | Robby's direction ("slightly above the fold... top of that line at the bottom of the home page"). Verified with `getBoundingClientRect()` after an initial CSS edit silently failed to show up in testing due to the browser tab serving a cached `styles.css` — same underlying caching behavior already documented for production visitors; forced a cache-busted reload to get an accurate measurement |
| 2026-09-04 | `.hero-fullscreen` min-height retuned again, `calc(100vh - 64px)` → `calc(100vh - 72px)`, moving "Recent Work"'s top border from 16px to 24px above the fold | Robby's direction ("8px higher than where it is currently") after confirming the 16px state visually with him — a real, deliberate follow-up adjustment, not a caching issue this time |
| 2026-09-04 | Reversed course on the "peek above the fold" approach entirely — `.hero-fullscreen` min-height changed to `calc(100vh - 300px)`, a deliberate overlap rather than a sliver | Robby clarified he never wanted the moon-jar photo to look cropped/shortened (it wasn't — separate always-100vh layer) and actually wants "Recent Work" to visibly overlap the photo's lower portion, collage-style. Confirmed the direction with a screenshot before shipping, given how many rounds the smaller-peek version took to get right |
| 2026-09-04 | `.section-row`'s `border-top` divider removed (the "sliver line" above "Recent Work") | Robby's direction — with the overlap layout, that hairline read as an unwanted seam rather than a section break |
| 2026-09-04 | Hero photo `object-position` changed from `88% 34%` to `88% 15%` | Robby's direction ("cropped some of the top of the moon jar... could be moved down a bit more") — lower Y value shows more of the rim/top, crops more from the bottom instead |
| 2026-09-04 | Home page's hero photo stops being cropped to `100vh` entirely — new `.moonjar-bg--full` modifier (Home only) sets `height: auto`, no `object-fit`, showing the full photo at its natural aspect ratio | Robby's direction ("it should be fully shown... behind the recent work gallery component"). Confirmed via `getBoundingClientRect()` that the photo was being hard-clipped at exactly 100vh with nothing rendering past that point — not an opacity/z-index bug, the image element itself just ended there. Other 4 pages keep the 100vh crop; they don't need more, nothing scrolls over the photo on those pages |
| 2026-09-07 | Flame mark re-extracted and replaced (`flame-mark.png`, `flame-mark-cream.png`): 549 × 829px source (was 430 × 603px), spark rescaled to ~20% of flame height (was ~28%), all stroke terminals now fully rounded with no flat cutoffs; `logo-anatomy.html` and `brand-assets.html` copy/tables updated to match (clearspace ring padding adjusted for the new aspect ratio) | A newer extraction pass from the same high-resolution source art, delivered via a design handoff zip. Resolves the "stroke terminals" open issue `logo-anatomy.html` had been flagging since the mark shipped — confirmed visually, the old PNGs had flat-cut tips on two of the flame's inner peaks that the new extraction rounds off |
| 2026-09-08 | Gallery grid items (`.gallery-item`) changed from sizing to each photo's own aspect ratio to a fixed 4:5 crop (`aspect-ratio: 4/5; overflow:hidden`), image absolutely filling the box with `object-fit:cover`; `gallery.js`'s per-piece `aspect` field and the natural-aspect-ratio measurement pass removed entirely | Robby's direction ("regardless of the size of the photo... grid box needs to be roughly the same size with the text... in roughly the same spot whenever it's hovered over"). Verified via `getBoundingClientRect()` across pieces with very different natural dimensions (portrait, square, wide) — all render at an identical 337px box height, hover overlay exactly matches the box in every case |
| 2026-09-08 | Fixed a real mobile bug found while verifying the above: `.page-shell`'s `align-items: flex-start` (fine for the desktop row layout) collapses `.page-content` to 0 width once the ≤900px media query switches it to a column layout — added `align-items: stretch` to that media query | Cross-axis sizing without `stretch` falls back to intrinsic content size; `.page-content`'s only child is a `display:grid` element with no intrinsic width, so the two collapsed each other to 0. Pre-existing, unrelated to today's gallery change — just surfaced while testing it on mobile |
| 2026-09-08 | Reversed the 2026-09-04 "intentional overlap" decision again — `.hero-fullscreen` min-height changed from `calc(100vh - 300px)` to `100vh` (desktop and the ≤900px mobile breakpoint, which had separately been `70vh`) | Robby's direction ("ample blank/white space before the gallery component shows on page load") — the opposite of the collage-overlap effect from 09-04. Confirmed with `getBoundingClientRect()` on both desktop (1440×900) and mobile (375×812) that "Recent Work"'s top edge now falls below the initial viewport in both cases |
| 2026-09-08 | Reversed course again, same day — `.hero-fullscreen` back to `calc(100vh - 300px)` desktop / `70vh` mobile (the exact 09-04 values) | Robby clarified he does want the partial peek back on the home page (~252px of "Recent Work" visible at the bottom on a 900px-tall viewport, confirmed via `getBoundingClientRect()`) — the "ample white space" ask from earlier the same day meant no *big* reveal, not zero peek. `gallery.html` was confirmed separately to need no change: it has no `.hero-fullscreen` spacer at all, so its grid already renders at the very top (~96px) on load, per Robby's request that the dedicated gallery page show the grid immediately |
| 2026-09-08 | Fixed real bug in `functions/api/gallery.ts`: price/buy-link display was gated behind `track_inventory` being on, not just the item having a price — an item with `price_money` set but inventory tracking off (Blue Lidded Jar) silently showed no price or Buy button, while tracked items with a price (the Jingdezhen Cage, Gong Fu Teapot) worked fine | Robby reported he could only see the price/Buy button on two pieces and not a third he'd priced in Square over an hour earlier. Traced to `price: tracked ? price : null` — inventory tracking is now only used to drop truly sold-out *tracked* items; price/buyLink now derive purely from `price_money` being present, matching how Square actually lets you sell something without turning on inventory tracking. Also manually purged the stale `gallery:v1` KV cache key (`wrangler kv key delete --remote`) after deploying, rather than making Robby wait out the 10-minute TTL |
| 2026-09-08 | Sold-out tracked items stay visible in the gallery with a "Sold Out" pill (`.sold-out-pill`, ghost-style against the hover scrim) instead of being dropped entirely; new `soldOut` field added to the `/api/gallery` payload and threaded through `gallery.js` | Robby's direction ("if something is sold out but tagged as website, it should still show as well and show that its sold out") — also explains why Wave Teapot had disappeared: he'd just set it to Sold out in Square, which the old `continue`-and-drop logic treated as "remove from the gallery" rather than "mark unavailable" |

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
Verified against `site/` on 2026-09-03, after implementing the Flaming Clay rebrand
from the external design handoff. Pre-rebrand status (Header v3 / torn-paper /
fixed-background era) is preserved below for history but no longer reflects `site/`.

| Area | Spec | Live in `site/` | Notes |
|------|------|-----------------|-------|
| Cobalt palette (v2) | yes | yes | unchanged by the rebrand |
| Satoshi variable via Fontshare | yes | yes | Loaded on all five pages; font choice still unconfirmed |
| Flame mark (raster) | yes | yes | `assets/flame-mark.png` / `flame-mark-cream.png`; no vector version exists yet |
| Sidebar page-shell | yes | yes | 176px sticky sidebar, collapses to horizontal row below 900px |
| Torn-paper frames | retired | removed | Plain `<img>` everywhere now — see Rebrand section |
| Residency globe | yes (4 keyframes) | yes, on Bio page | `globe1-cut.png`…`globe4-cut.png`; still needs ~24 tween frames for real motion, still cross-fades between the 4 existing frames |
| Gallery grid 12→6→3 | yes | yes | Same 6 pieces as before the rebrand |
| Ask: invisible Turnstile | spec'd, not achievable client-side | no — visible checkbox kept | `size:'invisible'` is not a valid Turnstile value; confirmed via console error in the live widget. Status pill shipped alongside the visible checkbox instead of replacing it. True invisible mode needs a new site key configured that way in Cloudflare's dashboard |
| Dark mode | strategy only | no | Ground/surface values recorded, not designed |
| Globe keyboard access | yes | yes | Enter/Space on the globe, click on the progress pills |

### Pre-rebrand status (historical, superseded 2026-09-03)
Verified against `site/` at commit `ebb5bcf` on 2026-09-01. Board 00 of
`Design System v2.dc.html` was a faithful render of the shipped home page at that time.

| Area | Spec | Live in `site/` | Notes |
|------|------|-----------------|-------|
| Torn-paper frames | yes | yes | Verify polygons vary per instance |
| 64px single-line header | yes | yes | |
| Globe keyboard access | yes | unverified | Arrow keys / focusable buttons required, not hover-only |

## Implementation Notes
- Torn-paper effect: nested div + `clip-path: polygon(...)` + `filter: drop-shadow(...)` on the parent (see technique above). Vary the polygon per image instance — do not reuse one polygon.
- Stop-motion globe: 4 keyframes exist (AI-generated via Gemini) in `site/assets/globe1-cut.png`…`globe4-cut.png`. Full rotation tweening (~24 more frames) not yet built — current implementation cross-fades/steps between the 4 existing frames.
- Responsive breakpoints: 1200px (desktop) → 768px (tablet) → 375px (mobile). No horizontal scroll at any width.
- Performance: Optimize ceramic and globe images (WebP where practical, lazy loading, `aspect-ratio` reserved to avoid layout jump on load).
- Accessibility: Alt text on all images, ARIA labels on interactive elements, keyboard navigation for all buttons — including the globe (arrow keys/focusable buttons, not hover-only), 44px minimum touch target throughout.
- **Full implementation handoff** (exact pixel values, per-screen specs, open questions) lives in `_design_export/design_handoff_ceramics_design_system/README.md` and the source `Design System v2.dc.html`.
- **Open questions blocking full launch polish:** final font choice (Satoshi vs. Google alternative), residency years (all four currently blank/dashed — do not invent), Nakameguro studio name, fourth London studio name, "Four Years." headline confirmation, Jingdezhen gallery photograph.
