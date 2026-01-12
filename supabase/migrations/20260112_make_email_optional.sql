-- Migration: Make email optional in customers table
-- Created: 2026-01-12
-- Purpose: Allow leads to be created without requiring customer email

-- Remove NOT NULL constraint from email column
ALTER TABLE customers
ALTER COLUMN email DROP NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN customers.email IS 'Customer email address (optional)';
