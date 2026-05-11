-- Migration: Phase 1C — Enforce assignment-based RLS on properties + units
-- Date: 2026-05-08
--
-- Goal:
--   Replace overly-permissive "tenant-scoped" SELECT policies with assignment-based
--   filtering. Admin/Sales/Agent now see only what they're explicitly assigned to,
--   not the whole tenant.
--
-- Coverage:
--   properties  (projects):
--     • Admin sees only projects in admin_project_assignments
--     • Sales sees only projects in sales_project_assignments
--     • Agent sees projects of units in agent_unit_assignments (cascade)
--     • Owner still sees ALL across tenants (Owner principle)
--
--   units:
--     • Admin sees units in their assigned projects
--     • Sales sees units in their assigned projects (project-level browse)
--     • Sales can UPDATE designated units (via sales_unit_assignments — for status changes)
--     • Agent sees ONLY specific units in agent_unit_assignments
--     • Owner still sees ALL across tenants
--
-- Risk: LOW
--   Existing admins (อธิตยา, ชิตพล, สมบัติ) all have full assignments from Phase 1B seed.
--   No visibility regression for them.
--   Sales/Agent users will see fewer items (correct — they had unintended cross-tenant access via wide-open).

-- ==================================================================
-- PROPERTIES — DROP overly-permissive SELECT policies
-- ==================================================================

DROP POLICY IF EXISTS "Users can view properties in their tenant" ON properties;
DROP POLICY IF EXISTS "Users can view tenant properties" ON properties;

-- ==================================================================
-- PROPERTIES — ADD assignment-based SELECT policies
-- ==================================================================

-- Admin: sees only projects in their admin_project_assignments
DROP POLICY IF EXISTS "Admin sees assigned projects" ON properties;
CREATE POLICY "Admin sees assigned projects" ON properties FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_project_assignments apa
    WHERE apa.admin_user_id = auth.uid()
      AND apa.project_id = properties.id
      AND apa.revoked_at IS NULL
  )
);

-- Sales: sees only projects in their sales_project_assignments
DROP POLICY IF EXISTS "Sales sees assigned projects" ON properties;
CREATE POLICY "Sales sees assigned projects" ON properties FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_project_assignments spa
    WHERE spa.sales_user_id = auth.uid()
      AND spa.project_id = properties.id
      AND spa.revoked_at IS NULL
  )
);

-- Agent: sees projects of units they're assigned to (cascade upward)
DROP POLICY IF EXISTS "Agent sees projects of assigned units" ON properties;
CREATE POLICY "Agent sees projects of assigned units" ON properties FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agent_unit_assignments aua
    JOIN units u ON u.id = aua.unit_id
    WHERE aua.agent_user_id = auth.uid()
      AND u.project_id = properties.id
      AND aua.revoked_at IS NULL
  )
);

-- ==================================================================
-- PROPERTIES — Tighten UPDATE/DELETE (was tenant-scoped, now assignment-scoped)
-- ==================================================================

DROP POLICY IF EXISTS "Admins can update properties" ON properties;
CREATE POLICY "Admin can update assigned projects" ON properties FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_project_assignments apa
    JOIN users u ON u.id = auth.uid()
    WHERE apa.admin_user_id = auth.uid()
      AND apa.project_id = properties.id
      AND apa.revoked_at IS NULL
      AND u.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can delete properties" ON properties;
CREATE POLICY "Admin can delete assigned projects" ON properties FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM admin_project_assignments apa
    JOIN users u ON u.id = auth.uid()
    WHERE apa.admin_user_id = auth.uid()
      AND apa.project_id = properties.id
      AND apa.revoked_at IS NULL
      AND u.role = 'admin'
  )
);

-- Owner principle: ensure Owner has UPDATE on properties (in case missing)
DROP POLICY IF EXISTS "Owner can update all properties" ON properties;
CREATE POLICY "Owner can update all properties" ON properties FOR UPDATE
USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- (DELETE for owner already exists as "Owners can delete properties" — keep)

-- ==================================================================
-- UNITS — DROP overly-permissive SELECT policy
-- ==================================================================

DROP POLICY IF EXISTS "Users can view units in their tenant" ON units;

-- ==================================================================
-- UNITS — ADD assignment-based SELECT policies
-- ==================================================================

-- Admin: sees units in their assigned projects
DROP POLICY IF EXISTS "Admin sees units in assigned projects" ON units;
CREATE POLICY "Admin sees units in assigned projects" ON units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_project_assignments apa
    WHERE apa.admin_user_id = auth.uid()
      AND apa.project_id = units.project_id
      AND apa.revoked_at IS NULL
  )
);

-- Sales: sees units in their assigned projects (project-level browse)
DROP POLICY IF EXISTS "Sales sees units in assigned projects" ON units;
CREATE POLICY "Sales sees units in assigned projects" ON units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM sales_project_assignments spa
    WHERE spa.sales_user_id = auth.uid()
      AND spa.project_id = units.project_id
      AND spa.revoked_at IS NULL
  )
);

-- Agent: sees ONLY specific units assigned (unit-level)
DROP POLICY IF EXISTS "Agent sees only assigned units" ON units;
CREATE POLICY "Agent sees only assigned units" ON units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agent_unit_assignments aua
    WHERE aua.agent_user_id = auth.uid()
      AND aua.unit_id = units.id
      AND aua.revoked_at IS NULL
  )
);

-- ==================================================================
-- UNITS — Tighten UPDATE (was tenant-scoped, now assignment-scoped)
-- ==================================================================

DROP POLICY IF EXISTS "Admins can update units" ON units;
CREATE POLICY "Admin can update units in assigned projects" ON units FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM admin_project_assignments apa
    JOIN users u ON u.id = auth.uid()
    WHERE apa.admin_user_id = auth.uid()
      AND apa.project_id = units.project_id
      AND apa.revoked_at IS NULL
      AND u.role = 'admin'
  )
);

-- Sales can UPDATE units they're designated to close (status workflow)
DROP POLICY IF EXISTS "Sales can update designated units" ON units;
CREATE POLICY "Sales can update designated units" ON units FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM sales_unit_assignments sua
    JOIN users u ON u.id = auth.uid()
    WHERE sua.sales_user_id = auth.uid()
      AND sua.unit_id = units.id
      AND sua.revoked_at IS NULL
      AND u.role = 'sales'
  )
);

-- ==================================================================
-- Verification
-- ==================================================================

DO $$
BEGIN
  -- Old policies should be gone
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'properties'
      AND policyname IN ('Users can view properties in their tenant', 'Users can view tenant properties')
  ) THEN
    RAISE EXCEPTION 'Old tenant-wide properties SELECT policy still present';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'units'
      AND policyname = 'Users can view units in their tenant'
  ) THEN
    RAISE EXCEPTION 'Old tenant-wide units SELECT policy still present';
  END IF;

  -- New policies should exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'properties'
      AND policyname = 'Admin sees assigned projects'
  ) THEN
    RAISE EXCEPTION 'New Admin properties SELECT policy not created';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'units'
      AND policyname = 'Admin sees units in assigned projects'
  ) THEN
    RAISE EXCEPTION 'New Admin units SELECT policy not created';
  END IF;

  RAISE NOTICE 'Phase 1C complete: RLS now enforces assignment-based filtering on properties + units.';
  RAISE NOTICE 'Admin/Sales see only assigned projects (and their units). Agent sees only assigned units. Owner sees all (cross-tenant).';
END $$;
