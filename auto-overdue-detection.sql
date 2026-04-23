-- Auto Overdue Detection System
-- สำหรับ Supabase Edge Function หรือ Database Function

-- 1. สร้าง function สำหรับ auto-update overdue status
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  -- Update invoices ที่เกินกำหนดเป็น overdue
  UPDATE invoices
  SET
    status = 'overdue',
    updated_at = NOW(),
    -- เพิ่ม metadata ว่า auto-updated
    description = COALESCE(description, '') ||
                  CASE
                    WHEN description IS NULL OR description = '' THEN 'Auto-updated to overdue'
                    ELSE ' (Auto-updated to overdue)'
                  END
  WHERE
    status = 'pending'
    AND due_date < CURRENT_DATE
    AND due_date >= CURRENT_DATE - INTERVAL '30 days'; -- Safety limit: ไม่เกิน 30 วัน

  -- Log การเปลี่ยนแปลง (ถ้ามี audit table)
  INSERT INTO invoice_status_logs (
    invoice_id,
    old_status,
    new_status,
    changed_by,
    changed_at,
    reason
  )
  SELECT
    id,
    'pending',
    'overdue',
    'SYSTEM',
    NOW(),
    'Auto-updated: exceeded due date'
  FROM invoices
  WHERE status = 'overdue'
    AND updated_at >= NOW() - INTERVAL '1 minute'; -- เฉพาะที่เพิ่งอัพเดท

END;
$$ LANGUAGE plpgsql;

-- 2. สร้าง scheduled job (ทำงานทุกวันเวลา 08:00 น.)
-- ใน Supabase Dashboard > Database > Cron Jobs
-- SELECT cron.schedule('update-overdue-invoices', '0 8 * * *', 'SELECT update_overdue_invoices();');

-- 3. ทดสอบ function
-- SELECT update_overdue_invoices();

-- 4. เช็คผลลัพธ์
SELECT
  invoice_number,
  due_date,
  status,
  updated_at,
  CASE
    WHEN due_date < CURRENT_DATE AND status = 'pending' THEN 'Should be overdue'
    WHEN due_date < CURRENT_DATE AND status = 'overdue' THEN 'Correctly overdue'
    ELSE 'OK'
  END as check_result
FROM invoices
WHERE status IN ('pending', 'overdue')
ORDER BY due_date DESC;