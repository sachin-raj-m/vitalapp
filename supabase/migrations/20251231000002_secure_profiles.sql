/*
  # Secure Profile Access
  
  1. Security Changes
    - Update "Public can read donor profiles" policy to ONLY allow reading profiles 
      where `is_public_profile` is true.
    - This ensures users who toggle "Private" are actually private data-wise.
*/

DROP POLICY IF EXISTS "Public can read donor profiles" ON public.profiles;

CREATE POLICY "Public can read public profiles"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_public_profile = true);
