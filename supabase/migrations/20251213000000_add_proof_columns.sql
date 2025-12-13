/*
  # Add blood group proof columns to profiles

  1. Changes
    - Add `blood_group_proof_type` column to `profiles` table
    - Add `blood_group_proof_url` column to `profiles` table
*/

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS blood_group_proof_type text,
ADD COLUMN IF NOT EXISTS blood_group_proof_url text;
