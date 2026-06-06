-- Switch member lookup to phone-or-email, normalize phone format.
--
-- Supabase stores phone numbers as digits-only with country code
-- (e.g. "4793412087"). We match the same way: strip non-digits from
-- members.phone and compare to the JWT's phone claim.
--
-- Existing rows are normalized below — bare 8-digit NO numbers gain the
-- "47" prefix; anything already including the country code is just
-- stripped of formatting.

update public.members
set phone =
  case
    when regexp_replace(phone, '\D', '', 'g') ~ '^47\d{8}$'
      then regexp_replace(phone, '\D', '', 'g')
    when regexp_replace(phone, '\D', '', 'g') ~ '^\d{8}$'
      then '47' || regexp_replace(phone, '\D', '', 'g')
    else regexp_replace(phone, '\D', '', 'g')
  end
where phone is not null;

-- Member of the currently logged-in auth user. Matches by phone if the
-- JWT has one (phone OTP login), otherwise by email (magic-link login).
create or replace function public.current_member_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select m.id
  from public.members m
  where
    (
      coalesce(auth.jwt() ->> 'phone', '') <> ''
      and regexp_replace(m.phone, '\D', '', 'g') = (auth.jwt() ->> 'phone')
    )
    or (
      coalesce(auth.jwt() ->> 'email', '') <> ''
      and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select is_admin from public.members
    where
      (
        coalesce(auth.jwt() ->> 'phone', '') <> ''
        and regexp_replace(phone, '\D', '', 'g') = (auth.jwt() ->> 'phone')
      )
      or (
        coalesce(auth.jwt() ->> 'email', '') <> ''
        and lower(email) = lower(auth.jwt() ->> 'email')
      )
    limit 1
  ), false);
$$;
