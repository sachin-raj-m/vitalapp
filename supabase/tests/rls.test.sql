-- RLS / privilege tests. Run via scripts/test-rls.sh (fixtures: seed.sql).
--
-- Each tests.* call prints PASS/FAIL. Statements given to tests.denied /
-- tests.allowed / tests.throws are rolled back; plain statements persist and
-- drive the flow (offer -> PIN -> verify -> fulfilled -> account deletion).
--
-- IDs:  R1 aaaaaaaa-0000-4000-8000-000000000001 (requester, active, 2 units)
--       R2 ...0002 (requester, fulfilled)   R3 ...0003 (unrelated, active)
--       D1 dddddddd-0000-4000-8000-000000000001 (donor on R1, pending)
--       D2 ...0002 (donor on R2, completed)  D3 ...0003 (unrelated on R1, cancelled)

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

-- =========================================================================
-- 1. Signed-out visitor (anon key, no session)
-- =========================================================================
SELECT tests.login('anon');

SELECT tests.denied($q$SELECT * FROM public.profiles$q$, 'anon: cannot read profiles');
SELECT tests.denied($q$SELECT * FROM public.donations$q$, 'anon: cannot read donations');
SELECT tests.denied($q$SELECT * FROM public.donor_secrets$q$, 'anon: cannot read donor_secrets (PINs)');
SELECT tests.denied($q$SELECT * FROM public.request_contacts$q$, 'anon: cannot read request_contacts (phones)');
SELECT tests.denied($q$SELECT * FROM public.notifications$q$, 'anon: cannot read notifications');
SELECT tests.denied($q$SELECT * FROM public.push_subscriptions$q$, 'anon: cannot read push_subscriptions');
SELECT tests.denied($q$SELECT * FROM public.user_activity_logs$q$, 'anon: cannot read user_activity_logs');
SELECT tests.denied($q$SELECT * FROM public.rate_limits$q$, 'anon: cannot read rate_limits');

SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests$q$), 2::bigint,
  'anon: sees only the 2 active requests (not the fulfilled one)');
SELECT tests.throws($q$SELECT contact_phone FROM public.blood_requests$q$, '42703',
  'anon: blood_requests has no contact_phone column');

SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES ('11111111-1111-4111-8111-111111111111', 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$, '42501',
  'anon: cannot insert blood_requests');
SELECT tests.denied($q$UPDATE public.blood_requests SET status = 'cancelled'$q$, 'anon: cannot update blood_requests');
SELECT tests.denied($q$DELETE FROM public.blood_requests$q$, 'anon: cannot delete blood_requests');
SELECT tests.denied($q$UPDATE public.profiles SET role = 'admin'$q$, 'anon: cannot update profiles');
SELECT tests.denied($q$TRUNCATE public.blood_requests$q$, 'anon: cannot truncate blood_requests');

-- The old public_donors view is gone; cards come from public_donor_card().
SELECT tests.is(to_regclass('public.public_donors') IS NULL, true, 'public_donors view has been dropped');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.public_donor_card(NULL, 9002)$q$), 0::bigint,
  'anon: private donor card returns nothing (no enumeration of private donors)');
SELECT tests.is(tests.val($q$SELECT display_name || '|' || blood_group FROM public.public_donor_card(NULL, 9003)$q$),
  'Eve Unrelated|B+', 'anon: public donor card shows name and blood group');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.public_donor_card('55555555-5555-4555-8555-555555555555', NULL)$q$), 0::bigint,
  'anon: fresh email-code account (no blood group) has no donor card');

-- Requests: anon never sees the poster's account id or expired requests.
SELECT tests.denied($q$SELECT user_id FROM public.blood_requests$q$, 'anon: blood_requests.user_id hidden');
SELECT tests.ok(tests.rows($q$SELECT id, blood_group, hospital_name, contact_name FROM public.blood_requests$q$) > 0,
  'anon: public request columns readable');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000004'$q$), 0::bigint,
  'anon: expired request (active, needed-by date passed) is hidden');

SELECT tests.is(tests.rows($q$SELECT 1 FROM public.public_donor_card(p_donor_number => 9002)$q$), 0::bigint,
  'anon: public_donor_card(private) returns no row at all');
SELECT tests.is(tests.val($q$SELECT display_name || '|' || blood_group FROM public.public_donor_card(p_id => '33333333-3333-4333-8333-333333333333')$q$),
  'Eve Unrelated|B+', 'anon: public_donor_card(public) shows name and group');
SELECT tests.is(tests.rows($q$SELECT * FROM public.public_donor_card('22222222-2222-4222-8222-222222222222', 9003)$q$), 0::bigint,
  'anon: public_donor_card with both arguments returns nothing');

SELECT tests.throws($q$SELECT * FROM public.nearby_donors()$q$, '42501', 'anon: nearby_donors() not executable');
SELECT tests.throws($q$SELECT * FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000001')$q$, '42501',
  'anon: get_request_contact() not executable');
SELECT tests.throws($q$SELECT * FROM public.get_my_request_donors()$q$, '42501', 'anon: get_my_request_donors() not executable');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 1)$q$, '42501',
  'anon: verify_donation() not executable');
SELECT tests.throws($q$SELECT public.create_notification('22222222-2222-4222-8222-222222222222', 'x', 'y', 'system', 'https://evil.example.com')$q$,
  '42501', 'anon: create_notification() not executable');
SELECT tests.throws($q$SELECT public.rate_limit_hit('x', 60, 1)$q$, '42501', 'anon: rate_limit_hit() not executable');
SELECT tests.throws($q$SELECT public.is_admin()$q$, '42501', 'anon: is_admin() not executable');
SELECT tests.throws($q$SELECT public.owns_request('aaaaaaaa-0000-4000-8000-000000000001')$q$, '42501', 'anon: owns_request() not executable');

SELECT tests.is(tests.val($q$SELECT public.public_stats()$q$)::jsonb, '{"open": 2, "donors": 2, "fulfilled": 1}'::jsonb,
  'anon: public_stats() works and counts only real donors');
SELECT tests.is(tests.rows($q$SELECT * FROM public.public_donor_activity('22222222-2222-4222-8222-222222222222')$q$), 0::bigint,
  'anon: public_donor_activity() of a private donor is empty');

SELECT tests.denied($q$SELECT * FROM storage.objects WHERE bucket_id = 'proofs'$q$, 'anon: cannot list proof files');
SELECT tests.throws($q$INSERT INTO storage.objects (bucket_id, name) VALUES ('proofs', 'x/evil.pdf')$q$, '42501',
  'anon: cannot upload proof files');

-- =========================================================================
-- 2. Unrelated signed-in user (Eve)
-- =========================================================================
SELECT tests.login('unrelated');

SELECT tests.is(tests.rows($q$SELECT 1 FROM public.profiles$q$), 1::bigint, 'user: reads only own profile');
SELECT tests.denied($q$SELECT phone FROM public.profiles WHERE id = '22222222-2222-4222-8222-222222222222'$q$,
  'user: cannot read another profile''s phone');
SELECT tests.is(tests.val($q$SELECT pin FROM public.donor_secrets$q$), '1234', 'user: reads own PIN');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donor_secrets$q$), 1::bigint, 'user: sees no other PINs');
SELECT tests.denied($q$UPDATE public.donor_secrets SET pin = '0000' WHERE user_id = '22222222-2222-4222-8222-222222222222'$q$,
  'user: cannot change another donor''s PIN');
SELECT tests.throws($q$INSERT INTO public.donor_secrets (user_id, pin) VALUES ('44444444-4444-4444-8444-444444444444', '0000')$q$,
  '42501', 'user: cannot create a PIN for someone else');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donations$q$), 1::bigint, 'user: reads only own donations');
SELECT tests.denied($q$SELECT * FROM public.request_contacts WHERE request_id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  'user: cannot read contact rows of others'' requests');
SELECT tests.is(tests.rows($q$SELECT * FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000001')$q$), 0::bigint,
  'contact: hidden from a user whose offer was withdrawn');
SELECT tests.is(tests.val($q$SELECT contact_phone FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000003')$q$),
  '0000000103', 'contact: visible to the request owner');

-- Masking for signed-in users
SELECT tests.is(tests.val($q$SELECT display_name FROM public.nearby_donors() WHERE id = '22222222-2222-4222-8222-222222222222'$q$),
  'Dev D.', 'user: nearby_donors() masks private donor name');
SELECT tests.is(tests.val($q$SELECT string_agg(display_name, ',' ORDER BY display_name) FROM public.nearby_donors()$q$),
  'Dev D.,Eve U.', 'user: nearby_donors() masks every name, public profiles too');
SELECT tests.is(tests.val($q$SELECT to_jsonb(n) ->> 'area_code' FROM public.nearby_donors() n WHERE id = '22222222-2222-4222-8222-222222222222'$q$),
  '999', 'user: nearby_donors() exposes only the 3-digit area code');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.nearby_donors() n WHERE to_jsonb(n)::text LIKE '%999002%' OR to_jsonb(n)::text LIKE '%0000000002%'$q$),
  0::bigint, 'user: nearby_donors() leaks no full PIN code or phone');
SELECT tests.is(tests.val($q$SELECT approx_location::text FROM public.nearby_donors() WHERE id = '22222222-2222-4222-8222-222222222222'$q$)::jsonb,
  '{"latitude": 9.98, "longitude": 76.28}'::jsonb, 'user: nearby_donors() rounds location to ~1 km');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.public_donor_card(p_donor_number => 9002)$q$), 0::bigint,
  'user: another user''s private card returns nothing');

-- Privilege escalation
SELECT tests.is(tests.val($q$SELECT public.is_admin()::text$q$), 'false', 'user: is_admin() is false');
UPDATE public.profiles SET role = 'admin', verification_status = 'verified', donor_number = 1 WHERE id = auth.uid();
SELECT tests.is(tests.val($q$SELECT role || '|' || verification_status || '|' || donor_number FROM public.profiles WHERE id = auth.uid()$q$),
  'user|pending|9003', 'trigger: self-update cannot change role / verification / donor_number');
SELECT tests.throws($q$INSERT INTO public.profiles (id, email) VALUES ('66666666-6666-4666-8666-666666666666', 'x@example.com')$q$,
  '42501', 'user: cannot create a profile for another id');
SELECT tests.denied($q$UPDATE public.profiles SET full_name = 'pwned' WHERE id = '22222222-2222-4222-8222-222222222222'$q$,
  'user: cannot update another profile');

-- Requests / donations
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES ('11111111-1111-4111-8111-111111111111', 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$, '42501',
  'user: cannot post a request as someone else');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location, status)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{}', 'fulfilled')$q$, '42501',
  'user: cannot post a request that is already fulfilled');
SELECT tests.denied($q$UPDATE public.blood_requests SET status = 'cancelled' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  'user: cannot update another user''s request');
SELECT tests.denied($q$DELETE FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$,
  'user: cannot delete another user''s request');
SELECT tests.throws($q$INSERT INTO public.request_contacts VALUES ('aaaaaaaa-0000-4000-8000-000000000001', '0000000999')
  ON CONFLICT (request_id) DO UPDATE SET contact_phone = EXCLUDED.contact_phone$q$, '42501',
  'user: cannot overwrite the contact phone of another user''s request');
SELECT tests.throws($q$INSERT INTO public.donations (request_id, donor_id, status, units_donated)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'completed', 5)$q$, '42501',
  'user: cannot insert an already-completed donation');
SELECT tests.throws($q$INSERT INTO public.donations (request_id, donor_id, status, units_donated)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'pending', 3)$q$, '42501',
  'user: cannot insert a pending offer with units pre-filled');
SELECT tests.throws($q$INSERT INTO public.donations (request_id, donor_id, status, otp)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'pending', '1234')$q$, '42501',
  'user: cannot insert an offer with an otp');
SELECT tests.throws($q$INSERT INTO public.donations (request_id, donor_id, status)
  VALUES ('aaaaaaaa-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'pending')$q$, '42501',
  'user: cannot create an offer on behalf of another donor');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 1)$q$,
  'Only the person who posted', 'verify_donation: non-owner of the request is rejected (even with the right PIN)');

-- Notifications / server-only functions
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.notifications$q$), 1::bigint, 'user: reads only own notifications');
SELECT tests.denied($q$UPDATE public.notifications SET is_read = true WHERE user_id = '22222222-2222-4222-8222-222222222222'$q$,
  'user: cannot mark another user''s notification');
SELECT tests.throws($q$INSERT INTO public.notifications (user_id, title, message) VALUES (auth.uid(), 'x', 'y')$q$, '42501',
  'user: cannot insert notifications');
SELECT tests.throws($q$SELECT public.create_notification('22222222-2222-4222-8222-222222222222', 'x', 'y', 'system', 'https://evil.example.com')$q$,
  '42501', 'user: create_notification() not executable');
SELECT tests.throws($q$SELECT public.rate_limit_hit('x', 60, 1)$q$, '42501', 'user: rate_limit_hit() not executable');
SELECT tests.throws($q$SELECT public.protect_profile_privileged_columns()$q$, '42501', 'user: trigger function not callable');
SELECT tests.denied($q$TRUNCATE public.blood_requests$q$, 'user: cannot truncate blood_requests');

-- Storage: proofs bucket, one folder per user
SELECT tests.is(tests.val($q$SELECT string_agg(name, ',') FROM storage.objects WHERE bucket_id = 'proofs'$q$),
  '33333333-3333-4333-8333-333333333333/proof.pdf', 'storage: user lists only own proof');
SELECT tests.allowed($q$INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('proofs', '33333333-3333-4333-8333-333333333333/new.pdf', auth.uid())$q$, 1, 'storage: user uploads into own folder');
SELECT tests.throws($q$INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('proofs', '22222222-2222-4222-8222-222222222222/evil.pdf', auth.uid())$q$, '42501',
  'storage: user cannot upload into another user''s folder');
SELECT tests.throws($q$INSERT INTO storage.objects (bucket_id, name, owner)
  VALUES ('proofs', '33333333-3333-4333-8333-333333333333/spoof.pdf', '22222222-2222-4222-8222-222222222222')$q$, '42501',
  'storage: user cannot upload with a spoofed owner');
SELECT tests.denied($q$DELETE FROM storage.objects WHERE name LIKE '22222222%'$q$, 'storage: user cannot delete another user''s proof');
SELECT tests.denied($q$UPDATE storage.objects SET name = '33333333-3333-4333-8333-333333333333/stolen.pdf' WHERE name LIKE '22222222%'$q$,
  'storage: user cannot rename another user''s proof');
SELECT tests.throws($q$UPDATE storage.objects SET name = '22222222-2222-4222-8222-222222222222/x.pdf' WHERE name LIKE '33333333%'$q$,
  '42501', 'storage: user cannot move own file into another user''s folder');

-- =========================================================================
-- 3. Donor (Dev, pending offer D1 on R1)
-- =========================================================================
SELECT tests.login('donor');

SELECT tests.is(tests.val($q$SELECT pin FROM public.donor_secrets$q$), '4719', 'donor: reads own PIN');
SELECT tests.throws($q$UPDATE public.donor_secrets SET pin = '12ab' WHERE user_id = auth.uid()$q$, '23514',
  'donor: PIN must be 4 digits');
SELECT tests.is(tests.val($q$SELECT contact_phone FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000001')$q$),
  '0000000101', 'contact: visible to a donor with a live offer');
SELECT tests.is(tests.rows($q$SELECT * FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000003')$q$), 0::bigint,
  'contact: hidden from a donor who has not offered');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000002'$q$), 1::bigint,
  'donor: still sees a fulfilled request they donated to');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.profiles WHERE id = '11111111-1111-4111-8111-111111111111'$q$), 0::bigint,
  'donor: cannot read the requester''s profile');
SELECT tests.denied($q$UPDATE public.donations SET status = 'completed', units_donated = 2 WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$,
  'donor: cannot self-complete a donation');
SELECT tests.denied($q$UPDATE public.donations SET units_donated = 2 WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$,
  'donor: cannot set units on own offer');
SELECT tests.denied($q$UPDATE public.donations SET status = 'cancelled' WHERE id = 'dddddddd-0000-4000-8000-000000000002'$q$,
  'donor: cannot withdraw a completed donation');
SELECT tests.allowed($q$UPDATE public.donations SET status = 'cancelled' WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$, 1,
  'donor: can withdraw own pending offer');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 1)$q$,
  'Only the person who posted', 'verify_donation: donor cannot verify their own offer');
SELECT tests.is(tests.val($q$SELECT display_name || '|' || blood_group FROM public.public_donor_card(p_id => auth.uid())$q$),
  'Dev Kumar Donor|O-', 'donor: owner sees own private card in full');

-- =========================================================================
-- 4. Requester (Riya): offer -> PIN -> verify
-- =========================================================================
SELECT tests.login('requester');

SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donations WHERE request_id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 2::bigint,
  'requester: sees offers on own request');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donations WHERE otp IS NOT NULL$q$), 0::bigint,
  'requester: no PIN copied into donations.otp');
SELECT tests.denied($q$SELECT * FROM public.donor_secrets$q$, 'requester: cannot read donors'' PINs');
SELECT tests.is(tests.val($q$SELECT full_name || '|' || phone FROM public.get_my_request_donors() WHERE donation_id = 'dddddddd-0000-4000-8000-000000000001'$q$),
  'Dev D.|0000000002', 'get_my_request_donors: masked name, phone shown while request is open');
SELECT tests.is(tests.val($q$SELECT coalesce(phone, '<null>') FROM public.get_my_request_donors() WHERE donation_id = 'dddddddd-0000-4000-8000-000000000002'$q$),
  '<null>', 'get_my_request_donors: donor phone hidden once request is fulfilled');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.get_my_request_donors() WHERE donation_id = 'dddddddd-0000-4000-8000-000000000003'$q$), 0::bigint,
  'get_my_request_donors: withdrawn offers not listed');
SELECT tests.denied($q$UPDATE public.donations SET status = 'completed', units_donated = 2 WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$,
  'requester: cannot complete a donation directly');
SELECT tests.denied($q$UPDATE public.blood_requests SET status = 'fulfilled' WHERE id = 'aaaaaaaa-0000-4000-8000-000000000003'$q$,
  'requester: cannot touch another user''s request');

-- A wrong PIN is returned, not raised, so the attempt counter persists.
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000001', '0000', 1)->>'error',
  'pin_mismatch', 'verify_donation: wrong PIN rejected');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000001', NULL, 1)->>'error',
  'pin_mismatch', 'verify_donation: NULL PIN rejected');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000001', '   ', 1)->>'error',
  'pin_mismatch', 'verify_donation: blank PIN rejected');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 0)$q$,
  'Units must be between', 'verify_donation: zero units rejected');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 3)$q$,
  'more unit', 'verify_donation: more units than still needed rejected');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000003', '1234', 1)$q$,
  'no longer pending', 'verify_donation: withdrawn offer rejected');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-0000000000ff', '4719', 1)$q$,
  'not found', 'verify_donation: unknown donation rejected');
SELECT tests.is(tests.val($q$SELECT status FROM public.donations WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$), 'pending',
  'verify_donation: failed attempts leave the offer pending');

-- Right PIN, 1 of 2 units: persists.
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 1),
  '{"fulfilled": false, "units_needed": 2, "total_collected": 1}'::jsonb, 'verify_donation: right PIN completes (1 of 2 units)');
SELECT tests.is(tests.val($q$SELECT status || '|' || units_donated FROM public.donations WHERE id = 'dddddddd-0000-4000-8000-000000000001'$q$),
  'completed|1', 'verify_donation: donation marked completed with units');
SELECT tests.is(tests.val($q$SELECT status FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 'active',
  'verify_donation: request stays active until enough units');
SELECT tests.throws($q$SELECT public.verify_donation('dddddddd-0000-4000-8000-000000000001', '4719', 1)$q$,
  'no longer pending', 'verify_donation: cannot verify the same offer twice');

-- Eve makes a fresh offer on R1 (persists), requester verifies it with Eve's PIN.
SELECT tests.login('unrelated');
INSERT INTO public.donations (id, request_id, donor_id, status)
VALUES ('dddddddd-0000-4000-8000-000000000004', 'aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'pending');
SELECT tests.is(tests.val($q$SELECT contact_phone FROM public.get_request_contact('aaaaaaaa-0000-4000-8000-000000000001')$q$),
  '0000000101', 'contact: visible again after a new offer');

SELECT tests.login('requester');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000004', '4719', 1)->>'error',
  'pin_mismatch', 'verify_donation: another donor''s PIN does not work');

-- Lockout after 5 wrong PINs (offer 4 already has 1). Runs inside a block that
-- rolls itself back so the offer can still be completed below.
DO $lock$
DECLARE r jsonb;
BEGIN
  BEGIN
    FOR i IN 1..4 LOOP
      r := public.verify_donation('dddddddd-0000-4000-8000-000000000004', '0000', 1);
    END LOOP;
    PERFORM tests.is(r->>'attempts_left', '0', 'verify_donation: 5th wrong PIN leaves 0 attempts');
    BEGIN
      PERFORM public.verify_donation('dddddddd-0000-4000-8000-000000000004', '1234', 1);
      PERFORM tests.fail('verify_donation: offer locks after 5 wrong PINs', 'right PIN was accepted');
    EXCEPTION WHEN others THEN
      PERFORM tests.ok(SQLERRM LIKE 'Too many incorrect PIN attempts%', 'verify_donation: offer locks after 5 wrong PINs, even for the right PIN');
    END;
    RAISE EXCEPTION 'rollback_lockout_test';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'rollback_lockout_test' THEN RAISE; END IF;
  END;
END $lock$;
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-000000000004', '1234', 1),
  '{"fulfilled": true, "units_needed": 2, "total_collected": 2}'::jsonb, 'verify_donation: second unit fulfils the request');
SELECT tests.is(tests.val($q$SELECT status FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 'fulfilled',
  'verify_donation: request auto-closed as fulfilled');

SELECT tests.login('anon');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 0::bigint,
  'anon: fulfilled request no longer listed');
SELECT tests.is(tests.rows($q$SELECT * FROM public.public_donor_activity('33333333-3333-4333-8333-333333333333')$q$), 1::bigint,
  'anon: public donor''s completed donation appears on their card');

-- =========================================================================
-- 5. Guest email-code request flow (fresh OTP account, as the form does it)
-- =========================================================================
SELECT tests.login('guest');

SELECT tests.is(tests.val($q$SELECT role || '|' || is_donor || '|' || coalesce(blood_group, '<null>') FROM public.profiles WHERE id = auth.uid()$q$),
  'user|false|<null>', 'guest: auth trigger created a bare non-donor profile');
SELECT tests.allowed($q$INSERT INTO public.profiles (id, email, full_name, phone, is_donor, is_available, role)
  VALUES (auth.uid(), 'guest@example.com', 'Gita Guest', '0000000005', false, false, 'admin')
  ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone,
    is_donor = EXCLUDED.is_donor, is_available = EXCLUDED.is_available, role = EXCLUDED.role$q$, 1,
  'guest: upserts own profile as non-donor');
-- As the form does it: the consent ticked in the verify step is stamped on the profile.
INSERT INTO public.profiles (id, email, full_name, phone, is_donor, is_available, role,
  consent_agreed, consent_at, consent_version)
VALUES (auth.uid(), 'guest@example.com', 'Gita Guest', '0000000005', false, false, 'admin',
  true, now(), '2026-10-06')
ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name, phone = EXCLUDED.phone,
  is_donor = EXCLUDED.is_donor, is_available = EXCLUDED.is_available, role = EXCLUDED.role,
  consent_agreed = EXCLUDED.consent_agreed, consent_at = EXCLUDED.consent_at, consent_version = EXCLUDED.consent_version;
SELECT tests.is(tests.val($q$SELECT role FROM public.profiles WHERE id = auth.uid()$q$), 'user',
  'trigger: upsert cannot smuggle role = admin');

INSERT INTO public.blood_requests (id, user_id, blood_group, units_needed, hospital_name, hospital_address,
  urgency_level, contact_name, location, city, status)
VALUES ('aaaaaaaa-0000-4000-8000-000000000005', auth.uid(), 'O-', 1, 'Testville General', '1 Example Road',
  'High', 'Gita', '{"latitude": 9.98, "longitude": 76.28}', 'Testville', 'active');
INSERT INTO public.request_contacts (request_id, contact_phone) VALUES ('aaaaaaaa-0000-4000-8000-000000000005', '0000000105');
SELECT tests.pass('guest: posts a request and its contact phone');
SELECT tests.throws($q$INSERT INTO public.request_contacts VALUES ('aaaaaaaa-0000-4000-8000-000000000003', '0000000999')$q$,
  '42501', 'guest: cannot attach a contact to someone else''s request');

SELECT tests.login('anon');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000005'$q$), 1::bigint,
  'anon: guest request is publicly listed');
SELECT tests.denied($q$SELECT * FROM public.request_contacts WHERE request_id = 'aaaaaaaa-0000-4000-8000-000000000005'$q$,
  'anon: guest request phone is not public');

SELECT tests.login('guest');
SELECT tests.allowed($q$DELETE FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000005'$q$, 1,
  'guest: can delete own request');

-- =========================================================================
-- 6. Admin
-- =========================================================================
SELECT tests.login('admin');

SELECT tests.is(tests.val($q$SELECT public.is_admin()::text$q$), 'true', 'admin: is_admin() is true');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.profiles$q$), 5::bigint, 'admin: reads all profiles');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donations$q$), 4::bigint, 'admin: reads all donations');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donor_secrets$q$), 0::bigint, 'admin: cannot read donor PINs');
SELECT tests.is(tests.rows($q$SELECT 1 FROM storage.objects WHERE bucket_id = 'proofs'$q$), 2::bigint, 'admin: reads all proof files');
SELECT tests.allowed($q$UPDATE public.profiles SET verification_status = 'verified' WHERE id = '22222222-2222-4222-8222-222222222222'$q$, 1,
  'admin: can verify a donor');

-- =========================================================================
-- 7. Service role (server routes)
-- =========================================================================
SELECT tests.login('service');

SELECT tests.is(public.rate_limit_hit('test:k', 60, 2), true, 'rate_limit_hit: 1st hit allowed');
SELECT tests.is(public.rate_limit_hit('test:k', 60, 2), true, 'rate_limit_hit: 2nd hit allowed');
SELECT tests.is(public.rate_limit_hit('test:k', 60, 2), false, 'rate_limit_hit: 3rd hit blocked');
SELECT tests.is(public.rate_limit_hit('test:other', 60, 2), true, 'rate_limit_hit: keys are independent');
UPDATE public.rate_limits SET window_start = now() - interval '61 seconds' WHERE key = 'test:k';
SELECT tests.is(public.rate_limit_hit('test:k', 60, 2), true, 'rate_limit_hit: window expiry resets the count');
SELECT tests.throws($q$SELECT public.rate_limit_hit('k', 0, 1)$q$, 'invalid rate limit', 'rate_limit_hit: bad window rejected');
SELECT tests.throws($q$SELECT public.rate_limit_hit(repeat('k', 201), 60, 1)$q$, 'invalid rate limit', 'rate_limit_hit: oversized key rejected');

-- Account deletion, in the same order as app/api/auth/delete/route.ts (Eve: has
-- a request, offers, a PIN, a notification and a proof file).
DELETE FROM public.donations WHERE request_id IN (SELECT id FROM public.blood_requests WHERE user_id = '33333333-3333-4333-8333-333333333333');
DELETE FROM public.request_contacts WHERE request_id IN (SELECT id FROM public.blood_requests WHERE user_id = '33333333-3333-4333-8333-333333333333');
DELETE FROM public.blood_requests WHERE user_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.donations WHERE donor_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.push_subscriptions WHERE user_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.notifications WHERE user_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.donor_secrets WHERE user_id = '33333333-3333-4333-8333-333333333333';
DELETE FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333';
DELETE FROM auth.users WHERE id = '33333333-3333-4333-8333-333333333333';
SELECT tests.is(tests.rows($q$
  SELECT 1 FROM public.profiles WHERE id = '33333333-3333-4333-8333-333333333333'
  UNION ALL SELECT 1 FROM public.donations WHERE donor_id = '33333333-3333-4333-8333-333333333333'
  UNION ALL SELECT 1 FROM public.blood_requests WHERE user_id = '33333333-3333-4333-8333-333333333333'
  UNION ALL SELECT 1 FROM public.donor_secrets WHERE user_id = '33333333-3333-4333-8333-333333333333'
  UNION ALL SELECT 1 FROM public.notifications WHERE user_id = '33333333-3333-4333-8333-333333333333'
  UNION ALL SELECT 1 FROM auth.users WHERE id = '33333333-3333-4333-8333-333333333333'$q$), 0::bigint,
  'account deletion: no rows left for the deleted user');
SELECT tests.is(tests.val($q$SELECT status FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000001'$q$), 'fulfilled',
  'account deletion: other users'' requests untouched');

-- =========================================================================
-- 8. Catalog-wide guards (catch regressions in future migrations)
-- =========================================================================
SELECT tests.login('postgres');

SELECT tests.is(tests.val($q$SELECT string_agg(relname, ', ') FROM pg_class
  WHERE relnamespace = 'public'::regnamespace AND relkind IN ('r', 'p') AND NOT relrowsecurity$q$), NULL,
  'catalog: every public table has RLS enabled');
SELECT tests.is(tests.val($q$SELECT string_agg(c.relname || ':' || p.priv, ', ') FROM pg_class c
  CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']) AS p(priv)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v', 'm')
    AND has_table_privilege('anon', c.oid, p.priv)$q$), NULL,
  'catalog: anon has no write privilege on any public table or view');
SELECT tests.is(tests.val($q$SELECT string_agg(c.relname, ', ') FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
    AND has_table_privilege('authenticated', c.oid, 'TRUNCATE')$q$), NULL,
  'catalog: authenticated cannot TRUNCATE any public table');
SELECT tests.is(tests.val($q$SELECT string_agg(c.relname || ':' || p.priv, ', ') FROM pg_class c
  CROSS JOIN unnest(ARRAY['INSERT', 'UPDATE', 'DELETE']) AS p(priv)
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('v', 'm')
    AND has_table_privilege('authenticated', c.oid, p.priv)$q$), NULL,
  'catalog: authenticated cannot write through any public view');
SELECT tests.is(tests.val($q$SELECT string_agg(p.oid::regprocedure::text, ', ') FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
    AND has_function_privilege('anon', p.oid, 'EXECUTE')
    AND p.proname NOT IN ('public_donor_card', 'public_donor_activity', 'public_stats')$q$), NULL,
  'catalog: anon can execute only the allow-listed SECURITY DEFINER functions');
SELECT tests.is(tests.val($q$SELECT string_agg(p.oid::regprocedure::text, ', ') FROM pg_proc p
  WHERE p.pronamespace = 'public'::regnamespace AND p.prokind = 'f'
    AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')$q$), NULL,
  'catalog: every public function pins search_path');
SELECT tests.is(tests.val($q$SELECT string_agg(tablename || '.' || policyname, ', ') FROM pg_policies
  WHERE schemaname = 'public' AND cmd <> 'SELECT' AND (roles && ARRAY['anon', 'public']::name[])$q$), NULL,
  'catalog: no public-schema write policy applies to anon/public');
SELECT tests.is(tests.val($q$SELECT string_agg(tablename || '.' || policyname, ', ') FROM pg_policies
  WHERE schemaname = 'public' AND cmd = 'SELECT' AND (roles && ARRAY['anon', 'public']::name[])
    AND NOT (tablename = 'blood_requests' AND policyname = 'Anyone reads open requests')$q$), NULL,
  'catalog: only "Anyone reads open requests" is readable by anon');
SELECT tests.is(tests.val($q$SELECT string_agg(policyname, ', ') FROM pg_policies
  WHERE schemaname = 'storage' AND tablename = 'objects' AND (roles && ARRAY['anon', 'public']::name[])$q$), NULL,
  'catalog: no storage.objects policy applies to anon/public');
SELECT tests.is(tests.val($q$SELECT count(*)::text FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'blood_requests' AND column_name = 'contact_phone'$q$), '0',
  'catalog: blood_requests.contact_phone is gone');
SELECT tests.is(tests.val($q$SELECT count(*)::text FROM public.profiles WHERE donor_pin IS NOT NULL$q$), '0',
  'catalog: no PINs left in profiles.donor_pin');

-- =========================================================================
-- 9. Consent enforcement (20261008000400)
-- =========================================================================
SELECT tests.login('postgres');
INSERT INTO tests.users (name, id) VALUES
  ('fresh',  '77777777-7777-4777-8777-777777777777'),
  ('legacy', '88888888-8888-4888-8888-888888888888');
INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES
  ('77777777-7777-4777-8777-777777777777', 'fresh@example.com',  '{"full_name":"Finn Fresh"}'),
  ('88888888-8888-4888-8888-888888888888', 'legacy@example.com', '{"full_name":"Lee Legacy"}');
-- A donor from before consent was recorded (bypass the trigger to recreate legacy data).
ALTER TABLE public.profiles DISABLE TRIGGER enforce_donor_consent;
UPDATE public.profiles SET is_donor = true, is_available = true, blood_group = 'AB+'
WHERE id = '88888888-8888-4888-8888-888888888888';
ALTER TABLE public.profiles ENABLE TRIGGER enforce_donor_consent;

-- Becoming a donor
SELECT tests.login('fresh');
SELECT tests.throws($q$UPDATE public.profiles SET is_donor = true WHERE id = auth.uid()$q$,
  '23514.*donor', 'consent: cannot become a donor without consent');
SELECT tests.throws($q$UPDATE public.profiles SET is_donor = true, consent_agreed = false, consent_at = now(), consent_version = '2026-10-06' WHERE id = auth.uid()$q$,
  '23514', 'consent: consent_agreed = false does not count');
SELECT tests.throws($q$UPDATE public.profiles SET is_donor = true, consent_agreed = true, consent_at = now(), consent_version = '' WHERE id = auth.uid()$q$,
  '23514', 'consent: blank consent_version does not count');
SELECT tests.throws($q$INSERT INTO public.profiles (id, email, is_donor) VALUES (auth.uid(), 'fresh@example.com', true)
  ON CONFLICT (id) DO UPDATE SET is_donor = EXCLUDED.is_donor$q$,
  '23514', 'consent: upsert as donor without consent is rejected');
SELECT tests.allowed($q$UPDATE public.profiles SET is_donor = true, consent_agreed = true, consent_at = now(), consent_version = '2026-10-06' WHERE id = auth.uid()$q$, 1,
  'consent: can become a donor with consent in the same write');

-- Posting a request
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$,
  '23514.*request', 'consent: cannot post a request without consent');
SELECT tests.login('service');
SELECT tests.throws($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES ('77777777-7777-4777-8777-777777777777', 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$,
  '23514', 'consent: service role cannot post for an un-consented user either');
SELECT tests.login('fresh');
UPDATE public.profiles SET consent_agreed = true, consent_at = now(), consent_version = '2026-10-06' WHERE id = auth.uid();
SELECT tests.allowed($q$INSERT INTO public.blood_requests (user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level, contact_name, location)
  VALUES (auth.uid(), 'A+', 1, 'x', 'x', 'Low', 'x', '{}')$q$, 1,
  'consent: can post a request once consent is recorded');

-- Existing donors
SELECT tests.login('legacy');
SELECT tests.allowed($q$UPDATE public.profiles SET full_name = 'Lee L', is_available = false WHERE id = auth.uid()$q$, 1,
  'consent: legacy donor without consent can still edit their profile');
SELECT tests.is(tests.val($q$SELECT is_donor::text FROM public.profiles WHERE id = auth.uid()$q$), 'true',
  'consent: legacy donor row is untouched');
SELECT tests.allowed($q$UPDATE public.profiles SET is_donor = true, consent_agreed = true, consent_at = now(), consent_version = '2026-10-06' WHERE id = auth.uid()$q$, 1,
  'consent: legacy donor can re-consent');
SELECT tests.login('donor');
SELECT tests.throws($q$UPDATE public.profiles SET consent_at = NULL WHERE id = auth.uid()$q$,
  '23514', 'consent: a consented donor cannot clear their consent while staying a donor');
SELECT tests.allowed($q$UPDATE public.profiles SET is_donor = false, consent_at = NULL WHERE id = auth.uid()$q$, 1,
  'consent: a donor can step down');
SELECT tests.login('admin');
SELECT tests.throws($q$UPDATE public.profiles SET is_donor = true WHERE id = '44444444-4444-4444-8444-444444444444'$q$,
  '23514', 'consent: admin cannot mark an un-consented user as a donor');

-- Auth hook: Before User Created
SELECT tests.login('postgres');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "a@example.com", "app_metadata": {"provider": "email"}, "user_metadata": {"registration_completed": false}}}')->'error'->>'http_code'$q$),
  '400', 'hook: rejects email sign-up without consent');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "a@example.com", "app_metadata": {"provider": "email"}, "user_metadata": null}}') ? 'error'$q$),
  'true', 'hook: rejects email sign-up with null metadata');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "a@example.com", "app_metadata": {"provider": "email"}, "user_metadata": {"consent_agreed": false, "consent_version": "2026-10-06"}}}') ? 'error'$q$),
  'true', 'hook: rejects consent_agreed = false');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "a@example.com", "app_metadata": {"provider": "email"}, "user_metadata": {"consent_agreed": true, "consent_at": "2026-10-07T00:00:00Z", "consent_version": "2026-10-06"}}}')::text$q$),
  '{}', 'hook: allows consented email sign-up');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "a@example.com", "raw_app_meta_data": {"provider": "email"}, "raw_user_meta_data": {"consent_agreed": "true", "consent_version": "2026-10-06"}}}')::text$q$),
  '{}', 'hook: also reads raw_*_meta_data');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "g@example.com", "app_metadata": {"provider": "google", "providers": ["google"]}, "user_metadata": {"full_name": "G"}}}')::text$q$),
  '{}', 'hook: allows Google sign-up (consent taken in complete-registration)');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created(
  '{"user": {"email": "g@example.com", "identities": [{"provider": "google"}], "user_metadata": {}}}')::text$q$),
  '{}', 'hook: falls back to the identity provider');
SELECT tests.is(tests.val($q$SELECT public.hook_before_user_created('{"user": {"email": "x@example.com"}}') ? 'error'$q$),
  'true', 'hook: unknown provider is treated as email (strict)');
SELECT tests.is(tests.val($q$SELECT has_function_privilege('anon', 'public.hook_before_user_created(jsonb)', 'EXECUTE')
  OR has_function_privilege('authenticated', 'public.hook_before_user_created(jsonb)', 'EXECUTE')
  OR has_function_privilege('service_role', 'public.hook_before_user_created(jsonb)', 'EXECUTE')$q$),
  'false', 'hook: not executable by anon / authenticated / service_role');

-- ---------------------------------------------------------------------------
-- 10. Donor coordinates (20261008000500_location_placeholders)
-- ---------------------------------------------------------------------------
SELECT tests.login('postgres');
SELECT tests.is(public.location_in_india('{"latitude": 0, "longitude": 0}'), false,
  'location: (0,0) placeholder is not a usable location');
SELECT tests.is(public.location_in_india('{"latitude": 51.5, "longitude": -0.12}'), false,
  'location: coordinates outside India are rejected');
SELECT tests.is(public.location_in_india('{"latitude": 9.981, "longitude": 76.299}'), true,
  'location: a point in India is accepted');
SELECT tests.is(public.approx_location('{"latitude": 0, "longitude": 0}'), NULL::jsonb,
  'location: approx_location hides the (0,0) placeholder');
SELECT tests.is(public.approx_location('{"latitude": 9.981, "longitude": 76.299}'),
  '{"latitude": 9.98, "longitude": 76.30}'::jsonb, 'location: approx_location rounds to ~1 km');

SELECT tests.login('donor');
SELECT tests.is(tests.affected($q$UPDATE public.profiles SET location = '{"latitude": 9.981, "longitude": 76.299, "source": "pin"}' WHERE id = auth.uid()$q$),
  1, 'location: a donor can set their own location');
SELECT tests.is(tests.affected(format($q$UPDATE public.profiles SET location = '{"latitude": 9.9, "longitude": 76.2}' WHERE id = %L$q$, tests.uid('requester'))),
  0, 'location: a donor cannot set someone else''s location');
SELECT tests.login('postgres');

-- ---------------------------------------------------------------------------
-- 11. Expired requests (20261008000600)
-- ---------------------------------------------------------------------------
SELECT tests.login('requester');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000004'$q$), 1::bigint,
  'expired: the owner still sees their expired request');
SELECT tests.login('unrelated');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.blood_requests WHERE id = 'aaaaaaaa-0000-4000-8000-000000000004'$q$), 0::bigint,
  'expired: other signed-in users do not see it');
SELECT tests.denied($q$INSERT INTO public.donations (request_id, donor_id, status) VALUES ('aaaaaaaa-0000-4000-8000-000000000004', auth.uid(), 'pending')$q$,
  'expired: cannot offer on an expired request');
SELECT tests.login('postgres');

\o
