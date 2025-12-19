-- Add Critical Multi-Tenant Indexes for Performance Optimization
-- Run this migration in production with CONCURRENTLY to avoid locking

-- Enable pg_stat_statements for query performance monitoring
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Enhanced tenant isolation indexes
CREATE INDEX CONCURRENTLY idx_users_tenant_active ON users(tenant_id, is_active);
CREATE INDEX CONCURRENTLY idx_user_tenants_tenant_role ON user_tenants(tenant_id, role) WHERE is_active = true;

-- Properties - most queried table optimizations
CREATE INDEX CONCURRENTLY idx_properties_tenant_status_price ON properties(tenant_id, status, price DESC);
CREATE INDEX CONCURRENTLY idx_properties_tenant_project_status ON properties(tenant_id, project_id, status);
CREATE INDEX CONCURRENTLY idx_properties_tenant_type_area ON properties(tenant_id, property_type, area_sqm);
CREATE INDEX CONCURRENTLY idx_properties_tenant_bedrooms_bathrooms ON properties(tenant_id, bedrooms, bathrooms);

-- Customer indexes for sales operations
CREATE INDEX CONCURRENTLY idx_customers_tenant_status_score ON customers(tenant_id, status, potential_score DESC);
CREATE INDEX CONCURRENTLY idx_customers_tenant_sales_created ON customers(tenant_id, assigned_sales_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_customers_tenant_budget_range ON customers(tenant_id, budget_min, budget_max);

-- Booking performance indexes
CREATE INDEX CONCURRENTLY idx_bookings_tenant_status_date ON bookings(tenant_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_bookings_tenant_customer_status ON bookings(tenant_id, customer_id, status);
CREATE INDEX CONCURRENTLY idx_bookings_tenant_property_type ON bookings(tenant_id, property_id, type);

-- Project and category optimization
CREATE INDEX CONCURRENTLY idx_projects_tenant_category_status ON projects(tenant_id, category_id, status);
CREATE INDEX CONCURRENTLY idx_categories_tenant_active_sort ON categories(tenant_id, is_active, sort_order);

-- Audit log optimization
CREATE INDEX CONCURRENTLY idx_audit_logs_tenant_user_date ON audit_logs(tenant_id, user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_audit_logs_tenant_table_date ON audit_logs(tenant_id, table_name, created_at DESC);

-- Create schema migrations tracking table
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mark this migration as applied
INSERT INTO schema_migrations (version, applied_at)
VALUES ('20250119020000_add_optimization_indexes', NOW())
ON CONFLICT (version) DO NOTHING;

-- Create comment for documentation
COMMENT ON TABLE schema_migrations IS 'Tracks database schema migrations for optimization purposes';