/*
  # Fix Owner Access Policy
  
  1. Security Changes
    - Ensure users can ALWAYS read their own profile, regardless of `is_public_profile` status.
    - This fixes the issue where a user visits their own public link (e.g. to preview) and gets a 404/Access Denied if it is currently private.
*/

-- The base migration (20250508141532) already creates this policy, so drop it
-- first to keep a from-scratch replay working. End state is unchanged.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
