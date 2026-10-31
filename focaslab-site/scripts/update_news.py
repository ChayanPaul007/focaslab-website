"""Add news items to data/site.json using the Gemini API.

Two sources:
  1. New journal / conference papers in data/publications.json (always works).
  2. FOCAS Lab's LinkedIn posts, found with Gemini's Google Search tool, or read from
     an RSS feed of the page if LINKEDIN_RSS_URL is set (more reliable).

Never destroys data: without GEMINI_API_KEY, or on any API error, site.json is left as is.
At most MAX_NEW items are added per run; data/news_state.json remembers what was already seen.
"""
import json, os, re, sys
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

import requests

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "data" / "site.json"
PUBS = ROOT / "data" / "publications.json"
STATE = ROOT / "data" / "news_state.json"
KEY = os.environ.get("GEMINI_API_KEY", "")
MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-latest")
LINKEDIN = os.environ.get("LINKEDIN_URL", "https://www.linkedin.com/in/focas-lab-644911386/")
RSS = os.environ.get("LINKEDIN_RSS_URL", "")
MAX_NEW = 4


def gemini(prompt, search=False):
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    if search:
        body["tools"] = [{"google_search": {}}]  # search grounding cannot be combined with JSON mode
    else:
        body["generationConfig"] = {"responseMimeType": "application/json"}
    r = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
                      headers={"x-goog-api-key": KEY}, json=body, timeout=120)
    r.raise_for_status()
    text = "".join(p.get("text", "") for p in r.json()["candidates"][0]["content"]["parts"])
    m = re.search(r"\[.*\]", text, re.S)
    return json.loads(m.group(0)) if m else []


def is_paper(venue):
    return venue and not re.search(r"arxiv|preprint|e-prints", venue, re.I)


def paper_news(pubs, seen):
    new = [p for p in pubs if p["id"] not in seen and is_paper(p.get("venue"))]
    if not new:
        return []
    listing = "\n".join(f"- {p['title']} | {p['venue']} | {p['year']}" for p in new)
    return gemini(f"""These papers from FOCAS Lab (IISc, PI Pushpak Jagtap) just appeared on Google Scholar:
{listing}

Write short news lines for a lab website. Group papers in the same venue into one line
(e.g. "Three papers accepted at CDC 2026."). Name the venue in full the way a researcher would
(e.g. "IEEE Transactions on Automatic Control", "IROS 2026"). Do not list titles unless there is a single paper,
and even then keep it under 25 words. Plain, factual tone, no hype, no emojis.
Return a JSON array of objects: {{"date": "<Mon YYYY or YYYY>", "text": "<one sentence>"}}.""")


def rss_posts():
    r = requests.get(RSS, timeout=60)
    r.raise_for_status()
    out = []
    for it in ElementTree.fromstring(r.content).iter("item"):
        g = lambda t: (it.findtext(t) or "").strip()
        out.append({"url": g("link"), "date": g("pubDate"), "text": re.sub(r"<[^>]+>", " ", g("description"))[:1500]})
    return out[:15]


def linkedin_news(existing, seen_urls):
    rules = """Keep only real lab news: awards, thesis defences, paper acceptances, talks, new members,
grants, visits, events, demos. Skip reposts of other people's content, job ads and generic posts.
Rewrite each as one plain, factual sentence under 30 words for a lab website, no hashtags or emojis.
Skip anything already covered by this existing news list:
""" + "\n".join(f"- {n['text']}" for n in existing[:20]) + """
Return a JSON array of objects: {"date": "<Mon YYYY>", "text": "<sentence>", "url": "<post url>"}.
Return [] if there is nothing new. Never invent posts."""
    ok = lambda i: re.match(r"https://([a-z]+\.)?linkedin\.com/", i.get("url", "")) and i["url"] not in seen_urls
    if RSS:
        posts = [p for p in rss_posts() if p["url"] not in seen_urls]
        if not posts:
            return []
        items = gemini("These are recent LinkedIn posts by FOCAS Lab, IISc:\n"
                      + json.dumps(posts, ensure_ascii=False) + "\n\n" + rules)
        return [i for i in items if ok(i)]
    items = gemini(f"""Search the web for the most recent public LinkedIn posts by the FOCAS Lab
(Formal Control and Autonomous Systems Lab, IISc Bengaluru, PI Pushpak Jagtap), profile {LINKEDIN},
from the last 3 months. Only use posts you actually find in search results, with their linkedin.com URLs.
{rules}""", search=True)
    # grounding can still drift: keep only items that point at a LinkedIn post we have not used before
    return [i for i in items if ok(i)]


def main():
    if not KEY:
        print("GEMINI_API_KEY not set; skipping news update")
        return 0
    site = json.loads(SITE.read_text())
    pubs = json.loads(PUBS.read_text())["items"]
    state = json.loads(STATE.read_text()) if STATE.exists() else None
    if state is None:
        # first run: treat everything already on the site as seen, so old papers do not flood the news
        state = {"papers": [p["id"] for p in pubs], "linkedin": []}
    added = []
    try:
        added += paper_news(pubs, set(state["papers"]))
    except Exception as e:  # noqa: BLE001
        print(f"[papers] {e}")
    try:
        added += linkedin_news(site["news"], set(state["linkedin"]))
    except Exception as e:  # noqa: BLE001
        print(f"[linkedin] {e}")
    state["papers"] = sorted(set(state["papers"]) | {p["id"] for p in pubs})
    old = {n["text"].lower() for n in site["news"]}
    added = [n for n in added if n.get("text") and n["text"].lower() not in old][:MAX_NEW]
    state["linkedin"] += [n["url"] for n in added if n.get("url")]
    for n in reversed(added):
        item = {"date": n.get("date") or datetime.now(timezone.utc).strftime("%b %Y"), "text": n["text"].strip()}
        if n.get("url"):
            item["url"] = n["url"]
        site["news"].insert(0, item)
        print("+", item["date"], item["text"])
    SITE.write_text(json.dumps(site, ensure_ascii=False, indent=2) + "\n")
    STATE.write_text(json.dumps(state, indent=1) + "\n")
    print(f"Added {len(added)} news items")
    return 0


if __name__ == "__main__":
    sys.exit(main())
