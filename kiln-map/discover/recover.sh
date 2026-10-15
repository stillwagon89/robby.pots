#!/bin/bash
# Gate-problem recovery: per state, keep candidates whose trimmed cached pages named no firing type (RELAX), add them as weak sources,
# then re-read each one's whole live site (verify --live). Usage: recover.sh ST ...
cd "$(dirname "$0")/../.."
for ST in "$@"; do
  RELAX=1 node kiln-map/discover/auto-ledger.mjs $ST >> kiln-map/research/cache/recover.log 2>&1
  node kiln-map/discover/promote.mjs $ST >> kiln-map/research/cache/recover.log 2>&1
  python3 - "$ST" <<'PY'
import json,sys
st=sys.argv[1]; p=f'kiln-map/sources/{st}.json'
d=json.load(open(p))
for s in d['sources']:
    if not s.get('verify') and s.get('review')=='pending' and 'discovery v3 on' in (s.get('notes') or ''): s['weak']=True
json.dump(d,open(p,'w'),indent=2); open(p,'a').write('\n')
PY
  VERIFY_PROVIDER=claude node --dns-result-order=ipv4first kiln-map/discover/verify.mjs --live --apply $ST >> kiln-map/research/cache/recover.log 2>&1
  echo "DONE $ST" >> kiln-map/research/cache/recover.log
done
echo RECOVER FINISHED >> kiln-map/research/cache/recover.log
