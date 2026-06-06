-- Kaffilauget — initial schema
-- Run via: supabase db push  (or paste in Supabase SQL editor)

-- ─────────────────────────────────────────────────────────────────
-- members  (1:1 with auth.users via email; source of truth for app)
-- ─────────────────────────────────────────────────────────────────
create table public.members (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  email       text not null unique,
  phone       text not null default '',
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create index members_email_lower_idx on public.members (lower(email));

-- ─────────────────────────────────────────────────────────────────
-- rounds  (order batches; only one may be 'åpen' at a time)
-- ─────────────────────────────────────────────────────────────────
create type round_status as enum ('åpen', 'planlagt', 'lukket');

create table public.rounds (
  id            text primary key,           -- e.g. '2026-06'
  label         text not null,              -- 'Juni-runden'
  deadline      text not null,              -- 'onsdag 10. juni' (display)
  deadline_iso  date not null,
  status        round_status not null default 'planlagt',
  vat_rate      numeric(5,2) not null default 15,
  admin_fee     numeric(8,2) not null default 10,
  created_at    timestamptz not null default now()
);

-- Enforce: at most one round in 'åpen' status
create unique index rounds_one_open_idx on public.rounds (status)
  where status = 'åpen';

-- ─────────────────────────────────────────────────────────────────
-- round_coffees  (catalog per round — each round has its own selection)
-- ─────────────────────────────────────────────────────────────────
create table public.round_coffees (
  id          uuid primary key default gen_random_uuid(),
  round_id    text not null references public.rounds(id) on delete cascade,
  coffee_key  text not null,                -- slug, stable across rounds
  name        text not null,
  notes       text not null default '',
  weight      text not null default '1000 g',
  price       numeric(10,2) not null,
  sort_order  int not null default 0,
  unique (round_id, coffee_key)
);

create index round_coffees_round_idx on public.round_coffees (round_id);

-- ─────────────────────────────────────────────────────────────────
-- orders  (one per member per round)
-- ─────────────────────────────────────────────────────────────────
create table public.orders (
  id          uuid primary key default gen_random_uuid(),
  round_id    text not null references public.rounds(id) on delete cascade,
  member_id   uuid not null references public.members(id) on delete cascade,
  locked      boolean not null default false,    -- 'Låst' = submitted
  paid        boolean not null default false,    -- admin marks
  placed_at   timestamptz,                       -- when first locked
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (round_id, member_id)
);

create index orders_round_idx on public.orders (round_id);
create index orders_member_idx on public.orders (member_id);

-- ─────────────────────────────────────────────────────────────────
-- order_items
-- ─────────────────────────────────────────────────────────────────
create table public.order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  coffee_key  text not null,                -- matches round_coffees.coffee_key
  qty         int not null check (qty > 0),
  unique (order_id, coffee_key)
);

-- ─────────────────────────────────────────────────────────────────
-- Helper functions  (used by RLS policies)
-- ─────────────────────────────────────────────────────────────────

-- The member row for the currently logged-in auth user
create or replace function public.current_member_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select m.id
  from public.members m
  where lower(m.email) = lower((auth.jwt() ->> 'email'))
  limit 1;
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((
    select is_admin from public.members
    where lower(email) = lower((auth.jwt() ->> 'email'))
    limit 1
  ), false);
$$;

-- updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────
alter table public.members      enable row level security;
alter table public.rounds       enable row level security;
alter table public.round_coffees enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;

-- MEMBERS: any authenticated member sees all members (small closed group).
-- Only admin may write.
create policy members_read on public.members
  for select to authenticated
  using (auth.role() = 'authenticated');

create policy members_admin_write on public.members
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ROUNDS: all authenticated members read; only admin writes.
create policy rounds_read on public.rounds
  for select to authenticated using (true);

create policy rounds_admin_write on public.rounds
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ROUND_COFFEES: read by any authenticated; write by admin.
create policy round_coffees_read on public.round_coffees
  for select to authenticated using (true);

create policy round_coffees_admin_write on public.round_coffees
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ORDERS: member sees own; admin sees all. Member may insert/update own
-- only on rounds that are 'åpen'. Admin may do anything (e.g. mark paid).
create policy orders_select_own on public.orders
  for select to authenticated
  using (member_id = public.current_member_id() or public.is_admin());

create policy orders_insert_own on public.orders
  for insert to authenticated
  with check (
    member_id = public.current_member_id()
    and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'åpen')
  );

create policy orders_update_own on public.orders
  for update to authenticated
  using (member_id = public.current_member_id() or public.is_admin())
  with check (
    public.is_admin() or (
      member_id = public.current_member_id()
      and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'åpen')
    )
  );

create policy orders_delete_own on public.orders
  for delete to authenticated
  using (
    public.is_admin() or (
      member_id = public.current_member_id()
      and exists (select 1 from public.rounds r where r.id = round_id and r.status = 'åpen')
    )
  );

-- ORDER_ITEMS: gated through orders.
create policy order_items_select on public.order_items
  for select to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.member_id = public.current_member_id() or public.is_admin())
  ));

create policy order_items_write on public.order_items
  for all to authenticated
  using (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (o.member_id = public.current_member_id() or public.is_admin())
  ))
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        public.is_admin() or (
          o.member_id = public.current_member_id()
          and exists (select 1 from public.rounds r where r.id = o.round_id and r.status = 'åpen')
        )
      )
  ));

-- ─────────────────────────────────────────────────────────────────
-- Auto-create a placeholder members row when an auth user is created
-- so admins can invite via Supabase Auth UI without a separate step.
-- (Admin can later edit name/phone/is_admin.)
-- ─────────────────────────────────────────────────────────────────
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.members (email, name, phone)
  values (new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), '')
  on conflict (email) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
