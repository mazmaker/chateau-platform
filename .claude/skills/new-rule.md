# /new-rule — Add New Project Rule

## วัตถุประสงค์
เมื่อผู้ใช้กำหนดกฎใหม่ ให้บันทึกทั้ง 3 ที่พร้อมกัน เพื่อให้ทุก session จำได้

## วิธีใช้
```
/new-rule "ห้ามใช้สีแดงสำหรับ success state"
/new-rule  # แล้ว Claude จะถามรายละเอียด
```

## ขั้นตอนที่ต้องทำ

### 1. เพิ่มสรุปใน CLAUDE.md
หาหมวดที่เหมาะสม (Typography / Owner Role / UI Data Rules / Critical rules)
เพิ่มเป็น bullet point สั้นๆ ≤ 2 บรรทัด

### 2. สร้างหรืออัปเดต .claude/rules/XX-name.md
- ถ้ากฎใหม่ → สร้างไฟล์ใหม่ พร้อม numbering ต่อจากเดิม
- ถ้าเกี่ยวกับกฎเดิม → เพิ่มใน section ของไฟล์นั้น
- Format: # Rule Title · ## กฎหลัก · ## ตัวอย่าง · ## ข้อยกเว้น

### 3. อัปเดต Rules Index ใน CLAUDE.md
เพิ่มแถวในตาราง Rules Index ถ้าสร้างไฟล์ใหม่

### 4. เพิ่ม memory (ถ้าเกี่ยวกับ preference ผู้ใช้)
บันทึกใน `~/.claude/projects/.../memory/feedback_XXX.md`

## ตัวอย่าง output
```
✅ เพิ่มใน CLAUDE.md § UI Data Rules
✅ สร้าง .claude/rules/05-color-usage.md
✅ อัปเดต Rules Index
```
