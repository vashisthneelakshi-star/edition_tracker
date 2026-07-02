-- ============================================================
-- MIGRATION: Add Branch + Pullout to Editions
-- Aap pehle se schema.sql chala chuke hai, isliye is chhoti
-- migration ko SQL Editor -> New Query me chalayein.
-- ============================================================

alter table editions add column if not exists branch text;
alter table editions add column if not exists pullout text default 'MAIN';

-- Purana unique constraint (name + state) hata kar naya (name + state + branch + pullout) lagayein,
-- kyunki ab ek hi Edition ke multiple Pullouts alag-alag schedule time ke saath ho sakte hai.
alter table editions drop constraint if exists editions_name_state_id_key;
alter table editions add constraint editions_unique_combo unique (name, state_id, branch, pullout);

-- Purani editions rows (agar koi bani hui hai) me branch/pullout khali honge,
-- unhe edit karke bhar dijiye Admin -> Editions page se, ya dobara CSV import kar dijiye.
