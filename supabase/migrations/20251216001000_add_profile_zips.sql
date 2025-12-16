-- Add permanent_zip and present_zip to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS permanent_zip TEXT,
ADD COLUMN IF NOT EXISTS present_zip TEXT;

-- Create index for faster geolocation mapping later
CREATE INDEX IF NOT EXISTS idx_profiles_permanent_zip ON profiles(permanent_zip);
CREATE INDEX IF NOT EXISTS idx_profiles_present_zip ON profiles(present_zip);
