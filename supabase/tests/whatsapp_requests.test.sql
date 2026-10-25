-- Requests posted over WhatsApp (20261026000100). Run via scripts/test-rls.sh.
-- One transaction, rolled back at the end. Own users:
--   typer  email account that typed 9000000301 on its profile (never verified)
--   wanew  phone-only account the bot creates for 919000000301 (number confirmed)
--   ver    email account that verified 9000000302 on WhatsApp

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

INSERT INTO tests.users (name, id) VALUES
  ('typer', 'eeeeeeee-0000-4000-8000-000000000001'),
  ('wanew', 'eeeeeeee-0000-4000-8000-000000000002'),
  ('ver',   'eeeeeeee-0000-4000-8000-000000000003');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'typer@example.com', now(), '{}'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'ver@example.com', now(), '{}');
UPDATE public.profiles SET phone = '9000000301', whatsapp_alerts = true WHERE id = tests.uid('typer');

-- ---------------------------------------------------------------------------
-- 1. Drafts live in whatsapp_sessions (service role only)
-- ---------------------------------------------------------------------------
SELECT tests.login('service');
SELECT tests.allowed($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'request', 'units', '{"bloodGroup":"O+"}', now() + interval '30 minutes')$q$, 1,
  'session: a request draft can be stored');
SELECT tests.throws($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'request', 'shoe_size', '{}', now())$q$, '23514',
  'session: an unknown step is refused');
SELECT tests.throws($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'request', 'units', NULL, now())$q$, '23514',
  'session: a request session needs a draft object');
SELECT tests.throws($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'request', 'units', '[1,2]', now())$q$, '23514',
  'session: the draft must be an object');
SELECT tests.throws(format($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'request', 'hospital', %L, now())$q$, jsonb_build_object('hospital', repeat('x', 5000))), '23514',
  'session: an oversized draft is refused');
SELECT tests.throws($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000399', 'pin', 'units', '{}', now())$q$, '23514',
  'session: a PIN session carries no draft');
SELECT tests.allowed($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, expires_at, units)
  VALUES ('919000000399', 'pin', now() + interval '1 day', 1)$q$, 1,
  'session: PIN sessions work as before');

INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000398', 'request', 'confirm', '{"bloodGroup":"B-"}', now() + interval '30 minutes');
-- Switching a number from a draft to a PIN wait clears the draft (the bot does this).
SELECT tests.allowed($q$UPDATE public.whatsapp_sessions SET awaiting = 'pin', step = NULL, draft = NULL WHERE wa_number = '919000000398'$q$, 1,
  'session: a draft can be replaced by a PIN wait');
SELECT tests.throws($q$UPDATE public.whatsapp_sessions SET awaiting = 'pin' WHERE wa_number = '919000000398'$q$, '23514',
  'session: a PIN wait cannot keep a stale draft');

SELECT tests.login('requester');
SELECT tests.denied($q$SELECT * FROM public.whatsapp_sessions$q$, 'session: signed-in users cannot read drafts');
SELECT tests.denied($q$INSERT INTO public.whatsapp_sessions (wa_number, awaiting, step, draft, expires_at)
  VALUES ('919000000397', 'request', 'units', '{}', now())$q$, 'session: signed-in users cannot write drafts');
SELECT tests.login('anon');
SELECT tests.denied($q$SELECT * FROM public.whatsapp_sessions$q$, 'session: visitors cannot read drafts');

-- ---------------------------------------------------------------------------
-- 2. wa_account_for(): only an account that proved the number
-- ---------------------------------------------------------------------------
SELECT tests.login('service');
SELECT tests.is(public.wa_account_for('919000000301'), NULL::uuid,
  'account: a profile that only typed the number is not the sender''s account');
SELECT tests.is(public.wa_account_for('not a number'), NULL::uuid, 'account: junk input finds nobody');
SELECT tests.is(public.wa_account_for(NULL), NULL::uuid, 'account: NULL finds nobody');

-- An unfinished phone sign-in holds the number unconfirmed: it is released
-- (only that one), so the proven sender's account can be created.
INSERT INTO auth.users (id, phone, raw_user_meta_data, raw_app_meta_data) VALUES
  ('eeeeeeee-0000-4000-8000-0000000000f1', '919000000301', '{"consent_agreed":true,"consent_version":"2026-10-06"}', '{"provider":"phone"}'),
  ('eeeeeeee-0000-4000-8000-0000000000f2', '919000000309', '{"consent_agreed":true,"consent_version":"2026-10-06"}', '{"provider":"phone"}');
SELECT tests.is(public.wa_account_for('919000000301'), NULL::uuid, 'account: an unconfirmed sign-in phone is not proof');
SELECT tests.is(public.wa_release_unconfirmed_phone('+91 90000 00301'), 1, 'release: the unconfirmed holder gives the number up');
SELECT tests.is(tests.val($q$SELECT coalesce(phone, 'null') FROM auth.users WHERE id = 'eeeeeeee-0000-4000-8000-0000000000f2'$q$), '919000000309',
  'release: other numbers are untouched');
SELECT tests.is(public.wa_release_unconfirmed_phone('junk'), 0, 'release: junk input changes nothing');

-- What admin.createUser({ phone, phone_confirm: true, user_metadata }) does.
INSERT INTO auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data) VALUES
  ('eeeeeeee-0000-4000-8000-000000000002', NULL, '919000000301', now(),
   jsonb_build_object('full_name', 'Riya WhatsApp', 'consent_agreed', true, 'consent_at', now(), 'consent_version', '2026-10-06'),
   '{"provider":"phone"}');

SELECT tests.login('postgres');
SELECT tests.is(tests.val(format($q$SELECT full_name || '|' || is_donor || '|' || public.consent_is_recorded(consent_agreed, consent_at, consent_version)
  || '|' || phone || '|' || (phone_verified_at IS NOT NULL) || '|' || coalesce(email, 'null') FROM public.profiles WHERE id = %L$q$, tests.uid('wanew'))),
  'Riya WhatsApp|false|true|9000000301|true|null',
  'new account: a requester (never a donor) with consent and the number verified, no email');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') || '|' || whatsapp_alerts FROM public.profiles WHERE id = %L$q$, tests.uid('typer'))),
  'null|false', 'new account: the unverified holder gives the number up');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.profiles WHERE phone_verified_at IS NOT NULL AND public.wa_number(phone) = '919000000301'$q$), 1::bigint,
  'new account: exactly one verified holder of the number');

SELECT tests.login('service');
SELECT tests.is(public.wa_account_for('+91 90000 00301'), tests.uid('wanew'), 'account: the new account is found next time (any format)');
SELECT tests.is(public.wa_account_for('9000000301'), tests.uid('wanew'), 'account: found from the 10 digits too');
SELECT tests.is(public.wa_release_unconfirmed_phone('919000000301'), 0, 'release: a confirmed sign-in phone is never released');

-- A number verified in Settings (VERIFY on WhatsApp).
SELECT tests.login('postgres');
UPDATE public.profiles SET phone = '9000000302' WHERE id = tests.uid('ver');
SELECT tests.login('service');
SELECT tests.is(public.confirm_phone_for(tests.uid('ver'), '919000000302'), 'verified', 'account: ver verifies the number in Settings');
SELECT tests.is(public.wa_account_for('919000000302'), tests.uid('ver'), 'account: a number verified in Settings is that account');

-- A verified profile whose auth account lost the sign-in phone still counts.
SELECT tests.login('postgres');
UPDATE auth.users SET phone = NULL, phone_confirmed_at = NULL WHERE id = tests.uid('ver');
SELECT tests.login('service');
SELECT tests.is(public.wa_account_for('919000000302'), tests.uid('ver'), 'account: a verified profile is found without an auth phone');

SELECT tests.login('requester');
SELECT tests.throws($q$SELECT public.wa_account_for('919000000301')$q$, '42501', 'account: signed-in users cannot look numbers up');
SELECT tests.login('anon');
SELECT tests.throws($q$SELECT public.wa_account_for('919000000301')$q$, '42501', 'account: visitors cannot look numbers up');

-- ---------------------------------------------------------------------------
-- 3. Posting as the server for that account
-- ---------------------------------------------------------------------------
SELECT tests.login('service');
INSERT INTO public.blood_requests
  (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, zipcode, date_needed)
VALUES ('eeeeeeee-1111-4000-8000-000000000001', tests.uid('wanew'), 'O+', 2, 'Govt Medical College', 'Govt Medical College, Kozhikode', 'High', 'Riya',
  '{"latitude": 11.2711, "longitude": 75.8360, "source": "search", "address": "Govt Medical College, Kozhikode"}', 'active', 'Kozhikode', '673008',
  (now() AT TIME ZONE 'Asia/Kolkata')::date);
INSERT INTO public.request_contacts (request_id, contact_phone, whatsapp_updates)
VALUES ('eeeeeeee-1111-4000-8000-000000000001', '9000000301', true);
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'eeeeeeee-1111-4000-8000-000000000001' AND status = 'active'$q$), 1::bigint,
  'post: the server can post a request for the WhatsApp account');
SELECT tests.is((SELECT r::text FROM public.requests_for_contact_wa('919000000301') r LIMIT 1), 'eeeeeeee-1111-4000-8000-000000000001',
  'post: offer notices go to the sender (whatsapp_updates on the contact)');

SELECT tests.throws(format($q$INSERT INTO public.blood_requests
  (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, date_needed)
  VALUES (%L, 'O+', 1, 'Abroad', 'Abroad', 'High', 'Riya', '{"latitude": 51.5, "longitude": -0.12}', 'active', 'London', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, tests.uid('wanew')),
  '23514', 'post: a place outside India is refused');
SELECT tests.throws(format($q$INSERT INTO public.blood_requests
  (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, date_needed)
  VALUES (%L, 'O+', 1, 'Past', 'Past', 'High', 'Riya', '{"latitude": 11.27, "longitude": 75.83}', 'active', 'Kozhikode', (now() AT TIME ZONE 'Asia/Kolkata')::date - 1)$q$, tests.uid('wanew')),
  '23514', 'post: a past date is refused');
SELECT tests.throws(format($q$INSERT INTO public.blood_requests
  (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, date_needed)
  VALUES (%L, 'O+', 1, 'No consent', 'No consent', 'High', 'Ada', '{"latitude": 11.27, "longitude": 75.83}', 'active', 'Kozhikode', (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, tests.uid('admin')),
  'Terms and Privacy', 'post: an account without consent still cannot post');

-- ---------------------------------------------------------------------------
-- 4. Daily cap counter
-- ---------------------------------------------------------------------------
INSERT INTO public.whatsapp_messages (direction, wa_number, kind, status, created_at) VALUES
  ('out', '919000000301', 'request_posted', 'sent', now() - interval '1 hour'),
  ('out', '919000000301', 'request_posted', 'disabled', now() - interval '2 hours'),
  ('out', '919000000301', 'request_posted', 'sent', now() - interval '25 hours'),
  ('out', '919000000301', 'request_flow', 'sent', now()),
  ('in',  '919000000301', 'request_posted', 'received', now()),
  ('out', '919000000302', 'request_posted', 'sent', now());
SELECT tests.is(public.wa_requests_posted_today('9000000301'), 2, 'cap: counts this number''s posts in the last 24 hours only');
SELECT tests.is(public.wa_requests_posted_today('919000000399'), 0, 'cap: a new number has posted none');

SELECT tests.login('requester');
SELECT tests.throws($q$SELECT public.wa_requests_posted_today('919000000301')$q$, '42501', 'cap: signed-in users cannot call it');
SELECT tests.throws($q$SELECT public.wa_release_unconfirmed_phone('919000000301')$q$, '42501', 'release: signed-in users cannot call it');
SELECT tests.login('anon');
SELECT tests.throws($q$SELECT public.wa_release_unconfirmed_phone('919000000301')$q$, '42501', 'release: visitors cannot call it');

ROLLBACK;

\o
