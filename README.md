# The Desk — Content Command

Content Planning module — 800+ users ke scale ke liye ready: sab
filter/search/sort/pagination ab **server-side** hai (sirf currently-visible
page browser mein load hoti hai, poora data kabhi nahi). Plus: bulk CSV se
staff/users add karne ka Admin tool.

## Step 1 — Supabase project

1. https://supabase.com → naya project (region: ap-south-1 agar available ho)
2. Project Settings → API se copy karo: `Project URL`, `anon public` key,
   aur **`service_role` key** (bulk import ke liye chahiye — kisi ke saath
   share mat karna, ye poori DB ka full access deti hai)
3. Project Settings → Database → Connection string se pooling (6543) aur
   direct (5432) strings copy karo

## Step 2 — Local setup

```bash
cp .env.example .env.local
# 5 values bharo: Supabase URL/anon key/service role key, DATABASE_URL,
# DIRECT_URL, aur OPENAI_API_KEY

npm install
npx prisma migrate dev --name init
```

Supabase SQL Editor mein ye files ek-ek karke paste-run karo:
1. `supabase/auth-trigger.sql`
2. `supabase/policies.sql`
3. `supabase/labels-seed.sql`
4. `supabase/seed.sql`

## Step 3 — Pehla Admin banao

1. Supabase Dashboard → Authentication → Users → "Add user"
2. UUID copy karo, SQL Editor mein: `update profiles set role = 'ADMIN' where id = 'UUID';`
3. `npm run dev`, `/login` pe sign in karo

## Step 4 — Baaki 799 logon ko ek saath add karo (Bulk Import)

1. Ek CSV banao is format mein:
   ```
   email,full_name,role
   ramesh@patrika.com,Ramesh Kumar,EDITOR
   sunita@patrika.com,Sunita Sharma,STATE_HEAD
   ```
   (`role` blank/galat ho to automatically VIEWER ban jayega)
2. Admin login karke sidebar → **Admin → Bulk User Import** pe jao
3. CSV upload karo, preview dekho, "Import" pe click karo
4. Ye 40-40 ke batches mein process hoga (progress dikhega) — 800 logon mein
   ~2-3 min lagenge
5. Import complete hone pe **"Download results"** — isme har user ka
   temporary password hoga. Ise WhatsApp/internal channel se distribute kar
   dena (bulk email invite abhi nahi bheja — uske liye Supabase mein custom
   SMTP configure karna padega, warna default email bahut rate-limited hai)
6. Log in karne ke baad users apna password khud badal sakte hain (Supabase
   Auth ka built-in "update password" flow — chaho to iske liye ek settings
   page bhi bana dunga)

## Step 5 — Vercel deploy

GitHub repo → Vercel import → wahi 5 env vars daalo (service role key bhi,
sirf Vercel ke encrypted env vars mein, kahin aur nahi) → deploy.

## Scale ke liye kya badla

- `/api/content-plans` GET ab search/filter/sort/pagination sab database
  mein karta hai (`.range()`, `.ilike()`, `.in()`, indexes on due_at/level/
  owner/status) — browser sirf current page (10-50 rows) load karta hai
- Export "selected" ya "all matching filters" — dono cases mein sirf wahi
  rows fetch hoti hain jo chahiye, poori table nahi
- `/api/admin/bulk-users` — 40 rows/batch, Admin-only, service role se
  Supabase Auth mein user banata hai + profile row + role assign karta hai

## Baaki features (jo pehle bane the) same hain

Search, multi-select filters, date range, sortable columns, drill-down
detail page, editable status badges, AI Analysis (OpenAI), CSV/Excel/PDF
export, mobile card view, role-based permissions, Admin label editor.

## Baaki 15 sections ka roadmap

Schema ready hai. Priority: Campaigns+Calendar → Duty/Beat → Team modules
(Messages/Blunders/Star) → file-upload wale (Documents/Archive/Ideas/Case
Studies) → simple CRUD (Awards/Resources/Contacts/Accounts). "Next batch"
bologe to shuru kar dunga — ab sab isi server-side pattern mein banenge,
scale se pehle hi ready honge.
