/*
  # WhatsApp: remember the units to confirm

  When a requester confirms a donation on WhatsApp they now choose how many
  units were donated before typing the donor's PIN (it was always 1). The
  choice waits here until the PIN arrives; verify_donation_for() still checks it
  against the units the request needs.
*/
ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS units integer CHECK (units BETWEEN 1 AND 20);
