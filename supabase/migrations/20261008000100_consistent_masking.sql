/*
  # Consistent donor-name masking, no PIN codes in lists

  QA found list views mixing masked and full names ("Alok U." next to
  "Sachin Raj M", and one row reading "Name"), and full 6-digit PIN codes in
  the nearby-donors list.

  1. donor_short_name() is the one masking rule for every list view:
       "Sachin Raj M"  -> "Sachin M."    first name + initial of last name
       "K. Ramesh"     -> "Ramesh K."    leading initials are not a first name
       "Salahudheen"   -> "Salahudheen"  single names stay as they are
       "Name", "Test User", "", "A", NULL -> "Donor"   placeholders / no name
  2. nearby_donors(): always masked (public profiles too) and returns
     area_code (first 3 PIN digits, the sorting district) instead of
     present_zip. Return shape changes, so the function is dropped and
     recreated, and the grants restated.
  3. get_my_request_donors(): name masked; phone unchanged (only while the
     request is open). Column names kept, so the app needs no change.
  4. public_donors view (unused by the app, kept for old clients): masked for
     everyone, present_zip coarsened to the area code.

  public_donor_card() is deliberately unchanged: the public donor card shows
  the full name of a public profile (or to its owner). That is its purpose.

  Idempotent: safe to run twice.
*/

-- ---------------------------------------------------------------------------
-- 1. Masking rule
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.donor_short_name(p_full_name text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  -- Values people type into a name field when they don't mean a name.
  placeholders constant text[] := ARRAY[
    'name', 'full name', 'fullname', 'your name', 'first name', 'user', 'username',
    'donor', 'test', 'testing', 'tester', 'demo', 'sample', 'example', 'admin',
    'guest', 'unknown', 'anonymous', 'anon', 'null', 'undefined', 'none', 'na', 'n/a',
    'nil', 'xxx', 'abc', 'asdf', 'qwerty', 'me', 'self'];
  v_name text;
  v_tokens text[];
  v_given_idx int;
  v_given text;
  v_last text;
  v_initial text;
BEGIN
  v_name := regexp_replace(btrim(coalesce(p_full_name, '')), '\s+', ' ', 'g');
  IF length(regexp_replace(v_name, '[^[:alpha:]]', '', 'g')) < 2
     OR lower(v_name) = ANY (placeholders) THEN
    RETURN 'Donor';
  END IF;

  v_tokens := string_to_array(v_name, ' ');

  -- First token with at least two letters is the given name ("K. Ramesh").
  FOR i IN 1 .. array_length(v_tokens, 1) LOOP
    IF length(regexp_replace(v_tokens[i], '[^[:alpha:]]', '', 'g')) >= 2 THEN
      v_given_idx := i;
      EXIT;
    END IF;
  END LOOP;
  IF v_given_idx IS NULL THEN RETURN 'Donor'; END IF;

  -- Strip surrounding punctuation, cap the length.
  v_given := left(regexp_replace(v_tokens[v_given_idx], '^[^[:alpha:]]+|[^[:alpha:]]+$', '', 'g'), 30);
  IF lower(v_given) = ANY (placeholders) THEN RETURN 'Donor'; END IF;
  v_given := upper(left(v_given, 1)) || substr(v_given, 2);

  -- Initial of the last other token: the last token, or a leading initial when
  -- the given name is the last word.
  IF v_given_idx < array_length(v_tokens, 1) THEN
    v_last := v_tokens[array_length(v_tokens, 1)];
  ELSIF v_given_idx > 1 THEN
    v_last := v_tokens[1];
  END IF;
  v_initial := upper(substring(coalesce(v_last, '') FROM '[[:alpha:]]'));

  IF v_initial IS NULL OR v_initial = '' THEN
    RETURN v_given;
  END IF;
  RETURN v_given || ' ' || v_initial || '.';
END $$;

-- First three PIN digits: the sorting district (e.g. 682 = Ernakulam). Never
-- the full PIN code.
CREATE OR REPLACE FUNCTION public.pin_area_code(p_zip text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN regexp_replace(coalesce(p_zip, ''), '\s', '', 'g') ~ '^[1-9][0-9]{5}$'
              THEN left(regexp_replace(p_zip, '\s', '', 'g'), 3) END;
$$;

REVOKE ALL ON FUNCTION public.donor_short_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pin_area_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donor_short_name(text), public.pin_area_code(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. nearby_donors(): masked name, area code, ~1 km location
-- ---------------------------------------------------------------------------
-- Donors without stored coordinates are still returned (approx_location NULL)
-- with their area code; the app places on the map only donors with coordinates.
DROP FUNCTION IF EXISTS public.nearby_donors();
CREATE FUNCTION public.nearby_donors()
RETURNS TABLE (id uuid, display_name text, blood_group text, area_code text, approx_location jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         public.donor_short_name(p.full_name),
         p.blood_group,
         public.pin_area_code(p.present_zip),
         public.approx_location(p.location)
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.is_donor = true AND p.blood_group IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.nearby_donors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_donors() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. get_my_request_donors(): masked name, phone as before
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_request_donors()
RETURNS TABLE (donation_id uuid, request_id uuid, full_name text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.request_id, public.donor_short_name(p.full_name),
         CASE WHEN r.status = 'active' THEN p.phone END
  FROM public.donations d
  JOIN public.blood_requests r ON r.id = d.request_id
  JOIN public.profiles p ON p.id = d.donor_id
  WHERE r.user_id = auth.uid() AND d.status <> 'cancelled';
$$;

REVOKE ALL ON FUNCTION public.get_my_request_donors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_request_donors() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. public_donors view (backward compatibility only)
-- ---------------------------------------------------------------------------
-- Same column names and types as before (CREATE OR REPLACE VIEW requires it):
-- present_zip now carries only the area code, display_name is always masked.
CREATE OR REPLACE VIEW public.public_donors WITH (security_barrier = true) AS
SELECT
  p.id,
  p.donor_number,
  CASE WHEN p.is_public_profile OR auth.uid() IS NOT NULL THEN p.blood_group END AS blood_group,
  p.is_public_profile,
  p.city,
  public.pin_area_code(p.present_zip) AS present_zip,
  CASE
    WHEN p.is_public_profile OR auth.uid() IS NOT NULL THEN public.donor_short_name(p.full_name)
  END AS display_name,
  public.approx_location(p.location) AS approx_location
FROM public.profiles p
WHERE p.is_donor = true AND p.blood_group IS NOT NULL;

REVOKE ALL ON public.public_donors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_donors TO authenticated;
GRANT SELECT (id, donor_number, blood_group, is_public_profile, display_name) ON public.public_donors TO anon;
