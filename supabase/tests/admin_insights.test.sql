-- admin_insights() (20261017000400). Run via scripts/test-rls.sh (fixtures: seed.sql).
--
-- Everything runs in one transaction and is rolled back, so the extra rows
-- added below never reach rls.test.sql.
--
-- Fixture totals: 5 accounts, 2 donors (both available, O- and B+, both with a
-- location in India), consent on 3; 4 requests (R1, R3 open; R2 fulfilled; R4
-- active but past its date); offers D1 pending, D2 completed (1 unit), D3 cancelled.

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Who may call it
-- ---------------------------------------------------------------------------
SELECT tests.is(tests.val($q$SELECT prosecdef::text FROM pg_proc WHERE oid = 'public.admin_insights(integer)'::regprocedure$q$),
  'true', 'admin_insights: is SECURITY DEFINER');
SELECT tests.is(has_function_privilege('anon', 'public.admin_insights(integer)', 'EXECUTE'), false,
  'admin_insights: anon has no EXECUTE');

SELECT tests.login('anon');
SELECT tests.throws($q$SELECT public.admin_insights()$q$, '42501', 'admin_insights: anon cannot call it');

SELECT tests.login('requester');
SELECT tests.throws($q$SELECT public.admin_insights()$q$, '42501', 'admin_insights: a signed-in non-admin cannot call it');

SELECT tests.login('donor');
SELECT tests.throws($q$SELECT public.admin_insights(7)$q$, '42501', 'admin_insights: a donor cannot call it');

SELECT tests.login('guest');
SELECT tests.throws($q$SELECT public.admin_insights()$q$, 'admins only', 'admin_insights: a fresh account cannot call it');

SELECT tests.login('service');
SELECT tests.throws($q$SELECT public.admin_insights()$q$, '42501', 'admin_insights: service role is not an admin either');

-- ---------------------------------------------------------------------------
-- 2. Numbers match the fixtures
-- ---------------------------------------------------------------------------
SELECT tests.login('postgres');
CREATE TEMP TABLE ai (j jsonb);
GRANT ALL ON ai TO authenticated;

SELECT tests.login('admin');
INSERT INTO ai SELECT public.admin_insights();
SELECT tests.login('postgres');

-- People
SELECT tests.is((SELECT j #>> '{people,accounts}' FROM ai), '5', 'people: 5 accounts');
SELECT tests.is((SELECT j #>> '{people,donors}' FROM ai), '2', 'people: 2 donors');
SELECT tests.is((SELECT j #>> '{people,available_donors}' FROM ai), '2', 'people: 2 available donors');
SELECT tests.is((SELECT j #>> '{people,signups_7d}' FROM ai), '5', 'people: 5 sign-ups in the last 7 days');
SELECT tests.is((SELECT j #>> '{people,signups_30d}' FROM ai), '5', 'people: 5 sign-ups in the last 30 days');
SELECT tests.is((SELECT j #>> '{people,donors_without_location}' FROM ai), '0', 'people: every donor has a location');
SELECT tests.is((SELECT j #>> '{people,consent_recorded}' FROM ai), '3', 'people: consent recorded for 3');
SELECT tests.is((SELECT j #>> '{people,consent_missing}' FROM ai), '2', 'people: consent missing for 2');
SELECT tests.is((SELECT j #>> '{people,email_confirmed}' FROM ai), '0', 'people: no confirmed emails in fixtures');
SELECT tests.is((SELECT j #>> '{people,email_unconfirmed}' FROM ai), '5', 'people: 5 unconfirmed emails');
SELECT tests.is((SELECT j #>> '{people,phone_verified}' FROM ai), '0', 'people: no verified phones');
SELECT tests.is((SELECT j #>> '{people,whatsapp_opted_in}' FROM ai), '0', 'people: nobody opted in to WhatsApp');
SELECT tests.is((SELECT j #> '{people,donors_by_blood_group}' FROM ai),
  '[{"label": "B+", "count": 1, "available": 1}, {"label": "O-", "count": 1, "available": 1}]'::jsonb,
  'people: donors by blood group');
SELECT tests.is((SELECT j #> '{people,top_cities,0}' FROM ai),
  '{"label": "Testville", "donors": 2, "accounts": 3}'::jsonb, 'people: top city');

-- Requests
SELECT tests.is((SELECT j #>> '{requests,total}' FROM ai), '4', 'requests: 4 in total');
SELECT tests.is((SELECT j #>> '{requests,open}' FROM ai), '2', 'requests: 2 open');
SELECT tests.is((SELECT j #>> '{requests,expired_active}' FROM ai), '1', 'requests: 1 expired but still active');
SELECT tests.is((SELECT j #>> '{requests,fulfilled}' FROM ai), '1', 'requests: 1 fulfilled');
SELECT tests.is((SELECT j #>> '{requests,cancelled}' FROM ai), '0', 'requests: none cancelled');
SELECT tests.is((SELECT j #>> '{requests,units_requested}' FROM ai), '5', 'requests: 5 units requested');
SELECT tests.is((SELECT j #>> '{requests,units_collected}' FROM ai), '1', 'requests: 1 unit collected');
SELECT tests.is((SELECT (j #>> '{requests,fulfilment_rate}')::numeric FROM ai), 0.5::numeric,
  'requests: fulfilment rate = fulfilled / closed = 1 / 2');
SELECT tests.is((SELECT j #>> '{requests,requests_with_offers}' FROM ai), '2', 'requests: 2 have offers');
SELECT tests.ok((SELECT (j #>> '{requests,median_hours_to_first_offer}')::numeric >= 0 FROM ai),
  'requests: median time to first offer is computed');
SELECT tests.ok((SELECT (j #>> '{requests,median_hours_to_fulfilment}')::numeric >= 0 FROM ai),
  'requests: median time to fulfilment is computed');
SELECT tests.is((SELECT j #> '{requests,by_blood_group}' FROM ai),
  '[{"label": "A+", "open": 1, "total": 1, "fulfilled": 0}, {"label": "B+", "open": 1, "total": 2, "fulfilled": 0}, {"label": "O-", "open": 0, "total": 1, "fulfilled": 1}]'::jsonb,
  'requests: by blood group');
SELECT tests.is((SELECT j #> '{requests,by_urgency,0}' FROM ai),
  '{"label": "High", "open": 1, "total": 2, "fulfilled": 0}'::jsonb, 'requests: by urgency (High first)');
SELECT tests.is((SELECT j #> '{requests,by_city}' FROM ai),
  '[{"label": "Testville", "open": 2, "total": 4, "fulfilled": 1}]'::jsonb, 'requests: by city');

-- Offers
SELECT tests.is((SELECT j #>> '{offers,total}' FROM ai), '3', 'offers: 3 made');
SELECT tests.is((SELECT j #>> '{offers,pending}' FROM ai), '1', 'offers: 1 pending');
SELECT tests.is((SELECT j #>> '{offers,completed}' FROM ai), '1', 'offers: 1 completed');
SELECT tests.is((SELECT j #>> '{offers,cancelled}' FROM ai), '1', 'offers: 1 cancelled');
SELECT tests.is((SELECT j #>> '{offers,units_donated}' FROM ai), '1', 'offers: 1 unit donated');
SELECT tests.is((SELECT j #>> '{offers,from_web}' FROM ai), '3', 'offers: all 3 from the web');
SELECT tests.is((SELECT j #>> '{offers,from_whatsapp}' FROM ai), '0', 'offers: none from WhatsApp');
SELECT tests.is((SELECT (j #>> '{offers,offers_per_request}')::numeric FROM ai), 0.75::numeric, 'offers: 0.75 per request');

-- Trend, WhatsApp, referrals, attention (empty fixtures)
SELECT tests.is((SELECT jsonb_array_length(j -> 'trend') FROM ai), 30, 'trend: 30 days by default');
SELECT tests.is((SELECT sum((d ->> 'signups')::int) FROM ai, jsonb_array_elements(j -> 'trend') d), 5::bigint,
  'trend: daily sign-ups add up to 5');
SELECT tests.is((SELECT sum((d ->> 'requests')::int) FROM ai, jsonb_array_elements(j -> 'trend') d), 4::bigint,
  'trend: daily requests add up to 4');
SELECT tests.is((SELECT sum((d ->> 'donations')::int) FROM ai, jsonb_array_elements(j -> 'trend') d), 1::bigint,
  'trend: daily completed donations add up to 1');
SELECT tests.is((SELECT j #>> '{whatsapp,last_30d,total}' FROM ai), '0', 'whatsapp: no messages in fixtures');
SELECT tests.is((SELECT j #>> '{referrals,total}' FROM ai), '0', 'referrals: none in fixtures');
SELECT tests.is((SELECT jsonb_array_length(j #> '{attention,expired_active}') FROM ai), 1,
  'attention: one expired-but-active request');
SELECT tests.is((SELECT j #>> '{attention,expired_active,0,id}' FROM ai), 'aaaaaaaa-0000-4000-8000-000000000004',
  'attention: it is R4');
SELECT tests.is((SELECT j #>> '{attention,no_offers_24h_count}' FROM ai), '0',
  'attention: no open request is 24 h old yet');

-- No personal data: no emails, phones, government ids or full names.
SELECT tests.ok((SELECT j::text !~* '@example\.com|(^|[^0-9])0000000[0-9]{3}([^0-9]|$)|FAKE-GOV|Riya Requester|Dev Kumar|Eve Unrelated|Ada Admin' FROM ai),
  'admin_insights: output has no emails, phones, ids or full names');

-- ---------------------------------------------------------------------------
-- 3. Activity the fixtures lack: an old request with no offers, WhatsApp
--    sends (one failed), a referral, a donor at 0,0
-- ---------------------------------------------------------------------------
UPDATE public.blood_requests SET created_at = now() - interval '2 days' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003';
INSERT INTO public.whatsapp_messages (direction, wa_number, user_id, request_id, kind, status, error) VALUES
  ('out', '910000000002', tests.uid('donor'), 'aaaaaaaa-0000-4000-8000-000000000003', 'alert', 'delivered', NULL),
  ('out', '910000000003', tests.uid('unrelated'), 'aaaaaaaa-0000-4000-8000-000000000003', 'alert', 'failed', 'Message undeliverable'),
  ('out', '910000000002', tests.uid('donor'), NULL, 'thanks', 'read', NULL),
  ('in',  '910000000002', NULL, NULL, 'text', 'received', NULL);
INSERT INTO public.whatsapp_messages (direction, wa_number, kind, status, created_at) VALUES
  ('out', '910000000002', 'alert', 'sent', now() - interval '10 days');
INSERT INTO public.referrals (referrer_id, referee_id) VALUES (tests.uid('donor'), tests.uid('unrelated'));
UPDATE public.profiles SET location = '{"latitude": 0, "longitude": 0}' WHERE id = tests.uid('unrelated');

TRUNCATE ai;
SELECT tests.login('admin');
INSERT INTO ai SELECT public.admin_insights(7);
SELECT tests.login('postgres');

SELECT tests.is((SELECT jsonb_array_length(j -> 'trend') FROM ai), 7, 'trend: p_days = 7 gives 7 days');
SELECT tests.is((SELECT j #>> '{attention,no_offers_24h_count}' FROM ai), '1', 'attention: R3 has no offers after 24 h');
SELECT tests.is((SELECT j #>> '{attention,no_offers_24h,0,id}' FROM ai), 'aaaaaaaa-0000-4000-8000-000000000003',
  'attention: the no-offer request is R3');
SELECT tests.is((SELECT j #>> '{whatsapp,last_7d,total}' FROM ai), '3', 'whatsapp: 3 outbound in 7 days');
SELECT tests.is((SELECT j #>> '{whatsapp,last_30d,total}' FROM ai), '4', 'whatsapp: 4 outbound in 30 days');
SELECT tests.is((SELECT j #>> '{whatsapp,last_7d,failed}' FROM ai), '1', 'whatsapp: 1 failed in 7 days');
SELECT tests.is((SELECT j #> '{whatsapp,last_7d,by_status}' FROM ai), '{"read": 1, "failed": 1, "delivered": 1}'::jsonb,
  'whatsapp: by status');
SELECT tests.is((SELECT j #> '{whatsapp,last_30d,by_kind}' FROM ai), '{"alert": 3, "thanks": 1}'::jsonb, 'whatsapp: by kind');
SELECT tests.is((SELECT j #>> '{whatsapp,inbound_30d}' FROM ai), '1', 'whatsapp: 1 inbound');
SELECT tests.is((SELECT j #>> '{attention,whatsapp_failures,0,error}' FROM ai), 'Message undeliverable',
  'attention: failed send listed with its error');
SELECT tests.ok((SELECT NOT (j #> '{attention,whatsapp_failures,0}') ? 'wa_number' FROM ai),
  'attention: failed sends do not carry the WhatsApp number');
SELECT tests.is((SELECT j #>> '{referrals,total}' FROM ai), '1', 'referrals: 1');
SELECT tests.is((SELECT j #> '{referrals,top_referrers}' FROM ai),
  jsonb_build_array(jsonb_build_object('name', public.donor_short_name('Dev Kumar Donor'), 'count', 1)),
  'referrals: top referrer shown with a masked name');
SELECT tests.ok((SELECT j #>> '{referrals,top_referrers,0,name}' FROM ai) <> 'Dev Kumar Donor',
  'referrals: the referrer''s full name is not returned');
SELECT tests.is((SELECT j #>> '{people,donors_without_location}' FROM ai), '1', 'people: a donor at 0,0 counts as without location');
SELECT tests.ok((SELECT j::text !~ '9100000000' FROM ai), 'admin_insights: no WhatsApp numbers in the output');

SELECT tests.login('postgres');
ROLLBACK;

\o
