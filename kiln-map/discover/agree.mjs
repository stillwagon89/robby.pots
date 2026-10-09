// Two-model agreement on weak places: a second, stronger Claude model reads the same saved pages as the Haiku check.
// Keep a place solid only if BOTH say "yes" and share a firing type with a verified quote; both "no" removes it; otherwise it stays weak.
//   node kiln-map/discover/agree.mjs [--apply] [ST ...]     env AGREE_MODEL (default claude-sonnet-5-5)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
import { stateName } from "../sources.mjs";

const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(fs.readFileSync(path.join(KM, "..", ".dev.vars"), "utf8").split("\n").map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "").trim()]));
const APPLY = process.argv.includes("--apply");
const only = process.argv.slice(2).filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());
const MODEL = process.env.AGREE_MODEL || "claude-sonnet-5-5";
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9$]+/g, " ").trim();
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const PROMPT = `You fact-check one listing for a map of places where the PUBLIC can take part in a NON-electric ceramic firing. Read ONLY the text given; no outside knowledge.
verdict "yes": outsiders (not only enrolled students or existing members) can join, book or sign up for at least one raku, wood/anagama, soda, salt, pit/barrel/saggar or gas-reduction firing (workshop, class, membership, rental, firing service, appointment, or an open invitation to email/contact them to join: an invitation COUNTS). "no": electric-only, paint-your-own, directory/blog/shop with no firings, students only, or nothing about such firings. "unclear": hints only.
"types": ONLY firing types where you can copy a sentence word for word showing outsiders can take part in THAT firing type; a bare mention of a technique does not count. "state_on_page": two-letter state of THIS place's own address; empty if not stated.
Return ONLY JSON: {"verdict":"yes|unclear|no","why":"one sentence","state_on_page":"","types":[{"type":"raku|wood|soda|salt|pit_barrel_saggar|gas_reduction","quote":"word-for-word"}]}`;
let spent = 0;
async function ask(text) {
  for (let a = 0; a < 6; a++) {
    let r;
    try { r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 900, system: PROMPT, messages: [{ role: "user", content: text }] }), signal: AbortSignal.timeout(120000) }); } catch { await new Promise((s) => setTimeout(s, 3000)); continue; }
    if (r.status === 429 || r.status >= 500) { await new Promise((s) => setTimeout(s, 5000 * (a + 1))); continue; }
    const d = await r.json();
    if (d.error) throw new Error(d.error.message);
    spent += (d.usage?.input_tokens || 0) + 5 * (d.usage?.output_tokens || 0);
    if (spent > 4e6) throw new Error("token cap reached");
    const m = (d.content?.find((c) => c.type === "text")?.text || "").match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
  }
  throw new Error("no usable answer");
}
const jobs = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); if (only.length && !only.includes(ST)) continue;
  const pf = path.join(KM, "research/cache", ST.toLowerCase(), "places.json");
  const places = fs.existsSync(pf) ? JSON.parse(fs.readFileSync(pf, "utf8")) : {};
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) if (s.review === "pending" && s.weak && s.discovered && !s.agree && places[s.discovered.key]) jobs.push({ ST, s, p: places[s.discovered.key] });
}
log(`agree: ${jobs.length} weak places with ${MODEL}`);
let done = 0; const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  while (queue.length) {
    const j = queue.shift();
    const pages = Object.entries(j.p.pages).map(([u, t]) => `--- ${u}\n${t}`).join("\n").slice(0, 14000);
    const hay = norm(pages + " " + j.p.hits.map((h) => h.snippet).join(" "));
    try {
      const v = await ask(`PLACE: ${j.s.org}\nSITE: ${j.p.key}\n\nSEARCH SNIPPETS:\n${j.p.hits.slice(0, 4).map((h) => `- ${h.title}: ${h.snippet}`).join("\n")}\n\nPAGE TEXT:\n${pages || "(none)"}`);
      const good = {};
      for (const t of v.types || []) if (TYPE_RE[t.type] && !good[t.type] && hay.includes(norm(t.quote)) && TYPE_RE[t.type].test(t.quote)) good[t.type] = t.quote.replace(/\s+/g, " ").slice(0, 300);
      j.v = { verdict: v.verdict, why: v.why, state: v.state_on_page || "", types: good };
    } catch (e) { j.v = { error: e.message }; }
    log(`agree ${++done}/${jobs.length} ${j.ST} ${j.s.id}: haiku=${j.s.verify?.verdict} ${MODEL}=${j.v.verdict || "ERR"}`);
  }
}));
const tally = {};
for (const j of jobs) {
  if (j.v.error || j.s.confirmed_by_robby || j.s.review === "approved") continue;
  const h = j.s.verify?.verdict, both = [...new Set([...Object.keys(j.s.verify?.types || {}), ...Object.keys(j.v.types)])];
  const stOk = !j.v.state || j.v.state.toUpperCase() === j.ST || j.v.state.toLowerCase() === stateName(j.ST).toLowerCase();
  j.out = h === "yes" && j.v.verdict === "yes" && both.length && stOk ? "agree-yes" : h === "no" && j.v.verdict === "no" ? "agree-no" : "split";
  j.both = both; tally[j.out] = (tally[j.out] || 0) + 1;
}
log(`agree: ${JSON.stringify(tally)} (~tokens ${spent})`);
if (APPLY) {
  const byFile = new Map();
  for (const j of jobs.filter((j) => j.out)) { if (!byFile.has(j.ST)) byFile.set(j.ST, []); byFile.get(j.ST).push(j); }
  const TODAY = new Date().toISOString().slice(0, 10);
  for (const [ST, js] of byFile) {
    const fp = path.join(KM, "sources", `${ST}.json`); const cur = JSON.parse(fs.readFileSync(fp, "utf8"));
    for (const j of js) {
      const s = cur.sources.find((x) => x.id === j.s.id); if (!s) continue;
      s.agree = { model: MODEL, verdict: j.v.verdict, result: j.out, date: TODAY };
      if (j.out === "agree-yes") { delete s.weak; s.firing_types_guess = j.both; if (s.access) s.access.types = j.both; }
      else if (j.out === "agree-no") { cur.sources = cur.sources.filter((x) => x !== s); (cur._removed ||= []).push({ id: s.id, why: `Two models agree: ${j.v.why} (${TODAY})` }); }
    }
    fs.writeFileSync(fp, JSON.stringify(cur, null, 2) + "\n");
  }
}
log("agree: done");
