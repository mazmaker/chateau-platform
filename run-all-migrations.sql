-- =====================================================
-- CHATEAU Platform - Complete Database Migration
-- สำหรับ Production Environment
-- รันใน Supabase SQL Editor
-- =====================================================

-- เปิดใช้ Extensions ที่จำเป็น
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ==============================
-- STEP 1: Initial Schema Setup
-- ==============================

-- Create custom types
DO $$ BEGIN
    DROP TYPE IF EXISTS tenant_status CASCADE;
    DROP TYPE IF EXISTS subscription_plan CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
    DROP TYPE IF EXISTS booking_status CASCADE;
    DROP TYPE IF EXISTS property_type CASCADE;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'condo', 'commercial');

-- Tenants table
CREATE TABLE IF NOT EXISTS tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    domain citext UNIQUE,
    status tenant_status DEFAULT 'trial',
    subscription_plan subscription_plan DEFAULT 'starter',
    max_properties integer DEFAULT 10,
    settings jsonb DEFAULT '{}',
    email text,
    billing_email text,
    suspended_at timestamptz,
    suspension_reason text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role NOT NULL DEFAULT 'sales',
    first_name text,
    last_name text,
    email text,
    phone text,
    avatar_url text,
    is_active boolean DEFAULT true,
    last_login timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(user_id)
);

-- Properties table
CREATE TABLE IF NOT EXISTS properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by uuid REFERENCES profiles(id),
    updated_by uuid REFERENCES profiles(id),
    name text NOT NULL,
    slug text,
    description text,
    property_type property_type NOT NULL,
    address text,
    city text,
    province text,
    postal_code text,
    country text DEFAULT 'Thailand',
    latitude decimal(10,8),
    longitude decimal(11,8),
    price_per_night decimal(10,2),
    max_guests integer DEFAULT 1,
    bedrooms integer DEFAULT 1,
    bathrooms integer DEFAULT 1,
    amenities jsonb DEFAULT '[]',
    images jsonb DEFAULT '[]',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Bookings table
CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    guest_name text NOT NULL,
    guest_email text NOT NULL,
    guest_phone text,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    guests integer DEFAULT 1,
    total_price decimal(10,2) NOT NULL,
    status booking_status DEFAULT 'pending',
    notes text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==============================
-- STEP 2: Billing System Tables
-- ==============================

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number text NOT NULL UNIQUE,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    subscription_plan text NOT NULL DEFAULT 'starter' CHECK (subscription_plan IN ('free', 'starter', 'professional', 'enterprise')),
    due_date timestamptz NOT NULL,
    paid_at timestamptz,
    description text,
    line_items jsonb DEFAULT '[]'::jsonb,
    tax_amount decimal(10,2) DEFAULT 0,
    discount_amount decimal(10,2) DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number text,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    payment_method text NOT NULL DEFAULT 'bank_transfer' CHECK (payment_method IN ('credit_card', 'bank_transfer', 'paypal', 'cash', 'other')),
    payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded', 'cancelled')),
    transaction_id text,
    reference_code text,
    payment_gateway text,
    gateway_response jsonb,
    notes text,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ==============================
-- STEP 3: Activity & Error Logs
-- ==============================

-- Activity logs table
CREATE TABLE IF NOT EXISTS activity_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    action text NOT NULL,
    resource_type text NOT NULL,
    resource_id uuid,
    details jsonb DEFAULT '{}',
    ip_address inet,
    user_agent text,
    created_at timestamptz DEFAULT now()
);

-- Error logs table
CREATE TABLE IF NOT EXISTS error_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
    user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
    error_type text NOT NULL,
    error_message text NOT NULL,
    error_stack text,
    request_url text,
    request_method text,
    request_body jsonb,
    user_agent text,
    ip_address inet,
    severity text DEFAULT 'error' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    resolved boolean DEFAULT false,
    resolved_at timestamptz,
    resolved_by uuid REFERENCES profiles(id),
    created_at timestamptz DEFAULT now()
);

-- ==============================
-- STEP 4: Marketing & CRM Tables
-- ==============================

-- Leads table
CREATE TABLE IF NOT EXISTS leads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by uuid REFERENCES profiles(id),
    first_name text NOT NULL,
    last_name text,
    email text NOT NULL,
    phone text,
    company text,
    source text,
    status text DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
    score integer DEFAULT 0 CHECK (score >= 0 AND score <= 100),
    notes text,
    tags jsonb DEFAULT '[]',
    custom_fields jsonb DEFAULT '{}',
    last_contact_date timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    created_by uuid REFERENCES profiles(id),
    name text NOT NULL,
    description text,
    type text NOT NULL CHECK (type IN ('email', 'sms', 'social', 'display', 'search', 'other')),
    status text DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'cancelled')),
    start_date timestamptz,
    end_date timestamptz,
    budget decimal(10,2),
    target_audience jsonb DEFAULT '{}',
    metrics jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==============================
-- STEP 5: Extended Features
-- ==============================

-- Units/Rooms table
CREATE TABLE IF NOT EXISTS units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    name text NOT NULL,
    unit_number text,
    floor integer,
    size_sqm decimal(8,2),
    bedrooms integer DEFAULT 1,
    bathrooms decimal(3,1) DEFAULT 1,
    price_per_night decimal(10,2),
    amenities jsonb DEFAULT '[]',
    images jsonb DEFAULT '[]',
    is_available boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Company settings table
CREATE TABLE IF NOT EXISTS company_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE UNIQUE,
    company_name text,
    company_address text,
    company_phone text,
    company_email text,
    company_website text,
    logo_url text,
    primary_color text DEFAULT '#6366f1',
    secondary_color text DEFAULT '#8b5cf6',
    timezone text DEFAULT 'Asia/Bangkok',
    currency text DEFAULT 'THB',
    date_format text DEFAULT 'DD/MM/YYYY',
    language text DEFAULT 'th',
    billing_automation jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ==============================
-- STEP 6: Create Indexes
-- ==============================

-- Tenants indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);

-- Profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Properties indexes
CREATE INDEX IF NOT EXISTS idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_active ON properties(is_active);

-- Invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_id ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- Payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);

-- Activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON activity_logs(resource_type, resource_id);

-- ==============================
-- STEP 7: Enable RLS
-- ==============================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- ==============================
-- STEP 8: Create RLS Policies
-- ==============================

-- Owner policies (can access everything)
CREATE POLICY "Owners can manage all tenants" ON tenants FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all profiles" ON profiles FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all properties" ON properties FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all bookings" ON bookings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all invoices" ON invoices FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all payments" ON payments FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can view all activity logs" ON activity_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can view all error logs" ON error_logs FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all leads" ON leads FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all campaigns" ON campaigns FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all units" ON units FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

CREATE POLICY "Owners can manage all company settings" ON company_settings FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'owner')
);

-- Tenant-specific policies for admins and sales
CREATE POLICY "Users can access their tenant data" ON properties FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can access their tenant bookings" ON bookings FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their tenant invoices" ON invoices FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

-- ==============================
-- STEP 9: Create Functions
-- ==============================

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to log activities
CREATE OR REPLACE FUNCTION log_activity(
    p_action text,
    p_resource_type text,
    p_resource_id uuid DEFAULT NULL,
    p_details jsonb DEFAULT '{}'
)
RETURNS void AS $$
DECLARE
    current_profile profiles%ROWTYPE;
BEGIN
    SELECT * INTO current_profile
    FROM profiles
    WHERE user_id = auth.uid()
    LIMIT 1;

    IF current_profile.id IS NOT NULL THEN
        INSERT INTO activity_logs (
            tenant_id,
            user_id,
            action,
            resource_type,
            resource_id,
            details
        ) VALUES (
            current_profile.tenant_id,
            current_profile.id,
            p_action,
            p_resource_type,
            p_resource_id,
            p_details
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS text AS $$
DECLARE
    year_suffix text;
    sequence_num int;
    invoice_num text;
BEGIN
    year_suffix := TO_CHAR(NOW(), 'YYYY');

    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 'INV-' || year_suffix || '-(.*)') AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_suffix || '-%';

    invoice_num := 'INV-' || year_suffix || '-' || LPAD(sequence_num::text, 4, '0');

    RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- ==============================
-- STEP 10: Create Triggers
-- ==============================

-- Updated at triggers
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================
-- STEP 11: Insert Sample Data
-- ==============================

-- Insert sample tenant (if not exists)
INSERT INTO tenants (id, name, slug, status, subscription_plan)
VALUES (
    gen_random_uuid(),
    'CHATEAU Demo Company',
    'chateau-demo',
    'active',
    'professional'
) ON CONFLICT (slug) DO NOTHING;

-- Insert sample invoices for existing tenants
INSERT INTO invoices (tenant_id, invoice_number, amount, subscription_plan, due_date, status, description)
SELECT
    t.id,
    'INV-2026-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
    CASE
        WHEN t.subscription_plan = 'starter' THEN 2900.00
        WHEN t.subscription_plan = 'professional' THEN 5900.00
        WHEN t.subscription_plan = 'enterprise' THEN 15900.00
        ELSE 990.00
    END,
    t.subscription_plan::text,
    NOW() + INTERVAL '30 days',
    'pending',
    'Monthly subscription - ' || UPPER(t.subscription_plan::text) || ' Plan'
FROM tenants t
WHERE NOT EXISTS (SELECT 1 FROM invoices i WHERE i.tenant_id = t.id)
LIMIT 10;

-- =====================================================
-- Migration Complete!
-- =====================================================

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '🎉 CHATEAU Platform Database Migration Completed Successfully!';
    RAISE NOTICE '📊 Tables created: tenants, profiles, properties, bookings, invoices, payments, activity_logs, error_logs, leads, campaigns, units, company_settings';
    RAISE NOTICE '🔐 RLS enabled and policies created for all tables';
    RAISE NOTICE '⚡ Indexes created for optimal performance';
    RAISE NOTICE '🔧 Functions and triggers set up';
    RAISE NOTICE '📝 Sample data inserted';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Your Auto Billing system should now work properly!';
END $$;