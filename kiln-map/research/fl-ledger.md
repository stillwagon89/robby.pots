# Florida firings ledger (2026-10-06, discovery v3 pilot)

Found by `discover/run.mjs FL`: 43 Tavily searches (86 of 1,000 free monthly credits), 182 places, 158 judged by
gemma4 on Robby's Mac, then one Claude pass over the 99 not rejected. Claude usage for the whole pilot,
including building the tool: about 1% of the weekly Pro allowance (84% → 85%).

**Recall test:** Atlantic Pottery Supply found blind in 4 of 5 potter-style searches and judged "qualifies".
Morean Center for Clay (already on the map) also found. Machine output: `fl-report.md`, `fl-discovery.json`.

## Qualifies: in Florida, the public can join or book a non-electric firing

| # | Place | City | Firing | Access | Evidence (site) |
|---|---|---|---|---|---|
| 1 | Atlantic Pottery Supply | Orange Park | Raku, horsehair | Dated workshops + private firings by appointment | atlanticpotterysupply.com |
| 2 | Morean Center for Clay (on map) | St. Petersburg | Wood (anagama), soda, salt, raku | Workshops, incl. Jenny Day salt workshop; work-trade residency | moreanartscenter.org, moreanworkshopspace.org |
| 3 | Jane's Art Center | New Smyrna Beach | Raku, soda | Classes/workshops | janesartcenter.com |
| 4 | The Clay Co-op | St. Petersburg | Raku | Raku firings; kiln firing services | claycoopstpete.com |
| 5 | Clay Center of St. Petersburg | St. Petersburg | Raku demos, wood, soda, salt | Membership; free raku demo events | claycenterofstpetersburg.com |
| 6 | Seagrass Pottery | Melbourne | Soda | Dated workshop ($175) | seagrasspottery.com |
| 7 | Atlantic Beach Arts Market | Atlantic Beach | Horsehair raku (Tim Bullard) | Dated 3-class workshop | atlanticbeachartsmarket.com |
| 8 | Eat Your Yard Jax | Jacksonville | Raku | Dated class (May 3) | visitfloridafarms.org |
| 9 | Eniko Ujj & Nick Phoenix | Pensacola | Pit | Nov 14, 2026 | enikoujj.com |
| 10 | Pit Fired Ceramics Workshop | Milton | Pit | Dated (Mar 16) | getrelaxing.com |
| 11 | LeMoyne Arts | Tallahassee | Pit, raku | Dated workshops | lemoyne.org, tallahasseearts.org |
| 12 | Super Awesome Cool Pottery | Orlando | Salt & wood | Dated workshop (Feb 21) | stayhappening.com, allevents.in |
| 13 | Peace and Mud Pottery Studio | St. Augustine | Raku | Classes | peaceandmudpottery.com |
| 14 | MAKE SPACE | St. Augustine | Raku (Herrick Smith) | Dated workshop, bring your own bisque | makespaceworkshop.com |
| 15 | The Clayground | Neptune Beach | Outside kiln firings (gas) | Dated | claygroundjax.com |
| 16 | East Orlando Ceramics | Orlando | Gas, raku, wood, soda, salt, pit | Firing service for outside potters | eastorlandoceramics.com |
| 17 | City of Orlando ceramics studio | Orlando | Cone 10 gas reduction, 2 raku kilns | City classes | orlando.gov |
| 18 | Sarasota Clay Company | Sarasota | Raku (Alan Bennett) | Jan 22 & 29, 2027 | sarasotaclaycompany.com |
| 19 | Ceramic League of Miami | Miami | Raku | Membership, classes | ceramicleaguemiami.org |
| 20 | Armory Art Center | West Palm Beach | Raku + alternative firing | Dated course | canvas.armoryart.org |
| 21 | Studio T/M Pottery and Clay | Gainesville | Wood, raku, gas | Two-day workshops, membership | studiotmceramics.com |
| 22 | First City Art Center | Pensacola | Raku (Ben Twingley) | Sign-ups for raku firings | firstcityart.org |
| 23 | Southwest Florida Potters Guild | Punta Gorda | Wood (manabigama), raku | Guild membership | swflpottersguild.com |
| 24 | Richard Rosen's studio | Naples area | Raku | Weekly class | gulfshorelife.com |
| 25 | Let It Burn Pottery | Bonita Springs | Raku (mobile) | Workshops | letitburnpottery.com |
| 26 | UWF Department of Art & Design | Pensacola | Raku | June 1–5 | uwf.edu |
| 27 | City of Tampa Golding Art Studio | Tampa | Raku | 4-week workshop | tampa.gov |
| 28 | WoodStoke / Gulf Coast Kiln Walk Society | Navarre / Pensacola State | Wood | Annual festival; public helps unload | pensacolastate.edu, ballingerpublishing.com |
| 29 | Smith Works Studios | (FL) | Pit | Two-day workshop | smithworksstudios.com |
| 30 | College of the Florida Keys | Key West | Wood (outdoor kiln) | Enrollment | keywestchamber.org |
| 31 | Jacksonville University | Jacksonville | Raku, gas, wood | Enrollment | ju.edu |

## Unclear: Robby or a second pass should check

- **Location unknown** (pages never name a state): Paseo Pottery (raku every 3rd Friday), Tao of Clay (beach pit firing), Element Art Center (beach pit firing), Creative Hands Studio (raku), Luke Iannuzzi Pottery (2026 raku workshops), Alex Adams Claywork (raku firing days).
- **Firing services that are probably electric:** Jacksonville Pottery Studio ($150/mo firing membership), MCS Clay Studios (Clearwater), The Craft Gallery (West Palm), Mandy Miles Studios (Daytona kiln rental), Laguna Clay Florida firing services (Oviedo).
- **Studios that mention raku or gas but show no public firing:** Jensen Pottery (St. Augustine), Gumbo Limbo Pottery and Anhinga Clay Studios (Miami), Floridian Ceramics (Tampa), Tampa Museum of Art, Tallahassee Clay Arts, House of Clay, Pottery by Osa, The Ceramic Garden.
- **Old or press-only:** Eckerd College anagama (2018 article).

## Rejected on Claude's pass

Out of state: Clay Creations (CA), Adamah (CA), Laney College (CA), Folk School (NC), Hitomi Shibata/Seagrove (NC),
Sawtooth (NC), Peters Valley (NJ), Northampton CC (PA), GoggleWorks (PA), Tyler Park (PA), Arrowmont (TN),
Josephy Center (OR), Steamboat Creates (CO), The Clay Studios and Craft Courses (UK). Generic classes with firing
included: Pottery Studio 1, Mingo, pottery-miami.com, Gasper, Firehouse, Hands On Clay, Pottery Flagler,
Countryside Ceramics. Duplicates were merged into their host above (Morean ×5, Studio T/M ×5, Sarasota Clay ×3).

## Lessons for the next state
- Gemma 4 finds well but accepts too much. Code now requires the state to appear in the place's own text.
  Next: add a code list of out-of-state hosts and merge directory/listing sites into their host before judging.
- City searches ("raku or wood firing pottery studio <city>") found most of the new places.
