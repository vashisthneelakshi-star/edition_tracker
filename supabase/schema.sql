-- ============================================================
-- EDITION TRACKER v2 - Supabase Schema
-- Run this in Supabase Dashboard -> SQL Editor -> New Query
-- ============================================================

-- 1. STATES
create table if not exists states (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- 2. EDITIONS (schedule time lives here - this is the "locked" value)
create table if not exists editions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  state_id uuid not null references states(id) on delete cascade,
  branch text,
  pullout text default 'MAIN',
  schedule_page_time time not null,      -- LOCKED schedule time (admin sets this)
  active boolean default true,
  created_at timestamptz default now(),
  unique(name, state_id, branch, pullout)
);

-- 3. PROFILES (extends Supabase auth.users with role + scope)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('admin','state_head','edition_incharge')),
  state_id uuid references states(id),          -- used when role = state_head; legacy for edition_incharge
  branch text,                                    -- legacy single-branch field, unused for RLS now
  edition_id uuid references editions(id),       -- legacy, unused
  created_at timestamptz default now()
);

-- 3b. INCHARGE SCOPES (an Edition Incharge can be granted access to multiple
--     Branches, even across different States, via rows in this table)
create table if not exists incharge_scopes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  state_id uuid not null references states(id) on delete cascade,
  branch text not null,
  created_at timestamptz default now(),
  unique(profile_id, state_id, branch)
);

-- 4. DAILY ENTRIES
create table if not exists entries (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references editions(id) on delete cascade,
  entry_date date not null default current_date,
  schedule_page_time time not null,       -- snapshot of edition's locked schedule time at entry time
  release_page_time time not null,        -- filled by incharge
  delay_minutes integer generated always as (
    (extract(epoch from (release_page_time - schedule_page_time)) / 60)::integer
  ) stored,                                -- positive = late, negative = early
  last_page_no text,
  delay_reason text check (char_length(delay_reason) <= 700), -- ~100 words safety cap
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique(edition_id, entry_date)
);

-- 5. TELEGRAM RECIPIENTS (multiple people per edition, or state-wide recipients like State Heads)
create table if not exists telegram_links (
  id uuid primary key default gen_random_uuid(),
  scope_type text not null check (scope_type in ('state','edition')) default 'edition',
  state_id uuid references states(id),            -- used when scope_type = 'state' (e.g. State Head gets whole-state report)
  edition_id uuid references editions(id) on delete cascade,  -- used when scope_type = 'edition'
  chat_id text not null,
  label text,                              -- e.g. "State Head - Rajasthan" or "Incharge - Bikaner"
  frequency text not null check (frequency in ('daily','weekly','monthly','half_yearly','yearly')),
  active boolean default true,
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table states enable row level security;
alter table editions enable row level security;
alter table profiles enable row level security;
alter table incharge_scopes enable row level security;
alter table entries enable row level security;
alter table telegram_links enable row level security;

-- Helper: get current user's role/scope quickly
create or replace function my_role() returns text as $$
  select role from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function my_state() returns uuid as $$
  select state_id from profiles where id = auth.uid();
$$ language sql security definer stable;

create or replace function my_branch() returns text as $$
  select branch from profiles where id = auth.uid();
$$ language sql security definer stable;

-- PROFILES: everyone can read their own row; admin can read/write all
create policy "profiles_self_select" on profiles for select using (id = auth.uid() or my_role() = 'admin');
create policy "profiles_admin_all" on profiles for all using (my_role() = 'admin');

-- STATES: admin full access; everyone else read-only
create policy "states_read_all" on states for select using (true);
create policy "states_admin_write" on states for insert with check (my_role() = 'admin');
create policy "states_admin_update" on states for update using (my_role() = 'admin');
create policy "states_admin_delete" on states for delete using (my_role() = 'admin');

-- EDITIONS: admin full access; state_head can read editions in their state;
-- incharge can read editions in ANY of their assigned scopes (state + branch)
create policy "editions_admin_all" on editions for all using (my_role() = 'admin');
create policy "editions_state_head_read" on editions for select using (
  my_role() = 'state_head' and state_id = my_state()
);
create policy "editions_incharge_read" on editions for select using (
  my_role() = 'edition_incharge'
  and exists (
    select 1 from incharge_scopes s
    where s.profile_id = auth.uid() and s.state_id = editions.state_id and s.branch = editions.branch
  )
);

-- INCHARGE_SCOPES: admin manages; incharge can read their own assigned scopes
create policy "scopes_admin_all" on incharge_scopes for all using (my_role() = 'admin');
create policy "scopes_self_read" on incharge_scopes for select using (profile_id = auth.uid());

-- ENTRIES: admin full; state_head reads entries of editions in their state;
-- incharge can insert/read entries for any edition in any of their assigned scopes
create policy "entries_admin_all" on entries for all using (my_role() = 'admin');
create policy "entries_state_head_read" on entries for select using (
  my_role() = 'state_head'
  and edition_id in (select id from editions where state_id = my_state())
);
create policy "entries_incharge_read" on entries for select using (
  my_role() = 'edition_incharge'
  and edition_id in (
    select e.id from editions e
    join incharge_scopes s on s.state_id = e.state_id and s.branch = e.branch
    where s.profile_id = auth.uid()
  )
);
create policy "entries_incharge_insert" on entries for insert with check (
  my_role() = 'edition_incharge'
  and edition_id in (
    select e.id from editions e
    join incharge_scopes s on s.state_id = e.state_id and s.branch = e.branch
    where s.profile_id = auth.uid()
  )
);
-- Note: Edition Incharge intentionally has NO update policy — once an entry is
-- submitted, only Admin (via entries_admin_all) can correct it.

-- TELEGRAM_LINKS: admin only manages; state_head can view own state's links (both state-wide and edition-scoped)
create policy "telegram_admin_all" on telegram_links for all using (my_role() = 'admin');
create policy "telegram_state_head_read" on telegram_links for select using (
  my_role() = 'state_head'
  and (
    (scope_type = 'state' and state_id = my_state())
    or (scope_type = 'edition' and edition_id in (select id from editions where state_id = my_state()))
  )
);

-- ============================================================
-- SEED: first admin user
-- ============================================================
-- 1. Go to Supabase Dashboard -> Authentication -> Users -> Add User
--    (create with email + password for yourself)
-- 2. Copy that user's UUID, then run:
--
-- insert into profiles (id, full_name, role)
-- values ('PASTE-USER-UUID-HERE', 'Vaidulya (Admin)', 'admin');
