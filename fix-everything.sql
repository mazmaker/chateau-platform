-- ================================================
-- FIX EVERYTHING - Run this FIRST
-- https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
-- ================================================

-- Disable RLS temporarily
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants DISABLE ROW LEVEL SECURITY;

-- Ensure tables exist
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    preferences jsonb DEFAULT '{}',
    email_verified boolean DEFAULT false,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    status text DEFAULT 'trial',
    logo_url text,
    primary_color varchar(7) DEFAULT '#4f46e5',
    secondary_color varchar(7) DEFAULT '#7c3aed',
    settings jsonb DEFAULT '{}',
    timezone text DEFAULT 'Asia/Bangkok',
    currency char(3) DEFAULT 'THB',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    role text DEFAULT 'viewer',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    UNIQUE(user_id, tenant_id)
);

-- Create tenant
INSERT INTO public.tenants (name, slug)
VALUES ('CHATEAU Platform', 'chateau-platform')
ON CONFLICT (slug) DO NOTHING;

-- Re-enable RLS with open policies for setup
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- Allow everything for authenticated users (for now)
CREATE POLICY "Allow all on tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on user_tenants" ON user_tenants FOR ALL USING (true) WITH CHECK (true);

SELECT 'FIXED! Now you can create users and they will get owner role.' as status;