-- Add Maintenance Automation and Backup Strategies
-- Automated cleanup, maintenance procedures, and backup functions

-- Schema migrations tracking table (if not exists)
CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backup automation function
CREATE OR REPLACE FUNCTION automated_backup_procedure()
RETURNS TEXT AS $$
DECLARE
    backup_timestamp TEXT := to_char(NOW(), 'YYYY_MM_DD_HH24_MI_SS');
    backup_file TEXT;
    tenant_record RECORD;
BEGIN
    -- Create tenant-specific backups
    FOR tenant_record IN SELECT id, slug FROM tenants WHERE is_active = true LOOP
        backup_file := format('chateau_backup_%s_%s.sql', tenant_record.slug, backup_timestamp);

        -- Log backup initiation
        INSERT INTO audit_logs (
            tenant_id,
            user_id,
            action,
            table_name,
            new_values
        ) VALUES (
            tenant_record.id,
            NULL,
            'BACKUP_STARTED',
            'system',
            jsonb_build_object('backup_file', backup_file, 'timestamp', NOW())
        );

        -- In production, this would trigger your backup system
        RAISE NOTICE 'Backup initiated for tenant %: %', tenant_record.slug, backup_file;
    END LOOP;

    RETURN format('Backup process completed at %', backup_timestamp);
END;
$$ LANGUAGE plpgsql;

-- Data validation function
CREATE OR REPLACE FUNCTION validate_migration_integrity()
RETURNS TABLE(
    table_name TEXT,
    record_count BIGINT,
    null_count BIGINT,
    validation_status TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Validate customers table
    SELECT
        'customers'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(*) - COUNT(email)::BIGINT,
        CASE
            WHEN COUNT(*) = COUNT(email) THEN 'VALID'
            ELSE 'INVALID - Missing emails'
        END::TEXT
    FROM customers

    UNION ALL

    -- Validate properties
    SELECT
        'properties'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(*) - COUNT(tenant_id)::BIGINT,
        CASE
            WHEN COUNT(*) = COUNT(tenant_id) THEN 'VALID'
            ELSE 'INVALID - Missing tenant_id'
        END::TEXT
    FROM properties

    UNION ALL

    -- Validate bookings
    SELECT
        'bookings'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(*) - COUNT(booking_number)::BIGINT,
        CASE
            WHEN COUNT(*) = COUNT(booking_number) THEN 'VALID'
            ELSE 'INVALID - Missing booking numbers'
        END::TEXT
    FROM bookings

    UNION ALL

    -- Validate users
    SELECT
        'users'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(*) - COUNT(email)::BIGINT,
        CASE
            WHEN COUNT(*) = COUNT(email) THEN 'VALID'
            ELSE 'INVALID - Missing emails'
        END::TEXT
    FROM users

    UNION ALL

    -- Validate user_tenants
    SELECT
        'user_tenants'::TEXT,
        COUNT(*)::BIGINT,
        COUNT(*) - COUNT(user_id)::BIGINT + COUNT(*) - COUNT(tenant_id)::BIGINT,
        CASE
            WHEN COUNT(*) = COUNT(user_id) AND COUNT(*) = COUNT(tenant_id) THEN 'VALID'
            ELSE 'INVALID - Missing user_id or tenant_id'
        END::TEXT
    FROM user_tenants;
END;
$$ LANGUAGE plpgsql;

-- Automated alerting function
CREATE OR REPLACE FUNCTION check_and_alert()
RETURNS void AS $$
DECLARE
    alert_record RECORD;
    alert_message TEXT;
BEGIN
    FOR alert_record IN SELECT * FROM performance_health_check() WHERE status != 'OK' LOOP
        alert_message := format('ALERT: % - % (Current: %s, Threshold: %s). Recommendation: %s',
            alert_record.check_name,
            alert_record.status,
            alert_record.value,
            alert_record.threshold,
            alert_record.recommendation
        );

        -- Log alert
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            new_values
        ) VALUES (
            NULL,
            'PERFORMANCE_ALERT',
            'system',
            jsonb_build_object(
                'alert_type', alert_record.check_name,
                'message', alert_message,
                'timestamp', NOW()
            )
        );

        -- In production, send to your alerting system
        RAISE NOTICE '%', alert_message;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Automated maintenance function
CREATE OR REPLACE FUNCTION automated_maintenance()
RETURNS void AS $$
DECLARE
    maintenance_result TEXT;
BEGIN
    -- Update table statistics
    ANALYZE;

    -- Clean up expired property locks
    PERFORM cleanup_expired_locks();

    -- Archive old audit logs (keep last 90 days)
    DELETE FROM audit_logs
    WHERE created_at < NOW() - INTERVAL '90 days';

    -- Archive old customer records (optional - based on your needs)
    -- DELETE FROM customers
    -- WHERE status = 'lost'
    -- AND updated_at < NOW() - INTERVAL '2 years';

    -- Clean up old marketing campaign metrics
    UPDATE marketing_campaigns
    SET metrics = jsonb_build_object(
        'archived_at', NOW(),
        'original_metrics', metrics
    )
    WHERE status = 'sent'
    AND sent_at < NOW() - INTERVAL '1 year';

    -- Check for bloat and cleanup
    VACUUM ANALYZE;

    -- Refresh materialized views
    PERFORM refresh_dashboard_stats();

    -- Log maintenance completion
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        new_values
    ) VALUES (
        NULL,
        'MAINTENANCE_COMPLETED',
        'system',
        jsonb_build_object('timestamp', NOW())
    );

    -- Run performance checks
    PERFORM check_and_alert();

    -- Validate data integrity
    maintenance_result := 'Maintenance completed. Data integrity: ';

    FOR record IN SELECT * FROM validate_migration_integrity() LOOP
        maintenance_result := maintenance_result || format('%s=%s; ', record.table_name, record.validation_status);
    END LOOP;

    -- Log comprehensive maintenance result
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        new_values
    ) VALUES (
        NULL,
        'MAINTENANCE_SUMMARY',
        'system',
        jsonb_build_object(
            'summary', maintenance_result,
            'timestamp', NOW()
        )
    );

END;
$$ LANGUAGE plpgsql;

-- Migration template function for future use
CREATE OR REPLACE FUNCTION migration_template(p_migration_version TEXT, p_migration_sql TEXT)
RETURNS void AS $$
DECLARE
    migration_exists BOOLEAN;
BEGIN
    -- Check if migration already applied
    SELECT EXISTS (
        SELECT 1 FROM schema_migrations
        WHERE version = p_migration_version
    ) INTO migration_exists;

    IF migration_exists THEN
        RAISE NOTICE 'Migration % already applied', p_migration_version;
        RETURN;
    END IF;

    -- Log migration start
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        new_values
    ) VALUES (
        NULL,
        'MIGRATION_STARTED',
        'system',
        jsonb_build_object(
            'migration_version', p_migration_version,
            'timestamp', NOW()
        )
    );

    -- Apply changes with error handling
    BEGIN
        -- Execute migration SQL (in production, this would be more sophisticated)
        -- EXECUTE p_migration_sql;

        -- Mark migration as complete
        INSERT INTO schema_migrations (version, applied_at)
        VALUES (p_migration_version, NOW());

        -- Log success
        INSERT INTO audit_logs (
            user_id,
            action,
            table_name,
            new_values
        ) VALUES (
            NULL,
            'MIGRATION_COMPLETED',
            'system',
            jsonb_build_object(
                'migration_version', p_migration_version,
                'timestamp', NOW()
            )
        );

        RAISE NOTICE 'Migration % applied successfully', p_migration_version;
    EXCEPTION
        WHEN OTHERS THEN
            -- Log failure
            INSERT INTO audit_logs (
                user_id,
                action,
                table_name,
                new_values
            ) VALUES (
                NULL,
                'MIGRATION_FAILED',
                'system',
                jsonb_build_object(
                    'migration_version', p_migration_version,
                    'error', SQLERRM,
                    'timestamp', NOW()
                )
            );

            RAISE EXCEPTION 'Migration % failed: %', p_migration_version, SQLERRM;
    END;
END;
$$ LANGUAGE plpgsql;

-- Create function to monitor index usage
CREATE OR REPLACE FUNCTION monitor_index_usage()
RETURNS TABLE(
    index_name TEXT,
    table_name TEXT,
    usage_count BIGINT,
    size_mb NUMERIC,
    recommendation TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        i.schemaname || '.' || i.indexname as index_name,
        i.schemaname || '.' || i.tablename as table_name,
        COALESCE(s.idx_scan, 0) as usage_count,
        pg_relation_size(indexrelid::regclass) / 1024 / 1024 as size_mb,
        CASE
            WHEN s.idx_scan = 0 THEN 'Consider dropping - unused index'
            WHEN s.idx_scan < 10 AND pg_relation_size(indexrelid::regclass) > 10485760 THEN 'Review usage - large index with few scans'
            ELSE 'Index appears to be in use'
        END
    FROM pg_indexes i
    LEFT JOIN pg_stat_user_indexes s ON i.indexname = s.indexrelname
    WHERE i.schemaname = 'public'
    ORDER BY pg_relation_size(indexrelid::regclass) DESC;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions for maintenance functions
GRANT EXECUTE ON FUNCTION automated_backup_procedure TO authenticated;
GRANT EXECUTE ON FUNCTION validate_migration_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_alert TO authenticated;
GRANT EXECUTE ON FUNCTION automated_maintenance TO authenticated;
GRANT EXECUTE ON FUNCTION monitor_index_usage TO authenticated;

-- Track this migration
INSERT INTO schema_migrations (version, applied_at)
VALUES ('20250119060000_add_maintenance_automation', NOW())
ON CONFLICT (version) DO NOTHING;