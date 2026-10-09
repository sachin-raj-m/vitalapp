/*
  # Phone verification by WhatsApp code

  SMS isn't available, so phone numbers are confirmed with a 6-digit code sent
  on WhatsApp (app/api/profile/phone). Until WhatsApp is switched on, numbers
  are saved without a code, as at registration.

  1. profiles.phone_verified_at: set only by the server after a correct code.
     Any change to the number by the user clears it.
  2. phone_change_codes: one pending code per user (hashed), server only.
*/

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;

CREATE TABLE IF NOT EXISTS public.phone_change_codes (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  new_phone text NOT NULL,
  code_hash text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.phone_change_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.phone_change_codes FROM anon, authenticated;

-- Column guard: as in 20261009000100, plus phone_verified_at.
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
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
