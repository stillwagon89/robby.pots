# Deploying this site

- **Pushing to `main` deploys to production.** `.github/workflows/deploy.yml` runs `wrangler pages deploy site --project-name=robbypots` on every push to `main` (about 30s). Check with `gh run list --limit 3`.
- The Cloudflare Pages project is `robbypots` (robbypots.com, flamingclay.com, robbypots.pages.dev). It shows "Git Provider: No" in Cloudflare because deploys go through GitHub Actions, not Cloudflare's git integration. That is expected.
- **Do not run `wrangler pages deploy` manually.** It's unnecessary, and the permission classifier blocks it.
- Verify against `https://flamingclay.com/api/gallery`. `robbypots.com` returns a 301, so use `curl -L`.
- Functions (`functions/api/*.ts`) deploy with the site. The gallery feed is cached in KV (`gallery:v1`) for 60 seconds.
- Square payment links snapshot price/name at creation. `getOrCreatePaymentLink` includes them in its idempotency key so dashboard edits produce fresh links.
