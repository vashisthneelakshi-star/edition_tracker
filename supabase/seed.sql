-- Run after `prisma migrate dev`. Seeds Content Plans from the HTML prototype.
-- Extend the same pattern for the other 15 tables when you're ready for them.

insert into content_plans (id, timeframe, level, title, owner, due_at, status) values
(gen_random_uuid(), 'ANNUAL', 'HEADQUARTERS', 'National election coverage master plan 2026-27', 'National Content Head', '2027-01-15 00:00', 'DRAFTING'),
(gen_random_uuid(), 'ANNUAL', 'SUPPLEMENTS', 'Annual supplement calendar — Education, Health, Auto, Realty', 'Supplements Editor', '2027-03-31 00:00', 'APPROVED'),
(gen_random_uuid(), 'ANNUAL', 'RND_TEAM', 'Reader survey & content-gap study', 'R&D Lead', '2026-11-30 00:00', 'APPROVED'),
(gen_random_uuid(), 'MONTHLY', 'STATE', 'Rajasthan monsoon & agriculture coverage plan — July', 'State Editor, Rajasthan', '2026-07-05 00:00', 'APPROVED'),
(gen_random_uuid(), 'MONTHLY', 'EDITION', 'Jaipur civic issues series — July', 'Edition Editor, Jaipur', '2026-07-03 00:00', 'IN_PROGRESS'),
(gen_random_uuid(), 'MONTHLY', 'EDITORIAL_PAGE', 'Guest column line-up — July', 'Edit Page In-charge', '2026-07-01 00:00', 'APPROVED'),
(gen_random_uuid(), 'WEEKLY', 'DISTRICT_HQ', 'Kota district weekly civic/administration follow-ups', 'Kota Bureau Chief', '2026-07-06 00:00', 'PENDING_REVIEW'),
(gen_random_uuid(), 'WEEKLY', 'STATE', 'MP weekly political desk line-up', 'State Editor, MP', '2026-07-07 00:00', 'APPROVED'),
(gen_random_uuid(), 'DAILY', 'HEADQUARTERS', 'Front page lead options — 05 Jul', 'National Content Head', '2026-07-04 20:00', 'AWAITING_OPTIONS'),
(gen_random_uuid(), 'DAILY', 'EDITION', 'Bhopal city page plan — 05 Jul', 'Edition Editor, Bhopal', '2026-07-04 18:00', 'SUBMITTED'),
(gen_random_uuid(), 'DAILY', 'RND_TEAM', 'Fact-check briefing for tomorrow''s political stories', 'R&D Lead', '2026-07-04 21:00', 'IN_PROGRESS'),
(gen_random_uuid(), 'DAILY', 'SUPPLEMENTS', 'Weekend education supplement — final layout check', 'Supplements Editor', '2026-07-04 19:00', 'APPROVED');
