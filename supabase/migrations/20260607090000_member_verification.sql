-- Member verification + automatic cleanup of unredeemed invites.
--
-- An invited member (created via the redeem-invitation function) starts
-- UNVERIFIED. They become verified the moment they complete their first SMS
-- login. Members an admin adds by hand are trusted, so they are verified from
-- the start (set explicitly by the admin-create-member function).
--
-- A pg_cron job deletes members who never verified within 15 minutes — along
-- with their auth.users row — so a mistyped phone or an abandoned invite does
-- not leave junk behind (or squat on a phone number).

-- ── 1. verified column ────────────────────────────────────────────
-- Existing members predate this feature and are trusted, so the ADD default
-- backfills them to true; the default then flips to false for new rows.
alter table public.members add column verified boolean not null default true;
alter table public.members alter column verified set default false;

-- ── 2. Fix the new-auth-user trigger ──────────────────────────────
-- The old version always inserted phone='' which (a) collides with the unique
-- phone constraint after the first phone user and (b) left a placeholder row.
-- Store the auth user's real phone and skip on conflict so the follow-up upsert
-- in the edge functions just fills in the details.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (name, email, phone, verified)
  values (
    coalesce(new.raw_user_meta_data->>'name', nullif(split_part(coalesce(new.email,''),'@',1),''), ''),
    new.email,
    coalesce(new.phone, ''),
    false
  )
  on conflict (phone) do nothing;
  return new;
end;
$$;

-- ── 3. Verify on first real sign-in ───────────────────────────────
-- auth.users.last_sign_in_at changes only on an actual login (not token
-- refresh), so this fires exactly when a member first proves they own the
-- phone/email.
create or replace function public.handle_auth_user_signin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is distinct from old.last_sign_in_at then
    update public.members m
    set verified = true
    where not m.verified
      and (
        (coalesce(new.phone,'') <> '' and regexp_replace(m.phone,'\D','','g') = regexp_replace(new.phone,'\D','','g'))
        or (coalesce(new.email,'') <> '' and lower(m.email) = lower(new.email))
      );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_signin on auth.users;
create trigger on_auth_user_signin
  after update on auth.users
  for each row execute function public.handle_auth_user_signin();

-- ── 4. Cleanup function ───────────────────────────────────────────
-- Drop unverified members older than 15 minutes and their auth user. Runs as
-- definer (postgres) so it can reach the auth schema and bypass RLS.
create or replace function public.cleanup_unverified_members()
returns void language plpgsql security definer set search_path = public as $$
declare
  stale record;
begin
  for stale in
    select id, phone, email
    from public.members
    where not verified
      and created_at < now() - interval '15 minutes'
  loop
    delete from auth.users u
    where (nullif(regexp_replace(coalesce(stale.phone,''),'\D','','g'),'') is not null
           and regexp_replace(coalesce(u.phone,''),'\D','','g') = regexp_replace(stale.phone,'\D','','g'))
       or (stale.email is not null and lower(coalesce(u.email,'')) = lower(stale.email));
    delete from public.members where id = stale.id;
  end loop;
end;
$$;

-- ── 5. Schedule cleanup every 5 minutes via pg_cron ───────────────
create extension if not exists pg_cron;

-- Re-running this migration should re-point the job, not error on a duplicate.
do $$
begin
  perform cron.unschedule('cleanup-unverified-members');
exception when others then
  null; -- job did not exist yet
end $$;

select cron.schedule(
  'cleanup-unverified-members',
  '*/5 * * * *',
  $$ select public.cleanup_unverified_members(); $$
);
