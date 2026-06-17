# /ui-audit — UI Consistency Audit & Auto-fix

## วัตถุประสงค์
ตรวจสอบและแก้ไข UI inconsistencies ในไฟล์ที่ระบุ (หรือทุก Owner pages) ตามกฎที่กำหนดใน `.claude/rules/`

## วิธีใช้
```
/ui-audit                    # ตรวจทุก Owner pages
/ui-audit src/pages/OwnerTenantHealth.tsx   # ตรวจไฟล์เดียว
```

## สิ่งที่ตรวจสอบ

### 1. Typography (01-typography.md)
- หา `text-[Xpx]` arbitrary sizes → แก้เป็น standard scale
- ยกเว้น: chart axis ใน components ที่ space จำกัด

### 2. Badge / Status Colors
- Package badge: white bg + `#e11d48` text + `#fda4af` border
- Health badges: อ้างอิง HEALTH_META ใน OwnerTenantHealth.tsx
- ห้ามใช้ Tailwind color classes ที่ override ไม่ได้ (ให้ใช้ inline style แทน)

### 3. Filter / Search
- ทุก table/list ต้องมี search input + อย่างน้อย 1 filter dropdown
- Search ต้อง real-time (onChange) ไม่ใช่ onSubmit

### 4. Money Format
- ห้ามใช้ "M", "B" — ใช้ "ล้าน", "K" เท่านั้น
- grep หา `formatTHB` / `fmtMRR` ให้ใช้ตัวที่มีอยู่แล้ว

### 5. Navigation Buttons
- ปุ่ม "ดูรายละเอียด →" ต้อง navigate ไป `/route/:id` ไม่ใช่แค่ `/route`

## Output
รายงาน violations ที่พบ พร้อม fix ทันทีหลังจากได้รับ confirmation
