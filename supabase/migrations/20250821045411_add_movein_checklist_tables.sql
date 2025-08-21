
-- Create checklist categories table
CREATE TABLE public.checklist_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create checklist items template table
CREATE TABLE public.checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.checklist_categories(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    item_type VARCHAR(20) DEFAULT 'checkbox' CHECK (item_type IN ('checkbox', 'condition', 'count', 'text', 'photo')),
    is_required BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant checklist submissions table
CREATE TABLE public.tenant_checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'approved', 'rejected')),
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by UUID REFERENCES public.profiles(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tenant checklist responses table
CREATE TABLE public.tenant_checklist_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checklist_id UUID NOT NULL REFERENCES public.tenant_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES public.checklist_items(id) ON DELETE CASCADE,
    response_type VARCHAR(20) NOT NULL CHECK (response_type IN ('boolean', 'text', 'number', 'condition', 'photo')),
    boolean_value BOOLEAN,
    text_value TEXT,
    number_value INTEGER,
    condition_value VARCHAR(20) CHECK (condition_value IN ('excellent', 'good', 'fair', 'poor', 'damaged', 'missing')),
    photo_urls TEXT[], -- Array of photo URLs
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create lease contracts table
CREATE TABLE public.lease_contracts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lease_id UUID NOT NULL REFERENCES public.leases(id) ON DELETE CASCADE,
    checklist_id UUID REFERENCES public.tenant_checklists(id) ON DELETE SET NULL,
    contract_data JSONB NOT NULL,
    contract_url TEXT, -- URL to generated PDF
    status VARCHAR(20) DEFAULT 'generated' CHECK (status IN ('generated', 'signed', 'executed')),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    signed_at TIMESTAMP WITH TIME ZONE,
    executed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_checklist_items_category_id ON public.checklist_items(category_id);
CREATE INDEX idx_checklist_items_sort_order ON public.checklist_items(sort_order);
CREATE INDEX idx_tenant_checklists_tenant_id ON public.tenant_checklists(tenant_id);
CREATE INDEX idx_tenant_checklists_lease_id ON public.tenant_checklists(lease_id);
CREATE INDEX idx_tenant_checklists_status ON public.tenant_checklists(status);
CREATE INDEX idx_tenant_checklist_responses_checklist_id ON public.tenant_checklist_responses(checklist_id);
CREATE INDEX idx_tenant_checklist_responses_item_id ON public.tenant_checklist_responses(item_id);
CREATE INDEX idx_lease_contracts_lease_id ON public.lease_contracts(lease_id);

-- Enable RLS on all tables
ALTER TABLE public.checklist_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_checklist_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lease_contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies for checklist_categories (readable by all authenticated users)
CREATE POLICY "Anyone can view active categories" ON public.checklist_categories
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage categories" ON public.checklist_categories
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for checklist_items (readable by all authenticated users)
CREATE POLICY "Anyone can view active items" ON public.checklist_items
    FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage items" ON public.checklist_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for tenant_checklists
CREATE POLICY "Tenants can view their own checklists" ON public.tenant_checklists
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can create their own checklists" ON public.tenant_checklists
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Tenants can update their own checklists" ON public.tenant_checklists
    FOR UPDATE USING (tenant_id = auth.uid());

CREATE POLICY "Landlords can view tenant checklists for their properties" ON public.tenant_checklists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = tenant_checklists.property_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can approve tenant checklists" ON public.tenant_checklists
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.properties p
            WHERE p.id = tenant_checklists.property_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all checklists" ON public.tenant_checklists
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for tenant_checklist_responses
CREATE POLICY "Tenants can manage responses for their checklists" ON public.tenant_checklist_responses
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.tenant_checklists tc
            WHERE tc.id = tenant_checklist_responses.checklist_id
            AND tc.tenant_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can view responses for their properties" ON public.tenant_checklist_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.tenant_checklists tc
            JOIN public.properties p ON tc.property_id = p.id
            WHERE tc.id = tenant_checklist_responses.checklist_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all responses" ON public.tenant_checklist_responses
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- RLS policies for lease_contracts
CREATE POLICY "Tenants can view their lease contracts" ON public.lease_contracts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leases l
            WHERE l.id = lease_contracts.lease_id
            AND l.tenant_id = auth.uid()
        )
    );

CREATE POLICY "Landlords can view contracts for their properties" ON public.lease_contracts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leases l
            JOIN public.properties p ON l.property_id = p.id
            WHERE l.id = lease_contracts.lease_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "System can create contracts" ON public.lease_contracts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can manage all contracts" ON public.lease_contracts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_checklist_categories_updated_at 
    BEFORE UPDATE ON public.checklist_categories 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_checklist_items_updated_at 
    BEFORE UPDATE ON public.checklist_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_checklists_updated_at 
    BEFORE UPDATE ON public.tenant_checklists 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_checklist_responses_updated_at 
    BEFORE UPDATE ON public.tenant_checklist_responses 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default checklist categories and items
INSERT INTO public.checklist_categories (name, description, sort_order) VALUES
('General Condition', 'Overall property condition assessment', 1),
('Kitchen', 'Kitchen appliances and fixtures', 2),
('Bathroom', 'Bathroom fixtures and plumbing', 3),
('Living Areas', 'Living room, dining room, and common areas', 4),
('Bedrooms', 'Bedroom condition and fixtures', 5),
('Utilities', 'Electrical, plumbing, and HVAC systems', 6),
('Safety & Security', 'Safety equipment and security features', 7),
('Exterior', 'Outdoor areas, parking, and building exterior', 8);

-- Insert default checklist items
DO $$
DECLARE
    general_id UUID;
    kitchen_id UUID;
    bathroom_id UUID;
    living_id UUID;
    bedroom_id UUID;
    utilities_id UUID;
    safety_id UUID;
    exterior_id UUID;
BEGIN
    -- Get category IDs
    SELECT id INTO general_id FROM public.checklist_categories WHERE name = 'General Condition';
    SELECT id INTO kitchen_id FROM public.checklist_categories WHERE name = 'Kitchen';
    SELECT id INTO bathroom_id FROM public.checklist_categories WHERE name = 'Bathroom';
    SELECT id INTO living_id FROM public.checklist_categories WHERE name = 'Living Areas';
    SELECT id INTO bedroom_id FROM public.checklist_categories WHERE name = 'Bedrooms';
    SELECT id INTO utilities_id FROM public.checklist_categories WHERE name = 'Utilities';
    SELECT id INTO safety_id FROM public.checklist_categories WHERE name = 'Safety & Security';
    SELECT id INTO exterior_id FROM public.checklist_categories WHERE name = 'Exterior';

    -- General Condition items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (general_id, 'Overall cleanliness', 'Property is clean and ready for occupancy', 'condition', 1),
    (general_id, 'Walls and paint condition', 'Check for damage, stains, or needed touch-ups', 'condition', 2),
    (general_id, 'Flooring condition', 'Inspect carpets, hardwood, tile for damage', 'condition', 3),
    (general_id, 'Windows and doors', 'Check operation and condition of all windows and doors', 'condition', 4);

    -- Kitchen items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (kitchen_id, 'Refrigerator', 'Refrigerator present and working', 'condition', 1),
    (kitchen_id, 'Stove/Oven', 'Cooking appliances present and working', 'condition', 2),
    (kitchen_id, 'Sink and faucet', 'Kitchen sink and faucet working properly', 'condition', 3),
    (kitchen_id, 'Cabinets and drawers', 'All cabinets and drawers open and close properly', 'condition', 4),
    (kitchen_id, 'Countertops', 'Condition of kitchen countertops', 'condition', 5);

    -- Bathroom items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (bathroom_id, 'Toilet', 'Toilet present and functioning', 'condition', 1),
    (bathroom_id, 'Shower/Bathtub', 'Shower or bathtub present and working', 'condition', 2),
    (bathroom_id, 'Sink and faucet', 'Bathroom sink and faucet working', 'condition', 3),
    (bathroom_id, 'Mirror', 'Bathroom mirror present and undamaged', 'condition', 4);

    -- Living Areas items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (living_id, 'Lighting fixtures', 'All light fixtures present and working', 'condition', 1),
    (living_id, 'Electrical outlets', 'All outlets working properly', 'condition', 2),
    (living_id, 'Air conditioning/heating', 'HVAC system working properly', 'condition', 3);

    -- Bedroom items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (bedroom_id, 'Closet space', 'Closets accessible and in good condition', 'condition', 1),
    (bedroom_id, 'Bedroom lighting', 'All bedroom lights working', 'condition', 2);

    -- Utilities items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (utilities_id, 'Water pressure', 'Adequate water pressure throughout property', 'condition', 1),
    (utilities_id, 'Hot water', 'Hot water available and working', 'condition', 2),
    (utilities_id, 'Electrical system', 'All electrical systems functioning', 'condition', 3);

    -- Safety & Security items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (safety_id, 'Smoke detectors', 'Smoke detectors present and working', 'condition', 1),
    (safety_id, 'Door locks', 'All exterior door locks working', 'condition', 2),
    (safety_id, 'Window locks', 'All window locks working', 'condition', 3);

    -- Exterior items
    INSERT INTO public.checklist_items (category_id, title, description, item_type, sort_order) VALUES
    (exterior_id, 'Parking space', 'Designated parking space available', 'checkbox', 1),
    (exterior_id, 'Mailbox access', 'Mailbox accessible and functional', 'condition', 2);

END $$;

