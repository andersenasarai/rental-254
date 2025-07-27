
-- Create table for tracking tenant bills/expenses
CREATE TABLE public.tenant_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  bill_type TEXT NOT NULL CHECK (bill_type IN ('electricity', 'water', 'garbage', 'wifi')),
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for house inventory/items condition tracking
CREATE TABLE public.house_inventory (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL,
  item_name TEXT NOT NULL,
  item_category TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('excellent', 'good', 'fair', 'poor', 'damaged')),
  description TEXT,
  location_in_house TEXT,
  move_in_condition TEXT NOT NULL,
  current_condition TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for tenant move-in reports
CREATE TABLE public.tenant_move_in_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  move_in_date DATE NOT NULL,
  overall_condition_notes TEXT,
  tenant_signature BOOLEAN DEFAULT false,
  landlord_signature BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add RLS policies for tenant_bills
ALTER TABLE public.tenant_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenants can view their own bills" 
  ON public.tenant_bills 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE tenants.id = tenant_bills.tenant_id 
      AND tenants.user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can view bills for their tenants" 
  ON public.tenant_bills 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants 
      JOIN public.properties ON properties.user_id = auth.uid()
      WHERE tenants.id = tenant_bills.tenant_id
    )
  );

CREATE POLICY "Landlords can manage tenant bills" 
  ON public.tenant_bills 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.tenants 
      JOIN public.properties ON properties.user_id = auth.uid()
      WHERE tenants.id = tenant_bills.tenant_id
    )
  );

-- Add RLS policies for house_inventory
ALTER TABLE public.house_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory for their properties" 
  ON public.house_inventory 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = house_inventory.property_id 
      AND properties.user_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.leases 
      JOIN public.properties ON properties.id = leases.property_id
      WHERE properties.id = house_inventory.property_id 
      AND leases.tenant_id IN (
        SELECT id FROM public.tenants WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Landlords can manage house inventory" 
  ON public.house_inventory 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = house_inventory.property_id 
      AND properties.user_id = auth.uid()
    )
  );

-- Add RLS policies for tenant_move_in_reports
ALTER TABLE public.tenant_move_in_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view relevant move-in reports" 
  ON public.tenant_move_in_reports 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = tenant_move_in_reports.property_id 
      AND properties.user_id = auth.uid()
    )
    OR 
    EXISTS (
      SELECT 1 FROM public.tenants 
      WHERE tenants.id = tenant_move_in_reports.tenant_id 
      AND tenants.user_id = auth.uid()
    )
  );

CREATE POLICY "Landlords can manage move-in reports" 
  ON public.tenant_move_in_reports 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = tenant_move_in_reports.property_id 
      AND properties.user_id = auth.uid()
    )
  );

-- Add triggers for updated_at columns
CREATE TRIGGER update_tenant_bills_updated_at 
  BEFORE UPDATE ON public.tenant_bills 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_house_inventory_updated_at 
  BEFORE UPDATE ON public.house_inventory 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenant_move_in_reports_updated_at 
  BEFORE UPDATE ON public.tenant_move_in_reports 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
