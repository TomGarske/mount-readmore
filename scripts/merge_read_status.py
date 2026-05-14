"""Merge Goodreads CSV into the award sheets' Tom column.

For each sheet CSV in data/:
  1. Append its *_additions.csv if one exists (so 2025/2026 rows are included)
  2. Match each row against the Goodreads "read" shelf
  3. Populate the Tom column where empty; leave existing notes alone

Outputs `*_updated.csv` files in data/ for review before regenerating the xlsx.

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


def strip_series_suffix(title: str) -> str:
    """'The Tainted Cup (Shadow of the Leviathan, #1)' -> 'the tainted cup'"""
    t = normalize(title)
    if "(" in t:
        t = t.split("(", 1)[0].strip()
    return t


def find_match(title: str, author: str, gr: pd.DataFrame):
    """Returns the matching row from gr, or None."""
    t = normalize(title)
    a = normalize(author)
    if not t or gr.empty:
        return None

    gr_stripped = gr.assign(title_stripped=gr["title_n"].apply(strip_series_suffix))

    exact = gr_stripped[gr_stripped["title_stripped"] == t]
    for _, row in exact.iterrows():
        if a and (a in row["author_n"] or row["author_n"] in a):
            return row
    if not exact.empty:
        return exact.iloc[0]

    titles = gr_stripped["title_stripped"].tolist()
    hit = process.extractOne(t, titles, scorer=fuzz.ratio, score_cutoff=88)
    if hit:
        _, _, idx = hit
        cand = gr_stripped.iloc[idx]
        if not a or fuzz.partial_ratio(a, cand["author_n"]) >= 70:
            return cand
    return None


def process_sheet(sheet_csv: Path, additions_csv: Path | None, gr_read: pd.DataFrame, gr_shelf: pd.DataFrame, out_csv: Path) -> dict:
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
    for col in ["Tom", "Tom Date Read", "Tom Rating", "Tom Shelf"]:
        if col not in combined.columns:
            combined[col] = ""

    matched_read = 0
    matched_shelf = 0
    for i, row in combined.iterrows():
        title = row.get(title_col, "")
        author = row.get(author_col, "")

        # Try read shelf first
        m = find_match(title, author, gr_read)
        if m is not None:
            matched_read += 1
            existing = (row.get("Tom") or "").strip()
            if not existing:
                combined.at[i, "Tom"] = "Read"
            if m.get("date_read", ""):
                combined.at[i, "Tom Date Read"] = m["date_read"]
            rating = m.get("My Rating", "") or ""
            if rating and rating != "0":
                combined.at[i, "Tom Rating"] = rating
            continue  # don't also check shelf

        # Otherwise check to-read / currently-reading
        m = find_match(title, author, gr_shelf)
        if m is not None:
            matched_shelf += 1
            combined.at[i, "Tom Shelf"] = m["shelf"]
            existing = (row.get("Tom") or "").strip()
            if not existing:
                combined.at[i, "Tom"] = "In the queue" if m["shelf"] == "to-read" else "In progress"

    combined.to_csv(out_csv, index=False, quoting=csv.QUOTE_MINIMAL)
    return {"rows": len(combined), "matched_read": matched_read, "matched_shelf": matched_shelf, "title_col": title_col}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--goodreads", type=Path, required=True)
    args = p.parse_args()

    gr_read, gr_shelf = load_goodreads(args.goodreads)
    print(f"Goodreads: {len(gr_read)} on read · {len(gr_shelf)} on to-read/currently-reading\n")

    for stem in ["best_novel", "best_novella_hugo", "best_novelette_hugo", "favorites"]:
        src = args.data / f"{stem}.csv"
        adds = args.data / f"{stem}_additions.csv"
        out = args.data / f"{stem}_updated.csv"
        if not src.exists():
            continue
        s = process_sheet(src, adds, gr_read, gr_shelf, out)
        print(f"{stem:25s} rows={s['rows']:4d}  read={s['matched_read']:3d}  shelf={s['matched_shelf']:3d}  -> {out.name}")


if __name__ == "__main__":
    main()
