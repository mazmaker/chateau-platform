-- Initial Schema for CHATEAU Platform
-- Multi-tenant Property Management System

-- Enable necessary extensions (force ensure they are installed)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'citext') THEN
        CREATE EXTENSION "citext";
    END IF;
END $$;

-- Create custom types (safe creation with drop if exists)
DO $$ BEGIN
    DROP TYPE IF EXISTS tenant_status CASCADE;
    DROP TYPE IF EXISTS subscription_plan CASCADE;
    DROP TYPE IF EXISTS user_role CASCADE;
    DROP TYPE IF EXISTS booking_status CASCADE;
    DROP TYPE IF EXISTS property_type CASCADE;
END $$;

CREATE TYPE tenant_status AS ENUM ('trial', 'active', 'suspended', 'cancelled');
CREATE TYPE subscription_plan AS ENUM ('free', 'starter', 'professional', 'enterprise');
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled');
CREATE TYPE property_type AS ENUM ('apartment', 'house', 'villa', 'condo', 'commercial');

-- Drop tables if they exist
DROP TABLE IF EXISTS booking_guests CASCADE;
DROP TABLE IF EXISTS bookings CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS property_amenities CASCADE;
DROP TABLE IF EXISTS amenities CASCADE;
DROP TABLE IF EXISTS property_images CASCADE;
DROP TABLE IF EXISTS properties CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- Tenants table for multi-tenancy
CREATE TABLE tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    slug citext UNIQUE NOT NULL,
    domain citext UNIQUE,
    status tenant_status DEFAULT 'trial',
    subscription_plan subscription_plan DEFAULT 'starter',
    max_properties integer DEFAULT 10,
    settings jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Users table with tenant relationship
CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT auth.uid(),
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    role user_role DEFAULT 'sales',
    is_active boolean DEFAULT true,
    last_sign_in_at timestamptz,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, email)
);

-- Properties table
CREATE TABLE properties (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    type property_type NOT NULL,
    description text,
    address jsonb NOT NULL,
    amenities jsonb DEFAULT '[]',
    base_price decimal(10,2) NOT NULL,
    currency char(3) DEFAULT 'USD',
    max_guests integer DEFAULT 2,
    bedrooms integer DEFAULT 1,
    bathrooms integer DEFAULT 1,
    size_sqft integer,
    images jsonb DEFAULT '[]',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Customers table
CREATE TABLE customers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    email text NOT NULL,
    full_name text NOT NULL,
    phone text,
    date_of_birth date,
    nationality text,
    id_document jsonb,
    preferences jsonb DEFAULT '{}',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(tenant_id, email)
);

-- Bookings table
CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,
    customer_id uuid REFERENCES customers(id) ON DELETE CASCADE NOT NULL,
    check_in_date date NOT NULL,
    check_out_date date NOT NULL,
    guests integer DEFAULT 1,
    total_amount decimal(10,2) NOT NULL,
    currency char(3) DEFAULT 'USD',
    status booking_status DEFAULT 'pending',
    special_requests text,
    notes jsonb DEFAULT '{}',
    created_by uuid REFERENCES users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);

-- Create indexes for performance
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_properties_tenant_id ON properties(tenant_id);
CREATE INDEX idx_properties_is_active ON properties(is_active);
CREATE INDEX idx_customers_tenant_id ON customers(tenant_id);
CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_property_id ON bookings(property_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS (Row Level Security)
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Tenants policies
CREATE POLICY "Users can view their own tenant" ON tenants FOR SELECT USING (id = auth.uid());
CREATE POLICY "Users can update their own tenant" ON tenants FOR UPDATE USING (id = auth.uid());

-- Users policies
CREATE POLICY "Users can view users in same tenant" ON users FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Users can update users in same tenant" ON users FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()) AND id = auth.uid());
CREATE POLICY "Service role can manage all users" ON users FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Properties policies
CREATE POLICY "Users can view properties in their tenant" ON properties FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Admins can create properties" ON properties FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admins can update properties" ON properties FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admins can delete properties" ON properties FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Customers policies
CREATE POLICY "Users can view customers in their tenant" ON customers FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Staff can create customers" ON customers FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Admins can update customers" ON customers FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admins can delete customers" ON customers FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Bookings policies
CREATE POLICY "Users can view bookings in their tenant" ON bookings FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Staff can create bookings" ON bookings FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "Admins can update bookings" ON bookings FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));
CREATE POLICY "Admins can delete bookings" ON bookings FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Create a function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- If the user doesn't have a tenant_id, assign them to the first tenant or create a new one
    IF NEW.tenant_id IS NULL THEN
        -- Try to assign to an existing tenant (simplified logic - in production, you'd have invitation flow)
        NEW.tenant_id := (SELECT id FROM tenants ORDER BY created_at ASC LIMIT 1);

        -- If no tenant exists, create a default one
        IF NEW.tenant_id IS NULL THEN
            INSERT INTO tenants (name, slug)
            VALUES (COALESCE(NEW.full_name, 'Default Organization'),
                    lower(regexp_replace(COALESCE(NEW.full_name, 'default-org'), '[^a-zA-Z0-9]', '-', 'g')))
            RETURNING id INTO NEW.tenant_id;
        END IF;

        -- Make first user owner
        NEW.role := 'owner';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup (drop if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();