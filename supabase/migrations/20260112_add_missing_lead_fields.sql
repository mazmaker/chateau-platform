-- Migration: Add Missing Lead Fields
-- Created: 2026-01-12
-- Purpose: Add missing demographic and financial fields that were referenced in code

-- Add missing demographic fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS age INTEGER CHECK (age >= 18 AND age <= 120),
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other')),
ADD COLUMN IF NOT EXISTS education VARCHAR(50) CHECK (education IN ('high_school', 'bachelor', 'master', 'doctorate'));

-- Add missing financial field
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS monthly_income DECIMAL(12,2) DEFAULT 0;

-- Add missing work location field
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS workplace VARCHAR(255);

-- Add indexes for commonly queried fields
CREATE INDEX IF NOT EXISTS idx_leads_age ON leads(age);
CREATE INDEX IF NOT EXISTS idx_leads_monthly_income ON leads(monthly_income DESC);

-- Add comments for documentation
COMMENT ON COLUMN leads.age IS 'Age of the lead (18-120 years)';
COMMENT ON COLUMN leads.gender IS 'Gender: male, female, or other';
COMMENT ON COLUMN leads.education IS 'Education level: high_school, bachelor, master, doctorate';
COMMENT ON COLUMN leads.monthly_income IS 'Monthly income in THB';
COMMENT ON COLUMN leads.workplace IS 'Company name or workplace location';
