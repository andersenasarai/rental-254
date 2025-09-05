-- Create auth record for existing admin user
INSERT INTO auth.users (
  id,
  email,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_user_meta_data,
  role,
  aud,
  confirmation_token,
  email_change_token_new,
  recovery_token
) VALUES (
  'fc9e60bb-bc3e-48bf-9a3b-df5155fc3de7',
  'asaraimakokha1@gmail.com',
  now(),
  now(),
  now(),
  jsonb_build_object(
    'full_name', 'Andersen Asarai',
    'role', 'admin',
    'login_id', 'ADMIN-001'
  ),
  'authenticated',
  'authenticated',
  '',
  '',
  ''
) ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  email_confirmed_at = COALESCE(auth.users.email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = EXCLUDED.raw_user_meta_data;