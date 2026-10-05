// Kiln Locator newsletter inbox. Cloudflare Email Routing sends kilns@flamingclay.com here.
// Each email is stored in KV (kept 180 days). The weekly crawl reads them with GET /messages,
// authenticated by the INBOX_TOKEN secret. See kiln-map/DESIGN-firings.md ("Newsletter inbox").
import PostalMime from "postal-mime";

const KEEP_SECONDS = 180 * 86400;
const MAX_TEXT = 60000;

function htmlToText(html) {
  return (html || "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

// Newsletters usually include a "view in browser" link: the only web page we can point potters to.
function webVersion(html) {
  for (const m of (html || "").matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    if (/view (this )?(email )?in (your )?browser|view online|web version|view as (a )?web ?page/i.test(m[2].replace(/<[^>]+>/g, " "))) return m[1];
  }
  return null;
}

export default {
  async email(message, env) {
    const parsed = await PostalMime.parse(message.raw);
    const text = (parsed.text || htmlToText(parsed.html)).slice(0, MAX_TEXT);
    const received = new Date().toISOString();
    const record = {
      received,
      from: (parsed.from?.address || message.from || "").toLowerCase(),
      from_name: parsed.from?.name || "",
      to: message.to,
      subject: parsed.subject || "",
      date: parsed.date || received,
      web_url: webVersion(parsed.html),
      text,
    };
    await env.INBOX.put(`msg:${received}:${crypto.randomUUID().slice(0, 8)}`, JSON.stringify(record), { expirationTtl: KEEP_SECONDS });
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/messages") return new Response("Not found", { status: 404 });
    if (!env.INBOX_TOKEN || request.headers.get("authorization") !== `Bearer ${env.INBOX_TOKEN}`) return new Response("Unauthorized", { status: 401 });
    const since = url.searchParams.get("since") || "";
    const out = [];
    let cursor;
    do {
      const page = await env.INBOX.list({ prefix: "msg:", cursor });
      for (const k of page.keys) if (k.name.slice(4) > since) out.push(await env.INBOX.get(k.name, "json"));
      cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return Response.json({ messages: out.filter(Boolean) });
  },
};
