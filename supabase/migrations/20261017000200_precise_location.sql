/*
  # Precise, validated locations for donors and requests

  Alerts and "Donors near you" rank by distance, so coordinates have to be
  real and inside India. Until now most donors had no position at all and the
  rest were placed at their PIN code's centre.

  profiles.location (private: owner, admins and the server only; others see
  approx_location(), rounded to ~1 km) now has one shape:

    { latitude, longitude,   -- rounded to 4 dp (~11 m)
      source,                -- 'gps' (device), 'manual' (placed on a map),
                             -- 'pin' (PIN code centre) or 'city' (city centre)
      accuracy_m,            -- radius in metres (defaults per source)
      label,                 -- optional "Near ..." locality, for the owner
      updated_at }           -- set by the database when a user changes it

  normalize_profile_location (BEFORE INSERT/UPDATE OF location):
    - placeholders ((0,0), missing or non-numeric coordinates) become NULL, so
      older app builds that still write {0,0} keep working;
    - any other point outside India is refused (23514);
    - unknown keys are dropped, the source and accuracy are checked.
  It is a separate trigger: protect_profile_privileged_columns is unchanged.

  blood_requests.location must be inside India on every new request and
  whenever it is changed (validate_request_location, AFTER, so RLS and the
  consent check report their own errors first). Existing rows are left alone.

  Idempotent: safe to re-run.
*/

-- ---------------------------------------------------------------------------
-- 1. Helper: a usable location that the donor set precisely (device or map)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.location_is_precise(p_location jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT public.location_in_india(p_location)
     AND coalesce(p_location->>'source', '') IN ('gps', 'manual');
$$;
REVOKE ALL ON FUNCTION public.location_is_precise(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.location_is_precise(jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Normalise / validate profiles.location
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.normalize_location(p_location jsonb, p_user_write boolean)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  v_lat numeric;
  v_lng numeric;
  v_source text;
  v_accuracy numeric;
  v_label text;
  v_updated text;
BEGIN
  IF p_location IS NULL OR jsonb_typeof(p_location) = 'null' THEN
    RETURN NULL;
  END IF;
  IF jsonb_typeof(p_location) <> 'object'
     OR coalesce(p_location->>'latitude', '') !~ '^-?[0-9]+(\.[0-9]+)?$'
     OR coalesce(p_location->>'longitude', '') !~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    RETURN NULL; -- placeholder ({} or no usable coordinates)
  END IF;

  v_lat := (p_location->>'latitude')::numeric;
  v_lng := (p_location->>'longitude')::numeric;
  IF v_lat = 0 AND v_lng = 0 THEN
    RETURN NULL; -- the old {0,0} placeholder
  END IF;
  IF NOT public.location_in_india(p_location) THEN
    RAISE EXCEPTION 'Location must be a place in India' USING ERRCODE = '23514';
  END IF;

  v_source := coalesce(nullif(p_location->>'source', ''), 'manual');
  IF v_source NOT IN ('gps', 'manual', 'pin', 'city') THEN
    RAISE EXCEPTION 'Unknown location source %', v_source USING ERRCODE = '23514';
  END IF;

  IF p_location ? 'accuracy_m' AND jsonb_typeof(p_location->'accuracy_m') <> 'null' THEN
    IF jsonb_typeof(p_location->'accuracy_m') <> 'number' THEN
      RAISE EXCEPTION 'Location accuracy must be a number of metres' USING ERRCODE = '23514';
    END IF;
    v_accuracy := (p_location->>'accuracy_m')::numeric;
    IF v_accuracy < 0 OR v_accuracy > 100000 THEN
      RAISE EXCEPTION 'Location accuracy must be between 0 and 100000 metres' USING ERRCODE = '23514';
    END IF;
    v_accuracy := greatest(round(v_accuracy), 1);
  ELSE
    v_accuracy := CASE v_source WHEN 'pin' THEN 5000 WHEN 'city' THEN 15000 WHEN 'manual' THEN 100 END;
  END IF;

  IF jsonb_typeof(p_location->'label') = 'string' THEN
    v_label := nullif(left(btrim(regexp_replace(p_location->>'label', '[[:cntrl:]]', '', 'g')), 120), '');
  END IF;

  -- A user's own write is stamped by the caller (now()); the server and
  -- migrations may keep the time they geocoded it.
  IF NOT p_user_write THEN
    v_updated := coalesce(p_location->>'updated_at', p_location->>'geocoded_at');
    IF v_updated IS NOT NULL AND v_updated !~ '^\d{4}-\d{2}-\d{2}' THEN v_updated := NULL; END IF;
  END IF;

  RETURN jsonb_strip_nulls(jsonb_build_object(
    'latitude', round(v_lat, 4),
    'longitude', round(v_lng, 4),
    'source', v_source,
    'accuracy_m', v_accuracy,
    'label', v_label,
    'updated_at', v_updated));
END $$;
REVOKE ALL ON FUNCTION public.normalize_location(jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- SECURITY DEFINER so it can call normalize_location(), which clients can't.
CREATE OR REPLACE FUNCTION public.normalize_profile_location()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_write boolean := auth.uid() IS NOT NULL;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location IS NOT DISTINCT FROM OLD.location THEN
    RETURN NEW;
  END IF;
  NEW.location := public.normalize_location(NEW.location, v_user_write);
  IF NEW.location IS NOT NULL AND NOT (NEW.location ? 'updated_at') THEN
    NEW.location := NEW.location || jsonb_build_object('updated_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.normalize_profile_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS normalize_profile_location ON public.profiles;
CREATE TRIGGER normalize_profile_location
  BEFORE INSERT OR UPDATE OF location ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.normalize_profile_location();

-- ---------------------------------------------------------------------------
-- 3. Requests: the hospital pin must be inside India
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_request_location()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.location IS NOT DISTINCT FROM OLD.location THEN
    RETURN NULL;
  END IF;
  -- location_in_india() also rules out the (0,0) placeholder.
  IF NOT public.location_in_india(NEW.location) THEN
    RAISE EXCEPTION 'Mark the hospital on the map: the request location must be a place in India'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.validate_request_location() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS validate_request_location ON public.blood_requests;
CREATE TRIGGER validate_request_location
  AFTER INSERT OR UPDATE OF location ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_request_location();

-- ---------------------------------------------------------------------------
-- 4. Bring stored donor locations into the new shape
-- ---------------------------------------------------------------------------
-- Runs as the migration owner (auth.uid() is NULL): the trigger keeps each
-- row's geocoded_at as updated_at. Only rows that would change are touched.
-- Sources other than the known ones (none are expected) fall back to 'manual'
-- rather than failing the migration.
UPDATE public.profiles
SET location = public.normalize_location(
  CASE WHEN coalesce(location->>'source', '') IN ('gps', 'manual', 'pin', 'city') THEN location
       ELSE location - 'source' END
  - CASE WHEN jsonb_typeof(location->'accuracy_m') NOT IN ('number', 'null') THEN 'accuracy_m' ELSE '' END,
  false)
WHERE location IS NOT NULL
  AND public.location_in_india(location)
  AND NOT (location ? 'updated_at' AND location ? 'accuracy_m' AND NOT location ? 'geocoded_at');
