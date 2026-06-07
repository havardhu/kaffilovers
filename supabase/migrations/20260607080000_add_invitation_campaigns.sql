-- Invitation campaigns — shareable Slack invite links.
--
-- An admin creates a campaign with an expiry date and a password, then posts
-- the link (+ password) in Slack. A prospective member opens the link, enters
-- name/phone/password, and — if the password matches and the campaign hasn't
-- expired — is added as a member (via the redeem-invitation edge function,
-- which runs with the service role).
--
-- The password is stored in plaintext on purpose: it is a low-stakes shared
-- group code that the admin must be able to re-read to post it again. Access
-- is restricted to admins by RLS; the redeem flow reads it server-side only.

create table public.invitation_campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  password    text not null,
  expires_at  date not null,
  created_at  timestamptz not null default now()
);

alter table public.invitation_campaigns enable row level security;

-- Only admins may read or write campaigns. Anonymous invitees never touch this
-- table directly — they go through the redeem-invitation edge function.
create policy invite_campaigns_admin_all on public.invitation_campaigns
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
