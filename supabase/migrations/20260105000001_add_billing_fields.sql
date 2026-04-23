-- Add billing information fields to tenants table
-- This migration adds billing address and tax info for invoices

-- Add billing columns if they don't exist
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_phone text,
ADD COLUMN IF NOT EXISTS tax_id text;
