
-- Create M-Pesa payment transactions table
CREATE TABLE public.mpesa_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lease_id UUID REFERENCES public.leases(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100),
    result_code INTEGER,
    result_desc TEXT,
    mpesa_receipt_number VARCHAR(100),
    transaction_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create M-Pesa payment receipts table
CREATE TABLE public.mpesa_receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES public.mpesa_transactions(id) ON DELETE CASCADE,
    receipt_number VARCHAR(100) NOT NULL,
    receipt_data JSONB,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_mpesa_transactions_tenant_id ON public.mpesa_transactions(tenant_id);
CREATE INDEX idx_mpesa_transactions_checkout_request_id ON public.mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_status ON public.mpesa_transactions(status);
CREATE INDEX idx_mpesa_receipts_transaction_id ON public.mpesa_receipts(transaction_id);

-- Enable RLS on the tables
ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mpesa_receipts ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for mpesa_transactions
CREATE POLICY "Tenants can view their own transactions" ON public.mpesa_transactions
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Tenants can insert their own transactions" ON public.mpesa_transactions
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "System can update transactions" ON public.mpesa_transactions
    FOR UPDATE USING (true);

CREATE POLICY "Landlords can view tenant transactions" ON public.mpesa_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.leases l
            JOIN public.properties p ON l.property_id = p.id
            WHERE l.id = mpesa_transactions.lease_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all transactions" ON public.mpesa_transactions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create RLS policies for mpesa_receipts
CREATE POLICY "Tenants can view their own receipts" ON public.mpesa_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.mpesa_transactions mt
            WHERE mt.id = mpesa_receipts.transaction_id
            AND mt.tenant_id = auth.uid()
        )
    );

CREATE POLICY "System can insert receipts" ON public.mpesa_receipts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Landlords can view tenant receipts" ON public.mpesa_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.mpesa_transactions mt
            JOIN public.leases l ON mt.lease_id = l.id
            JOIN public.properties p ON l.property_id = p.id
            WHERE mt.id = mpesa_receipts.transaction_id
            AND p.landlord_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all receipts" ON public.mpesa_receipts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_mpesa_transactions_updated_at 
    BEFORE UPDATE ON public.mpesa_transactions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add M-Pesa payment method to existing payments table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'payment_method'
    ) THEN
        ALTER TABLE public.payments ADD COLUMN payment_method VARCHAR(20) DEFAULT 'cash';
    END IF;
END $$;

-- Update payment method constraint to include mpesa
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payments_payment_method_check'
    ) THEN
        ALTER TABLE public.payments DROP CONSTRAINT payments_payment_method_check;
    END IF;
    
    ALTER TABLE public.payments ADD CONSTRAINT payments_payment_method_check 
        CHECK (payment_method IN ('cash', 'bank_transfer', 'mpesa', 'other'));
END $$;

-- Add M-Pesa transaction reference to payments table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' 
        AND column_name = 'mpesa_transaction_id'
    ) THEN
        ALTER TABLE public.payments ADD COLUMN mpesa_transaction_id UUID REFERENCES public.mpesa_transactions(id);
    END IF;
END $$;

