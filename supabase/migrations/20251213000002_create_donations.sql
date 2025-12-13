/*
  # Create donations table

  1. New Tables
    - `donations`
      - `id` (uuid, primary key)
      - `request_id` (uuid, references blood_requests)
      - `donor_id` (uuid, references profiles)
      - `status` (text) - pending, completed, cancelled
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for creation and viewing
*/

CREATE TABLE IF NOT EXISTS public.donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.blood_requests(id) NOT NULL,
  donor_id uuid REFERENCES public.profiles(id) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own donations"
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = donor_id);

CREATE POLICY "Users can create donations"
  ON public.donations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = donor_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_donations_donor_id ON public.donations(donor_id);
CREATE INDEX IF NOT EXISTS idx_donations_request_id ON public.donations(request_id);
