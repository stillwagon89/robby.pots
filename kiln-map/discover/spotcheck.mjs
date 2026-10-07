// Live spot check: fetch N random pending places' own pages today and test (in code) that the site is reachable,
// names the state, and still mentions each claimed firing type.  node kiln-map/discover/spotcheck.mjs [N]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TYPE_RE } from "./gate.mjs";
import { stateName } from "../sources.mjs";
const KM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const N = +process.argv[2] || 30;
const all = [];
for (const f of fs.readdirSync(path.join(KM, "sources")).filter((f) => /^[A-Z]{2}\.json$/.test(f)))
  for (const s of JSON.parse(fs.readFileSync(path.join(KM, "sources", f), "utf8")).sources) if (s.review === "pending" && s.discovered && s.verify && !s.weak) all.push({ ST: f.slice(0, 2), s });
const pick = all.sort(() => Math.random() - 0.5).slice(0, N);
const txt = (h) => h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ");
let bad = 0;
const rows = [];
for (const { ST, s } of pick) {
  const urls = [s.access?.url, s.contact?.website].filter(Boolean).filter((u, i, a) => a.indexOf(u) === i);
  let text = "", status = "unreachable";
  for (const u of urls) { try { const r = await fetch(u, { redirect: "follow", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Mozilla/5.0 FlamingClayFiringsBot/0.1" } }); status = r.status; if (r.ok) text += " " + txt(await r.text()); } catch (e) { status = String(e.cause?.code || e.name); } }
  const types = s.firing_types_guess || [];
  const missing = types.filter((t) => !TYPE_RE[t].test(text));
  const stateSeen = new RegExp(`${stateName(ST)}|,\\s*${ST}\\b`, "i").test(text);
  const flag = status !== 200 || missing.length || !stateSeen;
  if (flag) bad++;
  rows.push(`${flag ? "CHECK" : "ok   "} ${ST} ${s.org} | ${status} | missing: ${missing.join(",") || "-"} | state on page: ${stateSeen}`);
}
const out = `# Spot check ${new Date().toISOString().slice(0, 10)}: ${bad}/${pick.length} flagged\n\n` + rows.join("\n") + "\n";
fs.writeFileSync(path.join(KM, "research/cache/spotcheck.md"), out);
console.log(out);
