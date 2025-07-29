-- Create move-out notices table
CREATE TABLE public.move_out_notices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL,
  property_id UUID NOT NULL,
  notice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  move_out_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.move_out_notices ENABLE ROW LEVEL SECURITY;

-- Create policies for move-out notices
CREATE POLICY "Tenants can create their own notices" 
ON public.move_out_notices 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM tenants 
    WHERE tenants.id = move_out_notices.tenant_id 
    AND tenants.user_id = auth.uid()
  )
);

CREATE POLICY "Tenants can view their own notices" 
ON public.move_out_notices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM tenants 
    WHERE tenants.id = move_out_notices.tenant_id 
    AND tenants.user_id = auth.uid()
  )
);

CREATE POLICY "Landlords can view notices for their properties" 
ON public.move_out_notices 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = move_out_notices.property_id 
    AND properties.user_id = auth.uid()
  )
);

CREATE POLICY "Landlords can update notice status" 
ON public.move_out_notices 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM properties 
    WHERE properties.id = move_out_notices.property_id 
    AND properties.user_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_move_out_notices_updated_at
BEFORE UPDATE ON public.move_out_notices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();