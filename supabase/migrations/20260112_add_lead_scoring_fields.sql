-- Migration: Add Lead Scoring and Loan Estimation Fields
-- Created: 2026-01-12
-- Purpose: Add fields for AI-based lead scoring and loan estimation

-- Add financial information fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS credit_score INTEGER CHECK (credit_score >= 300 AND credit_score <= 850),
ADD COLUMN IF NOT EXISTS monthly_debt DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS down_payment_ready DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS savings DECIMAL(12,2) DEFAULT 0;

-- Add employment information fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS employment_type VARCHAR(20) CHECK (employment_type IN ('government', 'private', 'business', 'freelance')),
ADD COLUMN IF NOT EXISTS years_employed DECIMAL(4,2),
ADD COLUMN IF NOT EXISTS company_name VARCHAR(255);

-- Add demographic information fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS household_size INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20) CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
ADD COLUMN IF NOT EXISTS has_co_borrower BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS number_of_dependents INTEGER DEFAULT 0;

-- Add property history fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS is_first_time_buyer BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS existing_properties INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sold_property_recently BOOLEAN DEFAULT FALSE;

-- Add behavioral tracking fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS website_visits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pages_viewed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS time_on_site INTEGER DEFAULT 0, -- in minutes
ADD COLUMN IF NOT EXISTS brochure_downloads INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS site_visit_attended BOOLEAN DEFAULT FALSE;

-- Add intent signal fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(10) CHECK (urgency_level IN ('high', 'medium', 'low')) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS decision_maker BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS financing_approved BOOLEAN DEFAULT FALSE;

-- Add scoring results fields (to cache calculated scores)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS potential_score INTEGER CHECK (potential_score >= 0 AND potential_score <= 100),
ADD COLUMN IF NOT EXISTS financial_score INTEGER CHECK (financial_score >= 0 AND financial_score <= 100),
ADD COLUMN IF NOT EXISTS engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
ADD COLUMN IF NOT EXISTS urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 100),
ADD COLUMN IF NOT EXISTS fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
ADD COLUMN IF NOT EXISTS conversion_probability DECIMAL(5,4) CHECK (conversion_probability >= 0 AND conversion_probability <= 1),
ADD COLUMN IF NOT EXISTS score_last_updated TIMESTAMP WITH TIME ZONE;

-- Add loan estimation fields
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS max_loan_amount DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS estimated_monthly_payment DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS estimated_interest_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS loan_term_years INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS dti_ratio DECIMAL(5,2), -- Debt-to-Income ratio
ADD COLUMN IF NOT EXISTS ltv_ratio DECIMAL(5,2), -- Loan-to-Value ratio
ADD COLUMN IF NOT EXISTS loan_approval_probability DECIMAL(5,4) CHECK (loan_approval_probability >= 0 AND loan_approval_probability <= 1),
ADD COLUMN IF NOT EXISTS loan_last_updated TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_leads_potential_score ON leads(potential_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_conversion_probability ON leads(conversion_probability DESC);
CREATE INDEX IF NOT EXISTS idx_leads_credit_score ON leads(credit_score);
CREATE INDEX IF NOT EXISTS idx_leads_employment_type ON leads(employment_type);
CREATE INDEX IF NOT EXISTS idx_leads_urgency_level ON leads(urgency_level);

-- Add comments for documentation
COMMENT ON COLUMN leads.credit_score IS 'Credit score (300-850). Used for loan approval probability calculation';
COMMENT ON COLUMN leads.monthly_debt IS 'Total monthly debt obligations in THB';
COMMENT ON COLUMN leads.down_payment_ready IS 'Amount ready for down payment in THB';
COMMENT ON COLUMN leads.employment_type IS 'Type of employment: government, private, business, or freelance';
COMMENT ON COLUMN leads.potential_score IS 'Overall lead potential score (0-100). Higher = more likely to convert';
COMMENT ON COLUMN leads.conversion_probability IS 'Probability of conversion (0-1)';
COMMENT ON COLUMN leads.max_loan_amount IS 'Maximum loan amount the lead can qualify for in THB';
COMMENT ON COLUMN leads.dti_ratio IS 'Debt-to-Income ratio (%)';
COMMENT ON COLUMN leads.ltv_ratio IS 'Loan-to-Value ratio (%)';
