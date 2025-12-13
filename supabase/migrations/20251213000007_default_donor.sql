-- Make all new users donors by default
ALTER TABLE public.profiles 
ALTER COLUMN is_donor SET DEFAULT true;

-- Update existing users to be donors (optional, but requested "all users")
UPDATE public.profiles
SET is_donor = true
WHERE is_donor = false;
