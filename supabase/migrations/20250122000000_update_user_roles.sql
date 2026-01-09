-- Migration: Update user_role enum to match application requirements
-- Date: 2025-01-22
-- Description: Change user roles from (owner, admin, manager, staff) to (owner, admin, sales)
-- NOTE: This migration is superseded by 20250122010000_update_to_3_roles.sql
-- which removed the 'viewer' role entirely

-- =====================================================
-- STEP 1: Drop all RLS policies that depend on user_role
-- =====================================================

DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Users can update users in same tenant" ON users;
DROP POLICY IF EXISTS "Service role can manage all users" ON users;
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view properties in their tenant" ON properties;
DROP POLICY IF EXISTS "Admins can create properties" ON properties;
DROP POLICY IF EXISTS "Admins can update properties" ON properties;
DROP POLICY IF EXISTS "Admins can delete properties" ON properties;
DROP POLICY IF EXISTS "Users can view customers in their tenant" ON customers;
DROP POLICY IF EXISTS "Staff can create customers" ON customers;
DROP POLICY IF EXISTS "Admins can update customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON customers;
DROP POLICY IF EXISTS "Users can view bookings in their tenant" ON bookings;
DROP POLICY IF EXISTS "Staff can create bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

-- =====================================================
-- STEP 2: Create new user_role type with desired values
-- =====================================================

CREATE TYPE user_role_new AS ENUM ('owner', 'admin', 'sales', 'viewer'); -- Note: viewer removed in next migration

-- =====================================================
-- STEP 3: Update the users table to use new roles
-- =====================================================

-- Add temporary column with new type
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_new user_role_new;

-- Map old roles to new roles
UPDATE users
SET role_new = CASE
    WHEN role::text = 'owner' THEN 'owner'::user_role_new
    WHEN role::text = 'admin' THEN 'admin'::user_role_new
    WHEN role::text = 'manager' THEN 'admin'::user_role_new
    WHEN role::text = 'staff' THEN 'sales'::user_role_new
END::user_role_new;

-- Make the new column NOT NULL
ALTER TABLE users ALTER COLUMN role_new SET NOT NULL;

-- Drop old role column
ALTER TABLE users DROP COLUMN role;

-- Rename new column to role
ALTER TABLE users RENAME COLUMN role_new TO role;

-- =====================================================
-- STEP 4: Replace the old enum type with new one
-- =====================================================

DROP TYPE user_role CASCADE;
ALTER TYPE user_role_new RENAME TO user_role;

-- =====================================================
-- STEP 5: Recreate RLS policies with new roles
-- =====================================================

-- Tenants policies
CREATE POLICY "Users can view their own tenant" ON tenants
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own tenant" ON tenants
    FOR UPDATE USING (id = auth.uid());

-- Users policies
CREATE POLICY "Users can view users in same tenant" ON users
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update users in same tenant" ON users
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND id = auth.uid());

CREATE POLICY "Service role can manage all users" ON users
    FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Properties policies
CREATE POLICY "Users can view properties in their tenant" ON properties
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can create properties" ON properties
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins can update properties" ON properties
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins can delete properties" ON properties
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Customers policies
CREATE POLICY "Users can view customers in their tenant" ON customers
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Sales can create customers" ON customers
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can update customers" ON customers
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins can delete customers" ON customers
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Bookings policies
CREATE POLICY "Users can view bookings in their tenant" ON bookings
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Sales can create bookings" ON bookings
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can update bookings" ON bookings
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins can delete bookings" ON bookings
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- =====================================================
-- STEP 6: Update handle_new_user function
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_tenant_id uuid;
    existing_owner_count integer;
BEGIN
    -- Get or assign tenant_id
    IF NEW.tenant_id IS NULL THEN
        -- Try to assign to an existing tenant
        user_tenant_id := (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);

        -- If no tenant exists, create a default one
        IF user_tenant_id IS NULL THEN
            INSERT INTO tenants (name, slug)
            VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Default Organization'),
                    lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', 'default-org'), '[^a-zA-Z0-9]', '-', 'g')))
            RETURNING id INTO user_tenant_id;
        END IF;

        NEW.tenant_id := user_tenant_id;
    END IF;

    -- Check if this is the first user in the tenant (make them owner)
    SELECT COUNT(*) INTO existing_owner_count
    FROM users
    WHERE tenant_id = NEW.tenant_id AND role = 'owner';

    IF existing_owner_count = 0 THEN
        NEW.role := 'owner';
    ELSE
        -- Default new users to 'sales' role
        NEW.role := 'sales';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Verify the migration
-- =====================================================

SELECT
    'Migration completed!' as status,
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
