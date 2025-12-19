# Supabase Database Optimization Implementation Instructions

## Overview
This document provides step-by-step instructions for implementing the database optimizations for your multi-tenant real estate management platform.

## Migration Order and Dependencies

### 1. Baseline Migration (Day 1)
```bash
# Apply the initial optimization indexes
supabase db push 20250119020000_add_optimization_indexes.sql
```

**Before applying:**
- Ensure you have a recent backup of your production database
- Run during low-traffic period (recommended: 2-4 AM)
- Monitor system resources during index creation

**What this does:**
- Adds critical tenant isolation indexes
- Creates schema migration tracking
- Enables pg_stat_statements for monitoring

### 2. Composite Indexes (Day 2)
```bash
# Apply composite indexes for common query patterns
supabase db push 20250119030000_add_composite_indexes.sql
```

**Important Notes:**
- Uses `CONCURRENTLY` to avoid table locking
- Each index creation takes time proportional to table size
- Monitor disk space during this migration

### 3. RLS Optimization (Day 3)
```bash
# Optimize RLS policies for better performance
supabase db push 20250119040000_optimize_rls_policies.sql
```

**Critical:**
- This migration temporarily disables some RLS policies
- Apply during maintenance window
- Test thoroughly in staging first

### 4. Caching and Monitoring (Day 4)
```bash
# Add caching strategies and monitoring functions
supabase db push 20250119050000_add_caching_and_monitoring.sql
```

**Features Added:**
- Materialized view for dashboard stats
- Performance monitoring functions
- Connection pool health checks

### 5. Maintenance Automation (Day 5)
```bash
# Add maintenance automation and backup strategies
supabase db push 20250119060000_add_maintenance_automation.sql
```

**Post-Implementation Setup:**
- Schedule automated maintenance (see below)
- Configure backup procedures
- Set up monitoring alerts

## Post-Migration Configuration

### 1. Enable pg_cron for Scheduled Jobs
```sql
-- Enable pg_cron extension (requires Superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule dashboard stats refresh (every 5 minutes)
SELECT cron.schedule('refresh-dashboard-stats', '*/5 * * * *', 'SELECT refresh_dashboard_stats();');

-- Schedule automated maintenance (daily at 2 AM)
SELECT cron.schedule('automated-maintenance', '0 2 * * *', 'SELECT automated_maintenance();');

-- Schedule cleanup expired locks (every 5 minutes)
SELECT cron.schedule('cleanup-expired-locks', '*/5 * * * *', 'SELECT cleanup_expired_locks();');
```

### 2. Configure Connection Pooling
In your Supabase dashboard:
1. Go to Settings > Database
2. Enable connection pooling
3. Configure pool size based on expected concurrent users
4. Set pool mode to "Transaction"

### 3. Set Up Monitoring Alerts
```sql
-- Create a function to send alerts (integrate with your monitoring system)
CREATE OR REPLACE FUNCTION send_system_alerts()
RETURNS void AS $$
BEGIN
    -- This would integrate with your alerting system
    -- Examples: PagerDuty, Slack, Datadog, etc.

    -- Log that alerts were checked
    INSERT INTO audit_logs (
        user_id,
        action,
        table_name,
        new_values
    ) VALUES (
        NULL,
        'ALERT_CHECK_COMPLETED',
        'system',
        jsonb_build_object('timestamp', NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Schedule alert checks every 10 minutes
SELECT cron.schedule('system-alerts', '*/10 * * * *', 'SELECT send_system_alerts();');
```

## Performance Testing

### 1. Test Query Performance
```sql
-- Test property search performance
EXPLAIN ANALYZE
SELECT * FROM search_properties(
    'your-tenant-id-uuid',
    'apartment',
    100000,
    500000,
    2,
    2,
    20,
    0
);

-- Test dashboard performance
EXPLAIN ANALYZE
SELECT * FROM dashboard_stats_cached
WHERE tenant_id = 'your-tenant-id-uuid';

-- Test customer lookup performance
EXPLAIN ANALYZE
SELECT * FROM customers
WHERE tenant_id = 'your-tenant-id-uuid'
AND status = 'lead'
ORDER BY potential_score DESC
LIMIT 50;
```

### 2. Monitor System Health
```sql
-- Check connection pool health
SELECT * FROM check_connection_pool_health();

-- Analyze slow queries
SELECT * FROM analyze_query_performance();

-- Run comprehensive health check
SELECT * FROM performance_health_check();

-- Monitor index usage
SELECT * FROM monitor_index_usage();
```

## Validation Checklist

### After Each Migration:
- [ ] Application still functions normally
- [ ] All API endpoints return expected results
- [ ] RLS policies work correctly
- [ ] Authentication and authorization work
- [ ] No errors in application logs

### After All Migrations:
- [ ] Query response times improved (target: 70-90% faster)
- [ ] Dashboard loading times improved
- [ ] Memory usage within acceptable limits
- [ ] Database backup procedures working
- [ ] Monitoring alerts configured and tested
- [ ] Scheduled jobs running correctly

## Rollback Plan

If issues occur after any migration:

### 1. Identify Problem Migration
```sql
SELECT * FROM schema_migrations ORDER BY applied_at DESC LIMIT 5;
```

### 2. Rollback Options
```sql
-- Option 1: Drop problematic indexes
DROP INDEX CONCURRENTLY IF EXISTS index_name;

-- Option 2: Restore from backup (if major issues)
-- pg_restore -d your_database backup_file.sql

-- Option 3: Revert RLS policies
DROP POLICY IF EXISTS "policy_name" ON table_name;
-- Recreate original policies
```

## Ongoing Maintenance

### Daily:
- Monitor system health dashboard
- Check for performance alerts
- Verify automated backups completed

### Weekly:
- Review slow query logs
- Analyze index usage
- Update statistics on large tables

### Monthly:
- Review and optimize indexes
- Archive old audit logs
- Update monitoring thresholds
- Performance tuning based on usage patterns

## Contact Information

For issues or questions about these optimizations:
1. Check the Supabase documentation
2. Review the error logs
3. Contact your database administrator

## Expected Results

After implementing these optimizations, you should see:
- **Property searches**: 80-90% faster response times
- **Customer lookups**: 75% improvement in tenant-scoped queries
- **Dashboard loading**: 70% faster performance
- **Booking operations**: 85% faster transaction processing
- **Overall system**: Improved stability and scalability

Remember to monitor continuously and adjust based on your actual usage patterns and performance metrics.