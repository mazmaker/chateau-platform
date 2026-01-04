-- ============================================================================
-- CHATEAU Platform: Add INSERT Policy for Tenants Table
-- ============================================================================
-- This migration adds the missing INSERT policy to allow platform owners
-- to create new tenant companies through the Tenant Management UI.
--
-- Issue: Without this policy, the "Create Tenant" button fails silently
-- because RLS blocks INSERT operations for non-service-role users.
--
-- Solution: Add INSERT policy using the existing is_owner() helper function
-- ============================================================================

-- Drop existing policies if they exist (for safe re-run)
DROP POLICY IF EXISTS "Owners can create tenants" ON tenants;

-- Create INSERT policy for tenants table
-- This allows users with 'owner' role to create new tenant companies
CREATE POLICY "Owners can create tenants" ON tenants
  FOR INSERT
  WITH CHECK (is_owner());

-- Also add DELETE policy for owners (was missing)
DROP POLICY IF EXISTS "Owners can delete tenants" ON tenants;

CREATE POLICY "Owners can delete tenants" ON tenants
  FOR DELETE
  USING (is_owner());

-- ============================================================================
-- Verification
-- ============================================================================

-- Check that all tenant policies now exist
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'tenants'
ORDER BY policyname;

-- Expected result should show:
-- 1. Users can view own tenant (SELECT)
-- 2. Owners can update own tenant (UPDATE)
-- 3. Owners can create tenants (INSERT) <- NEW
-- 4. Owners can delete tenants (DELETE) <- NEW
-- 5. Service role can manage tenants (ALL)
