-- Contact verification tests (20261017000100). Run via scripts/test-rls.sh.
--
-- Everything runs inside one transaction that is rolled back at the end, so
-- the fixtures other test files use are left as they were. Uses its own users:
--   vera   email confirmed, verifies 9000000101 on WhatsApp
--   sam    holds the same number unverified (a duplicate account)
--   tom    a third account that tries to take the verified number

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

INSERT INTO tests.users (name, id) VALUES
  ('vera', 'eeeeeeee-0000-4000-8000-000000000001'),
  ('sam',  'eeeeeeee-0000-4000-8000-000000000002'),
  ('tom',  'eeeeeeee-0000-4000-8000-000000000003');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('eeeeeeee-0000-4000-8000-000000000001', 'vera@example.com', now(), '{"full_name":"Vera Verified"}'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'sam@example.com', NULL, '{"full_name":"Sam Same"}'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'tom@example.com', NULL, '{"full_name":"Tom Taker"}');

UPDATE public.profiles SET phone = '9000000101', whatsapp_alerts = true WHERE id = tests.uid('vera');
UPDATE public.profiles SET phone = '+91 90000 00101', whatsapp_alerts = true WHERE id = tests.uid('sam');
UPDATE public.profiles SET phone = '9000000103' WHERE id = tests.uid('tom');

-- ---------------------------------------------------------------------------
-- 1. Email follows the sign-in account
-- ---------------------------------------------------------------------------
SELECT tests.ok(tests.val(format($q$SELECT email_verified_at IS NOT NULL FROM public.profiles WHERE id = %L$q$, tests.uid('vera'))) = 'true',
  'email: a confirmed sign-up is marked verified on the profile');
SELECT tests.is(tests.val(format($q$SELECT coalesce(email_verified_at::text, 'null') FROM public.profiles WHERE id = %L$q$, tests.uid('sam'))), 'null',
  'email: an unconfirmed sign-up is not');
UPDATE auth.users SET email_confirmed_at = now() WHERE id = tests.uid('sam');
SELECT tests.ok(tests.val(format($q$SELECT email_verified_at IS NOT NULL FROM public.profiles WHERE id = %L$q$, tests.uid('sam'))) = 'true',
  'email: confirming the code marks the profile verified');
UPDATE auth.users SET email = 'sam.new@example.com' WHERE id = tests.uid('sam');
SELECT tests.is(tests.val(format($q$SELECT email FROM public.profiles WHERE id = %L$q$, tests.uid('sam'))), 'sam.new@example.com',
  'email: an email change reaches the profile');

SELECT tests.login('tom');
UPDATE public.profiles SET email = 'someone@example.com', email_verified_at = now(), full_name = 'Tom T' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT email || '|' || coalesce(email_verified_at::text, 'null') || '|' || full_name FROM public.profiles WHERE id = auth.uid()$q$),
  'tom@example.com|null|Tom T', 'email: users cannot change their profile email or mark it verified');
SELECT tests.login('postgres');

SELECT tests.throws(format($q$UPDATE public.profiles SET email = 'VERA@Example.com' WHERE id = %L$q$, tests.uid('tom')), '23505',
  'email: two profiles cannot share an email, ignoring case');

-- ---------------------------------------------------------------------------
-- 2. Verifying a number on WhatsApp
-- ---------------------------------------------------------------------------
SELECT tests.login('vera');
SELECT tests.throws($q$SELECT public.confirm_phone_for(auth.uid(), '919000000101')$q$, '42501',
  'phone: users cannot call confirm_phone_for');
SELECT tests.denied($q$SELECT * FROM public.verification_codes$q$, 'phone: users cannot read WhatsApp codes');
UPDATE public.profiles SET phone_released_at = now() WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT coalesce(phone_released_at::text, 'null') FROM public.profiles WHERE id = auth.uid()$q$), 'null',
  'phone: users cannot set phone_released_at');
SELECT tests.login('postgres');

INSERT INTO public.verification_codes (user_id, purpose, payload, code_hash, expires_at) VALUES
  (tests.uid('vera'), 'phone_whatsapp', '{"wa":"919000000101"}', 'x', now() + interval '15 minutes'),
  (tests.uid('sam'),  'phone_whatsapp', '{"wa":"919000000101"}', 'y', now() + interval '15 minutes');
SELECT tests.pass('phone: verification_codes accepts the phone_whatsapp purpose');

SELECT tests.login('service');
SELECT tests.is(public.confirm_phone_for(tests.uid('vera'), '919000000999'), 'number_changed',
  'phone: a message from a different number does not verify');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone_verified_at::text, 'null') FROM public.profiles WHERE id = %L$q$, tests.uid('vera'))), 'null',
  'phone: ...and leaves the number unverified');
SELECT tests.is(public.confirm_phone_for(tests.uid('vera'), '919000000101'), 'verified',
  'phone: the right number verifies');
SELECT tests.ok(tests.val(format($q$SELECT phone_verified_at IS NOT NULL FROM public.profiles WHERE id = %L$q$, tests.uid('vera'))) = 'true',
  'phone: ...and sets phone_verified_at');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone, 'null') || '|' || whatsapp_alerts || '|' || (phone_released_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('sam'))),
  'null|false|true', 'phone: another account holding the number unverified loses it (alerts off, flagged)');
SELECT tests.is(tests.val($q$SELECT count(*) FROM public.verification_codes WHERE purpose = 'phone_whatsapp' AND payload->>'wa' = '919000000101'$q$), '0',
  'phone: pending codes for the number are removed');
SELECT tests.is(public.confirm_phone_for(tests.uid('vera'), '919000000101'), 'already_verified',
  'phone: verifying again is harmless');
SELECT tests.is(public.profile_for_wa('919000000101'), tests.uid('vera'),
  'phone: WhatsApp messages from the number go to the verified account');
SELECT tests.login('postgres');

-- ---------------------------------------------------------------------------
-- 3. One verified account per number
-- ---------------------------------------------------------------------------
SELECT tests.login('tom');
SELECT tests.throws($q$UPDATE public.profiles SET phone = '09000000101' WHERE id = auth.uid()$q$,
  'already registered to another Vital account', 'phone: users cannot save a number another account verified');
SELECT tests.allowed($q$UPDATE public.profiles SET phone = '9000000104' WHERE id = auth.uid()$q$, 1,
  'phone: users can still save a free number');
SELECT tests.login('sam');
SELECT tests.throws($q$UPDATE public.profiles SET phone = '9000000101' WHERE id = auth.uid()$q$,
  'already registered to another Vital account', 'phone: the released account cannot take the number back');
UPDATE public.profiles SET phone = '9000000102' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT coalesce(phone_released_at::text, 'null') FROM public.profiles WHERE id = auth.uid()$q$), 'null',
  'phone: entering a new number clears the released flag');
SELECT tests.login('service');
SELECT tests.throws(format($q$UPDATE public.profiles SET phone = '9000000101' WHERE id = %L$q$, tests.uid('tom')),
  'already registered to another Vital account', 'phone: the server cannot give a verified number to another account either');
SELECT tests.is(public.confirm_phone_for(tests.uid('tom'), '919000000103'), 'verified',
  'phone: a second account verifies its own number');
SELECT tests.login('postgres');

-- Superuser writes skip the guard trigger's rules; the index still holds.
ALTER TABLE public.profiles DISABLE TRIGGER refuse_taken_phone;
SELECT tests.throws(format($q$UPDATE public.profiles SET phone = '9000000101', phone_verified_at = now() WHERE id = %L$q$, tests.uid('sam')),
  '23505', 'phone: the unique index refuses a second verified account for a number');
ALTER TABLE public.profiles ENABLE TRIGGER refuse_taken_phone;

-- Existing unverified duplicates are allowed (they predate this migration).
UPDATE public.profiles SET phone = '9000000555' WHERE id IN (tests.uid('sam'));
SELECT tests.allowed(format($q$UPDATE public.profiles SET phone = '9000000555' WHERE id = %L$q$, tests.uid('vera')), 1,
  'phone: two unverified accounts may still share a number');

SELECT tests.login('admin');
UPDATE public.profiles SET phone = '9000000106' WHERE id = tests.uid('tom');
SELECT tests.is(tests.val(format($q$SELECT coalesce(phone_verified_at::text, 'null') FROM public.profiles WHERE id = %L$q$, tests.uid('tom'))), 'null',
  'phone: an admin changing the number clears its verification');
SELECT tests.login('postgres');

ROLLBACK;

\o
