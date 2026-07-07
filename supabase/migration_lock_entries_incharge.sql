-- ============================================================
-- MIGRATION: Only Admin can update entries once submitted.
-- Edition Incharge can still INSERT (first-time submit) and READ,
-- but can no longer UPDATE an entry after it's saved.
-- Run in SQL Editor -> New Query.
-- ============================================================

drop policy if exists "entries_incharge_update" on entries;

-- (entries_admin_all already grants Admin full update/insert/delete/select access)
