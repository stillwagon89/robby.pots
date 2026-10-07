# Free web search for discovery when Tavily credits are out: python ddg_search.py "query" -> JSON [{url,title,snippet}]
import sys, json, time, random
from ddgs import DDGS
q = sys.argv[1]
for attempt in range(4):
    try:
        r = DDGS().text(q, max_results=10, region="us-en")
        print(json.dumps([{"url": x["href"], "title": x.get("title", ""), "snippet": x.get("body", "")} for x in r]))
        break
    except Exception as e:
        if attempt == 3:
            print(json.dumps({"error": str(e)[:200]}))
        time.sleep(4 * (attempt + 1) + random.random() * 3)
