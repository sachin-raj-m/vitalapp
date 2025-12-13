-- Make bucket private (this disables getPublicUrl)
UPDATE storage.buckets SET public = false WHERE id = 'proofs';

-- Drop existing loose policies
DROP POLICY IF EXISTS "Authenticated users can upload proofs" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own proofs" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all proofs" ON storage.objects;
DROP POLICY IF EXISTS "Aghenticated users upload" ON storage.objects; 
DROP POLICY IF EXISTS "Admins and Owners View" ON storage.objects;

-- RLS: Allow Upload (Auth users)
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'proofs' AND auth.uid() = owner);

-- RLS: Allow View (Admins + Owner)
-- We include Owner so the upload process doesn't fail immediately if it tries to return the object, 
-- and so users *could* historically see their own proofs if we wanted to build that UI.
-- But primarily this enables Admins to generate Signed URLs.
CREATE POLICY "Allow View Access"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'proofs' AND 
  (
    auth.uid() = owner OR 
    (SELECT public.is_admin())
  )
);
