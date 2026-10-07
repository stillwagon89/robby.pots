#!/bin/bash
# Full free pipeline per state: search (ddg) -> fetch -> local judge -> auto-ledger -> promote.  pipeline.sh [--wait-for chain2.log] ST ...
# Run verify.mjs --apply afterwards, then geocode + build.
cd "$(dirname "$0")/../.."
WAIT=""
if [ "$1" = "--wait-for" ]; then WAIT="$2"; shift 2; fi
for ST in "$@"; do
  l=$(echo $ST | tr A-Z a-z)
  if [ -n "$WAIT" ]; then until grep -q "^DONE $ST:" kiln-map/research/cache/$WAIT; do sleep 30; done; fi
  for stage in search fetch judge; do
    [ "$stage" = search ] && [ -s kiln-map/research/cache/$l/search.json ] && continue
    SEARCH=ddg caffeinate -i node --dns-result-order=ipv4first kiln-map/discover/run.mjs $ST --stage=$stage >> kiln-map/research/cache/$l-chain.log 2>&1
  done
  node kiln-map/discover/auto-ledger.mjs $ST >> kiln-map/research/cache/pipeline.log 2>&1 && node kiln-map/discover/promote.mjs $ST >> kiln-map/research/cache/pipeline.log 2>&1
  echo "DONE $ST: $(tail -1 kiln-map/research/cache/$l-chain.log)" 
done
echo PIPELINE FINISHED
