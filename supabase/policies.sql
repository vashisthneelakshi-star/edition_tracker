-- Run in Supabase SQL Editor after migrations. Enables RLS so the browser
-- (using the anon key + a logged-in user's session) can only do what their
-- role allows — enforced at the database, not just hidden in the UI.

alter table profiles enable row level security;
alter table content_plans enable row level security;
alter table ui_labels enable row level security;

-- Everyone logged in can see their own profile (needed to know their own role)
create policy "read own profile" on profiles
  for select using (auth.uid() = id);

-- Everyone logged in can read content plans
create policy "read content plans" on content_plans
  for select using (auth.role() = 'authenticated');

-- Admin, State Head, Editor can create/update plans; Viewer cannot
create policy "write content plans" on content_plans
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN','STATE_HEAD','EDITOR'))
  );

create policy "update content plans" on content_plans
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role in ('ADMIN','STATE_HEAD','EDITOR'))
  );

-- Only Admin can delete plans
create policy "delete content plans" on content_plans
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );

-- Everyone logged in can read UI labels (menu names, statuses, etc.)
create policy "read ui labels" on ui_labels
  for select using (auth.role() = 'authenticated');

-- Only Admin can change UI labels
create policy "write ui labels" on ui_labels
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );

create policy "update ui labels" on ui_labels
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
  );
