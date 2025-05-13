/*
  # Create profiles table for user data

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key) - References auth.users
      - `email` (text, unique)
      - `full_name` (text)
      - `phone` (text)
      - `blood_group` (text)
      - `location` (jsonb) - Stores latitude, longitude, and address
      - `is_donor` (boolean)
      - `is_available` (boolean)
      - `government_id` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `profiles` table
    - Add policies for:
      - Users can read their own profile
      - Users can update their own profile
      - Public can read donor profiles
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  email text UNIQUE NOT NULL,
  full_name text,
  phone text,
  blood_group text,
  location jsonb,
  is_donor boolean DEFAULT false,
  is_available boolean DEFAULT false,
  government_id text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Public can read donor profiles"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_donor = true);

-- Create index for faster donor lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_donor ON public.profiles(is_donor)
  WHERE is_donor = true;