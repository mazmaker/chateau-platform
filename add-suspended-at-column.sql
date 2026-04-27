-- Fix suspension service by adding missing columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspension_reason text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email text;

-- Add billing automation settings support
ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS billing_automation jsonb DEFAULT '{}';
