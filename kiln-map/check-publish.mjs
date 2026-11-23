// Safety gate for unattended publishing. Compares the freshly built site/data/firings.json with the version in git
// (HEAD) and exits 1 if something looks broken, so the weekly job falls back to a review PR instead of going live.
//
//   node kiln-map/check-publish.mjs
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const fail = (m) => { console.error(`PUBLISH CHECK FAILED: ${m}`); process.exit(1); };
let next;
try { next = JSON.parse(readFileSync("site/data/firings.json", "utf8")); } catch (e) { fail(`new firings.json does not parse: ${e.message}`); }
let prev = null;
try { prev = JSON.parse(execSync("git show HEAD:site/data/firings.json", { encoding: "utf8", maxBuffer: 1 << 28 })); } catch { /* first build */ }

const places = next.places || [];
if (!places.length) fail("no places");
const bad = places.filter((p) => !p.id || !p.org);
if (bad.length) fail(`${bad.length} places missing id or name`);
// Places without a pin are allowed (the page lists them without a map marker), but the share must not grow.
const noPin = (d) => d.places.filter((p) => typeof p.lat !== "number" || typeof p.lng !== "number").length;

if (prev) {
  const pc = prev.places.length, nc = places.length;
  if (nc < pc * 0.9) fail(`place count fell from ${pc} to ${nc} (more than 10%)`);
  const count = (d) => d.places.reduce((n, p) => n + (p.opportunities || []).length, 0);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (d) => d.places.reduce((n, p) => n + (p.opportunities || []).filter((o) => !o.start_date || o.start_date >= today).length, 0);
  if (upcoming(next) < upcoming(prev) * 0.6) fail(`upcoming listings fell from ${upcoming(prev)} to ${upcoming(next)} (more than 40%)`);
  if (noPin(next) > noPin(prev) + 5) fail(`places without map coordinates grew from ${noPin(prev)} to ${noPin(next)}`);
  const ids = new Set(places.map((p) => p.id));
  const lost = prev.places.filter((p) => !ids.has(p.id)).length;
  if (lost > pc * 0.05) fail(`${lost} places disappeared (more than 5%)`);
  console.log(`ok: ${pc} -> ${nc} places, ${count(prev)} -> ${count(next)} listings, ${upcoming(prev)} -> ${upcoming(next)} upcoming.`);
} else console.log(`ok: ${places.length} places (no previous build to compare).`);
