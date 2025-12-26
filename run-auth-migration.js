import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const migrationSQL = `
-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- CREATE ENUMS
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('free', 'professional', 'enterprise');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CREATE TABLES
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    status tenant_status DEFAULT 'trial',
    subscription_plan subscription_plan DEFAULT 'free',
    trial_ends_at timestamptz,
    logo_url text,
    primary_color varchar(7) DEFAULT '#4f46e5',
    secondary_color varchar(7) DEFAULT '#7c3aed',
    custom_domain text,
    billing_email text,
    phone text,
    address jsonb,
    settings jsonb DEFAULT '{}',
    features jsonb DEFAULT '{}',
    timezone text DEFAULT 'Asia/Bangkok',
    currency char(3) DEFAULT 'THB',
    max_users integer DEFAULT 10,
    max_properties integer DEFAULT 5,
    users_count integer DEFAULT 0,
    properties_count integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    preferences jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    last_sign_in_at timestamptz,
    last_activity_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',
    is_active boolean DEFAULT true,
    permissions jsonb DEFAULT '[]',
    invited_by uuid,
    invited_at timestamptz,
    joined_at timestamptz DEFAULT now(),
    last_login_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
    UNIQUE(user_id, tenant_id)
);

-- CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_role ON user_tenants(role);
CREATE INDEX IF NOT EXISTS idx_user_tenants_active ON user_tenants(is_active);

-- ENABLE RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES
CREATE POLICY IF NOT EXISTS "Users can view their tenant" ON tenants
    FOR SELECT USING (
        id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
    );

CREATE POLICY IF NOT EXISTS "Users can view own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON users
    FOR UPDATE USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can view their memberships" ON user_tenants
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users can update their memberships" ON user_tenants
    FOR UPDATE USING (user_id = auth.uid() AND is_active = true);

-- FUNCTION: create_tenant_with_owner
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
    SELECT id INTO new_user_id FROM auth.users WHERE email = owner_email LIMIT 1;

    IF new_user_id IS NULL THEN
        result := jsonb_build_object('success', false, 'error', 'User not found. Please register first.');
        RETURN result;
    END IF;

    INSERT INTO tenants (name, slug)
    VALUES (tenant_name, lower(regexp_replace(tenant_name, '[^a-zA-Z0-9]+', '-', 'g')))
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO new_tenant_id;

    IF new_tenant_id IS NULL THEN
        INSERT INTO tenants (name, slug)
        VALUES (tenant_name, lower(regexp_replace(tenant_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(md5(random()::text), 1, 6))
        RETURNING id INTO new_tenant_id;
    END IF;

    INSERT INTO users (id, email, full_name)
    VALUES (new_user_id, owner_email, owner_full_name)
    ON CONFLICT (id) DO UPDATE SET full_name = COALESCE(owner_full_name, users.full_name), updated_at = now();

    INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at)
    VALUES (new_user_id, new_tenant_id, 'owner', true, now())
    ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'owner', is_active = true, updated_at = now();

    result := jsonb_build_object(
        'success', true,
        'tenant_id', new_tenant_id,
        'user_id', new_user_id,
        'tenant_name', tenant_name,
        'owner_email', owner_email,
        'owner_role', 'owner'
    );

    RETURN result;
END;
$$;

-- FUNCTION: handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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

-- FUNCTION: update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS update_tenants_updated_at ON tenants;
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_tenants_updated_at ON user_tenants;
CREATE TRIGGER update_user_tenants_updated_at BEFORE UPDATE ON user_tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`

async function runMigration() {
  console.log('🚀 Starting database migration...\n')

  // Split SQL into statements and execute them
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 50 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  // Since we can't execute DDL via the client, we'll provide instructions
  console.log('='.repeat(60))
  console.log('⚠️  Direct SQL execution requires admin access')
  console.log('='.repeat(60))
  console.log('\n📋 Please execute the following steps:\n')
  console.log('1. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql')
  console.log('2. Copy the SQL from: supabase/migrations/auth_setup.sql')
  console.log('3. Paste and click "RUN"\n')

  // Try to check if tables exist
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('id')
      .limit(1)

    if (!error && data) {
      console.log('✅ Tables already exist! Migration may have been run.\n')

      // Try to create a test user relationship
      console.log('📝 To create a tenant for user, run in SQL Editor:')
      console.log(`
SELECT create_tenant_with_owner(
    'Test Tenant',
    'your-email@example.com',
    'Test Owner'
);
      `)
    } else {
      console.log('❌ Tables not found. Please run the migration SQL manually.')
    }
  } catch (err) {
    console.log('❌ Error checking tables:', err.message)
  }

  console.log('\n' + '='.repeat(60))
  console.log('Migration SQL prepared in: run-auth-migration.js')
  console.log('='.repeat(60))
}

runMigration().catch(console.error)