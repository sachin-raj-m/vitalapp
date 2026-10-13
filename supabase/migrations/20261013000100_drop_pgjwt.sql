/*
  # Drop the unused pgjwt extension

  Supabase installed pgjwt by default on older projects. Nothing in Vital uses
  it (no functions, views or policies depend on it), and Postgres 17 doesn't
  support it, so it blocks the security upgrade of vital-prod from Postgres 15.
  Staging (created on Postgres 17) never had it, hence IF EXISTS.
*/
DROP EXTENSION IF EXISTS pgjwt;
