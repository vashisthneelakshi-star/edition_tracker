# Edition Tracker v2 — Setup & Deployment Guide

Yeh guide aapko step-by-step le jayegi: Supabase database banane se lekar
Vercel par live karne tak. Har step ke baad app test kar sakte hain.

---

## STEP 1: Supabase Project Banayein (Database)

1. https://supabase.com par jaake free account banayein
2. "New Project" click karein — naam do (e.g. `edition-tracker`), password set karein (yaad rakhein)
3. Project ban jaane ke baad, left sidebar me **SQL Editor** kholiye
4. `supabase/schema.sql` file ka pura content copy karke SQL Editor me paste karein aur **Run** dabayein
   - Yeh saari tables (states, editions, profiles, entries, telegram_links) aur security rules bana dega
5. Left sidebar me **Project Settings → API** jaayein — yahan se 2 cheezein copy karni hain:
   - `Project URL` → yeh `NEXT_PUBLIC_SUPABASE_URL` hai
   - `anon public` key → yeh `NEXT_PUBLIC_SUPABASE_ANON_KEY` hai
   - `service_role` key → yeh `SUPABASE_SERVICE_ROLE_KEY` hai (**gupt rakhein, kabhi frontend me mat daalein**)

---

## STEP 1B: Apply These Migrations (Run in Order, in SQL Editor → New Query)

If you already ran the original `schema.sql`, run these two migration files
in order (copy-paste each file's full content and hit Run):

1. `supabase/migration_add_branch_pullout.sql` — adds Branch/Pullout to Editions
2. `supabase/migration_branch_based_incharge.sql` — changes Edition Incharge
   scope from a single Edition to a whole Branch (all editions/pullouts under
   that Branch will appear in the incharge's daily entry form)
3. `supabase/migration_telegram_state_scope.sql` — lets a Telegram recipient be
   linked to either one Edition or an entire State (for State Heads)

---

## STEP 2: Apna Admin Account Banayein

1. Supabase Dashboard → **Authentication → Users → Add User**
2. Apna email/password daalein, "Auto Confirm User" ON rakhein
3. Us user ki **UUID copy karein** (list me dikhegi)
4. Wapas **SQL Editor** me jaake yeh chalayein (UUID apni daalein):
   ```sql
   insert into profiles (id, full_name, role)
   values ('PASTE-YOUR-UUID-HERE', 'Aapka Naam', 'admin');
   ```
5. Ab aap admin ban gaye — is email/password se app me login hoga

---

## STEP 3: Telegram Bot (Aapne already bana liya hai)

Agar bana liya hai to Token save rakhein. Nahi banaya to:
1. Telegram me **@BotFather** ko message karein
2. `/newbot` bhejein, naam aur username set karein
3. Jo Token mile use `TELEGRAM_BOT_TOKEN` ke roop me save karein

### Kisi bhi recipient ka Chat ID kaise pata karein:
1. Us person ko apna bot open karke **/start** bhejne ko bolein
2. Fir browser me yeh URL kholein (apna token daal ke):
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Response me `"chat":{"id": 123456789...}` dikhega — yahi Chat ID hai
4. Yeh Chat ID app ke Admin → Telegram page me daal dein

---

## STEP 4: Environment Variables Set Karein

`.env.example` ko copy karke `.env.local` banayein aur values bharein:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_BOT_TOKEN=...
CRON_SECRET=koi_bhi_random_secret_string
```

---

## STEP 5: Local Test (Optional lekin recommended)

```bash
npm install
npm run dev
```

Browser me `http://localhost:3000` kholein, login karein apne admin account se.

---

## STEP 6: Vercel Par Deploy Karein

1. Is poore folder ko GitHub par ek naye repository me push karein
2. https://vercel.com par jaake "Add New Project" → GitHub repo select karein
3. Deploy se pehle **Environment Variables** section me STEP 4 wale saare variables daal dein
4. Deploy dabayein — 2 minute me live ho jayega

Cron job (`vercel.json` me already configured) automatically Vercel par
activate ho jayega — daily raat 10 PM IST par saare due reports Telegram
par bhej dega. Time change karna ho to `vercel.json` me `schedule` line edit karein
(cron format UTC time me hota hai; IST = UTC + 5:30).

---

## How The App Works (Roles)

| Role | What they see |
|---|---|
| **Admin** | Everything — add states/editions/users, all dashboards, reports, Telegram setup |
| **State Head** | Dashboard + reports for all editions in their assigned state (read-only) |
| **Edition Incharge** | Daily Entry Form only — State and Branch are locked to their account; every Edition/Pullout under that Branch appears as its own row. They just fill Release Time, Last Page No, and Reason (required if there's a delay/early release) for each one |

### Adding a New Edition Incharge (Admin steps)
1. Admin → Editions page: create the editions first (State, Branch, Edition name, Pullout, **fixed schedule time**)
2. Admin → Users page: create a new user, role = "Edition Incharge", select their **State** and **Branch**
   (the Branch dropdown is built automatically from existing editions in that state)
3. Give the incharge their email + temporary password — on login they'll see every
   Edition/Pullout under their Branch listed one below the other, ready to fill

### Deleting a User
Admin → Users page → click **Delete** next to any user row. This permanently removes
their login and profile (their past entries stay in the system for reporting).

### Setting Up Telegram Recipients (Admin → Telegram page)
Each recipient can be one of two types:
- **Specific Edition** — typically for an Edition Incharge; they only get that
  edition's report
- **Entire State** — typically for a State Head; they get a combined report for
  every edition in that state

Multiple recipients (with different frequencies) can be attached to the same
Edition or State.

### Adding 40+ Editions at Once (Bulk CSV Import)
At the top of Admin → Editions page there's a "Bulk Editions Import" section:
1. Click "Download sample CSV" to see the exact format
2. Your CSV needs 5 columns: `State, Branch, Edition, Pullout, Schedule time`
   (Schedule time can be a full date-time like `2026-06-30 23:00:00` or just `23:00` — either works)
3. Upload the file, review the preview, then click "Confirm & Import"
4. Missing states are created automatically
5. Duplicate editions (same State + Branch + Edition + Pullout) are automatically skipped

The table below that section lets you edit any edition's State, Branch, Name, Pullout,
or Schedule Time directly — just click a field, type, and click away (it saves automatically).
The single-add form above it stays available anytime for adding new editions in the future.

---

## Important Notes

- **Schedule Time sirf Admin badal sakta hai** (Admin → Editions page se). Incharge ke
  form me yeh hamesha read-only/locked dikhega.
- **Edition Incharge sirf apna hi data dekh/bhar sakta hai** — database level par
  (Row Level Security) enforce hai, sirf UI restriction nahi hai, isliye 100% secure hai.
- Ek edition ek din me sirf **ek hi entry** bhar sakta hai (duplicate date par error aayega).
- Delay/Early automatically calculate hota hai database me — Release Time minus
  Schedule Time. Positive = Late, Negative = Early.

---

## Next Phases (Abhi Included Nahi Hai)

- WhatsApp integration (abhi sirf Telegram hai)
- Bulk edition/user import (CSV se — abhi ek-ek karke add karna hai admin panel se)
- Editable/deletable historical entries by admin
- Push notifications / SMS alerts for very high delays

Agar in me se koi chahiye, bata dijiye — agle phase me jod denge.
