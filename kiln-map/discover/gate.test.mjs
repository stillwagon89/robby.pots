// node kiln-map/discover/gate.test.mjs : checks the evidence gate against known good and bad cases (gold.json).
import fs from "node:fs";
import { gate } from "./gate.mjs";
const gold = JSON.parse(fs.readFileSync(new URL("./gold.json", import.meta.url), "utf8"));
let bad = 0;
for (const g of gold) {
  const r = gate({ decision: "qualifies", quote: g.quote, firing_types: g.claimed }, g.page);
  const ok = r.decision === g.expect && JSON.stringify(r.supported) === JSON.stringify(g.expectTypes);
  if (!ok) bad++;
  console.log(ok ? "PASS" : "FAIL", g.name, "->", r.decision, r.supported.join(",") || "-");
}
process.exit(bad ? 1 : 0);
