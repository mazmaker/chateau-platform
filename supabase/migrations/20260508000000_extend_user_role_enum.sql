-- Migration: Extend user_role enum to support 5 roles
-- Date: 2026-05-08
-- Description: Add 'agent' and 'customer' roles for PROPERTY HUB integration.
--              Existing roles (owner, admin, sales) unchanged.
--
-- Role definitions:
--   owner    = Platform Owner (manages all tenants, billing, subscriptions) — existing
--   admin    = Tenant Admin (manages own company, properties, sales+agent permissions) — existing
--   sales    = In-house Sales Staff (project-scoped, can close deals) — existing
--   agent    = External Broker / นายหน้า (unit-scoped, refers customers) — NEW
--   customer = End-buyer (views properties + own reservations) — NEW
--
-- IMPORTANT:
--   - This migration ONLY extends the enum. RLS policies, unit_assignments table,
--     and other PROPERTY HUB schema changes will come in subsequent migrations.
--   - ALTER TYPE ADD VALUE cannot be rolled back inside a transaction in some
--     PostgreSQL versions, so this migration is intentionally minimal and isolated.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'agent';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';

-- Verify the new enum values were added
DO $$
DECLARE
    v_count int;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype
      AND enumlabel IN ('agent', 'customer');

    IF v_count <> 2 THEN
        RAISE EXCEPTION 'Failed to add agent/customer to user_role enum (got % new values)', v_count;
    END IF;

    RAISE NOTICE 'user_role enum extended successfully — now supports 5 roles: owner, admin, sales, agent, customer';
END $$;
