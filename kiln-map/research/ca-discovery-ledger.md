# California discovery v3 (2026-10-06)

`discover/run.mjs CA`: 55 Tavily searches (gas-studio search per city added), 216 places, gemma4 judge, a gas
re-judge after the membership rule fix, then one Claude pass. Hand research stays in `ca-firings-ledger.md`.
Recall: 8 of the 16 places already on the map found blind (Sonoma CC, Mendocino College, Mendocino Art Center, Laney,
Artillery, Verge, Burton Creek, and Elsewhere). Rows for places already listed are skipped by promote.mjs.

## Qualifies
| # | Place | Town | Firing | Access | Site |
|---|---|---|---|---|---|
| 1 | Hickory Clay | San Francisco | Gas reduction, wood, soda, salt, raku, pit | Membership, classes | hickoryclay.com |
| 2 | SMAart Studio | San Francisco | Raku, cone 10 reduction | Classes, 1-day raku workshops | smaartstudio.com., classbento.com |
| 3 | Clay By The Bay | San Francisco | Raku, pit, wood | Classes, membership | claybythebaysf.com |
| 4 | Sweet Spirit Ceramics Center | San Rafael | Gas reduction | Gas kilns by appointment | artworksdowntown.org |
| 5 | The Potters' Studio | Berkeley | Soda, gas | Membership | thepottersstudio.org |
| 6 | Berkeley Potters Guild | Berkeley | Wood | Annual wood firing event | berkeleypotters.com |
| 7 | Clayroom Oakland | Oakland | Raku | Monthly raku firing | clayroomoakland.com |
| 8 | The Crucible | Oakland | Raku | Raku class (bring fired work) | thecrucible.org |
| 9 | JTown Clay (Higher Fire) | San Jose | Raku, soda, salt, pit | Dec 13 firing | higherfirestudios.com |
| 10 | Spring Valley Anagama | San Jose | Wood | Anagama crew | woodkiln.org |
| 11 | Sunnyvale city ceramics studio | Sunnyvale | Gas reduction (two cone 10 kilns) | City classes | sunnyvale.ca.gov |
| 12 | Common Clay Space (Miki Shim) | Cupertino | Pit | Pit firing workshop | mikisr.com |
| 13 | Spiffy Pottery Studio | Menlo Park | Soda | Soda firing workshop | thespiffystudio.info |
| 14 | Oribe Firing Center | San Gregorio | Raku, soda, wood, pit | Workshops, firing services | oribefiring.com |
| 15 | Slowfire | CA | Cone 10 gas | Membership | slowfireceramics.com |
| 16 | Cobb Mountain Art and Ecology | Middletown | Wood, soda, salt, gas | Workshops; by appointment | cobbartandecology.org |
| 17 | Kickwheel Sonoma | Petaluma | Pit | Nov 7, 2026 pit firing (with Clay+Kiln) | kickwheelsonoma.com |
| 18 | Sebastopol Center for the Arts | Sebastopol | Soda, wood | Workshop | sebarts.org |
| 19 | CLAYFOLK Studio | Occidental | Raku, wood | Saturday workshops | clayfolkstudio.com |
| 20 | John Dix | Mendocino | Wood, soda | Hands-on firing workshop | johndix.com |
| 21 | ACAI Studios & Gallery | Fair Oaks | Raku | $40 raku firing | acaistudios.com |
| 22 | Auburn Clay Arts | Auburn | Cone 10 | Membership | auburnclayarts.com |
| 23 | American Museum of Ceramic Art (AMOCA) | Pomona | Soda, salt | Workshops; salt firing days | amoca.org |
| 24 | Green & Bisque Clayhouse | Pasadena | Raku | Sep 27 ($165) | gbclayhouse.com |
| 25 | Turning Earth | Los Angeles | Gas reduction | Membership | turningearth.org |
| 26 | Element Art Center | Los Angeles | Pit | Beach pit firing course | classbento.com |
| 27 | Claytivity Pottery Studio | Los Angeles | Raku | Raku class | coursehorse.com |
| 28 | Ceramic Studio LA | Los Angeles | Gas reduction | Classes | pottery-la.com |
| 29 | Cobalt & Clay | Los Angeles | Gas reduction | Class + firing service | cobaltandclay.com |
| 30 | Summer Studios | Lomita | Gas glaze firing | Classes | summerstudioslomita.com |
| 31 | ARTime Barro | Orange County | Gas | Kiln available to all members | artimebarro.com |
| 32 | Cone 6 Ceramics | San Diego | Soda, salt, wood, raku, gas | **Outside-artist firing** | cone6ceramics.com |
| 33 | Ceramic Heights | San Diego | Raku | Apr 6 raku fire | ceramicheights.com |
| 34 | San Diego Potters' Guild | San Diego | Gas reduction | Guild studio | sandiegopottersguild.org |
| 35 | San Diego Ceramic Connection | San Diego | Raku | Studio raku kiln | sdceramic.com |
| 36 | ICA North | Encinitas | Raku | Several raku firings per session | icasandiego.org |

## Unclear
Santa Cruz Clay (cone 10?), Maker House (Goleta), Clay CA (LA), Still Life Studio and Sooki (firing services, kiln
type unknown), UCSB Gaucho REC (students?), Conrad Calimpong (Ferndale wood kiln, article), CSULB (enrollment).

## Rejected on Claude's pass
Electric or generic: Colibri, Petaluma Pottery, The Artist Outpost, Anastasia Tumanova. Lists: clay-king.com.

## Why the Bay Area gas gap happened
The original search list had one gas search per state, and Gemma rejected membership studios as "not public". Both
are fixed: every city now gets a gas-studio search, and the judge rules say membership and classes count.
