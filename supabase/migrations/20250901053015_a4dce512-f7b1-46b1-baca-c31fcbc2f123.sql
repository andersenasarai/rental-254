-- Update admin profile with correct email and login_id
UPDATE profiles 
SET 
  email = 'asaraimakokha1@gmail.com',
  login_id = 'ADMIN-001'
WHERE id = 'fc9e60bb-bc3e-48bf-9a3b-df5155fc3de7';

-- Enable RLS on landlords table if not enabled
ALTER TABLE landlords ENABLE ROW LEVEL SECURITY;

-- Create policies for landlords table
CREATE POLICY "Admins can manage landlords" 
ON landlords FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role = 'admin'
  )
);