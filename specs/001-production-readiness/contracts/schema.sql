-- CHATEAU Database Schema
-- Multi-tenant Real Estate Management Platform
-- Generated: 2025-01-19

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Create tenant management schema
CREATE SCHEMA IF NOT EXISTS auth;

-- Core tenant table
CREATE TABLE IF NOT EXISTS tenants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    domain TEXT UNIQUE,
    logo_url TEXT,
    theme_config JSONB DEFAULT '{}',
    subscription_plan TEXT NOT NULL DEFAULT 'standard' CHECK (subscription_plan IN ('standard', 'premium')),
    subscription_expires_at TIMESTAMPTZ,
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT, -- Will be encrypted at application level
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-tenant relationships
CREATE TABLE IF NOT EXISTS user_tenants (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'sales', 'viewer')),
    permissions JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, tenant_id)
);

-- Property categories
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

-- Real estate projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT,
    address TEXT NOT NULL,
    province TEXT NOT NULL,
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_units INTEGER DEFAULT 0,
    images JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'completed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual property units
CREATE TABLE IF NOT EXISTS properties (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id),
    unit_number TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    property_type TEXT NOT NULL,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqm DECIMAL(10, 2),
    price DECIMAL(15, 2),
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'sold', 'rented')),
    images JSONB DEFAULT '[]',
    floor_plan JSONB,
    specifications JSONB DEFAULT '{}',
    pricing_history JSONB DEFAULT '[]',
    lock_expires_at TIMESTAMPTZ,
    locked_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, project_id, unit_number)
);

-- Sales staff
CREATE TABLE IF NOT EXISTS sales_staff (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_id TEXT UNIQUE,
    department TEXT,
    commission_rate DECIMAL(5, 2) DEFAULT 0.00,
    target_monthly DECIMAL(15, 2),
    is_active BOOLEAN DEFAULT true,
    hire_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers/Leads
CREATE TABLE IF NOT EXISTS customers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    assigned_sales_id UUID REFERENCES sales_staff(id),
    source TEXT NOT NULL DEFAULT 'walk_in' CHECK (source IN ('walk_in', 'web_form', 'line', 'referral')),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT, -- Will be encrypted
    id_number TEXT, -- Will be encrypted
    address TEXT,
    purpose TEXT CHECK (purpose IN ('own_stay', 'investment', 'rental')),
    budget_min DECIMAL(15, 2),
    budget_max DECIMAL(15, 2),
    preferred_provinces TEXT[],
    notes TEXT,
    documents JSONB DEFAULT '[]',
    potential_score DECIMAL(3, 2) CHECK (potential_score >= 0 AND potential_score <= 100),
    financial_score DECIMAL(3, 2) CHECK (financial_score >= 0 AND financial_score <= 100),
    ai_analysis JSONB,
    status TEXT DEFAULT 'lead' CHECK (status IN ('lead', 'contacted', 'qualified', 'converted', 'lost')),
    last_contacted_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bookings/Reservations
CREATE TABLE IF NOT EXISTS bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    property_id UUID REFERENCES properties(id),
    customer_id UUID REFERENCES customers(id),
    sales_staff_id UUID REFERENCES sales_staff(id),
    booking_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('reservation', 'sale', 'rental')),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
    total_amount DECIMAL(15, 2),
    down_payment DECIMAL(15, 2),
    payment_schedule JSONB DEFAULT '[]',
    special_terms TEXT,
    documents JSONB DEFAULT '[]',
    notes TEXT,
    confirmed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Marketing campaigns
CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('email', 'sms', 'line', 'social')),
    target_segments JSONB DEFAULT '[]',
    content JSONB NOT NULL,
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'sending', 'sent', 'paused')),
    metrics JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit logs for compliance
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_domain ON tenants(domain);
CREATE INDEX IF NOT EXISTS idx_tenants_active ON tenants(is_active);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_user_tenants_user ON user_tenants(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_tenant ON user_tenants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_tenants_role ON user_tenants(role);

CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_categories_active ON categories(is_active);

CREATE INDEX IF NOT EXISTS idx_projects_tenant ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_projects_category ON projects(category_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);

CREATE INDEX IF NOT EXISTS idx_properties_tenant ON properties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_properties_project ON properties(project_id);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_price ON properties(price);
CREATE INDEX IF NOT EXISTS idx_properties_lock ON properties(lock_expires_at) WHERE lock_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_staff_tenant ON sales_staff(tenant_id);
CREATE INDEX IF NOT EXISTS idx_sales_staff_user ON sales_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_staff_active ON sales_staff(is_active);

CREATE INDEX IF NOT EXISTS idx_customers_tenant ON customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customers_sales ON customers(assigned_sales_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
CREATE INDEX IF NOT EXISTS idx_customers_potential ON customers(potential_score);
CREATE INDEX IF NOT EXISTS idx_customers_financial ON customers(financial_score);

CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bookings_property ON bookings(property_id);
CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_bookings_sales ON bookings(sales_staff_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON marketing_campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- GIN indexes for JSONB fields
CREATE INDEX IF NOT EXISTS idx_customers_documents ON customers USING GIN(documents);
CREATE INDEX IF NOT EXISTS idx_properties_images ON properties USING GIN(images);
CREATE INDEX IF NOT EXISTS idx_campaigns_content ON marketing_campaigns USING GIN(content);

-- Row Level Security (RLS)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Tenant Isolation

-- Tenants policy
CREATE POLICY "Users can view their tenant" ON tenants
    FOR SELECT USING (
        id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Owners can update tenant" ON tenants
    FOR UPDATE USING (
        id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'owner'
        )
    );

-- Users policy
CREATE POLICY "Users can view their own profile" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can update their own profile" ON users
    FOR UPDATE USING (id = auth.uid());

-- User_tenants policy
CREATE POLICY "Users can view their tenant relationships" ON user_tenants
    FOR SELECT USING (user_id = auth.uid());

-- Categories policies
CREATE POLICY "Tenant users can view categories" ON categories
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage categories" ON categories
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Projects policies
CREATE POLICY "Tenant users can view projects" ON projects
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage projects" ON projects
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Properties policies
CREATE POLICY "All tenant users can view properties" ON properties
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage properties" ON properties
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can lock properties" ON properties
    FOR UPDATE USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'sales'
        )
    ) WITH CHECK (
        (old.lock_expires_at IS NULL OR old.lock_expires_at < NOW()) AND
        new.lock_expires_at > NOW() AND
        new.locked_by = auth.uid() AND
        new.status = 'reserved'
    );

-- Sales staff policies
CREATE POLICY "Tenant users can view sales staff" ON sales_staff
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage sales staff" ON sales_staff
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can view their own profile" ON sales_staff
    FOR SELECT USING (
        user_id = auth.uid() AND
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role = 'sales'
        )
    );

-- Customers policies
CREATE POLICY "All tenant users can view customers" ON customers
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage all customers" ON customers
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can manage assigned customers" ON customers
    FOR ALL USING (
        assigned_sales_id IN (
            SELECT id FROM sales_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Bookings policies
CREATE POLICY "All tenant users can view bookings" ON bookings
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

CREATE POLICY "Admins can manage all bookings" ON bookings
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can manage their bookings" ON bookings
    FOR ALL USING (
        sales_staff_id IN (
            SELECT id FROM sales_staff
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Marketing campaigns policies
CREATE POLICY "Admins can manage campaigns" ON marketing_campaigns
    FOR ALL USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

CREATE POLICY "All users can view sent campaigns" ON marketing_campaigns
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND is_active = true
        ) AND status = 'sent'
    );

-- Audit logs policies
CREATE POLICY "Users can view audit logs for their tenant" ON audit_logs
    FOR SELECT USING (
        tenant_id IN (
            SELECT tenant_id FROM user_tenants
            WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
    );

-- Triggers for audit logging
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, table_name, record_id, new_values)
        VALUES (
            COALESCE(NEW.tenant_id,
                (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() LIMIT 1)
            ),
            auth.uid(),
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, table_name, record_id, old_values, new_values)
        VALUES (
            COALESCE(NEW.tenant_id, OLD.tenant_id,
                (SELECT tenant_id FROM user_tenants WHERE user_id = auth.uid() LIMIT 1)
            ),
            auth.uid(),
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            row_to_json(OLD),
            row_to_json(NEW)
        );
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (tenant_id, user_id, action, table_name, record_id, old_values)
        VALUES (
            OLD.tenant_id,
            auth.uid(),
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            row_to_json(OLD)
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to tables
CREATE TRIGGER audit_categories
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_projects
    AFTER INSERT OR UPDATE OR DELETE ON projects
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_properties
    AFTER INSERT OR UPDATE OR DELETE ON properties
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_customers
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_bookings
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Functions for business logic

-- Function to generate booking number
CREATE OR REPLACE FUNCTION generate_booking_number()
RETURNS TEXT AS $$
DECLARE
    tenant_slug TEXT;
    sequence_val INTEGER;
BEGIN
    SELECT slug INTO tenant_slug
    FROM tenants
    WHERE id = current_setting('app.current_tenant_id', true)::UUID;

    SELECT nextval(pg_get_serial_sequence('bookings', 'id')) INTO sequence_val;

    RETURN tenant_slug || '-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(sequence_val::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to check property availability
CREATE OR REPLACE FUNCTION check_property_availability(
    property_uuid UUID,
    exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    is_available BOOLEAN := true;
    active_bookings INTEGER;
BEGIN
    -- Check if property is locked
    IF EXISTS (
        SELECT 1 FROM properties
        WHERE id = property_uuid
        AND lock_expires_at > NOW()
    ) THEN
        RETURN false;
    END IF;

    -- Check for active bookings
    SELECT COUNT(*) INTO active_bookings
    FROM bookings
    WHERE property_id = property_uuid
    AND status IN ('pending', 'confirmed')
    AND (exclude_booking_id IS NULL OR id != exclude_booking_id);

    IF active_bookings > 0 THEN
        is_available := false;
    END IF;

    RETURN is_available;
END;
$$ LANGUAGE plpgsql;

-- Function to update property status based on bookings
CREATE OR REPLACE FUNCTION update_property_status()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE properties
        SET status = CASE
            WHEN NEW.status = 'confirmed' THEN 'sold'
            WHEN NEW.status = 'cancelled' THEN 'available'
            ELSE properties.status
        END
        WHERE id = NEW.property_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        UPDATE properties
        SET status = 'available'
        WHERE id = OLD.property_id;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Apply property status trigger
CREATE TRIGGER update_property_status_trigger
    AFTER INSERT OR UPDATE OR DELETE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_property_status();

-- Function to clean up expired locks
CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
    UPDATE properties
    SET lock_expires_at = NULL,
        locked_by = NULL,
        status = 'available'
    WHERE lock_expires_at < NOW()
    AND status = 'reserved';
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup job (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-locks', '*/5 * * * *', 'SELECT cleanup_expired_locks();');

-- View for dashboard statistics
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
    p.tenant_id,
    COUNT(DISTINCT p.id) as total_properties,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'available') as available_properties,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'reserved') as reserved_properties,
    COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'sold') as sold_properties,
    COALESCE(SUM(p.price) FILTER (WHERE p.status = 'sold'), 0) as total_sales_value,
    COALESCE(AVG(p.price) FILTER (WHERE p.status = 'sold'), 0) as avg_sale_price,
    COUNT(DISTINCT c.id) as total_customers,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'lead') as new_leads,
    COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'converted') as converted_customers,
    COUNT(DISTINCT b.id) FILTER (WHERE b.status IN ('pending', 'confirmed')) as active_bookings,
    COUNT(DISTINCT s.id) as active_sales_staff
FROM properties p
LEFT JOIN customers c ON c.tenant_id = p.tenant_id
LEFT JOIN bookings b ON b.tenant_id = p.tenant_id
LEFT JOIN sales_staff s ON s.tenant_id = p.tenant_id AND s.is_active = true
GROUP BY p.tenant_id;

-- Grant necessary permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;