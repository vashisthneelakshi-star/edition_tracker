-- ============================================================
-- MIGRATION: Telegram Recipients - State-wide vs Edition-specific
-- Run in SQL Editor -> New Query.
-- ============================================================

alter table telegram_links add column if not exists scope_type text check (scope_type in ('state','edition')) default 'edition';
alter table telegram_links add column if not exists state_id uuid references states(id);
alter table telegram_links alter column edition_id drop not null;

-- Backfill: existing rows were all edition-scoped
update telegram_links set scope_type = 'edition' where scope_type is null;

-- Update RLS to also allow state_head visibility of state-scoped links in their state
drop policy if exists "telegram_state_head_read" on telegram_links;
create policy "telegram_state_head_read" on telegram_links for select using (
  my_role() = 'state_head'
  and (
    (scope_type = 'state' and state_id = my_state())
    or (scope_type = 'edition' and edition_id in (select id from editions where state_id = my_state()))
  )
);
