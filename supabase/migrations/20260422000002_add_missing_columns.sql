-- Migration: Add missing columns and fix schema issues
-- Created: 2026-04-22
-- Purpose: Ensure all required columns exist for invoice and tenant management

-- 1. Add missing columns to tenants table (if not exists)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS email varchar(255),
ADD COLUMN IF NOT EXISTS billing_email varchar(255);

-- 2. Add missing columns to invoices table (if not exists)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS invoice_number varchar(50),
ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS subscription_plan varchar(50),
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS description text;

-- 3. Create company_settings table if not exists
CREATE TABLE IF NOT EXISTS company_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name varchar(255),
    billing_automation jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),

    CONSTRAINT unique_tenant_settings UNIQUE(tenant_id)
);

-- 4. Add billing_settings to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS billing_settings jsonb DEFAULT '{}';

-- 5. Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant_id ON company_settings(tenant_id);

-- 6. Enable RLS on company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for company_settings
-- Users can read their tenant's company settings
CREATE POLICY "Users can read their tenant company settings" ON company_settings
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- Users can update their tenant's company settings
CREATE POLICY "Users can update their tenant company settings" ON company_settings
FOR UPDATE USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- Users can insert company settings for their tenant
CREATE POLICY "Users can insert their tenant company settings" ON company_settings
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 8. Add constraints for data integrity
-- Ensure invoice numbers are unique
CREATE UNIQUE INDEX IF NOT EXISTS unique_invoice_number ON invoices(invoice_number);

-- Ensure valid status values
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS valid_invoice_status;
ALTER TABLE invoices ADD CONSTRAINT valid_invoice_status
CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled'));

-- Ensure valid subscription plans
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS valid_subscription_plan;
ALTER TABLE invoices ADD CONSTRAINT valid_subscription_plan
CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise'));

-- 9. Update existing data (if needed)
-- Set default values for existing records
UPDATE invoices
SET currency = 'THB'
WHERE currency IS NULL;

UPDATE invoices
SET subscription_plan = 'starter'
WHERE subscription_plan IS NULL;

-- 10. Add helpful comments
COMMENT ON COLUMN tenants.suspended_at IS 'When the tenant was suspended (if applicable)';
COMMENT ON COLUMN tenants.suspension_reason IS 'Reason for tenant suspension';
COMMENT ON COLUMN tenants.email IS 'Primary contact email for tenant';
COMMENT ON COLUMN tenants.billing_email IS 'Email for billing notifications';
COMMENT ON TABLE company_settings IS 'Company-specific settings and configurations';
COMMENT ON COLUMN profiles.billing_settings IS 'User-specific billing automation settings';