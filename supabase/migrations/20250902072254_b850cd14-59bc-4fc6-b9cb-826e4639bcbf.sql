-- Fix database schema issues and add missing functionality

-- First, ensure all required columns exist in tenants table
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid() PRIMARY KEY;

-- Add missing columns to leases table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leases' AND column_name = 'rent_amount') THEN
        ALTER TABLE public.leases ADD COLUMN rent_amount numeric;
        -- Copy data from monthly_rent to rent_amount
        UPDATE public.leases SET rent_amount = monthly_rent WHERE monthly_rent IS NOT NULL;
    END IF;
END $$;

-- Create password reset tokens table for secure password resets
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    token text NOT NULL UNIQUE,
    expires_at timestamp with time zone NOT NULL,
    used boolean DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on password reset tokens
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create policies for password reset tokens
CREATE POLICY "Users can view their own reset tokens" 
ON public.password_reset_tokens 
FOR SELECT 
USING (auth.uid() = user_id);

-- Create rent countdown settings table for tenants
CREATE TABLE IF NOT EXISTS public.rent_countdown_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE,
    due_day_of_month integer NOT NULL DEFAULT 1,
    notification_days_before integer NOT NULL DEFAULT 3,
    custom_message text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on rent countdown settings
ALTER TABLE public.rent_countdown_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for rent countdown settings
CREATE POLICY "Users can manage their own countdown settings" 
ON public.rent_countdown_settings 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create maintenance categories table
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on maintenance categories
ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;

-- Create policy for maintenance categories (readable by all authenticated users)
CREATE POLICY "Authenticated users can view maintenance categories" 
ON public.maintenance_categories 
FOR SELECT 
TO authenticated
USING (true);

-- Insert default maintenance categories
INSERT INTO public.maintenance_categories (name, description) VALUES
('Plumbing', 'Water, pipes, leaks, toilets, sinks'),
('Electrical', 'Wiring, outlets, lighting, power issues'),
('HVAC', 'Heating, cooling, ventilation'),
('Appliances', 'Refrigerator, stove, washer, dryer'),
('General Repairs', 'Doors, windows, locks, general fixes'),
('Cleaning', 'Deep cleaning, carpet cleaning, pest control')
ON CONFLICT (name) DO NOTHING;

-- Create database functions for tenant operations
CREATE OR REPLACE FUNCTION public.get_tenant_payment_countdown(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_build_object(
        'next_due_date', COALESCE(MIN(p.due_date), CURRENT_DATE + INTERVAL '30 days'),
        'amount_due', COALESCE(SUM(p.amount), 0),
        'days_until_due', COALESCE(MIN(p.due_date) - CURRENT_DATE, 30)
    ) INTO result
    FROM payments p
    JOIN leases l ON l.id = p.lease_id
    JOIN tenants t ON t.tenant_id = l.tenant_id
    WHERE t.user_id = tenant_user_id 
    AND p.status = 'pending'
    AND p.due_date >= CURRENT_DATE;
    
    RETURN COALESCE(result, '{"next_due_date": null, "amount_due": 0, "days_until_due": 30}'::jsonb);
END;
$$;

-- Create function for tenant maintenance history
CREATE OR REPLACE FUNCTION public.get_tenant_maintenance_history(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result jsonb;
BEGIN
    SELECT jsonb_agg(jsonb_build_object(
        'id', mr.id,
        'title', mr.title,
        'description', mr.description,
        'status', mr.status,
        'priority', mr.priority,
        'created_at', mr.created_at,
        'updated_at', mr.updated_at
    )) INTO result
    FROM maintenance_requests mr
    JOIN tenants t ON t.tenant_id = mr.tenant_id
    WHERE t.user_id = tenant_user_id
    ORDER BY mr.created_at DESC;
    
    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Add trigger for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for rent countdown settings
DROP TRIGGER IF EXISTS update_rent_countdown_settings_updated_at ON public.rent_countdown_settings;
CREATE TRIGGER update_rent_countdown_settings_updated_at
    BEFORE UPDATE ON public.rent_countdown_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();