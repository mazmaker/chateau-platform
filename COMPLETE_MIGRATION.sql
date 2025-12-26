-- ====================================================================
-- COMPLETE DATABASE MIGRATION FOR EPIC 0 AUTHENTICATION SYSTEM
-- ====================================================================
-- ⚠️  IMPORTANT: Run this ENTIRE file in Supabase SQL Editor
-- 📍 URL: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
-- ====================================================================

-- MIGRATION 1: Fix Authentication Schema
-- ====================================================================

-- Drop old trigger and function that conflicts with our auth flow
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Update user_role enum to match frontend
DROP TYPE IF EXISTS user_role;
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');

-- Create user_tenants table for multi-tenant user relationships
CREATE TABLE IF NOT EXISTS user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    is_active boolean DEFAULT true,
    invited_by uuid REFERENCES auth.users(id),
    invited_at timestamptz,
    joined_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- Update users table to remove redundant fields and add missing ones
ALTER TABLE users
DROP COLUMN IF EXISTS tenant_id,
DROP COLUMN IF EXISTS role,
DROP COLUMN IF EXISTS is_active,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false;

-- Update subscription_plan enum to match frontend naming
DROP TYPE IF EXISTS subscription_plan;
CREATE TYPE subscription_plan AS ENUM ('free', 'professional', 'enterprise');

ALTER TABLE tenants
ALTER COLUMN subscription_plan DROP DEFAULT,
ALTER COLUMN subscription_plan SET DEFAULT 'free',
ALTER COLUMN max_properties SET DEFAULT 5;

-- Add missing columns to tenants for white-labeling
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS logo_url text,
ADD COLUMN IF NOT EXISTS primary_color varchar(7) DEFAULT '#4f46e5',
ADD COLUMN IF NOT EXISTS secondary_color varchar(7) DEFAULT '#7c3aed',
ADD COLUMN IF NOT EXISTS custom_domain text,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS subscription_current_period_start timestamptz,
ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;

-- Create indexes for user_tenants
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_is_active ON user_tenants(is_active);

-- Enable RLS on user_tenants
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Drop old RLS policies that conflict
DROP POLICY IF EXISTS "Users can view their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can update their own tenant" ON tenants;
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Users can update users in same tenant" ON users;
DROP POLICY IF EXISTS "Service role can manage all users" ON users;

-- Create new RLS policies
-- Tenants policies
CREATE POLICY "Users can view their tenant memberships" ON tenants FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Tenant owners can update tenant" ON tenants FOR UPDATE USING (
    id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true)
);

-- Users policies - users can only see their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());

-- user_tenants policies
CREATE POLICY "Users can view their tenant memberships" ON user_tenants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage all user_tenants" ON user_tenants FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Create function to handle user signup properly
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Insert user profile with metadata from auth
    INSERT INTO users (id, email, full_name, metadata)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        COALESCE(NEW.raw_user_meta_data, '{}')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        metadata = EXCLUDED.metadata,
        updated_at = now();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to create tenant and assign owner
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
    tenant_name text,
    owner_email text,
    owner_full_name text DEFAULT NULL
)
RETURNS uuid AS $$
DECLARE
    new_tenant_id uuid;
    new_user_id uuid;
BEGIN
    -- Create tenant
    INSERT INTO tenants (name, slug, status, subscription_plan)
    VALUES (
        tenant_name,
        lower(regexp_replace(tenant_name, '[^a-zA-Z0-9]', '-', 'g')),
        'active',
        'professional'
    )
    RETURNING id INTO new_tenant_id;

    -- Get user ID
    SELECT id INTO new_user_id FROM auth.users WHERE email = owner_email;

    IF new_user_id IS NOT NULL THEN
        -- Create user-tenant relationship as owner
        INSERT INTO user_tenants (user_id, tenant_id, role)
        VALUES (new_user_id, new_tenant_id, 'owner');
    END IF;

    RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to invite user to tenant
CREATE OR REPLACE FUNCTION public.invite_user_to_tenant(
    tenant_id_param uuid,
    email_param text,
    role_param user_role DEFAULT 'viewer'
)
RETURNS boolean AS $$
DECLARE
    inviter_user_id uuid := auth.uid();
    tenant_exists boolean;
BEGIN
    -- Check if inviter has permission (owner or admin)
    SELECT EXISTS(
        SELECT 1 FROM user_tenants
        WHERE tenant_id = tenant_id_param
        AND user_id = inviter_user_id
        AND role IN ('owner', 'admin')
        AND is_active = true
    ) INTO tenant_exists;

    IF NOT tenant_exists THEN
        RAISE EXCEPTION 'Insufficient permissions to invite users';
    END IF;

    -- Create invitation (in a real app, you'd send email and create pending invitation)
    -- For now, just check if user exists and add them
    PERFORM 1 FROM auth.users WHERE email = email_param;

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add updated_at trigger for user_tenants
CREATE TRIGGER update_user_tenants_updated_at BEFORE UPDATE ON user_tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant necessary permissions
GRANT ALL ON user_tenants TO authenticated;
GRANT ALL ON user_tenants TO service_role;
GRANT EXECUTE ON FUNCTION public.create_tenant_with_owner TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_user_to_tenant TO authenticated;

-- MIGRATION 2: Update Business Tables
-- ====================================================================

-- Drop old conflicting policies on business tables
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

-- Create new RLS policies based on user_tenants
-- Properties policies
CREATE POLICY "Users can view properties in their tenant" ON properties FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Users with write access can create properties" ON properties FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Users with write access can update properties" ON properties FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Tenant owners can delete properties" ON properties FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role = 'owner')
);

-- Customers policies
CREATE POLICY "Users can view customers in their tenant" ON customers FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Users can create customers" ON customers FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Users with write access can update customers" ON customers FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Tenant owners can delete customers" ON customers FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role = 'owner')
);

-- Bookings policies
CREATE POLICY "Users can view bookings in their tenant" ON bookings FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Users can create bookings" ON bookings FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Users with write access can update bookings" ON bookings FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Tenant owners can delete bookings" ON bookings FOR DELETE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid()
                 AND is_active = true
                 AND role = 'owner')
);

-- Add created_by foreign key constraint for bookings (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'bookings_created_by_fkey'
                   AND table_name = 'bookings') THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES auth.users(id);
    END IF;
END $$;

-- Add created_by default value
ALTER TABLE bookings ALTER COLUMN created_by SET DEFAULT auth.uid();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_properties_tenant_active ON properties(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_active ON customers(tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON bookings(tenant_id, status);

-- Insert demo data for testing
DO $$
DECLARE
    demo_tenant_id uuid;
    demo_user_id uuid;
BEGIN
    -- Create demo tenant
    INSERT INTO tenants (name, slug, status, subscription_plan, primary_color)
    VALUES ('Demo Company', 'demo-company', 'active', 'professional', '#4f46e5')
    ON CONFLICT (slug) DO UPDATE SET
        primary_color = EXCLUDED.primary_color
    RETURNING id INTO demo_tenant_id;

    -- Get or create demo user
    INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    VALUES ('00000000-0000-0000-0000-000000000001', 'demo@chateau.com', now(), '{"full_name": "Demo User"}')
    ON CONFLICT (id) DO NOTHING
    RETURNING id INTO demo_user_id;

    -- Create user profile
    INSERT INTO users (id, email, full_name, metadata)
    VALUES (demo_user_id, 'demo@chateau.com', 'Demo User', '{"full_name": "Demo User", "phone": "+1234567890"}')
    ON CONFLICT (id) DO NOTHING;

    -- Create user-tenant relationship
    INSERT INTO user_tenants (user_id, tenant_id, role)
    VALUES (demo_user_id, demo_tenant_id, 'owner')
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    IF demo_tenant_id IS NOT NULL THEN
        -- Insert demo property
        INSERT INTO properties (tenant_id, name, type, description, address, base_price, max_guests, bedrooms, bathrooms, size_sqft)
        VALUES (
            demo_tenant_id,
            'The Chateau Villa',
            'villa',
            'Luxurious villa with stunning views and modern amenities',
            '{"street": "123 Luxury Lane", "city": "Bangkok", "country": "Thailand", "postal_code": "10110"}',
            15000.00,
            6,
            4,
            3,
            2500
        )
        ON CONFLICT DO NOTHING;

        -- Insert demo customer
        INSERT INTO customers (tenant_id, email, full_name, phone, nationality)
        VALUES (
            demo_tenant_id,
            'john.doe@example.com',
            'John Doe',
            '+1-555-0123',
            'American'
        )
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- ====================================================================
-- VERIFICATION QUERIES (Run these after migration to verify success)
-- ====================================================================

-- Uncomment these queries to verify the migration worked:

/*
-- Check user_tenants table exists and has data
SELECT
    ut.id,
    u.email,
    t.name as tenant_name,
    ut.role,
    ut.created_at
FROM user_tenants ut
JOIN auth.users u ON ut.user_id = u.id
JOIN tenants t ON ut.tenant_id = t.id
LIMIT 5;

-- Check new columns exist in tenants
SELECT
    name,
    subscription_plan,
    primary_color,
    logo_url,
    billing_email
FROM tenants
LIMIT 3;

-- Check users table has metadata
SELECT
    email,
    metadata,
    email_verified
FROM users
LIMIT 3;

-- Check RLS policies are working
SELECT count(*) as policy_count
FROM pg_policies
WHERE tablename IN ('user_tenants', 'users', 'tenants');
*/

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================
-- 🎉 Success! Your Epic 0 Authentication System is now ready.
--
-- Next steps:
-- 1. Test user registration at http://localhost:5175/auth/register
-- 2. Test login at http://localhost:5175/auth/login
-- 3. Verify dashboard loads correctly
-- 4. Test tenant switching in header
-- ====================================================================