/*
  # Remove the lifetime donor PINs

  Since 20261017000600 every offer has its own PIN (donation_pins), and nothing
  reads donor_secrets any more: verify_donation_for() checks the offer's PIN and
  create_offer_for() no longer creates a lifetime one. Drop the table and the
  PINs in it.
*/

DROP TABLE IF EXISTS public.donor_secrets;
