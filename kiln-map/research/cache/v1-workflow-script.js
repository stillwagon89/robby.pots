export const meta = {
  name: 'kiln-state-research-v3',
  description: 'Research one state for joinable raku/pit/wood/soda/salt firings: Haiku searches, code dedupe, Sonnet site checks with named-place expansion, Haiku recall test',
  phases: [
    { title: 'Search', detail: 'Haiku agents run the query grid; empty searches retried', model: 'haiku' },
    { title: 'Check', detail: 'Sonnet agents read sites and outside sources; named places expand the list until dry', model: 'sonnet' },
    { title: 'Recall', detail: 'Haiku runs potter-style searches; misses get checked', model: 'haiku' },
  ],
}

const ST = args.state, METROS = args.metros, REGIONS = args.regions || [], SEEDS = args.seeds || []

// ---------- query grid (code). Plain wording only: no OR operators. ----------
const FIRING = ['raku', 'pit fire', 'saggar', 'wood fire', 'wood firing', 'soda firing', 'salt firing', 'anagama', 'obvara', 'horsehair raku']
const PHRASE = ['workshop', 'class', 'community firing', 'private firing', 'by appointment']
const queries = []
const EXT = new Set()
for (const f of FIRING) for (const p of PHRASE) { const q = `${f} ${p} ${ST}`; queries.push(q); if (p === 'workshop' || p === 'class' || p === 'community firing') EXT.add(q) }
for (const r of REGIONS) for (const f of ['raku', 'wood firing', 'soda firing', 'pit firing', 'anagama']) { const q = `${f} workshop ${r}`; queries.push(q); EXT.add(q) }
for (const m of [...METROS, ...REGIONS]) {
  queries.push(`raku firing ${m}`)
  queries.push(`raku class ${m}`)
  queries.push(`wood firing workshop ${m}`)
  queries.push(`soda kiln firing ${m}`)
  queries.push(`pit firing pottery ${m}`)
}
for (const q of [
  `pottery supply store raku firing ${ST}`, `ceramic supply raku night ${ST}`, `potters guild wood firing ${ST}`,
  `community college ceramics wood kiln ${ST}`, `community college ceramics soda kiln ${ST}`,
  `anagama firing crew ${ST}`, `wood kiln firing volunteers ${ST}`, `kiln opening wood fired ${ST}`,
  `raku party ${ST}`, `ceramics residency wood kiln ${ST}`, `parks and recreation raku class ${ST}`,
  `gas reduction cone 10 firing class ${ST}`, `atmospheric firing workshop ${ST}`, `summer ceramics workshop wood soda ${ST}`,
  `art center ceramics raku ${ST}`, `pottery studio membership soda kiln ${ST}`,
]) { queries.push(q); EXT.add(q) }
const CHUNK = 8
const chunks = []
for (let i = 0; i < queries.length; i += CHUNK) chunks.push(queries.slice(i, i + CHUNK))
log(`${ST}: ${queries.length} searches in ${chunks.length} batches`)

const SEARCH_SCHEMA = {
  type: 'object', required: ['queries'],
  properties: { queries: { type: 'array', items: {
    type: 'object', required: ['q', 'n_results', 'kept'],
    properties: {
      q: { type: 'string' }, n_results: { type: 'integer' },
      kept: { type: 'array', items: { type: 'object', required: ['url', 'org', 'why'],
        properties: { url: { type: 'string' }, org: { type: 'string' }, city: { type: 'string' }, why: { type: 'string' } } } },
    } } } },
}

const searchPrompt = (qs, retry) => `You are a search worker for a directory of pottery firings that the public can join in ${ST}.
Do NOT read any files in the local repository. Work only from the web.
Load the WebSearch tool with ToolSearch ("select:WebSearch") and run EACH of these searches with the mode shown in brackets. Extended mode matters: it finds places standard mode never shows. Run every one; do not skip any.
${qs.map((q, i) => `${i + 1}. ${q}   [mode: ${EXT.has(q) ? 'extended' : 'standard'}]`).join('\n')}
${retry ? 'These searches came back empty before. If one returns nothing again, try one simpler rewording (fewer words) and report under the original wording.\n' : ''}
For each search, record how many results came back (n_results = the real count you saw), and KEEP every result that could plausibly be a place in ${ST} where a person can take part in a raku, pit, saggar, barrel, obvara, wood, soda, salt, anagama or gas-reduction firing: classes, workshops, community firings, private/by-appointment firing sessions, raku parties, memberships with kiln access, college classes open to the public, residencies, crew calls.
Also KEEP directories, articles and lists that NAME such places in ${ST} (a later step reads them for names).
Places include art centers, studios, pottery supply stores, guilds, colleges, parks departments, individual potters with kilns, and event listings (Eventbrite, active.com, etc.).
When unsure, KEEP it. Your job is recall; a stricter checker comes later. Skip only results that are clearly irrelevant (clearly another state, kiln product pages, generic how-to articles).
Do not invent URLs: only report URLs that appeared in search results.`

// ---------- dedupe (code) ----------
const AGG = ['eventbrite', 'active.com', 'ma.to', 'facebook.com', 'instagram.com', 'allevents', 'meetup.com', 'yelp.com', 'classbento', 'coursehorse', 'airbnb', 'patch.com', 'retreat.guru', 'locable']
const norm = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|inc|llc|of|and)\b/g, '').trim()
function key(url, org) {
  const u = String(url || '').toLowerCase().trim()
  if (u.startsWith('seed:') || u.startsWith('named:')) return 'org:' + norm(org || u.slice(u.indexOf(':') + 1))
  const host = (u.replace(/^https?:\/\//, '').split('/')[0] || '').replace(/^www\./, '')
  if (AGG.some(a => host.includes(a))) return org ? 'org:' + norm(org) : u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/$/, '')
  return host
}
const cands = new Map()
const orgIndex = new Map()
function addCand(url, org, why, src) {
  let k = key(url, org)
  if (!k) return null
  const on = norm(org)
  if (on && orgIndex.has(on)) k = orgIndex.get(on)
  if (!cands.has(k)) cands.set(k, { key: k, urls: [], orgs: [], whys: [], found_by: [] })
  if (on && !orgIndex.has(on)) orgIndex.set(on, k)
  const c = cands.get(k)
  if (url && !url.startsWith('seed:') && !url.startsWith('named:') && !c.urls.includes(url)) c.urls.push(url)
  if (org) c.orgs.push(org)
  if (why) c.whys.push(why)
  c.found_by.push(src)
  return k
}

// ---------- check (Sonnet) ----------
const CHECK_SCHEMA = {
  type: 'object', required: ['places'],
  properties: { places: { type: 'array', items: {
    type: 'object', required: ['key', 'decision', 'org', 'reason', 'named_places'],
    properties: {
      key: { type: 'string' },
      decision: { type: 'string', enum: ['qualifies', 'reject', 'unclear', 'list_page'] },
      org: { type: 'string' }, city: { type: 'string' }, state: { type: 'string' },
      website: { type: 'string' },
      firing_types: { type: 'array', items: { type: 'string' } },
      access_kind: { type: 'string', enum: ['dated', 'by_appointment', 'membership', 'enrollment', 'residency', 'crew', 'contact', 'mixed', 'none'] },
      evidence_quote: { type: 'string' }, evidence_url: { type: 'string' },
      dated: { type: 'array', items: { type: 'object', properties: {
        title: { type: 'string' }, dates: { type: 'string' }, cost: { type: 'string' }, status: { type: 'string' }, url: { type: 'string' } } } },
      where_posted: { type: 'string' },
      reason: { type: 'string' },
      confidence: { type: 'number' },
      named_places: { type: 'array', items: { type: 'object', required: ['org'], properties: {
        org: { type: 'string' }, city: { type: 'string' }, url: { type: 'string' }, why: { type: 'string' } } } },
    } } } },
}

const RULES = `SCOPE RULES (strict):
QUALIFIES = a real place in ${ST} where an outside potter or member of the public can take part in (not just watch) a raku, pit, saggar, barrel, obvara, horsehair, wood, soda, salt, anagama/noborigama/train-kiln, or gas-reduction firing. Access can be: dated class/workshop/firing; by-appointment or private firing session booked by phone/online; membership that includes these kilns; public-enrollment college class; residency; crew/volunteer firing call; or "contact" = a kiln whose owner is documented (on their site OR in an article, interview, guild page or kiln map) as welcoming outside potters or crew into firings, even with no dates posted.
Examples that QUALIFY:
- Atlantic Pottery Supply (Orange Park, FL): "Call to set up a private firing" - you bring 15-25 pieces and fire them in their propane raku kiln with staff. by_appointment. QUALIFIES.
- Cobb Mountain Art & Ecology: dated wood/soda firing workshops, even if waitlisted. QUALIFIES.
- Laney College: wood kiln workshop with a public rate. QUALIFIES (dated).
- Flynn Creek Pottery anagama: no website, but an article quotes the owners saying anyone is welcome to participate in firings. QUALIFIES (contact), evidence from the article.
- A studio membership that states members can use the soda or gas reduction kiln. QUALIFIES (membership).
Examples that do NOT qualify:
- Kiln rental where you rent kiln time with no firing offered (rentals are out of scope).
- Electric-only firing, or a firing service where staff fire your pots in an electric kiln.
- A private kiln with nothing anywhere saying outsiders can join.
- Only past events AND no sign it recurs. (If it plainly recurs yearly or monthly, it QUALIFIES; note the last dates.)
- Students-only programs with no public enrollment.
- Places outside ${ST}.
LIST PAGES: if the candidate is an article, directory, residency list, guild member list or kiln map (not a place itself), use decision "list_page" and put EVERY place in ${ST} it names that might offer such firings into named_places (name, city, URL if given). For real places, also put into named_places any OTHER ${ST} places the page names as hosting firings (e.g. "workshops run at X"). Otherwise named_places = [].
EVIDENCE: evidence_quote must be copied verbatim from a page you read (the place's site or an outside source), with evidence_url pointing to that page. No paraphrase. Use "unclear" only if you truly could not read the place's site AND web searches for its name (and owner's name) found nothing usable.`

const checkPrompt = (batch) => `You check candidate places for a directory of joinable pottery firings in ${ST}.
Do NOT read any files in the local repository. Work only from the web.
Tools (budget: at most 4 WebSearch calls per candidate; prefer WebFetch/curl of the place's own pages): load WebFetch and WebSearch with ToolSearch ("select:WebFetch,WebSearch"). If a page is empty or JavaScript-heavy (Wix, Squarespace), fetch it with Bash curl and strip tags.
For each candidate: read its site beyond the given URL (classes, workshops, events, calendar, services/booking, membership, community firing pages). If there is no site, or the site says nothing about firings, WebSearch the place's name and owner's name with words like firing, kiln, workshop, and read the best outside sources.
${RULES}

For qualifying places also record every dated opportunity you can see (title, dates, cost, sold out/waitlist status, URL), the city, and where the place announces firings (newsletter, Instagram, Facebook).
Return one entry per candidate, using the candidate's key exactly.

CANDIDATES:
${batch.map(c => `- key: ${c.key}\n  urls: ${c.urls.slice(0, 4).join(' , ') || '(none known)'}\n  name(s): ${[...new Set(c.orgs)].slice(0, 3).join(' / ')}\n  why found: ${c.whys.slice(0, 2).join(' | ')}`).join('\n')}`

const BATCH = 3
async function checkAll(keys, phaseName, labelPrefix) {
  const list = keys.map(k => cands.get(k))
  const bs = []
  for (let i = 0; i < list.length; i += BATCH) bs.push(list.slice(i, i + BATCH))
  const out = (await parallel(bs.map((b, i) => () =>
    agent(checkPrompt(b), { label: `${labelPrefix} ${i + 1}/${bs.length}`, phase: phaseName, model: 'sonnet', schema: CHECK_SCHEMA })
  ))).filter(Boolean).flatMap(r => r.places)
  if (out.length < list.length) log(`WARNING: ${list.length - out.length} candidates came back unchecked (${labelPrefix})`)
  return out
}
const checked = []
const checkedKeys = new Set()
async function checkUntilDry(initialKeys, phaseName, prefix) {
  let pending = initialKeys.filter(k => !checkedKeys.has(k))
  let round = 0
  while (pending.length && round < 3) {
    round++
    pending.forEach(k => checkedKeys.add(k))
    const res = await checkAll(pending, phaseName, `${prefix} r${round}`)
    checked.push(...res)
    const fresh = []
    for (const p of res) for (const n of (p.named_places || [])) {
      const k = addCand(n.url || `named:${n.org}`, n.org, n.why || `named on ${p.org}`, `named by: ${p.org}`)
      if (k && !checkedKeys.has(k) && !fresh.includes(k)) fresh.push(k)
    }
    log(`${prefix} round ${round}: checked ${res.length}, ${fresh.length} new named places`)
    pending = fresh
  }
  const failed = checked.filter(p => p.decision === 'unclear' && /budget|could not be run|exhausted|timed out|blocked|403|rate/i.test(p.reason || '') && !p._retried).map(p => p.key).filter(k => cands.has(k))
  if (failed.length) {
    log(`${prefix}: retrying ${failed.length} checks that failed for tool reasons`)
    const res = await checkAll(failed, phaseName, `${prefix} retry`)
    const rk = new Set(res.map(r => r.key))
    for (let i = checked.length - 1; i >= 0; i--) if (rk.has(checked[i].key) && checked[i].decision === 'unclear') checked.splice(i, 1)
    res.forEach(r => { r._retried = true; checked.push(r) })
  }
  if (pending.length) log(`STOPPED after 3 rounds with ${pending.length} named places unchecked`)
}

// ---------- run ----------
phase('Search')
const runSearch = (cs, retry, tag) => parallel(cs.map((qs, i) => () =>
  agent(searchPrompt(qs, retry), { label: `${tag} ${i + 1}/${cs.length}`, phase: 'Search', model: 'haiku', effort: 'low', schema: SEARCH_SCHEMA })
)).then(r => r.filter(Boolean).flatMap(x => x.queries))
let queryLog = await runSearch(chunks, false, 'search')
const ran = new Set(queryLog.map(q => q.q))
const missing = queries.filter(q => !ran.has(q))
const empty = queryLog.filter(q => q.n_results === 0).map(q => q.q)
const redo = [...missing, ...empty]
if (redo.length) {
  log(`Retrying ${redo.length} searches (${missing.length} not run, ${empty.length} empty)`)
  const rc = []
  for (let i = 0; i < redo.length; i += CHUNK) rc.push(redo.slice(i, i + CHUNK))
  const retried = await runSearch(rc, true, 'retry')
  const redoSet = new Set(redo)
  queryLog = [...queryLog.filter(q => !redoSet.has(q.q) || !retried.some(r => r.q === q.q)), ...retried]
}
for (const q of queryLog) for (const k of q.kept) addCand(k.url, k.org, k.why, `search: ${q.q}`)
for (const s of SEEDS) addCand(s.url || `seed:${s.name}`, s.name, s.desc, 'seed: kiln map')
log(`${cands.size} unique candidates after dedupe (${queryLog.length} searches logged, ${queryLog.filter(q => q.n_results === 0).length} still empty)`)

phase('Check')
await checkUntilDry([...cands.keys()], 'Check', 'check')

phase('Recall')
const RECALL_SCHEMA = { type: 'object', required: ['results'], properties: { results: { type: 'array', items: {
  type: 'object', required: ['q', 'urls'], properties: { q: { type: 'string' }, urls: { type: 'array', items: { type: 'object', required: ['url'], properties: { url: { type: 'string' }, org: { type: 'string' } } } } } } } } }
const recall = await agent(`Do NOT read local repository files. Load WebSearch with ToolSearch ("select:WebSearch").
Pretend you are a potter in ${ST} looking for a raku, pit, wood or soda firing to join. Write 10 searches the way a real person would type them (short, casual, e.g. "${ST.toLowerCase()} raku firings", "where can i do raku near ${METROS[0]}", "wood firing ${ST.toLowerCase()}"), mixing the state and these places: ${[...METROS, ...REGIONS].join(', ')}.
Run each and return the top 10 results that are places or event listings (url plus place name; skip how-to articles and kiln product pages).`,
  { label: 'recall test', phase: 'Recall', model: 'haiku', effort: 'low', schema: RECALL_SCHEMA })
const misses = []
for (const r of (recall ? recall.results : [])) for (const u of r.urls) {
  const before = cands.size
  const k = addCand(u.url, u.org, `recall test: ${r.q}`, `recall: ${r.q}`)
  if (k && !checkedKeys.has(k)) misses.push({ q: r.q, url: u.url, org: u.org, key: k, new_candidate: cands.size > before })
}
const missKeys = [...new Set(misses.map(m => m.key))]
log(`Recall test: ${missKeys.length} places not seen by search or checking`)
if (missKeys.length) await checkUntilDry(missKeys, 'Recall', 'recall-check')

return { state: ST, queries: queryLog, candidates: [...cands.values()], checked, recall_queries: recall ? recall.results : [], recall_misses: misses }
