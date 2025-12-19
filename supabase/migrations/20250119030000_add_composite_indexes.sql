-- Add Advanced Composite Indexes for Common Query Patterns
-- These indexes significantly improve performance for specific use cases

-- Property search optimization (most common query)
CREATE INDEX CONCURRENTLY idx_property_search_composite ON properties(
    tenant_id,
    status,
    property_type,
    bedrooms,
    bathrooms,
    price,
    created_at DESC
) WHERE status IN ('available', 'reserved');

-- Customer lead management
CREATE INDEX CONCURRENTLY idx_customer_leads_composite ON customers(
    tenant_id,
    status,
    assigned_sales_id,
    potential_score DESC,
    last_contacted_at ASC NULLS FIRST
) WHERE status IN ('lead', 'contacted', 'qualified');

-- Sales dashboard queries
CREATE INDEX CONCURRENTLY idx_sales_dashboard_composite ON bookings(
    tenant_id,
    sales_staff_id,
    status,
    created_at DESC
) WHERE status IN ('confirmed', 'completed');

-- Marketing campaign effectiveness
CREATE INDEX CONCURRENTLY idx_campaign_metrics_composite ON marketing_campaigns(
    tenant_id,
    status,
    type,
    created_at DESC
) WHERE status IN ('sent', 'completed');

-- Enhanced JSONB indexes with jsonb_path_ops for better performance
CREATE INDEX CONCURRENTLY idx_properties_specifications_ops ON properties USING GIN (specifications jsonb_path_ops);
CREATE INDEX CONCURRENTLY idx_customers_documents_ops ON customers USING GIN (documents jsonb_path_ops);
CREATE INDEX CONCURRENTLY idx_marketing_campaigns_content_ops ON marketing_campaigns USING GIN (content jsonb_path_ops);

-- Partial indexes for common JSON queries
CREATE INDEX CONCURRENTLY idx_properties_pricing_history_date ON properties
USING GIN (pricing_history)
WHERE array_length(pricing_history, 1) > 0;

CREATE INDEX CONCURRENTLY idx_customers_ai_analysis_score ON customers
USING GIN (ai_analysis)
WHERE ai_analysis IS NOT NULL;

-- Index for location-based searches
CREATE INDEX CONCURRENTLY idx_projects_location ON projects(tenant_id, province, latitude, longitude)
WHERE status = 'active';

-- Booking date range queries
CREATE INDEX CONCURRENTLY idx_bookings_date_range ON bookings(tenant_id, confirmed_at, completed_at)
WHERE status IN ('confirmed', 'completed');

-- Customer communication tracking
CREATE INDEX CONCURRENTLY idx_customers_communication ON customers(tenant_id, last_contacted_at DESC, status)
WHERE last_contacted_at IS NOT NULL;

-- Sales performance tracking
CREATE INDEX CONCURRENTLY idx_sales_staff_performance ON sales_staff(tenant_id, is_active, hire_date, commission_rate)
WHERE is_active = true;

-- Track this migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('20250119030000_add_composite_indexes', NOW())
ON CONFLICT (version) DO NOTHING;