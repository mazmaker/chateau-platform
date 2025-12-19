-- Optimize RLS Policies for Better Performance
-- Replace subquery-based policies with indexed JOIN patterns

-- Create function for efficient tenant lookup (STABLE for better performance)
CREATE OR REPLACE FUNCTION get_user_tenants()
RETURNS TABLE(tenant_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT tenant_id
    FROM user_tenants
    WHERE user_id = auth.uid()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop existing inefficient policies
DROP POLICY IF EXISTS "Tenant users can view properties" ON properties;
DROP POLICY IF EXISTS "Admins can manage properties" ON properties;
DROP POLICY IF EXISTS "Sales can lock properties" ON properties;

DROP POLICY IF EXISTS "All tenant users can view customers" ON customers;
DROP POLICY IF EXISTS "Admins can manage all customers" ON customers;
DROP POLICY IF EXISTS "Sales can manage assigned customers" ON customers;

DROP POLICY IF EXISTS "All tenant users can view bookings" ON bookings;
DROP POLICY IF EXISTS "Admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Sales can manage their bookings" ON bookings;

-- Recreate optimized policies for Properties
CREATE POLICY "Tenant users can view properties" ON properties
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = properties.tenant_id
            AND ut.is_active = true
        )
    );

CREATE POLICY "Admins can manage properties" ON properties
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = properties.tenant_id
            AND ut.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can lock properties" ON properties
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = properties.tenant_id
            AND ut.role = 'sales'
        )
    ) WITH CHECK (
        (old.lock_expires_at IS NULL OR old.lock_expires_at < NOW()) AND
        new.lock_expires_at > NOW() AND
        new.locked_by = auth.uid() AND
        new.status = 'reserved'
    );

-- Recreate optimized policies for Customers
CREATE POLICY "All tenant users can view customers" ON customers
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_user_tenants())
    );

CREATE POLICY "Admins can manage all customers" ON customers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = customers.tenant_id
            AND ut.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can manage assigned customers" ON customers
    FOR ALL USING (
        assigned_sales_id IN (
            SELECT id FROM sales_staff ss
            JOIN user_tenants ut ON ss.tenant_id = ut.tenant_id
            WHERE ut.user_id = auth.uid()
            AND ut.role = 'sales'
            AND ut.is_active = true
            AND ss.is_active = true
        )
    );

-- Recreate optimized policies for Bookings
CREATE POLICY "All tenant users can view bookings" ON bookings
    FOR SELECT USING (
        tenant_id IN (SELECT tenant_id FROM get_user_tenants())
    );

CREATE POLICY "Admins can manage all bookings" ON bookings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_tenants ut
            WHERE ut.user_id = auth.uid()
            AND ut.tenant_id = bookings.tenant_id
            AND ut.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Sales can manage their bookings" ON bookings
    FOR ALL USING (
        sales_staff_id IN (
            SELECT id FROM sales_staff ss
            JOIN user_tenants ut ON ss.tenant_id = ut.tenant_id
            WHERE ut.user_id = auth.uid()
            AND ut.role = 'sales'
            AND ut.is_active = true
            AND ss.is_active = true
        )
    );

-- Optimized property search function with CTEs
CREATE OR REPLACE FUNCTION search_properties(
    p_tenant_id UUID,
    p_property_type TEXT DEFAULT NULL,
    p_min_price DECIMAL DEFAULT NULL,
    p_max_price DECIMAL DEFAULT NULL,
    p_bedrooms INTEGER DEFAULT NULL,
    p_bathrooms INTEGER DEFAULT NULL,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    title TEXT,
    property_type TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    area_sqm DECIMAL,
    price DECIMAL,
    status TEXT,
    project_name TEXT,
    images JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH filtered_properties AS (
        SELECT
            p.id,
            p.title,
            p.property_type,
            p.bedrooms,
            p.bathrooms,
            p.area_sqm,
            p.price,
            p.status,
            p.images,
            pr.name as project_name
        FROM properties p
        JOIN projects pr ON p.project_id = pr.id
        WHERE p.tenant_id = p_tenant_id
        AND p.status = 'available'
        AND (p_property_type IS NULL OR p.property_type = p_property_type)
        AND (p_min_price IS NULL OR p.price >= p_min_price)
        AND (p_max_price IS NULL OR p.price <= p_max_price)
        AND (p_bedrooms IS NULL OR p.bedrooms = p_bedrooms)
        AND (p_bathrooms IS NULL OR p.bathrooms = p_bathrooms)
        ORDER BY p.created_at DESC
        LIMIT p_limit
        OFFSET p_offset
    )
    SELECT * FROM filtered_properties;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_properties TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_tenants TO authenticated;

-- Track this migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('20250119040000_optimize_rls_policies', NOW())
ON CONFLICT (version) DO NOTHING;