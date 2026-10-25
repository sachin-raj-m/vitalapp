/*
  # Posting a blood request over WhatsApp

  A person messages Vital's WhatsApp number with what they need ("need O+
  blood, 2 units at Medical College Kozhikode"). The bot (lib/whatsapp-bot.ts,
  lib/whatsapp-request.ts) asks only for what's missing, one question at a
  time, shows a summary with [Post request] [Edit] [Cancel], and only then
  creates the request, alerts donors and replies with the share link. Behind
  WHATSAPP_ENABLED=true and WHATSAPP_REQUESTS=true.

  1. whatsapp_sessions: one row per number, as before. A row with
     awaiting = 'request' is a request being drafted:
       step   the question we're waiting on (or 'confirm' / 'edit')
       draft  what we have so far (blood group, units, hospital, place, date,
              contact). Never a donor's details: only what the sender typed
              and the place we geocoded from it.
     Drafts expire after 30 minutes of silence (expires_at, set by the bot).
     Nothing is written to blood_requests until [Post request].

  2. whatsapp_messages.kind stays free text; new kinds used by the bot:
       request_flow    a question or summary while drafting
       request_posted  "Your request is live" (also the daily-cap counter:
                       at most 3 per number per 24 hours)
     The column gets an index on (wa_number, kind, created_at) for that count.

  3. wa_account_for(p_wa): the account that has PROVEN it holds a WhatsApp
     number, so a request sent from that number can be posted on it:
       - the auth account whose sign-in phone is that number, confirmed
         (phone sign-in, or a number verified in Settings: both set it,
         20261022000100), else
       - the profile with that number verified (phone_verified_at).
     A profile that merely typed the number (unverified) is NOT returned: the
     WhatsApp sender may be someone else. When nothing is returned the server
     creates a phone-only account with the number confirmed (Supabase admin
     createUser, phone_confirm: true); sync_profile_phone_from_auth then
     verifies it on the new profile and releases it from unverified holders,
     exactly as a phone sign-in does. One verified account per number holds.
     Service role only.

  4. wa_requests_posted_today(p_wa): how many requests this number posted from
     WhatsApp in the last 24 hours. Service role only.

  Idempotent: safe to run twice.
*/

-- 1. Drafts in whatsapp_sessions ---------------------------------------------
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS step text,
  ADD COLUMN IF NOT EXISTS draft jsonb;

ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_awaiting_check;
ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_awaiting_check
  CHECK (awaiting IN ('pin', 'self_check', 'request'));

ALTER TABLE public.whatsapp_sessions DROP CONSTRAINT IF EXISTS whatsapp_sessions_request_draft_check;
ALTER TABLE public.whatsapp_sessions ADD CONSTRAINT whatsapp_sessions_request_draft_check
  CHECK (
    (awaiting = 'request'
      AND step IS NOT NULL AND draft IS NOT NULL
      AND step IN ('blood_group', 'units', 'hospital', 'date', 'contact_name', 'contact_phone', 'confirm', 'edit')
      AND jsonb_typeof(draft) = 'object'
      AND octet_length(draft::text) <= 4096)
    OR (awaiting <> 'request' AND step IS NULL AND draft IS NULL)
  );

-- 2. Counting posts per number ------------------------------------------------
CREATE INDEX IF NOT EXISTS whatsapp_messages_number_kind_idx
  ON public.whatsapp_messages (wa_number, kind, created_at);

-- 3. The account that has proven a number ------------------------------------
CREATE OR REPLACE FUNCTION public.wa_account_for(p_wa text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM (
    SELECT u.id, 1 AS rank, u.created_at
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE public.wa_number(p_wa) IS NOT NULL
      AND public.wa_number(u.phone) = public.wa_number(p_wa)
      AND u.phone_confirmed_at IS NOT NULL
    UNION ALL
    SELECT p.id, 2 AS rank, p.created_at
    FROM public.profiles p
    WHERE public.wa_number(p_wa) IS NOT NULL
      AND public.wa_number(p.phone) = public.wa_number(p_wa)
      AND p.phone_verified_at IS NOT NULL
  ) x
  ORDER BY rank, created_at DESC NULLS LAST
  LIMIT 1;
$$;

-- 4. Requests posted from a number in the last 24 hours ----------------------
CREATE OR REPLACE FUNCTION public.wa_requests_posted_today(p_wa text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*)::integer FROM public.whatsapp_messages
  WHERE direction = 'out' AND kind = 'request_posted'
    AND wa_number = public.wa_number(p_wa)
    AND created_at > now() - interval '24 hours';
$$;

REVOKE ALL ON FUNCTION public.wa_account_for(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wa_requests_posted_today(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wa_account_for(text), public.wa_requests_posted_today(text) TO service_role;
