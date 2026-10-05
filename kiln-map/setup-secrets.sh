#!/bin/bash
# One-time setup for the weekly Kiln Locator crawl. Robby runs this himself:
#   bash kiln-map/setup-secrets.sh
# 1. Copies the Anthropic API key from .dev.vars into the GitHub repo's secrets.
# 2. Makes a new random password for the newsletter inbox and stores it in three places:
#    the inbox Worker, GitHub secrets, and .dev.vars (for local runs).
# Nothing is printed to the screen.
set -euo pipefail
cd "$(dirname "$0")/.."

KEY=$(grep -E '^ANTHROPIC_API_KEY' .dev.vars | cut -d= -f2- | tr -d '"' | tr -d ' ')
if [ -z "$KEY" ]; then echo "No ANTHROPIC_API_KEY in .dev.vars"; exit 1; fi
printf '%s' "$KEY" | gh secret set ANTHROPIC_API_KEY
echo "1/3 Anthropic key saved to GitHub."

TOKEN=$(openssl rand -hex 32)
printf '%s' "$TOKEN" | (cd kiln-inbox && npx -y wrangler@latest secret put INBOX_TOKEN >/dev/null)
echo "2/3 Inbox password saved to the inbox Worker."

printf '%s' "$TOKEN" | gh secret set KILN_INBOX_TOKEN
grep -v '^KILN_INBOX_TOKEN' .dev.vars > .dev.vars.tmp || true
printf 'KILN_INBOX_TOKEN=%s\n' "$TOKEN" >> .dev.vars.tmp && mv .dev.vars.tmp .dev.vars
echo "3/3 Inbox password saved to GitHub and .dev.vars."
echo "Done."
