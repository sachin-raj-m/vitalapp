-- Fixture data for supabase/tests/*.test.sql. Loaded by scripts/test-rls.sh
-- into a throwaway local Postgres only. Everything here is FAKE: example.com
-- emails, 0000-prefixed phone numbers, made-up names and a made-up city.
--
-- Users
--   requester  Riya Requester   non-donor, posts requests
--   donor      Dev Kumar Donor  O-, PRIVATE donor card, PIN 4719
--   unrelated  Eve Unrelated    B+, PUBLIC donor card, PIN 1234, also posts one request
--   admin      Ada Admin        role = admin
--   guest      (no name yet)    fresh email-code account: auth trigger made a bare profile
--
-- Requests
--   R1  requester  A+  2 units  active     contact 0000000101
--   R2  requester  O-  1 unit   fulfilled  contact 0000000102
--   R3  unrelated  B+  1 unit   active     contact 0000000103
--
-- Donations
--   D1  donor     on R1  pending
--   D2  donor     on R2  completed (1 unit)
--   D3  unrelated on R1  cancelled

\ir helpers.sql

INSERT INTO tests.users (name, id) VALUES
  ('requester', '11111111-1111-4111-8111-111111111111'),
  ('donor',     '22222222-2222-4222-8222-222222222222'),
  ('unrelated', '33333333-3333-4333-8333-333333333333'),
  ('admin',     '44444444-4444-4444-8444-444444444444'),
  ('guest',     '55555555-5555-4555-8555-555555555555');

-- auth.users insert fires handle_new_user(), which creates the profile row.
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('11111111-1111-4111-8111-111111111111', 'requester@example.com', '{"full_name":"Riya Requester"}'),
  ('22222222-2222-4222-8222-222222222222', 'donor@example.com',     '{"full_name":"Dev Kumar Donor"}'),
  ('33333333-3333-4333-8333-333333333333', 'unrelated@example.com', '{"full_name":"Eve Unrelated"}'),
  ('44444444-4444-4444-8444-444444444444', 'admin@example.com',     '{"full_name":"Ada Admin"}'),
  ('55555555-5555-4555-8555-555555555555', 'guest@example.com',     '{}');

-- Fill in profiles as the superuser (auth.uid() is NULL, so the privileged
-- column trigger lets role / donor_number through).
UPDATE public.profiles SET phone = '0000000001', blood_group = 'A+', is_donor = false, is_available = false,
  city = 'Testville', government_id = 'FAKE-GOV-1'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE public.profiles SET phone = '0000000002', blood_group = 'O-', is_donor = true, is_available = true,
  is_public_profile = false, donor_number = 9002, city = 'Testville', present_zip = '999002',
  location = '{"latitude": 9.981234, "longitude": 76.281234}', government_id = 'FAKE-GOV-2', dob = '1990-01-01'
WHERE id = '22222222-2222-4222-8222-222222222222';

UPDATE public.profiles SET phone = '0000000003', blood_group = 'B+', is_donor = true, is_available = true,
  is_public_profile = true, donor_number = 9003, city = 'Testville', present_zip = '999003',
  location = '{"latitude": 9.971234, "longitude": 76.291234}', government_id = 'FAKE-GOV-3'
WHERE id = '33333333-3333-4333-8333-333333333333';

UPDATE public.profiles SET phone = '0000000004', role = 'admin', verification_status = 'verified', is_donor = false
WHERE id = '44444444-4444-4444-8444-444444444444';

INSERT INTO public.donor_secrets (user_id, pin) VALUES
  ('22222222-2222-4222-8222-222222222222', '4719'),
  ('33333333-3333-4333-8333-333333333333', '1234');

INSERT INTO public.blood_requests
  (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level,
   contact_name, location, status, city, date_needed) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 'A+', 2,
   'Testville General', '1 Example Road', 'High', 'Riya', '{"latitude": 9.98, "longitude": 76.28}',
   'active', 'Testville', current_date + 3),
  ('aaaaaaaa-0000-4000-8000-000000000002', '11111111-1111-4111-8111-111111111111', 'O-', 1,
   'Testville Medical College', '2 Example Road', 'Medium', 'Riya', '{"latitude": 9.98, "longitude": 76.28}',
   'fulfilled', 'Testville', current_date - 3),
  ('aaaaaaaa-0000-4000-8000-000000000003', '33333333-3333-4333-8333-333333333333', 'B+', 1,
   'Testville Clinic', '3 Example Road', 'Low', 'Eve', '{"latitude": 9.97, "longitude": 76.29}',
   'active', 'Testville', current_date + 5);

INSERT INTO public.request_contacts (request_id, contact_phone) VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', '0000000101'),
  ('aaaaaaaa-0000-4000-8000-000000000002', '0000000102'),
  ('aaaaaaaa-0000-4000-8000-000000000003', '0000000103');

INSERT INTO public.donations (id, request_id, donor_id, status, units_donated) VALUES
  ('dddddddd-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'pending', 0),
  ('dddddddd-0000-4000-8000-000000000002', 'aaaaaaaa-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'completed', 1),
  ('dddddddd-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 'cancelled', 0);

INSERT INTO public.notifications (user_id, title, message, type) VALUES
  ('22222222-2222-4222-8222-222222222222', 'Test', 'Fake notification for donor', 'system'),
  ('33333333-3333-4333-8333-333333333333', 'Test', 'Fake notification for unrelated', 'system');

INSERT INTO storage.buckets (id, name, public) VALUES ('proofs', 'proofs', false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.objects (bucket_id, name, owner) VALUES
  ('proofs', '22222222-2222-4222-8222-222222222222/proof.pdf', '22222222-2222-4222-8222-222222222222'),
  ('proofs', '33333333-3333-4333-8333-333333333333/proof.pdf', '33333333-3333-4333-8333-333333333333');
