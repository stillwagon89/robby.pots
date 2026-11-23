// node kiln-map/structured/events.test.mjs
import assert from "node:assert/strict";
import { parseIcs, fromJsonLd, fromTribe, toItem } from "./events.mjs";
import { jsonLdEvents } from "./detect.mjs";
const src = { id: "t", org: "Test Studio", urls: ["https://example.com/"] };
const today = "2026-11-23";

const ics = `BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:Spring Raku Firing\r\nDESCRIPTION:Bring your bisque. We will raku fire on\r\n  Saturday. $45 per person.\r\nDTSTART;VALUE=DATE:20270320\r\nDTEND;VALUE=DATE:20270322\r\nURL:https://example.com/raku\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Wheel Throwing 101\r\nDTSTART:20270101T100000Z\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Weekly raku night\r\nDTSTART:20270105T180000Z\r\nRRULE:FREQ=WEEKLY\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nSUMMARY:Old soda firing\r\nDTSTART:20200101\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const ev = parseIcs(ics);
assert.equal(ev.length, 4);
assert.equal(ev[0].end, "2027-03-21", "all-day DTEND is exclusive");
const items = ev.map((e) => toItem(src, e, "ics", today)).filter(Boolean);
assert.equal(items.length, 1, "only the dated, non-recurring, firing-named, future event survives");
assert.equal(items[0].firing_type, "raku");
assert.equal(items[0].start_date, "2027-03-20");
assert.equal(items[0].cost_text, "$45");

const html = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"Event","name":"Wood Firing Weekend","startDate":"2027-05-01T09:00","endDate":"2027-05-03","eventAttendanceMode":"https://schema.org/OfflineEventAttendanceMode","offers":{"price":"250","priceCurrency":"USD","availability":"https://schema.org/SoldOut","url":"https://example.com/wood"}},{"@type":"Event","name":"Online Raku Talk","startDate":"2027-05-05","eventAttendanceMode":"https://schema.org/OnlineEventAttendanceMode"}]}</script>`;
const ld = fromJsonLd(jsonLdEvents(html));
assert.equal(ld.length, 2);
const li = ld.map((e) => toItem(src, e, "jsonld", today)).filter(Boolean);
assert.equal(li.length, 1);
assert.equal(li[0].registration_status, "sold_out");
assert.equal(li[0].cost_text, "$250");

const tr = fromTribe({ events: [{ title: "Soda &amp; Salt Firing", description: "<p>Members only soda firing.</p>", start_date: "2027-06-10 09:00:00", end_date: "2027-06-11 17:00:00", url: "https://example.com/e/1", cost: "$90" }] });
const ti = toItem(src, tr[0], "tribe", today);
assert.equal(ti.audience, "members_only");
assert.equal(ti.end_date, "2027-06-11");
const bad = [
  { title: "Pizza & Pints Special", description: "Wood-fired pizza and beer.", start: "2027-01-01", end: "2027-01-01" },
  { title: "Chamber Orchestra", description: "Rake the leaves, raku.", start: "2027-01-01", end: "2027-01-01" },
  { title: "Intro to Wheel Throwing", description: "Pieces are fired in a wood kiln later.", start: "2027-01-01", end: "2027-01-01" },
  { title: "Lime Mortar Workshop", description: "Use rakes and rake joints.", start: "2027-01-01", end: "2027-01-01" },
];
for (const b of bad) assert.equal(toItem(src, b, "t", today), null, b.title);
const good = toItem(src, { title: "Raku Night &#8211; Fall &amp; Fun", description: "Glaze and fire.", start: "2027-01-01", end: "2027-01-01" }, "t", today);
assert.equal(good.title, "Raku Night \u2013 Fall & Fun");
console.log("structured events: all tests pass");
