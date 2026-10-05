// Kiln Locator sources, one file per state: kiln-map/sources/<STATE>.json, each { "sources": [...] }.
// Every source gets `state` (from its file) and `tz` (its own, else the state's main time zone).
// See kiln-map/US-EXPANSION-PLAN.md (Phase 0).
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(dirname(fileURLToPath(import.meta.url)), "sources");

// Name and main time zone per state. States split across zones (e.g. OR, ID, TX, FL) can set `tz` per source.
export const STATES = {
  AL: ["Alabama", "America/Chicago"], AK: ["Alaska", "America/Anchorage"], AZ: ["Arizona", "America/Phoenix"],
  AR: ["Arkansas", "America/Chicago"], CA: ["California", "America/Los_Angeles"], CO: ["Colorado", "America/Denver"],
  CT: ["Connecticut", "America/New_York"], DE: ["Delaware", "America/New_York"], DC: ["District of Columbia", "America/New_York"],
  FL: ["Florida", "America/New_York"], GA: ["Georgia", "America/New_York"], HI: ["Hawaii", "Pacific/Honolulu"],
  ID: ["Idaho", "America/Boise"], IL: ["Illinois", "America/Chicago"], IN: ["Indiana", "America/Indiana/Indianapolis"],
  IA: ["Iowa", "America/Chicago"], KS: ["Kansas", "America/Chicago"], KY: ["Kentucky", "America/New_York"],
  LA: ["Louisiana", "America/Chicago"], ME: ["Maine", "America/New_York"], MD: ["Maryland", "America/New_York"],
  MA: ["Massachusetts", "America/New_York"], MI: ["Michigan", "America/Detroit"], MN: ["Minnesota", "America/Chicago"],
  MS: ["Mississippi", "America/Chicago"], MO: ["Missouri", "America/Chicago"], MT: ["Montana", "America/Denver"],
  NE: ["Nebraska", "America/Chicago"], NV: ["Nevada", "America/Los_Angeles"], NH: ["New Hampshire", "America/New_York"],
  NJ: ["New Jersey", "America/New_York"], NM: ["New Mexico", "America/Denver"], NY: ["New York", "America/New_York"],
  NC: ["North Carolina", "America/New_York"], ND: ["North Dakota", "America/Chicago"], OH: ["Ohio", "America/New_York"],
  OK: ["Oklahoma", "America/Chicago"], OR: ["Oregon", "America/Los_Angeles"], PA: ["Pennsylvania", "America/New_York"],
  RI: ["Rhode Island", "America/New_York"], SC: ["South Carolina", "America/New_York"], SD: ["South Dakota", "America/Chicago"],
  TN: ["Tennessee", "America/Chicago"], TX: ["Texas", "America/Chicago"], UT: ["Utah", "America/Denver"],
  VT: ["Vermont", "America/New_York"], VA: ["Virginia", "America/New_York"], WA: ["Washington", "America/Los_Angeles"],
  WV: ["West Virginia", "America/New_York"], WI: ["Wisconsin", "America/Chicago"], WY: ["Wyoming", "America/Denver"],
};
export const stateName = (code) => STATES[code]?.[0] || code;

// Today's date (YYYY-MM-DD) where the place is, so a firing "ends today" at the right local midnight.
export const todayIn = (tz) => new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/Los_Angeles" }).format(new Date());

export function loadSources() {
  if (!existsSync(DIR)) throw new Error(`Missing ${DIR}`);
  const out = [];
  for (const f of readdirSync(DIR).filter((f) => /^[A-Z]{2}\.json$/.test(f)).sort()) {
    const state = f.slice(0, 2);
    if (!STATES[state]) throw new Error(`Unknown state file ${f}`);
    for (const s of JSON.parse(readFileSync(join(DIR, f), "utf8")).sources) out.push({ ...s, state, tz: s.tz || STATES[state][1] });
  }
  const ids = new Set();
  for (const s of out) {
    if (ids.has(s.id)) throw new Error(`Duplicate source id ${s.id}`);
    ids.add(s.id);
  }
  return out;
}

// Writes sources back to their state files (used by geocode). `state` and the default `tz` aren't stored.
export function saveSources(sources) {
  const byState = new Map();
  for (const s of sources) {
    const { state, tz, ...rest } = s;
    if (tz && tz !== STATES[state][1]) rest.tz = tz;
    if (!byState.has(state)) byState.set(state, []);
    byState.get(state).push(rest);
  }
  for (const [state, list] of byState) {
    const file = join(DIR, `${state}.json`);
    const rest = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}; // keeps notes like "_note"
    writeFileSync(file, JSON.stringify({ ...rest, sources: list }, null, 2) + "\n");
  }
}
