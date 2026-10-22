/*
  # Sign in with a mobile number (codes over WhatsApp), and "verified = email OR mobile"

  An account is now verified when its email is confirmed OR its mobile number
  is verified (lib/verification.ts). Nothing in the database required both;
  admin_insights() gains two counts for the new rule (section 6).

  Phone sign-in uses Supabase phone auth with the "Send SMS" Auth Hook pointed
  at /api/auth/send-sms. There is no SMS: the hook keeps the code (encrypted,
  short-lived) in phone_login_codes, and Vital's WhatsApp bot replies with it
  when the person sends "LOGIN" from that number (or sends it straight away
  when they messaged Vital in the last 24 hours). Only the holder of the
  number can get the code, so a confirmed phone proves the number is theirs.

  1. profiles.email may be NULL: accounts made with a phone number have no
     email. Blank emails are stored as NULL (two '' would collide on the
     case-insensitive unique index). One account per email still holds.

  2. handle_new_user(): as in 20261008000300, plus
     - blank email -> NULL;
     - the consent recorded in the sign-up metadata (register page, guest
       request, phone sign-in all send consent_agreed / consent_at /
       consent_version; the Before User Created hook requires it for email and
       phone sign-ups) is copied onto the profile, so a new requester isn't
       asked to tick the same box twice. consent_at is never in the future.
     The phone is NOT copied here: it is unconfirmed until the code is entered.

  3. Auth phone -> profile (sync_profile_phone_from_auth, on auth.users): when
     Supabase confirms a phone (phone_confirmed_at set), the profile gets that
     number as verified: phone = the 10 digits, phone_verified_at = now(). As
     with confirm_phone_for(), other accounts holding the number unverified
     give it up. If another profile has already verified the number (should
     not happen: its auth account would hold the phone), nothing changes.
     Errors are swallowed with a warning: this must never block a sign-in.

  4. Profile -> auth phone (sync_auth_phone_from_profile, on profiles): when a
     profile's number becomes verified (WhatsApp "VERIFY" in Settings), the
     same number is set as the account's sign-in phone (auth.users.phone,
     phone_confirmed_at), so "Continue with WhatsApp" signs into that same
     account instead of creating a second one. Any other auth account still
     holding that phone loses it (the number was proven by this person now).
     When a profile's verification is removed (the number was changed or
     released), the old sign-in phone is removed too, unless the account has
     no email: then it is kept so the person can still sign in.
     Backfill: profiles verified before this migration get their sign-in phone
     where nobody else holds it.

  5. phone_login_codes: one row per number, written by the hook (service role
     only, RLS on, no policies). code_enc is AES-GCM ciphertext made by the
     server (key derived from SEND_SMS_HOOK_SECRET), never the plain code.

  6. admin_insights(): people.contact_verified (email confirmed OR phone
     verified) and people.contact_unverified (neither). Everything else as in
     20261018000300_district_not_city.sql.

  Idempotent: safe to run twice.
*/

-- 1. Email may be empty -------------------------------------------------------
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;
UPDATE public.profiles SET email = NULL WHERE btrim(email) = '';

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text := nullif(btrim(NEW.email), '');
BEGIN
  UPDATE public.profiles
  SET email = coalesce(v_email, email),
      email_verified_at = NEW.email_confirmed_at
  WHERE id = NEW.id
    AND (email IS DISTINCT FROM coalesce(v_email, email) OR email_verified_at IS DISTINCT FROM NEW.email_confirmed_at);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;

-- 2. New accounts --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m jsonb := CASE WHEN jsonb_typeof(new.raw_user_meta_data) = 'object' THEN new.raw_user_meta_data ELSE '{}'::jsonb END;
  v_consent boolean := lower(coalesce(m->>'consent_agreed', '')) = 'true'
                       AND coalesce(btrim(m->>'consent_version'), '') <> '';
  v_at timestamptz;
BEGIN
  IF v_consent THEN
    BEGIN
      v_at := (m->>'consent_at')::timestamptz;
    EXCEPTION WHEN others THEN
      v_at := NULL;
    END;
    v_at := least(coalesce(v_at, now()), now());
  END IF;

  INSERT INTO public.profiles (id, email, full_name, is_donor, verification_status, consent_agreed, consent_at, consent_version)
  VALUES (
    new.id,
    nullif(btrim(new.email), ''),
    nullif(btrim(m->>'full_name'), ''),
    false,
    'pending',
    v_consent,
    CASE WHEN v_consent THEN v_at END,
    CASE WHEN v_consent THEN left(btrim(m->>'consent_version'), 64) END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Column guard: as in 20261017000100, except a blank sign-in email is NULL.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    NEW.email := nullif(btrim(NEW.email), '');
    RETURN NEW; -- service role, SQL editor, triggers, or an admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.verification_status := 'pending';
    NEW.referral_code := NULL;
    NEW.referred_by := NULL;
    NEW.phone_verified_at := NULL;
    NEW.blood_group_changed_at := NULL;
    NEW.blood_group_previous := NULL;
    NEW.phone_released_at := NULL;
    -- The profile's email is the sign-in email.
    SELECT nullif(btrim(coalesce(nullif(btrim(u.email), ''), NEW.email)), ''), u.email_confirmed_at
      INTO NEW.email, NEW.email_verified_at
    FROM auth.users u WHERE u.id = NEW.id;
    IF NOT FOUND THEN NEW.email_verified_at := NULL; NEW.email := nullif(btrim(NEW.email), ''); END IF;
  ELSE
    NEW.role := OLD.role;
    NEW.verification_status := OLD.verification_status;
    NEW.donor_number := OLD.donor_number;
    NEW.id := OLD.id;
    IF coalesce(current_setting('vital.referral_write', true), '') <> 'on' THEN
      NEW.referral_code := OLD.referral_code;
      NEW.referred_by := OLD.referred_by;
    END IF;
    -- A user-made change to the number means it's no longer verified.
    NEW.phone_verified_at := CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone THEN NULL ELSE OLD.phone_verified_at END;
    -- Entering a number again answers "your number was released".
    NEW.phone_released_at := CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone THEN NULL ELSE OLD.phone_released_at END;
    -- Blood group: first-time set only; changes go through the code-checked API.
    IF OLD.blood_group IS NOT NULL AND NEW.blood_group IS DISTINCT FROM OLD.blood_group THEN
      RAISE EXCEPTION 'Your blood group can only be changed once, from Settings, with a code sent to your email'
        USING ERRCODE = '23514';
    END IF;
    NEW.blood_group_changed_at := OLD.blood_group_changed_at;
    NEW.blood_group_previous := OLD.blood_group_previous;
    -- Email follows the sign-in account (sync_profile_email).
    NEW.email := OLD.email;
    NEW.email_verified_at := OLD.email_verified_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

-- 3. Auth phone -> profile -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_phone_from_auth()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wa text := public.wa_number(NEW.phone);
BEGIN
  IF NEW.phone_confirmed_at IS NULL OR v_wa IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.phone_confirmed_at IS NOT NULL
     AND public.wa_number(OLD.phone) IS NOT DISTINCT FROM v_wa THEN
    RETURN NEW; -- nothing new was confirmed
  END IF;

  BEGIN
    -- Already verified on this profile: nothing to do.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id AND phone_verified_at IS NOT NULL
               AND public.wa_number(phone) = v_wa) THEN
      RETURN NEW;
    END IF;
    -- Someone else proved this number first: leave both alone.
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id <> NEW.id AND phone_verified_at IS NOT NULL
               AND public.wa_number(phone) = v_wa) THEN
      RETURN NEW;
    END IF;

    UPDATE public.profiles
    SET phone = NULL, whatsapp_alerts = false, phone_released_at = now()
    WHERE id <> NEW.id AND phone_verified_at IS NULL AND public.wa_number(phone) = v_wa;
    DELETE FROM public.verification_codes WHERE purpose = 'phone_whatsapp' AND payload->>'wa' = v_wa;

    UPDATE public.profiles
    SET phone = substr(v_wa, 3), phone_verified_at = now(), phone_released_at = NULL
    WHERE id = NEW.id;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'sync_profile_phone_from_auth: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_phone_from_auth() FROM PUBLIC, anon, authenticated;
-- Named to run after on_auth_user_created (which makes the profile row) and
-- sync_profile_email.
DROP TRIGGER IF EXISTS sync_profile_phone ON auth.users;
CREATE TRIGGER sync_profile_phone
  AFTER INSERT OR UPDATE OF phone, phone_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_phone_from_auth();

-- 4. Profile -> auth phone -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_auth_phone_from_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wa text := public.wa_number(NEW.phone);
  v_old text := public.wa_number(OLD.phone);
BEGIN
  BEGIN
    IF NEW.phone_verified_at IS NOT NULL AND v_wa IS NOT NULL
       AND (OLD.phone_verified_at IS NULL OR v_old IS DISTINCT FROM v_wa) THEN
      IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.id AND phone = v_wa AND phone_confirmed_at IS NOT NULL) THEN
        UPDATE auth.users SET phone = NULL, phone_confirmed_at = NULL WHERE phone = v_wa AND id <> NEW.id;
        UPDATE auth.users SET phone = v_wa, phone_confirmed_at = now() WHERE id = NEW.id;
      END IF;
    ELSIF NEW.phone_verified_at IS NULL AND OLD.phone_verified_at IS NOT NULL AND v_old IS NOT NULL THEN
      -- The verified number was changed or released. Keep it as the sign-in
      -- phone only when the account has no email to sign in with.
      UPDATE auth.users SET phone = NULL, phone_confirmed_at = NULL
      WHERE id = NEW.id AND phone = v_old AND nullif(btrim(email), '') IS NOT NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'sync_auth_phone_from_profile: % (%)', SQLERRM, SQLSTATE;
  END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_auth_phone_from_profile() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS sync_auth_phone ON public.profiles;
CREATE TRIGGER sync_auth_phone
  AFTER UPDATE OF phone, phone_verified_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_auth_phone_from_profile();

-- Backfill: numbers verified before this migration become sign-in phones,
-- where no other sign-in account holds them.
UPDATE auth.users u
SET phone = public.wa_number(p.phone), phone_confirmed_at = coalesce(u.phone_confirmed_at, p.phone_verified_at)
FROM public.profiles p
WHERE p.id = u.id
  AND p.phone_verified_at IS NOT NULL
  AND public.wa_number(p.phone) IS NOT NULL
  AND u.phone IS DISTINCT FROM public.wa_number(p.phone)
  AND nullif(btrim(u.phone), '') IS NULL
  AND NOT EXISTS (SELECT 1 FROM auth.users o WHERE o.id <> u.id AND o.phone = public.wa_number(p.phone));

-- 5. Codes waiting to be fetched on WhatsApp ----------------------------------
CREATE TABLE IF NOT EXISTS public.phone_login_codes (
  wa_number text PRIMARY KEY CHECK (wa_number ~ '^91[6-9][0-9]{9}$'),
  user_id uuid,
  code_enc text NOT NULL,
  expires_at timestamptz NOT NULL,
  delivered_at timestamptz,
  deliveries integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.phone_login_codes IS
  'Sign-in codes from the Send SMS Auth Hook, waiting for the person to send LOGIN on WhatsApp. Encrypted by the server; service role only.';
ALTER TABLE public.phone_login_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_login_codes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_login_codes TO service_role;
CREATE INDEX IF NOT EXISTS phone_login_codes_expires_idx ON public.phone_login_codes (expires_at);

-- 6. admin_insights: as in 20261018000300, plus contact_verified / contact_unverified.
CREATE OR REPLACE FUNCTION public.admin_insights(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 90);
  v_today date := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_people jsonb;
  v_requests jsonb;
  v_offers jsonb;
  v_whatsapp jsonb;
  v_referrals jsonb;
  v_trend jsonb;
  v_attention jsonb;
BEGIN
  IF NOT coalesce(public.is_admin(), false) THEN
    RAISE EXCEPTION 'admin_insights: admins only' USING ERRCODE = '42501';
  END IF;

  -- People ------------------------------------------------------------------
  WITH p AS (
    SELECT pr.*, u.email AS auth_email, u.email_confirmed_at,
           nullif(btrim(pr.district), '') AS district_norm,
           nullif(btrim(pr.state), '') AS state_norm
    FROM public.profiles pr
    LEFT JOIN auth.users u ON u.id = pr.id
  )
  SELECT jsonb_build_object(
    'accounts', (SELECT count(*) FROM p),
    'donors', (SELECT count(*) FROM p WHERE is_donor),
    'available_donors', (SELECT count(*) FROM p WHERE is_donor AND is_available),
    'signups_7d', (SELECT count(*) FROM p WHERE created_at >= now() - interval '7 days'),
    'signups_30d', (SELECT count(*) FROM p WHERE created_at >= now() - interval '30 days'),
    'donors_7d', (SELECT count(*) FROM p WHERE is_donor AND created_at >= now() - interval '7 days'),
    'donors_without_location', (SELECT count(*) FROM p WHERE is_donor AND NOT public.location_in_india(location)),
    'donors_without_blood_group', (SELECT count(*) FROM p WHERE is_donor AND blood_group IS NULL),
    'consent_recorded', (SELECT count(*) FROM p WHERE public.consent_is_recorded(consent_agreed, consent_at, consent_version)),
    'consent_missing', (SELECT count(*) FROM p WHERE NOT public.consent_is_recorded(consent_agreed, consent_at, consent_version)),
    'email_confirmed', (SELECT count(*) FROM p WHERE email_confirmed_at IS NOT NULL),
    'email_unconfirmed', (SELECT count(*) FROM p WHERE email_confirmed_at IS NULL AND coalesce(auth_email, '') <> ''),
    'no_email', (SELECT count(*) FROM p WHERE coalesce(auth_email, '') = ''),
    'phone_verified', (SELECT count(*) FROM p WHERE phone_verified_at IS NOT NULL),
    'phone_unverified', (SELECT count(*) FROM p WHERE phone_verified_at IS NULL AND coalesce(btrim(phone), '') <> ''),
    'no_phone', (SELECT count(*) FROM p WHERE phone_verified_at IS NULL AND coalesce(btrim(phone), '') = ''),
    -- Verified = email confirmed OR mobile verified (lib/verification.ts).
    'contact_verified', (SELECT count(*) FROM p WHERE email_confirmed_at IS NOT NULL OR phone_verified_at IS NOT NULL),
    'contact_unverified', (SELECT count(*) FROM p WHERE email_confirmed_at IS NULL AND phone_verified_at IS NULL),
    'whatsapp_opted_in', (SELECT count(*) FROM p WHERE whatsapp_alerts),
    'whatsapp_opted_in_donors', (SELECT count(*) FROM p WHERE whatsapp_alerts AND is_donor),
    'donors_by_blood_group', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'count', n, 'available', a) ORDER BY label)
      FROM (SELECT coalesce(blood_group, 'Unknown') AS label, count(*) AS n,
                   count(*) FILTER (WHERE is_available) AS a
            FROM p WHERE is_donor GROUP BY 1) g), '[]'::jsonb),
    'top_districts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'state', state, 'donors', n, 'accounts', t)
                       ORDER BY n DESC, t DESC, label, state)
      FROM (SELECT coalesce(district_norm, 'Unknown') AS label, state_norm AS state,
                   count(*) FILTER (WHERE is_donor) AS n, count(*) AS t
            FROM p GROUP BY 1, 2 ORDER BY 3 DESC, 4 DESC, 1, 2 LIMIT 10) c), '[]'::jsonb)
  ) INTO v_people;
  -- Old key, same rows: an admin page from before this migration still renders.
  v_people := v_people || jsonb_build_object('top_cities', v_people->'top_districts');

  -- Requests ----------------------------------------------------------------
  WITH r AS (
    SELECT br.*,
           (br.status = 'active' AND (br.date_needed IS NULL OR br.date_needed >= current_date)) AS is_open,
           (br.status = 'active' AND br.date_needed < current_date) AS is_expired,
           nullif(initcap(btrim(br.city)), '') AS city_norm,
           (SELECT min(d.created_at) FROM public.donations d WHERE d.request_id = br.id) AS first_offer_at
    FROM public.blood_requests br
  ), c AS (
    SELECT
      count(*) AS total,
      count(*) FILTER (WHERE is_open) AS open,
      count(*) FILTER (WHERE is_expired) AS expired,
      count(*) FILTER (WHERE status = 'fulfilled') AS fulfilled,
      count(*) FILTER (WHERE status IN ('cancelled', 'withdrawn')) AS cancelled,
      count(*) FILTER (WHERE NOT is_open) AS closed
    FROM r
  )
  SELECT jsonb_build_object(
    'total', c.total,
    'open', c.open,
    'expired_active', c.expired,
    'fulfilled', c.fulfilled,
    'cancelled', c.cancelled,
    'other', c.total - c.open - c.expired - c.fulfilled - c.cancelled,
    'last_7d', (SELECT count(*) FROM r WHERE created_at >= now() - interval '7 days'),
    'last_30d', (SELECT count(*) FROM r WHERE created_at >= now() - interval '30 days'),
    'units_requested', (SELECT coalesce(sum(units_needed), 0) FROM r),
    'units_requested_open', (SELECT coalesce(sum(units_needed), 0) FROM r WHERE is_open),
    'units_collected', (SELECT coalesce(sum(units_donated), 0) FROM public.donations WHERE status = 'completed'),
    'fulfilment_rate', CASE WHEN c.closed > 0 THEN round(c.fulfilled::numeric / c.closed, 3) END,
    'requests_with_offers', (SELECT count(*) FROM r WHERE first_offer_at IS NOT NULL),
    'median_hours_to_first_offer', (
      SELECT round((percentile_cont(0.5) WITHIN GROUP (
        ORDER BY greatest(extract(epoch FROM first_offer_at - created_at), 0)) / 3600)::numeric, 1)
      FROM r WHERE first_offer_at IS NOT NULL),
    'median_hours_to_fulfilment', (
      SELECT round((percentile_cont(0.5) WITHIN GROUP (
        ORDER BY greatest(extract(epoch FROM updated_at - created_at), 0)) / 3600)::numeric, 1)
      FROM r WHERE status = 'fulfilled' AND updated_at IS NOT NULL),
    'by_blood_group', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'total', n, 'open', o, 'fulfilled', f) ORDER BY label)
      FROM (SELECT blood_group AS label, count(*) AS n, count(*) FILTER (WHERE is_open) AS o,
                   count(*) FILTER (WHERE status = 'fulfilled') AS f
            FROM r GROUP BY 1) g), '[]'::jsonb),
    'by_urgency', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'total', n, 'open', o, 'fulfilled', f) ORDER BY n DESC, label)
      FROM (SELECT coalesce(urgency_level, 'Unknown') AS label, count(*) AS n,
                   count(*) FILTER (WHERE is_open) AS o, count(*) FILTER (WHERE status = 'fulfilled') AS f
            FROM r GROUP BY 1) u), '[]'::jsonb),
    'by_city', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'total', n, 'open', o, 'fulfilled', f) ORDER BY n DESC, label)
      FROM (SELECT coalesce(city_norm, 'Unknown') AS label, count(*) AS n,
                   count(*) FILTER (WHERE is_open) AS o, count(*) FILTER (WHERE status = 'fulfilled') AS f
            FROM r GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10) ci), '[]'::jsonb)
  ) INTO v_requests
  FROM c;

  -- Offers / donations --------------------------------------------------------
  SELECT jsonb_build_object(
    'total', count(*),
    'pending', count(*) FILTER (WHERE status = 'pending'),
    'completed', count(*) FILTER (WHERE status = 'completed'),
    'cancelled', count(*) FILTER (WHERE status = 'cancelled'),
    'units_donated', coalesce(sum(units_donated) FILTER (WHERE status = 'completed'), 0),
    'last_7d', count(*) FILTER (WHERE created_at >= now() - interval '7 days'),
    'last_30d', count(*) FILTER (WHERE created_at >= now() - interval '30 days'),
    'from_web', count(*) FILTER (WHERE source = 'web'),
    'from_whatsapp', count(*) FILTER (WHERE source = 'whatsapp'),
    'completion_rate', CASE WHEN count(*) FILTER (WHERE status <> 'pending') > 0
      THEN round((count(*) FILTER (WHERE status = 'completed'))::numeric
                 / count(*) FILTER (WHERE status <> 'pending'), 3) END,
    'offers_per_request', (SELECT CASE WHEN count(*) > 0
      THEN round((SELECT count(*) FROM public.donations)::numeric / count(*), 2) END
      FROM public.blood_requests)
  ) INTO v_offers
  FROM public.donations;

  -- WhatsApp (outbound log) -------------------------------------------------
  WITH w AS (
    SELECT kind, status, error, created_at, request_id
    FROM public.whatsapp_messages
    WHERE direction = 'out' AND created_at >= now() - interval '30 days'
  )
  SELECT jsonb_build_object(
    'last_7d', (SELECT jsonb_build_object(
        'total', count(*),
        'failed', count(*) FILTER (WHERE status = 'failed'),
        'by_kind', coalesce((SELECT jsonb_object_agg(kind, n) FROM (
          SELECT kind, count(*) AS n FROM w WHERE created_at >= now() - interval '7 days' GROUP BY 1) k), '{}'::jsonb),
        'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (
          SELECT status, count(*) AS n FROM w WHERE created_at >= now() - interval '7 days' GROUP BY 1) s), '{}'::jsonb))
      FROM w WHERE created_at >= now() - interval '7 days'),
    'last_30d', (SELECT jsonb_build_object(
        'total', count(*),
        'failed', count(*) FILTER (WHERE status = 'failed'),
        'by_kind', coalesce((SELECT jsonb_object_agg(kind, n) FROM (
          SELECT kind, count(*) AS n FROM w GROUP BY 1) k), '{}'::jsonb),
        'by_status', coalesce((SELECT jsonb_object_agg(status, n) FROM (
          SELECT status, count(*) AS n FROM w GROUP BY 1) s), '{}'::jsonb))
      FROM w),
    'inbound_30d', (SELECT count(*) FROM public.whatsapp_messages
                    WHERE direction = 'in' AND created_at >= now() - interval '30 days')
  ) INTO v_whatsapp;

  -- Referrals ---------------------------------------------------------------
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.referrals),
    'last_30d', (SELECT count(*) FROM public.referrals WHERE created_at >= now() - interval '30 days'),
    'referrers', (SELECT count(DISTINCT referrer_id) FROM public.referrals),
    'top_referrers', coalesce((
      SELECT jsonb_agg(jsonb_build_object('name', coalesce(public.donor_short_name(pr.full_name), 'Donor'), 'count', t.n)
                       ORDER BY t.n DESC, t.last_at DESC)
      FROM (SELECT referrer_id, count(*) AS n, max(created_at) AS last_at
            FROM public.referrals GROUP BY 1 ORDER BY 2 DESC, 3 DESC LIMIT 5) t
      JOIN public.profiles pr ON pr.id = t.referrer_id), '[]'::jsonb)
  ) INTO v_referrals;

  -- Daily trend -------------------------------------------------------------
  WITH days AS (
    SELECT generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date AS day
  ), s AS (
    SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
    FROM public.profiles WHERE created_at >= now() - make_interval(days => v_days + 1) GROUP BY 1
  ), rq AS (
    SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
    FROM public.blood_requests WHERE created_at >= now() - make_interval(days => v_days + 1) GROUP BY 1
  ), dn AS (
    -- Donations have no completion timestamp; bucketed by the day the offer was made.
    SELECT (created_at AT TIME ZONE 'Asia/Kolkata')::date AS day, count(*) AS n
    FROM public.donations WHERE status = 'completed' AND created_at >= now() - make_interval(days => v_days + 1) GROUP BY 1
  )
  SELECT jsonb_agg(jsonb_build_object(
           'date', to_char(days.day, 'YYYY-MM-DD'),
           'signups', coalesce(s.n, 0),
           'requests', coalesce(rq.n, 0),
           'donations', coalesce(dn.n, 0)) ORDER BY days.day)
  INTO v_trend
  FROM days
  LEFT JOIN s ON s.day = days.day
  LEFT JOIN rq ON rq.day = days.day
  LEFT JOIN dn ON dn.day = days.day;

  -- Needs attention ---------------------------------------------------------
  SELECT jsonb_build_object(
    'expired_active', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'date_needed')
      FROM (SELECT jsonb_build_object(
                     'id', br.id, 'blood_group', br.blood_group, 'units_needed', br.units_needed,
                     'hospital_name', br.hospital_name, 'city', br.city, 'urgency_level', br.urgency_level,
                     'date_needed', br.date_needed, 'created_at', br.created_at,
                     'offers', (SELECT count(*) FROM public.donations d
                                WHERE d.request_id = br.id AND d.status <> 'cancelled')) AS x
            FROM public.blood_requests br
            WHERE br.status = 'active' AND br.date_needed < current_date
            ORDER BY br.date_needed, br.created_at LIMIT 20) e), '[]'::jsonb),
    'no_offers_24h_count', (
      SELECT count(*) FROM public.blood_requests br
      WHERE br.status = 'active' AND (br.date_needed IS NULL OR br.date_needed >= current_date)
        AND br.created_at < now() - interval '24 hours'
        AND NOT EXISTS (SELECT 1 FROM public.donations d WHERE d.request_id = br.id AND d.status <> 'cancelled')),
    'no_offers_24h', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'created_at')
      FROM (SELECT jsonb_build_object(
                     'id', br.id, 'blood_group', br.blood_group, 'units_needed', br.units_needed,
                     'hospital_name', br.hospital_name, 'city', br.city, 'urgency_level', br.urgency_level,
                     'date_needed', br.date_needed, 'created_at', br.created_at) AS x
            FROM public.blood_requests br
            WHERE br.status = 'active' AND (br.date_needed IS NULL OR br.date_needed >= current_date)
              AND br.created_at < now() - interval '24 hours'
              AND NOT EXISTS (SELECT 1 FROM public.donations d WHERE d.request_id = br.id AND d.status <> 'cancelled')
            ORDER BY br.created_at LIMIT 20) n), '[]'::jsonb),
    'whatsapp_failures', coalesce((
      SELECT jsonb_agg(x ORDER BY x->>'created_at' DESC)
      FROM (SELECT jsonb_build_object(
                     'id', m.id, 'kind', m.kind, 'request_id', m.request_id,
                     'error', left(m.error, 160), 'created_at', m.created_at) AS x
            FROM public.whatsapp_messages m
            WHERE m.direction = 'out' AND m.status = 'failed' AND m.created_at >= now() - interval '7 days'
            ORDER BY m.created_at DESC LIMIT 10) f), '[]'::jsonb),
    'donors_without_location', v_people->'donors_without_location',
    'pending_offers_7d', (
      SELECT count(*) FROM public.donations
      WHERE status = 'pending' AND created_at < now() - interval '7 days')
  ) INTO v_attention;

  RETURN jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'people', v_people,
    'requests', v_requests,
    'offers', v_offers,
    'whatsapp', v_whatsapp,
    'referrals', v_referrals,
    'trend', coalesce(v_trend, '[]'::jsonb),
    'attention', v_attention
  );
END $$;

REVOKE ALL ON FUNCTION public.admin_insights(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_insights(integer) TO authenticated;
