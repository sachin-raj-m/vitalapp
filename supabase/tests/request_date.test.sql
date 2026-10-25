-- Request date tests (20261025000100). Run via scripts/test-rls.sh.
--
-- Everything runs in one transaction and is rolled back.

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

SELECT tests.login('requester');

SELECT tests.throws($q$INSERT INTO public.blood_requests
  (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, date_needed)
  VALUES (auth.uid(), 'O+', 1, 'Past Hospital', '1 Road', 'High', 'Riya', '{"latitude": 9.98, "longitude": 76.28}', 'active', 'Testville',
          (now() AT TIME ZONE 'Asia/Kolkata')::date - 1)$q$,
  '23514', 'request date: a new request dated yesterday is refused');

SELECT tests.allowed($q$INSERT INTO public.blood_requests
  (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status, city, date_needed)
  VALUES ('aaaaaaaa-0000-4000-8000-0000000000d1', auth.uid(), 'O+', 1, 'Today Hospital', '1 Road', 'High', 'Riya', '{"latitude": 9.98, "longitude": 76.28}', 'active', 'Testville',
          (now() AT TIME ZONE 'Asia/Kolkata')::date)$q$, 1,
  'request date: today (in India) is accepted');

-- As the owner role, so only the date rule (not grants or policies) is tested.
SELECT tests.login('postgres');
SELECT tests.throws($q$UPDATE public.blood_requests SET date_needed = (now() AT TIME ZONE 'Asia/Kolkata')::date - 3
  WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  '23514', 'request date: moving a request into the past is refused');

-- R4 in the seed is already expired: its owner can still cancel it.
SELECT tests.login('requester');
SELECT tests.allowed($q$UPDATE public.blood_requests SET status = 'cancelled'
  WHERE id = 'aaaaaaaa-0000-4000-8000-000000000004'$q$, 1,
  'request date: an expired request can still be cancelled');

ROLLBACK;

\o
