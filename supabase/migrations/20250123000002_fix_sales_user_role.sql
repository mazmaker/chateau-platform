-- ============================================================================
-- Fix Role: sales@chateau.com should be SALES not ADMIN
-- ============================================================================
-- Reason: During sync, all non-owner users were set to admin
-- This corrects the sales@chateau.com role to SALES
-- ============================================================================

UPDATE users
SET role = 'sales'
WHERE email = 'sales@chateau.com';

-- Verify
SELECT email, role FROM users WHERE email = 'sales@chateau.com';
