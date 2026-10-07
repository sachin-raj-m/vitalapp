-- Donor coordinates: drop placeholders, never expose them.
--
-- Older app versions stored {latitude: 0, longitude: 0} when no position was
-- known. Those rows put donors in the Gulf of Guinea and break distance
-- ranking. From now on profiles.location is set server-side from the donor's
-- PIN code (app/api/profile/location) or by scripts/backfill-donor-locations.mjs.
--
-- Idempotent: safe to re-run. Touches only profiles.location.

-- ---------------------------------------------------------------------------
-- 1. Helper: is this a usable location inside India's bounding box?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.location_in_india(p_location jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT COALESCE(
    jsonb_typeof(p_location) = 'object'
    AND (p_location->>'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND (p_location->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
    AND (p_location->>'latitude')::numeric BETWEEN 6 AND 37.5
    AND (p_location->>'longitude')::numeric BETWEEN 68 AND 97.5,
    false);
$$;

REVOKE ALL ON FUNCTION public.location_in_india(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.location_in_india(jsonb) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. approx_location(): NULL for placeholders and anything outside India
-- ---------------------------------------------------------------------------
-- Same signature and grants as 20261007000000; still rounds to 2 dp (~1 km).
CREATE OR REPLACE FUNCTION public.approx_location(p_location jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN public.location_in_india(p_location)
    THEN jsonb_build_object(
      'latitude', round((p_location->>'latitude')::numeric, 2),
      'longitude', round((p_location->>'longitude')::numeric, 2))
  END;
$$;

REVOKE ALL ON FUNCTION public.approx_location(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approx_location(jsonb) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Clear stored placeholders / out-of-India / malformed values
-- ---------------------------------------------------------------------------
-- Runs as the migration owner (auth.uid() is NULL), so the profile triggers
-- let it through; only the location column changes.
UPDATE public.profiles
SET location = NULL
WHERE location IS NOT NULL
  AND NOT public.location_in_india(location);
