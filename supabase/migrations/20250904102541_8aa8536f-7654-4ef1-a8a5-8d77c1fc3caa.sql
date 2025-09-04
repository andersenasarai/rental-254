-- Enable RLS on any remaining tables and ensure all critical tables are secure

-- Check and enable RLS for all public tables (these should already be enabled but just to be sure)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_out_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_move_in_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_countdown_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- Ensure all tables that were just enabled have basic policies for their intended users
-- The landlords table needs at least a basic policy
CREATE POLICY "Landlords can view their own records" ON public.landlords
FOR SELECT USING (auth.uid() = landlord_id);

-- Add basic policy for password_reset_tokens (already has one policy but make sure it's complete)
-- This table already has a policy for SELECT, add basic policies for admin management
CREATE POLICY "System can manage password reset tokens" ON public.password_reset_tokens
FOR ALL USING (true);

-- Add policies for maintenance_categories (currently only has SELECT policy)
CREATE POLICY "Admins can manage maintenance categories" ON public.maintenance_categories
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND role = 'admin'
  )
);