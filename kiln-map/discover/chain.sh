#!/bin/bash
# Free pipeline for states (no Tavily): ddg search -> fetch -> local judge -> report.  chain.sh IL MN ...
cd "$(dirname "$0")/../.."
for ST in "$@"; do
  l=$(echo $ST | tr A-Z a-z)
  for stage in ${STAGES:-search fetch judge}; do
    [ "$stage" = search ] && [ -s kiln-map/research/cache/$l/search.json ] && continue
    SEARCH=ddg caffeinate -i node --dns-result-order=ipv4first kiln-map/discover/run.mjs $ST --stage=$stage >> kiln-map/research/cache/$l-chain.log 2>&1
  done
  echo "DONE $ST: $(tail -1 kiln-map/research/cache/$l-chain.log)"
done
echo CHAIN FINISHED
