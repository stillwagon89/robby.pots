// Fixes duplicate source ids across state files (same site twice = drop the later one; different site = rename). Run before geocode/build.
import fs from "node:fs";
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const dir = new URL("../sources/", import.meta.url);
const docs = {};
for (const f of fs.readdirSync(dir).filter((f) => /^[A-Z]{2}\.json$/.test(f))) docs[f.slice(0, 2)] = JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));
const seen = new Map(); let rm = 0, rn = 0;
for (const [st, d] of Object.entries(docs)) d.sources = d.sources.filter((s) => {
  if (!seen.has(s.id)) { seen.set(s.id, s); return true; }
  if (host(seen.get(s.id).contact?.website) === host(s.contact?.website)) { rm++; return false; }
  let n = `${s.id}-${st.toLowerCase()}`; while (seen.has(n)) n += "x"; s.id = n; seen.set(n, s); rn++; return true;
});
for (const [st, d] of Object.entries(docs)) fs.writeFileSync(new URL(`${st}.json`, dir), JSON.stringify(d, null, 2) + "\n");
console.log({ removedDupes: rm, renamed: rn });
