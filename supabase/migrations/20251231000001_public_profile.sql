/*
  # Add Public Profile Visibility Toggle

  1. Changes
    - Add `is_public_profile` column to `profiles` table (default: false)
    - Add index for faster filtering
*/

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_public_profile BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_public ON public.profiles(is_public_profile);
