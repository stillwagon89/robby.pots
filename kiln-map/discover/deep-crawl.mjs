// Deep crawl with a real (headless) browser, so JavaScript calendars and booking widgets render.
// Per place: home page + same-site class/workshop/event/contact pages + links to booking platforms (Bookeo, Acuity, Eventbrite, ...).
// Saves page text to research/cache/deep/<ST>/<id>.json.   node kiln-map/discover/deep-crawl.mjs [--priority] [ST ...]
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const B = path.join(os.homedir(), ".claude/skills/gstack/browse/dist/browse");
const TIERS = ((process.argv.find((a) => a.startsWith("--tiers=")) || "--tiers=0,1,2").split("=")[1]).split(",").map(Number);
const only = process.argv.slice(2).filter((a) => /^[A-Za-z]{2}$/.test(a)).map((a) => a.toUpperCase());
const BOOKING = /(bookeo|acuityscheduling|as\.me|eventbrite|mindbodyonline|square\.site|squareup|squarespacescheduling|jane\.app|pike13|punchpass|glofox|setmore|simplybook|vagaro|fareharbor|ticketleap|ticketspice|tickettailor|universe\.com|brownpapertickets|meetup|civicrec|activecommunities|regpack|jotform|wixbookings|momence|zenplanner|clubspeed|hisawyer|opencare|checkfront|trybooking|classy|givebutter|ticketsource|eventeny|cart\.ly)\./i;
const HINT = /class|workshop|event|calendar|schedule|book|register|firing|fire|kiln|membership|raku|wood|soda|salt|saggar|pit|studio|contact|visit|about|location|find-us|programs?|courses?|rent|service/i;
const lastHit = new Map();
const run = (...args) => { try { return execFileSync(B, args, { encoding: "utf8", timeout: 40000, maxBuffer: 20e6 }); } catch (e) { return ""; } };
const clean = (t) => t.replace(/--- (BEGIN|END) UNTRUSTED EXTERNAL CONTENT[^\n]*\n?/g, "").trim();
async function page(u) {
  const h = (() => { try { return new URL(u).host; } catch { return ""; } })();
  const w = (lastHit.get(h) || 0) + 1500 - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); lastHit.set(h, Date.now());
  const g = run("goto", u); if (!/Navigated/.test(g)) return null;
  if (BOOKING.test(u)) run("wait", "--networkidle"); else await new Promise((r) => setTimeout(r, 1200));
  return clean(run("text")).slice(0, 9000);
}
const jobs = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f))) {
  const ST = f.slice(0, 2); if (only.length && !only.includes(ST)) continue;
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) {
    const w = s.access?.url || s.contact?.website || s.urls?.[0]; if (!w || !/^https?:/.test(w)) continue;
    const out = path.join(KM, "research/cache/deep", ST, `${s.id}.json`);
    if (fs.existsSync(out)) continue;
    const tier = s.review === "approved" || !s.review ? 0 : !s.weak ? 1 : 2;
    jobs.push({ ST, s, w, out, tier });
  }
}
jobs.sort((a, b) => a.tier - b.tier);
for (let i = jobs.length - 1; i >= 0; i--) if (!TIERS.includes(jobs[i].tier)) jobs.splice(i, 1);
console.log(`deep-crawl: ${jobs.length} places`);
let n = 0;
for (const j of jobs) {
  const home = j.s.contact?.website || j.w;
  const pages = {};
  const t0 = await page(home); if (t0 === null) { fs.mkdirSync(path.dirname(j.out), { recursive: true }); fs.writeFileSync(j.out, JSON.stringify({ id: j.s.id, home, failed: true, pages: {} })); continue; }
  pages[home] = t0;
  const links = [...new Map(clean(run("links")).split("\n").map((l) => { const m = l.match(/^(.*?)\s*→\s*(https?:\S+)/); return m ? [m[2].split("#")[0], m[1]] : null; }).filter(Boolean)).entries()];
  const same = links.filter(([u, t]) => { try { return new URL(u).host.replace(/^www\./, "") === new URL(home).host.replace(/^www\./, "") && HINT.test(u + " " + t) && !/\.(jpe?g|png|pdf|zip)$/i.test(u); } catch { return false; } }).slice(0, 5);
  const book = links.filter(([u]) => BOOKING.test(u)).slice(0, 3);
  const extra = j.s.access?.url && j.s.access.url !== home ? [[j.s.access.url, ""]] : [];
  for (const [u] of [...extra, ...same, ...book]) { if (pages[u]) continue; const t = await page(u); if (t) pages[u] = t; }
  fs.mkdirSync(path.dirname(j.out), { recursive: true });
  fs.writeFileSync(j.out, JSON.stringify({ id: j.s.id, home, date: new Date().toISOString().slice(0, 10), pages }));
  if (++n % 10 === 0) console.log(new Date().toISOString().slice(11, 19), `deep ${n}/${jobs.length} ${j.ST} ${j.s.id} (${Object.keys(pages).length} pages)`);
}
console.log("deep-crawl: done");
