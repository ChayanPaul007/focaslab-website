"""Download remote images referenced in data/*.json into assets/img/ and rewrite the paths.

Lets the site stop depending on the old Google Sites image URLs. Safe to re-run.
"""
import hashlib, json, re
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "assets" / "img"
IMG.mkdir(parents=True, exist_ok=True)
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}


def fetch(url):
    h = hashlib.sha1(url.encode()).hexdigest()[:12]
    for p in IMG.glob(h + ".*"):
        return f"assets/img/{p.name}"
    r = requests.get(url, timeout=30, headers={"User-Agent": "Mozilla/5.0"})
    r.raise_for_status()
    ext = EXT.get(r.headers.get("content-type", "").split(";")[0], ".jpg")
    (IMG / (h + ext)).write_bytes(r.content)
    return f"assets/img/{h}{ext}"


def walk(o):
    if isinstance(o, dict):
        for k, v in o.items():
            if k in ("photo", "image") and isinstance(v, str) and re.match(r"https?://", v):
                try:
                    o[k] = fetch(v)
                except Exception as e:  # noqa: BLE001
                    print("skip", v[:60], e)
            else:
                walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


for f in ("people", "facilities", "site"):
    p = ROOT / "data" / f"{f}.json"
    d = json.loads(p.read_text())
    walk(d)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("images:", len(list(IMG.iterdir())))
