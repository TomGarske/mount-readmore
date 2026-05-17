-- Mount Readmore — migration 003: friendships + friends-scoped leaderboard
--
-- 1. New `friendships` table (bidirectional via canonical ordering)
-- 2. Trigger: every new profile auto-friends @tom (the default-friend rule)
-- 3. Backfill existing profiles so they're all friends with @tom too
-- 4. Rewrite the leaderboard views to only show the signed-in user + their friends
--
-- Apply via Supabase SQL Editor → New Query → paste → Run. Idempotent.

-- =============================================================
-- friendships
-- Canonical ordering: user_id_a < user_id_b so each pair has exactly one row.
-- =============================================================
create table if not exists public.friendships (
  user_id_a   uuid not null references public.profiles(id) on delete cascade,
  user_id_b   uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint friendships_ordering check (user_id_a < user_id_b),
  primary key (user_id_a, user_id_b)
);
create index if not exists friendships_a_idx on public.friendships(user_id_a);
create index if not exists friendships_b_idx on public.friendships(user_id_b);

alter table public.friendships enable row level security;

drop policy if exists friendships_select_party on public.friendships;
create policy friendships_select_party on public.friendships
  for select using (auth.uid() = user_id_a or auth.uid() = user_id_b);

drop policy if exists friendships_select_admin on public.friendships;
create policy friendships_select_admin on public.friendships
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin)
  );

drop policy if exists friendships_insert_party on public.friendships;
create policy friendships_insert_party on public.friendships
  for insert with check (auth.uid() = user_id_a or auth.uid() = user_id_b);

drop policy if exists friendships_delete_party on public.friendships;
create policy friendships_delete_party on public.friendships
  for delete using (auth.uid() = user_id_a or auth.uid() = user_id_b);

grant select, insert, delete on public.friendships to authenticated;

-- =============================================================
-- Trigger: when a new profile is inserted, auto-friend @tom (the admin)
-- The handle_new_user trigger inserts profiles; this fires after that.
-- =============================================================
create or replace function public.add_tom_as_friend()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  tom_id uuid;
begin
  select id into tom_id from public.profiles where handle = 'tom' limit 1;
  if tom_id is null or tom_id = new.id then
    return new;
  end if;
  insert into public.friendships (user_id_a, user_id_b)
  values (least(new.id, tom_id), greatest(new.id, tom_id))
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_default_friend on public.profiles;
create trigger profiles_default_friend
  after insert on public.profiles
  for each row execute function public.add_tom_as_friend();

-- Backfill: make every existing profile friends with @tom.
do $$
declare
  tom_id uuid;
begin
  select id into tom_id from public.profiles where handle = 'tom' limit 1;
  if tom_id is not null then
    insert into public.friendships (user_id_a, user_id_b)
    select least(p.id, tom_id), greatest(p.id, tom_id)
    from public.profiles p
    where p.id <> tom_id
    on conflict do nothing;
  end if;
end $$;

-- =============================================================
-- Helper: is the requesting user (auth.uid()) friends with target_id?
-- =============================================================
create or replace function public.is_friend_of_current(target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_id = auth.uid()
    or exists (
      select 1 from public.friendships
      where (user_id_a = least(auth.uid(), target_id)
         and user_id_b = greatest(auth.uid(), target_id))
    );
$$;

-- =============================================================
-- Friends-scoped leaderboard views
-- Only the current user + their friends appear. Anon (auth.uid() IS NULL)
-- gets an empty result.
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
  rank() over (
    partition by true
    order by coalesce(r.read_count, 0) desc, p.created_at asc
  )                                                                as rank,
  (select total from totals)                                       as total_books
from public.profiles p
left join reads r on r.user_id = p.id
where p.on_leaderboard
  and (p.id = auth.uid() or public.is_friend_of_current(p.id));

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
  and (p.id = auth.uid() or public.is_friend_of_current(p.id))
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
where p.on_leaderboard
  and (p.id = auth.uid() or public.is_friend_of_current(p.id));

grant select on public.leaderboard_overall  to anon, authenticated;
grant select on public.leaderboard_by_award to anon, authenticated;
