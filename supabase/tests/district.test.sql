-- District, not city (20261018000300). Run via scripts/test-rls.sh
-- (fixtures: seed.sql). Wrapped in a transaction that is rolled back, so the
-- fixture tweaks below never leak into other test files.
--
-- Seed: requester, donor (O-), unrelated (B+) and admin have a name and the
-- city 'Testville' but no state or district; guest has nothing.

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

-- =========================================================================
-- 1. blood_requests.district / state
-- =========================================================================
SELECT tests.is(tests.val($q$SELECT string_agg(column_name || ':' || data_type || ':' || is_nullable, ',' ORDER BY column_name)
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'blood_requests' AND column_name IN ('district', 'state')$q$),
  'district:text:YES,state:text:YES', 'blood_requests: nullable text columns district and state');

SELECT tests.login('service');
UPDATE public.blood_requests SET district = 'Ernakulam', state = 'Kerala'
WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001';

SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT district || ', ' || state FROM public.blood_requests
  WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 'Ernakulam, Kerala',
  'anon: can read a request''s district and state (public, like city)');
SELECT tests.denied($q$SELECT user_id FROM public.blood_requests$q$,
  'anon: still cannot read the poster''s account id');
SELECT tests.denied($q$UPDATE public.blood_requests SET district = 'X'$q$,
  'anon: cannot set a request''s district');

SELECT tests.login('unrelated');
SELECT tests.denied($q$UPDATE public.blood_requests SET district = 'X'
  WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  'signed-in user: cannot set the district of someone else''s request');

-- =========================================================================
-- 2. public_stats(): members = name + state + district (city not needed)
-- =========================================================================
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'members'$q$), '0',
  'members: name and city without state or district is not a completed registration');

SELECT tests.login('postgres');
-- requester: state + district, no city at all -> member.
UPDATE public.profiles SET state = 'Kerala', district = 'Ernakulam', city = NULL WHERE id = tests.uid('requester');
-- donor: district but no state -> not a member (the app fills the state in
-- for a district it can resolve, so it counts after the next visit).
UPDATE public.profiles SET district = 'Ernakulam', state = NULL WHERE id = tests.uid('donor');
-- unrelated: state but a blank district -> not a member.
UPDATE public.profiles SET state = 'Kerala', district = '  ' WHERE id = tests.uid('unrelated');
-- guest: state + district but no name -> not a member.
UPDATE public.profiles SET state = 'Kerala', district = 'Ernakulam' WHERE id = tests.uid('guest');

SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'members'$q$), '1',
  'members: only full name + state + district counts (city ignored, blanks ignored)');

SELECT tests.login('postgres');
UPDATE public.profiles SET state = 'Kerala' WHERE id = tests.uid('donor');
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'members'$q$), '2',
  'members: an older account counts once its state is filled in');

-- =========================================================================
-- 3. public_stats(): districts (and cities, its old name)
-- =========================================================================
SELECT tests.login('postgres');
-- donor: Ernakulam, Kerala. unrelated: same district, different case and spaces.
UPDATE public.profiles SET state = ' kerala', district = 'ERNAKULAM ' WHERE id = tests.uid('unrelated');
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT (public.public_stats()->>'districts') || '|' || (public.public_stats()->>'cities')$q$),
  '1|1', 'districts: one district however it is spelled; cities is the same number');

SELECT tests.login('postgres');
-- The same district name in another state is another district.
UPDATE public.profiles SET state = 'Bihar', district = 'Aurangabad' WHERE id = tests.uid('unrelated');
UPDATE public.profiles SET is_donor = true, blood_group = 'A+', state = 'Maharashtra', district = 'Aurangabad',
  consent_agreed = true, consent_at = now(), consent_version = '2026-10-06'
WHERE id = tests.uid('admin');
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'districts'$q$), '3',
  'districts: Aurangabad (Bihar) and Aurangabad (Maharashtra) are two');

SELECT tests.login('postgres');
-- A non-donor's district and a donor's city never count.
UPDATE public.profiles SET district = 'Pune', state = 'Maharashtra' WHERE id = tests.uid('requester');
UPDATE public.profiles SET city = 'Kochi' WHERE id = tests.uid('donor');
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'districts'$q$), '3',
  'districts: only donors count, and only by district (not city)');

SELECT tests.is(tests.val($q$SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.public_stats()) k$q$),
  'available_donors,cities,districts,donations_completed,donors,fulfilled,members,open,requests_helped,requests_with_donation,units_donated',
  'public_stats: every earlier key is still there, plus districts');

-- =========================================================================
-- 4. admin_insights(): top districts
-- =========================================================================
SELECT tests.login('postgres');
CREATE TEMP TABLE ai (j jsonb);
GRANT ALL ON ai TO authenticated;
SELECT tests.login('admin');
INSERT INTO ai SELECT public.admin_insights();
SELECT tests.login('postgres');

-- Accounts now: requester Pune/Maharashtra, donor Ernakulam/Kerala, unrelated
-- Aurangabad/Bihar, admin Aurangabad/Maharashtra (donor), guest Ernakulam/Kerala.
SELECT tests.is((SELECT j #> '{people,top_districts}' FROM ai),
  '[{"label": "Ernakulam", "state": "Kerala", "donors": 1, "accounts": 2},
    {"label": "Aurangabad", "state": "Bihar", "donors": 1, "accounts": 1},
    {"label": "Aurangabad", "state": "Maharashtra", "donors": 1, "accounts": 1},
    {"label": "Pune", "state": "Maharashtra", "donors": 0, "accounts": 1}]'::jsonb,
  'admin_insights: top districts, per state, by donors then accounts');
SELECT tests.is((SELECT j #> '{people,top_cities}' = j #> '{people,top_districts}' FROM ai), true,
  'admin_insights: top_cities is kept as a copy for older admin pages');
SELECT tests.is((SELECT count(*) FROM ai, jsonb_array_elements(j #> '{people,top_districts}') e
  WHERE e->>'label' IN ('Kochi', 'Testville')), 0::bigint,
  'admin_insights: profile cities are no longer grouped on');

ROLLBACK;

\o
