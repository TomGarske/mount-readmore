"""Merge a Goodreads / StoryGraph export into the award sheets' reader-status columns.

For each sheet CSV in data/:
  1. Append its *_additions.csv if one exists (so newest-year rows are included)
  2. Match each row against the export's "read" shelf
  3. Populate the corresponding reader column where empty; leave existing notes alone

Outputs `*_updated.csv` files in data/ for review.

Usage:
    python scripts/merge_read_status.py --data data --goodreads exports/goodreads_export.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import pandas as pd
from rapidfuzz import fuzz, process

# Which column holds the title for each sheet (everything else is "Author(s)" and "Tom")
TITLE_COLS = {
    "favorites": "Novel",
    "best_novel": "Novel",
    "best_novella_hugo": "Novel",
    "best_novelette_hugo": "Novelette",
    "best_series_hugo": "Series",
    "sandbox": "Title",
}


def normalize(s: object) -> str:
    if s is None or (isinstance(s, float) and pd.isna(s)):
        return ""
    return str(s).strip().lower()


def load_goodreads(path: Path) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (read_df, shelf_df) — shelf_df includes to-read + currently-reading."""
    df = pd.read_csv(path, dtype=str).fillna("")
    df["title_n"] = df["Title"].apply(normalize)
    df["author_n"] = df["Author"].apply(normalize)
    df["Date Read Norm"] = df["Date Read"].str.replace("/", "-", regex=False)

    read = df[df["Exclusive Shelf"].str.lower() == "read"].copy()
    read = read[["Title", "Author", "title_n", "author_n", "Date Read Norm", "My Rating"]].rename(columns={"Date Read Norm": "date_read"})

    shelf = df[df["Exclusive Shelf"].str.lower().isin(["to-read", "currently-reading"])].copy()
    shelf["shelf"] = shelf["Exclusive Shelf"].str.lower()
    shelf = shelf[["Title", "Author", "title_n", "author_n", "shelf"]]

    return read, shelf


def load_storygraph(path: Path) -> pd.DataFrame:
    """StoryGraph CSV scraped from /books-read/<user> or /to-read/<user>. Columns: title, author, etc."""
    df = pd.read_csv(path, dtype=str).fillna("")
    df["title_n"] = df["title"].apply(normalize)
    df["author_n"] = df["author"].apply(normalize)
    return df[["title", "author", "title_n", "author_n"]].rename(columns={"title": "Title", "author": "Author"})


def load_goodreads_read_scrape(path: Path) -> pd.DataFrame:
    """Generic Goodreads read-shelf scrape — same shape as westdac/colton/schupp."""
    df = pd.read_csv(path, dtype=str).fillna("")
    df["title_n"] = df["title"].apply(normalize)
    df["author_n"] = df["author"].apply(normalize)
    return df.rename(columns={"title": "Title", "author": "Author"})[
        ["Title", "Author", "title_n", "author_n", "date_read", "rating"]
    ]


def load_goodreads_shelf_scrape(path: Path) -> pd.DataFrame:
    """Generic Goodreads to-read / currently-reading scrape."""
    df = pd.read_csv(path, dtype=str).fillna("")
    df["title_n"] = df["title"].apply(normalize)
    df["author_n"] = df["author"].apply(normalize)
    return df.rename(columns={"title": "Title", "author": "Author"})[
        ["Title", "Author", "title_n", "author_n", "shelf"]
    ]


# Aliases for back-compat
load_westdac_read = load_goodreads_read_scrape
load_westdac_shelf = load_goodreads_shelf_scrape


def strip_series_suffix(title: str) -> str:
    """'The Tainted Cup (Shadow of the Leviathan, #1)' -> 'the tainted cup'"""
    t = normalize(title)
    if "(" in t:
        t = t.split("(", 1)[0].strip()
    return t


def extract_series(gr_title: str) -> str:
    """'The Tainted Cup (Shadow of the Leviathan, #1)' -> 'Shadow of the Leviathan, #1'"""
    if not gr_title or "(" not in gr_title or ")" not in gr_title:
        return ""
    start = gr_title.rfind("(")
    end = gr_title.rfind(")")
    if start >= end:
        return ""
    return gr_title[start + 1:end].strip()


def find_match(title: str, author: str, gr: pd.DataFrame):
    """Returns the matching row from gr, or None.

    Requires both title AND author to align — title-only matches are rejected
    (otherwise generic titles like "The Knight" collide across authors).
    """
    t = normalize(title)
    a = normalize(author)
    if not t or gr.empty:
        return None

    gr_stripped = gr.assign(title_stripped=gr["title_n"].apply(strip_series_suffix))

    # Exact title — must also pass author substring check
    exact = gr_stripped[gr_stripped["title_stripped"] == t]
    for _, row in exact.iterrows():
        if a and (a in row["author_n"] or row["author_n"] in a):
            return row
        if not a:
            return row  # only when we have no author to check

    # Fuzzy title — must pass author similarity check
    titles = gr_stripped["title_stripped"].tolist()
    hit = process.extractOne(t, titles, scorer=fuzz.ratio, score_cutoff=88)
    if hit:
        _, _, idx = hit
        cand = gr_stripped.iloc[idx]
        if a and fuzz.partial_ratio(a, cand["author_n"]) >= 70:
            return cand
        if not a:
            return cand
    return None


def process_sheet(
    sheet_csv: Path,
    additions_csv: Path | None,
    gr_read: pd.DataFrame,
    gr_shelf: pd.DataFrame,
    nika_read: pd.DataFrame | None,
    nika_shelf: pd.DataFrame | None,
    westdac_read: pd.DataFrame | None,
    westdac_shelf: pd.DataFrame | None,
    colton_read: pd.DataFrame | None,
    colton_shelf: pd.DataFrame | None,
    schupp_read: pd.DataFrame | None,
    schupp_shelf: pd.DataFrame | None,
    out_csv: Path,
) -> dict:
    base = pd.read_csv(sheet_csv, dtype=str, keep_default_na=False)

    if additions_csv and additions_csv.exists():
        adds = pd.read_csv(additions_csv, dtype=str, keep_default_na=False)
        for col in base.columns:
            if col not in adds.columns:
                adds[col] = ""
        adds = adds[base.columns]
        combined = pd.concat([adds, base], ignore_index=True)
    else:
        combined = base

    stem = sheet_csv.stem
    title_col = TITLE_COLS.get(stem, "Novel")
    author_col = "Author(s)" if "Author(s)" in combined.columns else "Author"
    for col in [
        "Tom", "Tom Date Read", "Tom Rating", "Tom Shelf",
        "Series", "Nika", "Nika Shelf",
        "Westdac", "Westdac Date Read", "Westdac Rating", "Westdac Shelf",
        "Colton", "Colton Date Read", "Colton Rating", "Colton Shelf",
        "Schupp", "Schupp Date Read", "Schupp Rating", "Schupp Shelf",
    ]:
        if col not in combined.columns:
            combined[col] = ""

    stats = {
        "matched_read": 0, "matched_shelf": 0,
        "matched_nika": 0, "matched_nika_shelf": 0,
        "matched_westdac": 0, "matched_westdac_shelf": 0,
        "matched_colton": 0, "matched_colton_shelf": 0,
        "matched_schupp": 0, "matched_schupp_shelf": 0,
    }
    for i, row in combined.iterrows():
        title = row.get(title_col, "")
        author = row.get(author_col, "")

        # Tom: read shelf first
        m = find_match(title, author, gr_read)
        if m is not None:
            stats["matched_read"] += 1
            if not (row.get("Tom") or "").strip():
                combined.at[i, "Tom"] = "Read"
            if m.get("date_read", ""):
                combined.at[i, "Tom Date Read"] = m["date_read"]
            rating = m.get("My Rating", "") or ""
            if rating and rating != "0":
                combined.at[i, "Tom Rating"] = rating
            series = extract_series(m.get("Title", "") or "")
            if series and not (row.get("Series") or "").strip():
                combined.at[i, "Series"] = series
        else:
            # Tom: to-read / currently-reading shelf
            m = find_match(title, author, gr_shelf)
            if m is not None:
                stats["matched_shelf"] += 1
                combined.at[i, "Tom Shelf"] = m["shelf"]
                if not (row.get("Tom") or "").strip():
                    combined.at[i, "Tom"] = "In the queue" if m["shelf"] == "to-read" else "In progress"
                series = extract_series(m.get("Title", "") or "")
                if series and not (row.get("Series") or "").strip():
                    combined.at[i, "Series"] = series

        # Nika: StoryGraph read list — overwrites stale statuses (In progress / In the queue / etc)
        # but preserves "Read" annotations like "Read (didn't enjoy)"
        if nika_read is not None:
            m = find_match(title, author, nika_read)
            if m is not None:
                stats["matched_nika"] += 1
                existing = (row.get("Nika") or "").strip().lower()
                if not existing.startswith("read"):
                    combined.at[i, "Nika"] = "Read"

        # Nika: StoryGraph to-read shelf
        if nika_shelf is not None:
            m = find_match(title, author, nika_shelf)
            if m is not None:
                stats["matched_nika_shelf"] += 1
                combined.at[i, "Nika Shelf"] = "to-read"
                existing = (row.get("Nika") or "").strip().lower()
                if not existing:
                    combined.at[i, "Nika"] = "In the queue"

        # Westdac: Goodreads read shelf
        westdac_read_match = None
        if westdac_read is not None:
            westdac_read_match = find_match(title, author, westdac_read)
            if westdac_read_match is not None:
                stats["matched_westdac"] += 1
                if not (row.get("Westdac") or "").strip():
                    combined.at[i, "Westdac"] = "Read"
                if westdac_read_match.get("date_read", ""):
                    combined.at[i, "Westdac Date Read"] = westdac_read_match["date_read"]
                rating = westdac_read_match.get("rating", "") or ""
                if rating:
                    combined.at[i, "Westdac Rating"] = rating

        # Westdac: to-read / currently-reading shelf (only if not already read)
        if westdac_shelf is not None and westdac_read_match is None:
            m = find_match(title, author, westdac_shelf)
            if m is not None:
                stats["matched_westdac_shelf"] += 1
                combined.at[i, "Westdac Shelf"] = m["shelf"]
                existing = (row.get("Westdac") or "").strip()
                if not existing:
                    combined.at[i, "Westdac"] = "In the queue" if m["shelf"] == "to-read" else "In progress"

        # Colton: Goodreads read shelf
        colton_read_match = None
        if colton_read is not None:
            colton_read_match = find_match(title, author, colton_read)
            if colton_read_match is not None:
                stats["matched_colton"] += 1
                if not (row.get("Colton") or "").strip():
                    combined.at[i, "Colton"] = "Read"
                if colton_read_match.get("date_read", ""):
                    combined.at[i, "Colton Date Read"] = colton_read_match["date_read"]
                rating = colton_read_match.get("rating", "") or ""
                if rating:
                    combined.at[i, "Colton Rating"] = rating

        if colton_shelf is not None and colton_read_match is None:
            m = find_match(title, author, colton_shelf)
            if m is not None:
                stats["matched_colton_shelf"] += 1
                combined.at[i, "Colton Shelf"] = m["shelf"]
                existing = (row.get("Colton") or "").strip()
                if not existing:
                    combined.at[i, "Colton"] = "In the queue" if m["shelf"] == "to-read" else "In progress"

        # Schupp: Goodreads read shelf
        schupp_read_match = None
        if schupp_read is not None:
            schupp_read_match = find_match(title, author, schupp_read)
            if schupp_read_match is not None:
                stats["matched_schupp"] += 1
                if not (row.get("Schupp") or "").strip():
                    combined.at[i, "Schupp"] = "Read"
                if schupp_read_match.get("date_read", ""):
                    combined.at[i, "Schupp Date Read"] = schupp_read_match["date_read"]
                rating = schupp_read_match.get("rating", "") or ""
                if rating:
                    combined.at[i, "Schupp Rating"] = rating

        if schupp_shelf is not None and schupp_read_match is None:
            m = find_match(title, author, schupp_shelf)
            if m is not None:
                stats["matched_schupp_shelf"] += 1
                combined.at[i, "Schupp Shelf"] = m["shelf"]
                existing = (row.get("Schupp") or "").strip()
                if not existing:
                    combined.at[i, "Schupp"] = "In the queue" if m["shelf"] == "to-read" else "In progress"

    combined.to_csv(out_csv, index=False, quoting=csv.QUOTE_MINIMAL)
    stats["rows"] = len(combined)
    stats["title_col"] = title_col
    return stats


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--goodreads", type=Path, required=True)
    p.add_argument("--nika-storygraph", type=Path, help="CSV scraped from Nika's StoryGraph books-read page")
    p.add_argument("--nika-storygraph-toread", type=Path, help="CSV scraped from Nika's StoryGraph to-read page")
    p.add_argument("--westdac-goodreads", type=Path, help="CSV scraped from westdac's Goodreads read shelf")
    p.add_argument("--westdac-goodreads-shelf", type=Path, help="CSV scraped from westdac's Goodreads to-read / currently-reading shelves")
    p.add_argument("--colton-goodreads", type=Path, help="CSV scraped from colton's Goodreads read shelf")
    p.add_argument("--colton-goodreads-shelf", type=Path, help="CSV scraped from colton's Goodreads to-read / currently-reading shelves")
    p.add_argument("--schupp-goodreads", type=Path, help="CSV scraped from schupp's Goodreads read shelf")
    p.add_argument("--schupp-goodreads-shelf", type=Path, help="CSV scraped from schupp's Goodreads to-read / currently-reading shelves")
    args = p.parse_args()

    gr_read, gr_shelf = load_goodreads(args.goodreads)
    print(f"Goodreads: {len(gr_read)} on read · {len(gr_shelf)} on to-read/currently-reading")

    nika_read = None
    if args.nika_storygraph and args.nika_storygraph.exists():
        nika_read = load_storygraph(args.nika_storygraph)
        print(f"Nika StoryGraph reads: {len(nika_read)}")

    nika_shelf = None
    if args.nika_storygraph_toread and args.nika_storygraph_toread.exists():
        nika_shelf = load_storygraph(args.nika_storygraph_toread)
        print(f"Nika StoryGraph to-read: {len(nika_shelf)}")

    westdac_read = None
    if args.westdac_goodreads and args.westdac_goodreads.exists():
        westdac_read = load_westdac_read(args.westdac_goodreads)
        print(f"Westdac Goodreads reads: {len(westdac_read)}")

    westdac_shelf = None
    if args.westdac_goodreads_shelf and args.westdac_goodreads_shelf.exists():
        westdac_shelf = load_westdac_shelf(args.westdac_goodreads_shelf)
        print(f"Westdac Goodreads shelf: {len(westdac_shelf)}")

    colton_read = None
    if args.colton_goodreads and args.colton_goodreads.exists():
        colton_read = load_goodreads_read_scrape(args.colton_goodreads)
        print(f"Colton Goodreads reads: {len(colton_read)}")

    colton_shelf = None
    if args.colton_goodreads_shelf and args.colton_goodreads_shelf.exists():
        colton_shelf = load_goodreads_shelf_scrape(args.colton_goodreads_shelf)
        print(f"Colton Goodreads shelf: {len(colton_shelf)}")

    schupp_read = None
    if args.schupp_goodreads and args.schupp_goodreads.exists():
        schupp_read = load_goodreads_read_scrape(args.schupp_goodreads)
        print(f"Schupp Goodreads reads: {len(schupp_read)}")

    schupp_shelf = None
    if args.schupp_goodreads_shelf and args.schupp_goodreads_shelf.exists():
        schupp_shelf = load_goodreads_shelf_scrape(args.schupp_goodreads_shelf)
        print(f"Schupp Goodreads shelf: {len(schupp_shelf)}")
    print()

    for stem in ["best_novel", "best_novella_hugo", "best_novelette_hugo", "favorites"]:
        src = args.data / f"{stem}.csv"
        adds = args.data / f"{stem}_additions.csv"
        out = args.data / f"{stem}_updated.csv"
        if not src.exists():
            continue
        s = process_sheet(src, adds, gr_read, gr_shelf, nika_read, nika_shelf, westdac_read, westdac_shelf, colton_read, colton_shelf, schupp_read, schupp_shelf, out)
        print(f"{stem:25s} rows={s['rows']:4d}  T={s['matched_read']:3d}/{s['matched_shelf']:2d}  N={s['matched_nika']:3d}/{s['matched_nika_shelf']:2d}  W={s['matched_westdac']:3d}/{s['matched_westdac_shelf']:2d}  C={s['matched_colton']:3d}/{s['matched_colton_shelf']:2d}  S={s['matched_schupp']:3d}/{s['matched_schupp_shelf']:2d}")


if __name__ == "__main__":
    main()
