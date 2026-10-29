# FOCAS Lab website

Static site for the **Formal Control and Autonomous Systems Lab**, Dept. of Cyber-Physical Systems, IISc Bengaluru.
No build step: plain HTML/CSS/JS rendering JSON from `data/`, served by GitHub Pages.

## Editing content

| What | File |
|---|---|
| News, research themes, openings, contact | `data/site.json` |
| Courses, open-source repos, lab highlights (Teaching page) | `data/teaching.json` |
| People, alumni | `data/people.json` |
| Robots and equipment | `data/facilities.json` |
| Publications | `data/publications.json` (**auto-generated, do not edit**) |

Commit to `main` and the site redeploys in about a minute. For a photo, either paste an image URL
(it is downloaded into `assets/img/` on the next deploy) or add the file to `assets/img/` and use `assets/img/name.jpg`.

Research themes (`research` in `site.json`) each have a `match` regex: the Research page lists the newest
matching papers from `publications.json` under "Selected papers", so those stay up to date on their own.
The animation for each theme is chosen by `viz` and drawn by `assets/research-viz.js`.

## Publications sync

The publication list and the citation / h-index / i10 numbers (shown on both Home and Publications) come from
Google Scholar. To refresh them, use whichever is easiest:

- **One click:** GitHub → **Actions → Sync publications & deploy → Run workflow**. It also runs by itself every Monday.
- **Make the weekly run reliable:** Scholar often blocks GitHub's servers. Create a free key at
  [serpapi.com](https://serpapi.com) (the free tier is far more than a weekly run needs) and add it under
  **Settings → Secrets and variables → Actions** as `SERPAPI_KEY`. The workflow then falls back to it automatically.
- **From your laptop** (always works, since Scholar does not block home connections):

  ```bash
  pip install requests beautifulsoup4
  python scripts/update_publications.py
  git commit -am "Update publications" && git push
  ```

`scripts/update_publications.py`:

1. scrapes Dr. Pushpak Jagtap's Google Scholar profile (`Szd98jUAAAAJ`);
2. if Scholar blocks the runner, falls back to [SerpAPI](https://serpapi.com) when a `SERPAPI_KEY` repository secret is set (free tier is enough);
3. otherwise keeps the last good list. It also refuses to overwrite if the list suddenly shrinks by more than 20%.

Journal / conference / preprint tags and the merging of arXiv and published versions happen in the browser (`assets/site.js`).

## Local preview

```bash
python -m http.server 8000   # then open http://localhost:8000
```
