-- Add approval status to user_roles table
ALTER TABLE public.user_roles 
ADD COLUMN approval_status text DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Add approval metadata
ALTER TABLE public.user_roles 
ADD COLUMN approved_by uuid REFERENCES auth.users(id),
ADD COLUMN approved_at timestamp with time zone,
ADD COLUMN approval_notes text;

-- Update existing landlord roles to be approved (so current users aren't locked out)
UPDATE public.user_roles 
SET approval_status = 'approved', approved_at = now() 
WHERE role = 'landlord';

-- Create function to approve landlord access
CREATE OR REPLACE FUNCTION public.approve_landlord_access(
  _user_id uuid,
  _approved_by uuid,
  _notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_roles
  SET 
    approval_status = 'approved',
    approved_by = _approved_by,
    approved_at = now(),
    approval_notes = _notes
  WHERE user_id = _user_id AND role = 'landlord';
  
  RETURN FOUND;
END;
$$;

-- Create function to reject landlord access
CREATE OR REPLACE FUNCTION public.reject_landlord_access(
  _user_id uuid,
  _approved_by uuid,
  _notes text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.user_roles
  SET 
    approval_status = 'rejected',
    approved_by = _approved_by,
    approved_at = now(),
    approval_notes = _notes
  WHERE user_id = _user_id AND role = 'landlord';
  
  RETURN FOUND;
END;
$$;