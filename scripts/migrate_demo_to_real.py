"""Migrate the five seed demo profiles toward real-account use.

For each entry in `REAL_USERS`, this:
  - Looks up the existing profile by its current handle
  - Updates auth.users.email to the real email (admin API; email_confirm=True so
    no verification mail is sent)
  - Renames the profile handle and sets profile_visibility='public' +
    on_leaderboard=True + is_admin flag

For each entry in `HIDE_DEMOS`, this:
  - Sets profile_visibility='private' and on_leaderboard=False
  - Keeps the row + its user_books rows intact so the admin can re-assign the
    auth.users.email later (when the real person signs up).

Requirements: scripts/sync_books_to_supabase.py docs apply (env vars + supabase).

Idempotent — running again is a no-op once the handles match the target state.
"""
from __future__ import annotations

import os
import sys

try:
    from supabase import create_client
except ImportError:
    sys.stderr.write("Missing dependency: pip install supabase\n")
    sys.exit(1)


# (current handle, new email, new handle, is_admin)
REAL_USERS: list[tuple[str, str, str, bool]] = [
    ("Urdomen", "tdgarske@gmail.com", "tom", True),
]

# Stay in the DB, lose public visibility until Tom hands their accounts off.
HIDE_DEMOS = ["SappySaffron", "Westdac", "Colt45", "Isobat"]


def main() -> int:
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        sys.stderr.write(
            "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.\n"
        )
        return 2

    sb = create_client(url, key)

    for old_handle, new_email, new_handle, is_admin in REAL_USERS:
        # Locate the profile to migrate. Could already be at the new handle —
        # treat that as a no-op success.
        for lookup_handle in (old_handle, new_handle):
            rows = (
                sb.table("profiles")
                  .select("id,handle")
                  .eq("handle", lookup_handle)
                  .execute()
                  .data
            )
            if rows:
                uid = rows[0]["id"]
                current = rows[0]["handle"]
                break
        else:
            print(f"  skip: no profile with handle={old_handle!r} or {new_handle!r}")
            continue

        # Update auth.users (email + confirm).
        try:
            sb.auth.admin.update_user_by_id(
                uid,
                {"email": new_email, "email_confirm": True},
            )
        except Exception as e:
            # Email may already be set to the target; not fatal.
            print(f"  warn: auth update for {uid}: {e}")

        # Update profile.
        sb.table("profiles").update({
            "handle": new_handle,
            "is_admin": is_admin,
            "profile_visibility": "public",
            "on_leaderboard": True,
        }).eq("id", uid).execute()

        print(
            f"  migrated @{current} → @{new_handle} "
            f"({new_email}) admin={is_admin}"
        )

    for handle in HIDE_DEMOS:
        rows = (
            sb.table("profiles")
              .select("id")
              .eq("handle", handle)
              .execute()
              .data
        )
        if not rows:
            print(f"  skip: no profile with handle={handle!r}")
            continue
        sb.table("profiles").update({
            "profile_visibility": "private",
            "on_leaderboard": False,
        }).eq("id", rows[0]["id"]).execute()
        print(f"  hidden  @{handle}  (private, off-leaderboard, data preserved)")

    print("Done.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
