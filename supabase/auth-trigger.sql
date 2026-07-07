-- Run this once in the Supabase SQL Editor (after prisma migrate has created
-- the "profiles" table). Auto-creates a profile row whenever someone signs up
-- via Supabase Auth, defaulting to VIEWER until an Admin promotes them.

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'VIEWER')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- To promote the first Admin (yourself), run once manually:
-- update profiles set role = 'ADMIN' where id = 'YOUR-AUTH-USER-UUID';
-- (find your UUID in Supabase Dashboard → Authentication → Users)
