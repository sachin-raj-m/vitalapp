-- A phone-only account adds an email in Settings (Supabase email change:
-- updateUser({ email }) then verifyOtp type 'email_change'). No migration:
-- this checks that sync_profile_email (20261017000100, 20261022000100) and
-- the phone sync triggers already handle it. Run via scripts/test-rls.sh.
-- One transaction, rolled back at the end. Own users:
--   ada    signed up with a phone number only, then adds an email
--   ben    email account (its email must stay unique)

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

INSERT INTO tests.users (name, id) VALUES
  ('ada', 'abababab-0000-4000-8000-000000000001'),
  ('ben', 'abababab-0000-4000-8000-000000000002');

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data) VALUES
  ('abababab-0000-4000-8000-000000000002', 'ben@example.com', now(), '{}');
INSERT INTO auth.users (id, email, phone, phone_confirmed_at, raw_user_meta_data, raw_app_meta_data) VALUES
  ('abababab-0000-4000-8000-000000000001', NULL, '919000000301', now(),
   '{"consent_agreed":true,"consent_at":"2026-10-20T10:00:00Z","consent_version":"2026-10-06"}', '{"provider":"phone"}');

SELECT tests.is(tests.val(format($q$SELECT coalesce(email, 'null') || '|' || (email_verified_at IS NULL) || '|' || phone || '|' || (phone_verified_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('ada'))),
  'null|true|9000000301|true', 'add email: starts phone-only, number verified, no email');

-- Asking for the change (email_change set by Supabase) touches neither column.
-- Confirming the code sets the email and its confirmation together.
UPDATE auth.users SET email = 'ada@example.com', email_confirmed_at = now() WHERE id = tests.uid('ada');

SELECT tests.is(tests.val(format($q$SELECT email || '|' || (email_verified_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('ada'))),
  'ada@example.com|true', 'add email: the confirmed email and email_verified_at reach the profile');
SELECT tests.is(tests.val(format($q$SELECT phone || '|' || (phone_confirmed_at IS NOT NULL) FROM auth.users WHERE id = %L$q$, tests.uid('ada'))),
  '919000000301|true', 'add email: the WhatsApp sign-in phone is kept');
SELECT tests.is(tests.val(format($q$SELECT phone || '|' || (phone_verified_at IS NOT NULL) FROM public.profiles WHERE id = %L$q$, tests.uid('ada'))),
  '9000000301|true', 'add email: the verified number on the profile is kept');

-- The user still can't write either column themselves.
SELECT tests.login('ada');
UPDATE public.profiles SET email = 'other@example.com', email_verified_at = NULL WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT email || '|' || (email_verified_at IS NOT NULL) FROM public.profiles WHERE id = auth.uid()$q$),
  'ada@example.com|true', 'add email: users cannot change the added email on their profile');
SELECT tests.login('postgres');

-- An email another account holds (any case) is refused, so the change can't
-- leave two profiles with one email (Supabase refuses it before this anyway).
SELECT tests.throws(format($q$UPDATE auth.users SET email = 'BEN@example.com', email_confirmed_at = now() WHERE id = %L$q$, tests.uid('ada')), '23505',
  'add email: an email already on another profile is refused');

ROLLBACK;
