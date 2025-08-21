
ALTER TABLE public.profiles
ADD COLUMN login_id TEXT UNIQUE;

-- Optional: Add a function to generate a unique login_id if not provided
-- This would typically be handled in the application layer when creating users
-- For existing users, you might need a one-time migration script to populate this field

-- Create RLS policy to allow users to view their own login_id
CREATE POLICY "Users can view their own login_id" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Create RLS policy to allow admins to update login_id (if needed)
CREATE POLICY "Admins can update login_id" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );


