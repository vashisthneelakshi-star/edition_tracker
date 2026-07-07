-- ============================================================
-- MIGRATION: Multi-Branch access for Edition Incharge
-- An Edition Incharge can now be granted access to MORE THAN ONE
-- Branch (even across different States) using a new scopes table.
-- Run in SQL Editor -> New Query.
-- ============================================================

create table if not exists incharge_scopes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  state_id uuid not null references states(id) on delete cascade,
  branch text not null,
  created_at timestamptz default now(),
  unique(profile_id, state_id, branch)
);

alter table incharge_scopes enable row level security;

create policy "scopes_admin_all" on incharge_scopes for all using (my_role() = 'admin');
create policy "scopes_self_read" on incharge_scopes for select using (profile_id = auth.uid());

-- Backfill: copy each incharge's existing single Branch into the new scopes table
insert into incharge_scopes (profile_id, state_id, branch)
select id, state_id, branch from profiles
where role = 'edition_incharge' and state_id is not null and branch is not null
on conflict do nothing;

-- Replace old single-branch RLS policies with multi-scope versions
drop policy if exists "editions_incharge_read" on editions;
create policy "editions_incharge_read" on editions for select using (
  my_role() = 'edition_incharge'
  and exists (
    select 1 from incharge_scopes s
    where s.profile_id = auth.uid() and s.state_id = editions.state_id and s.branch = editions.branch
  )
);

drop policy if exists "entries_incharge_read" on entries;
create policy "entries_incharge_read" on entries for select using (
  my_role() = 'edition_incharge'
  and edition_id in (
    select e.id from editions e
    join incharge_scopes s on s.state_id = e.state_id and s.branch = e.branch
    where s.profile_id = auth.uid()
  )
);

drop policy if exists "entries_incharge_insert" on entries;
create policy "entries_incharge_insert" on entries for insert with check (
  my_role() = 'edition_incharge'
  and edition_id in (
    select e.id from editions e
    join incharge_scopes s on s.state_id = e.state_id and s.branch = e.branch
    where s.profile_id = auth.uid()
  )
);

-- Note: profiles.state_id / profiles.branch are kept (harmless, unused for RLS
-- from now on) purely for backward compatibility. All access control for
-- Edition Incharge now flows through incharge_scopes.
