/*
  # PIN check hardening + non-donor default for new accounts

  1. verify_donation accepted a NULL PIN: `v_pin <> NULL` is NULL, so the
     mismatch branch never ran and the request owner could complete any offer
     on their own request without the donor's PIN. Now NULL/blank PINs are
     rejected and the comparison is NULL-safe.

  2. A 4-digit PIN could be brute-forced by the request owner (10,000 tries,
     no limit). Failed attempts are now counted per offer and the offer locks
     after 5. A wrong PIN returns {"error": "pin_mismatch", "attempts_left": n}
     instead of raising, because raising would roll back the attempt counter.

  3. handle_new_user() created every new account as a donor (is_donor = true),
     including people who only post a request. Registration
     (complete-registration) sets is_donor explicitly, so new accounts now
     start as non-donors.

  Keeps the units rules from 20261008000200 unchanged.
*/

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS pin_failed_attempts integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.verify_donation(p_donation_id uuid, p_pin text, p_units integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_donation public.donations%ROWTYPE;
  v_request public.blood_requests%ROWTYPE;
  v_pin text;
  v_collected integer;
  v_remaining integer;
  v_total integer;
  v_max_attempts constant integer := 5;
BEGIN
  SELECT * INTO v_donation FROM public.donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found' USING ERRCODE = 'P0002'; END IF;

  -- Row lock on the request serialises concurrent confirmations for it.
  SELECT * INTO v_request FROM public.blood_requests WHERE id = v_donation.request_id FOR UPDATE;
  IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who posted this request can confirm donations' USING ERRCODE = '42501';
  END IF;
  IF v_donation.status <> 'pending' THEN
    RAISE EXCEPTION 'This offer is no longer pending' USING ERRCODE = '22023';
  END IF;
  IF v_donation.pin_failed_attempts >= v_max_attempts THEN
    RAISE EXCEPTION 'Too many incorrect PIN attempts for this offer. Ask the donor to withdraw and offer again.' USING ERRCODE = '28000';
  END IF;
  IF p_units IS NULL OR p_units < 1 OR p_units > 20 THEN
    RAISE EXCEPTION 'Units must be between 1 and 20' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(sum(coalesce(units_donated, 0)), 0) INTO v_collected
  FROM public.donations WHERE request_id = v_request.id AND status = 'completed';
  v_remaining := greatest(coalesce(v_request.units_needed, 0) - v_collected, 0);

  IF v_remaining = 0 THEN
    RAISE EXCEPTION 'This request already has all the units it needs' USING ERRCODE = '22023';
  END IF;
  IF p_units > v_remaining THEN
    RAISE EXCEPTION 'Only % more unit(s) needed for this request', v_remaining USING ERRCODE = '22023';
  END IF;

  SELECT pin INTO v_pin FROM public.donor_secrets WHERE user_id = v_donation.donor_id;
  IF v_pin IS NULL THEN
    RAISE EXCEPTION 'This donor has not set a PIN yet' USING ERRCODE = '28000';
  END IF;

  -- NULL-safe comparison; a NULL or blank PIN never matches.
  IF p_pin IS NULL OR btrim(p_pin) = '' OR v_pin IS DISTINCT FROM btrim(p_pin) THEN
    UPDATE public.donations
      SET pin_failed_attempts = pin_failed_attempts + 1
      WHERE id = p_donation_id;
    RETURN jsonb_build_object(
      'error', 'pin_mismatch',
      'attempts_left', greatest(v_max_attempts - (v_donation.pin_failed_attempts + 1), 0)
    );
  END IF;

  UPDATE public.donations
    SET status = 'completed', units_donated = p_units, pin_failed_attempts = 0
    WHERE id = p_donation_id;

  v_total := v_collected + p_units;

  IF v_total >= v_request.units_needed THEN
    UPDATE public.blood_requests SET status = 'fulfilled', updated_at = now() WHERE id = v_request.id;
  END IF;

  RETURN jsonb_build_object(
    'total_collected', v_total,
    'units_needed', v_request.units_needed,
    'fulfilled', v_total >= v_request.units_needed
  );
END $$;

REVOKE ALL ON FUNCTION public.verify_donation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_donation(uuid, text, integer) TO authenticated;

-- New accounts start as non-donors; complete-registration sets is_donor.
ALTER TABLE public.profiles ALTER COLUMN is_donor SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, is_donor, verification_status)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', false, 'pending')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
