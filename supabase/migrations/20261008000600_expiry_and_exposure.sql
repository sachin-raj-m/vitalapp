/*
  # Expired requests, request column exposure, donor-card enumeration

  From the 2026-10-08 audit:

  1. Requests stayed "active" forever after their needed-by date, so shared
     links, previews and posters kept asking for blood and the API kept serving
     them. A request is now treated as open only while status = 'active' AND
     date_needed is today or later (or unset). Owners, admins and donors who
     offered still see it through their own policies.
  2. New offers can only be made on open requests.
  3. Signed-out visitors could read blood_requests.user_id (the poster's
     account id). anon now gets every column except user_id. NOTE: columns
     added to blood_requests later must be granted to anon explicitly.
  4. public_donor_card() returned a row (id, donor number) for private donors,
     letting anyone enumerate who is registered. It now returns nothing unless
     the card is public or the caller is the owner.
  5. The public_donors view is no longer used by the app (replaced by
     public_donor_card() / nearby_donors()); drop it (advisor: security
     definer view).
*/

-- 1. Open = active and not past its needed-by date.
CREATE OR REPLACE FUNCTION public.request_is_open(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blood_requests
    WHERE id = p_request_id
      AND status = 'active'
      AND (date_needed IS NULL OR date_needed >= current_date)
  );
$$;
REVOKE ALL ON FUNCTION public.request_is_open(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_is_open(uuid) TO authenticated;

DROP POLICY IF EXISTS "Anyone reads active requests" ON public.blood_requests;
CREATE POLICY "Anyone reads open requests" ON public.blood_requests
  FOR SELECT TO anon, authenticated
  USING (status = 'active' AND (date_needed IS NULL OR date_needed >= current_date));

-- 2. Offers only on open requests.
DROP POLICY IF EXISTS "Donor creates pending offer" ON public.donations;
CREATE POLICY "Donor creates pending offer" ON public.donations
  FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = donor_id
    AND status = 'pending'
    AND otp IS NULL
    AND coalesce(units_donated, 0) = 0
    AND public.request_is_open(request_id)
  );

-- 3. Hide the poster's account id from signed-out visitors.
REVOKE SELECT ON public.blood_requests FROM anon;
GRANT SELECT (id, blood_group, units_needed, hospital_name, hospital_address, urgency_level,
              notes, contact_name, location, status, created_at, updated_at, city, zipcode, date_needed)
  ON public.blood_requests TO anon;

-- 4. Donor cards: nothing at all for private cards (unless it's your own).
CREATE OR REPLACE FUNCTION public.public_donor_card(p_id uuid DEFAULT NULL, p_donor_number bigint DEFAULT NULL)
RETURNS TABLE (id uuid, donor_number bigint, display_name text, blood_group text, is_public_profile boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.donor_number, p.full_name, p.blood_group, coalesce(p.is_public_profile, false)
  FROM public.profiles p
  WHERE p.is_donor = true AND p.blood_group IS NOT NULL
    AND (p.is_public_profile OR p.id = auth.uid())
    AND (p_id IS NULL) <> (p_donor_number IS NULL)
    AND (p.id = p_id OR p.donor_number = p_donor_number)
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.public_donor_card(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_donor_card(uuid, bigint) TO anon, authenticated;

-- 5. Unused owner-rights view.
DROP VIEW IF EXISTS public.public_donors;
