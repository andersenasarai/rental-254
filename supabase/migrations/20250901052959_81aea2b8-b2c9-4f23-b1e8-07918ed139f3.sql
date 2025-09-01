-- Create admin user if not exists
DO $$
BEGIN
  -- Check if admin exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE role = 'admin') THEN
    -- Create admin profile
    INSERT INTO profiles (id, user_id, full_name, email, role, login_id, created_at, updated_at)
    VALUES (
      'fc9e60bb-bc3e-48bf-9a3b-df5155fc3de7'::uuid,
      'fc9e60bb-bc3e-48bf-9a3b-df5155fc3de7'::uuid,
      'System Admin',
      'asaraimakokha1@gmail.com',
      'admin',
      'ADMIN-001',
      now(),
      now()
    );
  END IF;
END $$;

-- Ensure phone column exists in profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'phone') THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;