-- Fix for infinite recursion
-- 1. Create a secure function to check admin status (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$;

-- 2. Drop the recursive policies
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update verification status" ON public.profiles;

-- 3. Re-create policies using the secure function
CREATE POLICY "Admins can read all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    is_admin()
  );

CREATE POLICY "Admins can update verification status"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_admin()
  );
