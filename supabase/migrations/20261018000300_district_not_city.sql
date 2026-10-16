/*
  # District, not city

  Profiles no longer ask for a city: State + District (lists in
  lib/india-regions.ts) and the PIN code say where a donor is. The app keeps
  profiles.city equal to the chosen district on save, for older readers;
  nothing below depends on it any more.

  1. blood_requests.district / blood_requests.state (nullable text). The
     requester still types the request's own city. When donors are alerted,
     /api/notify/donors works out the listed district and state from the
     request's PIN code (India Post's directory), else from the typed city when
     it names a district, and saves them here (service role). Donors without a
     location are then emailed by district (profiles.district). Signed-out
     visitors can read both, like city and zipcode.

  2. public_stats(): every key keeps its name; two definitions change and one
     key is added.
       members    Completed registration: full_name, state AND district filled
                  in (was full_name, city, district). Same rule as
                  isRegistrationComplete() in lib/auth-helpers.ts. That function
                  also fills in a missing state for older accounts whose
                  district names exactly one listed district, so they count
                  here after their next visit (or after
                  scripts/normalize-regions.ts --apply).
       districts  Distinct non-empty donor districts, per state, compared
                  trimmed and case-insensitively ("Aurangabad, Bihar" and
                  "Aurangabad, Maharashtra" are two).
       cities     Kept for existing callers: now the same value as districts.
     The other definitions are unchanged (see 20261017000500_public_stats.sql).

  3. admin_insights(): people.top_districts (label = district, state, donors,
     accounts; top 10) replaces people.top_cities, which is kept as a copy of
     it so an admin page from before this migration still renders. Request
     breakdowns stay by the request's typed city. Everything else unchanged
     (see 20261017000400_admin_insights.sql).

  Idempotent: safe to run twice.
*/

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.blood_requests.district IS
  'Listed district (lib/india-regions.ts) worked out by the server from the request''s PIN code or city. NULL if unknown.';
COMMENT ON COLUMN public.blood_requests.state IS
  'Listed state or UT of blood_requests.district. NULL if unknown.';

GRANT SELECT (district, state) ON public.blood_requests TO anon;

-- 2. public_stats ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH p AS (
    SELECT
      count(*) FILTER (
        WHERE nullif(btrim(full_name), '') IS NOT NULL
          AND nullif(btrim(state), '') IS NOT NULL
          AND nullif(btrim(district), '') IS NOT NULL
      ) AS members,
      count(*) FILTER (WHERE is_donor AND blood_group IS NOT NULL) AS donors,
      count(*) FILTER (WHERE is_donor AND blood_group IS NOT NULL AND is_available) AS available_donors,
      count(DISTINCT (lower(btrim(coalesce(state, ''))), lower(btrim(district)))) FILTER (
        WHERE is_donor AND blood_group IS NOT NULL AND nullif(btrim(district), '') IS NOT NULL
      ) AS districts
    FROM public.profiles
  ),
  d AS (
    SELECT
      count(*) AS donations_completed,
      coalesce(sum(coalesce(units_donated, 0)), 0) AS units_donated
    FROM public.donations
    WHERE status = 'completed'
  ),
  r AS (
    SELECT
      count(*) FILTER (
        WHERE br.status = 'active' AND (br.date_needed IS NULL OR br.date_needed >= current_date)
      ) AS open,
      count(*) FILTER (WHERE br.status = 'fulfilled') AS fulfilled,
      count(*) FILTER (WHERE c.request_id IS NOT NULL) AS requests_with_donation,
      count(*) FILTER (WHERE br.status = 'fulfilled' OR c.request_id IS NOT NULL) AS requests_helped
    FROM public.blood_requests br
    LEFT JOIN (
      SELECT DISTINCT request_id FROM public.donations WHERE status = 'completed'
    ) c ON c.request_id = br.id
  )
  SELECT jsonb_build_object(
    'members', p.members,
    'donors', p.donors,
    'available_donors', p.available_donors,
    'districts', p.districts,
    'cities', p.districts,
    'open', r.open,
    'fulfilled', r.fulfilled,
    'requests_with_donation', r.requests_with_donation,
    'requests_helped', r.requests_helped,
    'donations_completed', d.donations_completed,
    'units_donated', d.units_donated
  )
  FROM p, d, r;
$$;

COMMENT ON FUNCTION public.public_stats() IS
  'Aggregate, anonymous totals for the public pages. Definitions: see migrations 20261017000500_public_stats.sql and 20261018000300_district_not_city.sql.';

REVOKE ALL ON FUNCTION public.public_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated, service_role;

-- 3. admin_insights ----------------------------------------------------------
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
