# Rule: Workflow & Collaboration Rules

## สิ่งที่ห้ามทำโดยไม่ขอ
- ❌ `git commit` / `git push` — ผู้ใช้ batch commit เอง
- ❌ apply migration — propose ก่อน รอ approve เสมอ
- ❌ แก้ไขข้อมูล production โดยไม่บอก

## ก่อนทำงาน DB
- ✅ `list_tables` / `execute_sql` เช็ค schema จริงก่อนเสนอ migration
- ✅ อย่าเชื่อ local files เพียงอย่างเดียว — DB drift เกิดขึ้นได้

## วิธีเสนองาน
- ✅ เสนอ solution พร้อมเหตุผล อย่าถามว่า "เฮียจะเอาอะไร"
- ✅ วิเคราะห์ก่อนทำ — ถ้าผู้ใช้บอก "ทำเลย" ค่อยลงมือ
- ✅ ถ้ายังไม่แน่ใจ อธิบายทางเลือกสั้นๆ และ recommend หนึ่งทาง

## Multi-tenant / RLS
- ✅ Owner ต้องเห็น cross-tenant ได้ทุก table ใหม่
- ✅ ทุก table ใหม่ต้องมี RLS policy สำหรับ Owner
- ❌ ห้ามผสม tenant data

## การเพิ่ม Rule ใหม่
เมื่อผู้ใช้บอกกฎใหม่ ให้ทำทั้ง 3 อย่าง:
1. เพิ่มใน `CLAUDE.md` (สรุปสั้น — auto-loaded ทุก session)
2. เพิ่มหรือสร้างไฟล์ใน `.claude/rules/` (รายละเอียดครบ)
3. เพิ่มใน memory ที่ `~/.claude/projects/.../memory/` ถ้าเกี่ยวกับ preference ผู้ใช้
