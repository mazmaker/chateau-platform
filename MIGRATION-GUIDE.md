# 🚀 CHATEAU Platform - Complete Migration Guide

## 📋 สิ่งที่จะได้หลังจากรัน Migration นี้:

✅ **ตารางครบถ้วน 12 ตาราง:**
- `tenants` - ข้อมูลบริษัทลูกค้า
- `profiles` - ข้อมูลผู้ใช้
- `properties` - ข้อมูลอสังหาริมทรัพย์
- `bookings` - การจอง
- `invoices` - ใบแจ้งหนี้ (สำหรับ Auto Billing)
- `payments` - การชำระเงิน
- `activity_logs` - บันทึกกิจกรรม
- `error_logs` - บันทึกข้อผิดพลาด
- `leads` - ลูกค้าเป้าหมาย
- `campaigns` - แคมเปญการตลาด
- `units` - ห้อง/ยูนิต
- `company_settings` - ตั้งค่าบริษัท

✅ **ระบบความปลอดภัย RLS**
✅ **Indexes สำหรับประสิทธิภาพ**
✅ **Functions และ Triggers**
✅ **ข้อมูลทดสอบ**

---

## 🎯 วิธีรัน Migration:

### **STEP 1: Backup ข้อมูลเดิม (แนะนำ)**
1. เข้า [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือกโปรเจค CHATEAU Platform
3. ไป **Settings** → **Database** 
4. กด **Backup** เพื่อสำรองข้อมูล

### **STEP 2: รัน Complete Migration**
1. ไป **SQL Editor** ใน Supabase Dashboard
2. เปิดไฟล์ `run-all-migrations.sql`
3. **Copy ทั้งหมด** (Ctrl+A, Ctrl+C)
4. **Paste ใน SQL Editor** และกด **RUN**

⏱️ **ใช้เวลา:** ประมาณ 30-60 วินาที

### **STEP 3: ตรวจสอบผลลัพธ์**
1. รันไฟล์ `verify-database.sql` ใน SQL Editor
2. ตรวจสอบผลลัพธ์:
   - ✅ Tables: 12/12
   - ✅ RLS Policies: มากกว่า 0
   - ✅ Functions: 3/3

### **STEP 4: ทดสอบระบบ**
1. **รีเฟรชเว็บ** (F5)
2. **ลองใช้ Auto Billing** ใน Payment Dashboard
3. **ตรวจสอบ Console** ไม่มี 404/400 errors

---

## 🔧 หากมีปัญหา:

### **ปัญหา: "relation already exists"**
```sql
-- รันคำสั่งนี้ก่อนแล้วรัน migration ใหม่
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
```

### **ปัญหา: "permission denied"**
- ตรวจสอบว่าเข้าใช้ด้วย Database Owner
- หรือติดต่อ Supabase Support

### **ปัญหา: "timeout"**
- แบ่งรัน migration เป็นหลายส่วน
- รัน STEP 1-5 ก่อน จากนั้นรัน STEP 6-11

---

## 📊 สถิติ Migration:

| Component | จำนวน | รายละเอียด |
|-----------|--------|------------|
| **Tables** | 12 | Core business tables |
| **Indexes** | 20+ | Performance optimization |
| **RLS Policies** | 24+ | Security rules |
| **Functions** | 3 | Business logic |
| **Triggers** | 5 | Auto-update timestamps |
| **Extensions** | 3 | UUID, Crypto, CiText |

---

## ⚡ Quick Commands:

```bash
# เปิด Supabase Dashboard
open https://supabase.com/dashboard

# ตรวจสอบไฟล์ migration
ls -la *.sql

# ดู migration status
cat MIGRATION-GUIDE.md
```

---

## 🎉 หลังรัน Migration เสร็จ:

1. **Auto Billing** จะใช้งานได้ 100%
2. **Dashboard** จะแสดงข้อมูลจริง
3. **User Management** จะครบถ้วน
4. **Activity Logs** จะบันทึกทุกการกระทำ
5. **Error Handling** จะดีขึ้น

---

## 📞 Support:

หากมีปัญหาหรือข้อสงสัย:
1. ตรวจสอบไฟล์ `verify-database.sql` ก่อน
2. ดู Console errors
3. ส่งข้อผิดพลาดมาให้ช่วยแก้ไข

**Good Luck! 🚀**