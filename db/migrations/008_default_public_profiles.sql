-- Readmore — migration 008: profiles public by default
--
-- The visibility radio (private / public) has been removed from Settings.
-- Product decision: every signup is public — anyone can open /u/<handle>.
-- Friends-only "leaderboard appearance" is the only opt-in left (controlled
-- by on_leaderboard, which migration 006 already defaulted to true).
--
-- The profile_visibility column stays in the schema as a safety valve: an
-- admin can still flip a problem profile to 'private' from the admin page
-- without a code change. The 'link' enum value is kept for back-compat
-- (one profile somewhere may have it) but the CHECK constraint still
-- allows it — we're just no longer surfacing it in any UI.
--
-- Apply via Supabase SQL Editor. Idempotent.

-- 1) Flip every existing non-public profile to public.
update public.profiles
set    profile_visibility = 'public'
where  profile_visibility != 'public';

-- 2) Default new signups to public.
alter table public.profiles
alter column profile_visibility set default 'public';
