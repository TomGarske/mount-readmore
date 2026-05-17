"""Create the five demo reader accounts in Supabase and seed their user_books
from the existing site/data.json reading status.

These accounts mirror the current CSV-driven multi-reader view (Tom, Nika,
Westdac, Colton, Schupp). They have unloggable random passwords; nobody is
expected to sign into them. They are public profiles with leaderboard opt-in
so visitors can see the existing reader cohort.

Idempotent — running again wipes and reloads each reader's user_books while
preserving their auth.users + profiles row (and their stable user_id).

Requirements:
    pip install supabase

Env vars:
    SUPABASE_URL          https://<project-ref>.supabase.co
    SUPABASE_SERVICE_KEY  service_role key (Settings → API). NEVER ship to clients.

Usage:
    SUPABASE_URL=... SUPABASE_SERVICE_KEY=... \
        python scripts/sync_demo_readers_to_supabase.py
"""
from __future__ import annotations

import json
import os
import re
import secrets
import sys
from pathlib import Path

try:
    from supabase import create_client
except ImportError:
    sys.stderr.write("Missing dependency: pip install supabase\n")
    sys.exit(1)


REPO_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = REPO_ROOT / "site" / "data.json"

# (data.json reader column key, public handle)
DEMO_READERS: list[tuple[str, str]] = [
    ("tom",     "Urdomen"),
    ("nika",    "SappySaffron"),
    ("westdac", "Westdac"),
    ("colton",  "Colt45"),
    ("schupp",  "Isobat"),
]

# Used only for the auth.users.email field. These accounts can't be logged into.
EMAIL_DOMAIN = "demo.mount-readmore.app"


def map_status(book: dict, who: str) -> str | None:
    """data.json reader fields → ('read' | 'started' | 'nightstand' | None).

    Mirrors site/app.js readStatus() and adds shelf-derived nightstand.
    """
    val = (book.get(who) or "").strip().lower()
    shelf = (book.get(f"{who}_shelf") or "").strip().lower()
    if val.startswith("read"):
        return "read"
    if any(k in val for k in ("queue", "progress", "started", "struggling")):
        return "started"
    if val:
        return "started"
    if shelf == "currently-reading":
        return "started"
    if shelf == "to-read":
        return "nightstand"
    return None


def date_read(book: dict, who: str) -> str | None:
    raw = (book.get(f"{who}_date_read") or "").strip()
    if not raw:
        return None
    # Goodreads exports often use "YYYY/MM/DD"; normalize to ISO.
    m = re.match(r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$", raw)
    if m:
        y, mo, d = m.groups()
        return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"
    # Already ISO-ish — let Postgres validate.
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        return raw
    return None


def find_or_create_user(sb, reader_col: str, handle: str) -> str:
    """Return the auth.users.id (== profiles.id) for this demo reader."""
    existing = sb.table("profiles").select("id").eq("handle", handle).execute()
    if existing.data:
        uid = existing.data[0]["id"]
        print(f"  found existing {handle} ({uid})")
        # Ensure visibility/leaderboard stay set as we want.
        sb.table("profiles").update({
            "profile_visibility": "public",
            "on_leaderboard": True,
        }).eq("id", uid).execute()
        return uid

    res = sb.auth.admin.create_user({
        "email": f"{reader_col}@{EMAIL_DOMAIN}",
        "email_confirm": True,
        "password": secrets.token_urlsafe(32),
        "user_metadata": {"demo": True, "source_reader": reader_col},
    })
    uid = res.user.id

    # Trigger created a profile with a handle from the email; override.
    sb.table("profiles").update({
        "handle": handle,
        "profile_visibility": "public",
        "on_leaderboard": True,
    }).eq("id", uid).execute()
    print(f"  created {handle} ({uid})")
    return uid


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.stderr.write(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in the environment.\n"
        )
        return 2
    if not DATA_FILE.exists():
        sys.stderr.write(
            f"Missing {DATA_FILE} — run scripts/build_site_data.py first.\n"
        )
        return 2

    sb = create_client(url, key)
    data = json.load(DATA_FILE.open())
    books = data.get("books") or []
    print(f"Loaded {len(books)} books from data.json.")

    # 1. Create/locate the five demo profiles.
    reader_user_ids: dict[str, str] = {}
    for col, handle in DEMO_READERS:
        reader_user_ids[col] = find_or_create_user(sb, col, handle)

    # 2. Build user_books rows from data.json status columns.
    rows_per_reader: dict[str, list[dict]] = {col: [] for col, _ in DEMO_READERS}
    for book in books:
        bid = book.get("id")
        if not bid:
            continue
        for col, _ in DEMO_READERS:
            status = map_status(book, col)
            if status is None:
                continue
            row = {
                "user_id": reader_user_ids[col],
                "book_id": bid,
                "status": status,
            }
            d = date_read(book, col)
            if d:
                row["date_read"] = d
            rows_per_reader[col].append(row)

    # 3. Wipe + bulk-reload each reader's books (simple idempotent reload).
    for col, handle in DEMO_READERS:
        uid = reader_user_ids[col]
        sb.table("user_books").delete().eq("user_id", uid).execute()
        rows = rows_per_reader[col]
        if not rows:
            print(f"  {handle}: no rows to insert")
            continue
        BATCH = 500
        for i in range(0, len(rows), BATCH):
            sb.table("user_books").insert(rows[i:i + BATCH]).execute()
        statuses = {}
        for r in rows:
            statuses[r["status"]] = statuses.get(r["status"], 0) + 1
        summary = ", ".join(f"{n} {s}" for s, n in sorted(statuses.items()))
        print(f"  {handle}: {len(rows)} rows ({summary})")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
