-- Add payment deadline tracking to payments table
ALTER TABLE public.payments 
ADD COLUMN IF NOT EXISTS next_payment_due DATE,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES public.profiles(id);

-- Create rent countdown settings table
CREATE TABLE public.rent_countdown_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
    due_day_of_month INTEGER DEFAULT 10 CHECK (due_day_of_month >= 1 AND due_day_of_month <= 31),
    grace_period_days INTEGER DEFAULT 5,
    late_fee_amount DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create maintenance requests table (if it doesn't exist)
CREATE TABLE IF NOT EXISTS public.maintenance_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    category VARCHAR(50) DEFAULT 'general',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    assigned_to UUID REFERENCES public.profiles(id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    estimated_cost DECIMAL(10,2),
    actual_cost DECIMAL(10,2),
    notes TEXT,
    tenant_rating INTEGER CHECK (tenant_rating >= 1 AND tenant_rating <= 5),
    tenant_feedback TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create maintenance request updates table for tracking progress
CREATE TABLE IF NOT EXISTS public.maintenance_request_updates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id UUID NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
    updated_by UUID NOT NULL REFERENCES public.profiles(id),
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    update_type VARCHAR(50) DEFAULT 'status_change',
    message TEXT,
    photos TEXT[], -- Array of photo URLs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create maintenance categories table
CREATE TABLE IF NOT EXISTS public.maintenance_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    color VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default maintenance categories
INSERT INTO public.maintenance_categories (name, description, icon, color, sort_order) VALUES
('Plumbing', 'Water, pipes, drains, and plumbing fixtures', 'droplets', 'blue', 1),
('Electrical', 'Electrical systems, outlets, and lighting', 'zap', 'yellow', 2),
('HVAC', 'Heating, ventilation, and air conditioning', 'thermometer', 'orange', 3),
('Appliances', 'Kitchen and laundry appliances', 'home', 'green', 4),
('Structural', 'Walls, floors, ceilings, and structural issues', 'building', 'gray', 5),
('Security', 'Locks, doors, windows, and security systems', 'shield', 'red', 6),
('Cleaning', 'General cleaning and maintenance', 'sparkles', 'purple', 7),
('Landscaping', 'Outdoor areas, gardens, and landscaping', 'tree-pine', 'green', 8),
('Other', 'Miscellaneous maintenance requests', 'wrench', 'gray', 9)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_payments_next_payment_due ON public.payments(next_payment_due);
CREATE INDEX IF NOT EXISTS idx_payments_payment_confirmed_at ON public.payments(payment_confirmed_at);
CREATE INDEX IF NOT EXISTS idx_rent_countdown_settings_property_id ON public.rent_countdown_settings(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_tenant_id ON public.maintenance_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_property_id ON public.maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_status ON public.maintenance_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_priority ON public.maintenance_requests(priority);
CREATE INDEX IF NOT EXISTS idx_maintenance_requests_category ON public.maintenance_requests(category);
CREATE INDEX IF NOT EXISTS idx_maintenance_request_updates_request_id ON public.maintenance_request_updates(request_id);

-- Enable RLS on new tables
ALTER TABLE public.rent_countdown_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_request_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_categories ENABLE ROW LEVEL SECURITY;

-- RLS policies for rent_countdown_settings
CREATE POLICY "Landlords can manage countdown settings for their properties" ON public.rent_countdown_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = rent_countdown_settings.property_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Tenants can view countdown settings for their property" ON public.rent_countdown_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leases l
            JOIN public.properties p ON l.property_id = p.id
            WHERE p.id = rent_countdown_settings.property_id
            AND l.tenant_id = auth.uid()
            AND l.is_active = true
        )
    );

CREATE POLICY "Admins can manage all countdown settings" ON public.rent_countdown_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for maintenance_requests
CREATE POLICY "Tenants can manage their own maintenance requests" ON public.maintenance_requests
    FOR ALL USING (tenant_id = auth.uid());

CREATE POLICY "Landlords can view and update requests for their properties" ON public.maintenance_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = maintenance_requests.property_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Assigned maintenance staff can update requests" ON public.maintenance_requests
    FOR UPDATE USING (assigned_to = auth.uid());

CREATE POLICY "Admins can manage all maintenance requests" ON public.maintenance_requests
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for maintenance_request_updates
CREATE POLICY "Users can view updates for requests they have access to" ON public.maintenance_request_updates
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.maintenance_requests mr
            WHERE mr.id = maintenance_request_updates.request_id
            AND (
                mr.tenant_id = auth.uid() OR
                mr.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.properties p
                    WHERE p.id = mr.property_id
                    AND p.landlord_id = auth.uid()
                ) OR
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

CREATE POLICY "Users can create updates for requests they have access to" ON public.maintenance_request_updates
    FOR INSERT WITH CHECK (
        updated_by = auth.uid() AND
        EXISTS (
            SELECT 1 FROM public.maintenance_requests mr
            WHERE mr.id = maintenance_request_updates.request_id
            AND (
                mr.tenant_id = auth.uid() OR
                mr.assigned_to = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM public.properties p
                    WHERE p.id = mr.property_id
                    AND p.landlord_id = auth.uid()
                ) OR
                EXISTS (
                    SELECT 1 FROM public.profiles
                    WHERE id = auth.uid() AND role = 'admin'
                )
            )
        )
    );

-- RLS policies for maintenance_categories
CREATE POLICY "Anyone can view active maintenance categories" ON public.maintenance_categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage maintenance categories" ON public.maintenance_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_rent_countdown_settings_updated_at 
    BEFORE UPDATE ON public.rent_countdown_settings 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at 
    BEFORE UPDATE ON public.maintenance_requests 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate next payment due date
CREATE OR REPLACE FUNCTION calculate_next_payment_due(
    payment_confirmed_date DATE,
    due_day INTEGER DEFAULT 10
) RETURNS DATE AS $$
DECLARE
    next_month_date DATE;
    next_due_date DATE;
BEGIN
    -- Calculate the next month from the payment confirmation date
    next_month_date := (payment_confirmed_date + INTERVAL '1 month')::DATE;
    
    -- Set the due date to the specified day of that month
    next_due_date := DATE_TRUNC('month', next_month_date) + (due_day - 1) * INTERVAL '1 day';
    
    -- Handle cases where the due day doesn't exist in the target month (e.g., Feb 30)
    IF EXTRACT(DAY FROM next_due_date) != due_day THEN
        -- Set to the last day of the month
        next_due_date := (DATE_TRUNC('month', next_month_date) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
    END IF;
    
    RETURN next_due_date;
END;
$$ LANGUAGE plpgsql;

-- Function to update payment due dates when payment is confirmed
CREATE OR REPLACE FUNCTION update_payment_due_date()
RETURNS TRIGGER AS $$
DECLARE
    countdown_settings RECORD;
    next_due DATE;
BEGIN
    -- Only process if payment status changed to 'paid' and payment_confirmed_at is set
    IF NEW.status = 'paid' AND NEW.payment_confirmed_at IS NOT NULL AND 
       (OLD.status != 'paid' OR OLD.payment_confirmed_at IS NULL) THEN
        
        -- Get countdown settings for the property
        SELECT * INTO countdown_settings
        FROM public.rent_countdown_settings rcs
        JOIN public.leases l ON l.property_id = rcs.property_id
        WHERE l.id = NEW.lease_id AND rcs.is_active = true
        LIMIT 1;
        
        -- If no specific settings found, use default (10th of next month)
        IF countdown_settings IS NULL THEN
            next_due := calculate_next_payment_due(NEW.payment_confirmed_at::DATE, 10);
        ELSE
            next_due := calculate_next_payment_due(NEW.payment_confirmed_at::DATE, countdown_settings.due_day_of_month);
        END IF;
        
        -- Update the payment record with next due date
        NEW.next_payment_due := next_due;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic payment due date calculation
CREATE TRIGGER trigger_update_payment_due_date
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_payment_due_date();

-- Function to get tenant's current payment status and countdown
CREATE OR REPLACE FUNCTION get_tenant_payment_countdown(tenant_uuid UUID)
RETURNS TABLE (
    next_payment_due DATE,
    days_until_due INTEGER,
    last_payment_date DATE,
    last_payment_amount DECIMAL,
    rent_amount DECIMAL,
    is_overdue BOOLEAN,
    grace_period_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.next_payment_due,
        CASE 
            WHEN p.next_payment_due IS NOT NULL THEN 
                (p.next_payment_due - CURRENT_DATE)::INTEGER
            ELSE NULL
        END as days_until_due,
        p.payment_date::DATE as last_payment_date,
        p.amount as last_payment_amount,
        l.rent_amount,
        CASE 
            WHEN p.next_payment_due IS NOT NULL AND p.next_payment_due < CURRENT_DATE THEN true
            ELSE false
        END as is_overdue,
        COALESCE(rcs.grace_period_days, 5) as grace_period_days
    FROM public.leases l
    LEFT JOIN public.payments p ON l.id = p.lease_id AND p.status = 'paid'
    LEFT JOIN public.rent_countdown_settings rcs ON l.property_id = rcs.property_id AND rcs.is_active = true
    WHERE l.tenant_id = tenant_uuid 
    AND l.is_active = true
    ORDER BY p.payment_date DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get maintenance history for a tenant
CREATE OR REPLACE FUNCTION get_tenant_maintenance_history(tenant_uuid UUID)
RETURNS TABLE (
    request_id UUID,
    title VARCHAR,
    description TEXT,
    category VARCHAR,
    priority VARCHAR,
    status VARCHAR,
    requested_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    actual_cost DECIMAL,
    tenant_rating INTEGER,
    tenant_feedback TEXT,
    total_updates INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mr.id as request_id,
        mr.title,
        mr.description,
        mr.category,
        mr.priority,
        mr.status,
        mr.requested_at,
        mr.completed_at,
        mr.actual_cost,
        mr.tenant_rating,
        mr.tenant_feedback,
        COUNT(mru.id)::INTEGER as total_updates
    FROM public.maintenance_requests mr
    LEFT JOIN public.maintenance_request_updates mru ON mr.id = mru.request_id
    WHERE mr.tenant_id = tenant_uuid
    GROUP BY mr.id, mr.title, mr.description, mr.category, mr.priority, mr.status, 
             mr.requested_at, mr.completed_at, mr.actual_cost, mr.tenant_rating, mr.tenant_feedback
    ORDER BY mr.requested_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

