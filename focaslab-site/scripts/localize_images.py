"""Download images referenced in data/*.json into assets/img/ and rewrite the paths.

Image URLs copied from the old Google Sites (focaslab.com) are signed and expire, so when a
stored URL no longer works, a fresh one is looked up on the live Google Sites page by the
person / facility / research-theme name. Safe to re-run; local paths are left alone.
"""
import hashlib, json, re
from pathlib import Path

import requests
from bs4 import BeautifulSoup, NavigableString

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "assets" / "img"
IMG.mkdir(parents=True, exist_ok=True)
OLD = "https://www.focaslab.com/"
UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
EXT = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
# names on the old site that differ from ours
ALIAS = {"TurtleBot 3": "Turtlebot-3", "TurtleBot 4": "Turtlebot4", "AgileX LIMO": "Agile Limo",
         "Franka Research 3": "Franka Research-3", "Aduza Hexa-4 parallel manipulator": "Hexa-4 parallel manipulator",
         "Hello Robot Stretch 3": "Hello Robot's Stretch 3", "AgileX Cobot S": "Agile Cobot S",
         "Crazyflie swarm": "Crazyflie", "PhaseSpace motion capture": "Phasespace Motion Capture",
         "3D printing": "3D Printer", "Multi-Robot Systems": "Multi-Robot Systems (MRS)",
         "Cyber-Physical Systems": "Modern physical processes"}
# (old page, image is before/after the name)
PAGE = {"people": ("people", "before"), "facilities": ("facilities", "before"), "site": ("research", "after")}
norm = lambda s: re.sub(r"[^a-z0-9]", "", (s or "").lower().replace("dr.", "").replace("dr ", ""))
_seq = {}


def sequence(page):
    if page not in _seq:
        seq = []
        try:
            soup = BeautifulSoup(requests.get(OLD + page, headers=UA, timeout=30).text, "html.parser")
            for el in soup.body.descendants:
                if isinstance(el, NavigableString) and el.parent.name not in ("script", "style") and len(el.strip()) > 2:
                    seq.append(("t", norm(el)))
                elif getattr(el, "name", None) == "img" and "googleusercontent" in (el.get("src") or ""):
                    seq.append(("i", el["src"]))
        except Exception as e:  # noqa: BLE001
            print("could not read", page, e)
        _seq[page] = seq
    return _seq[page]


def fresh(page, direction, name):
    seq, key = sequence(page), norm(ALIAS.get(name, name))
    idx = next((i for i, (k, v) in enumerate(seq) if k == "t" and key and key in v), None)
    if idx is None:
        return None
    rng = range(idx - 1, -1, -1) if direction == "before" else range(idx + 1, len(seq))
    return next((seq[j][1] for j in rng if seq[j][0] == "i"), None)


def download(url, tag):
    r = requests.get(url, timeout=30, headers=UA)
    r.raise_for_status()
    ctype = r.headers.get("content-type", "").split(";")[0]
    if not ctype.startswith("image/"):
        raise ValueError(f"not an image ({ctype})")
    name = hashlib.sha1(tag.encode()).hexdigest()[:12] + EXT.get(ctype, ".jpg")
    (IMG / name).write_bytes(r.content)
    return f"assets/img/{name}"


def walk(o, page, direction, name=None):
    if isinstance(o, dict):
        name = o.get("name") or o.get("title") or name
        for k, v in o.items():
            if k in ("photo", "image") and isinstance(v, str) and v.startswith("http"):
                for url in (v, fresh(page, direction, name)):
                    if not url:
                        continue
                    try:
                        o[k] = download(url, name or v)
                        print("ok  ", name)
                        break
                    except Exception as e:  # noqa: BLE001
                        print("fail", name, str(e)[:60])
            else:
                walk(v, page, direction, name)
    elif isinstance(o, list):
        for v in o:
            walk(v, page, direction, name)


for f, (page, direction) in PAGE.items():
    p = ROOT / "data" / f"{f}.json"
    d = json.loads(p.read_text())
    walk(d, page, direction)
    p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + "\n")
print("images:", len(list(IMG.iterdir())))
