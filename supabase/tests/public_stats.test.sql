-- public_stats(): the aggregate numbers on the public pages. Run via
-- scripts/test-rls.sh (fixtures: seed.sql). Wrapped in a transaction that is
-- rolled back, so the fixture tweaks below never leak into other test files.
--
-- Fixture totals before any tweak:
--   members 0 (nobody has a district yet), donors 2 (donor, unrelated; both
--   available, both in Testville), open 2 (R1, R3; R4 is expired), fulfilled 1
--   (R2), one completed donation (D2, 1 unit, on R2).

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

-- =========================================================================
-- 1. Shape and privileges
-- =========================================================================
SELECT tests.is(tests.val($q$SELECT prosecdef::text || '|' || array_to_string(proconfig, ',') FROM pg_proc
  WHERE oid = 'public.public_stats()'::regprocedure$q$), 'true|search_path=public',
  'public_stats: SECURITY DEFINER with a pinned search_path');

SELECT tests.login('anon');

SELECT tests.is(tests.val($q$SELECT public.public_stats()$q$)::jsonb,
  '{"members": 0, "donors": 2, "available_donors": 2, "cities": 1, "open": 2, "fulfilled": 1,
    "requests_with_donation": 1, "requests_helped": 1, "donations_completed": 1, "units_donated": 1}'::jsonb,
  'anon: public_stats() matches the fixtures');

SELECT tests.is(tests.val($q$SELECT string_agg(k, ',' ORDER BY k) FROM jsonb_object_keys(public.public_stats()) k$q$),
  'available_donors,cities,donations_completed,donors,fulfilled,members,open,requests_helped,requests_with_donation,units_donated',
  'anon: public_stats() returns only the documented keys');

SELECT tests.is(tests.val($q$SELECT count(*) FROM jsonb_each(public.public_stats()) e WHERE jsonb_typeof(e.value) <> 'number'$q$),
  '0', 'anon: every value is a plain number (no names, ids, cities or phones)');

SELECT tests.is(tests.val($q$SELECT public.public_stats()::text ~* '(testville|riya|eve|dev kumar|example\.com|0000000|[0-9a-f]{8}-)'$q$),
  'false', 'anon: no fixture personal data appears anywhere in the result');

SELECT tests.is(tests.val($q$SELECT public.public_stats() @> '{"donors": 2, "open": 2, "fulfilled": 1}'::jsonb$q$),
  'true', 'anon: original keys keep their values (existing callers unaffected)');

SELECT tests.login('requester');
SELECT tests.is(tests.val($q$SELECT (public.public_stats()->>'units_donated')$q$), '1',
  'signed-in user: public_stats() is callable and returns the same totals');

-- =========================================================================
-- 2. Each definition responds to the right change
-- =========================================================================
SELECT tests.login('postgres');

-- Completed registration needs name, phone, city and district.
UPDATE public.profiles SET district = 'Test District'
WHERE id IN (tests.uid('requester'), tests.uid('donor'), tests.uid('unrelated'));
UPDATE public.profiles SET district = '   ' WHERE id = tests.uid('admin');

-- Cities: trimmed and case-insensitive; a non-donor's city doesn't count.
UPDATE public.profiles SET city = '  testville ', is_available = false WHERE id = tests.uid('donor');
UPDATE public.profiles SET city = 'Kochi' WHERE id = tests.uid('requester');

-- Partial collection: 1 of R1's 2 units confirmed. R1 stays open.
UPDATE public.donations SET status = 'completed', units_donated = 1
WHERE id = 'dddddddd-0000-4000-8000-000000000001';

-- A fulfilled request with no donation recorded on Vital.
UPDATE public.blood_requests SET status = 'fulfilled' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003';

-- Cancelled and pending donations never count, whatever units they carry.
UPDATE public.donations SET units_donated = 5 WHERE id = 'dddddddd-0000-4000-8000-000000000003';

SELECT tests.login('anon');

SELECT tests.is(tests.val($q$SELECT public.public_stats()$q$)::jsonb,
  '{"members": 3, "donors": 2, "available_donors": 1, "cities": 1, "open": 1, "fulfilled": 2,
    "requests_with_donation": 2, "requests_helped": 3, "donations_completed": 2, "units_donated": 2}'::jsonb,
  'anon: members, availability, cities, partial and fulfilled requests, units all follow their definitions');

-- Another donor city makes two; a blank city is ignored.
SELECT tests.login('postgres');
UPDATE public.profiles SET city = 'Kochi' WHERE id = tests.uid('unrelated');
UPDATE public.profiles SET is_donor = true, blood_group = 'A+', city = '',
  consent_agreed = true, consent_at = now(), consent_version = '2026-10-06'
WHERE id = tests.uid('admin');
SELECT tests.login('anon');
SELECT tests.is(tests.val($q$SELECT (public.public_stats()->>'cities') || '|' || (public.public_stats()->>'donors')$q$),
  '2|3', 'anon: cities counts distinct non-empty donor cities');

-- An expired request is neither open nor helped.
SELECT tests.is(tests.val($q$SELECT public.public_stats()->>'open'$q$), '1',
  'anon: expired requests (active, past needed-by date) are not counted as open');

SELECT tests.login('postgres');

ROLLBACK;

\o
