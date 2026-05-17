-- Mount Readmore — migration 002
-- 1. Adds is_admin to profiles
-- 2. Extends RLS so admins can read + manage anyone's profile and user_books
--
-- Apply via Supabase SQL Editor → New Query → paste → Run. Idempotent.

-- ---------------------------------------------------------------
-- is_admin column
-- ---------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- ---------------------------------------------------------------
-- Admin RLS policies
-- All defined relative to `(select is_admin from profiles where id = auth.uid())`
-- and combine with the existing self/public/insert policies via OR.
-- ---------------------------------------------------------------

-- profiles: admins can read every row (regardless of profile_visibility)
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );

-- profiles: admins can update any row
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );

-- user_books: admins can read every row (already partially exposed via
-- public-profile rule; this also covers private profiles)
drop policy if exists user_books_select_admin on public.user_books;
create policy user_books_select_admin on public.user_books
  for select using (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );

-- user_books: admins can write rows for any user
drop policy if exists user_books_insert_admin on public.user_books;
create policy user_books_insert_admin on public.user_books
  for insert with check (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );

drop policy if exists user_books_update_admin on public.user_books;
create policy user_books_update_admin on public.user_books
  for update using (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );

drop policy if exists user_books_delete_admin on public.user_books;
create policy user_books_delete_admin on public.user_books
  for delete using (
    exists (select 1 from public.profiles p2
            where p2.id = auth.uid() and p2.is_admin)
  );
