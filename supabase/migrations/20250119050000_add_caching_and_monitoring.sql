-- Add Caching Strategies and Monitoring Functions
-- Materialized views and performance monitoring utilities

-- Materialized view for dashboard statistics
CREATE MATERIALIZED VIEW dashboard_stats_cached AS
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
    COUNT(DISTINCT s.id) as active_sales_staff,
    NOW() as last_updated
FROM properties p
LEFT JOIN customers c ON c.tenant_id = p.tenant_id
LEFT JOIN bookings b ON b.tenant_id = p.tenant_id
LEFT JOIN sales_staff s ON s.tenant_id = p.tenant_id AND s.is_active = true
GROUP BY p.tenant_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_dashboard_stats_tenant ON dashboard_stats_cached(tenant_id);

-- Function to refresh stats efficiently
CREATE OR REPLACE FUNCTION refresh_dashboard_stats(p_tenant_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
    IF p_tenant_id IS NOT NULL THEN
        DELETE FROM dashboard_stats_cached WHERE tenant_id = p_tenant_id;
        INSERT INTO dashboard_stats_cached
        SELECT * FROM dashboard_stats WHERE tenant_id = p_tenant_id;
    ELSE
        REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_stats_cached;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Performance monitoring views
CREATE OR REPLACE VIEW connection_pool_stats AS
SELECT
    datname as database_name,
    numbackends as active_connections,
    xact_commit as transactions_committed,
    xact_rollback as transactions_rolled_back,
    blks_read as blocks_read,
    blks_hit as blocks_hit,
    tup_returned as tuples_returned,
    tup_fetched as tuples_fetched,
    tup_inserted as tuples_inserted,
    tup_updated as tuples_updated,
    tup_deleted as tuples_deleted
FROM pg_stat_database
WHERE datname = current_database();

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_query_performance()
RETURNS TABLE(
    query TEXT,
    calls BIGINT,
    total_time DOUBLE PRECISION,
    mean_time DOUBLE PRECISION,
    rows BIGINT,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        pg_stat_statements.query,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time,
        pg_stat_statements.mean_exec_time,
        pg_stat_statements.rows,
        CASE
            WHEN pg_stat_statements.mean_exec_time > 1000 THEN 'Consider adding index or optimizing query'
            WHEN pg_stat_statements.calls > 10000 THEN 'Consider caching result'
            WHEN pg_stat_statements.rows = 0 AND pg_stat_statements.calls > 100 THEN 'Review query logic - no results returned'
            ELSE 'Performance acceptable'
        END
    FROM pg_stat_statements
    WHERE pg_stat_statements.calls > 10
    ORDER BY pg_stat_statements.total_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Connection pool health check function
CREATE OR REPLACE FUNCTION check_connection_pool_health()
RETURNS TABLE(
    metric_name TEXT,
    current_value BIGINT,
    threshold_value BIGINT,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check active connections
    SELECT
        'Active Connections',
        count(*)::BIGINT,
        100::BIGINT,
        CASE
            WHEN count(*) > 100 THEN 'CRITICAL'
            WHEN count(*) > 80 THEN 'WARNING'
            ELSE 'OK'
        END
    FROM pg_stat_activity
    WHERE state = 'active'

    UNION ALL

    -- Check idle connections
    SELECT
        'Idle Connections',
        count(*)::BIGINT,
        50::BIGINT,
        CASE
            WHEN count(*) > 50 THEN 'WARNING'
            ELSE 'OK'
        END
    FROM pg_stat_activity
    WHERE state = 'idle'

    UNION ALL

    -- Check long-running queries
    SELECT
        'Long Running Queries',
        count(*)::BIGINT,
        5::BIGINT,
        CASE
            WHEN count(*) > 5 THEN 'CRITICAL'
            WHEN count(*) > 2 THEN 'WARNING'
            ELSE 'OK'
        END
    FROM pg_stat_activity
    WHERE state = 'active'
    AND query_start < NOW() - INTERVAL '5 minutes';
END;
$$ LANGUAGE plpgsql;

-- Performance health check function
CREATE OR REPLACE FUNCTION performance_health_check()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    value NUMERIC,
    threshold NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Check table sizes
    SELECT
        'Table Size Growth',
        CASE
            WHEN pg_total_relation_size('properties') > 1000000000 THEN 'WARNING'
            ELSE 'OK'
        END,
        pg_total_relation_size('properties')::NUMERIC / 1024 / 1024,
        1000,
        'Consider archiving old data if > 1GB'

    UNION ALL

    -- Check index usage
    SELECT
        'Unused Indexes',
        CASE
            WHEN COUNT(*) > 0 THEN 'WARNING'
            ELSE 'OK'
        END,
        COUNT(*)::NUMERIC,
        0,
        'DROP unused indexes to improve write performance'
    FROM pg_stat_user_indexes
    WHERE idx_scan = 0
    AND idx_tup_read = 0

    UNION ALL

    -- Check cache hit ratio
    SELECT
        'Cache Hit Ratio',
        CASE
            WHEN (SUM(blks_hit)::NUMERIC / NULLIF(SUM(blks_hit + blks_read), 0) * 100) < 95 THEN 'WARNING'
            ELSE 'OK'
        END,
        (SUM(blks_hit)::NUMERIC / NULLIF(SUM(blks_hit + blks_read), 0) * 100),
        95,
        'Increase shared_buffers if cache hit ratio < 95%'
    FROM pg_stat_database
    WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- Comprehensive dashboard view for monitoring
CREATE OR REPLACE VIEW system_health_dashboard AS
SELECT
    -- Database metrics
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'active') as active_connections,
    (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle') as idle_connections,
    (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size,

    -- Tenant metrics
    (SELECT count(*) FROM tenants WHERE is_active = true) as active_tenants,
    (SELECT count(*) FROM users WHERE is_active = true) as active_users,
    (SELECT count(*) FROM properties WHERE status = 'available') as available_properties,

    -- Performance metrics
    (SELECT avg(EXTRACT(MILLISECONDS FROM (query_end - query_start)))
     FROM pg_stat_statements LIMIT 100) as avg_query_time_ms,

    -- Recent activity
    (SELECT count(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour_actions,
    (SELECT count(*) FROM bookings WHERE created_at > NOW() - INTERVAL '1 hour') as last_hour_bookings,

    -- System health
    (SELECT count(*) FROM performance_health_check() WHERE status = 'OK') as healthy_checks,
    (SELECT count(*) FROM performance_health_check() WHERE status != 'OK') as warning_checks,

    NOW() as last_updated;

-- Grant permissions for views
GRANT SELECT ON dashboard_stats_cached TO authenticated;
GRANT SELECT ON connection_pool_stats TO authenticated;
GRANT SELECT ON system_health_dashboard TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_query_performance TO authenticated;
GRANT EXECUTE ON FUNCTION check_connection_pool_health TO authenticated;
GRANT EXECUTE ON FUNCTION performance_health_check TO authenticated;

-- Track this migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('20250119050000_add_caching_and_monitoring', NOW())
ON CONFLICT (version) DO NOTHING;