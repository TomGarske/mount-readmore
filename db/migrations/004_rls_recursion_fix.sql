-- Mount Readmore — migration 004: break the infinite-recursion in admin RLS
--
-- Migration 002 added policies that test `is_admin` via a subquery against
-- profiles itself. When evaluating that subquery, Postgres re-runs the same
-- profiles policies, including this one — infinite recursion → 42P17 errors
-- on every profiles/user_books/friendships select.
--
-- Fix: a SECURITY DEFINER helper that reads is_admin without re-entering RLS.
--
-- Apply via Supabase SQL Editor. Idempotent.

create or replace function public.is_admin_current()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

revoke all on function public.is_admin_current() from public;
grant execute on function public.is_admin_current() to anon, authenticated;

-- Profiles
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles
  for select using (public.is_admin_current());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
  for update using (public.is_admin_current());

-- user_books
drop policy if exists user_books_select_admin on public.user_books;
create policy user_books_select_admin on public.user_books
  for select using (public.is_admin_current());

drop policy if exists user_books_insert_admin on public.user_books;
create policy user_books_insert_admin on public.user_books
  for insert with check (public.is_admin_current());

drop policy if exists user_books_update_admin on public.user_books;
create policy user_books_update_admin on public.user_books
  for update using (public.is_admin_current());

drop policy if exists user_books_delete_admin on public.user_books;
create policy user_books_delete_admin on public.user_books
  for delete using (public.is_admin_current());

-- friendships
drop policy if exists friendships_select_admin on public.friendships;
create policy friendships_select_admin on public.friendships
  for select using (public.is_admin_current());
