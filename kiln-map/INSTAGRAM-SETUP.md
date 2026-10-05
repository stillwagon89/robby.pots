# Instagram for the Kiln Locator: one-time setup

The weekly crawl can read recent public posts from kilns' Instagram accounts using Meta's official
**Business Discovery** API. It reads them *through your own* Instagram professional account, so it needs a
token from you. No scraping. Limits:

- It only works for accounts that are **Business or Creator** accounts. Personal accounts can't be read; the review list says so.
- It sees captions, dates and post links, not images or stories.
- The token lasts **60 days**. When it expires, the weekly review shows "Instagram problems" and you redo step 5.

Meta changes these screens often (checked 2026-10-05). If a step doesn't match, send me a screenshot and I'll adjust.

If the test in step 8 fails with a permissions error and your Page is managed through Meta Business Suite, go back to step 4.4 and also add `ads_read`.

## Steps (about 20 minutes, once)

1. **Make @flaming.clay a professional account.** In the Instagram app: Settings → Account type and tools → Switch to professional account (Creator or Business).
2. **Connect it to a Facebook Page.** Instagram → Edit profile → Page → connect or create one. Graph API access needs this link.
3. **Create a Meta developer app.** (You accept Meta's developer terms here, so this one is yours to do.)
   1. Go to https://developers.facebook.com and log in with the Facebook account that manages your Page.
   2. Click **My Apps** (top right), then **Create App**.
   3. Skip connecting a business portfolio if asked, and click **Next**.
   4. For the use case, pick **Other**, then **Next**. Don't pick the Instagram use case: that one uses "Instagram Login", which can't read other kilns' posts.
   5. For app type, pick **Business**, then **Next**.
   6. Name it "Flaming Clay Kiln Locator", check your email, and click **Create App**.
   7. On the app's dashboard, find **Facebook Login for Business** and click **Set up**, then **Save changes** at the bottom.
4. **Get a token.**
   1. Open the Graph API Explorer: https://developers.facebook.com/tools/explorer/ (or **Tools** → **Graph API Explorer** in the top menu).
   2. On the right, under **Meta App**, pick "Flaming Clay Kiln Locator".
   3. Under **User or Page**, pick **Get User Access Token** (it may already say "User Token").
   4. In **Permissions**, type and add each of these, one at a time: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`, `business_management`.
   5. Click **Generate Access Token**. In the pop-up, choose your business (if asked), the Facebook Page linked to @flaming.clay, and the @flaming.clay Instagram account, then finish.
   6. The token appears in the **Access Token** box at the top. It only lasts an hour, so do step 5 right away.
5. **Make it last 60 days.** Copy the token, open https://developers.facebook.com/tools/debug/accesstoken/, paste it, click **Debug**, then **Extend Access Token** at the bottom. Copy the new, longer token.
6. **Find your Instagram account ID.** Back in Graph API Explorer, paste this into the box next to **GET** and click **Submit**:
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
