# sff-awards

Personal tracker for science-fiction and fantasy award winners (Hugo, Nebula, World Fantasy, Mythopoeic, Kitschies) with a "have I read it?" column synced from Goodreads CSV exports — and a static site published at [tomgarske.github.io/sff-awards](https://tomgarske.github.io/sff-awards).

## Why

Goodreads' public API is deprecated (no new keys since Dec 2020) and StoryGraph has no official API. Both still export full CSVs of your shelves, so a CSV-in pipeline is the most reliable approach.

## Layout

```
sff-awards/
├── data/             # source per-sheet CSVs, additions, merged outputs, cache
├── exports/          # raw exports from Goodreads / StoryGraph (gitignored)
├── scripts/          # Python pipeline (merge, build xlsx, build site JSON, enrich)
├── site/             # static SPA — index.html, app.js, styles.css, data.json
└── .github/workflows # GH Pages deploy on push to main
```

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
