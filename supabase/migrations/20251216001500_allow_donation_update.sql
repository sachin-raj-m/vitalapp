-- Allow request owners to update donations made to their requests
-- This is necessary for verifying donations and updating units_donated
CREATE POLICY "Request owners can update donations"
  ON public.donations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.blood_requests 
      WHERE id = request_id 
      AND user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM public.blood_requests 
      WHERE id = request_id 
      AND user_id = auth.uid()
    )
  );

-- Fix existing data: Set units_donated to 1 for completed donations where it is 0/NULL
UPDATE public.donations 
SET units_donated = 1 
WHERE status = 'completed' 
AND (units_donated IS NULL OR units_donated = 0);
