/*
  # Setup Admin User
  
  Run this script to make your user an admin.
  Replace 'your-email@example.com' with your actual email.
*/

UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-email@example.com';
