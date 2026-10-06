/*
  # FIX: Allow Public Read Access to Donations
  
  The "Total Donations" and "Achievements" on the public profile were showing 0
  because the RLS policy only allowed users to see their OWN donations.
  
  This migration:
  1. Drops the restrictive policy.
  2. Adds a policy allowing EVERYONE (anon/authenticated) to read donations.
     (This is necessary for the public profile to count your donations).
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Users can view their own donations" ON public.donations;

-- Allow anyone to read donations (needed for public impact stats)
CREATE POLICY "Public read access"
  ON public.donations
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Ensure authenticated users can still insert/manage their own
-- (Existing "Users can create donations" policy remains untouched or can be re-asserted if needed, 
-- but strictly speaking 'FOR SELECT' is separate from 'FOR INSERT')
