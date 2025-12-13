/*
  # Create storage bucket for proofs

  1. New Storage Bucket
    - `proofs` bucket for storing blood group proof documents

  2. Security
    - Enable authenticated users to upload files
    - Allow users to read their own files (or everyone if needed for verification)
*/

-- Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('proofs', 'proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proofs' AND auth.uid() = owner);

-- Policy: Users can read their own files
CREATE POLICY "Users can read own proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'proofs' AND auth.uid() = owner);

-- Policy: Users can update their own files
CREATE POLICY "Users can update own proofs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'proofs' AND auth.uid() = owner);
