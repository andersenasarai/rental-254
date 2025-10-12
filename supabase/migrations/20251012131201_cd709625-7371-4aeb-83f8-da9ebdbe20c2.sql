-- Migration: Sync missing profiles from auth.users (Fixed for duplicate login_id)
-- This ensures all existing users in auth.users have corresponding profiles

-- First, generate unique login_ids for users that don't have them
DO $$
DECLARE
  user_record RECORD;
  new_login_id TEXT;
  role_prefix TEXT;
BEGIN
  -- Insert missing profiles for users that exist in auth.users but not in profiles
  FOR user_record IN 
    SELECT 
      au.id,
      au.email,
      COALESCE(au.raw_user_meta_data->>'full_name', '') as full_name,
      COALESCE(au.raw_user_meta_data->>'role', 'tenant') as role,
      COALESCE(au.raw_user_meta_data->>'login_id', '') as login_id,
      au.created_at
    FROM auth.users au
    LEFT JOIN public.profiles p ON p.user_id = au.id
    WHERE p.id IS NULL
  LOOP
    -- Generate unique login_id if empty
    IF user_record.login_id = '' OR user_record.login_id IS NULL THEN
      role_prefix := CASE 
        WHEN user_record.role = 'landlord' THEN 'LL'
        WHEN user_record.role = 'admin' THEN 'AD'
        ELSE 'TN'
      END;
      
      -- Generate unique login_id
      LOOP
        new_login_id := role_prefix || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
        EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE login_id = new_login_id);
      END LOOP;
    ELSE
      new_login_id := user_record.login_id;
    END IF;
    
    -- Insert the profile
    INSERT INTO public.profiles (id, user_id, full_name, email, role, login_id, created_at, updated_at)
    VALUES (
      user_record.id,
      user_record.id,
      user_record.full_name,
      user_record.email,
      user_record.role,
      new_login_id,
      user_record.created_at,
      NOW()
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;

-- Update the handle_new_user trigger function to generate login_id if missing
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  new_login_id TEXT;
  role_prefix TEXT;
  user_role TEXT;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'tenant');
  
  -- Generate unique login_id if not provided
  IF COALESCE(NEW.raw_user_meta_data->>'login_id', '') = '' THEN
    role_prefix := CASE 
      WHEN user_role = 'landlord' THEN 'LL'
      WHEN user_role = 'admin' THEN 'AD'
      ELSE 'TN'
    END;
    
    -- Generate unique login_id
    LOOP
      new_login_id := role_prefix || '-' || LPAD(FLOOR(RANDOM() * 999999 + 1)::TEXT, 6, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE login_id = new_login_id);
    END LOOP;
  ELSE
    new_login_id := NEW.raw_user_meta_data->>'login_id';
  END IF;
  
  INSERT INTO public.profiles (id, user_id, full_name, email, role, login_id, created_at, updated_at)
  VALUES (
    NEW.id, 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    user_role,
    new_login_id,
    NOW(), 
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    role = COALESCE(EXCLUDED.role, profiles.role),
    login_id = CASE 
      WHEN profiles.login_id = '' OR profiles.login_id IS NULL 
      THEN EXCLUDED.login_id 
      ELSE profiles.login_id 
    END,
    updated_at = NOW();
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();