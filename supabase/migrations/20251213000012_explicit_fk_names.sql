-- Explicitly name the foreign key constraint to ensure accurate relationship detection
ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_request_id_fkey, -- Drop if exists by default name (postgres default is usually table_column_fkey)
  ADD CONSTRAINT donations_request_id_fkey
  FOREIGN KEY (request_id)
  REFERENCES public.blood_requests(id)
  ON DELETE CASCADE;

-- Also Explicitly name the donor FK for good measure
ALTER TABLE public.donations
  DROP CONSTRAINT IF EXISTS donations_donor_id_fkey,
  ADD CONSTRAINT donations_donor_id_fkey
  FOREIGN KEY (donor_id)
  REFERENCES public.profiles(id)
  ON DELETE CASCADE;
