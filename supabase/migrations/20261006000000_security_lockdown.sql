/*
  # Security lockdown

  The anon key ships in the client bundle, so RLS is the only thing protecting
  data. Before this migration:
    - anyone could read every column of every donor profile (phone, email, dob,
      government_id, location, donor_pin, role);
    - any signed-in user could set their own role to 'admin';
    - anyone could read every donation, including the donor PIN copied into otp;
    - PIN verification happened in the browser, so it proved nothing;
    - anyone could read the contact phone on every request;
    - anyone could call create_notification() for any user.

  This migration is written to be safe against drift between the repo and the
  live database: every table's policies are dropped dynamically and recreated
  from scratch, and columns the app relies on are added with IF NOT EXISTS.

  APPLY TO A BRANCH / STAGING PROJECT FIRST, and deploy the matching app code in
  the same release. Older app builds read columns this migration hides.
*/

-- ---------------------------------------------------------------------------
-- 0. Columns the app writes but no earlier migration created (schema drift)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS state text,
  ADD COLUMN IF NOT EXISTS availability text[],
  ADD COLUMN IF NOT EXISTS has_medical_conditions boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_eligible_date timestamptz,
  ADD COLUMN IF NOT EXISTS consent_agreed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS consent_version text,
  ADD COLUMN IF NOT EXISTS donor_pin text;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS zipcode text,
  ADD COLUMN IF NOT EXISTS date_needed date;

ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS otp text,
  ADD COLUMN IF NOT EXISTS units_donated integer DEFAULT 0;

-- Helper: drop every existing policy on a table (handles policies created
-- outside of migrations).
CREATE OR REPLACE FUNCTION pg_temp.drop_all_policies(tbl regclass)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT p.polname AS policyname
    FROM pg_policy p
    WHERE p.polrelid = tbl
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %s', pol.policyname, tbl);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1. Donor PIN moves to its own owner-only table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donor_secrets (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  pin text NOT NULL CHECK (pin ~ '^[0-9]{4}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.donor_secrets ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.donor_secrets');
CREATE POLICY "Owner reads own pin" ON public.donor_secrets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner creates own pin" ON public.donor_secrets
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner updates own pin" ON public.donor_secrets
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.donor_secrets (user_id, pin)
SELECT id, donor_pin FROM public.profiles
WHERE donor_pin ~ '^[0-9]{4}$'
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles SET donor_pin = NULL WHERE donor_pin IS NOT NULL;
UPDATE public.donations SET otp = NULL WHERE otp IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Request contact phone moves to its own table
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.request_contacts (
  request_id uuid PRIMARY KEY REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  contact_phone text NOT NULL
);
ALTER TABLE public.request_contacts ENABLE ROW LEVEL SECURITY;

INSERT INTO public.request_contacts (request_id, contact_phone)
SELECT id, contact_phone FROM public.blood_requests
WHERE contact_phone IS NOT NULL AND contact_phone <> ''
ON CONFLICT (request_id) DO NOTHING;

ALTER TABLE public.blood_requests ALTER COLUMN contact_phone DROP NOT NULL;
UPDATE public.blood_requests SET contact_phone = NULL WHERE contact_phone IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 3. Admin helper (unchanged semantics, pinned search_path)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- Cross-table checks used inside policies. They run with definer rights so a
-- blood_requests policy that looks at donations (and vice versa) doesn't
-- recurse through the other table's RLS.
CREATE OR REPLACE FUNCTION public.owns_request(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.blood_requests WHERE id = p_request_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.has_offered_on(p_request_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.donations WHERE request_id = p_request_id AND donor_id = auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- 4. profiles: owner + admin only. Public reads go through public_donors.
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.profiles');

CREATE POLICY "Owner reads own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Owner creates own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Owner updates own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins update all profiles" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Privileged columns can only be changed by admins or the service role.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW; -- service role, SQL editor, triggers, or an admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.verification_status := 'pending';
  ELSE
    NEW.role := OLD.role;
    NEW.verification_status := OLD.verification_status;
    NEW.donor_number := OLD.donor_number;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Public, non-sensitive view of donors. Runs with the view owner's rights so it
-- can read past RLS, and only ever exposes these columns.
DROP VIEW IF EXISTS public.public_donors;
CREATE VIEW public.public_donors AS
SELECT
  p.id,
  p.donor_number,
  p.blood_group,
  p.is_public_profile,
  p.city,
  p.present_zip,
  -- Full name only for donors who made their card public; otherwise "First L."
  CASE
    WHEN p.is_public_profile THEN p.full_name
    ELSE trim(split_part(coalesce(p.full_name, 'Donor'), ' ', 1) ||
      CASE WHEN position(' ' IN trim(coalesce(p.full_name, ''))) > 0
        THEN ' ' || upper(left(reverse(split_part(reverse(trim(p.full_name)), ' ', 1)), 1)) || '.'
        ELSE '' END)
  END AS display_name,
  -- Location rounded to ~1 km.
  CASE WHEN jsonb_typeof(p.location) = 'object'
            AND p.location ? 'latitude' AND p.location ? 'longitude'
            AND (p.location->>'latitude') ~ '^-?[0-9.]+$'
            AND (p.location->>'longitude') ~ '^-?[0-9.]+$'
    THEN jsonb_build_object(
      'latitude', round((p.location->>'latitude')::numeric, 2),
      'longitude', round((p.location->>'longitude')::numeric, 2))
  END AS approx_location
FROM public.profiles p
-- New accounts default to is_donor = true before registering, so also require a blood group.
WHERE p.is_donor = true AND p.blood_group IS NOT NULL;

REVOKE ALL ON public.public_donors FROM PUBLIC;
GRANT SELECT ON public.public_donors TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. blood_requests
-- ---------------------------------------------------------------------------
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.blood_requests');

CREATE POLICY "Anyone reads active requests" ON public.blood_requests
  FOR SELECT TO anon, authenticated USING (status = 'active');
CREATE POLICY "Owner reads own requests" ON public.blood_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Donors read requests they offered on" ON public.blood_requests
  FOR SELECT TO authenticated USING (public.has_offered_on(id));
CREATE POLICY "Admins read all requests" ON public.blood_requests
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Owner creates requests" ON public.blood_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'active');
CREATE POLICY "Owner updates own requests" ON public.blood_requests
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner deletes own requests" ON public.blood_requests
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage requests" ON public.blood_requests
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- request_contacts: owner writes; reads only through get_request_contact().
SELECT pg_temp.drop_all_policies('public.request_contacts');
CREATE POLICY "Owner manages contact" ON public.request_contacts
  FOR ALL TO authenticated
  USING (public.owns_request(request_id))
  WITH CHECK (public.owns_request(request_id));

-- ---------------------------------------------------------------------------
-- 6. donations
-- ---------------------------------------------------------------------------
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.donations');

CREATE POLICY "Donor reads own donations" ON public.donations
  FOR SELECT TO authenticated USING (auth.uid() = donor_id);
CREATE POLICY "Request owner reads offers" ON public.donations
  FOR SELECT TO authenticated USING (public.owns_request(request_id));
CREATE POLICY "Admins read all donations" ON public.donations
  FOR SELECT TO authenticated USING (public.is_admin());
-- Offers always start pending with no PIN; completion only via verify_donation().
CREATE POLICY "Donor creates pending offer" ON public.donations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = donor_id AND status = 'pending' AND otp IS NULL AND coalesce(units_donated, 0) = 0
  );
-- A donor can only withdraw their own pending offer.
CREATE POLICY "Donor withdraws own offer" ON public.donations
  FOR UPDATE TO authenticated
  USING (auth.uid() = donor_id AND status = 'pending')
  WITH CHECK (auth.uid() = donor_id AND status = 'cancelled');

-- ---------------------------------------------------------------------------
-- 7. RPCs
-- ---------------------------------------------------------------------------

-- Contact for a request: only its owner, a donor with a live offer, or an admin.
CREATE OR REPLACE FUNCTION public.get_request_contact(p_request_id uuid)
RETURNS TABLE (contact_name text, contact_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.contact_name, c.contact_phone
  FROM public.blood_requests r
  LEFT JOIN public.request_contacts c ON c.request_id = r.id
  WHERE r.id = p_request_id
    AND (
      r.user_id = auth.uid()
      OR public.is_admin()
      OR EXISTS (SELECT 1 FROM public.donations d
                 WHERE d.request_id = r.id AND d.donor_id = auth.uid() AND d.status <> 'cancelled')
    );
$$;

-- Donors who offered on the caller's requests (name always; phone only while open).
CREATE OR REPLACE FUNCTION public.get_my_request_donors()
RETURNS TABLE (donation_id uuid, request_id uuid, full_name text, phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.request_id, p.full_name,
         CASE WHEN r.status = 'active' THEN p.phone END
  FROM public.donations d
  JOIN public.blood_requests r ON r.id = d.request_id
  JOIN public.profiles p ON p.id = d.donor_id
  WHERE r.user_id = auth.uid() AND d.status <> 'cancelled';
$$;

-- Server-side PIN check. Completes the donation and closes the request once
-- enough units are in.
CREATE OR REPLACE FUNCTION public.verify_donation(p_donation_id uuid, p_pin text, p_units integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_donation public.donations%ROWTYPE;
  v_request public.blood_requests%ROWTYPE;
  v_pin text;
  v_total integer;
BEGIN
  SELECT * INTO v_donation FROM public.donations WHERE id = p_donation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Donation not found' USING ERRCODE = 'P0002'; END IF;

  SELECT * INTO v_request FROM public.blood_requests WHERE id = v_donation.request_id FOR UPDATE;
  IF v_request.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who posted this request can confirm donations' USING ERRCODE = '42501';
  END IF;
  IF v_donation.status <> 'pending' THEN
    RAISE EXCEPTION 'This offer is no longer pending' USING ERRCODE = '22023';
  END IF;
  IF p_units IS NULL OR p_units < 1 OR p_units > 20 THEN
    RAISE EXCEPTION 'Units must be between 1 and 20' USING ERRCODE = '22023';
  END IF;

  SELECT pin INTO v_pin FROM public.donor_secrets WHERE user_id = v_donation.donor_id;
  IF v_pin IS NULL OR v_pin <> p_pin THEN
    RAISE EXCEPTION 'PIN does not match' USING ERRCODE = '28000';
  END IF;

  UPDATE public.donations SET status = 'completed', units_donated = p_units WHERE id = p_donation_id;

  SELECT coalesce(sum(units_donated), 0) INTO v_total
  FROM public.donations WHERE request_id = v_request.id AND status = 'completed';

  IF v_total >= v_request.units_needed THEN
    UPDATE public.blood_requests SET status = 'fulfilled', updated_at = now() WHERE id = v_request.id;
  END IF;

  RETURN jsonb_build_object(
    'total_collected', v_total,
    'units_needed', v_request.units_needed,
    'fulfilled', v_total >= v_request.units_needed
  );
END $$;

-- Public donation activity for a donor card (public profiles, or yourself).
CREATE OR REPLACE FUNCTION public.public_donor_activity(p_donor_id uuid)
RETURNS TABLE (created_at timestamptz, status text, urgency_level text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.created_at, d.status, r.urgency_level
  FROM public.donations d
  LEFT JOIN public.blood_requests r ON r.id = d.request_id
  JOIN public.profiles p ON p.id = d.donor_id
  WHERE d.donor_id = p_donor_id
    AND d.status = 'completed'
    AND (p.is_public_profile OR p.id = auth.uid())
  ORDER BY d.created_at DESC;
$$;

-- Aggregate numbers for the landing page.
CREATE OR REPLACE FUNCTION public.public_stats()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'donors', (SELECT count(*) FROM public.profiles WHERE is_donor AND blood_group IS NOT NULL),
    'open', (SELECT count(*) FROM public.blood_requests
             WHERE status = 'active' AND (date_needed IS NULL OR date_needed >= current_date)),
    'fulfilled', (SELECT count(*) FROM public.blood_requests WHERE status = 'fulfilled')
  );
$$;

REVOKE ALL ON FUNCTION public.get_request_contact(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_request_donors() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_donation(uuid, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_request_contact(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_request_donors() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_donation(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_donor_activity(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_stats() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Notifications: nobody but the server may create them
-- ---------------------------------------------------------------------------
DO $$
DECLARE fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'create_notification'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.sig);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.handle_new_user() SET search_path = public';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. push_subscriptions and user_activity_logs (previously unmigrated)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.push_subscriptions'::regclass AND contype IN ('u', 'p')
      AND pg_get_constraintdef(oid) ILIKE '%(user_id, subscription)%'
  ) THEN
    ALTER TABLE public.push_subscriptions
      ADD CONSTRAINT push_subscriptions_user_subscription_key UNIQUE (user_id, subscription);
  END IF;
END $$;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.push_subscriptions');
CREATE POLICY "Owner manages own subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.user_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
SELECT pg_temp.drop_all_policies('public.user_activity_logs');
CREATE POLICY "Users log their own activity" ON public.user_activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins read activity" ON public.user_activity_logs
  FOR SELECT TO authenticated USING (public.is_admin());
