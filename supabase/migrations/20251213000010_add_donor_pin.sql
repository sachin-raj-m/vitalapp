-- Add donor_pin column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS donor_pin text CHECK (length(donor_pin) = 4);

-- Comment to explain the column
COMMENT ON COLUMN public.profiles.donor_pin IS 'Persistent 4-digit PIN for verifying donations';
