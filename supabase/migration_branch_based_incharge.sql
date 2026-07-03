-- ============================================================
-- MIGRATION: Edition Incharge now scoped to (State + Branch)
-- instead of a single Edition. Run in SQL Editor -> New Query.
-- ============================================================

alter table profiles add column if not exists branch text;

-- Helper function: current user's branch
create or replace function my_branch() returns text as $$
  select branch from profiles where id = auth.uid();
$$ language sql security definer stable;

-- Drop old edition-based policies for entries (incharge)
drop policy if exists "entries_incharge_read" on entries;
drop policy if exists "entries_incharge_insert" on entries;
drop policy if exists "entries_incharge_update" on entries;

-- New branch-based policies: incharge can read/insert/update entries
-- for ANY edition that belongs to their assigned state + branch
create policy "entries_incharge_read" on entries for select using (
  my_role() = 'edition_incharge'
  and edition_id in (
    select id from editions where state_id = my_state() and branch = my_branch()
  )
);
create policy "entries_incharge_insert" on entries for insert with check (
  my_role() = 'edition_incharge'
  and edition_id in (
    select id from editions where state_id = my_state() and branch = my_branch()
  )
);
create policy "entries_incharge_update" on entries for update using (
  my_role() = 'edition_incharge'
  and edition_id in (
    select id from editions where state_id = my_state() and branch = my_branch()
  )
);

-- Drop old edition-based read policy for editions table (incharge)
drop policy if exists "editions_incharge_read" on editions;

create policy "editions_incharge_read" on editions for select using (
  my_role() = 'edition_incharge'
  and state_id = my_state()
  and branch = my_branch()
);

-- Note: profiles.edition_id column is no longer used for edition_incharge role,
-- it's left in place (harmless) in case you want it for reference later.
