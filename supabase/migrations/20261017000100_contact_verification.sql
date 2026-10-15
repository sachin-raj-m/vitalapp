/*
  # Contact verification: email and mobile number, one account per contact

  An account is fully verified when its email is confirmed AND its mobile
  number is verified. Anything less is "pending verification" (shown in the
  app's banner and the admin page).

  1. Email
     - profiles.email_verified_at mirrors auth.users.email_confirmed_at, and
       profiles.email follows auth.users.email (a trigger on auth.users keeps
       both in step, including after an email change). Users can't write either.
     - profiles.email is unique ignoring case (auth already keeps sign-in
       emails unique; this stops a profile copy from colliding).

  2. Mobile number, verified on WhatsApp without a template
     - The app shows a code; the person sends "VERIFY <code>" to Vital's
       WhatsApp number (app/api/profile/phone/whatsapp, lib/whatsapp-bot.ts).
       Codes are kept hashed in verification_codes with purpose
       'phone_whatsapp' and the number in payload.wa; they expire after 15
       minutes.
     - confirm_phone_for() (service role) sets phone_verified_at once the code
       matches AND the message came from the profile's own number.
     - One verified account per number: a partial unique index on
       wa_number(phone) WHERE phone_verified_at IS NOT NULL. Existing unverified
       duplicates are left alone.
     - Nobody can save a number another account has verified (refuse_taken_phone).
     - When a number is verified, other accounts still holding it unverified
       lose it: phone is cleared, WhatsApp alerts are turned off and
       phone_released_at is stamped, so the app asks them for their own number.
       The verified owner proved they hold the number; the others hadn't.
     - Changing the number (by anyone, admins included) clears its
       verification unless the same write sets a new phone_verified_at.
     - profile_for_wa() prefers the verified holder of a number.

  3. profiles.verification_status stays as the admin's own review ("trusted
     donor"); it no longer stands for contact verification.
*/

-- 1. Email -------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_released_at timestamptz;

-- Bring every profile in line with its sign-in account.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE u.id = p.id AND u.email IS NOT NULL AND p.email IS DISTINCT FROM u.email;

UPDATE public.profiles p
SET email_verified_at = u.email_confirmed_at
FROM auth.users u
WHERE u.id = p.id AND p.email_verified_at IS DISTINCT FROM u.email_confirmed_at;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles GROUP BY lower(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'Two profiles share an email (ignoring case). Merge or fix them before applying this migration.';
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key ON public.profiles (lower(email));

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET email = coalesce(NEW.email, email),
      email_verified_at = NEW.email_confirmed_at
  WHERE id = NEW.id
    AND (email IS DISTINCT FROM coalesce(NEW.email, email) OR email_verified_at IS DISTINCT FROM NEW.email_confirmed_at);
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
-- Named to run after on_auth_user_created, which makes the profile row.
DROP TRIGGER IF EXISTS sync_profile_email ON auth.users;
CREATE TRIGGER sync_profile_email
  AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- 2. Mobile number -----------------------------------------------------------

ALTER TABLE public.verification_codes DROP CONSTRAINT IF EXISTS verification_codes_purpose_check;
ALTER TABLE public.verification_codes ADD CONSTRAINT verification_codes_purpose_check
  CHECK (purpose IN ('blood_group_change', 'phone_whatsapp'));
CREATE INDEX IF NOT EXISTS verification_codes_wa_idx
  ON public.verification_codes ((payload->>'wa')) WHERE purpose = 'phone_whatsapp';

-- Pure function; the unique index below evaluates it on every profile write,
-- including users' own, so they need to be able to run it.
GRANT EXECUTE ON FUNCTION public.wa_number(text) TO authenticated, service_role;

-- No production number is verified yet, but keep only the first verification
-- of any number so the index can always be built.
UPDATE public.profiles p
SET phone_verified_at = NULL
WHERE p.phone_verified_at IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles o
    WHERE o.id <> p.id AND o.phone_verified_at IS NOT NULL
      AND public.wa_number(o.phone) = public.wa_number(p.phone)
      AND (o.phone_verified_at, o.id) < (p.phone_verified_at, p.id)
  );
CREATE UNIQUE INDEX IF NOT EXISTS profiles_verified_wa_key
  ON public.profiles (public.wa_number(phone))
  WHERE phone_verified_at IS NOT NULL;

-- Runs after protect_profile_privileged_columns (triggers fire by name).
CREATE OR REPLACE FUNCTION public.refuse_taken_phone()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wa text := public.wa_number(NEW.phone);
BEGIN
  -- Same number: the unique index covers a second verification.
  IF TG_OP = 'UPDATE' AND NEW.phone IS NOT DISTINCT FROM OLD.phone THEN
    RETURN NEW;
  END IF;
  -- A different number isn't verified, unless this same write verifies it.
  IF TG_OP = 'UPDATE' AND NEW.phone_verified_at IS NOT DISTINCT FROM OLD.phone_verified_at
     AND public.wa_number(NEW.phone) IS DISTINCT FROM public.wa_number(OLD.phone) THEN
    NEW.phone_verified_at := NULL;
  END IF;
  IF v_wa IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id <> NEW.id AND phone_verified_at IS NOT NULL AND public.wa_number(phone) = v_wa
  ) THEN
    RAISE EXCEPTION 'This number is already registered to another Vital account'
      USING ERRCODE = '23505', HINT = 'phone_taken';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.refuse_taken_phone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS refuse_taken_phone ON public.profiles;
CREATE TRIGGER refuse_taken_phone
  BEFORE INSERT OR UPDATE OF phone, phone_verified_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.refuse_taken_phone();

-- p_user sent the right code from p_wa. Returns 'verified', 'already_verified',
-- 'number_changed' (the profile's number isn't p_wa any more) or 'taken'.
CREATE OR REPLACE FUNCTION public.confirm_phone_for(p_user uuid, p_wa text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wa text := public.wa_number(p_wa);
  v_me public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_me FROM public.profiles WHERE id = p_user FOR UPDATE;
  IF NOT FOUND OR v_wa IS NULL OR public.wa_number(v_me.phone) IS DISTINCT FROM v_wa THEN
    RETURN 'number_changed';
  END IF;
  IF v_me.phone_verified_at IS NOT NULL THEN
    DELETE FROM public.verification_codes WHERE user_id = p_user AND purpose = 'phone_whatsapp';
    RETURN 'already_verified';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id <> p_user AND phone_verified_at IS NOT NULL AND public.wa_number(phone) = v_wa) THEN
    RETURN 'taken';
  END IF;

  -- Other accounts holding this number unverified give it up.
  UPDATE public.profiles
  SET phone = NULL, whatsapp_alerts = false, phone_released_at = now()
  WHERE id <> p_user AND phone_verified_at IS NULL AND public.wa_number(phone) = v_wa;
  DELETE FROM public.verification_codes WHERE purpose = 'phone_whatsapp' AND payload->>'wa' = v_wa;

  UPDATE public.profiles SET phone_verified_at = now(), phone_released_at = NULL WHERE id = p_user;
  RETURN 'verified';
END $$;
REVOKE ALL ON FUNCTION public.confirm_phone_for(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_phone_for(uuid, text) TO service_role;

-- As in 20261009000200, but a verified holder of the number comes first.
CREATE OR REPLACE FUNCTION public.profile_for_wa(p_wa text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.profiles
  WHERE public.wa_number(phone) = public.wa_number(p_wa)
  ORDER BY (phone_verified_at IS NOT NULL) DESC, whatsapp_alerts DESC, created_at DESC NULLS LAST
  LIMIT 1;
$$;

-- 3. Column guard: as in 20261015000100, plus email, email_verified_at and
-- phone_released_at, which only the server sets.
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
    NEW.phone_released_at := NULL;
    -- The profile's email is the sign-in email.
    SELECT coalesce(u.email, NEW.email), u.email_confirmed_at INTO NEW.email, NEW.email_verified_at
    FROM auth.users u WHERE u.id = NEW.id;
    IF NOT FOUND THEN NEW.email_verified_at := NULL; END IF;
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
    -- Entering a number again answers "your number was released".
    NEW.phone_released_at := CASE WHEN NEW.phone IS DISTINCT FROM OLD.phone THEN NULL ELSE OLD.phone_released_at END;
    -- Blood group: first-time set only; changes go through the code-checked API.
    IF OLD.blood_group IS NOT NULL AND NEW.blood_group IS DISTINCT FROM OLD.blood_group THEN
      RAISE EXCEPTION 'Your blood group can only be changed once, from Settings, with a code sent to your email'
        USING ERRCODE = '23514';
    END IF;
    NEW.blood_group_changed_at := OLD.blood_group_changed_at;
    NEW.blood_group_previous := OLD.blood_group_previous;
    -- Email follows the sign-in account (sync_profile_email).
    NEW.email := OLD.email;
    NEW.email_verified_at := OLD.email_verified_at;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;
