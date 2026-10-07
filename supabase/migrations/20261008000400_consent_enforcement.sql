/*
  # Consent enforcement (server side)

  QA: the consent checkbox on the sign-up forms is only checked in the
  browser. Supabase sign-up goes straight from the browser to Supabase Auth,
  so app code cannot stop an un-consented account being created. This
  migration adds the guarantees the database can give:

  1. profiles: a BEFORE INSERT/UPDATE trigger rejects making a profile a donor
     (insert with is_donor = true, or is_donor false -> true) unless consent is
     recorded on the row (consent_agreed = true, consent_at and
     consent_version set). It also rejects clearing the consent of a donor who
     has it. Legacy donors that were donors before this migration and have no
     consent recorded are left alone (grandfathered) so existing rows and
     their ordinary profile edits keep working; they should be asked to
     re-consent in the app.

  2. blood_requests: a BEFORE INSERT trigger rejects a new request unless the
     poster's profile has consent recorded. Existing requests are untouched.

  3. public.hook_before_user_created(event jsonb): a Supabase Auth
     "Before User Created" hook. It rejects email/password and email-code
     (OTP) sign-ups whose user_metadata lacks consent_agreed = true and a
     consent_version, and allows every other provider (Google etc.), because
     those accounts must still pass complete-registration's explicit consent
     before they can become donors (1) or post a request (2).
     NOT ENABLED by this migration: enable it in Dashboard -> Authentication
     -> Hooks -> "Before User Created" -> Postgres -> public.hook_before_user_created
     (or Management API: hook_before_user_created_enabled = true,
     hook_before_user_created_uri = 'pg-functions://postgres/public/hook_before_user_created').

  Errors use SQLSTATE 23514 (check_violation), which PostgREST returns as 400.
*/

-- ---------------------------------------------------------------------------
-- Shared predicate
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consent_is_recorded(p_agreed boolean, p_at timestamptz, p_version text)
RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT coalesce(p_agreed, false) AND p_at IS NOT NULL AND coalesce(btrim(p_version), '') <> ''
$$;

-- ---------------------------------------------------------------------------
-- 1. Donors must have consent recorded
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_donor_consent()
RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.is_donor IS NOT TRUE
     OR public.consent_is_recorded(NEW.consent_agreed, NEW.consent_at, NEW.consent_version) THEN
    RETURN NEW;
  END IF;

  -- Grandfather legacy donors: already a donor and never had consent recorded.
  IF TG_OP = 'UPDATE' AND OLD.is_donor IS TRUE
     AND NOT public.consent_is_recorded(OLD.consent_agreed, OLD.consent_at, OLD.consent_version) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Agree to the Terms and Privacy notice before registering as a donor'
    USING ERRCODE = '23514',
          HINT = 'Set consent_agreed, consent_at and consent_version in the same write that sets is_donor.';
END $$;

DROP TRIGGER IF EXISTS enforce_donor_consent ON public.profiles;
CREATE TRIGGER enforce_donor_consent
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_donor_consent();

-- ---------------------------------------------------------------------------
-- 2. Posting a request needs consent recorded on the poster's profile
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the lookup works whatever the caller can read.
CREATE OR REPLACE FUNCTION public.enforce_request_consent()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.user_id
      AND public.consent_is_recorded(p.consent_agreed, p.consent_at, p.consent_version)
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Agree to the Terms and Privacy notice before posting a request'
    USING ERRCODE = '23514';
END $$;

DROP TRIGGER IF EXISTS enforce_request_consent ON public.blood_requests;
CREATE TRIGGER enforce_request_consent
  BEFORE INSERT ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.enforce_request_consent();

-- consent_is_recorded is a pure, non-definer predicate; it stays executable by
-- every role so the profiles trigger works whoever writes the row.
REVOKE ALL ON FUNCTION public.enforce_donor_consent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_request_consent() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auth hook: Before User Created
-- ---------------------------------------------------------------------------
-- Event shape (Supabase docs, before-user-created):
--   { "metadata": {...}, "user": { "email", "phone",
--     "app_metadata": {"provider": "email", "providers": [...]},
--     "user_metadata": {...}, "identities": [...], "is_anonymous": bool } }
-- Return '{}' to allow, or {"error": {"http_code": 400, "message": "..."}} to reject.
-- Read defensively: also accepts raw_user_meta_data / raw_app_meta_data and
-- falls back to the first identity's provider. An unknown provider is treated
-- as email (strict).
CREATE OR REPLACE FUNCTION public.hook_before_user_created(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  u        jsonb := CASE WHEN jsonb_typeof(event->'user') = 'object' THEN event->'user' ELSE '{}'::jsonb END;
  meta     jsonb;
  app      jsonb;
  provider text;
  agreed   text;
  version  text;
BEGIN
  meta := CASE WHEN jsonb_typeof(u->'raw_user_meta_data') = 'object' THEN u->'raw_user_meta_data' ELSE '{}'::jsonb END
       || CASE WHEN jsonb_typeof(u->'user_metadata') = 'object' THEN u->'user_metadata' ELSE '{}'::jsonb END;
  app  := CASE WHEN jsonb_typeof(u->'raw_app_meta_data') = 'object' THEN u->'raw_app_meta_data' ELSE '{}'::jsonb END
       || CASE WHEN jsonb_typeof(u->'app_metadata') = 'object' THEN u->'app_metadata' ELSE '{}'::jsonb END;

  provider := lower(coalesce(
    nullif(btrim(app->>'provider'), ''),
    CASE WHEN jsonb_typeof(u->'identities') = 'array' THEN nullif(btrim(u->'identities'->0->>'provider'), '') END,
    'email'));

  -- OAuth / SSO sign-ups can't carry metadata; complete-registration collects
  -- consent and the triggers above stop them becoming donors or posting without it.
  IF provider NOT IN ('email', 'phone') THEN
    RETURN '{}'::jsonb;
  END IF;

  agreed  := lower(coalesce(meta->>'consent_agreed', ''));
  version := btrim(coalesce(meta->>'consent_version', ''));
  IF agreed = 'true' AND version <> '' THEN
    RETURN '{}'::jsonb;
  END IF;

  RETURN jsonb_build_object('error', jsonb_build_object(
    'http_code', 400,
    'message', 'Please agree to the Terms and Privacy notice before creating an account.'));
END $$;

REVOKE ALL ON FUNCTION public.hook_before_user_created(jsonb) FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    GRANT EXECUTE ON FUNCTION public.hook_before_user_created(jsonb) TO supabase_auth_admin;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    REVOKE ALL ON FUNCTION public.hook_before_user_created(jsonb) FROM service_role;
  END IF;
END $$;
