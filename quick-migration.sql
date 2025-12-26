-- Quick Migration Script - Core Tables Only
-- Run this at: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Create enums
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');
CREATE TYPE IF NOT EXISTS tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- Core tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    status tenant_status DEFAULT 'trial',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT auth.uid(),
    email text UNIQUE NOT NULL,
    full_name text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- User-tenant relationships (CRITICAL for multi-tenancy)
CREATE TABLE IF NOT EXISTS user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    is_active boolean DEFAULT true,
    joined_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- Enable RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Basic RLS Policies
CREATE POLICY "Users can view their tenant" ON tenants FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view their memberships" ON user_tenants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Service role can manage all memberships" ON user_tenants FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
);

-- Function to create tenant with owner
CREATE OR REPLACE FUNCTION create_tenant_with_owner(
    tenant_name text,
    owner_email text,
    owner_full_name text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id uuid;
    new_user_id uuid;
BEGIN
    -- Create tenant
    INSERT INTO tenants (name, slug)
    VALUES (tenant_name, lower(replace(tenant_name, ' ', '_')))
    RETURNING id INTO new_tenant_id;

    -- Get or create user
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = owner_email;

    IF new_user_id IS NULL THEN
        RAISE EXCEPTION 'User % does not exist. Please register first.', owner_email;
    END IF;

    -- Add to users table if not exists
    INSERT INTO users (id, email, full_name)
    VALUES (new_user_id, owner_email, owner_full_name)
    ON CONFLICT (id) DO NOTHING;

    -- Create owner relationship
    INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
    VALUES (new_user_id, new_tenant_id, 'owner', true);

    RETURN format('Tenant %s created with owner %s', tenant_name, owner_email);
END;
$$;

-- Test function
SELECT create_tenant_with_owner('Chateau Test', 'mazmakerv2.sup@gmail.com', 'Test Owner');

-- Verify creation
SELECT
    t.name as tenant_name,
    u.email,
    ut.role
FROM tenants t
JOIN user_tenants ut ON t.id = ut.tenant_id
JOIN users u ON ut.user_id = u.id
WHERE u.email = 'mazmakerv2.sup@gmail.com';