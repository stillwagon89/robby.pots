#!/bin/bash
# Coverage fill from OpenStreetMap seeds (free) then Claude verify. Per state, saved as it goes.
cd "$(dirname "$0")/../.."
ALL="AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY"
for ST in $ALL; do
  l=$(echo $ST | tr A-Z a-z)
  node kiln-map/discover/dir-seed.mjs $ST >> kiln-map/research/cache/dir.log 2>&1
  node --dns-result-order=ipv4first kiln-map/discover/run.mjs $ST --stage=fetch >> kiln-map/research/cache/$l-dir.log 2>&1
  node kiln-map/discover/seed-judge.mjs $ST >> kiln-map/research/cache/seed.log 2>&1
  node kiln-map/discover/auto-ledger.mjs $ST >> kiln-map/research/cache/seed.log 2>&1 && node kiln-map/discover/promote.mjs $ST >> kiln-map/research/cache/seed.log 2>&1
  VERIFY_PROVIDER=claude VERIFY_WORKERS=4 node kiln-map/discover/verify.mjs --apply $ST >> kiln-map/research/cache/seed.log 2>&1
  echo "DONE $ST $(date -u +%H:%M)" >> kiln-map/research/cache/dir.progress
done
echo DIR FINISHED >> kiln-map/research/cache/dir.progress
