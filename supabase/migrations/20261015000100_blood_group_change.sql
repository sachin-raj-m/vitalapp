/*
  # Blood group: set once at registration, changed at most once afterwards, with a code

  A wrong blood group sends alerts to the wrong donors, so changing it is
  controlled in the database, not only in the app:

  1. Setting the blood group for the first time (NULL -> value, at
     registration) stays allowed.
  2. After that, users can't change it directly. A change goes through
     app/api/profile/blood-group, which emails a 6-digit code and applies the
     change with the service role once the code is entered.
  3. Only one such change per profile: blood_group_changed_at records it and the
     API refuses a second one. blood_group_previous keeps the old value.
  4. Admins (and the service role) can still correct it.

  verification_codes holds pending codes (hashed), one per user and purpose;
  only the server reads it.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blood_group_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS blood_group_previous text;

CREATE TABLE IF NOT EXISTS public.verification_codes (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('blood_group_change')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, purpose)
);
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verification_codes FROM anon, authenticated;

-- Column guard: as in 20261009000300, plus the blood group rules above.
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin() THEN
    RETURN NEW; -- service role, SQL editor, triggers, or an admin
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.role := 'user';
    NEW.verification_status := 'pending';
    NEW.referral_code := NULL;
    NEW.referred_by := NULL;
    NEW.phone_verified_at := NULL;
    NEW.blood_group_changed_at := NULL;
    NEW.blood_group_previous := NULL;
  ELSE
    NEW.role := OLD.role;
    NEW.verification_status := OLD.verification_status;
    NEW.donor_number := OLD.donor_number;
    NEW.id := OLD.id;
    IF coalesce(current_setting('vital.referral_write', true), '') <> 'on' THEN
      NEW.referral_code := OLD.referral_code;
      NEW.referred_by := OLD.referred_by;
    END IF;
    -- A user-made change to the number means it's no longer verified.
    NEW.phone_verified_at := CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone THEN NULL ELSE OLD.phone_verified_at END;
    -- Blood group: first-time set only; changes go through the code-checked API.
    IF OLD.blood_group IS NOT NULL AND NEW.blood_group IS DISTINCT FROM OLD.blood_group THEN
      RAISE EXCEPTION 'Your blood group can only be changed once, from Settings, with a code sent to your email'
        USING ERRCODE = '23514';
    END IF;
    NEW.blood_group_changed_at := OLD.blood_group_changed_at;
    NEW.blood_group_previous := OLD.blood_group_previous;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
