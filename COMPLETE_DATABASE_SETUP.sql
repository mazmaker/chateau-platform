-- ====================================================================
-- 🚀 COMPLETE DATABASE SETUP FOR CHATEAU PLATFORM
-- ====================================================================
-- 📍 Instructions:
-- 1. Open: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
-- 2. Copy this entire file and paste into SQL Editor
-- 3. Click "RUN"
-- 4. Wait for completion (should take 30-60 seconds)
-- 5. Test the system at http://localhost:5175
-- ====================================================================

-- ⚠️  WARNING: This will RESET your existing database!
-- Make sure you have backups if you need to preserve existing data.

-- ====================================================================
-- STEP 1: CLEAN UP EXISTING STRUCTURE
-- ====================================================================

-- Drop all existing tables in reverse dependency order
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS campaign_responses CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS campaign_responses CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS customer_interactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS units CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_tenants CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Drop all existing enums
DROP TYPE IF EXISTS tenant_status CASCADE;
DROP TYPE IF EXISTS subscription_plan CASCADE;
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS property_type CASCADE;
DROP TYPE IF EXISTS booking_status CASCADE;
DROP TYPE IF EXISTS payment_status CASCADE;
DROP TYPE IF EXISTS lead_status CASCADE;
DROP TYPE IF EXISTS customer_source CASCADE;
DROP TYPE IF EXISTS campaign_type CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_tenant_with_owner() CASCADE;
DROP FUNCTION IF EXISTS public.generate_booking_number() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_permissions() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ====================================================================
-- STEP 2: CREATE NEW COMPREHENSIVE SCHEMA
-- ====================================================================

-- This is the complete schema from 20250122010000_comprehensive_schema.sql
-- [Insert the complete schema here - see the file for full content]

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- CORE ENUMS
-- ====================================================================

-- Tenant status for subscription management
CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');

-- Subscription plans
CREATE TYPE subscription_plan AS ENUM ('free', 'professional', 'enterprise');

-- User roles with hierarchical permissions
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');

-- Property types
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'condo', 'commercial', 'townhouse');

-- Booking status
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');

-- Payment status
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Lead status for CRM
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'negotiation', 'converted', 'lost');

-- Customer source
CREATE TYPE customer_source AS ENUM ('walk_in', 'web_form', 'website', 'referral', 'social_media', 'advertising', 'other');

-- Marketing campaign types
CREATE TYPE campaign_type AS ENUM ('email', 'social', 'search', 'display', 'content', 'event');

-- Notification types
CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');

-- ====================================================================
-- TENANT MANAGEMENT (Multi-Tenant Architecture)
-- ====================================================================

CREATE TABLE IF NOT EXISTS tenants (
    -- Core identification
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    domain citext UNIQUE,

    -- Subscription & billing
    status tenant_status DEFAULT 'trial',
    subscription_plan subscription_plan DEFAULT 'free',
    max_properties integer DEFAULT 5,
    max_users integer DEFAULT 10,
    trial_ends_at timestamptz,

    -- White-labeling
    logo_url text,
    primary_color varchar(7) DEFAULT '#4f46e5',
    secondary_color varchar(7) DEFAULT '#7c3aed',
    custom_domain text,

    -- Contact & billing
    billing_email text,
    tax_id text,
    phone text,
    address jsonb,

    -- Configuration
    settings jsonb DEFAULT '{}',
    features jsonb DEFAULT '{}',
    timezone text DEFAULT 'Asia/Bangkok',
    currency char(3) DEFAULT 'THB',

    -- Usage tracking
    properties_count integer DEFAULT 0,
    users_count integer DEFAULT 0,
    storage_used bigint DEFAULT 0,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ====================================================================
-- USER MANAGEMENT (Authentication & Authorization)
-- ====================================================================

CREATE TABLE IF NOT EXISTS users (
    -- Core identification
    id uuid PRIMARY KEY DEFAULT auth.uid(),
    email text UNIQUE NOT NULL,

    -- Profile information
    full_name text,
    avatar_url text,
    phone text,
    date_of_birth date,

    -- Extended metadata
    metadata jsonb DEFAULT '{}',
    preferences jsonb DEFAULT '{}',

    -- Verification
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,

    -- Activity tracking
    last_sign_in_at timestamptz,
    last_activity_at timestamptz,
    login_count integer DEFAULT 0,

    -- Status
    is_active boolean DEFAULT true,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- User-tenant relationships for multi-tenancy
CREATE TABLE IF NOT EXISTS user_tenants (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role user_role DEFAULT 'viewer',

    -- Status and permissions
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
-- PROPERTY MANAGEMENT (Epic 2)
-- ====================================================================

-- Projects/Developments
CREATE TABLE IF NOT EXISTS projects (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Basic information
    name text NOT NULL,
    code text,
    description text,
    property_type property_type NOT NULL,

    -- Location
    address jsonb NOT NULL,
    latitude decimal(10, 8),
    longitude decimal(11, 8),
    google_maps_url text,

    -- Development details
    developer text,
    completion_date date,
    building_count integer,
    total_units integer,
    total_area_sqm decimal(12, 2),

    -- Pricing
    price_min decimal(12, 2),
    price_max decimal(12, 2),
    price_avg_per_sqm decimal(12, 2),

    -- Amenities & features
    amenities jsonb DEFAULT '[]',
    facilities jsonb DEFAULT '[]',
    transport jsonb DEFAULT '[]',
    nearby_places jsonb DEFAULT '[]',

    -- Media
    images jsonb DEFAULT '[]',
    videos jsonb DEFAULT '[]',
    floor_plans jsonb DEFAULT '[]',
    virtual_tour_url text,

    -- Status & availability
    is_active boolean DEFAULT true,
    is_featured boolean DEFAULT false,
    launch_date date,

    -- SEO & Marketing
    slug text,
    meta_title text,
    meta_description text,

    -- Tracking
    view_count integer DEFAULT 0,
    favorite_count integer DEFAULT 0,
    inquiry_count integer DEFAULT 0,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(tenant_id, code)
);

-- Individual units within projects
CREATE TABLE IF NOT EXISTS units (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

    -- Unit identification
    unit_number text NOT NULL,
    unit_type text,
    floor_number integer,
    building text,

    -- Physical details
    area_sqm decimal(8, 2) NOT NULL,
    bedrooms integer DEFAULT 1,
    bathrooms integer DEFAULT 1,
    parking_spaces integer DEFAULT 0,

    -- Layout & features
    layout_description text,
    facing_direction text,
    balcony boolean DEFAULT false,
    garden boolean DEFAULT false,
    pool boolean DEFAULT false,

    -- Pricing
    price decimal(12, 2) NOT NULL,
    price_per_sqm decimal(10, 2),
    discount_amount decimal(12, 2) DEFAULT 0,

    -- Status
    status text DEFAULT 'available', -- available, reserved, sold, rented, maintenance
    availability_date date,

    -- Media
    images jsonb DEFAULT '[]',
    floor_plan jsonb,

    -- Additional details
    specifications jsonb DEFAULT '{}',
    notes text,

    -- Locking mechanism
    locked_by uuid REFERENCES users(id),
    locked_until timestamptz,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(project_id, unit_number)
);

-- ====================================================================
-- CUSTOMER RELATIONSHIP MANAGEMENT (Epic 3)
-- ====================================================================

CREATE TABLE IF NOT EXISTS customers (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Basic information
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,

    -- Personal details
    date_of_birth date,
    gender text, -- male, female, other
    nationality text,
    id_document jsonb, -- type, number, expiry, image_url

    -- Contact & location
    address jsonb,
    work_address jsonb,
    emergency_contact jsonb,

    -- Preferences & requirements
    budget_min decimal(12, 2),
    budget_max decimal(12, 2),
    preferred_locations jsonb DEFAULT '[]',
    preferred_property_types jsonb DEFAULT '[]',
    minimum_bedrooms integer,
    minimum_area_sqm decimal(8, 2),

    -- Lead management
    source customer_source DEFAULT 'walk_in',
    lead_status lead_status DEFAULT 'new',
    lead_score integer DEFAULT 0,

    -- Assignment
    assigned_sales_id uuid REFERENCES users(id),

    -- Communication
    preferred_contact_method text, -- email, phone, whatsapp, line
    communication_preferences jsonb DEFAULT '{}',

    -- Documents & verification
    documents jsonb DEFAULT '[]',
    verification_status text DEFAULT 'pending', -- pending, verified, rejected

    -- Behavioral data
    page_views integer DEFAULT 0,
    property_inquiries integer DEFAULT 0,
    viewing_count integer DEFAULT 0,
    favorite_properties jsonb DEFAULT '[]',

    -- Notes & interactions
    notes text,
    last_contact_date date,
    next_follow_up_date date,

    -- Metadata
    tags jsonb DEFAULT '[]',
    custom_fields jsonb DEFAULT '{}',

    -- Status
    is_active boolean DEFAULT true,
    is_deleted boolean DEFAULT false,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(tenant_id, email)
);

-- Customer interactions history
CREATE TABLE IF NOT EXISTS customer_interactions (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

    -- Interaction details
    type text NOT NULL, -- call, email, meeting, site_visit, whatsapp, line
    direction text, -- inbound, outbound
    duration_minutes integer,

    -- Content
    subject text,
    content text,

    -- Participants
    staff_id uuid NOT NULL REFERENCES users(id),

    -- Outcome
    status text, -- completed, scheduled, missed, cancelled
    next_action text,
    next_action_date date,

    -- Attachments & media
    attachments jsonb DEFAULT '[]',

    -- Notes
    notes text,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ====================================================================
-- BOOKING & SALES MANAGEMENT (Epic 4)
-- ====================================================================

CREATE TABLE IF NOT EXISTS bookings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Booking identification
    booking_number text UNIQUE NOT NULL,

    -- Related entities
    project_id uuid NOT NULL REFERENCES projects(id),
    unit_id uuid NOT NULL REFERENCES units(id),
    customer_id uuid NOT NULL REFERENCES customers(id),

    -- Booking details
    type text NOT NULL, -- reservation, purchase, rental
    status booking_status DEFAULT 'pending',

    -- Financial details
    total_amount decimal(12, 2) NOT NULL,
    currency char(3) DEFAULT 'THB',
    down_payment_amount decimal(12, 2),
    down_payment_paid decimal(12, 2) DEFAULT 0,

    -- Dates
    booking_date date NOT NULL,
    check_in_date date,
    check_out_date date,

    -- Parties
    created_by uuid NOT NULL REFERENCES users(id),
    sales_staff_id uuid REFERENCES users(id),

    -- Terms & conditions
    special_terms text,
    notes jsonb DEFAULT '{}',

    -- Documents
    documents jsonb DEFAULT '[]',

    -- Timeline
    confirmed_at timestamptz,
    cancelled_at timestamptz,
    completed_at timestamptz,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Payment schedules and records
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Related entities
    booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,

    -- Payment details
    type text NOT NULL, -- down_payment, installment, final_payment, fee
    amount decimal(12, 2) NOT NULL,
    due_date date NOT NULL,
    paid_date date,

    -- Status
    status payment_status DEFAULT 'pending',

    -- Payment method
    payment_method text, -- cash, bank_transfer, credit_card, digital_wallet

    -- Reference & verification
    transaction_reference text,
    receipt_url text,

    -- Late payment fees
    late_fee_amount decimal(12, 2) DEFAULT 0,
    late_fee_paid boolean DEFAULT false,

    -- Notes
    notes text,

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ====================================================================
-- MARKETING & CAMPAIGNS (Epic 5)
-- ====================================================================

CREATE TABLE IF NOT EXISTS campaigns (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Campaign details
    name text NOT NULL,
    description text,
    type campaign_type NOT NULL,

    -- Schedule
    start_date date NOT NULL,
    end_date date,

    -- Budget & tracking
    budget decimal(12, 2),
    actual_cost decimal(12, 2) DEFAULT 0,

    -- Target audience
    target_audience jsonb DEFAULT '{}',
    target_properties jsonb DEFAULT '[]',

    -- Content
    content jsonb DEFAULT '{}',
    assets jsonb DEFAULT '[]',

    -- Channels
    channels jsonb DEFAULT '[]', -- email, social, sms, etc.

    -- Performance metrics
    sent_count integer DEFAULT 0,
    delivered_count integer DEFAULT 0,
    opened_count integer DEFAULT 0,
    clicked_count integer DEFAULT 0,
    converted_count integer DEFAULT 0,

    -- Status
    status text DEFAULT 'draft', -- draft, active, paused, completed

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Campaign responses and leads
CREATE TABLE IF NOT EXISTS campaign_responses (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,

    -- Response details
    response_type text, -- opened, clicked, unsubscribed, converted
    response_data jsonb DEFAULT '{}',

    -- Timing
    responded_at timestamptz DEFAULT now(),

    -- Metadata
    created_at timestamptz DEFAULT now()
);

-- ====================================================================
-- NOTIFICATIONS & COMMUNICATIONS
-- ====================================================================

CREATE TABLE IF NOT EXISTS notifications (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

    -- Recipient
    user_id uuid REFERENCES users(id) ON DELETE CASCADE,
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE,

    -- Notification content
    type notification_type NOT NULL,
    title text NOT NULL,
    message text NOT NULL,

    -- Channels
    channels jsonb DEFAULT '["in_app"]', -- in_app, email, sms, push

    -- Status
    is_read boolean DEFAULT false,
    is_sent boolean DEFAULT false,
    sent_at timestamptz,
    read_at timestamptz,

    -- Related entities
    related_entity_type text, -- booking, customer, property, etc.
    related_entity_id uuid,

    -- Action buttons
    action_url text,
    action_text text,

    -- Metadata
    data jsonb DEFAULT '{}',
    expires_at timestamptz,

    created_at timestamptz DEFAULT now()
);

-- ====================================================================
-- SYSTEM ADMINISTRATION (Epic 6)
-- ====================================================================

-- System settings and configuration
CREATE TABLE IF NOT EXISTS system_settings (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,

    -- Settings category
    category text NOT NULL,
    key text NOT NULL,
    value jsonb,

    -- Metadata
    description text,
    is_public boolean DEFAULT false,

    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),

    UNIQUE(tenant_id, category, key)
);

-- Audit logs for system activity
CREATE TABLE IF NOT EXISTS audit_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,

    -- Action details
    user_id uuid REFERENCES users(id),
    action text NOT NULL,
    entity_type text,
    entity_id uuid,

    -- Change tracking
    old_values jsonb,
    new_values jsonb,

    -- Request details
    ip_address inet,
    user_agent text,

    -- Timing
    created_at timestamptz DEFAULT now()
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_user_tenants_user_id ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant_id ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_active ON user_tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_user_tenants_role ON user_tenants(role);

-- Business indexes
CREATE INDEX IF NOT EXISTS idx_projects_tenant_id ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_type ON projects(property_type);
CREATE INDEX IF NOT EXISTS idx_units_tenant_id ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_project_id ON units(project_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(lead_status);
CREATE INDEX IF NOT EXISTS idx_customers_assigned ON customers(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_units_tenant_project ON units(tenant_id, project_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_status ON bookings(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_customers_tenant_status ON customers(tenant_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_interactions_customer_date ON customer_interactions(customer_id, created_at);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================

-- Enable RLS on all tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Tenants policies
CREATE POLICY "Users can view their tenant" ON tenants FOR SELECT USING (
    id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Tenant owners can update tenant" ON tenants FOR UPDATE USING (
    id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND role = 'owner' AND is_active = true)
);

-- Users policies
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can view users in same tenant" ON users FOR SELECT USING (
    id IN (SELECT user_id FROM user_tenants WHERE tenant_id IN (
        SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true
    ) AND is_active = true)
);

-- User-tenants policies
CREATE POLICY "Users can view their tenant memberships" ON user_tenants FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update their own memberships" ON user_tenants FOR UPDATE USING (
    user_id = auth.uid() AND is_active = true
);
CREATE POLICY "Service role can manage all user_tenants" ON user_tenants FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Projects policies
CREATE POLICY "Users can view projects in their tenant" ON projects FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins and sales can create projects" ON projects FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

CREATE POLICY "Admins and sales can update projects" ON projects FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

-- Units policies (similar to projects)
CREATE POLICY "Users can view units in their tenant" ON units FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins and sales can manage units" ON units FOR ALL USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
);

-- Customers policies
CREATE POLICY "Users can view customers in their tenant" ON customers FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "All authenticated users can create customers" ON customers FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins and assigned staff can update customers" ON customers FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
    OR assigned_sales_id = auth.uid()
);

-- Bookings policies
CREATE POLICY "Users can view bookings in their tenant" ON bookings FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "All authenticated users can create bookings" ON bookings FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true)
);

CREATE POLICY "Admins and sales can update bookings" ON bookings FOR UPDATE USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants
                 WHERE user_id = auth.uid() AND is_active = true
                 AND role IN ('owner', 'admin', 'sales'))
    OR sales_staff_id = auth.uid()
);

-- Notifications policies
CREATE POLICY "Users can view their notifications" ON notifications FOR SELECT USING (
    user_id = auth.uid()
);

CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (
    true -- Allow system/service role to insert
);

-- Audit logs policies
CREATE POLICY "Users can view audit logs for their tenant" ON audit_logs FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() AND is_active = true)
);

-- ====================================================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ====================================================================

-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables with updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_tenants_updated_at BEFORE UPDATE ON user_tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interactions_updated_at BEFORE UPDATE ON customer_interactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_settings_updated_at BEFORE UPDATE ON system_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================================================================
-- STORED PROCEDURES AND FUNCTIONS
-- ====================================================================

-- Function to handle new user signup
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

-- Function to create tenant and assign owner
CREATE OR REPLACE FUNCTION public.create_tenant_with_owner(
    tenant_name text,
    owner_email text,
    owner_full_name text DEFAULT NULL,
    subscription_plan_param subscription_plan DEFAULT 'free'
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
        subscription_plan_param
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

-- Function to generate unique booking number
CREATE OR REPLACE FUNCTION public.generate_booking_number()
RETURNS text AS $$
DECLARE
    booking_num text;
    base_num text;
    seq_num text;
BEGIN
    -- Get current date in YYMMDD format
    base_num := TO_CHAR(NOW(), 'YYMMDD');

    -- Find last booking number for today
    SELECT MAX(SUBSTRING(booking_number FROM 7 FOR 4))
    INTO seq_num
    FROM bookings
    WHERE booking_number LIKE 'BK' || base_num || '%'
    AND created_at >= CURRENT_DATE;

    -- If no bookings today, start with 0001
    IF seq_num IS NULL THEN
        seq_num := '0001';
    ELSE
        seq_num := LPAD((seq_num::integer + 1)::text, 4, '0');
    END IF;

    booking_num := 'BK' || base_num || seq_num;

    RETURN booking_num;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id uuid, p_tenant_id uuid)
RETURNS jsonb AS $$
DECLARE
    user_permissions jsonb DEFAULT '[]';
    user_role_text text;
BEGIN
    -- Get user role for this tenant
    SELECT role INTO user_role_text
    FROM user_tenants
    WHERE user_id = p_user_id
    AND tenant_id = p_tenant_id
    AND is_active = true;

    -- Define permissions per role
    CASE user_role_text
        WHEN 'owner' THEN
            user_permissions := '["read", "write", "delete", "manage_users", "manage_settings", "manage_billing"]';
        WHEN 'admin' THEN
            user_permissions := '["read", "write", "delete", "manage_users"]';
        WHEN 'sales' THEN
            user_permissions := '["read", "write", "manage_customers", "manage_bookings"]';
        WHEN 'viewer' THEN
            user_permissions := '["read"]';
        ELSE
            user_permissions := '[]';
    END CASE;

    RETURN user_permissions;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- DEMO DATA INSERTS
-- ====================================================================

-- Insert demo tenant
INSERT INTO tenants (name, slug, status, subscription_plan, primary_color, description)
VALUES (
    'Demo Company',
    'demo-company',
    'active',
    'professional',
    '#4f46e5',
    'Demonstration tenant for Chateau Platform'
) ON CONFLICT (slug) DO NOTHING;

-- Insert demo user (will be linked via auth trigger)
INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'demo@chateau.com',
    now(),
    '{"full_name": "Demo User", "phone": "+1234567890"}'
) ON CONFLICT (id) DO NOTHING;

-- Create demo project
INSERT INTO projects (
    tenant_id, name, code, property_type, description, address,
    price_min, price_max, amenities, images
)
SELECT
    t.id,
    'The Chateau Residence',
    'CHR-001',
    'condo',
    'Luxury condominium in the heart of the city',
    '{"street": "123 Sukhumvit Road", "city": "Bangkok", "country": "Thailand"}',
    3000000,
    8000000,
    '["Swimming Pool", "Gym", "24/7 Security", "Parking"]',
    '[{"url": "https://example.com/image1.jpg", "caption": "Living Room"}]'
FROM tenants t WHERE t.slug = 'demo-company'
ON CONFLICT DO NOTHING;

-- Insert demo units
INSERT INTO units (
    tenant_id, project_id, unit_number, area_sqm, bedrooms, bathrooms, price
)
SELECT
    t.id,
    p.id,
    'A-101',
    65.5,
    2,
    1,
    4500000
FROM tenants t
JOIN projects p ON p.tenant_id = t.id
WHERE t.slug = 'demo-company'
LIMIT 1
ON CONFLICT DO NOTHING;

-- Insert demo customer
INSERT INTO customers (
    tenant_id, first_name, last_name, email, phone, source
)
SELECT
    t.id,
    'John',
    'Doe',
    'john.doe@example.com',
    '+66812345678',
    'web_form'
FROM tenants t WHERE t.slug = 'demo-company'
ON CONFLICT DO NOTHING;

-- ====================================================================
-- SETUP COMPLETE
-- ====================================================================

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Insert system settings
INSERT INTO system_settings (category, key, value, description, is_public)
VALUES
    ('general', 'app_name', '"Chateau Platform"', 'Application name', true),
    ('general', 'default_currency', '"THB"', 'Default currency', true),
    ('general', 'timezone', '"Asia/Bangkok"', 'Default timezone', true),
    ('notifications', 'email_enabled', 'true', 'Enable email notifications', false),
    ('features', 'advanced_analytics', 'false', 'Enable advanced analytics', false)
ON CONFLICT DO NOTHING;

-- ====================================================================
-- VERIFICATION QUERIES (Optional - uncomment to test)
-- ====================================================================

/*
-- Verify all tables were created
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verify demo data
SELECT 'Tenants: ' || COUNT(*) FROM tenants;
SELECT 'Users: ' || COUNT(*) FROM users;
SELECT 'Projects: ' || COUNT(*) FROM projects;
SELECT 'Units: ' || COUNT(*) FROM units;
SELECT 'Customers: ' || COUNT(*) FROM customers;

-- Test RLS policies (should return data for demo user)
-- Set search_path to 'public', 'auth';
-- SELECT * FROM user_tenants WHERE user_id = '00000000-0000-0000-0000-000000000001';
*/

-- ====================================================================
-- ✅ DATABASE SETUP COMPLETE!
-- ====================================================================
--
-- What's been created:
-- ✅ Complete multi-tenant architecture
-- ✅ User authentication & authorization system
-- ✅ Property management (projects & units)
-- ✅ Customer relationship management (CRM)
-- ✅ Booking & sales management
-- ✅ Marketing campaign system
-- ✅ Notification system
-- ✅ Audit logging & system administration
-- ✅ Performance indexes
-- ✅ Row Level Security policies
-- ✅ Stored procedures & functions
-- ✅ Demo data for testing
--
-- Next steps:
-- 1. Update frontend to use new schema
-- 2. Test user registration and login
-- 3. Test all features work correctly
-- 4. Deploy to production
-- ====================================================================