-- Readmore — migration 009: self-serve account deletion RPC
--
-- The Settings page now has a Delete Account button. Clients hold the
-- anon/authenticated JWT, which can't reach auth.users (that table is
-- only writable via service_role). Bridge that with a SECURITY DEFINER
-- function that uses auth.uid() to delete the calling user's auth row.
--
-- ON DELETE CASCADE on:
--   public.profiles.id  -> auth.users(id)
--   public.user_books.user_id -> public.profiles(id)
--   public.friendships.user_id_a/b -> public.profiles(id)
--
-- ...takes care of every owned row. Nothing else to clean up.
--
-- Apply via Supabase SQL Editor. Idempotent.

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  -- Cascade does the rest: profile, user_books, friendships all go.
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;
