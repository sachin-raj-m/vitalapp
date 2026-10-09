/*
  # WhatsApp alerts and replies

  Donor alerts, "I can donate" replies, follow-ups and PIN confirmation over the
  WhatsApp Cloud API. The app talks to WhatsApp from server routes using the
  service role; nothing here is reachable by anon or signed-in users except the
  profile opt-in column and the per-request updates flag, which owners set.

  Phone numbers are never sent in WhatsApp messages. Contacts are shown only on
  vitalapp.in, behind a short-lived link (contact_links) or a normal sign-in.

  1. profiles.whatsapp_alerts (+ when it last changed). Ticked by default on
     the registration form; turned off in Settings or by replying STOP.
  2. request_contacts.whatsapp_updates: the requester agreed to updates (offer
     received, "did they donate?") on the request's contact number.
  3. donations.source / followup_sent_at / followup_count.
  4. whatsapp_messages: outbound log (delivery status, who was alerted for a
     request) and inbound de-duplication (Meta retries webhooks).
  5. whatsapp_sessions: what Vital is waiting for from a number (e.g. a PIN).
  6. contact_links: hashed one-time tokens for the contact page.
  7. Service-role functions: wa_number(), profile_for_wa(), create_offer_for(),
     verify_donation_for(). verify_donation() now delegates to
     verify_donation_for(auth.uid(), ...) so the web and WhatsApp share one PIN
     check, attempt counter and lock.
*/

-- 1. Opt-in on the donor's profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_alerts boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_alerts_changed_at timestamptz;

-- Stamp when the choice changes, so there's a record of opt-in and opt-out.
CREATE OR REPLACE FUNCTION public.stamp_whatsapp_alerts()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.whatsapp_alerts IS DISTINCT FROM OLD.whatsapp_alerts THEN
    NEW.whatsapp_alerts_changed_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.stamp_whatsapp_alerts() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS stamp_whatsapp_alerts ON public.profiles;
CREATE TRIGGER stamp_whatsapp_alerts
  BEFORE INSERT OR UPDATE OF whatsapp_alerts ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.stamp_whatsapp_alerts();

-- 2. Requester updates for one request.
ALTER TABLE public.request_contacts
  ADD COLUMN IF NOT EXISTS whatsapp_updates boolean NOT NULL DEFAULT false;

-- 3. Offer bookkeeping.
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'whatsapp')),
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS followup_count integer NOT NULL DEFAULT 0;
-- Server-owned: an API caller (auth.uid() set) can't choose them, e.g. to
-- silence follow-ups. Column REVOKEs wouldn't work here because the table-level
-- grants already cover every column.
CREATE OR REPLACE FUNCTION public.protect_donation_server_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF; -- service role / SQL
  IF TG_OP = 'INSERT' THEN
    NEW.source := 'web';
    NEW.followup_sent_at := NULL;
    NEW.followup_count := 0;
  ELSE
    NEW.source := OLD.source;
    NEW.followup_sent_at := OLD.followup_sent_at;
    NEW.followup_count := OLD.followup_count;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_donation_server_columns() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS protect_donation_server_columns ON public.donations;
CREATE TRIGGER protect_donation_server_columns
  BEFORE INSERT OR UPDATE ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.protect_donation_server_columns();

-- 4. Message log.
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('out', 'in')),
  wa_message_id text UNIQUE,
  wa_number text NOT NULL,
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donation_id uuid REFERENCES public.donations(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_request_kind_idx ON public.whatsapp_messages (request_id, kind);
CREATE INDEX IF NOT EXISTS whatsapp_messages_number_idx ON public.whatsapp_messages (wa_number, created_at);

-- 5. Conversation state, one row per number.
CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  wa_number text PRIMARY KEY,
  awaiting text NOT NULL CHECK (awaiting IN ('pin', 'self_check')),
  donation_id uuid REFERENCES public.donations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. One-time contact links. Only the SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS public.contact_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  donation_id uuid NOT NULL REFERENCES public.donations(id) ON DELETE CASCADE,
  viewer text NOT NULL CHECK (viewer IN ('donor', 'requester')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revealed_at timestamptz
);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_messages, public.whatsapp_sessions, public.contact_links FROM anon, authenticated;

-- 7a. "9876543210", "+91 98765 43210", "098765 43210" -> "919876543210".
-- NULL for anything that isn't an Indian mobile number.
CREATE OR REPLACE FUNCTION public.wa_number(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN d ~ '^[6-9][0-9]{9}$' THEN '91' || d
    WHEN d ~ '^0[6-9][0-9]{9}$' THEN '91' || right(d, 10)
    WHEN d ~ '^91[6-9][0-9]{9}$' THEN d
    ELSE NULL END
  FROM (SELECT regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') AS d) x;
$$;

-- 7b. The profile behind a WhatsApp number (an opted-in one first, then the
-- newest, if several profiles share a number).
CREATE OR REPLACE FUNCTION public.profile_for_wa(p_wa text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles
  WHERE public.wa_number(phone) = public.wa_number(p_wa)
  ORDER BY whatsapp_alerts DESC, created_at DESC NULLS LAST
  LIMIT 1;
$$;

-- 7b2. Requests whose contact number is p_wa and that asked for WhatsApp updates.
CREATE OR REPLACE FUNCTION public.requests_for_contact_wa(p_wa text)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT request_id FROM public.request_contacts
  WHERE whatsapp_updates AND public.wa_number(contact_phone) = public.wa_number(p_wa);
$$;

-- 7c. A pending offer from p_donor on p_request, made from WhatsApp. Same rules
-- as the web: a donor with consent, an open request, not their own. Returns the
-- existing offer if there is one. Creates a 4-digit PIN for donors who never
-- set one (it is shown to them on the contact page).
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

  INSERT INTO public.donor_secrets (user_id, pin)
  VALUES (p_donor, lpad((floor(random() * 10000))::int::text, 4, '0'))
  ON CONFLICT (user_id) DO NOTHING;

  RETURN v_id;
END $$;

-- 7d. One PIN check for web and WhatsApp. Same body as 20261008000300 with the
-- caller passed in.
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

CREATE OR REPLACE FUNCTION public.verify_donation(p_donation_id uuid, p_pin text, p_units integer)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT public.verify_donation_for(auth.uid(), p_donation_id, p_pin, p_units);
$$;

REVOKE ALL ON FUNCTION public.wa_number(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.profile_for_wa(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.requests_for_contact_wa(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_offer_for(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_donation_for(uuid, uuid, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_number(text), public.profile_for_wa(text), public.requests_for_contact_wa(text),
  public.create_offer_for(uuid, uuid), public.verify_donation_for(uuid, uuid, text, integer) TO service_role;
REVOKE ALL ON FUNCTION public.verify_donation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verify_donation(uuid, text, integer) TO authenticated;
