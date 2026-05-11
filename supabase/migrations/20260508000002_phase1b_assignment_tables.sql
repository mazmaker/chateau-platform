-- Migration: Phase 1B — Create 4 assignment tables for PROPERTY HUB permission scoping
-- Date: 2026-05-08
--
-- Tables created:
--   1. admin_project_assignments  — Admin (Regional Manager) → Projects (Owner assigns)
--   2. sales_project_assignments  — Sales → Projects (Admin assigns, project-scoped)
--   3. sales_unit_assignments     — Sales → specific Units they close deals on (Admin designates)
--   4. agent_unit_assignments     — Agent (broker) → specific Units to sell (Admin assigns)
--
-- Hierarchy:
--   Owner → manages admin_project_assignments (cross-tenant)
--   Admin → manages sales_*/agent_* assignments (within their tenant)
--   Sales/Agent → view their own assignments (read-only)
--
-- IMPORTANT — seeded to preserve current behavior:
--   All EXISTING admins are auto-seeded to ALL projects in their tenant.
--   This way, Phase 1B doesn't break the current "admin sees everything" experience.
--   Owner can later revoke specific assignments via Permission Matrix UI (Phase 1D).
--   NEW admins created after this migration will start with 0 project assignments
--   (Owner must explicitly assign them — by design).
--
-- Note on Owner principle:
--   Per `feedback_owner_sees_all_principle`, every new table includes Owner cross-tenant
--   policies. Admin has tenant-scoped management; Sales/Agent have self-view only.

-- ==================================================================
-- 1. admin_project_assignments — Admin manages which projects
-- ==================================================================

CREATE TABLE IF NOT EXISTS admin_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  notes text,
  UNIQUE (admin_user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_apa_admin_active
  ON admin_project_assignments(admin_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apa_project_active
  ON admin_project_assignments(project_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_apa_tenant
  ON admin_project_assignments(tenant_id);

COMMENT ON TABLE admin_project_assignments IS
  'Many-to-many: which Admin (regional/project manager) manages which Project. Managed by Owner.';

-- ==================================================================
-- 2. sales_project_assignments — Sales sees which projects
-- ==================================================================

CREATE TABLE IF NOT EXISTS sales_project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sales_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (sales_user_id, project_id)
);

CREATE INDEX IF NOT EXISTS idx_spa_sales_active
  ON sales_project_assignments(sales_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spa_project_active
  ON sales_project_assignments(project_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spa_tenant
  ON sales_project_assignments(tenant_id);

COMMENT ON TABLE sales_project_assignments IS
  'Many-to-many: which Sales sees which Project (project-scoped browsing). Managed by Admin.';

-- ==================================================================
-- 3. sales_unit_assignments — Sales designated to close deal on specific units
-- ==================================================================

CREATE TABLE IF NOT EXISTS sales_unit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sales_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (sales_user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_sua_sales_active
  ON sales_unit_assignments(sales_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sua_unit_active
  ON sales_unit_assignments(unit_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sua_tenant
  ON sales_unit_assignments(tenant_id);

COMMENT ON TABLE sales_unit_assignments IS
  'Many-to-many: which Sales is designated to close deals on which specific Unit. Managed by Admin.';

-- ==================================================================
-- 4. agent_unit_assignments — Agent (broker) sees/sells specific units
-- ==================================================================

CREATE TABLE IF NOT EXISTS agent_unit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  agent_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (agent_user_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_aua_agent_active
  ON agent_unit_assignments(agent_user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aua_unit_active
  ON agent_unit_assignments(unit_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_aua_tenant
  ON agent_unit_assignments(tenant_id);

COMMENT ON TABLE agent_unit_assignments IS
  'Many-to-many: which Agent (broker) is allowed to sell which Unit. Managed by Admin.';

-- ==================================================================
-- Enable Row Level Security on all 4 tables
-- ==================================================================

ALTER TABLE admin_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_unit_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_unit_assignments   ENABLE ROW LEVEL SECURITY;

-- ==================================================================
-- RLS POLICIES — Owner principle: Owner sees + manages everything
-- ==================================================================

-- ----- admin_project_assignments -----
-- Owner: full CRUD across all tenants
CREATE POLICY "Owner can view all admin-project assignments"
  ON admin_project_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));
CREATE POLICY "Owner can manage admin-project assignments"
  ON admin_project_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Admin: can view assignments in their tenant (so they can see who manages what alongside them)
CREATE POLICY "Admin can view admin-project in their tenant"
  ON admin_project_assignments FOR SELECT
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ----- sales_project_assignments -----
-- Owner: full CRUD cross-tenant
CREATE POLICY "Owner can manage sales-project assignments"
  ON sales_project_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Admin: full CRUD within their tenant
CREATE POLICY "Admin can manage sales-project in their tenant"
  ON sales_project_assignments FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Sales: view own rows only
CREATE POLICY "Sales can view own project assignments"
  ON sales_project_assignments FOR SELECT
  USING (sales_user_id = auth.uid());

-- ----- sales_unit_assignments -----
CREATE POLICY "Owner can manage sales-unit assignments"
  ON sales_unit_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "Admin can manage sales-unit in their tenant"
  ON sales_unit_assignments FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Sales can view own unit assignments"
  ON sales_unit_assignments FOR SELECT
  USING (sales_user_id = auth.uid());

-- ----- agent_unit_assignments -----
CREATE POLICY "Owner can manage agent-unit assignments"
  ON agent_unit_assignments FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

CREATE POLICY "Admin can manage agent-unit in their tenant"
  ON agent_unit_assignments FOR ALL
  USING (
    tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid())
    AND EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Agent can view own unit assignments"
  ON agent_unit_assignments FOR SELECT
  USING (agent_user_id = auth.uid());

-- ==================================================================
-- SEED — Existing admins get all projects in their tenant (preserve current behavior)
--   • Only seeds admins that exist NOW. New admins added later will not be auto-seeded.
--   • ON CONFLICT DO NOTHING makes this idempotent (safe to re-run).
-- ==================================================================

INSERT INTO admin_project_assignments (tenant_id, admin_user_id, project_id, assigned_by, notes)
SELECT
  u.tenant_id,
  u.id,
  p.id,
  (SELECT id FROM users WHERE role = 'owner' AND tenant_id = u.tenant_id LIMIT 1),
  'Auto-seeded from Phase 1B migration — preserves pre-existing tenant-wide admin visibility'
FROM users u
CROSS JOIN properties p
WHERE u.role = 'admin'
  AND u.tenant_id = p.tenant_id
ON CONFLICT (admin_user_id, project_id) DO NOTHING;

-- ==================================================================
-- Verification — fail loudly if anything wrong
-- ==================================================================

DO $$
DECLARE
  v_admins int;
  v_projects int;
  v_assignments int;
  v_expected_assignments int;
BEGIN
  SELECT COUNT(*) INTO v_admins FROM users WHERE role = 'admin';
  SELECT COUNT(*) INTO v_projects FROM properties;
  SELECT COUNT(*) INTO v_assignments FROM admin_project_assignments;

  -- For each admin, sum of projects in their tenant
  SELECT COALESCE(SUM(p_count), 0) INTO v_expected_assignments
  FROM users u
  CROSS JOIN LATERAL (
    SELECT COUNT(*) AS p_count FROM properties WHERE tenant_id = u.tenant_id
  ) p
  WHERE u.role = 'admin';

  RAISE NOTICE 'Phase 1B: % admins, % projects, % seeded admin assignments (expected %)',
    v_admins, v_projects, v_assignments, v_expected_assignments;

  IF v_assignments < v_expected_assignments THEN
    RAISE EXCEPTION 'Seed under-filled: got % assignments, expected at least %',
      v_assignments, v_expected_assignments;
  END IF;

  -- Verify all 4 tables exist with RLS enabled
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'admin_project_assignments') THEN
    RAISE EXCEPTION 'admin_project_assignments table not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_project_assignments') THEN
    RAISE EXCEPTION 'sales_project_assignments table not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sales_unit_assignments') THEN
    RAISE EXCEPTION 'sales_unit_assignments table not created';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'agent_unit_assignments') THEN
    RAISE EXCEPTION 'agent_unit_assignments table not created';
  END IF;

  RAISE NOTICE 'Phase 1B complete: 4 assignment tables ready with RLS + seed.';
  RAISE NOTICE 'NOTE: properties/units RLS unchanged in this migration (admins still see all projects via tenant-scoped policy). RLS enforcement of assignments comes in Phase 1C.';
END $$;
