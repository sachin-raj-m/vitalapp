-- Per-offer PIN tests (20261017000600). Run via scripts/test-rls.sh.
--
-- Everything runs in one transaction and is rolled back, so nothing here
-- reaches rls.test.sql.
--
-- Seed: R1 (requester Riya, A+, 2 units, active); D1 = donor Dev's pending
-- offer on R1 (PIN fixed to 4719 by the seed); Eve ("unrelated") has a lifetime
-- PIN 1234 in donor_secrets and a cancelled offer D3 on R1.

\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
\o /dev/null

BEGIN;

-- 1. A new offer gets its own random 4-digit PIN -----------------------------
SELECT tests.login('unrelated');
INSERT INTO public.donations (id, request_id, donor_id, status)
VALUES ('dddddddd-0000-4000-8000-0000000000a1', 'aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'pending');

SELECT tests.ok(tests.val($q$SELECT pin FROM public.donation_pins WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a1'$q$) ~ '^[0-9]{4}$',
  'offer pin: a new web offer gets a 4-digit PIN');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donation_pins$q$), 2::bigint,
  'offer pin: the donor sees only their own offers'' PINs (this one and the withdrawn D3)');
SELECT tests.denied($q$UPDATE public.donation_pins SET pin = '0000' WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a1'$q$,
  'offer pin: the donor cannot change it');
SELECT tests.denied($q$INSERT INTO public.donation_pins (donation_id, pin) VALUES ('dddddddd-0000-4000-8000-000000000001', '0000')$q$,
  'offer pin: nobody can write one');
SELECT tests.denied($q$DELETE FROM public.donation_pins$q$, 'offer pin: nobody can delete one');

SELECT tests.login('donor');
SELECT tests.is(tests.val($q$SELECT pin FROM public.donation_pins WHERE donation_id = 'dddddddd-0000-4000-8000-000000000001'$q$), '4719',
  'offer pin: Dev reads the PIN of his own offer');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donation_pins WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a1'$q$), 0::bigint,
  'offer pin: another donor cannot read it');

SELECT tests.login('requester');
SELECT tests.is(tests.rows($q$SELECT 1 FROM public.donation_pins$q$), 0::bigint,
  'offer pin: the requester cannot read any PIN');

SELECT tests.login('anon');
SELECT tests.denied($q$SELECT * FROM public.donation_pins$q$, 'offer pin: anon cannot read PINs');
SELECT tests.throws($q$SELECT public.new_offer_pin()$q$, '42501', 'offer pin: anon cannot call new_offer_pin()');

-- 2. Only this offer's PIN confirms it ---------------------------------------
SELECT tests.login('postgres');
-- Make sure the random PIN differs from Eve's old lifetime PIN for the check below.
UPDATE public.donation_pins SET pin = '8642' WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a1';

SELECT tests.login('requester');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-0000000000a1', '1234', 1)->>'error', 'pin_mismatch',
  'offer pin: the donor''s old lifetime PIN no longer works');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-0000000000a1', '4719', 1)->>'error', 'pin_mismatch',
  'offer pin: another offer''s PIN does not work');
SELECT tests.is(public.verify_donation('dddddddd-0000-4000-8000-0000000000a1', '8642', 1)->>'total_collected', '1',
  'offer pin: the offer''s own PIN confirms it');

-- 3. A new offer after withdrawing gets a different PIN ----------------------
SELECT tests.login('donor');
UPDATE public.donations SET status = 'cancelled' WHERE id = 'dddddddd-0000-4000-8000-000000000001';
INSERT INTO public.donations (id, request_id, donor_id, status)
VALUES ('dddddddd-0000-4000-8000-0000000000a2', 'aaaaaaaa-0000-4000-8000-000000000001', auth.uid(), 'pending');
SELECT tests.ok(tests.val($q$SELECT pin FROM public.donation_pins WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a2'$q$) ~ '^[0-9]{4}$',
  'offer pin: offering again creates a fresh PIN');

-- 4. WhatsApp offers get one too, and no lifetime PIN is created -------------
SELECT tests.login('postgres');
DELETE FROM public.donor_secrets WHERE user_id = '22222222-2222-4222-8222-222222222222';
INSERT INTO public.blood_requests
  (id, user_id, blood_group, units_needed, hospital_name, hospital_address, urgency_level,
   contact_name, location, status, city, date_needed)
VALUES ('aaaaaaaa-0000-4000-8000-0000000000a5', '11111111-1111-4111-8111-111111111111', 'O-', 1,
   'Testville East', '5 Example Road', 'High', 'Riya', '{"latitude": 9.98, "longitude": 76.28}',
   'active', 'Testville', current_date + 2);

SELECT tests.login('service');
CREATE TEMP TABLE wa_offer AS
  SELECT public.create_offer_for('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-0000000000a5') AS id;
SELECT tests.ok((SELECT pin FROM public.donation_pins WHERE donation_id = (SELECT id FROM wa_offer)) ~ '^[0-9]{4}$',
  'offer pin: a WhatsApp offer gets a PIN');
SELECT tests.is((SELECT count(*) FROM public.donor_secrets WHERE user_id = '22222222-2222-4222-8222-222222222222'), 0::bigint,
  'offer pin: create_offer_for no longer creates a lifetime PIN');
SELECT tests.is(public.create_offer_for('22222222-2222-4222-8222-222222222222', 'aaaaaaaa-0000-4000-8000-0000000000a5'),
  (SELECT id FROM wa_offer), 'offer pin: offering twice returns the same offer (and keeps its PIN)');
SELECT tests.is((SELECT count(*) FROM public.donation_pins WHERE donation_id = (SELECT id FROM wa_offer)), 1::bigint,
  'offer pin: still one PIN for that offer');

-- 5. Deleting an offer deletes its PIN ---------------------------------------
SELECT tests.login('postgres');
DELETE FROM public.donations WHERE id = 'dddddddd-0000-4000-8000-0000000000a2';
SELECT tests.is((SELECT count(*) FROM public.donation_pins WHERE donation_id = 'dddddddd-0000-4000-8000-0000000000a2'), 0::bigint,
  'offer pin: removed with its offer');

ROLLBACK;

\o
