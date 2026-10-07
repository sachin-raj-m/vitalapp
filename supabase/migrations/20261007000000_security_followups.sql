/*
  # Security follow-ups

  Fixes found after 20261006000000_security_lockdown, plus the advisor findings.
  Idempotent and drift-tolerant: safe to run twice, and every object it touches
  is checked for existence first.

  1. CRITICAL: public_donors is an auto-updatable view owned by postgres
     (BYPASSRLS), and Supabase's default privileges gave anon/authenticated
     INSERT/UPDATE/DELETE on it. Anyone with the anon key could change any
     donor's blood group, make a private card public, or delete donors via
     PATCH/DELETE /rest/v1/public_donors. Writes are revoked here.
  2. public_donors for anon: column-level grant limited to what the public donor
     card and its OG image read; private donors' name and blood group are
     hidden from signed-out visitors. New RPCs public_donor_card() and
     nearby_donors() replace the view; once the app calls them, run the
     follow-up at the bottom of this file to drop the view.
  3. Function EXECUTE grants tightened (trigger functions, RLS helpers).
  4. Defence in depth: anon loses table privileges it never needs; TRUNCATE /
     TRIGGER / REFERENCES revoked from API roles (TRUNCATE bypasses RLS).
  5. blood_requests.contact_phone dropped (always NULL, readable by anyone).
  6. notifications policies scoped to authenticated.
  7. storage 'proofs' policies consolidated to one folder-per-user model.
  8. rate_limits table + rate_limit_hit() for the API routes (service role only).
  9. Performance advisors: auth.uid() wrapped in (select ...) in policies,
     covering indexes for foreign keys.
*/

-- ---------------------------------------------------------------------------
-- 1 + 2. public_donors: read-only, minimal for anon
-- ---------------------------------------------------------------------------

-- Shared formatting so the view and the RPCs can't drift apart.
CREATE OR REPLACE FUNCTION public.donor_short_name(p_full_name text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT trim(split_part(coalesce(p_full_name, 'Donor'), ' ', 1) ||
    CASE WHEN position(' ' IN trim(coalesce(p_full_name, ''))) > 0
      THEN ' ' || upper(left(reverse(split_part(reverse(trim(p_full_name)), ' ', 1)), 1)) || '.'
      ELSE '' END);
$$;

-- Location rounded to ~1 km.
CREATE OR REPLACE FUNCTION public.approx_location(p_location jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_location) = 'object'
              AND p_location ? 'latitude' AND p_location ? 'longitude'
              AND (p_location->>'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
              AND (p_location->>'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$'
    THEN jsonb_build_object(
      'latitude', round((p_location->>'latitude')::numeric, 2),
      'longitude', round((p_location->>'longitude')::numeric, 2))
  END;
$$;

-- Same columns, names and types as before (CREATE OR REPLACE requires it).
-- Plain columns (id, is_public_profile, city, ...) are still auto-updatable,
-- so the REVOKE below is what blocks writes. Any future view in public gets
-- full grants from Supabase's default privileges: revoke them every time.
CREATE OR REPLACE VIEW public.public_donors WITH (security_barrier = true) AS
SELECT
  p.id,
  p.donor_number,
  CASE WHEN p.is_public_profile OR auth.uid() IS NOT NULL THEN p.blood_group END AS blood_group,
  p.is_public_profile,
  p.city,
  p.present_zip,
  CASE
    WHEN p.is_public_profile THEN p.full_name
    WHEN auth.uid() IS NULL THEN NULL           -- signed-out visitors learn nothing about private donors
    ELSE public.donor_short_name(p.full_name)
  END AS display_name,
  public.approx_location(p.location) AS approx_location
FROM public.profiles p
WHERE p.is_donor = true AND p.blood_group IS NOT NULL;

REVOKE ALL ON public.public_donors FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_donors TO authenticated;
-- anon: only what /donor/[id] and its OG image select.
GRANT SELECT (id, donor_number, blood_group, is_public_profile, display_name) ON public.public_donors TO anon;

-- Public donor card by id or donor number (exactly one). Private cards return
-- the row (so the page can say "private") without name or blood group, unless
-- the caller is the owner.
CREATE OR REPLACE FUNCTION public.public_donor_card(p_id uuid DEFAULT NULL, p_donor_number bigint DEFAULT NULL)
RETURNS TABLE (id uuid, donor_number bigint, display_name text, blood_group text, is_public_profile boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         p.donor_number,
         CASE WHEN p.is_public_profile OR p.id = auth.uid() THEN p.full_name END,
         CASE WHEN p.is_public_profile OR p.id = auth.uid() THEN p.blood_group END,
         coalesce(p.is_public_profile, false)
  FROM public.profiles p
  WHERE p.is_donor = true AND p.blood_group IS NOT NULL
    AND (p_id IS NULL) <> (p_donor_number IS NULL)
    AND (p.id = p_id OR p.donor_number = p_donor_number)
  LIMIT 1;
$$;

-- Donor map for signed-in users: short name, blood group, PIN code, ~1 km location.
CREATE OR REPLACE FUNCTION public.nearby_donors()
RETURNS TABLE (id uuid, display_name text, blood_group text, present_zip text, approx_location jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         CASE WHEN p.is_public_profile THEN p.full_name ELSE public.donor_short_name(p.full_name) END,
         p.blood_group,
         p.present_zip,
         public.approx_location(p.location)
  FROM public.profiles p
  WHERE auth.uid() IS NOT NULL
    AND p.is_donor = true AND p.blood_group IS NOT NULL;
$$;

-- Pure formatting helpers (SECURITY INVOKER, read nothing). Functions inside a
-- view are checked against the caller, so API roles need EXECUTE.
REVOKE ALL ON FUNCTION public.donor_short_name(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approx_location(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.donor_short_name(text), public.approx_location(jsonb) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.public_donor_card(uuid, bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_donor_card(uuid, bigint) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.nearby_donors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nearby_donors() TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Function grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE sig text;
BEGIN
  -- Trigger functions: never callable over the API (EXECUTE is only checked at
  -- CREATE TRIGGER time, so the triggers keep working).
  FOREACH sig IN ARRAY ARRAY['public.handle_new_user()', 'public.protect_profile_privileged_columns()'] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', sig);
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', sig);
    END IF;
  END LOOP;
  -- RLS helpers: only referenced by policies scoped to authenticated.
  FOREACH sig IN ARRAY ARRAY['public.is_admin()', 'public.owns_request(uuid)', 'public.has_offered_on(uuid)'] LOOP
    IF to_regprocedure(sig) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', sig);
    END IF;
  END LOOP;
END $$;

-- Pin search_path on any remaining public function that lacks one.
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    LEFT JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'e'
    WHERE n.nspname = 'public' AND p.prokind = 'f' AND d.objid IS NULL
      AND NOT EXISTS (SELECT 1 FROM unnest(coalesce(p.proconfig, '{}')) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Table privileges (RLS stays the primary control; this is belt and braces)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  -- TRUNCATE is not subject to RLS; no API role needs TRIGGER/REFERENCES.
  FOR t IN SELECT c.oid::regclass::text FROM pg_class c
           WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p') LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON %s FROM PUBLIC, anon, authenticated', t);
  END LOOP;
  -- Tables a signed-out visitor never touches.
  FOREACH t IN ARRAY ARRAY['public.donor_secrets', 'public.request_contacts', 'public.push_subscriptions',
                           'public.user_activity_logs', 'public.notifications'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON %s FROM anon', t);
    END IF;
  END LOOP;
  -- anon may read active requests (RLS) but never write.
  FOREACH t IN ARRAY ARRAY['public.blood_requests', 'public.profiles', 'public.donations'] LOOP
    IF to_regclass(t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %s FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 5. blood_requests.contact_phone: moved to request_contacts on 2026-10-06
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'blood_requests' AND column_name = 'contact_phone') THEN
    -- Rescue anything an old cached client wrote since the lockdown.
    EXECUTE $q$
      INSERT INTO public.request_contacts (request_id, contact_phone)
      SELECT id, contact_phone FROM public.blood_requests
      WHERE contact_phone IS NOT NULL AND contact_phone <> ''
      ON CONFLICT (request_id) DO NOTHING
    $q$;
    ALTER TABLE public.blood_requests DROP COLUMN contact_phone;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. notifications: authenticated only
-- ---------------------------------------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN RETURN; END IF;
  ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT polname FROM pg_policy WHERE polrelid = 'public.notifications'::regclass LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', pol.polname);
  END LOOP;
  CREATE POLICY "Owner reads own notifications" ON public.notifications
    FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
  CREATE POLICY "Owner updates own notifications" ON public.notifications
    FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
  -- Inserts come from the service role only.
END $$;

-- ---------------------------------------------------------------------------
-- 7. storage: 'proofs' bucket, files live under <user id>/...
-- ---------------------------------------------------------------------------
DO $$
DECLARE pol record;
BEGIN
  IF to_regclass('storage.objects') IS NULL THEN RETURN; END IF;

  -- Drop every policy that mentions the proofs bucket (dashboard-created ones included).
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND (coalesce(qual, '') LIKE '%''proofs''%' OR coalesce(with_check, '') LIKE '%''proofs''%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;

  -- Upload only into your own folder, as yourself.
  CREATE POLICY "Proofs: upload own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'proofs'
                AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
                AND owner = (SELECT auth.uid()));
  -- Read your own files; admins read all.
  CREATE POLICY "Proofs: read own or admin" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'proofs'
           AND ((storage.foldername(name))[1] = (SELECT auth.uid())::text OR (SELECT public.is_admin())));
  CREATE POLICY "Proofs: update own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text)
    WITH CHECK (bucket_id = 'proofs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
  CREATE POLICY "Proofs: delete own" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'proofs' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
END $$;

-- ---------------------------------------------------------------------------
-- 8. Rate limiting for API routes (fixed window, called with the service role)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY CHECK (length(key) <= 200),
  window_start timestamptz NOT NULL DEFAULT now(),
  hits integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS rate_limits_window_start_idx ON public.rate_limits (window_start);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- no policies: API roles see nothing
REVOKE ALL ON public.rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO service_role;

-- Records one hit for p_key and returns true while the caller is within
-- p_max hits per p_window_seconds. Keys are opaque (callers hash e-mails).
CREATE OR REPLACE FUNCTION public.rate_limit_hit(p_key text, p_window_seconds integer, p_max integer)
RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_hits integer;
BEGIN
  IF p_key IS NULL OR length(p_key) > 200 OR p_window_seconds NOT BETWEEN 1 AND 86400 OR p_max < 1 THEN
    RAISE EXCEPTION 'invalid rate limit arguments' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limits AS r (key, window_start, hits)
  VALUES (p_key, now(), 1)
  ON CONFLICT (key) DO UPDATE SET
    window_start = CASE WHEN r.window_start <= now() - make_interval(secs => p_window_seconds)
                        THEN now() ELSE r.window_start END,
    hits = CASE WHEN r.window_start <= now() - make_interval(secs => p_window_seconds)
                THEN 1 ELSE r.hits + 1 END
  RETURNING hits INTO v_hits;

  -- Occasional housekeeping; windows are at most a day long.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_hits <= p_max;
END $$;

REVOKE ALL ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- 9. Performance advisors
-- ---------------------------------------------------------------------------
-- auth.uid() evaluated once per query instead of once per row. ALTER POLICY
-- keeps names and roles; a policy missing in a drifted database is skipped.
CREATE OR REPLACE FUNCTION pg_temp.retarget(tbl regclass, pol text, using_expr text, check_expr text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = tbl AND polname = pol) THEN RETURN; END IF;
  IF using_expr IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON %s USING (%s)', pol, tbl, using_expr);
  END IF;
  IF check_expr IS NOT NULL THEN
    EXECUTE format('ALTER POLICY %I ON %s WITH CHECK (%s)', pol, tbl, check_expr);
  END IF;
END $$;

SELECT pg_temp.retarget('public.donor_secrets', 'Owner reads own pin', '(SELECT auth.uid()) = user_id', NULL);
SELECT pg_temp.retarget('public.donor_secrets', 'Owner creates own pin', NULL, '(SELECT auth.uid()) = user_id');
SELECT pg_temp.retarget('public.donor_secrets', 'Owner updates own pin', '(SELECT auth.uid()) = user_id', '(SELECT auth.uid()) = user_id');

SELECT pg_temp.retarget('public.profiles', 'Owner reads own profile', '(SELECT auth.uid()) = id', NULL);
SELECT pg_temp.retarget('public.profiles', 'Owner creates own profile', NULL, '(SELECT auth.uid()) = id');
SELECT pg_temp.retarget('public.profiles', 'Owner updates own profile', '(SELECT auth.uid()) = id', '(SELECT auth.uid()) = id');

SELECT pg_temp.retarget('public.blood_requests', 'Owner reads own requests', '(SELECT auth.uid()) = user_id', NULL);
SELECT pg_temp.retarget('public.blood_requests', 'Owner creates requests', NULL, '(SELECT auth.uid()) = user_id AND status = ''active''');
SELECT pg_temp.retarget('public.blood_requests', 'Owner updates own requests', '(SELECT auth.uid()) = user_id', '(SELECT auth.uid()) = user_id');
SELECT pg_temp.retarget('public.blood_requests', 'Owner deletes own requests', '(SELECT auth.uid()) = user_id', NULL);

SELECT pg_temp.retarget('public.donations', 'Donor reads own donations', '(SELECT auth.uid()) = donor_id', NULL);
SELECT pg_temp.retarget('public.donations', 'Donor creates pending offer', NULL,
  '(SELECT auth.uid()) = donor_id AND status = ''pending'' AND otp IS NULL AND coalesce(units_donated, 0) = 0');
SELECT pg_temp.retarget('public.donations', 'Donor withdraws own offer',
  '(SELECT auth.uid()) = donor_id AND status = ''pending''', '(SELECT auth.uid()) = donor_id AND status = ''cancelled''');

SELECT pg_temp.retarget('public.push_subscriptions', 'Owner manages own subscriptions', '(SELECT auth.uid()) = user_id', '(SELECT auth.uid()) = user_id');
SELECT pg_temp.retarget('public.user_activity_logs', 'Users log their own activity', NULL, '(SELECT auth.uid()) = user_id');

-- Covering indexes for foreign keys flagged by the advisor.
CREATE INDEX IF NOT EXISTS idx_blood_requests_user_id ON public.blood_requests (user_id);
DO $$
BEGIN
  IF to_regclass('public.notifications') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications (user_id);
  END IF;
  IF to_regclass('public.user_activity_logs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_user_activity_logs_user_id ON public.user_activity_logs (user_id);
  END IF;
END $$;

/*
  FOLLOW-UP (separate migration, after the app calls public_donor_card() and
  nearby_donors() instead of reading public_donors):

    DROP VIEW IF EXISTS public.public_donors;

  That clears the advisor's security_definer_view ERROR.
*/
