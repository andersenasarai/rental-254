-- Phase 1: Critical Security Fixes
-- 1.1 Fix Password Reset Token Exposure
-- 1.3 Add Authorization to Security Definer Functions

-- Drop the overly permissive policy on password_reset_tokens
DROP POLICY IF EXISTS "System can manage password reset tokens" ON public.password_reset_tokens;

-- Create proper policies for password_reset_tokens
-- Users can view their own tokens
CREATE POLICY "Users can view own reset tokens"
ON public.password_reset_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update their own tokens (to mark as used)
CREATE POLICY "Users can update own reset tokens"
ON public.password_reset_tokens
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role can manage all tokens (for edge functions)
-- This is handled by service role key in edge functions, no RLS policy needed

-- 1.3 Update Security Definer Functions with Authorization

-- Fix approve_landlord_access - only admins can approve
CREATE OR REPLACE FUNCTION public.approve_landlord_access(_user_id uuid, _approved_by uuid, _notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  -- Authorization check: only admins can approve
  IF NOT has_role(_approved_by, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can approve landlord access';
  END IF;
  
  UPDATE public.user_roles
  SET 
    approval_status = 'approved',
    approved_by = _approved_by,
    approved_at = now(),
    approval_notes = _notes
  WHERE user_id = _user_id AND role = 'landlord';
  
  RETURN FOUND;
END;
$function$;

-- Fix reject_landlord_access - only admins can reject
CREATE OR REPLACE FUNCTION public.reject_landlord_access(_user_id uuid, _approved_by uuid, _notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
BEGIN
  -- Authorization check: only admins can reject
  IF NOT has_role(_approved_by, 'admin'::app_role) THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reject landlord access';
  END IF;
  
  UPDATE public.user_roles
  SET 
    approval_status = 'rejected',
    approved_by = _approved_by,
    approved_at = now(),
    approval_notes = _notes
  WHERE user_id = _user_id AND role = 'landlord';
  
  RETURN FOUND;
END;
$function$;

-- Fix get_tenant_payment_countdown - add authorization
CREATE OR REPLACE FUNCTION public.get_tenant_payment_countdown(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
    result jsonb;
BEGIN
    -- Authorization check: only admins, the tenant themselves, or their landlord can view
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      auth.uid() = tenant_user_id OR
      EXISTS (
        SELECT 1 
        FROM tenants t
        JOIN properties p ON p.id::text = t.property_address
        WHERE t.user_id = tenant_user_id 
        AND p.user_id = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'Unauthorized: You do not have permission to view this tenant''s payment information';
    END IF;
    
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
$function$;

-- Fix get_tenant_maintenance_history - add authorization
CREATE OR REPLACE FUNCTION public.get_tenant_maintenance_history(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $function$
DECLARE
    result jsonb;
BEGIN
    -- Authorization check: only admins, the tenant themselves, or their landlord can view
    IF NOT (
      has_role(auth.uid(), 'admin'::app_role) OR
      auth.uid() = tenant_user_id OR
      EXISTS (
        SELECT 1 
        FROM tenants t
        JOIN properties p ON p.id::text = t.property_address
        WHERE t.user_id = tenant_user_id 
        AND p.user_id = auth.uid()
      )
    ) THEN
      RAISE EXCEPTION 'Unauthorized: You do not have permission to view this tenant''s maintenance history';
    END IF;
    
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
$function$;