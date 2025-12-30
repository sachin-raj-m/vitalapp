/*
  # CRITICAL FIX: Simplify Profile Access Policies
  
  The previous RLS policies were too restrictive and caused 404 errors.
  
  This migration:
  1. Drops ALL existing profile SELECT policies
  2. Creates ONE simple policy: Anyone can read donor profiles
  3. The is_public_profile check is now done in APPLICATION CODE (not RLS)
  
  This allows the page to LOAD and show "Profile is Private" instead of 404.
*/

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Public can read donor profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can read public profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;

-- Create ONE simple policy: Anyone (anon or authenticated) can read ANY donor's basic profile
-- The is_public_profile visibility check is handled in APPLICATION CODE
CREATE POLICY "Anyone can read basic donor info"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_donor = true);

-- Ensure authenticated users can still read their OWN profile even if not a donor
CREATE POLICY "Users can always read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);
