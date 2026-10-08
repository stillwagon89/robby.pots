#!/bin/bash
# Same as reverify-all.sh but with the free hosted models (no Anthropic credit), one state at a time so results are saved as they finish.
cd "$(dirname "$0")/../.."
ALL="AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
for ST in $ALL; do [ -f kiln-map/research/cache/$(echo $ST | tr A-Z a-z)/places.json ] && node kiln-map/discover/auto-ledger.mjs $ST && node kiln-map/discover/promote.mjs $ST; done
for ST in $ALL; do
  VERIFY_WORKERS=3 node kiln-map/discover/verify.mjs --apply --force $ST >> kiln-map/research/cache/reverify-free.log 2>&1
  node kiln-map/discover/locate.mjs --apply $ST >> kiln-map/research/cache/reverify-free.log 2>&1
  echo "DONE $ST $(date -u +%H:%M)" >> kiln-map/research/cache/reverify-free.progress
done
echo REVERIFY FINISHED >> kiln-map/research/cache/reverify-free.progress
