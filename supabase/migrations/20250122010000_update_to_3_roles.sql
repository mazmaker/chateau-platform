-- Migration: Update to 3 roles system (owner, admin, sales)
-- Date: 2025-01-22
-- Description: Remove 'viewer' role, update permissions for SaaS multi-tenant platform
--              Owner = Platform Owner (manages all tenants, billing, subscriptions)
--              Admin = Company Admin (manages own company, properties, leads, can customize theme)
--              Sales = Sales Staff (manages customers, leads for their company)

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
DROP POLICY IF EXISTS "Sales can create customers" ON customers;
DROP POLICY IF EXISTS "Admins can update customers" ON customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON customers;
DROP POLICY IF EXISTS "Users can view bookings in their tenant" ON bookings;
DROP POLICY IF EXISTS "Sales can create bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can delete bookings" ON bookings;

-- =====================================================
-- STEP 2: Create new user_role type with 3 values
-- =====================================================

CREATE TYPE user_role_new AS ENUM ('owner', 'admin', 'sales');

-- =====================================================
-- STEP 3: Update the users table to use new roles
-- =====================================================

-- Add temporary column with new type
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_new user_role_new;

-- Map old roles to new roles
-- owner -> owner (Platform Owner)
-- admin -> admin (Company Admin)
-- sales -> sales (Sales Staff)
-- viewer -> admin (convert viewers to admin as default)
UPDATE users
SET role_new = CASE
    WHEN role::text = 'owner' THEN 'owner'::user_role_new
    WHEN role::text = 'admin' THEN 'admin'::user_role_new
    WHEN role::text = 'sales' THEN 'sales'::user_role_new
    WHEN role::text = 'viewer' THEN 'sales'::user_role_new
    WHEN role::text = 'manager' THEN 'admin'::user_role_new
    WHEN role::text = 'staff' THEN 'sales'::user_role_new
    ELSE 'sales'::user_role_new
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
-- STEP 5: Recreate RLS policies with new 3-role system
-- =====================================================

-- -----------------------------------------------------
-- TENANTS POLICIES
-- Owner can see and manage ALL tenants
-- Admin can see and manage their own tenant only
-- -----------------------------------------------------

CREATE POLICY "Owner can view all tenants" ON tenants
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Admins can view their own tenant" ON tenants
    FOR SELECT USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Owner can manage all tenants" ON tenants
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Admins can update their own tenant" ON tenants
    FOR UPDATE USING (id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- -----------------------------------------------------
-- USERS POLICIES
-- Owner can see ALL users across all tenants
-- Admin/Sales can only see users in their tenant
-- Owner can manage any user
-- Admin can manage users in their tenant (except other admins)
-- -----------------------------------------------------

CREATE POLICY "Owner can view all users" ON users
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Users can view users in same tenant" ON users
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Owner can manage all users" ON users
    FOR ALL USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Admins can manage users in their tenant" ON users
    FOR UPDATE USING (
        tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin')
        AND id = auth.uid()
    );

-- -----------------------------------------------------
-- PROPERTIES POLICIES
-- Owner can see ALL properties across all tenants
-- Admin/Sales can only see properties in their tenant
-- Admin can create/update/delete properties
-- Sales can only view properties
-- -----------------------------------------------------

CREATE POLICY "Owner can view all properties" ON properties
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Users can view properties in their tenant" ON properties
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can create properties" ON properties
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can update properties" ON properties
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can delete properties" ON properties
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- -----------------------------------------------------
-- CUSTOMERS POLICIES (Leads/Prospects)
-- Owner can see ALL customers across all tenants
-- Admin/Sales can only see customers in their tenant
-- Admin can create/update/delete customers
-- Sales can create/update customers (for lead management)
-- -----------------------------------------------------

CREATE POLICY "Owner can view all customers" ON customers
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Users can view customers in their tenant" ON customers
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can create customers" ON customers
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Sales can create customers" ON customers
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'sales'));

CREATE POLICY "Admins can update customers" ON customers
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'sales')));

CREATE POLICY "Admins can delete customers" ON customers
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- -----------------------------------------------------
-- BOOKINGS POLICIES (Actually used for Sales/Leads tracking)
-- Will be repurposed for lead status tracking
-- -----------------------------------------------------

CREATE POLICY "Owner can view all bookings" ON bookings
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'
    ));

CREATE POLICY "Users can view bookings in their tenant" ON bookings
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can create bookings" ON bookings
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Sales can create bookings" ON bookings
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'sales'));

CREATE POLICY "Admins can update bookings" ON bookings
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('admin', 'sales')));

CREATE POLICY "Admins can delete bookings" ON bookings
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'admin'));

-- =====================================================
-- STEP 6: Update handle_new_user function
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    user_tenant_id uuid;
    existing_owner_count integer;
    user_email text;
BEGIN
    -- Extract email from new user
    user_email := COALESCE(NEW.email, NEW.raw_user_meta_data->>'email');

    -- Check if user should be a platform owner (based on email domain or meta)
    -- For now, we'll make the FIRST user ever created as the platform owner
    SELECT COUNT(*) INTO existing_owner_count
    FROM users
    WHERE role = 'owner';

    IF existing_owner_count = 0 THEN
        -- First user becomes PLATFORM OWNER
        -- Create their own tenant
        INSERT INTO tenants (name, slug, status, subscription_plan)
        VALUES (
            COALESCE(NEW.raw_user_meta_data->>'full_name', 'Platform Owner') || '''s Organization',
            lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', 'platform-owner'), '[^a-zA-Z0-9]', '-', 'g')),
            'active',
            'enterprise'
        )
        RETURNING id INTO user_tenant_id;

        NEW.tenant_id := user_tenant_id;
        NEW.role := 'owner';
    ELSE
        -- Regular users need to be invited to a tenant
        -- For self-signup, create as sales role in first available tenant
        user_tenant_id := (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);

        IF user_tenant_id IS NULL THEN
            -- No tenant exists (shouldn't happen after first user), create one
            INSERT INTO tenants (name, slug, status, subscription_plan)
            VALUES (
                COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Organization'),
                lower(regexp_replace(COALESCE(NEW.raw_user_meta_data->>'full_name', 'new-org'), '[^a-zA-Z0-9]', '-', 'g')),
                'trial',
                'starter'
            )
            RETURNING id INTO user_tenant_id;
        END IF;

        NEW.tenant_id := user_tenant_id;
        NEW.role := 'sales'; -- Default new users to sales role
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 7: Verify the migration
-- =====================================================

SELECT
    'Migration to 3-role system completed!' as status,
    enumlabel as role_value,
    enumsortorder as sort_order
FROM pg_enum
WHERE enumtypid = 'user_role'::regtype
ORDER BY enumsortorder;
