-- Mount Readmore — migration 005: address Supabase Advisor warnings
--
-- Three classes of warnings:
--
-- 1. Function Search Path Mutable on `set_updated_at`
--    Fix: pin search_path = public so the function can't be hijacked by
--    a malicious schema in the caller's search_path.
--
-- 2. Multiple Permissive Policies on profiles + user_books
--    Postgres OR-evaluates every permissive policy that matches a (role,
--    action) pair, so three policies = three subqueries per row. Fix:
--    collapse each stack into one policy with an OR'd condition.
--
-- 3. Security Definer View on leaderboard_overall + leaderboard_by_award
--    NOT FIXED — see note at the bottom. This is an intentional design
--    choice and the advisor flag is a false positive for our scoping rule.
--
-- Apply via Supabase SQL Editor. Idempotent.

-- =============================================================
-- 1. Pin search_path on set_updated_at
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin new.updated_at := now(); return new; end;
$$;

-- =============================================================
-- 2a. Consolidate profiles SELECT policies
--     Was: self + public + admin (three separate policies)
-- =============================================================
drop policy if exists profiles_select_self   on public.profiles;
drop policy if exists profiles_select_public on public.profiles;
drop policy if exists profiles_select_admin  on public.profiles;
create policy profiles_select on public.profiles
  for select using (
    auth.uid() = id
    or profile_visibility = 'public'
    or public.is_admin_current()
  );

-- 2b. Consolidate profiles UPDATE policies
--     Was: self + admin
drop policy if exists profiles_update_self  on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update on public.profiles
  for update using (
    auth.uid() = id
    or public.is_admin_current()
  );

-- =============================================================
-- 2c. Consolidate user_books SELECT policies
--     Was: self + public + admin
-- =============================================================
drop policy if exists user_books_select_self   on public.user_books;
drop policy if exists user_books_select_public on public.user_books;
drop policy if exists user_books_select_admin  on public.user_books;
create policy user_books_select on public.user_books
  for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.profiles p
      where p.id = user_books.user_id and p.profile_visibility = 'public'
    )
    or public.is_admin_current()
  );

-- 2d. Consolidate user_books INSERT/UPDATE/DELETE policies
--     Was: self + admin on each
drop policy if exists user_books_insert_self  on public.user_books;
drop policy if exists user_books_insert_admin on public.user_books;
create policy user_books_insert on public.user_books
  for insert with check (
    auth.uid() = user_id
    or public.is_admin_current()
  );

drop policy if exists user_books_update_self  on public.user_books;
drop policy if exists user_books_update_admin on public.user_books;
create policy user_books_update on public.user_books
  for update using (
    auth.uid() = user_id
    or public.is_admin_current()
  );

drop policy if exists user_books_delete_self  on public.user_books;
drop policy if exists user_books_delete_admin on public.user_books;
create policy user_books_delete on public.user_books
  for delete using (
    auth.uid() = user_id
    or public.is_admin_current()
  );

-- 2e. Consolidate friendships SELECT policies
--     Was: party (a or b) + admin
drop policy if exists friendships_select_party on public.friendships;
drop policy if exists friendships_select_admin on public.friendships;
create policy friendships_select on public.friendships
  for select using (
    auth.uid() = user_id_a
    or auth.uid() = user_id_b
    or public.is_admin_current()
  );

-- =============================================================
-- 3. Security Definer View — INTENTIONALLY NOT FIXED
--
-- leaderboard_overall and leaderboard_by_award run as the view owner
-- (postgres) because we explicitly filter by auth.uid() in the view's
-- WHERE clause:
--
--   where p.on_leaderboard
--     and (p.id = auth.uid() or public.is_friend_of_current(p.id))
--
-- If we set `security_invoker = on`, the view would re-run RLS on
-- public.profiles for the caller — which would hide any friend whose
-- profile_visibility is not 'public' (i.e. private friends would not
-- show up on the leaderboard even though they should). That breaks
-- the product. The current design is correct: explicit allow-list at
-- the SQL level, definer view to bypass profiles-RLS during the join.
--
-- The advisor flag is a false positive for this access pattern.
-- =============================================================
comment on view public.leaderboard_overall is
  $cmt$Friends-scoped leaderboard. SECURITY DEFINER view by design: filters rows via explicit auth.uid() + is_friend_of_current() predicate in the view itself, NOT via RLS on profiles.$cmt$;

comment on view public.leaderboard_by_award is
  $cmt$Friends-scoped per-award leaderboard. SECURITY DEFINER view by design: filters rows via explicit auth.uid() + is_friend_of_current() predicate in the view itself, NOT via RLS on profiles.$cmt$;
