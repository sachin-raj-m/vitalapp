/*
  # Admin insights

  The admin Overview used to download every profile, request and donation to
  the browser and count them there. That is fine at 30 accounts, not at 1000
  daily users. admin_insights() does the counting in the database and returns
  one JSON document of aggregates.

  - Admins only: raises 42501 unless public.is_admin() is true. Not executable
    by anon at all.
  - Aggregates only. The only names it returns are top referrers, masked with
    donor_short_name(). No emails, phone numbers, WhatsApp numbers or ids of
    people. "Needs attention" lists carry request ids (so the admin can act on
    them) and the hospital name / city that is already public on the request.
  - Definitions match the rest of the app:
      open    = status 'active' and date_needed today or later (or unset);
      expired = status 'active' and date_needed in the past;
      closed  = everything that is not open.
    fulfilment_rate = fulfilled / closed requests (NULL while nothing has closed).
    Time to fulfilment uses blood_requests.updated_at, which verify_donation
    sets when the last unit is confirmed.
  - Trend days are calendar days in India time (Asia/Kolkata).

  Read-only (STABLE). Idempotent: safe to run twice.
*/

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
           nullif(initcap(btrim(pr.city)), '') AS city_norm
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
    'top_cities', coalesce((
      SELECT jsonb_agg(jsonb_build_object('label', label, 'donors', n, 'accounts', t) ORDER BY n DESC, t DESC, label)
      FROM (SELECT coalesce(city_norm, 'Unknown') AS label,
                   count(*) FILTER (WHERE is_donor) AS n, count(*) AS t
            FROM p GROUP BY 1 ORDER BY 2 DESC, 3 DESC, 1 LIMIT 10) c), '[]'::jsonb)
  ) INTO v_people;

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
