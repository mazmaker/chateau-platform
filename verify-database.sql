-- =====================================================
-- CHATEAU Platform - Database Verification Script
-- รันหลังจาก Complete Migration เพื่อตรวจสอบ
-- =====================================================

-- ตรวจสอบตารางที่สร้างแล้ว
SELECT
    'Tables Created' as check_type,
    COUNT(*) as count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'tenants', 'profiles', 'properties', 'bookings',
    'invoices', 'payments', 'activity_logs', 'error_logs',
    'leads', 'campaigns', 'units', 'company_settings'
);

-- ตรวจสอบ RLS Policies
SELECT
    'RLS Policies Created' as check_type,
    COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'public';

-- ตรวจสอบ Indexes
SELECT
    'Indexes Created' as check_type,
    COUNT(*) as count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%';

-- ตรวจสอบ Functions
SELECT
    'Functions Created' as check_type,
    COUNT(*) as count
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name IN ('update_updated_at_column', 'log_activity', 'generate_invoice_number');

-- ตรวจสอบ Extensions
SELECT
    'Extensions Enabled' as check_type,
    COUNT(*) as count
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'citext');

-- ตรวจสอบข้อมูลในตาราง
SELECT 'Tenants' as table_name, COUNT(*) as record_count FROM tenants
UNION ALL
SELECT 'Profiles' as table_name, COUNT(*) as record_count FROM profiles
UNION ALL
SELECT 'Invoices' as table_name, COUNT(*) as record_count FROM invoices
UNION ALL
SELECT 'Payments' as table_name, COUNT(*) as record_count FROM payments
UNION ALL
SELECT 'Properties' as table_name, COUNT(*) as record_count FROM properties
UNION ALL
SELECT 'Bookings' as table_name, COUNT(*) as record_count FROM bookings;

-- แสดงโครงสร้างตาราง invoices (สำหรับ Auto Billing)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'invoices'
ORDER BY ordinal_position;

-- แสดงโครงสร้างตาราง payments
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'payments'
ORDER BY ordinal_position;

-- ตรวจสอบ Foreign Keys
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
AND tc.table_name IN ('invoices', 'payments')
ORDER BY tc.table_name;

-- Final Status Report
DO $$
DECLARE
    tables_count int;
    policies_count int;
    functions_count int;
BEGIN
    SELECT COUNT(*) INTO tables_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'tenants', 'profiles', 'properties', 'bookings',
        'invoices', 'payments', 'activity_logs', 'error_logs',
        'leads', 'campaigns', 'units', 'company_settings'
    );

    SELECT COUNT(*) INTO policies_count
    FROM pg_policies
    WHERE schemaname = 'public';

    SELECT COUNT(*) INTO functions_count
    FROM information_schema.routines
    WHERE routine_schema = 'public'
    AND routine_name IN ('update_updated_at_column', 'log_activity', 'generate_invoice_number');

    RAISE NOTICE '==========================================';
    RAISE NOTICE '📊 DATABASE VERIFICATION COMPLETE';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '✅ Tables: % / 12 expected', tables_count;
    RAISE NOTICE '✅ RLS Policies: %', policies_count;
    RAISE NOTICE '✅ Functions: % / 3 expected', functions_count;
    RAISE NOTICE '';

    IF tables_count >= 12 AND policies_count > 0 AND functions_count >= 3 THEN
        RAISE NOTICE '🎉 ✅ ALL SYSTEMS GO! Your database is ready for production.';
        RAISE NOTICE '🚀 Auto Billing should work perfectly now!';
    ELSE
        RAISE NOTICE '⚠️  Some components are missing. Please check the migration log.';
    END IF;

    RAISE NOTICE '==========================================';
END $$;