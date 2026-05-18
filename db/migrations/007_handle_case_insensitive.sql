-- Readmore — migration 007: handle uniqueness is case-insensitive
--
-- Today's profiles.handle has a plain unique constraint, so 'Tom' and 'tom'
-- could coexist as two different profiles. App-side lookups all use ilike()
-- which is case-insensitive — meaning two profiles would silently collide on
-- read paths (compare-page user lookup, friend-add, etc.).
--
-- Fix: add a unique index on lower(handle). Postgres rejects collisions with
-- 23505, which the Settings save handler already maps to "@Tom is taken".
-- Display casing is preserved (handle column is unchanged).
--
-- Also: the add_tom_as_friend trigger hard-matched `handle = 'tom'` (case
-- sensitive). If @tom renames to Tom or TomGarske, new signups stop getting
-- auto-friended without any error. Make that lookup case-insensitive too.
--
-- Apply via Supabase SQL Editor. Idempotent.

-- 1) Case-insensitive uniqueness on profiles.handle
create unique index if not exists profiles_handle_lower_idx
  on public.profiles (lower(handle));

-- 2) Case-insensitive lookup inside the auto-friend trigger
create or replace function public.add_tom_as_friend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tom_id uuid;
begin
  select id into tom_id from public.profiles where lower(handle) = 'tom' limit 1;
  if tom_id is null or tom_id = new.id then
    return new;
  end if;
  insert into public.friendships (user_id_a, user_id_b)
  values (least(new.id, tom_id), greatest(new.id, tom_id))
  on conflict do nothing;
  return new;
end;
$$;
