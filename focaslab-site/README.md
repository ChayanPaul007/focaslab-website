# FOCAS Lab website

Static site for the **Formal Control and Autonomous Systems Lab**, Dept. of Cyber-Physical Systems, IISc Bengaluru.
No build step: plain HTML/CSS/JS rendering JSON from `data/`, served by GitHub Pages.

## Editing content

| What | File |
|---|---|
| News, research themes, openings, courses, contact | `data/site.json` |
| People, alumni | `data/people.json` |
| Robots and equipment | `data/facilities.json` |
| Publications | `data/publications.json` (**auto-generated, do not edit**) |

Commit to `main` and the site redeploys in about a minute. For a photo, either paste an image URL
(it is downloaded into `assets/img/` on the next deploy) or add the file to `assets/img/` and use `assets/img/name.jpg`.

## Publications sync

`.github/workflows/site.yml` runs every Monday (and on demand from **Actions → Sync publications & deploy → Run workflow**).
It calls `scripts/update_publications.py`, which:

1. scrapes Dr. Pushpak Jagtap's Google Scholar profile (`Szd98jUAAAAJ`);
2. if Scholar blocks the runner, falls back to [SerpAPI](https://serpapi.com) when a `SERPAPI_KEY` repository secret is set (free tier is enough);
3. otherwise keeps the last good list. It also refuses to overwrite if the list suddenly shrinks by more than 20%.

Journal / conference / preprint tags and the merging of arXiv and published versions happen in the browser (`assets/site.js`).

## Local preview

```bash
python -m http.server 8000   # then open http://localhost:8000
```
