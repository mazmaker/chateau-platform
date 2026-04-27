-- สร้างตาราง invoice_status_logs สำหรับเก็บประวัติการเปลี่ยนสถานะ
-- รันใน Supabase SQL Editor

-- 1. สร้างตาราง invoice_status_logs
CREATE TABLE IF NOT EXISTS invoice_status_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),

    -- Status information
    old_status varchar(20) NOT NULL,
    new_status varchar(20) NOT NULL,

    -- Change details
    changed_by varchar(50) NOT NULL, -- 'SYSTEM', 'USER', email, user_id
    change_type varchar(20) NOT NULL DEFAULT 'manual', -- 'manual', 'auto_overdue', 'payment', etc.
    reason text,
    notes text,

    -- Additional metadata
    payment_info jsonb, -- เก็บข้อมูล payment เมื่อเปลี่ยนเป็น paid
    metadata jsonb DEFAULT '{}', -- เก็บข้อมูลเพิ่มเติม

    -- Timestamps
    created_at timestamp with time zone DEFAULT NOW(),

    -- Indexes
    CONSTRAINT valid_status CHECK (
        old_status IN ('pending', 'paid', 'overdue', 'cancelled') AND
        new_status IN ('pending', 'paid', 'overdue', 'cancelled')
    )
);

-- 2. สร้าง indexes
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_invoice_id ON invoice_status_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_tenant_id ON invoice_status_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_created_at ON invoice_status_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_change_type ON invoice_status_logs(change_type);

-- 3. Enable RLS
ALTER TABLE invoice_status_logs ENABLE ROW LEVEL SECURITY;

-- 4. สร้าง RLS Policies
CREATE POLICY "Users can view logs for their tenant invoices" ON invoice_status_logs
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

CREATE POLICY "Users can insert logs for their tenant invoices" ON invoice_status_logs
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 5. สร้าง function สำหรับ auto-logging เมื่อ invoice status เปลี่ยน
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- ถ้าสถานะเปลี่ยน ให้บันทึก log
    IF OLD.status != NEW.status THEN
        INSERT INTO invoice_status_logs (
            invoice_id,
            tenant_id,
            old_status,
            new_status,
            changed_by,
            change_type,
            reason,
            created_at
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            OLD.status,
            NEW.status,
            'TRIGGER', -- จะเปลี่ยนเป็น USER/SYSTEM ใน application
            'auto_trigger',
            'Automatic log from database trigger',
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. สร้าง trigger
DROP TRIGGER IF EXISTS trigger_log_invoice_status_change ON invoices;
CREATE TRIGGER trigger_log_invoice_status_change
    AFTER UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- 7. สร้างข้อมูลทดสอบ (ถ้าต้องการ)
/*
INSERT INTO invoice_status_logs (
    invoice_id,
    tenant_id,
    old_status,
    new_status,
    changed_by,
    change_type,
    reason,
    notes,
    created_at
)
SELECT
    i.id,
    i.tenant_id,
    'pending',
    'paid',
    'test@example.com',
    'manual',
    'Payment received',
    'Test manual payment log',
    NOW() - INTERVAL '2 hours'
FROM invoices i
WHERE i.status = 'paid'
LIMIT 3;
*/

-- 8. Query ทดสอบ
SELECT
    l.*,
    i.invoice_number,
    i.amount,
    t.name as tenant_name
FROM invoice_status_logs l
JOIN invoices i ON l.invoice_id = i.id
JOIN tenants t ON l.tenant_id = t.id
ORDER BY l.created_at DESC
LIMIT 10;