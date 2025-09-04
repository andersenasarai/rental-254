-- Fix critical RLS security issues
-- Enable RLS on all public tables that don't have it enabled

-- Enable RLS on landlords table
ALTER TABLE public.landlords ENABLE ROW LEVEL SECURITY;

-- Enable RLS on password_reset_tokens table  
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Enable RLS on maintenance_categories table
ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;

-- Update functions to have proper search_path settings for security
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$function$;

CREATE OR REPLACE FUNCTION public.approve_landlord_access(_user_id uuid, _approved_by uuid, _notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.reject_landlord_access(_user_id uuid, _approved_by uuid, _notes text DEFAULT NULL::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_payment_countdown(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_tenant_maintenance_history(tenant_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.has_role(requested_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
    user_role text;
BEGIN
    SELECT role INTO user_role 
    FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid();
    
    RETURN user_role = requested_role;
END;
$function$;