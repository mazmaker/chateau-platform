-- ==========================================
-- QUICK SETUP - รันไฟล์นี้ครั้งเดียวพอ
-- ==========================================
-- Copy ทั้งไฟล์นี้ไปรันใน Supabase SQL Editor

-- Step 1: สร้าง invoice_status_logs table
CREATE TABLE IF NOT EXISTS invoice_status_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),
    old_status varchar(20) NOT NULL,
    new_status varchar(20) NOT NULL,
    changed_by varchar(100) NOT NULL,
    change_type varchar(30) NOT NULL DEFAULT 'manual',
    reason text,
    notes text,
    payment_info jsonb,
    metadata jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT NOW(),

    CONSTRAINT valid_old_status CHECK (old_status IN ('pending', 'paid', 'overdue', 'cancelled', '')),
    CONSTRAINT valid_new_status CHECK (new_status IN ('pending', 'paid', 'overdue', 'cancelled')),
    CONSTRAINT valid_change_type CHECK (change_type IN ('manual', 'auto_overdue', 'auto_trigger', 'payment', 'system'))
);

-- Step 2: สร้าง indexes
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_invoice_id ON invoice_status_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_tenant_id ON invoice_status_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_created_at ON invoice_status_logs(created_at DESC);

-- Step 3: เปิด RLS
ALTER TABLE invoice_status_logs ENABLE ROW LEVEL SECURITY;

-- Step 4: สร้าง RLS Policies
CREATE POLICY "Users can view logs for their tenant invoices" ON invoice_status_logs
FOR SELECT USING (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert logs for their tenant invoices" ON invoice_status_logs
FOR INSERT WITH CHECK (
    tenant_id IN (SELECT tenant_id FROM profiles WHERE user_id = auth.uid())
);

CREATE POLICY "System can insert logs" ON invoice_status_logs
FOR INSERT WITH CHECK (changed_by IN ('SYSTEM', 'TRIGGER', 'AUTO_OVERDUE'));

-- Step 5: เพิ่มคอลัมน์ที่อาจขาดหาย
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS email varchar(255);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS billing_email varchar(255);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_number varchar(50);
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'THB';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_settings jsonb DEFAULT '{}';

-- Step 6: สร้าง Auto-trigger Function
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_status_logs (
            invoice_id, tenant_id, old_status, new_status,
            changed_by, change_type, reason, created_at
        ) VALUES (
            NEW.id, NEW.tenant_id, COALESCE(OLD.status, ''), NEW.status,
            'TRIGGER', 'auto_trigger', 'Automatic log from database trigger', NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 7: สร้าง Trigger
DROP TRIGGER IF EXISTS trigger_log_invoice_status_change ON invoices;
CREATE TRIGGER trigger_log_invoice_status_change
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- Step 8: ทดสอบระบบ (optional sample data)
INSERT INTO tenants (name, slug, email, billing_email, subscription_plan, status)
VALUES ('Test Company', 'test-company-logs', 'test@company.com', 'billing@company.com', 'professional', 'active')
ON CONFLICT (slug) DO NOTHING;

-- สร้าง sample invoice
INSERT INTO invoices (
    tenant_id, invoice_number, amount, currency, status, subscription_plan,
    due_date, description, created_at, updated_at
)
SELECT
    t.id, 'INV-TEST-001', 1490.00, 'THB', 'pending', 'professional',
    CURRENT_DATE + INTERVAL '7 days', 'Test invoice for logging system',
    NOW(), NOW()
FROM tenants t
WHERE t.slug = 'test-company-logs'
ON CONFLICT (invoice_number) DO NOTHING;

-- ตรวจสอบผลลัพธ์
SELECT
    'invoice_status_logs' as table_name,
    COUNT(*) as row_count,
    'Table created successfully' as status
FROM invoice_status_logs
UNION ALL
SELECT
    'sample_invoice' as table_name,
    COUNT(*) as row_count,
    'Sample data created' as status
FROM invoices WHERE invoice_number = 'INV-TEST-001';

-- แสดงข้อความสำเร็จ
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ===== SETUP ✅ COMPLETE =====';
    RAISE NOTICE '✅ invoice_status_logs table created';
    RAISE NOTICE '✅ RLS policies applied';
    RAISE NOTICE '✅ Auto-logging trigger active';
    RAISE NOTICE '✅ Sample data created';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next: ไปทดสอบใน UI';
    RAISE NOTICE '1. หน้า "จัดการใบแจ้งหนี้"';
    RAISE NOTICE '2. คลิก ⋯ → "ประวัติการเปลี่ยนสถานะ"';
    RAISE NOTICE '3. ลอง "เปลี่ยนสถานะ"';
    RAISE NOTICE '============================';
END $$;