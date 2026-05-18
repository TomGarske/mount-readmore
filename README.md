# Readmore

Personal tracker for Hugo and Nebula winners and finalists, comparing Tom's and Nika's reading progress. Read status comes from the awards spreadsheet plus Tom's exported Goodreads "read" shelf. Live at [readmore.tomgarske.com](https://readmore.tomgarske.com/).

## Why

Goodreads' public API is deprecated (no new keys since Dec 2020) and StoryGraph has no official API. Both still export full CSVs of your shelves, so a CSV-in pipeline is the most reliable approach.

## Layout

```
award-books-tracker/
├── data/             # source per-sheet CSVs, additions, merged outputs, cache
├── exports/          # raw exports from Goodreads / StoryGraph (gitignored)
├── scripts/          # Python pipeline (merge, build xlsx, build site JSON, enrich)
├── site/             # static SPA — index.html, app.js, styles.css, data.json
└── .github/workflows # Cloudflare Pages deploy on push to main
```

## Hosting & auth

- **Primary URL:** [readmore.tomgarske.com](https://readmore.tomgarske.com/) — served by Cloudflare Pages (project `mount-readmore`, attached via `.github/workflows/cloudflare-pages.yml`). DNS lives in Cloudflare.
- **Supabase config** (must match the production URL):
  - Project Settings → URL Configuration → **Site URL**: `https://readmore.tomgarske.com`
  - Authentication → URL Configuration → **Redirect URLs**: add `https://readmore.tomgarske.com/**` (the trailing `**` allows magic-link callbacks at any path)
  - Authentication → Email Templates → **Magic Link**: body should reference Readmore; the `{{ .ConfirmationURL }}` token resolves against Site URL
- **Magic-link redirect:** `site/auth.js` pins `emailRedirectTo` to `https://readmore.tomgarske.com/` so the login email always lands on the canonical domain regardless of where the visitor was when they hit "Send link."

## Awards tracked

- Hugo Award — Best Novel, Best Novella, Best Novelette, Best Short Story
- Nebula Award — Best Novel, Best Novella, Best Novelette, Best Short Story
- World Fantasy Award — Best Novel
- Locus Award — Best SF Novel, Best Fantasy Novel
- Arthur C. Clarke Award
- Philip K. Dick Award

## Workflow

1. Export Goodreads CSV: My Books → Import and export → Export Library
2. Export StoryGraph CSV: Manage Account → Export Data
3. Drop both into `exports/`
4. Run `scripts/merge_read_status.py` — updates `data/awards-master.csv` with a `read` column
5. Run `scripts/enrich_metadata.py` (optional) — fills missing covers, page counts, pub dates from Open Library

## Roadmap

- [ ] Seed `data/awards-master.csv` from existing Google Sheet
- [ ] Add 2025 winners
- [ ] Add 2026 winners and finalists (where announced)
- [ ] Goodreads CSV reader
- [ ] StoryGraph CSV reader
- [ ] Reconciliation by ISBN, fallback to title+author fuzzy match
- [ ] Open Library enrichment for missing metadata
- [ ] Optional: write back to Google Sheet via gspread
