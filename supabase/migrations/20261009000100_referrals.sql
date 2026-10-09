/*
  # Referrals (recognition only)

  Every donor gets a short referral code (vitalapp.in/r/CODE). When someone
  who opened that link registers as a donor, the referrer gets credit. Credit
  is shown as points and badges on the Milestones page. It has no exchange
  value: nothing here can be redeemed, and points are never given for donating
  on someone's behalf.

  Abuse limits, enforced in claim_referral():
    - only the new donor can claim, once, for themselves;
    - the claimant must be a donor with consent recorded;
    - the claimant's account must be under 14 days old (no backdating);
    - no self-referral;
    - at most 10 credited referrals per referrer per day.

  referral_code and referred_by can't be written directly by users; the
  profile column guard below keeps them as they were, except inside these
  functions, which set the transaction-local flag vital.referral_write. (The
  API can't call set_config: pg_catalog isn't an exposed schema.)
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key ON public.profiles (referral_code);

CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_id <> referee_id)
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON public.referrals (referrer_id, created_at);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
-- No policies: read and written only through the functions below.
REVOKE ALL ON public.referrals FROM anon, authenticated;

-- Column guard: same as 20261006000000, plus the two referral columns.
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
  ELSE
    NEW.role := OLD.role;
    NEW.verification_status := OLD.verification_status;
    NEW.donor_number := OLD.donor_number;
    NEW.id := OLD.id;
    IF coalesce(current_setting('vital.referral_write', true), '') <> 'on' THEN
      NEW.referral_code := OLD.referral_code;
      NEW.referred_by := OLD.referred_by;
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC, anon, authenticated;

-- A donor's referral code, created on first use: up to 6 letters of their
-- first name plus 3 digits, e.g. ASHA482. NULL for non-donors. Callable only
-- by the server (service role), e.g. for the thank-you email; signed-in users
-- use get_my_referral_code() below.
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code text;
  v_name text;
  v_prefix text;
BEGIN
  SELECT referral_code, full_name INTO v_code, v_name
  FROM public.profiles WHERE id = p_user AND is_donor = true;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF v_code IS NOT NULL THEN RETURN v_code; END IF;
  PERFORM set_config('vital.referral_write', 'on', true);

  v_prefix := left(upper(regexp_replace(split_part(coalesce(btrim(v_name), ''), ' ', 1), '[^A-Za-z]', '', 'g')), 6);
  IF length(v_prefix) < 2 THEN v_prefix := 'VITAL'; END IF;
  FOR i IN 1..20 LOOP
    v_code := v_prefix || lpad((floor(random() * 1000))::int::text, 3, '0');
    BEGIN
      UPDATE public.profiles SET referral_code = v_code WHERE id = p_user;
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- taken; try another number
    END;
  END LOOP;
  -- Very common name: fall back to a longer random suffix.
  v_code := v_prefix || lpad((floor(random() * 1000000))::int::text, 6, '0');
  UPDATE public.profiles SET referral_code = v_code WHERE id = p_user;
  RETURN v_code;
END $$;
REVOKE ALL ON FUNCTION public.ensure_referral_code(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code(uuid) TO service_role;

-- The signed-in donor's own code.
CREATE OR REPLACE FUNCTION public.get_my_referral_code()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;
  RETURN public.ensure_referral_code(auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.get_my_referral_code() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_code() TO authenticated;

-- Called by a newly registered donor with the code from the link they opened.
-- Returns 'credited' or a reason it was not ('invalid', 'self', 'already',
-- 'not_donor', 'too_old', 'limit').
CREATE OR REPLACE FUNCTION public.claim_referral(p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me public.profiles%ROWTYPE;
  v_referrer uuid;
  v_created timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in first' USING ERRCODE = '42501'; END IF;

  SELECT id INTO v_referrer FROM public.profiles
  WHERE referral_code = upper(btrim(coalesce(p_code, ''))) AND is_donor = true;
  IF v_referrer IS NULL THEN RETURN 'invalid'; END IF;
  IF v_referrer = auth.uid() THEN RETURN 'self'; END IF;

  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid() FOR UPDATE;
  IF v_me.referred_by IS NOT NULL OR EXISTS (SELECT 1 FROM public.referrals WHERE referee_id = auth.uid()) THEN
    RETURN 'already';
  END IF;
  IF NOT coalesce(v_me.is_donor, false)
     OR NOT public.consent_is_recorded(v_me.consent_agreed, v_me.consent_at, v_me.consent_version) THEN
    RETURN 'not_donor';
  END IF;

  SELECT created_at INTO v_created FROM auth.users WHERE id = auth.uid();
  IF v_created IS NULL OR v_created < now() - interval '14 days' THEN RETURN 'too_old'; END IF;

  -- Serialise claims per referrer so the daily cap holds under concurrency.
  PERFORM 1 FROM public.profiles WHERE id = v_referrer FOR UPDATE;
  IF (SELECT count(*) FROM public.referrals WHERE referrer_id = v_referrer AND created_at > now() - interval '1 day') >= 10 THEN
    RETURN 'limit';
  END IF;

  INSERT INTO public.referrals (referrer_id, referee_id) VALUES (v_referrer, auth.uid());
  PERFORM set_config('vital.referral_write', 'on', true);
  UPDATE public.profiles SET referred_by = v_referrer WHERE id = auth.uid();
  RETURN 'credited';
END $$;
REVOKE ALL ON FUNCTION public.claim_referral(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_referral(text) TO authenticated;

-- How many donors the caller has brought in. No names: the referee's identity
-- isn't shown to the referrer.
CREATE OR REPLACE FUNCTION public.get_my_referral_count()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::int FROM public.referrals WHERE referrer_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_referral_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_referral_count() TO authenticated;

-- Top referrers, for signed-in users. Only donors with a public card are
-- listed, by short name ("First L.").
CREATE OR REPLACE FUNCTION public.referral_leaderboard(p_limit integer DEFAULT 10)
RETURNS TABLE (display_name text, referrals integer, is_me boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.donor_short_name(p.full_name), count(*)::int, p.id = auth.uid()
  FROM public.referrals r
  JOIN public.profiles p ON p.id = r.referrer_id
  WHERE p.is_public_profile = true AND p.is_donor = true
  GROUP BY p.id, p.full_name
  ORDER BY count(*) DESC, min(r.created_at)
  LIMIT least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.referral_leaderboard(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.referral_leaderboard(integer) TO authenticated;
