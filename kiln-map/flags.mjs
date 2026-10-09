// Pulls every "Is this listing wrong?" flag saved by the live site (Cloudflare KV, prefix "flag:") into kiln-map/FLAGS.md.
//   npm run kiln:flags      (needs wrangler logged in on this Mac)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const KM = path.dirname(fileURLToPath(import.meta.url));
const NS = "7b0f4b621ce34b8690381da48a85397f"; // GALLERY_CACHE
const wr = (...a) => execFileSync("npx", ["wrangler@4", "kv", "key", ...a, "--namespace-id", NS, "--remote"], { encoding: "utf8", maxBuffer: 50e6, cwd: path.join(KM, "..") });
const keys = JSON.parse(wr("list", "--prefix", "flag:")).map((k) => k.name).sort().reverse();
const rows = keys.map((k) => { try { return JSON.parse(wr("get", k)); } catch { return null; } }).filter(Boolean);
let out = `# Flagged listings (${rows.length})\n\nFlags never remove anything. Newest first. Generated ${new Date().toISOString()}.\n`;
for (const f of rows) out += `\n- **${f.at.slice(0, 16).replace("T", " ")} UTC** ${f.place_name || f.place_id}${f.title ? ` / ${f.title}` : ""}\n  Section: ${f.section || "(place)"}; shown: "${(f.shown_text || "").slice(0, 200)}"\n  Source: ${f.source_url || "-"}; page: ${f.page_url}\n`;
fs.writeFileSync(path.join(KM, "FLAGS.md"), out);
console.log(`${rows.length} flags written to kiln-map/FLAGS.md`);
