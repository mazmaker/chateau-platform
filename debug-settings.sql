-- Debug script to check what's missing for advanced settings
-- รันในไฟล์นี้ใน Supabase SQL Editor เพื่อดูปัญหา

-- ตรวจสอบว่าตาราง company_settings มีอยู่ไหม
SELECT 'company_settings table exists' as check_result,
       EXISTS (
           SELECT 1 FROM information_schema.tables
           WHERE table_schema = 'public'
           AND table_name = 'company_settings'
       ) as exists;

-- ตรวจสอบคอลัมน์ใน company_settings
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'company_settings'
ORDER BY ordinal_position;

-- ตรวจสอบว่ามีข้อมูล tenant ไหม
SELECT 'tenants data' as check_result, COUNT(*) as count FROM tenants;

-- ตรวจสอบ company_settings data
SELECT 'company_settings data' as check_result, COUNT(*) as count
FROM company_settings;

-- สร้างข้อมูลทดสอบถ้ายังไม่มี
DO $$
DECLARE
    tenant_count int;
    settings_count int;
    first_tenant_id uuid;
BEGIN
    -- ตรวจสอบจำนวน tenant
    SELECT COUNT(*) INTO tenant_count FROM tenants;

    IF tenant_count = 0 THEN
        -- สร้าง tenant ทดสอบ
        INSERT INTO tenants (name, slug, email, billing_email, status)
        VALUES ('บริษัททดสอบ', 'test-company', 'test@company.com', 'billing@company.com', 'active')
        RETURNING id INTO first_tenant_id;

        RAISE NOTICE 'สร้าง tenant ทดสอบ: %', first_tenant_id;
    ELSE
        -- ใช้ tenant แรก
        SELECT id INTO first_tenant_id FROM tenants LIMIT 1;
    END IF;

    -- ตรวจสอบ company_settings
    SELECT COUNT(*) INTO settings_count
    FROM company_settings
    WHERE tenant_id = first_tenant_id;

    IF settings_count = 0 THEN
        -- สร้าง company_settings
        INSERT INTO company_settings (
            tenant_id,
            company_name,
            billing_automation
        )
        VALUES (
            first_tenant_id,
            'บริษัททดสอบ จำกัด',
            '{}'::jsonb
        );

        RAISE NOTICE 'สร้าง company_settings สำหรับ tenant: %', first_tenant_id;
    END IF;

END $$;

-- ตรวจสอบผลลัพธ์อีกครั้ง
SELECT
    t.id,
    t.name,
    cs.id as settings_id,
    cs.billing_automation
FROM tenants t
LEFT JOIN company_settings cs ON t.id = cs.tenant_id
LIMIT 1;