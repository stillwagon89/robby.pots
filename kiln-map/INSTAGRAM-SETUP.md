# Instagram for the Kiln Locator: one-time setup

The weekly crawl can read recent public posts from kilns' Instagram accounts using Meta's official
**Business Discovery** API. It reads them *through your own* Instagram professional account, so it needs a
token from you. No scraping. Limits:

- It only works for accounts that are **Business or Creator** accounts. Personal accounts can't be read; the review list says so.
- It sees captions, dates and post links, not images or stories.
- The token lasts **60 days**. When it expires, the weekly review shows "Instagram problems" and you redo step 5.

Meta changes these screens often. If a step doesn't match, tell me what you see and I'll adjust.

## Steps (about 20 minutes, once)

1. **Make @flaming.clay a professional account.** In the Instagram app: Settings → Account type and tools → Switch to professional account (Creator or Business).
2. **Connect it to a Facebook Page.** Instagram → Edit profile → Page → connect or create one. Graph API access needs this link.
3. **Create a Meta developer app.** Go to developers.facebook.com → My Apps → Create App → type "Business". Name it "Flaming Clay Kiln Locator". (You accept Meta's terms here, so this one is yours to do.)
4. **Get a token.** Tools → Graph API Explorer → choose your app → "Generate Access Token" and allow these permissions:
   `instagram_basic`, `pages_show_list`, `pages_read_engagement`, `business_management`.
5. **Make it last 60 days.** Tools → Access Token Debugger → paste the token → "Extend Access Token" → copy the new one.
6. **Find your Instagram account ID.** In Graph API Explorer, run:
   `me/accounts?fields=instagram_business_account{id,username}` and copy the `id` next to flaming.clay.
7. **Save both in GitHub** (paste when prompted; nothing is shown on screen):

```bash
gh secret set IG_ACCESS_TOKEN
```

```bash
gh secret set IG_USER_ID
```

8. Tell me it's done. I'll run a test crawl and check which kilns' accounts can be read.

## Which kilns get checked
Any place in `kiln-map/sources.json` with `contact.instagram` set. Posts from the last 120 days are read
alongside the website and newsletters, with the same evidence rules: a listing needs a verbatim quote from
the post, and its "Website" link goes to the post.
