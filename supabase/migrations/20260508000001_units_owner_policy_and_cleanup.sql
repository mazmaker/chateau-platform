-- Migration: Add Owner cross-tenant policies on `units` + remove wide-open RLS holes
-- Date: 2026-05-08
-- Phase: 1A (PROPERTY HUB integration foundation)
--
-- Why:
--   Currently `units` has 3 wide-open policies (qual=true) that let ANY authenticated
--   user (including agents/customers from other tenants) read/update/delete ANY unit.
--   This breaks multi-tenant isolation — major security smell.
--
--   But just dropping them would also remove Owner's cross-tenant access (Owner currently
--   relies on the wide-open SELECT to see other tenants' units).
--
-- Plan:
--   1. ADD explicit "Owner can view/update all units" policies first (Owner principle)
--   2. THEN drop wide-open policies (close security hole)
--   3. Net result: Owner still sees all tenants, others scoped properly
--
-- Verification of "no one loses access":
--   - Owner (admin@chateau.com)        → covered by NEW "Owner can view all units" + existing "Admins can update units" + "Owner can delete units"
--   - Admin (อธิตยา)                   → covered by existing "Users can view units in their tenant" + "Admins can update units"
--   - Sales (employee@company.com)     → covered by existing "Users can view units in their tenant"
--   - Agent / Customer (NEW roles)     → covered by existing "Users can view units in their tenant" (was incorrectly seeing cross-tenant via wide-open)

-- ============================================================
-- 1. Add Owner cross-tenant policies (per Owner-sees-all principle)
-- ============================================================

-- Owner can SELECT any unit across all tenants
DROP POLICY IF EXISTS "Owner can view all units" ON units;
CREATE POLICY "Owner can view all units" ON units
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'owner'
    )
  );

-- Owner can UPDATE any unit across all tenants
-- (Note: existing "Admins can update units" already includes role 'owner', but adding
--  this explicit policy makes intent clear and matches the SELECT pattern)
DROP POLICY IF EXISTS "Owner can update all units" ON units;
CREATE POLICY "Owner can update all units" ON units
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.role = 'owner'
    )
  );

-- Note: Owner DELETE already exists ("Owner can delete units") — no need to add

-- ============================================================
-- 2. Drop wide-open policies (close cross-tenant leak)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can view units" ON units;
DROP POLICY IF EXISTS "Authenticated users can update units" ON units;
DROP POLICY IF EXISTS "Authenticated users can delete units" ON units;
DROP POLICY IF EXISTS "Authenticated users can insert units" ON units;

-- ============================================================
-- 3. Confirmation
-- ============================================================

DO $$
DECLARE
  v_owner_view_count int;
  v_wide_open_count int;
BEGIN
  -- Verify Owner cross-tenant policy is in place
  SELECT COUNT(*) INTO v_owner_view_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'units'
    AND policyname = 'Owner can view all units';

  IF v_owner_view_count <> 1 THEN
    RAISE EXCEPTION 'Owner SELECT policy missing on units';
  END IF;

  -- Verify wide-open policies are gone
  SELECT COUNT(*) INTO v_wide_open_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'units'
    AND qual = 'true';

  IF v_wide_open_count > 0 THEN
    RAISE EXCEPTION 'Some wide-open policies still remain on units (qual=true count: %)', v_wide_open_count;
  END IF;

  RAISE NOTICE 'Step 1A complete: units RLS now properly scoped (Owner cross-tenant + per-tenant for others)';
END $$;
