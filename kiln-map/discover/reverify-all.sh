#!/bin/bash
# After a rules change: rebuild every candidate from the caches, re-check everything with Claude, locate, agree, rebuild the dev map.
# Needs Anthropic API credit (~$3-6).   kiln-map/discover/reverify-all.sh
cd "$(dirname "$0")/../.."
ALL="AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
for ST in $ALL; do [ -f kiln-map/research/cache/$(echo $ST | tr A-Z a-z)/places.json ] && node kiln-map/discover/auto-ledger.mjs $ST && node kiln-map/discover/promote.mjs $ST; done
VERIFY_PROVIDER=claude VERIFY_WORKERS=4 node kiln-map/discover/verify.mjs --apply --force
node kiln-map/discover/locate.mjs --apply
node kiln-map/discover/agree.mjs --apply
npm run kiln:geocode && npm run kiln:build && node kiln-map/discover/pending-report.mjs
echo REVERIFY FINISHED
