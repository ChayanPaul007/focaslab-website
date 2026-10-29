"""Sync data/publications.json from Google Scholar (scrape), with SerpAPI fallback.

Never destroys data: if both sources fail or return a suspiciously short list,
the existing file is kept and the script exits 0.
"""
import json, os, random, re, sys, time
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

SID = os.environ.get("SCHOLAR_ID", "Szd98jUAAAAJ")
OUT = Path(__file__).resolve().parents[1] / "data" / "publications.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")


class Blocked(Exception):
    pass


def scholar():
    s = requests.Session()
    s.headers.update({"User-Agent": UA, "Accept-Language": "en-US,en;q=0.9"})
    items, profile, start = [], None, 0
    while True:
        r = s.get("https://scholar.google.com/citations",
                  params={"user": SID, "hl": "en", "cstart": start, "pagesize": 100, "sortby": "pubdate"}, timeout=30)
        if r.status_code != 200 or "gs_captcha" in r.text or "/sorry/" in r.url:
            raise Blocked(f"HTTP {r.status_code} at cstart={start}")
        soup = BeautifulSoup(r.text, "html.parser")
        if profile is None:
            st = [td.get_text() for td in soup.select("#gsc_rsb_st td.gsc_rsb_std")]
            if len(st) < 6:
                raise Blocked("profile stats missing")
            profile = {"name": soup.select_one("#gsc_prf_in").get_text(strip=True),
                       "citations": int(st[0]), "h_index": int(st[2]), "i10_index": int(st[4])}
        rows = soup.select("tr.gsc_a_tr")
        page = []
        for row in rows:
            a = row.select_one(".gsc_a_at")
            if not a:
                continue
            gray = row.select(".gs_gray")
            y = row.select_one(".gsc_a_y span")
            c = row.select_one(".gsc_a_c a")
            page.append({
                "title": a.get_text(strip=True),
                "authors": gray[0].get_text(strip=True) if gray else "",
                "venue": gray[1].get_text(strip=True) if len(gray) > 1 else "",
                "year": int(y.get_text()) if y and y.get_text().strip().isdigit() else None,
                "citations": int(c.get_text()) if c and c.get_text().strip().isdigit() else 0,
                "id": (a.get("href") or "").split("citation_for_view=")[-1].split(":")[-1],
            })
        items += page
        if len(page) < 100:
            break
        start += 100
        time.sleep(random.uniform(3, 7))
    return profile, items


def serpapi(key):
    items, profile, start = [], None, 0
    while True:
        r = requests.get("https://serpapi.com/search.json", timeout=60, params={
            "engine": "google_scholar_author", "author_id": SID, "hl": "en",
            "sort": "pubdate", "num": 100, "start": start, "api_key": key})
        r.raise_for_status()
        d = r.json()
        if profile is None:
            t = d.get("cited_by", {}).get("table", [])
            g = lambda i, k: int(t[i][k]["all"]) if len(t) > i else 0
            profile = {"name": d.get("author", {}).get("name", ""),
                       "citations": g(0, "citations"), "h_index": g(1, "h_index"), "i10_index": g(2, "i10_index")}
        arts = d.get("articles", [])
        for a in arts:
            y = str(a.get("year", "")).strip()
            items.append({"title": a.get("title", ""), "authors": a.get("authors", ""),
                          "venue": a.get("publication", ""), "year": int(y) if y.isdigit() else None,
                          "citations": (a.get("cited_by") or {}).get("value") or 0,
                          "id": a.get("citation_id", "").split(":")[-1]})
        if len(arts) < 100:
            break
        start += 100
    return profile, items


def main():
    old = json.loads(OUT.read_text()) if OUT.exists() else {"items": []}
    profile = items = None
    src = "Google Scholar"
    for attempt in range(3):
        try:
            profile, items = scholar()
            break
        except Exception as e:  # noqa: BLE001
            print(f"[scholar] attempt {attempt + 1} failed: {e}")
            time.sleep(10 * (attempt + 1))
    if not items and os.environ.get("SERPAPI_KEY"):
        try:
            profile, items = serpapi(os.environ["SERPAPI_KEY"])
            src = "Google Scholar (via SerpAPI)"
        except Exception as e:  # noqa: BLE001
            print(f"[serpapi] failed: {e}")
    if not items:
        print("No fresh data; keeping existing publications.json")
        return 0
    if len(items) < 0.8 * len(old.get("items", [])):
        print(f"Suspicious drop ({len(old['items'])} -> {len(items)}); keeping existing file")
        return 0
    data = {"source": src, "scholar_id": SID,
            "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "profile": profile, "items": [i for i in items if i["title"]]}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {len(data['items'])} publications, {profile['citations']} citations")
    return 0


if __name__ == "__main__":
    sys.exit(main())
