-- =============================================================================
-- Vital STAGING seed. FAKE DATA ONLY. NEVER RUN AGAINST PRODUCTION.
--
-- Run once against a fresh staging project after `supabase db push`
-- (see docs/STAGING.md):
--     psql "$STAGING_DB_URL" -v ON_ERROR_STOP=1 -f supabase/seed.staging.sql
-- or paste it into the staging project's SQL editor.
--
-- What it creates (all in the made-up city "Testville", plus one "Otherville"):
--   * 1 admin, 2 requesters, 9 donors that can sign in with a password
--   * open, fulfilled and out-of-town requests, one pending offer ready to verify
-- Every email is @example.com (RFC 2606: never delivered), every phone starts
-- with 00000, every name is invented. Shared password and donor PINs are listed
-- in docs/STAGING.md.
--
-- Re-running is safe: fixture rows use fixed ids and are replaced, nothing
-- else is touched.
-- =============================================================================

BEGIN;

-- Safety: refuse to run on a database that looks like production (real users).
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM auth.users WHERE email NOT ILIKE '%@example.com';
  IF n > 25 THEN
    RAISE EXCEPTION 'seed.staging.sql: % non-example.com users found. This looks like production; aborting.', n;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- Fixture users. Password for every account: see docs/STAGING.md.
-- -----------------------------------------------------------------------------
CREATE TEMP TABLE seed_users (
  id uuid, email text, full_name text, phone text, blood_group text, is_donor boolean,
  is_available boolean, is_public boolean, city text, zip text, lat numeric, lng numeric,
  pin text, role text
) ON COMMIT DROP;

INSERT INTO seed_users VALUES
  -- id                                      email                         name               phone         group donor avail public city          zip       lat      lng      pin    role
  ('00000000-5eed-4000-8000-000000000001', 'staging-admin@example.com',   'Asha Admin',      '0000010001', NULL, false, false, false, 'Testville',  '999001', NULL,    NULL,    NULL,  'admin'),
  ('00000000-5eed-4000-8000-000000000011', 'staging-req1@example.com',    'Ravi Requester',  '0000010011', NULL, false, false, false, 'Testville',  '999001', NULL,    NULL,    NULL,  'user'),
  ('00000000-5eed-4000-8000-000000000012', 'staging-req2@example.com',    'Meera Requester', '0000010012', NULL, false, false, false, 'Testville',  '999001', NULL,    NULL,    NULL,  'user'),
  ('00000000-5eed-4000-8000-000000000021', 'staging-donor-opos@example.com',  'Arun Test',   '0000010021', 'O+',  true, true,  true,  'Testville',  '999011', 10.0101, 76.0101, '1111', 'user'),
  ('00000000-5eed-4000-8000-000000000022', 'staging-donor-oneg@example.com',  'Bina Test',   '0000010022', 'O-',  true, true,  false, 'Testville',  '999012', 10.0202, 76.0202, '2222', 'user'),
  ('00000000-5eed-4000-8000-000000000023', 'staging-donor-apos@example.com',  'Chitra Test', '0000010023', 'A+',  true, true,  false, 'Testville',  '999013', 10.0303, 76.0303, '3333', 'user'),
  ('00000000-5eed-4000-8000-000000000024', 'staging-donor-aneg@example.com',  'Dinesh Test', '0000010024', 'A-',  true, true,  true,  'Testville',  '999014', 10.0404, 76.0404, '4444', 'user'),
  ('00000000-5eed-4000-8000-000000000025', 'staging-donor-bpos@example.com',  'Elan Test',   '0000010025', 'B+',  true, true,  false, 'Testville',  '999015', 10.0505, 76.0505, '5555', 'user'),
  ('00000000-5eed-4000-8000-000000000026', 'staging-donor-abpos@example.com', 'Farah Test',  '0000010026', 'AB+', true, true,  true,  'Testville',  '999016', 10.0606, 76.0606, '6666', 'user'),
  -- Not notified: unavailable / other city
  ('00000000-5eed-4000-8000-000000000027', 'staging-donor-away@example.com',  'Gopal Away',  '0000010027', 'O-',  true, false, false, 'Testville',  '999017', 10.0707, 76.0707, '7777', 'user'),
  ('00000000-5eed-4000-8000-000000000028', 'staging-donor-other@example.com', 'Hema Other',  '0000010028', 'O-',  true, true,  false, 'Otherville', '888001', 11.0101, 77.0101, '8888', 'user'),
  -- No PIN set yet (tests the "set your PIN" prompt)
  ('00000000-5eed-4000-8000-000000000029', 'staging-donor-nopin@example.com', 'Indu Nopin',  '0000010029', 'B-',  true, true,  false, 'Testville',  '999018', 10.0808, 76.0808, NULL,   'user');

-- Clear previous fixture rows (children first).
DELETE FROM public.donations WHERE donor_id IN (SELECT id FROM seed_users)
   OR request_id IN (SELECT r.id FROM public.blood_requests r WHERE r.user_id IN (SELECT id FROM seed_users));
DELETE FROM public.blood_requests WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.donor_secrets WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.notifications WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.push_subscriptions WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM public.profiles WHERE id IN (SELECT id FROM seed_users);
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM seed_users);
DELETE FROM auth.users WHERE id IN (SELECT id FROM seed_users);

-- Confirmed email/password users, shaped the way GoTrue creates them (the
-- empty-string token columns matter: NULLs there break sign-in).
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
       extensions.crypt('VitalStaging-2026!', extensions.gen_salt('bf')), now(),
       '{"provider": "email", "providers": ["email"]}'::jsonb,
       jsonb_build_object('full_name', full_name), now(), now(),
       '', '', '', ''
FROM seed_users;

INSERT INTO auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text, 'email',
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       now(), now(), now()
FROM seed_users;

-- handle_new_user() created bare profiles; fill them in. Run as the SQL
-- owner (auth.uid() is NULL) so role / verification_status are accepted.
UPDATE public.profiles p SET
  full_name = s.full_name,
  phone = s.phone,
  blood_group = s.blood_group,
  is_donor = s.is_donor,
  is_available = s.is_available,
  is_public_profile = s.is_public,
  city = s.city,
  district = 'Test District',
  state = 'Test State',
  present_zip = s.zip,
  permanent_zip = s.zip,
  location = CASE WHEN s.lat IS NOT NULL THEN jsonb_build_object('latitude', s.lat, 'longitude', s.lng) END,
  role = s.role,
  verification_status = CASE WHEN s.is_donor OR s.role = 'admin' THEN 'verified' ELSE 'pending' END,
  consent_agreed = true,
  consent_at = now(),
  consent_version = 'staging-seed'
FROM seed_users s
WHERE p.id = s.id;

INSERT INTO public.donor_secrets (user_id, pin)
SELECT id, pin FROM seed_users WHERE pin IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Requests (contact phones live in request_contacts)
-- -----------------------------------------------------------------------------
INSERT INTO public.blood_requests
  (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level,
   notes, contact_name, location, status, city, zipcode, date_needed, created_at, updated_at) VALUES
  ('00000000-5eed-4000-8000-0000000000a1', '00000000-5eed-4000-8000-000000000011', 'O-', 2,
   'Testville General Hospital', '1 Example Road, Testville', 'High', 'STAGING fixture. Not a real request.',
   'Ravi', '{"latitude": 10.0150, "longitude": 76.0150}', 'active', 'Testville', '999001', current_date + 2, now(), now()),
  ('00000000-5eed-4000-8000-0000000000a2', '00000000-5eed-4000-8000-000000000011', 'A+', 1,
   'Testville Medical College', '2 Example Road, Testville', 'Medium', 'STAGING fixture. Pending offer from Chitra (PIN 3333).',
   'Ravi', '{"latitude": 10.0250, "longitude": 76.0250}', 'active', 'Testville', '999001', current_date + 4, now(), now()),
  ('00000000-5eed-4000-8000-0000000000a3', '00000000-5eed-4000-8000-000000000012', 'B+', 3,
   'Testville Clinic', '3 Example Road, Testville', 'Low', 'STAGING fixture.',
   'Meera', '{"latitude": 10.0350, "longitude": 76.0350}', 'active', 'Testville', '999001', current_date + 7, now(), now()),
  ('00000000-5eed-4000-8000-0000000000a4', '00000000-5eed-4000-8000-000000000012', 'AB+', 1,
   'Testville General Hospital', '1 Example Road, Testville', 'High', 'STAGING fixture. Already fulfilled.',
   'Meera', '{"latitude": 10.0150, "longitude": 76.0150}', 'fulfilled', 'Testville', '999001', current_date - 5,
   now() - interval '6 days', now() - interval '5 days'),
  ('00000000-5eed-4000-8000-0000000000a5', '00000000-5eed-4000-8000-000000000012', 'O-', 1,
   'Otherville Hospital', '9 Example Road, Otherville', 'Medium', 'STAGING fixture. Different city.',
   'Meera', '{"latitude": 11.0150, "longitude": 77.0150}', 'active', 'Otherville', '888001', current_date + 3, now(), now());

INSERT INTO public.request_contacts (request_id, contact_phone) VALUES
  ('00000000-5eed-4000-8000-0000000000a1', '0000020001'),
  ('00000000-5eed-4000-8000-0000000000a2', '0000020002'),
  ('00000000-5eed-4000-8000-0000000000a3', '0000020003'),
  ('00000000-5eed-4000-8000-0000000000a4', '0000020004'),
  ('00000000-5eed-4000-8000-0000000000a5', '0000020005');

-- -----------------------------------------------------------------------------
-- Offers
-- -----------------------------------------------------------------------------
INSERT INTO public.donations (id, request_id, donor_id, status, units_donated, created_at) VALUES
  -- Ready to verify: log in as staging-req1, confirm with Chitra's PIN 3333.
  ('00000000-5eed-4000-8000-0000000000d1', '00000000-5eed-4000-8000-0000000000a2', '00000000-5eed-4000-8000-000000000023', 'pending', 0, now()),
  -- History: Farah (public card) completed the fulfilled request.
  ('00000000-5eed-4000-8000-0000000000d2', '00000000-5eed-4000-8000-0000000000a4', '00000000-5eed-4000-8000-000000000026', 'completed', 1, now() - interval '5 days'),
  -- Withdrawn offer (must not reveal the contact phone).
  ('00000000-5eed-4000-8000-0000000000d3', '00000000-5eed-4000-8000-0000000000a1', '00000000-5eed-4000-8000-000000000027', 'cancelled', 0, now() - interval '1 day');

INSERT INTO public.notifications (user_id, title, message, type, link) VALUES
  ('00000000-5eed-4000-8000-000000000022', 'O- blood needed in Testville', 'STAGING fixture notification.', 'match',
   '/requests/00000000-5eed-4000-8000-0000000000a1');

COMMIT;

-- Summary
SELECT 'users' AS fixture, count(*) FROM auth.users WHERE email LIKE 'staging-%@example.com'
UNION ALL SELECT 'donors listed', count(*) FROM public.profiles WHERE email LIKE 'staging-%@example.com' AND is_donor AND blood_group IS NOT NULL
UNION ALL SELECT 'open requests', count(*) FROM public.blood_requests WHERE id::text LIKE '00000000-5eed-%' AND status = 'active';
