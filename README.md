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

## STEP 1B: Agar Aapne Pehle Se schema.sql Chala Diya Hai

Agar aapne already Supabase par pehla schema chala liya hai (tables ban chuki hai),
to sirf yeh chhoti migration chalayein — SQL Editor → **New Query**:

`supabase/migration_add_branch_pullout.sql` file ka pura content copy-paste karke Run karein.

Yeh Editions table me **Branch** aur **Pullout** columns add kar dega (ek Edition ke
alag-alag Pullouts ka alag Schedule Time ho sakta hai, jaise "MAIN" aur "BUNDI PULLOUT").

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

## App Kaise Use Hoga (Roles)

| Role | Kya dikhega |
|---|---|
| **Admin** | Sab kuch — states/editions/users add karna, sab dashboards, reports, telegram setup |
| **State Head** | Apne state ke saare editions ka dashboard + reports (read-only) |
| **Edition Incharge** | Sirf apna Daily Entry Form — edition naam aur schedule time locked, sirf release time + last page + reason bharna hai |

### Naya Edition Incharge Add Karne Ka Flow (Admin ke liye)
1. Admin → Editions page: pehle edition banayein (naam, state, **fixed schedule time**)
2. Admin → Users page: naya user banayein, role = "Edition Incharge", us edition ko select karein
3. Us incharge ko email + temporary password de dein — wo login karke seedha apna
   locked entry form dekhega, kuch aur nahi

### 40+ Editions Ek Saath Add Karna (Bulk CSV Import)
Admin → Editions page ke top par "Bulk Editions Import" section hai:
1. "Sample CSV download karein" dabakar format dekh lijiye
2. CSV me 3 columns honi chahiye: `name,state,schedule_page_time`
   (schedule_page_time 24-hour format me, e.g. `22:30`)
3. File upload karte hi preview dikhega, phir "Confirm Karke Import Karein" dabayein
4. Agar state pehle se nahi hai to system khud bana dega
5. Duplicate editions (same name + same state) automatically skip ho jayengi

Isi page ke neeche di gayi table me har edition ka naam, state, aur schedule time
seedha edit kiya ja sakta hai (bas field par click karke type kariye aur bahar click
kar dein - save khud ho jayega). Naya edition future me bhi yahi single-add form se
kabhi bhi jode ja sakta hai.

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
