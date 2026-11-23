// Finds machine-readable event sources on a place's pages (no AI): schema.org Event JSON-LD, calendar (.ics) feeds,
// WordPress "The Events Calendar" API, Google Calendar embeds, Squarespace/Eventbrite/Bookeo listings.
export function jsonLdEvents(html) {
  const out = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let j; try { j = JSON.parse(m[1].trim()); } catch { continue; }
    const walk = (n) => {
      if (!n || typeof n !== "object") return;
      if (Array.isArray(n)) return n.forEach(walk);
      const t = [].concat(n["@type"] || []);
      if (t.some((x) => /Event$/.test(x))) out.push(n);
      if (n["@graph"]) walk(n["@graph"]);
      if (n.itemListElement) walk(n.itemListElement);
      if (n.item) walk(n.item);
      if (n.subEvent) walk(n.subEvent);
    };
    walk(j);
  }
  return out;
}
export function signals(html, baseUrl) {
  const s = new Set(); const links = [];
  const abs = (h) => { try { return new URL(h, baseUrl).href; } catch { return null; } };
  for (const m of html.matchAll(/<(?:a|link)\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi)) {
    const h = m[1]; const tag = m[0];
    if (/\.ics(\?|$)/i.test(h) || /^webcal:/i.test(h) || /type=["']text\/calendar/i.test(tag)) { s.add("ics"); links.push(["ics", abs(h.replace(/^webcal:/i, "https:"))]); }
    else if (/eventbrite\.[a-z.]+\/(o|e)\//i.test(h)) { s.add("eventbrite"); links.push(["eventbrite", abs(h)]); }
    else if (/bookeo\.com/i.test(h)) { s.add("bookeo"); links.push(["bookeo", abs(h)]); }
    else if (/calendar\.google\.com\/calendar\/(embed|ical)/i.test(h)) { s.add("gcal"); links.push(["gcal", abs(h)]); }
    else if (/(application\/rss|application\/atom)/i.test(tag)) { s.add("feed"); links.push(["feed", abs(h)]); }
  }
  for (const m of html.matchAll(/calendar\.google\.com\/calendar\/(?:embed|u\/\d\/embed)\?[^"'\s>]*src=([^&"'\s>]+)/gi)) { s.add("gcal"); links.push(["gcal", decodeURIComponent(m[1])]); }
  if (/wp-content\/plugins\/the-events-calendar|tribe-events|tribe_events/i.test(html)) s.add("tribe");
  if (/wp-content\/plugins\/modern-events-calendar|mec-event/i.test(html)) s.add("mec");
  if (/static1\.squarespace\.com|squarespace-cdn/i.test(html)) s.add("squarespace");
  if (/class=["'][^"']*eventlist|sqs-block-calendar|data-block-type=["']\d+["'][^>]*events/i.test(html)) s.add("sq-events");
  if (/wix(static|sites)\.com|wixapps/i.test(html) && /event/i.test(html)) s.add("wix-events");
  if (/mindbodyonline|mindbody\.io|healcode/i.test(html)) s.add("mindbody");
  if (/squareup\.com\/appointments|square\.site/i.test(html)) s.add("square");
  if (/meetup\.com\//i.test(html)) s.add("meetup");
  return { signals: [...s], links };
}
