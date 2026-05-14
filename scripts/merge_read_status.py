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


def load_goodreads_read(path: Path) -> pd.DataFrame:
    df = pd.read_csv(path, dtype=str).fillna("")
    df = df[df["Exclusive Shelf"].str.lower() == "read"].copy()
    df["title_n"] = df["Title"].apply(normalize)
    df["author_n"] = df["Author"].apply(normalize)
    return df[["Title", "Author", "title_n", "author_n", "Date Read", "My Rating"]]


def strip_series_suffix(title: str) -> str:
    """'The Tainted Cup (Shadow of the Leviathan, #1)' -> 'the tainted cup'"""
    t = normalize(title)
    if "(" in t:
        t = t.split("(", 1)[0].strip()
    return t


def match_row(title: str, author: str, gr: pd.DataFrame) -> tuple[bool, str]:
    """Returns (matched, note). note = '' for clean match, otherwise the matched title."""
    t = normalize(title)
    a = normalize(author)
    if not t:
        return False, ""

    # Goodreads stripped: 'the tainted cup (shadow of...)' -> 'the tainted cup'
    gr_stripped = gr.assign(title_stripped=gr["title_n"].apply(strip_series_suffix))

    # Exact match on stripped Goodreads title
    exact = gr_stripped[gr_stripped["title_stripped"] == t]
    for _, row in exact.iterrows():
        if a and (a in row["author_n"] or row["author_n"] in a):
            return True, ""
    if not exact.empty:
        return True, f"(title match: {exact.iloc[0]['Title']})"

    # Fuzzy match against stripped titles
    titles = gr_stripped["title_stripped"].tolist()
    if not titles:
        return False, ""
    hit = process.extractOne(t, titles, scorer=fuzz.ratio, score_cutoff=88)
    if hit:
        _, _, idx = hit
        cand = gr_stripped.iloc[idx]
        if not a or fuzz.partial_ratio(a, cand["author_n"]) >= 70:
            return True, f"(fuzzy: {cand['Title']})"
    return False, ""


def process_sheet(sheet_csv: Path, additions_csv: Path | None, gr: pd.DataFrame, out_csv: Path) -> dict:
    base = pd.read_csv(sheet_csv, dtype=str, keep_default_na=False)

    if additions_csv and additions_csv.exists():
        adds = pd.read_csv(additions_csv, dtype=str, keep_default_na=False)
        # Align columns
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
    if "Tom" not in combined.columns:
        combined["Tom"] = ""

    matched = 0
    overwritten = 0
    for i, row in combined.iterrows():
        title = row.get(title_col, "")
        author = row.get(author_col, "")
        is_match, note = match_row(title, author, gr)
        if is_match:
            matched += 1
            existing = (row.get("Tom") or "").strip()
            if not existing:
                combined.at[i, "Tom"] = "Read" + (f" {note}" if note else "")
            else:
                overwritten += 0  # leave existing note alone

    combined.to_csv(out_csv, index=False, quoting=csv.QUOTE_MINIMAL)
    return {"rows": len(combined), "matched": matched, "title_col": title_col}


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--data", type=Path, default=Path("data"))
    p.add_argument("--goodreads", type=Path, required=True)
    args = p.parse_args()

    gr = load_goodreads_read(args.goodreads)
    print(f"Goodreads: {len(gr)} books on the 'read' shelf\n")

    for stem in ["best_novel", "best_novella_hugo", "best_novelette_hugo", "best_series_hugo", "favorites"]:
        src = args.data / f"{stem}.csv"
        adds = args.data / f"{stem}_additions.csv"
        out = args.data / f"{stem}_updated.csv"
        if not src.exists():
            continue
        stats = process_sheet(src, adds, gr, out)
        print(f"{stem:25s} rows={stats['rows']:4d}  read-matches={stats['matched']:3d}  -> {out.name}")


if __name__ == "__main__":
    main()
