# Rule: UI & Data Standards

## Filter / Search — บังคับทุก list
- ✅ ทุก list/table ต้องมี filter + search — ห้าม dump ข้อมูลแบบ flat ไม่มีตัวกรอง
- ✅ Period filter ใส่เฉพาะเมื่อข้อมูลเปลี่ยนตาม period จริง — ห้ามใส่ filter ที่ไม่ส่งผลต่อข้อมูล
- ✅ Search bar ต้องทำงาน real-time (onChange, ไม่ต้องกด submit)

## Feature Completeness — end-to-end เสมอ
- ✅ feature ใหม่ต้องครบ: trigger → save → display → action
- ✅ ทุก field ที่แสดงใน Detail UI ต้องแก้ไขได้ใน Edit form
- ❌ ห้ามทำแค่ data-only (เก็บข้อมูลแต่ไม่แสดง) หรือ display-only (แสดงแต่แก้ไม่ได้)

## Badge / Status Label
- ✅ ใช้สีและ style เดียวกันทุกหน้า (อ้างอิง `OwnerTenantHealth.tsx` HEALTH_META / KK palette)
- ✅ Package badge = white bg + `#e11d48` text + `#fda4af` border (ทุกหน้า)
- Health status สี: healthy=green · at_risk=amber · dormant=red · churned=gray

## Money / Number Format
- ✅ ใช้ `formatTHB` / `fmtMRR` — Thai format: "X ล้าน" / "฿XK"
- ❌ ห้ามใช้ "M", "B", "Million" — ใช้ "ล้าน" เท่านั้น

## Drill-down Navigation
- ✅ ทุก Owner page ที่มีตารางให้กดเข้า detail ได้
- ✅ ปุ่ม "ดูรายละเอียด →" ต้อง navigate ไปหน้า/id ที่ถูกต้อง (ไม่ใช่แค่ list page)
- ✅ Drill order: แพลตฟอร์ม → บริษัท → โครงการ → ยูนิต → ลูกค้า

## Canonical Reference Files
- Typography + palette: `src/pages/OwnerDashboard.tsx`
- Health status: `src/pages/OwnerTenantHealth.tsx` (HEALTH_META + KK)
- Money formatter: `src/pages/Index.tsx` (formatTHB)
