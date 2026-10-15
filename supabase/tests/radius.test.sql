-- Radius matching tests (20261017000300). Run via scripts/test-rls.sh.
--
-- Everything runs in one transaction and is rolled back, so the extra
-- fixtures below never reach rls.test.sql.
--
-- Request point: Testville General (9.98, 76.28), recipient A+ (compatible
-- donors O-, O+, A-, A+). One degree of latitude is ~111 km, so +0.21 is
-- ~23 km and +0.23 is ~26 km.
--
-- Seed users: donor (Dev, O-, 9.981234 / 76.281234, available)
--             unrelated (Eve, B+, 9.971234 / 76.291234, available)
--             requester (Riya, A+, not a donor, no location)
-- Added here:
--   near_o_pos     O+  10.05 / 76.30   (~8 km)    available
--   edge_in        A-  10.19 / 76.28   (~23 km)   available
--   edge_out       O+  10.21 / 76.28   (~26 km)   available
--   far            O-  10.40 / 76.28   (~47 km)   available
--   unavailable    A+  9.99 / 76.28    (~1 km)    NOT available
--   zero_loc       O-  0 / 0           placeholder
--   no_loc         O+  NULL location
--   req_donor      O+  9.98 / 76.28    a donor who is also the requester (excluded)
--   not_donor      O-  9.98 / 76.28    is_donor = false

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

SELECT tests.login('postgres');

INSERT INTO tests.users (name, id) VALUES
  ('near_o_pos',  'c0ffee00-0000-4000-8000-000000000001'),
  ('edge_in',     'c0ffee00-0000-4000-8000-000000000002'),
  ('edge_out',    'c0ffee00-0000-4000-8000-000000000003'),
  ('far',         'c0ffee00-0000-4000-8000-000000000004'),
  ('unavailable', 'c0ffee00-0000-4000-8000-000000000005'),
  ('zero_loc',    'c0ffee00-0000-4000-8000-000000000006'),
  ('no_loc',      'c0ffee00-0000-4000-8000-000000000007'),
  ('req_donor',   'c0ffee00-0000-4000-8000-000000000008'),
  ('not_donor',   'c0ffee00-0000-4000-8000-000000000009');

INSERT INTO auth.users (id, email, raw_user_meta_data)
SELECT id, name || '@example.com', jsonb_build_object('full_name', initcap(replace(name, '_', ' ')) || ' Tester')
FROM tests.users WHERE id::text LIKE 'c0ffee00-%';

UPDATE public.profiles p SET
  consent_agreed = true, consent_at = '2026-10-06T00:00:00Z', consent_version = '2026-10-06',
  is_donor = v.is_donor, is_available = v.available, blood_group = v.grp, city = 'Testville',
  location = v.loc::jsonb
FROM (VALUES
  ('c0ffee00-0000-4000-8000-000000000001'::uuid, 'O+', true,  true,  '{"latitude": 10.05, "longitude": 76.30}'),
  ('c0ffee00-0000-4000-8000-000000000002'::uuid, 'A-', true,  true,  '{"latitude": 10.19, "longitude": 76.28}'),
  ('c0ffee00-0000-4000-8000-000000000003'::uuid, 'O+', true,  true,  '{"latitude": 10.21, "longitude": 76.28}'),
  ('c0ffee00-0000-4000-8000-000000000004'::uuid, 'O-', true,  true,  '{"latitude": 10.40, "longitude": 76.28}'),
  ('c0ffee00-0000-4000-8000-000000000005'::uuid, 'A+', true,  false, '{"latitude": 9.99, "longitude": 76.28}'),
  ('c0ffee00-0000-4000-8000-000000000006'::uuid, 'O-', true,  true,  '{"latitude": 0, "longitude": 0}'),
  ('c0ffee00-0000-4000-8000-000000000007'::uuid, 'O+', true,  true,  NULL),
  ('c0ffee00-0000-4000-8000-000000000008'::uuid, 'O+', true,  true,  '{"latitude": 9.98, "longitude": 76.28}'),
  ('c0ffee00-0000-4000-8000-000000000009'::uuid, 'O-', false, false, '{"latitude": 9.98, "longitude": 76.28}')
) AS v(id, grp, is_donor, available, loc)
WHERE p.id = v.id;

-- =========================================================================
-- 1. The radius and the distance helper
-- =========================================================================
SELECT tests.is(public.match_radius_km(), 25::double precision,
  'radius: match_radius_km() is 25 (keep equal to MATCH_RADIUS_KM in lib/geo.ts)');
SELECT tests.ok(abs(public.distance_km(9.98, 76.28, 10.19, 76.28) - 23.35) < 0.1,
  'radius: distance_km() gives ~23.35 km for 0.21 degrees of latitude');
SELECT tests.is(public.distance_km(9.98, 76.28, 9.98, 76.28), 0::double precision,
  'radius: distance_km() is 0 for the same point');
SELECT tests.is(array_to_string(public.compatible_donor_groups('B+'), ','), 'O-,O+,B-,B+',
  'radius: compatible_donor_groups() matches the app chart for B+');
SELECT tests.is(cardinality(public.compatible_donor_groups('XYZ')), 0,
  'radius: unknown recipient group has no compatible donors');

-- =========================================================================
-- 2. donors_within_radius(): who gets alerted
-- =========================================================================
SELECT tests.login('service');

SELECT tests.is(tests.val($q$
  SELECT string_agg(t.name, ',' ORDER BY r.distance_km)
  FROM public.donors_within_radius(9.98, 76.28, 'A+', 'c0ffee00-0000-4000-8000-000000000008') r
  JOIN tests.users t ON t.id = r.id$q$),
  'donor,near_o_pos,edge_in',
  'alerts: compatible, available donors within 25 km, nearest first');

SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000003'$q$), 0::bigint,
  'alerts: donor just outside 25 km (~26 km) is excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000004'$q$), 0::bigint,
  'alerts: far donor (~47 km) is excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = '33333333-3333-4333-8333-333333333333'$q$), 0::bigint,
  'alerts: incompatible group (B+ for an A+ patient) is excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'B+')
  WHERE id = '33333333-3333-4333-8333-333333333333'$q$), 1::bigint,
  'alerts: the same B+ donor matches a B+ patient');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'O-')
  WHERE id <> '22222222-2222-4222-8222-222222222222'$q$), 0::bigint,
  'alerts: an O- patient only matches O- donors (and not the far or placeholder ones)');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000005'$q$), 0::bigint,
  'alerts: unavailable donor is excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000009'$q$), 0::bigint,
  'alerts: non-donor is excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id IN ('c0ffee00-0000-4000-8000-000000000006', 'c0ffee00-0000-4000-8000-000000000007')$q$), 0::bigint,
  'alerts: donors with a (0,0) placeholder or no location are excluded');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(0, 0, 'A+')$q$), 0::bigint,
  'alerts: a (0,0) request point matches nobody (not even (0,0) donors)');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+', 'c0ffee00-0000-4000-8000-000000000008')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000008'$q$), 0::bigint,
  'alerts: the requester is never alerted for their own request');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = 'c0ffee00-0000-4000-8000-000000000008'$q$), 1::bigint,
  'alerts: (control) the same donor matches when not the requester');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donors_within_radius(9.98, 76.28, 'A+', NULL, 10)$q$), 3::bigint,
  'alerts: an explicit smaller radius narrows the audience');
SELECT tests.is(tests.val($q$SELECT email FROM public.donors_within_radius(9.98, 76.28, 'A+')
  WHERE id = '22222222-2222-4222-8222-222222222222'$q$), 'donor@example.com',
  'alerts: returns the contact fields the alert route needs');

-- Permissions: service role only.
SELECT tests.login('anon');
SELECT tests.throws($q$SELECT * FROM public.donors_within_radius(9.98, 76.28, 'A+')$q$, '42501',
  'alerts: anon cannot call donors_within_radius()');
SELECT tests.login('donor');
SELECT tests.throws($q$SELECT * FROM public.donors_within_radius(9.98, 76.28, 'A+')$q$, '42501',
  'alerts: signed-in users cannot call donors_within_radius()');

-- =========================================================================
-- 3. nearby_donors(): only within 25 km of the viewer
-- =========================================================================
-- Viewer: donor (Dev) at ~9.98 / 76.28.
SELECT tests.is(tests.val($q$SELECT string_agg(t.name, ',' ORDER BY n.distance_km, t.name)
  FROM public.nearby_donors() n JOIN tests.users t ON t.id = n.id$q$),
  'req_donor,unavailable,unrelated,near_o_pos,edge_in',
  'nearby: donors within 25 km of the viewer, nearest first');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() WHERE id IN (
  'c0ffee00-0000-4000-8000-000000000003', 'c0ffee00-0000-4000-8000-000000000004')$q$), 0::bigint,
  'nearby: donors beyond 25 km are not shown');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() WHERE id IN (
  'c0ffee00-0000-4000-8000-000000000006', 'c0ffee00-0000-4000-8000-000000000007')$q$), 0::bigint,
  'nearby: donors with a (0,0) placeholder or no location are not shown');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() WHERE id = 'c0ffee00-0000-4000-8000-000000000009'$q$), 0::bigint,
  'nearby: non-donors are not shown');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() WHERE id = auth.uid()$q$), 0::bigint,
  'nearby: the viewer is not in their own list');
SELECT tests.is(tests.val($q$SELECT display_name FROM public.nearby_donors() WHERE id = '33333333-3333-4333-8333-333333333333'$q$),
  'Eve U.', 'nearby: public profiles are masked too');
SELECT tests.is(tests.val($q$SELECT approx_location::text FROM public.nearby_donors() WHERE id = 'c0ffee00-0000-4000-8000-000000000001'$q$)::jsonb,
  '{"latitude": 10.05, "longitude": 76.30}'::jsonb, 'nearby: location still rounded to 2 dp');
SELECT tests.is(tests.val($q$SELECT distance_km::text FROM public.nearby_donors() WHERE id = 'c0ffee00-0000-4000-8000-000000000001'$q$),
  '8', 'nearby: distance is whole kilometres');
SELECT tests.is(tests.val($q$SELECT min(distance_km)::text FROM public.nearby_donors()$q$),
  '1', 'nearby: distance is never below 1 km');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() n
  WHERE (to_jsonb(n) - 'id')::text ~ '(9\.98123|76\.28123|10\.050|999002|0000000002|example\.com)'$q$), 0::bigint,
  'nearby: no precise coordinates, full PIN, phone or email leak');

-- Viewer without a location: nothing (the page asks them to set one).
SELECT tests.login('requester');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors()$q$), 0::bigint,
  'nearby: a viewer with no location sees no donors');
SELECT tests.login('zero_loc');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors()$q$), 0::bigint,
  'nearby: a viewer with a (0,0) placeholder sees no donors');

-- Viewer far away sees only donors near them.
SELECT tests.login('far');
SELECT tests.is(tests.val($q$SELECT string_agg(t.name, ',' ORDER BY n.distance_km)
  FROM public.nearby_donors() n JOIN tests.users t ON t.id = n.id$q$),
  'edge_out,edge_in', 'nearby: a viewer ~47 km away sees only the donors within 25 km of them');

SELECT tests.login('anon');
SELECT tests.throws($q$SELECT * FROM public.nearby_donors()$q$, '42501', 'nearby: anon cannot call nearby_donors()');

SELECT tests.login('postgres');
ROLLBACK;

\o
