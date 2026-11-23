// Shared helpers for the studio-owner loop: settings lookup and the owner link token (must match functions/api/kiln-owner.ts).
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

export const SITE = process.env.KILN_SITE || "https://flamingclay.com";
let devVars = null;
export function setting(name) {
  if (process.env[name]) return process.env[name];
  if (!devVars) {
    devVars = {};
    const roots = [process.cwd()];
    try { roots.push(join(execSync("git rev-parse --git-common-dir", { encoding: "utf8" }).trim(), "..")); } catch { /* not a git checkout */ }
    for (const r of roots) { const f = join(r, ".dev.vars"); if (existsSync(f)) for (const l of readFileSync(f, "utf8").split("\n")) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !(m[1] in devVars)) devVars[m[1]] = m[2].trim(); } }
  }
  return devVars[name] || "";
}
export const ownerToken = (secret, placeId) => createHmac("sha256", secret).update(`kiln-owner:${placeId}`).digest("hex").slice(0, 24);
export const ownerLink = (secret, placeId) => `${SITE}/kiln-update.html?p=${encodeURIComponent(placeId)}&t=${ownerToken(secret, placeId)}`;
