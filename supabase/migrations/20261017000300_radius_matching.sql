/*
  # Radius matching: alerts and "Donors near you" within 25 km

  1. match_radius_km(): the one radius (25 km) the database uses. The app's
     copy of it is MATCH_RADIUS_KM in lib/geo.ts; keep them equal
     (supabase/tests/radius.test.sql checks this value).
  2. distance_km(): great-circle (haversine) distance between two points.
     No PostGIS; the profile table is small enough to scan.
  3. donors_within_radius(): compatible, available donors with a usable stored
     location within the radius of a point, nearest first, never the
     requester. Service role only: the alert route (app/api/notify/donors)
     calls it server-side and it returns contact details.
  4. nearby_donors(): now only donors within the radius of the viewer's own
     stored location, nearest first, with a distance in whole km (at least 1).
     A viewer without a usable location gets no rows. Names stay masked and
     locations stay rounded to 2 dp (~1 km); the distance is measured from
     that rounded point, so moving your own location around cannot narrow a
     donor down further than the rounded point already shown. The viewer is
     no longer in their own list. Return shape changes (distance_km), so the
     function is dropped and recreated and its grants restated.

  "Usable location" means public.location_in_india(): NULL, {0,0}
  placeholders, malformed and out-of-India values never match.

  Compatibility mirrors COMPATIBILITY_CHART in lib/blood-compatibility.ts.

  Idempotent: safe to run twice.
*/

-- ---------------------------------------------------------------------------
-- 1. The radius
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_radius_km()
RETURNS double precision LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 25::double precision;
$$;
REVOKE ALL ON FUNCTION public.match_radius_km() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.match_radius_km() TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Haversine distance in km
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.distance_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE STRICT SET search_path = '' AS $$
  SELECT 2 * 6371 * asin(least(1, sqrt(
    sin(radians(p_lat2 - p_lat1) / 2) ^ 2
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * sin(radians(p_lng2 - p_lng1) / 2) ^ 2)));
$$;
REVOKE ALL ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.distance_km(double precision, double precision, double precision, double precision)
  TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Compatible donor groups for a recipient (red cells)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.compatible_donor_groups(p_recipient text)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE p_recipient
    WHEN 'O-'  THEN ARRAY['O-']
    WHEN 'O+'  THEN ARRAY['O-', 'O+']
    WHEN 'A-'  THEN ARRAY['O-', 'A-']
    WHEN 'A+'  THEN ARRAY['O-', 'O+', 'A-', 'A+']
    WHEN 'B-'  THEN ARRAY['O-', 'B-']
    WHEN 'B+'  THEN ARRAY['O-', 'O+', 'B-', 'B+']
    WHEN 'AB-' THEN ARRAY['O-', 'A-', 'B-', 'AB-']
    WHEN 'AB+' THEN ARRAY['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+']
    ELSE ARRAY[]::text[]
  END;
$$;
REVOKE ALL ON FUNCTION public.compatible_donor_groups(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compatible_donor_groups(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Alert audience: compatible, available donors within the radius
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER: only the service role may execute it, and it reads
-- profiles with the service role's own rights.
CREATE OR REPLACE FUNCTION public.donors_within_radius(
  p_latitude double precision,
  p_longitude double precision,
  p_recipient_group text,
  p_exclude_user uuid DEFAULT NULL,
  p_radius_km double precision DEFAULT NULL)
RETURNS TABLE (id uuid, full_name text, email text, phone text, whatsapp_alerts boolean, distance_km double precision)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT p.id, p.full_name::text, p.email::text, p.phone::text, coalesce(p.whatsapp_alerts, false), d.km
  FROM public.profiles p
  CROSS JOIN LATERAL (
    SELECT public.distance_km(p_latitude, p_longitude,
                              (p.location->>'latitude')::double precision,
                              (p.location->>'longitude')::double precision) AS km
  ) d
  WHERE public.location_in_india(jsonb_build_object('latitude', p_latitude, 'longitude', p_longitude))
    AND p.is_donor = true
    AND p.is_available = true
    AND p.blood_group = ANY (public.compatible_donor_groups(p_recipient_group))
    AND (p_exclude_user IS NULL OR p.id <> p_exclude_user)
    AND public.location_in_india(p.location)
    AND d.km <= coalesce(p_radius_km, public.match_radius_km())
  ORDER BY d.km;
$$;
REVOKE ALL ON FUNCTION public.donors_within_radius(double precision, double precision, text, uuid, double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.donors_within_radius(double precision, double precision, text, uuid, double precision)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 5. nearby_donors(): only donors within the radius of the viewer
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.nearby_donors();
CREATE FUNCTION public.nearby_donors()
RETURNS TABLE (id uuid, display_name text, blood_group text, area_code text, approx_location jsonb, distance_km integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT (p.location->>'latitude')::double precision AS lat,
           (p.location->>'longitude')::double precision AS lng
    FROM public.profiles p
    WHERE auth.uid() IS NOT NULL
      AND p.id = auth.uid()
      AND public.location_in_india(p.location)
  ),
  donors AS (
    SELECT p.id, p.full_name, p.blood_group, p.present_zip,
           public.approx_location(p.location) AS approx
    FROM public.profiles p
    WHERE p.is_donor = true AND p.blood_group IS NOT NULL
      AND p.id <> auth.uid()
      AND public.location_in_india(p.location)
  )
  SELECT d.id,
         public.donor_short_name(d.full_name),
         d.blood_group,
         public.pin_area_code(d.present_zip),
         d.approx,
         greatest(1, round(x.km))::integer
  FROM me
  CROSS JOIN donors d
  CROSS JOIN LATERAL (
    SELECT public.distance_km(me.lat, me.lng,
                              (d.approx->>'latitude')::double precision,
                              (d.approx->>'longitude')::double precision) AS km
  ) x
  WHERE x.km <= public.match_radius_km()
  ORDER BY x.km, d.id;
$$;

REVOKE ALL ON FUNCTION public.nearby_donors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_donors() TO authenticated;
