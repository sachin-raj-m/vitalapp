/*
  # A new PIN for every offer

  Until now each donor had one PIN for life (donor_secrets), reused on every
  offer. Now every offer gets its own random 4-digit PIN when it is created:

  1. donation_pins holds one PIN per offer. Only that offer's donor can read
     it; nobody can write it (the database creates it).
  2. A trigger creates the PIN for every new offer, from the web or WhatsApp,
     with a cryptographically random number (pgcrypto).
  3. verify_donation_for() checks the PIN of the offer being confirmed, so a
     PIN from an earlier offer never works again.
  4. create_offer_for() no longer creates a lifetime PIN.
  5. Offers still pending keep working: they get the donor's old PIN if they
     had one (that's what the donor may already have handed over), otherwise a
     new random one.

  donor_secrets is no longer used by the app; it stays for now so a rollback
  is possible, and can be dropped later.
*/

CREATE TABLE IF NOT EXISTS public.donation_pins (
  donation_id uuid PRIMARY KEY REFERENCES public.donations(id) ON DELETE CASCADE,
  pin text NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donation_pins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.donation_pins FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.donation_pins TO authenticated;
GRANT ALL ON public.donation_pins TO service_role;

DROP POLICY IF EXISTS "Donor reads own offer PIN" ON public.donation_pins;
CREATE POLICY "Donor reads own offer PIN" ON public.donation_pins
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.donations d
    WHERE d.id = donation_id AND d.donor_id = (SELECT auth.uid())
  ));

-- A random 4-digit PIN. 65536 values folded onto 10000: the bias is far
-- below anything the 5-attempt lock lets anyone exploit.
CREATE OR REPLACE FUNCTION public.new_offer_pin()
RETURNS text LANGUAGE sql VOLATILE SET search_path = public, extensions AS $$
  SELECT lpad(((('x' || encode(extensions.gen_random_bytes(2), 'hex'))::bit(16)::int) % 10000)::text, 4, '0');
$$;
REVOKE ALL ON FUNCTION public.new_offer_pin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_offer_pin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.donation_pins (donation_id, pin)
  VALUES (NEW.id, public.new_offer_pin())
  ON CONFLICT (donation_id) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.create_offer_pin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS donations_create_pin ON public.donations;
CREATE TRIGGER donations_create_pin
  AFTER INSERT ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.create_offer_pin();

-- Offers already waiting: keep the PIN the donor may have handed over.
INSERT INTO public.donation_pins (donation_id, pin)
SELECT d.id, coalesce(s.pin, public.new_offer_pin())
FROM public.donations d
LEFT JOIN public.donor_secrets s ON s.user_id = d.donor_id AND s.pin ~ '^[0-9]{4}$'
WHERE d.status = 'pending'
ON CONFLICT (donation_id) DO NOTHING;

-- As in 20261009000200, without the lifetime PIN (the trigger makes the offer's).
CREATE OR REPLACE FUNCTION public.create_offer_for(p_donor uuid, p_request uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me public.profiles%ROWTYPE;
  v_owner uuid;
  v_id uuid;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE id = p_donor;
  IF NOT FOUND OR NOT coalesce(v_me.is_donor, false) THEN
    RAISE EXCEPTION 'Only registered donors can offer' USING ERRCODE = '42501';
  END IF;
  IF NOT public.consent_is_recorded(v_me.consent_agreed, v_me.consent_at, v_me.consent_version) THEN
    RAISE EXCEPTION 'Agree to the Terms and Privacy notice on vitalapp.in first' USING ERRCODE = '42501';
  END IF;
  IF NOT public.request_is_open(p_request) THEN
    RAISE EXCEPTION 'This request is no longer open' USING ERRCODE = '22023';
  END IF;
  SELECT user_id INTO v_owner FROM public.blood_requests WHERE id = p_request;
  IF v_owner = p_donor THEN
    RAISE EXCEPTION 'You cannot offer on your own request' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_id FROM public.donations
  WHERE request_id = p_request AND donor_id = p_donor AND status <> 'cancelled'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NULL THEN
    INSERT INTO public.donations (request_id, donor_id, status, units_donated, source)
    VALUES (p_request, p_donor, 'pending', 0, 'whatsapp')
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END $$;

-- As in 20261009000200, checking the offer's own PIN.
CREATE OR REPLACE FUNCTION public.verify_donation_for(p_actor uuid, p_donation_id uuid, p_pin text, p_units integer)
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
  IF p_actor IS NULL OR v_request.user_id IS DISTINCT FROM p_actor THEN
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

  SELECT pin INTO v_pin FROM public.donation_pins WHERE donation_id = v_donation.id;
  IF v_pin IS NULL THEN
    RAISE EXCEPTION 'This offer has no PIN. Ask the donor to withdraw and offer again.' USING ERRCODE = '28000';
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

REVOKE ALL ON FUNCTION public.create_offer_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_donation_for(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_offer_for(uuid, uuid), public.verify_donation_for(uuid, uuid, text, integer) TO service_role;
