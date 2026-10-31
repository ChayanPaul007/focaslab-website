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
| News | `data/site.json` (Gemini adds items automatically, see below) |

Commit to `main` and the site redeploys in about a minute. For a photo, either paste an image URL
(it is downloaded into `assets/img/` on the next deploy) or add the file to `assets/img/` and use `assets/img/name.jpg`.

Research themes (`research` in `site.json`) each have a `match` regex: the Research page lists the newest
matching papers from `publications.json` under "Selected papers", so those stay up to date on their own.
The animation for each theme is chosen by `viz` and drawn by `assets/research-viz.js`.

## Publications sync

The publication list and the citation / h-index / i10 numbers (shown on both Home and Publications) come from
Google Scholar. To refresh them, use whichever is easiest:

- **One click:** GitHub → **Actions → Sync publications & news, deploy → Run workflow**. It also runs by itself every Monday and Thursday.
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

## News sync (Gemini)

`scripts/update_news.py` runs right after the publications sync and adds items to `news` in `data/site.json`:

- **New papers:** when a journal or conference paper shows up on Scholar, Gemini writes a one-line item
  ("Two papers accepted at CDC 2026."). Preprints are skipped.
- **LinkedIn:** the lab profile's latest posts are read through [Apify](https://apify.com/harvestapi/linkedin-profile-posts)
  (about $0.002 per post, well inside Apify's free monthly credit), and Gemini turns real news (awards, defences, talks,
  new members) into one-liners with a "Post →" link. Without `APIFY_TOKEN` it falls back to `LINKEDIN_RSS_URL`, then to
  a Gemini web search, which rarely finds posts from this profile.

Setup (GitHub → **Settings → Secrets and variables → Actions**):

| Name | Kind | Value |
|---|---|---|
| `GEMINI_API_KEY` | Secret | key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `LINKEDIN_URL` | Variable (optional) | defaults to the lab page, `linkedin.com/in/focas-lab-644911386` |
| `APIFY_TOKEN` | Secret | Apify → Settings → API & Integrations → Personal API token |
| `LINKEDIN_RSS_URL` | Variable (optional) | an RSS feed of that page, e.g. from rss.app |
| `GEMINI_MODEL` | Variable (optional) | tried first; then gemini-2.5-flash, gemini-flash-latest, gemini-2.5-flash-lite |

At most 4 items are added per run; `data/news_state.json` remembers what was already used. Any item can be
edited or deleted by hand in `site.json`. Without a key the step is skipped and nothing changes.

## Colours

The palette follows the FOCAS logo (charcoal `#3a3a3c`, blue `#006fb8`) and lives at the top of `assets/style.css`.
The previous navy / gold look is kept in `assets/palette-classic.css` (and `assets/favicon-classic.svg`): link that
stylesheet after `style.css` to switch back.

## Local preview

```bash
python -m http.server 8000   # then open http://localhost:8000
```
