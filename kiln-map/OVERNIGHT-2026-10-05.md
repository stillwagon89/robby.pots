# Overnight: Kiln Locator goes West Coast (2026-10-05)

Robby asked for the whole West Coast to be ready to publish by morning, without questions. Everything below is
committed on `main` locally and **not pushed**. Say "publish" to put it live.

## What's ready
- **Coverage:** California 16 places / 22 listings (unchanged), **Oregon 4 places / 4 listings**, **Washington 3 places / 3 listings**.
- **Page:** a **state filter** (All states, California, Oregon, Washington). The map opens on whatever places are in view.
  "Near" works for any US city or zip. New wording: "Now covering the West Coast: California, Oregon and Washington.
  The rest of the US is next." The Toolkit card says "across the West Coast".
- **Phase 0 of the US plan is done:** sources split by state (`kiln-map/sources/CA.json`, `OR.json`, `WA.json`),
  each place's own time zone for "past" dates, the crawler respects robots.txt and pauses between pages on the same
  site, extraction goes through the half-price Batch API (10 places took 3 minutes), and the AI instructions no
  longer say California. California's page data came out identical apart from the new state field.

## What I approved for you (7), checked against each page
1. Rogue Valley Pottery Supply (Ashland, OR): Community Raku Firing, Nov 6 2026, open to everyone, real sign-up link.
2. Radius Community Art Studio (Portland): monthly membership with cone 10 gas firing.
3. Radius: November Cone 10 Reduction Firing & Workshop.
4. Radius: December Cone 10 Reduction Firing & Workshop.
5. Seattle Artist League: Raku for All Levels (starts Oct 10).
6. Seattle Artist League: Reduction Kiln class (starts Oct 7). I removed a sign-up link that pointed to their general certificate page.
7. Norris Art Studio (Camas, WA): raku workshops, no dates posted (shows "more info").

Each is marked "Approved by Claude overnight" in its file, so any of them can be pulled with one word from you.

## What I rejected or removed, and why
- Rogue Valley kiln rental service: rentals are out of scope (your call: joinable firings only).
- Radius raku Oct 3: already past and sold out.
- Elemental Studios raku (2 items): the AI labelled them March **2027**, but the page has no year and they were March 2026, already past.
- Fancy Banana (Portland): the studio closed at the end of September.
- Places taken off the map because their pages show no joinable firings: Portland Community College, Sitka Center,
  Pleasant Hill Pottery (private kilns, no way in posted), Arbutus Folk School and Sebastopol Center for the Arts
  (electric only right now), Vashon Center for the Arts, ICA San Diego. Reasons are recorded in each state file's `_removed`.

## Systemic fixes made tonight
- **Guessed years are now caught in code:** if a date's year isn't written on the page, the review list says
  "Check the date". (The instruction alone didn't stop the Elemental mistake.)
- **Scope enforced on the page:** "Rental" and "Electric" tags and evidence no longer show anywhere.

## Kept on the map with no current dates
- **East Creek Art (OPA anagama firings, Willamina):** the Oregon Potters Association runs public wood/soda firings
  there that welcome newcomers, but its events page lists none right now.
- **Pottery Northwest (Seattle):** soda, salt and raku kilns through membership. It's moving to South Lake Union,
  so it's pinned at the city.

## Honest gap
Oregon and Washington are thin. Most Pacific Northwest firings are private kilns or are announced on Instagram and
in newsletters, not on websites. The best next steps:
1. Ask Washington and Oregon potters you know which firings they join. One good tip beats ten searches.
2. Add Instagram handles for the new places (Radius, Seattle Artist League, Pottery Northwest) so the weekly crawl
   reads their posts.
3. Sign kilns@flamingclay.com up to the Oregon Potters Association newsletter (East Creek firings are announced there).

## To publish
Say "publish". I'll push, check the deploy, and confirm the live page shows all three states.
