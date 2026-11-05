"""Sync data/videos.json from the lab's YouTube channel feed (no API key needed).

Keeps the existing file if the feed cannot be read.
"""
import json, os, sys
from pathlib import Path
from xml.etree import ElementTree

import requests

CHANNEL = os.environ.get("YOUTUBE_CHANNEL") or "UC-M-WAAge3C6cv_aCga9N2Q"
OUT = Path(__file__).resolve().parents[1] / "data" / "videos.json"
NS = {"a": "http://www.w3.org/2005/Atom", "yt": "http://www.youtube.com/xml/schemas/2015"}


def main():
    try:
        r = requests.get("https://www.youtube.com/feeds/videos.xml", params={"channel_id": CHANNEL}, timeout=30)
        r.raise_for_status()
        root = ElementTree.fromstring(r.content)
    except Exception as e:  # noqa: BLE001
        print(f"[youtube] {e}; keeping existing videos.json")
        return 0
    videos = [{"id": e.findtext("yt:videoId", namespaces=NS),
               "title": (e.findtext("a:title", namespaces=NS) or "").strip(),
               "date": (e.findtext("a:published", namespaces=NS) or "")[:10]}
              for e in root.findall("a:entry", NS)]
    videos = [v for v in videos if v["id"]]
    if not videos:
        print("[youtube] feed empty; keeping existing videos.json")
        return 0
    OUT.write_text(json.dumps({"channel": CHANNEL, "items": videos}, ensure_ascii=False, indent=1) + "\n")
    print(f"Wrote {len(videos)} videos")
    return 0


if __name__ == "__main__":
    sys.exit(main())
