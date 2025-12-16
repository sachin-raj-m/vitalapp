-- Allow users to view their own requests (even non-active ones)
CREATE POLICY "Users can view own requests"
  ON public.blood_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Allow request owners to view donations made to their requests
CREATE POLICY "Request owners can view donations"
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM public.blood_requests 
      WHERE id = request_id 
      AND user_id = auth.uid()
    )
  );
