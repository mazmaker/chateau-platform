-- แก้ไขปัญหา Modal เปลี่ยนสถานะ
-- รันใน Supabase SQL Editor หากมีปัญหา RLS

-- 1. เช็คว่า invoices table มีคอลัมน์ครบไหม
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'invoices'
  AND column_name IN ('id', 'status', 'tenant_id', 'paid_at', 'updated_at');

-- 2. เช็ค RLS policies ของ invoices table
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'invoices';

-- 3. แก้ไข RLS Policy สำหรับ invoices (หากจำเป็น)
-- ลบ policy เก่า
DROP POLICY IF EXISTS "Users can update invoices for their tenant" ON invoices;

-- สร้าง policy ใหม่
CREATE POLICY "Users can update invoices for their tenant" ON invoices
FOR UPDATE USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 4. เช็คว่า user มี tenant_id ในตาราง profiles ไหม
SELECT
    auth.uid() as user_id,
    p.tenant_id,
    t.name as tenant_name
FROM profiles p
JOIN tenants t ON p.tenant_id = t.id
WHERE p.user_id = auth.uid();

-- 5. หากไม่มี tenant_id ให้สร้าง (ทดสอบ)
DO $$
DECLARE
    current_user_id uuid;
    test_tenant_id uuid;
BEGIN
    -- ดึง user ID
    SELECT auth.uid() INTO current_user_id;

    IF current_user_id IS NOT NULL THEN
        -- หาหรือสร้าง test tenant
        SELECT id INTO test_tenant_id
        FROM tenants
        WHERE slug = 'test-company-logs'
        LIMIT 1;

        -- อัพเดท profiles ให้มี tenant_id
        UPDATE profiles
        SET tenant_id = test_tenant_id
        WHERE user_id = current_user_id
          AND tenant_id IS NULL;

        RAISE NOTICE 'Updated user % with tenant %', current_user_id, test_tenant_id;
    END IF;
END $$;

-- 6. ทดสอบการอัพเดท invoice (ถ้ามี)
UPDATE invoices
SET updated_at = NOW()
WHERE id IN (
    SELECT id FROM invoices LIMIT 1
);

-- 7. แสดงข้อมูลสำหรับ debug
SELECT
    i.id,
    i.invoice_number,
    i.status,
    i.tenant_id,
    t.name as tenant_name,
    p.user_id
FROM invoices i
JOIN tenants t ON i.tenant_id = t.id
LEFT JOIN profiles p ON p.tenant_id = t.id
LIMIT 5;