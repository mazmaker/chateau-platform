-- ====================================================================
-- CHATEAU Platform - Authentication & User Management Schema
-- ====================================================================
-- Run this at: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
-- ====================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ====================================================================
-- CREATE ENUMS
-- ====================================================================

-- User roles for multi-tenant access control
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');

-- Tenant status
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- Subscription plans
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');

-- ====================================================================
-- CREATE TABLES
-- ====================================================================

-- 1. TENANTS TABLE - Multi-tenant organization management
CREATE TABLE IF NOT EXISTS tenants (
    -- Primary identification
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,

    -- Subscription
    status tenant_status DEFAULT 'trial',
    subscription_plan subscription_plan DEFAULT 'free',
    trial_ends_at timestamptz,

    -- Configuration
    logo_url text,
    primary_color varchar(7) DEFAULT '#4f46e5',
    secondary_color varchar(7) DEFAULT '#7c3aed',
    custom_domain text,

    -- Contact info
    billing_email text,
    phone text,
    address jsonb,

    -- Settings
    settings jsonb DEFAULT '{}',
    features jsonb DEFAULT '{}',
    timezone text DEFAULT 'Asia/Bangkok',
    currency char(3) DEFAULT 'THB',

    -- Usage tracking
    max_users integer DEFAULT 10,
    max_properties integer DEFAULT 5,
    users_count integer DEFAULT 0,
    properties_count integer DEFAULT 0,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. USERS TABLE - Extended user profiles (linked to auth.users)
CREATE TABLE IF NOT EXISTS users (
    -- Primary identification (links to auth.users)
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,

    -- Profile information
    full_name text,
    avatar_url text,
    phone text,

    -- Preferences
    preferences jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',

    -- Verification
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,

    -- Activity tracking
    last_sign_in_at timestamptz,
    last_activity_at timestamptz,

    -- Status
    is_active boolean DEFAULT true,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 3. USER_TENANTS TABLE - Multi-tenant relationship with roles
CREATE TABLE IF NOT EXISTS user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',

    -- Status
    is_active boolean DEFAULT true,
    permissions jsonb DEFAULT '[]',

    -- Invitation tracking
    invited_by uuid REFERENCES auth.users(id),
    invited_at timestamptz,
    joined_at timestamptz DEFAULT now(),

    -- Activity tracking
    last_login_at timestamptz,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(user_id, tenant_id)
);

-- ====================================================================
-- CREATE INDEXES
-- ====================================================================

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- User-tenants indexes (CRITICAL for performance)
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_role ON user_tenants(role);
CREATE INDEX IF NOT EXISTS idx_user_tenants_active ON user_tenants(is_active);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS)
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES FOR TENANTS
CREATE POLICY "Users can view their tenant"
    ON tenants FOR SELECT
    USING (
        id IN (
            SELECT tenant_id
            FROM user_tenants
            WHERE user_id = auth.uid()
            AND is_active = true
        )
    );

CREATE POLICY "Service role can do anything on tenants"
    ON tenants FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS POLICIES FOR USERS
CREATE POLICY "Users can view own profile"
    ON users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Service role can do anything on users"
    ON users FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS POLICIES FOR USER_TENANTS
CREATE POLICY "Users can view their own tenant memberships"
    ON user_tenants FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can update their own memberships"
    ON user_tenants FOR UPDATE
    USING (user_id = auth.uid() AND is_active = true);

CREATE POLICY "Service role can do anything on user_tenants"
    ON user_tenants FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ====================================================================
-- FUNCTIONS
-- ====================================================================

-- Function to create tenant with owner
CREATE OR REPLACE FUNCTION create_tenant_with_owner(
    tenant_name text,
    owner_email text,
    owner_full_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_tenant_id uuid;
    new_user_id uuid;
    result jsonb;
BEGIN
    -- Check if user exists
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = owner_email
    LIMIT 1;

    IF new_user_id IS NULL THEN
        result := jsonb_build_object(
            'success', false,
            'error', 'User not found. Please register first.'
        );
        RETURN result;
    END IF;

    -- Create tenant
    INSERT INTO tenants (name, slug)
    VALUES (
        tenant_name,
        lower(regexp_replace(tenant_name, '[^a-zA-Z0-9]+', '-', 'g'))
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO new_tenant_id;

    -- If slug conflict, add random suffix
    IF new_tenant_id IS NULL THEN
        INSERT INTO tenants (name, slug)
        VALUES (
            tenant_name,
            lower(regexp_replace(tenant_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6)
        )
        RETURNING id INTO new_tenant_id;
    END IF;

    -- Add user to users table if not exists
    INSERT INTO users (id, email, full_name)
    VALUES (new_user_id, owner_email, owner_full_name)
    ON CONFLICT (id) DO UPDATE SET
        full_name = COALESCE(owner_full_name, users.full_name),
        updated_at = now();

    -- Create owner relationship
    INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at)
    VALUES (new_user_id, new_tenant_id, 'owner', true, now())
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET
        role = 'owner',
        is_active = true,
        updated_at = now();

    -- Build result
    SELECT * INTO result
    FROM (
        SELECT
            jsonb_build_object(
                'success', true,
                'tenant_id', new_tenant_id,
                'user_id', new_user_id,
                'tenant_name', tenant_name,
                'owner_email', owner_email,
                'owner_role', 'owner'
            ) as data
    ) sub;

    RETURN result;
END;
$$;

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create user profile
    INSERT INTO users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name')
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$;

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- ====================================================================
-- TRIGGERS
-- ====================================================================

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_tenants_updated_at BEFORE UPDATE ON user_tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- INITIALIZE WITH TEST DATA (OPTIONAL)
-- ====================================================================

-- This will be run manually after first user registers
-- Uncomment and modify with actual email to create test tenant:

/*
SELECT create_tenant_with_owner(
    'Test Tenant',
    'your-email@example.com',
    'Test Owner'
);
*/

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================

-- Check if tables exist:
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('tenants', 'users', 'user_tenants')
ORDER BY table_name;

-- Check user role:
SELECT
    u.email,
    ut.role,
    t.name as tenant_name,
    ut.is_active
FROM users u
JOIN user_tenants ut ON u.id = ut.user_id
JOIN tenants t ON ut.tenant_id = t.id
WHERE u.email = 'your-email@example.com';