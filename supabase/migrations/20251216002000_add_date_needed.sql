-- Add date_needed column to blood_requests table
ALTER TABLE public.blood_requests
ADD COLUMN IF NOT EXISTS date_needed date;

-- Update existing requests to have a default date_needed (e.g., created_at + 2 days)
-- This prevents issues with null values in UI
UPDATE public.blood_requests
SET date_needed = (created_at + interval '2 days')::date
WHERE date_needed IS NULL;
