-- Units integrity for donation confirmation.
--
-- Problem: verify_donation() accepted any 1–20 units regardless of how many the
-- request still needed, so a request for 1 unit could end up "5 of 1 units".
--
-- Rule chosen: REJECT (not silently cap) a confirmation whose units exceed the
-- remaining need, and reject any confirmation once the request already has
-- enough units. Rationale: the requester is attesting a real-world quantity
-- together with the donor's PIN; silently storing a different number than the
-- one they confirmed would make the record disagree with what was entered.
-- An explicit error ("Only N more unit(s) needed") lets them correct it, and
-- the UI stepper already limits input to the remaining need, so normal use
-- never hits the error. Auto-fulfilment is unchanged (sum >= units_needed).
--
-- NULL handling: units_donated is nullable (default 0). Everywhere here a NULL
-- counts as 0 via coalesce(), matching the previous total computation.
--
-- Idempotent: CREATE OR REPLACE with the same signature; grants re-applied.

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
BEGIN
  SELECT * INTO v_donation FROM public.donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found' USING ERRCODE = 'P0002'; END IF;

  -- Row lock on the request serialises concurrent confirmations for it, so the
  -- remaining-need check below cannot be raced.
  SELECT * INTO v_request FROM public.blood_requests WHERE id = v_donation.request_id FOR UPDATE;
  IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who posted this request can confirm donations' USING ERRCODE = '42501';
  END IF;
  IF v_donation.status <> 'pending' THEN
    RAISE EXCEPTION 'This offer is no longer pending' USING ERRCODE = '22023';
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
  IF v_pin IS NULL OR v_pin <> p_pin THEN
    RAISE EXCEPTION 'PIN does not match' USING ERRCODE = '28000';
  END IF;

  UPDATE public.donations SET status = 'completed', units_donated = p_units WHERE id = p_donation_id;

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

-- ---------------------------------------------------------------------------
-- OPTIONAL, OPT-IN historical clean-up (NOT run by this migration).
--
-- As of 2026-10-07 production has 2 requests (both already 'fulfilled', each
-- with a single completed donation) whose recorded units exceed units_needed
-- (2 of 1 and 5 of 1). These came from the pre-lockdown client-side flow.
-- No completed donation has NULL/0 units.
--
-- The over-count may reflect what was actually donated, so it is left as-is;
-- the UI now shows such cases as "N units recorded (M requested)". If the team
-- decides the recorded units should be trimmed to the request size instead,
-- run the block below manually (service role / SQL editor). It only trims
-- the most recent completed donations of over-collected requests so the total
-- equals units_needed, never touches requests that are not over-collected, and
-- never sets a donation below 0.
--
-- WITH ranked AS (
--   SELECT d.id,
--          coalesce(d.units_donated, 0) AS units,
--          r.units_needed,
--          sum(coalesce(d.units_donated, 0)) OVER (
--            PARTITION BY d.request_id ORDER BY d.created_at, d.id
--            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS before_units
--   FROM public.donations d
--   JOIN public.blood_requests r ON r.id = d.request_id
--   WHERE d.status = 'completed'
-- )
-- UPDATE public.donations d
-- SET units_donated = greatest(0, least(x.units, x.units_needed - coalesce(x.before_units, 0)))
-- FROM ranked x
-- WHERE d.id = x.id
--   AND coalesce(x.before_units, 0) + x.units > x.units_needed;
-- ---------------------------------------------------------------------------
