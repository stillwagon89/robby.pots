// Polite fetch for the structured-data adapters: obeys robots.txt, one request per second per site, short timeouts.
const UA = "FlamingClayFiringsBot/0.1 (+https://flamingclay.com)";
const robots = new Map();
const last = new Map();
function parseRobots(text) {
  const groups = []; let cur = null;
  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*/, "").trim(); const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [], delay: 0 }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (cur && (k === "allow" || k === "disallow")) cur.rules.push({ allow: k === "allow", path: v });
    else if (cur && k === "crawl-delay") cur.delay = Math.min(Number(v) || 0, 10);
  }
  const mine = groups.find((g) => g.agents.some((a) => UA.toLowerCase().includes(a) && a !== "*")) || groups.find((g) => g.agents.includes("*"));
  return mine || { rules: [], delay: 0 };
}
async function robotsFor(origin) {
  if (robots.has(origin)) return robots.get(origin);
  let g = { rules: [], delay: 0 };
  try { const r = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }); if (r.ok) g = parseRobots(await r.text()); } catch { /* none */ }
  robots.set(origin, g); return g;
}
const ruleMatches = (rule, path) => new RegExp("^" + rule.path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")).test(path);
export async function allowed(url) {
  const u = new URL(url); const { rules } = await robotsFor(u.origin); const path = u.pathname + u.search;
  const hits = rules.filter((r) => r.path && ruleMatches(r, path)).sort((x, y) => y.path.length - x.path.length || Number(y.allow) - Number(x.allow));
  return !hits.length || hits[0].allow;
}
export async function get(url, { accept = "*/*", maxBytes = 3e6 } = {}) {
  try {
    if (!(await allowed(url))) return { ok: false, robots: true, status: 0, text: "" };
    const u = new URL(url); const { delay } = await robotsFor(u.origin);
    const wait = (last.get(u.origin) || 0) + Math.max(1000, delay * 1000) - Date.now(); if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last.set(u.origin, Date.now());
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept }, redirect: "follow", signal: AbortSignal.timeout(15000) });
    const text = (await res.text()).slice(0, maxBytes);
    return { ok: res.ok, status: res.status, text, type: res.headers.get("content-type") || "", url: res.url };
  } catch (e) { return { ok: false, status: 0, text: "", error: e.message }; }
}
