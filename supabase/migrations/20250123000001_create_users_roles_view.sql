-- ============================================================================
-- Create View for User Management Dashboard
-- ============================================================================
-- This view combines users with their roles and tenant information
-- for easy viewing in Supabase Dashboard
--
-- Author: Supabase Agent
-- Date: 2025-12-25
-- ============================================================================

CREATE OR REPLACE VIEW users_with_roles AS
SELECT
  u.id,
  u.email,
  u.full_name,
  u.phone,
  u.role,
  u.is_active,
  u.created_at,
  u.last_sign_in_at,
  u.updated_at,
  t.id as tenant_id,
  t.name as tenant_name,
  t.slug as tenant_slug,
  t.status as tenant_status,
  t.subscription_plan
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
ORDER BY u.created_at DESC;

-- Add comment
COMMENT ON VIEW users_with_roles IS 'User management view with roles and tenant information - Access via Table Editor';
