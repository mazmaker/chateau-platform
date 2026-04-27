-- Create invoices and payments tables for billing management
-- This migration creates the necessary tables for invoice and payment tracking

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number text NOT NULL UNIQUE,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    subscription_plan text NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise')),
    due_date timestamptz NOT NULL,
    paid_at timestamptz,
    description text,
    line_items jsonb DEFAULT '[]'::jsonb,
    tax_amount decimal(10,2) DEFAULT 0,
    discount_amount decimal(10,2) DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number text,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('credit_card', 'bank_transfer', 'paypal', 'cash', 'other')),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    transaction_id text,
    reference_code text,
    payment_gateway text,
    gateway_response jsonb,
    notes text,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create invoice_line_items table for detailed billing
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description text NOT NULL,
    quantity decimal(10,2) NOT NULL DEFAULT 1,
    unit_price decimal(10,2) NOT NULL DEFAULT 0,
    total_amount decimal(10,2) NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Create payment_notifications table for tracking sent notifications
CREATE TABLE IF NOT EXISTS payment_notifications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
    notification_type text NOT NULL CHECK (notification_type IN ('payment_due', 'payment_overdue', 'payment_reminder', 'payment_received')),
    sent_at timestamptz NOT NULL DEFAULT now(),
    sent_to text NOT NULL,
    subject text,
    message text,
    status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'bounced', 'failed')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);

CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);

CREATE INDEX IF NOT EXISTS idx_invoice_line_items_invoice_id ON invoice_line_items(invoice_id);

CREATE INDEX IF NOT EXISTS idx_payment_notifications_tenant_id ON payment_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_notifications_invoice_id ON payment_notifications(invoice_id);

-- Add RLS policies
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_notifications ENABLE ROW LEVEL SECURITY;

-- Invoices policies
CREATE POLICY "Owners can manage all invoices" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );

CREATE POLICY "Tenants can view their own invoices" ON invoices
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles
            WHERE user_id = auth.uid()
        )
    );

-- Payments policies
CREATE POLICY "Owners can manage all payments" ON payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );

CREATE POLICY "Tenants can view their own payments" ON payments
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM profiles
            WHERE user_id = auth.uid()
        )
    );

-- Invoice line items policies
CREATE POLICY "Owners can manage all invoice line items" ON invoice_line_items
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );

CREATE POLICY "Tenants can view their own invoice line items" ON invoice_line_items
    FOR SELECT USING (
        invoice_id IN (
            SELECT i.id FROM invoices i
            WHERE i.tenant_id IN (
                SELECT tenant_id FROM profiles
                WHERE user_id = auth.uid()
            )
        )
    );

-- Payment notifications policies
CREATE POLICY "Owners can manage all payment notifications" ON payment_notifications
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );

-- Create function to automatically update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create function to auto-update invoice status based on due date
CREATE OR REPLACE FUNCTION update_invoice_status()
RETURNS void AS $$
BEGIN
    UPDATE invoices
    SET status = 'overdue'
    WHERE status = 'pending'
    AND due_date < NOW()
    AND updated_at < NOW() - INTERVAL '1 hour'; -- Prevent too frequent updates
END;
$$ LANGUAGE plpgsql;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
    year_suffix text;
    sequence_num int;
    invoice_num text;
BEGIN
    year_suffix := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || year_suffix || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_suffix || '-%';

    invoice_num := 'INV-' || year_suffix || '-' || LPAD(sequence_num::text, 4, '0');

    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Insert some sample data for testing
INSERT INTO invoices (tenant_id, invoice_number, amount, subscription_plan, due_date, status, description)
SELECT
    t.id,
    'INV-2024-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    CASE
        WHEN t.subscription_plan = 'starter' THEN 990.00
        WHEN t.subscription_plan = 'professional' THEN 1990.00
        WHEN t.subscription_plan = 'enterprise' THEN 4990.00
        ELSE 0.00
    END,
    t.subscription_plan,
    NOW() + INTERVAL '30 days',
    'pending',
    'Monthly subscription - ' || INITCAP(t.subscription_plan) || ' Plan'
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM invoices i WHERE i.tenant_id = t.id
)
LIMIT 10; -- Only create a few sample invoices

-- Insert some sample payments for paid invoices
INSERT INTO payments (tenant_id, invoice_id, invoice_number, amount, payment_method, payment_status, paid_at)
SELECT
    i.tenant_id,
    i.id,
    i.invoice_number,
    i.amount,
    'bank_transfer',
    'completed',
    NOW() - INTERVAL '5 days'
FROM invoices i
WHERE i.status = 'pending'
ORDER BY RANDOM()
LIMIT 3; -- Create a few sample payments

-- Update corresponding invoices to paid
UPDATE invoices
SET status = 'paid', paid_at = NOW() - INTERVAL '5 days'
WHERE id IN (
    SELECT invoice_id FROM payments WHERE payment_status = 'completed'
);

-- Create some overdue invoices
UPDATE invoices
SET status = 'overdue', due_date = NOW() - INTERVAL '10 days'
WHERE status = 'pending'
ORDER BY RANDOM()
LIMIT 2;