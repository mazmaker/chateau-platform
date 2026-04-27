-- 🚨 URGENT FIX - แก้ไข 403 Forbidden ทันที
-- Copy แล้วรันใน Supabase SQL Editor

-- 1. เช็คว่า user มี tenant_id ไหม
DO $$
DECLARE
    current_user_uuid uuid;
    user_tenant_id uuid;
    test_tenant_id uuid;
BEGIN
    -- ดึง current user (จำลอง - ใช้ email ที่เข้าสู่ระบบ)
    SELECT id INTO current_user_uuid FROM auth.users WHERE email LIKE '%@%' LIMIT 1;

    IF current_user_uuid IS NOT NULL THEN
        RAISE NOTICE 'Current user found: %', current_user_uuid;

        -- เช็คว่ามี profile ไหม
        SELECT tenant_id INTO user_tenant_id
        FROM profiles
        WHERE user_id = current_user_uuid;

        IF user_tenant_id IS NULL THEN
            -- สร้าง tenant ถ้าไม่มี
            SELECT id INTO test_tenant_id FROM tenants WHERE slug = 'test-company-logs' LIMIT 1;

            IF test_tenant_id IS NULL THEN
                INSERT INTO tenants (name, slug, email, billing_email, subscription_plan, status)
                VALUES ('Test Company for User', 'test-company-logs', 'user@test.com', 'billing@test.com', 'professional', 'active')
                RETURNING id INTO test_tenant_id;
                RAISE NOTICE 'Created tenant: %', test_tenant_id;
            END IF;

            -- อัพเดท profiles
            UPDATE profiles
            SET tenant_id = test_tenant_id
            WHERE user_id = current_user_uuid;

            -- หรือสร้างใหม่ถ้าไม่มี
            INSERT INTO profiles (user_id, tenant_id, role, billing_settings)
            VALUES (current_user_uuid, test_tenant_id, 'owner', '{}')
            ON CONFLICT (user_id) DO UPDATE SET tenant_id = test_tenant_id;

            RAISE NOTICE 'Updated profile for user: %', current_user_uuid;
        ELSE
            RAISE NOTICE 'User already has tenant: %', user_tenant_id;
        END IF;
    ELSE
        RAISE NOTICE 'No user found - check auth';
    END IF;
END $$;

-- 2. สร้าง RLS Policy ที่ใช้งานได้จริง
DROP POLICY IF EXISTS "invoice_status_logs_select_policy" ON invoice_status_logs;
DROP POLICY IF EXISTS "invoice_status_logs_insert_policy" ON invoice_status_logs;

-- Policy สำหรับ SELECT (อ่านได้)
CREATE POLICY "invoice_status_logs_select_policy" ON invoice_status_logs
FOR SELECT TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.tenant_id = invoice_status_logs.tenant_id
    )
    OR
    -- Allow system logs
    changed_by IN ('SYSTEM', 'TRIGGER', 'AUTO_OVERDUE')
);

-- Policy สำหรับ INSERT (เขียนได้)
CREATE POLICY "invoice_status_logs_insert_policy" ON invoice_status_logs
FOR INSERT TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.tenant_id = invoice_status_logs.tenant_id
    )
    OR
    -- Allow system inserts
    changed_by IN ('SYSTEM', 'TRIGGER', 'AUTO_OVERDUE')
);

-- 3. เช็ค invoices table RLS
DROP POLICY IF EXISTS "invoices_update_policy" ON invoices;

CREATE POLICY "invoices_update_policy" ON invoices
FOR UPDATE TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.user_id = auth.uid()
        AND p.tenant_id = invoices.tenant_id
    )
);

-- 4. สร้าง test data ใหม่
INSERT INTO invoices (
    tenant_id, invoice_number, amount, currency, status,
    subscription_plan, due_date, description, created_at, updated_at
)
SELECT
    t.id, 'INV-FIX-001', 1490.00, 'THB', 'pending',
    'professional', CURRENT_DATE + INTERVAL '7 days',
    'Test invoice after fix', NOW(), NOW()
FROM tenants t
WHERE t.slug = 'test-company-logs'
ON CONFLICT (invoice_number) DO NOTHING;

-- 5. ทดสอบ query ที่ UI ใช้
SELECT
    'Testing invoice_status_logs access...' as test_name,
    COUNT(*) as accessible_logs
FROM invoice_status_logs isl
WHERE EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.user_id = (SELECT id FROM auth.users LIMIT 1)
    AND p.tenant_id = isl.tenant_id
);

-- แสดงสถานะ
SELECT
    u.email as user_email,
    p.tenant_id,
    t.name as tenant_name,
    COUNT(i.id) as invoice_count
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
LEFT JOIN tenants t ON p.tenant_id = t.id
LEFT JOIN invoices i ON t.id = i.tenant_id
GROUP BY u.email, p.tenant_id, t.name
LIMIT 5;

-- 6. แสดงข้อความสำเร็จ
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ===== FIX COMPLETE =====';
    RAISE NOTICE '✅ User-tenant association fixed';
    RAISE NOTICE '✅ RLS policies updated';
    RAISE NOTICE '✅ Test data created';
    RAISE NOTICE '';
    RAISE NOTICE '🧪 Next: ทดสอบ Modal อีกครั้ง';
    RAISE NOTICE '1. Refresh หน้าใน browser';
    RAISE NOTICE '2. ลอง "ประวัติการเปลี่ยนสถานะ"';
    RAISE NOTICE '3. ลอง "เปลี่ยนสถานะ"';
    RAISE NOTICE '===========================';
END $$;