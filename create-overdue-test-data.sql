-- สร้างข้อมูลทดสอบสำหรับ Auto Overdue Detection
-- รันใน Supabase SQL Editor

-- 1. สร้าง tenant ทดสอบ (ถ้าไม่มี)
INSERT INTO tenants (name, slug, email, billing_email, subscription_plan, status)
VALUES
  ('บริษัททดสอบ Auto Overdue', 'auto-overdue-test', 'test@autooverdue.com', 'billing@autooverdue.com', 'professional', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2. สร้างใบแจ้งหนี้ทดสอบ - เกินกำหนด 3 วัน
INSERT INTO invoices (
  tenant_id,
  invoice_number,
  amount,
  currency,
  status,
  subscription_plan,
  due_date,
  description,
  created_at
)
SELECT
  t.id,
  'INV-OVERDUE-001',
  1490.00,
  'THB',
  'pending', -- จะเปลี่ยนเป็น overdue อัตโนมัติ
  'professional',
  CURRENT_DATE - INTERVAL '3 days', -- เกินมา 3 วัน
  'ทดสอบ Auto Overdue Detection - เกิน 3 วัน',
  NOW() - INTERVAL '33 days'
FROM tenants t
WHERE t.slug = 'auto-overdue-test'
ON CONFLICT (invoice_number) DO NOTHING;

-- 3. สร้างใบแจ้งหนี้ทดสอบ - เกินกำหนด 1 วัน
INSERT INTO invoices (
  tenant_id,
  invoice_number,
  amount,
  currency,
  status,
  subscription_plan,
  due_date,
  description,
  created_at
)
SELECT
  t.id,
  'INV-OVERDUE-002',
  799.00,
  'THB',
  'pending', -- จะเปลี่ยนเป็น overdue อัตโนมัติ
  'starter',
  CURRENT_DATE - INTERVAL '1 day', -- เกินมา 1 วัน
  'ทดสอบ Auto Overdue Detection - เกิน 1 วัน',
  NOW() - INTERVAL '31 days'
FROM tenants t
WHERE t.slug = 'auto-overdue-test'
ON CONFLICT (invoice_number) DO NOTHING;

-- 4. สร้างใบแจ้งหนี้ปกติ - ยังไม่เกิน
INSERT INTO invoices (
  tenant_id,
  invoice_number,
  amount,
  currency,
  status,
  subscription_plan,
  due_date,
  description,
  created_at
)
SELECT
  t.id,
  'INV-NORMAL-001',
  2990.00,
  'THB',
  'pending',
  'enterprise',
  CURRENT_DATE + INTERVAL '7 days', -- ยังไม่เกิน อีก 7 วัน
  'ใบแจ้งหนี้ปกติ - ยังไม่เกินกำหนด',
  NOW() - INTERVAL '23 days'
FROM tenants t
WHERE t.slug = 'auto-overdue-test'
ON CONFLICT (invoice_number) DO NOTHING;

-- 5. เช็คผลลัพธ์
SELECT
  invoice_number,
  amount,
  status,
  due_date,
  CURRENT_DATE as today,
  CASE
    WHEN due_date < CURRENT_DATE AND status = 'pending' THEN '🔴 ควรเป็น overdue'
    WHEN due_date < CURRENT_DATE AND status = 'overdue' THEN '✅ overdue ถูกต้อง'
    WHEN due_date >= CURRENT_DATE AND status = 'pending' THEN '⏳ pending ปกติ'
    ELSE '❓ สถานะอื่น'
  END as check_status,
  description
FROM invoices i
JOIN tenants t ON i.tenant_id = t.id
WHERE t.slug = 'auto-overdue-test'
ORDER BY due_date;

-- 6. หมายเหตุการทดสอบ
/*
หลังจากรันคำสั่งนี้:
1. ไปที่หน้า "จัดการใบแจ้งหนี้"
2. คลิกปุ่ม "เช็คเกินกำหนด"
3. ระบบจะอัพเดท INV-OVERDUE-001 และ INV-OVERDUE-002 เป็น "overdue"
4. จะมี toast notification แจ้งเตือน
5. ค่าปรับ 10% จะถูกคำนวณอัตโนมัติ

การลบข้อมูลทดสอบ:
DELETE FROM invoices WHERE invoice_number IN ('INV-OVERDUE-001', 'INV-OVERDUE-002', 'INV-NORMAL-001');
DELETE FROM tenants WHERE slug = 'auto-overdue-test';
*/