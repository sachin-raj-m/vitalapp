-- Location tests (20261017000200_precise_location). Run via scripts/test-rls.sh
-- (fixtures: seed.sql). Everything runs in one transaction and is rolled back,
-- so rls.test.sql sees the fixtures unchanged.

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

-- =========================================================================
-- 1. Donor locations are normalised and validated
-- =========================================================================
SELECT tests.login('donor');

UPDATE public.profiles SET location = '{"latitude": 9.98123456, "longitude": 76.28123456, "source": "gps",
  "accuracy_m": 12.6, "label": "  Kakkanad, Kochi  ", "updated_at": "2000-01-01T00:00:00Z", "home": "secret"}'
WHERE id = auth.uid();

SELECT tests.is(tests.val($q$SELECT (location->>'latitude') || ',' || (location->>'longitude') FROM public.profiles WHERE id = auth.uid()$q$),
  '9.9812,76.2812', 'location: coordinates are rounded to 4 dp (~11 m)');
SELECT tests.is(tests.val($q$SELECT location->>'source' FROM public.profiles WHERE id = auth.uid()$q$),
  'gps', 'location: the source is kept');
SELECT tests.is(tests.val($q$SELECT location->>'accuracy_m' FROM public.profiles WHERE id = auth.uid()$q$),
  '13', 'location: accuracy is stored in whole metres');
SELECT tests.is(tests.val($q$SELECT location->>'label' FROM public.profiles WHERE id = auth.uid()$q$),
  'Kakkanad, Kochi', 'location: the label is trimmed');
SELECT tests.is(tests.val($q$SELECT (location ? 'home')::text FROM public.profiles WHERE id = auth.uid()$q$),
  'false', 'location: unknown keys are dropped');
SELECT tests.ok(tests.val($q$SELECT location->>'updated_at' FROM public.profiles WHERE id = auth.uid()$q$)::timestamptz > now() - interval '1 minute',
  'location: a user''s write is stamped with the time it was saved, not the time they sent');

SELECT tests.allowed($q$UPDATE public.profiles SET location = '{"latitude": 0, "longitude": 0}' WHERE id = auth.uid()$q$, 1,
  'location: the old (0,0) placeholder is accepted (older app builds) ...');
UPDATE public.profiles SET location = '{"latitude": 0, "longitude": 0}' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT coalesce(location::text, 'null') FROM public.profiles WHERE id = auth.uid()$q$),
  'null', 'location: ... and stored as no location');
UPDATE public.profiles SET location = '{}' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT coalesce(location::text, 'null') FROM public.profiles WHERE id = auth.uid()$q$),
  'null', 'location: an empty object is stored as no location');

SELECT tests.throws($q$UPDATE public.profiles SET location = '{"latitude": 51.5072, "longitude": -0.1276, "source": "gps"}' WHERE id = auth.uid()$q$,
  '23514', 'location: a point outside India is refused');
SELECT tests.throws($q$UPDATE public.profiles SET location = '{"latitude": 40.7, "longitude": 74.0}' WHERE id = auth.uid()$q$,
  '23514', 'location: a point just outside India''s box is refused');
SELECT tests.throws($q$UPDATE public.profiles SET location = '{"latitude": 9.98, "longitude": 76.28, "source": "ip"}' WHERE id = auth.uid()$q$,
  '23514.*source', 'location: an unknown source is refused');
SELECT tests.throws($q$UPDATE public.profiles SET location = '{"latitude": 9.98, "longitude": 76.28, "source": "gps", "accuracy_m": "10"}' WHERE id = auth.uid()$q$,
  '23514.*accuracy', 'location: accuracy must be a number');
SELECT tests.throws($q$UPDATE public.profiles SET location = '{"latitude": 9.98, "longitude": 76.28, "source": "gps", "accuracy_m": -5}' WHERE id = auth.uid()$q$,
  '23514.*accuracy', 'location: accuracy cannot be negative');

UPDATE public.profiles SET location = '{"latitude": 9.981, "longitude": 76.299, "source": "pin"}' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT location->>'accuracy_m' FROM public.profiles WHERE id = auth.uid()$q$),
  '5000', 'location: a PIN code centre defaults to about 5 km accuracy');
UPDATE public.profiles SET location = '{"latitude": 9.981, "longitude": 76.299}' WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT location->>'source' || '|' || (location->>'accuracy_m') FROM public.profiles WHERE id = auth.uid()$q$),
  'manual|100', 'location: no source means placed by hand (~100 m)');

-- =========================================================================
-- 2. Precise helpers and privacy
-- =========================================================================
SELECT tests.is(public.location_is_precise('{"latitude": 9.98, "longitude": 76.28, "source": "gps"}'), true,
  'location_is_precise: device location counts');
SELECT tests.is(public.location_is_precise('{"latitude": 9.98, "longitude": 76.28, "source": "manual"}'), true,
  'location_is_precise: a point placed on the map counts');
SELECT tests.is(public.location_is_precise('{"latitude": 9.98, "longitude": 76.28, "source": "pin"}'), false,
  'location_is_precise: a PIN code centre does not');
SELECT tests.is(public.location_is_precise('{"latitude": 0, "longitude": 0, "source": "gps"}'), false,
  'location_is_precise: (0,0) does not');

UPDATE public.profiles SET location = '{"latitude": 9.98123, "longitude": 76.28123, "source": "gps", "accuracy_m": 8}' WHERE id = auth.uid();
SELECT tests.login('unrelated');
SELECT tests.denied(format($q$SELECT location FROM public.profiles WHERE id = %L$q$, tests.uid('donor')),
  'location: another user cannot read a donor''s precise location');
SELECT tests.is(tests.val(format($q$SELECT approx_location::text FROM public.nearby_donors() WHERE id = %L$q$, tests.uid('donor')))::jsonb,
  '{"latitude": 9.98, "longitude": 76.28}'::jsonb, 'location: others only ever see it rounded to ~1 km');
SELECT tests.is(tests.affected(format($q$UPDATE public.profiles SET location = '{"latitude": 9.9, "longitude": 76.2}' WHERE id = %L$q$, tests.uid('donor'))),
  0, 'location: a user cannot move someone else');
SELECT tests.login('anon');
SELECT tests.throws($q$SELECT public.location_is_precise('{}')$q$, '42501', 'location_is_precise: not callable signed out');
SELECT tests.throws($q$SELECT public.normalize_location('{}', true)$q$, '42501', 'normalize_location: not callable by clients');

-- The server (service role) keeps the time it geocoded a PIN code.
SELECT tests.login('service');
UPDATE public.profiles SET location = '{"latitude": 9.97, "longitude": 76.29, "source": "pin", "geocoded_at": "2026-10-10T00:00:00Z"}'
WHERE id = tests.uid('unrelated');
SELECT tests.is(tests.val(format($q$SELECT location->>'updated_at' || '|' || (location ? 'geocoded_at')::text FROM public.profiles WHERE id = %L$q$, tests.uid('unrelated'))),
  '2026-10-10T00:00:00Z|false', 'location: server writes keep their geocoding time as updated_at');

-- =========================================================================
-- 3. Request locations must be a real place in India
-- =========================================================================
SELECT tests.login('requester');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, city)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{}', 'Testville')$q$,
  '23514.*hospital', 'request: cannot be posted without a map pin');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, city)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{"latitude": 0, "longitude": 0}', 'Testville')$q$,
  '23514', 'request: cannot be posted at (0,0)');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, city)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{"latitude": 25.2, "longitude": 55.27}', 'Testville')$q$,
  '23514', 'request: cannot be posted outside India');
SELECT tests.allowed($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, city)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{"latitude": 9.9816, "longitude": 76.2999, "source": "search"}', 'Testville')$q$, 1,
  'request: a pin in India is accepted');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES (tests.uid('donor'), 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$,
  '42501', 'request: posting as someone else still reports the permission error first');
SELECT tests.throws($q$UPDATE public.blood_requests SET location = '{"latitude": 0, "longitude": 0}' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  '23514', 'request: the pin cannot be moved to (0,0)');
SELECT tests.allowed($q$UPDATE public.blood_requests SET location = '{"latitude": 9.99, "longitude": 76.3}' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$, 1,
  'request: the pin can be moved within India');

-- Older requests with no usable pin can still be closed or edited otherwise.
SELECT tests.login('postgres');
ALTER TABLE public.blood_requests DISABLE TRIGGER validate_request_location;
INSERT INTO public.blood_requests (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level,
  contact_name, location, status, city, date_needed)
VALUES ('aaaaaaaa-0000-4000-8000-0000000000f1', tests.uid('requester'), 'A+', 1, 'Legacy Hospital', 'Old Road', 'Low',
  'Riya', '{"latitude": 0, "longitude": 0}', 'active', 'Testville', current_date + 2);
ALTER TABLE public.blood_requests ENABLE TRIGGER validate_request_location;
SELECT tests.login('requester');
SELECT tests.allowed($q$UPDATE public.blood_requests SET status = 'cancelled' WHERE id = 'aaaaaaaa-0000-4000-8000-0000000000f1'$q$, 1,
  'request: an older request without a pin can still be cancelled');

SELECT tests.login('postgres');
ROLLBACK;

\o
