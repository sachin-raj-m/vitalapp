/*
  # Create blood requests table and related schemas

  1. New Tables
    - `blood_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `blood_group` (text)
      - `units_needed` (integer)
      - `hospital_name` (text)
      - `hospital_address` (text)
      - `urgency_level` (text)
      - `notes` (text)
      - `contact_name` (text)
      - `contact_phone` (text)
      - `location` (jsonb)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on blood_requests table
    - Add policies for:
      - Public can read active requests
      - Authenticated users can create requests
      - Users can update/delete their own requests
*/

CREATE TABLE IF NOT EXISTS public.blood_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) NOT NULL,
  blood_group text NOT NULL,
  units_needed integer NOT NULL,
  hospital_name text NOT NULL,
  hospital_address text NOT NULL,
  urgency_level text NOT NULL,
  notes text,
  contact_name text NOT NULL,
  contact_phone text NOT NULL,
  location jsonb NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public can read active requests"
  ON public.blood_requests
  FOR SELECT
  TO anon, authenticated
  USING (status = 'active');

CREATE POLICY "Authenticated users can create requests"
  ON public.blood_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own requests"
  ON public.blood_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own requests"
  ON public.blood_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON public.blood_requests(status);
CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_group ON public.blood_requests(blood_group);
CREATE INDEX IF NOT EXISTS idx_blood_requests_urgency ON public.blood_requests(urgency_level);