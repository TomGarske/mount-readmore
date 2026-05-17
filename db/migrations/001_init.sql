-- Mount Readmore — initial schema
-- Apply via Supabase Dashboard → SQL Editor → New Query → paste → Run.
-- Idempotent: safe to re-run.

-- =============================================================
-- Canonical book catalog
-- Minimal — full metadata (title, author, cover, description) ships
-- to the client in site/data.json. This table exists for FK integrity
-- on user_books and for SQL-side leaderboard aggregation.
-- Populated by scripts/sync_books_to_supabase.py after every site build.
-- =============================================================
create table if not exists public.books (
  id          text primary key,
  category    text not null check (category in ('Novel', 'Novella', 'Novelette')),
  year        int,
  has_hugo    boolean not null default false,
  has_nebula  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists books_category_idx on public.books(category);
create index if not exists books_hugo_idx     on public.books(has_hugo) where has_hugo;
create index if not exists books_nebula_idx   on public.books(has_nebula) where has_nebula;

-- =============================================================
-- Per-user profile (1:1 with auth.users)
-- =============================================================
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  handle              text unique not null,
  profile_visibility  text not null default 'private'
                        check (profile_visibility in ('private', 'public', 'link')),
  share_token         text unique,
  on_leaderboard      boolean not null default false,
  created_at          timestamptz not null default now()
);
create index if not exists profiles_visibility_idx on public.profiles(profile_visibility);
create index if not exists profiles_leaderboard_idx on public.profiles(on_leaderboard) where on_leaderboard;

-- =============================================================
-- A user's status on a canonical book
-- =============================================================
create table if not exists public.user_books (
  user_id     uuid not null references public.profiles(id) on delete cascade,
  book_id     text not null references public.books(id)    on delete cascade,
  status      text not null check (status in ('read', 'started', 'nightstand')),
  date_read   date,
  updated_at  timestamptz not null default now(),
  primary key (user_id, book_id)
);
create index if not exists user_books_user_idx   on public.user_books(user_id);
create index if not exists user_books_status_idx on public.user_books(status);

-- =============================================================
-- Trigger: auto-create a profile row when a new auth.users row appears
-- Generates a candidate handle from the email; resolves uniqueness collisions
-- by appending a counter.
-- =============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_handle  text;
  final_handle text;
  counter      int := 0;
begin
  base_handle := lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1),
                                      '[^a-z0-9]+', '', 'g'));
  if base_handle = '' or length(base_handle) < 3 then
    base_handle := 'reader' || substr(new.id::text, 1, 8);
  end if;

  final_handle := base_handle;
  while exists (select 1 from public.profiles where handle = final_handle) loop
    counter := counter + 1;
    final_handle := base_handle || counter::text;
  end loop;

  insert into public.profiles (id, handle) values (new.id, final_handle);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================
-- Trigger: keep user_books.updated_at fresh
-- =============================================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists user_books_updated_at on public.user_books;
create trigger user_books_updated_at
  before update on public.user_books
  for each row execute function public.set_updated_at();

-- =============================================================
-- Row Level Security
-- =============================================================
alter table public.books      enable row level security;
alter table public.profiles   enable row level security;
alter table public.user_books enable row level security;

-- books: world-readable, no client writes (only service_role via sync script)
drop policy if exists books_select on public.books;
create policy books_select on public.books for select using (true);

-- profiles: owner sees own; anyone sees 'public' profiles.
-- 'link' visibility is checked via RPC (share_token-gated) — not via policy.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self on public.profiles
  for select using (auth.uid() = id);

drop policy if exists profiles_select_public on public.profiles;
create policy profiles_select_public on public.profiles
  for select using (profile_visibility = 'public');

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update using (auth.uid() = id);

-- user_books: owner-only for write; readable if owner OR profile is public
drop policy if exists user_books_select_self on public.user_books;
create policy user_books_select_self on public.user_books
  for select using (auth.uid() = user_id);

drop policy if exists user_books_select_public on public.user_books;
create policy user_books_select_public on public.user_books
  for select using (
    exists (
      select 1 from public.profiles p
      where p.id = user_id and p.profile_visibility = 'public'
    )
  );

drop policy if exists user_books_insert_self on public.user_books;
create policy user_books_insert_self on public.user_books
  for insert with check (auth.uid() = user_id);

drop policy if exists user_books_update_self on public.user_books;
create policy user_books_update_self on public.user_books
  for update using (auth.uid() = user_id);

drop policy if exists user_books_delete_self on public.user_books;
create policy user_books_delete_self on public.user_books
  for delete using (auth.uid() = user_id);

-- =============================================================
-- Leaderboards
-- Plain views (definer-mode by default in Supabase) so aggregations
-- can cross-tabulate against user_books without per-row RLS limits.
-- Only on_leaderboard=true profiles appear.
-- =============================================================
create or replace view public.leaderboard_overall as
with totals as (select count(*)::int as total from public.books),
     reads as (
       select user_id, count(*)::int as read_count
       from public.user_books
       where status = 'read'
       group by user_id
     )
select
  p.id          as user_id,
  p.handle,
  coalesce(r.read_count, 0)                                       as read_count,
  round(coalesce(r.read_count, 0)::numeric
        / nullif((select total from totals), 0) * 100, 1)         as pct,
  rank() over (order by coalesce(r.read_count, 0) desc, p.created_at asc) as rank,
  (select total from totals)                                      as total_books
from public.profiles p
left join reads r on r.user_id = p.id
where p.on_leaderboard;

create or replace view public.leaderboard_by_award as
with hugo_total   as (select count(*)::int as total from public.books where has_hugo),
     nebula_total as (select count(*)::int as total from public.books where has_nebula),
     hugo_reads as (
       select ub.user_id, count(*)::int as read_count
       from public.user_books ub
       join public.books b on b.id = ub.book_id
       where ub.status = 'read' and b.has_hugo
       group by ub.user_id
     ),
     nebula_reads as (
       select ub.user_id, count(*)::int as read_count
       from public.user_books ub
       join public.books b on b.id = ub.book_id
       where ub.status = 'read' and b.has_nebula
       group by ub.user_id
     )
select
  'hugo'::text  as award,
  p.id          as user_id,
  p.handle,
  coalesce(h.read_count, 0)                                          as read_count,
  (select total from hugo_total)                                     as total_books,
  round(coalesce(h.read_count, 0)::numeric
        / nullif((select total from hugo_total), 0) * 100, 1)        as pct,
  rank() over (order by coalesce(h.read_count, 0) desc, p.created_at asc) as rank
from public.profiles p
left join hugo_reads h on h.user_id = p.id
where p.on_leaderboard
union all
select
  'nebula'::text as award,
  p.id           as user_id,
  p.handle,
  coalesce(n.read_count, 0)                                          as read_count,
  (select total from nebula_total)                                   as total_books,
  round(coalesce(n.read_count, 0)::numeric
        / nullif((select total from nebula_total), 0) * 100, 1)      as pct,
  rank() over (order by coalesce(n.read_count, 0) desc, p.created_at asc) as rank
from public.profiles p
left join nebula_reads n on n.user_id = p.id
where p.on_leaderboard;

-- =============================================================
-- Grants — anon + authenticated need explicit grants on the views
-- =============================================================
grant select on public.books               to anon, authenticated;
grant select on public.profiles            to anon, authenticated;
grant select on public.user_books          to anon, authenticated;
grant select on public.leaderboard_overall to anon, authenticated;
grant select on public.leaderboard_by_award to anon, authenticated;

grant update                       on public.profiles   to authenticated;
grant insert, update, delete       on public.user_books to authenticated;
