# Readmore SFF

A tracker for Hugo and Nebula award winners and finalists in Novel, Novella, and Novelette — plus the Retrospective Hugos that filled in the genre's earliest years. Live at [readmoresff.org](https://readmoresff.org/).

## Why

Goodreads' public API is deprecated (no new keys since Dec 2020) and StoryGraph has no official API. Both still export full CSVs of your shelves, so a CSV-in pipeline is the most reliable approach.

## Layout

```
mount-readmore/
├── data/             # source per-sheet CSVs, additions, merged outputs, caches
├── exports/          # raw exports from Goodreads / StoryGraph (gitignored)
├── scripts/          # Python pipeline (merge, enrich, build site JSON)
├── site/             # static SPA — index.html, app.js, styles.css, data.json
├── functions/        # Cloudflare Pages Functions (per-route OG tag injection)
└── .github/workflows # Cloudflare Pages deploy on push to main
```

## Hosting & auth

- **Primary URL:** [readmoresff.org](https://readmoresff.org/) — served by Cloudflare Pages (project `mount-readmore`, attached via `.github/workflows/cloudflare-pages.yml`). DNS lives in Cloudflare.
- **Supabase config** (must match the production URL):
  - Project Settings → URL Configuration → **Site URL**: `https://readmoresff.org`
  - Authentication → URL Configuration → **Redirect URLs**: add `https://readmoresff.org/**` (the trailing `**` allows magic-link callbacks at any path)
  - Authentication → Email Templates → **Magic Link**: body should reference Readmore; the `{{ .ConfirmationURL }}` token resolves against Site URL
- **Magic-link redirect:** `site/auth.js` pins `emailRedirectTo` to `https://readmoresff.org/` so the login email always lands on the canonical domain regardless of where the visitor was when they hit "Send link."

## Awards tracked

- Hugo Award — Best Novel, Best Novella, Best Novelette
- Nebula Award — Best Novel, Best Novella, Best Novelette
- Retrospective Hugo Award — same three categories

## Data pipeline

`scripts/build_site_data.py` (run by CI on every push to `main`) assembles `site/data.json` from:

- `data/*_updated.csv` — per-category award sheets with reader-status columns
- `data/manual_overrides.json` — hand-curated per-book field overrides (always wins)
- `data/openlib_cache.json` + `openlib_descriptions.json` — Open Library covers and descriptions
- `data/goodreads_metadata.json` + `goodreads_ids.json` — Goodreads covers and ids
- `data/supplemental_descriptions.json` — Wikipedia-fetched descriptions (filled only when empty)
- `data/auto_links.json` — Bookshop.org product links resolved by ISBN (filled only when empty)
- `data/author_gender.json` — author gender annotations

The caches are populated by helper scripts run on demand:

- `merge_read_status.py` — merge a Goodreads / StoryGraph export into the per-sheet CSVs (produces `*_updated.csv`)
- `retry_openlibrary.py` — second-pass OL lookup for books missing a cover or description
- `fetch_descriptions.py` — Wikipedia descriptions for books OL didn't have (strict author + title gating)
- `fetch_links.py` — Bookshop.org product links by ISBN, with an OL alternate-edition fallback
- `fetch_goodreads_metadata.py` / `harvest_goodreads_ids.py` — Goodreads scrape helpers
- `sync_books_to_supabase.py` — sync canonical data into the `books` table
