# 📋 Migration Guide - Invoice Status Logging System

ไฟล์นี้รวบรวม Migration files ที่จำเป็นสำหรับให้ระบบ Invoice Status Logging ทำงานได้อย่างสมบูรณ์

## 🎯 สิ่งที่ได้หลังจากรัน Migrations

- ✅ ตาราง `invoice_status_logs` สำหรับเก็บประวัติการเปลี่ยนสถานะ
- ✅ Auto-logging trigger เมื่อ invoice status เปลี่ยน
- ✅ RLS Policies สำหรับ multi-tenant security
- ✅ Status Log Modal ใน UI ทำงานได้
- ✅ Auto overdue detection พร้อม logging
- ✅ Manual status change พร้อม logging

## 📁 Migration Files ที่ต้องรัน

### 1. **run-migrations.sql** (แนะนำ - All in One)
```sql
-- รันไฟล์นี้ทีละ section ใน Supabase SQL Editor
-- มี verification queries ในตัว
```

### 2. Individual Migration Files (ตัวเลือก)
```
supabase/migrations/
├── 20260422000001_create_invoice_status_logs.sql
├── 20260422000002_add_missing_columns.sql
└── 20260422000003_seed_test_data.sql (ทดสอบอย่างเดียว)
```

## 🚀 วิธีการติดตั้ง

### Method 1: ใช้ run-migrations.sql (ง่ายที่สุด)

1. **เปิด Supabase Dashboard**
   - ไป `SQL Editor`

2. **Copy & Paste ทีละ Section**
   ```sql
   -- SECTION 1: CREATE INVOICE STATUS LOGS TABLE
   -- (copy section 1 และรัน)
   
   -- SECTION 2: ADD MISSING COLUMNS
   -- (copy section 2 และรัน)
   
   -- SECTION 3: CREATE AUTO-TRIGGER
   -- (copy section 3 และรัน)
   ```

3. **รัน Verification Queries**
   ```sql
   -- ตรวจสอบว่าระบบพร้อมใช้งาน
   SELECT * FROM invoice_status_logs LIMIT 1;
   ```

### Method 2: ใช้ Supabase CLI

```bash
# Reset และรัน migrations
supabase db reset

# หรือรัน migration แต่ละไฟล์
supabase migration up
```

### Method 3: Manual Execution

รันไฟล์ตามลำดับ:
```
1. 20260422000001_create_invoice_status_logs.sql
2. 20260422000002_add_missing_columns.sql
3. 20260422000003_seed_test_data.sql (optional)
```

## 🧪 การทดสอบ

### 1. ทดสอบ Database
```sql
-- เช็คว่า table ถูกสร้าง
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'invoice_status_logs';

-- เช็ค RLS policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'invoice_status_logs';

-- เช็ค trigger
SELECT trigger_name FROM information_schema.triggers 
WHERE trigger_name = 'trigger_log_invoice_status_change';
```

### 2. ทดสอบ UI

1. **ไปหน้า "จัดการใบแจ้งหนี้"**
2. **คลิก ⋯ ข้างใบแจ้งหนี้**
3. **เลือก "ประวัติการเปลี่ยนสถานะ"** 📋
4. **เห็น Modal เปิดขึ้น** (ถ้าไม่มีข้อมูล จะแสดง "ยังไม่มีประวัติ")

### 3. ทดสอบ Manual Status Change

1. **เลือก "เปลี่ยนสถานะ"** จากเมนู
2. **เปลี่ยนสถานะ** (เช่น pending → paid)
3. **กลับไปดู "ประวัติการเปลี่ยนสถานะ"**
4. **เห็น log ใหม่ปรากฏ** ✨

### 4. ทดสอบ Auto Overdue Detection

1. **คลิกปุ่ม "เช็คเกินกำหนด"**
2. **ระบบจะอัพเดทบิลที่เกินกำหนด**
3. **เช็ค logs จะเห็น auto_overdue entries**

## 🔧 Troubleshooting

### ปัญหา 1: ScrollArea Error
```bash
Error: Failed to resolve import "@radix-ui/react-scroll-area"
```
**วิธีแก้:** ไฟล์ `src/ui/scroll-area.tsx` ได้ถูกแก้ไขแล้วให้ใช้ native CSS

### ปัญหา 2: RLS Policy Error
```sql
-- แก้ไข RLS policies ถ้ามีปัญหา
DROP POLICY IF EXISTS "Users can view logs for their tenant invoices" ON invoice_status_logs;
-- จากนั้นรัน migration ใหม่
```

### ปัญหา 3: Missing Columns
```sql
-- เช็คว่าคอลัมน์ที่จำเป็นมีหรือไม่
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'invoices' AND column_name IN ('tenant_id', 'invoice_number');
```

### ปัญหา 4: Trigger ไม่ทำงาน
```sql
-- เช็ค trigger function
SELECT proname FROM pg_proc WHERE proname = 'log_invoice_status_change';

-- ทดสอบ trigger
UPDATE invoices SET status = 'paid' WHERE id = 'some-uuid';
SELECT * FROM invoice_status_logs ORDER BY created_at DESC LIMIT 1;
```

## 📊 Database Schema

### invoice_status_logs Table
```sql
id              uuid PRIMARY KEY
invoice_id      uuid (FK to invoices)
tenant_id       uuid (FK to tenants)
old_status      varchar(20)
new_status      varchar(20)
changed_by      varchar(100) -- email or 'SYSTEM'
change_type     varchar(30)  -- 'manual', 'auto_overdue', etc.
reason          text
notes           text
payment_info    jsonb        -- เก็บข้อมูล payment
metadata        jsonb        -- browser, IP, etc.
created_at      timestamp with time zone
```

### Status Types
- `manual` - เปลี่ยนด้วยมือผ่าน UI
- `auto_overdue` - ระบบเปลี่ยนอัตโนมัติเมื่อเกินกำหนด  
- `auto_trigger` - Database trigger
- `payment` - เมื่อมีการชำระเงิน
- `system` - การเปลี่ยนแปลงจากระบบ

## 🎉 ผลลัพธ์ที่ได้

หลังจากรัน migrations สำเร็จ:

1. **🔄 Complete Audit Trail**
   - ทุกการเปลี่ยนสถานะถูกบันทึก
   - ทราบใคร เมื่อไหร่ ทำไม

2. **🤖 Auto Overdue Detection** 
   - ระบบเปลี่ยนสถานะอัตโนมัติ
   - บันทึก log ของการเปลี่ยนแปลง

3. **👤 Manual Status Changes**
   - UI เปลี่ยนสถานะพร้อม Modal
   - บันทึก payment info, notes

4. **📋 Status Log Modal**
   - แสดงประวัติครบถ้วน 
   - เรียงตามเวลา พร้อม icons

5. **🔒 Multi-tenant Security**
   - RLS policies ปลอดภัย
   - แยกข้อมูลตาม tenant

## 📞 ติดต่อ

หากมีปัญหาในการติดตั้ง:
1. เช็ค console errors ใน browser
2. เช็ค Supabase logs
3. ลองรัน verification queries

**ระบบพร้อมใช้งานแล้ว!** 🚀