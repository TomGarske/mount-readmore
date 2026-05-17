"""Sync the canonical book catalog from site/data.json into Supabase.

Reads site/data.json (produced by build_site_data.py), upserts a minimal record
into public.books for every canonical book. Run this after every catalog update.

Requirements:
    pip install supabase python-dotenv  (or just supabase)

Env vars (don't commit these — drop into ~/.env or pass on the command line):
    SUPABASE_URL          https://<project-ref>.supabase.co
    SUPABASE_SERVICE_KEY  Supabase secret key. In Settings → API → API Keys this
                          shows as `sb_secret_*` under "Secret keys" (the legacy
                          `service_role` JWT also works). NEVER ship to clients.

Usage:
    SUPABASE_URL=...  SUPABASE_SERVICE_KEY=... python scripts/sync_books_to_supabase.py
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    sys.stderr.write(
        "Missing dependency: pip install supabase\n"
    )
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "site" / "data.json"


def to_row(book: dict) -> dict | None:
    """Convert a site/data.json book entry into a Supabase row, or None to skip."""
    book_id = book.get("id")
    category = book.get("category")
    if not book_id or category not in ("Novel", "Novella", "Novelette"):
        return None
    awards = book.get("awards") or {}
    return {
        "id": book_id,
        "category": category,
        "year": book.get("year"),
        "has_hugo": "hugo" in awards,
        "has_nebula": "nebula" in awards,
    }


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.stderr.write(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.\n"
        )
        return 2

    if not DATA_FILE.exists():
        sys.stderr.write(f"Missing {DATA_FILE} — run scripts/build_site_data.py first.\n")
        return 2

    with DATA_FILE.open() as f:
        data = json.load(f)

    rows = [r for r in (to_row(b) for b in data.get("books", [])) if r]
    if not rows:
        sys.stderr.write("No books to sync — data.json appears empty.\n")
        return 1

    sb = create_client(url, key)

    # Upsert in batches; supabase-py has a soft limit around 500 rows per call.
    BATCH = 500
    sent = 0
    for i in range(0, len(rows), BATCH):
        chunk = rows[i : i + BATCH]
        sb.table("books").upsert(chunk, on_conflict="id").execute()
        sent += len(chunk)
        print(f"  upserted {sent}/{len(rows)} books")

    print(f"Done. Canonical catalog synced ({len(rows)} books).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
