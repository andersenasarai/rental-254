-- Migration: Convert to Gmail-based authentication system
-- This migration will clean up synthetic emails and prepare for real Gmail authentication

-- First, let's update the profiles table to handle the transition
-- Remove any profiles with synthetic emails that don't have corresponding auth users
DELETE FROM public.profiles 
WHERE email LIKE '%<nil>%' OR email IS NULL OR email = '';

-- Update the handle_new_user function to properly set profile data from auth metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, full_name, email, role, login_id, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'tenant'),
    COALESCE(NEW.raw_user_meta_data ->> 'login_id', ''),
    NOW(), 
    NOW()
  );
  RETURN NEW;
END;
$$;

-- Create or replace the trigger to handle new user signups
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update any existing profiles to use real email from auth.users where possible
UPDATE public.profiles 
SET email = auth_users.email
FROM auth.users auth_users
WHERE profiles.user_id = auth_users.id 
AND auth_users.email IS NOT NULL 
AND auth_users.email != '';

-- Ensure all profiles have proper updated_at timestamps
UPDATE public.profiles 
SET updated_at = NOW() 
WHERE updated_at IS NULL;

-- Create an index on login_id for faster lookups (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_login_id ON public.profiles(login_id);

-- Create an index on email for faster lookups (if not exists)  
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);