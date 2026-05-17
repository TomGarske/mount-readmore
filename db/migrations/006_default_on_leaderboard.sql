-- Readmore — migration 006: leaderboard ON by default
--
-- The product decision: every new signup is on the friends-only leaderboard
-- unless they explicitly opt out. Previously the column default left existing
-- demo accounts (Colt45, Isobat) at OFF, which was confusing — they were on
-- Tom's friend list but invisible on his leaderboard.
--
-- Apply via Supabase SQL Editor. Idempotent.

-- 1) Flip any existing OFF rows to ON.
update public.profiles set on_leaderboard = true where on_leaderboard = false;

-- 2) Default new signups to on.
alter table public.profiles alter column on_leaderboard set default true;
