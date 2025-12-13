/*
  # Add OTP to donations table

  1. Changes
    - Add `otp` column to `donations` table (text, nullable initially)
  
  2. Security
    - Add RLS policy for Requestees to view donations linked to their requests
    - This allows the creator of a blood request to see who has offered to donate and verify the OTP
*/

-- Add OTP column
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS otp text;

-- Policy for requestees to view donations made to their requests
-- This allows the user who CREATED the request to see the donations associated with it
CREATE POLICY "Requestees can view donations to their requests"
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blood_requests
      WHERE id = donations.request_id
      AND user_id = auth.uid()
    )
  );
