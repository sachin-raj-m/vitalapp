-- Phone sign-in and "verified = email OR mobile" (20261022000100). Run via
-- scripts/test-rls.sh. One transaction, rolled back at the end. Own users:
--   pia    signs up with a phone number only (no email), with consent metadata
--   pat    a second phone-only account (blank email, to check '' is stored as NULL)
--   eli    email account that verifies its number on WhatsApp (VERIFY)
--   dup    email account holding pia's number unverified

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

INSERT INTO tests.users (name, id) VALUES
  ('pia', 'ffffffff-0000-4000-8000-000000000001'),
  ('pat', 'ffffffff-0000-4000-8000-000000000002'),
  ('eli', 'ffffffff-0000-4000-8000-000000000003'),
  ('dup', 'ffffffff-0000-4000-8000-000000000004');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('ffffffff-0000-4000-8000-000000000003', 'eli@example.com', now(), '{}'),
  ('ffffffff-0000-4000-8000-000000000004', 'dup@example.com', NULL, '{}');
UPDATE public.profiles SET phone = '9000000201', whatsapp_alerts = true WHERE id = tests.uid('dup');

-- ---------------------------------------------------------------------------
-- 1. A phone-only sign-up gets a profile, with its consent, without an email
-- ---------------------------------------------------------------------------
INSERT INTO auth.users (id, email, phone, raw_user_meta_data, raw_app_meta_data) VALUES
  ('ffffffff-0000-4000-8000-000000000001', NULL, '919000000201',
   '{"consent_agreed":true,"consent_at":"2025-01-05T10:00:00Z","consent_version":"2026-10-01"}', '{"provider":"phone"}'),
  ('ffffffff-0000-4000-8000-000000000002', '', '919000000202',
   '{"consent_agreed":true,"consent_at":"not a date","consent_version":"2026-10-01"}', '{"provider":"phone"}');

SELECT tests.is(tests.rows(format($q$SELECT 1 FROM public.profiles WHERE id IN (%L, %L) AND email IS NULL$q$, tests.uid('pia'), tests.uid('pat'))), 2::bigint,
  'phone sign-up: profiles are created without an email (blank is NULL, no collision)');
SELECT tests.is(tests.val(format($q$SELECT consent_agreed || '|' || consent_version || '|' || (consent_at = '2025-01-05T10:00:00Z') FROM public.profiles WHERE id = %L$q$, tests.uid('pia'))),
  'true|2026-10-01|true', 'phone sign-up: consent from the sign-up metadata is on the profile');
SELECT tests.ok(tests.val(format($q$SELECT consent_at <= now() FROM public.profiles WHERE id = %L$q$, tests.uid('pat'))) = 'true',
  'phone sign-up: an unreadable consent time becomes now()');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') || '|' || coalesce(phone_verified_at::text, 'null') FROM public.profiles WHERE id = %L$q$, tests.uid('pia'))),
  'null|null', 'phone sign-up: the number is not on the profile before the code is entered');
SELECT tests.is(tests.val(format($q$SELECT consent_agreed::text FROM public.profiles WHERE id = %L$q$, tests.uid('eli'))),
  'false', 'email sign-up without consent metadata: no consent recorded');

-- ---------------------------------------------------------------------------
-- 2. Entering the code (phone confirmed) verifies the number on the profile
-- ---------------------------------------------------------------------------
UPDATE auth.users SET phone_confirmed_at = now() WHERE id = tests.uid('pia');
SELECT tests.is(tests.val(format($q$SELECT phone || '|' || (phone_verified_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('pia'))),
  '9000000201|true', 'phone confirmed: the profile has the number, verified');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') || '|' || whatsapp_alerts || '|' || (phone_released_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('dup'))),
  'null|false|true', 'phone confirmed: another account holding the number unverified gives it up');

SELECT tests.login('dup');
SELECT tests.throws($q$UPDATE public.profiles SET phone = '9000000201' WHERE id = auth.uid()$q$, 'already registered',
  'phone confirmed: nobody else can save the number afterwards');
SELECT tests.login('postgres');

-- Confirming the same phone again (a later sign-in) changes nothing.
UPDATE auth.users SET phone_confirmed_at = now() WHERE id = tests.uid('pia');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.profiles WHERE phone_verified_at IS NOT NULL AND public.wa_number(phone) = '919000000201'$q$), 1::bigint,
  'phone confirmed: still exactly one verified holder');

-- ---------------------------------------------------------------------------
-- 3. Verifying a number in Settings makes it the sign-in phone of that account
-- ---------------------------------------------------------------------------
UPDATE public.profiles SET phone = '98765 43210' WHERE id = tests.uid('eli');
SELECT tests.login('service');
SELECT tests.is(public.confirm_phone_for(tests.uid('eli'), '919876543210'), 'verified', 'settings: eli verifies on WhatsApp');
SELECT tests.login('postgres');
SELECT tests.is(tests.val(format($q$SELECT phone || '|' || (phone_confirmed_at IS NOT NULL) FROM auth.users WHERE id = %L$q$, tests.uid('eli'))),
  '919876543210|true', 'settings: the verified number becomes the account''s sign-in phone');

-- Changing the number removes the old sign-in phone (eli still has an email).
SELECT tests.login('eli');
UPDATE public.profiles SET phone = '9000000299' WHERE id = auth.uid();
SELECT tests.login('postgres');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') FROM auth.users WHERE id = %L$q$, tests.uid('eli'))),
  'null', 'settings: changing a verified number removes it as the sign-in phone');

-- A phone-only account keeps its sign-in phone when it changes the profile number.
SELECT tests.login('pia');
UPDATE public.profiles SET phone = '9000000298' WHERE id = auth.uid();
SELECT tests.login('postgres');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') FROM auth.users WHERE id = %L$q$, tests.uid('pia'))),
  '919000000201', 'phone-only account: keeps its sign-in phone (no email to fall back on)');

-- ---------------------------------------------------------------------------
-- 4. phone_login_codes: server only
-- ---------------------------------------------------------------------------
SELECT tests.login('pia');
SELECT tests.denied($q$SELECT * FROM public.phone_login_codes$q$, 'codes: users cannot read sign-in codes');
SELECT tests.denied($q$INSERT INTO public.phone_login_codes (wa_number, code_enc, expires_at) VALUES ('919000000201', 'x', now())$q$,
  'codes: users cannot write sign-in codes');
SELECT tests.login('anon');
SELECT tests.denied($q$SELECT * FROM public.phone_login_codes$q$, 'codes: visitors cannot read sign-in codes');
SELECT tests.login('service');
SELECT tests.allowed($q$INSERT INTO public.phone_login_codes (wa_number, code_enc, expires_at) VALUES ('919000000201', 'x', now() + interval '10 minutes')$q$, 1,
  'codes: the server can store a code');
SELECT tests.throws($q$INSERT INTO public.phone_login_codes (wa_number, code_enc, expires_at) VALUES ('12345', 'x', now())$q$, '23514',
  'codes: only Indian mobile numbers');
SELECT tests.login('postgres');

-- ---------------------------------------------------------------------------
-- 5. admin_insights: verified = email OR mobile
-- ---------------------------------------------------------------------------
SELECT tests.login('admin');
CREATE TEMP TABLE psi_ai AS SELECT public.admin_insights() AS j;
SELECT tests.login('postgres');
SELECT tests.is(tests.val($q$SELECT ((j->'people'->>'contact_verified')::int + (j->'people'->>'contact_unverified')::int = (j->'people'->>'accounts')::int)::text FROM psi_ai$q$),
  'true', 'admin_insights: verified + unverified = accounts');
SELECT tests.is(tests.val($q$SELECT (j->'people'->>'contact_verified')::int::text FROM psi_ai$q$),
  (SELECT count(*)::text FROM public.profiles p LEFT JOIN auth.users u ON u.id = p.id WHERE u.email_confirmed_at IS NOT NULL OR p.phone_verified_at IS NOT NULL),
  'admin_insights: contact_verified counts email OR mobile');

ROLLBACK;
