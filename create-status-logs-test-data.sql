-- สร้างข้อมูลทดสอบสำหรับ Status Logs
-- รันใน Supabase SQL Editor หลังจากรัน create-invoice-status-logs-table.sql

-- 1. สร้าง sample logs สำหรับใบแจ้งหนี้ที่มีอยู่
INSERT INTO invoice_status_logs (
    invoice_id,
    tenant_id,
    old_status,
    new_status,
    changed_by,
    change_type,
    reason,
    notes,
    payment_info,
    metadata,
    created_at
)
SELECT
    i.id,
    i.tenant_id,
    'pending',
    'paid',
    'john.doe@example.com',
    'manual',
    'การชำระเงิน',
    'ลูกค้าชำระผ่านโอนเงิน',
    '{"method": "bank_transfer", "reference": "TXN123456", "amount": 1490, "date": "2026-04-20"}'::jsonb,
    '{"browser": "Chrome/xxx", "timestamp": "2026-04-20T10:30:00Z"}'::jsonb,
    NOW() - INTERVAL '2 hours'
FROM invoices i
WHERE i.status = 'paid'
LIMIT 1;

-- 2. สร้าง auto overdue log
INSERT INTO invoice_status_logs (
    invoice_id,
    tenant_id,
    old_status,
    new_status,
    changed_by,
    change_type,
    reason,
    notes,
    metadata,
    created_at
)
SELECT
    i.id,
    i.tenant_id,
    'pending',
    'overdue',
    'SYSTEM',
    'auto_overdue',
    'ระบบตรวจพบใบแจ้งหนี้เกินกำหนดชำระ',
    'อัตโนมัติเปลี่ยนสถานะเป็นเกินกำหนด (เกิน 3 วัน)',
    '{"due_date": "2026-04-18", "auto_check_time": "2026-04-21T08:00:00Z", "days_overdue": 3}'::jsonb,
    NOW() - INTERVAL '1 hour'
FROM invoices i
WHERE i.status = 'overdue'
LIMIT 1;

-- 3. สร้าง cancellation log
INSERT INTO invoice_status_logs (
    invoice_id,
    tenant_id,
    old_status,
    new_status,
    changed_by,
    change_type,
    reason,
    notes,
    metadata,
    created_at
)
SELECT
    i.id,
    i.tenant_id,
    'pending',
    'cancelled',
    'admin@chateau.com',
    'manual',
    'ลูกค้าขอยกเลิกบริการ',
    'ลูกค้าติดต่อขอยกเลิก เนื่องจากไม่ต้องการใช้บริการต่อ',
    '{"browser": "Safari/xxx", "timestamp": "2026-04-19T14:20:00Z"}'::jsonb,
    NOW() - INTERVAL '1 day'
FROM invoices i
WHERE i.status = 'cancelled'
LIMIT 1;

-- 4. สร้าง multiple logs สำหรับใบแจ้งหนี้ที่มีประวัติหลายครั้ง
DO $$
DECLARE
    test_invoice_id uuid;
    test_tenant_id uuid;
BEGIN
    -- หา invoice ที่จะสร้าง multiple logs
    SELECT id, tenant_id INTO test_invoice_id, test_tenant_id
    FROM invoices
    WHERE status = 'paid'
    LIMIT 1;

    IF test_invoice_id IS NOT NULL THEN
        -- Log 1: สร้างใบแจ้งหนี้
        INSERT INTO invoice_status_logs (
            invoice_id, tenant_id, old_status, new_status,
            changed_by, change_type, reason, notes, created_at
        ) VALUES (
            test_invoice_id, test_tenant_id, '', 'pending',
            'SYSTEM', 'system', 'สร้างใบแจ้งหนี้ใหม่',
            'ระบบสร้างใบแจ้งหนี้อัตโนมัติ',
            NOW() - INTERVAL '5 days'
        );

        -- Log 2: เปลี่ยนเป็น overdue
        INSERT INTO invoice_status_logs (
            invoice_id, tenant_id, old_status, new_status,
            changed_by, change_type, reason, notes, created_at
        ) VALUES (
            test_invoice_id, test_tenant_id, 'pending', 'overdue',
            'SYSTEM', 'auto_overdue', 'ระบบตรวจพบใบแจ้งหนี้เกินกำหนดชำระ',
            'อัตโนมัติเปลี่ยนสถานะเป็นเกินกำหนด (เกิน 1 วัน)',
            NOW() - INTERVAL '2 days'
        );

        -- Log 3: ลูกค้าชำระเงิน
        INSERT INTO invoice_status_logs (
            invoice_id, tenant_id, old_status, new_status,
            changed_by, change_type, reason, notes,
            payment_info, created_at
        ) VALUES (
            test_invoice_id, test_tenant_id, 'overdue', 'paid',
            'customer@example.com', 'manual', 'การชำระเงิน',
            'ลูกค้าชำระหนี้ค้างชำระพร้อมค่าปรับ',
            '{"method": "credit_card", "reference": "CC789012", "amount": 1639, "date": "2026-04-21"}'::jsonb,
            NOW() - INTERVAL '30 minutes'
        );
    END IF;
END $$;

-- 5. เช็คผลลัพธ์
SELECT
    l.created_at,
    i.invoice_number,
    l.old_status,
    l.new_status,
    l.changed_by,
    l.change_type,
    l.reason,
    t.name as tenant_name
FROM invoice_status_logs l
JOIN invoices i ON l.invoice_id = i.id
JOIN tenants t ON l.tenant_id = t.id
ORDER BY l.created_at DESC
LIMIT 10;

-- 6. สถิติ logs
SELECT
    change_type,
    COUNT(*) as log_count
FROM invoice_status_logs
GROUP BY change_type
ORDER BY log_count DESC;

-- 7. หมายเหตุ
/*
หลังจากรันข้อมูลทดสอบ:
1. ไปหน้า "จัดการใบแจ้งหนี้"
2. คลิก ⋯ ข้างใบแจ้งหนี้ใดๆ
3. เลือก "ประวัติการเปลี่ยนสถานะ"
4. จะเห็น modal แสดง logs ทั้งแบบ manual และ auto
5. ข้อมูลจะแสดงเรียงตามเวลา (ล่าสุดก่อน)

ลบข้อมูลทดสอบ:
DELETE FROM invoice_status_logs WHERE changed_by LIKE '%example.com%';
*/