#!/bin/bash
# Runs discovery for each state in order; stops when Tavily credits run low. Keeps the Mac awake.
cd "$(dirname "$0")/../.."
K=$(grep '^TAVILY_API_KEY=' .dev.vars | tail -1 | cut -d= -f2-)
for ST in "$@"; do
  left=$(curl -s -m 30 https://api.tavily.com/usage -H "Authorization: Bearer $K" | python3 -c "import sys,json;a=json.load(sys.stdin)['account'];print(a['plan_limit']-a['plan_usage'])" 2>/dev/null || echo 0)
  if [ "${left:-0}" -lt 110 ]; then echo "STOP: only $left Tavily credits left before $ST"; break; fi
  echo "START $ST ($left credits left)"
  caffeinate -i node --dns-result-order=ipv4first --network-family-autoselection-attempt-timeout=3000 kiln-map/discover/run.mjs "$ST" > "kiln-map/research/cache/$(echo $ST | tr A-Z a-z)-run.log" 2>&1
  echo "DONE $ST: $(tail -1 kiln-map/research/cache/$(echo $ST | tr A-Z a-z)-run.log)"
done
echo "BATCH FINISHED"
