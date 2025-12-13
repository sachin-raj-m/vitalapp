/*
  # Add verification and role to profiles

  1. Changes
    - Add `role` column (text) default 'user'
    - Add `verification_status` column (text) default 'pending'
  
  2. Security
    - Add policy for admins to view all profiles
*/

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user',
ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'pending';

-- Create policy for admins to read all profiles
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );

-- Create policy for admins to update verification status
CREATE POLICY "Admins can update verification status"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.uid() IN (
      SELECT id FROM public.profiles WHERE role = 'admin'
    )
  );
