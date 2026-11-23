// Builds the studio outreach list: the places most worth asking, each with its private update link and a short message.
//   node kiln-map/outreach.mjs [--top 100]
// Output goes to kiln-map/outreach-private/ (gitignored: the links are keys to edit listings).
//   outreach.csv       name, city, state, how to reach them, email, update link, message
//   OUTREACH-LIST.md   same, readable, with the message text
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ownerLink, setting } from "./owner-lib.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SECRET = setting("OWNER_SECRET");
if (!SECRET) { console.error("Set OWNER_SECRET (in .dev.vars) first."); process.exit(1); }
const top = Number(process.argv[process.argv.indexOf("--top") + 1]) || 100;
const data = JSON.parse(readFileSync(join(ROOT, "..", "site", "data", "firings.json"), "utf8"));
const today = new Date().toISOString().slice(0, 10);
const done = (() => { try { return JSON.parse(readFileSync(join(ROOT, "data", "owner-confirmed.json"), "utf8")); } catch { return {}; } })();

const score = (p) => {
  const up = (p.opportunities || []).filter((o) => o.start_date && o.start_date >= today).length;
  return (up ? 5 + Math.min(up, 3) : 0) + (p.access?.status === "ongoing" ? 2 : 0) + (p.evidence_level === "confirmed" ? 2 : 0) + (p.contact?.email ? 3 : p.contact?.instagram ? 1 : 0) + (p.freshness === "stale" ? 1 : 0);
};
const ranked = data.places.filter((p) => !done[p.id]).map((p) => ({ p, s: score(p) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, top);

const msg = (p, link) => `Hi, I'm Robby, a potter who runs flamingclay.com. I keep a free map of places where potters can join non-electric firings (raku, soda, wood, salt, pit). ${p.org} is on it, and I want it to be right. Two minutes here lets you correct it and post your next firing yourself: ${link}\nIf you'd rather not be listed, just reply and I'll take it off. Thanks, Robby`;
const way = (p) => p.contact?.email ? "email" : p.contact?.instagram ? `instagram @${p.contact.instagram}` : p.contact?.website ? `website form ${p.contact.website}` : "no contact found";
const csvq = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const rows = ranked.map(({ p }) => { const link = ownerLink(SECRET, p.id); return { p, link, text: msg(p, link) }; });
mkdirSync(join(ROOT, "outreach-private"), { recursive: true });
writeFileSync(join(ROOT, "outreach-private", "outreach.csv"), ["name,city,state,reach_by,email,update_link,message", ...rows.map((r) => [r.p.org, r.p.city, r.p.state, way(r.p), r.p.contact?.email || "", r.link, r.text].map(csvq).join(","))].join("\n") + "\n");
writeFileSync(join(ROOT, "outreach-private", "OUTREACH-LIST.md"), `# Outreach list (${rows.length})\n\nPrivate: each link edits that place's listing. Send from your own email or Instagram.\n\n` + rows.map((r, i) => `## ${i + 1}. ${r.p.org} (${r.p.city || r.p.state})\nReach by: ${way(r.p)}\n\n${r.text}\n`).join("\n"));
console.log(`${rows.length} places written to kiln-map/outreach-private/ (${rows.filter((r) => r.p.contact?.email).length} with an email address).`);
