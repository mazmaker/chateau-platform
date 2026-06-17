# /owner-review — SaaS Owner Perspective Analysis

## วัตถุประสงค์
วิเคราะห์หน้า Owner จากมุมมอง **เจ้าของแพลตฟอร์ม SaaS อสังหาฯ** ก่อนลงมือ implement
ใช้ก่อนทำ feature ใหม่ หรือก่อน present หน้าให้เฮีย

## วิธีใช้
```
/owner-review OwnerTenantHealth    # review หน้าที่ระบุ
/owner-review                      # review หน้าที่กำลังทำงานอยู่
```

## Checklist ที่ต้องผ่าน

### A. KPI Cards ตอบโจทย์ SaaS ไหม?
- [ ] แต่ละ card ตอบคำถาม "MRR / churn / retention / upsell" ได้?
- [ ] มี card ที่บอก "เสี่ยงสูญเงินเท่าไร"?
- [ ] ไม่ซ้ำกับ KPI ในหน้าอื่น (เว้นแต่ต่าง granularity)?

### B. ตาราง/List มีคุณค่าไหม?
- [ ] มี filter + search?
- [ ] sort order สมเหตุสมผล (เสี่ยงสุดขึ้นก่อน)?
- [ ] ปุ่ม action นำไปหน้าที่ถูกต้อง (drill-down)?
- [ ] ไม่โชว์ข้อมูล technical (slug, UUID) ในตารางหลัก?

### C. Drill-down ครบไหม?
- [ ] กดเข้า detail ได้?
- [ ] detail แสดงข้อมูลเพิ่มเติมจาก list?

### D. Period Filter ถูกที่ไหม?
- [ ] data เปลี่ยนตาม period จริงไหม? ถ้าไม่ → ตัดออก

### E. Badge/Status Consistent?
- [ ] สีตรงกับ HEALTH_META / KK palette?
- [ ] style เดียวกับหน้าอื่น?

## Output Format
```
✅ ผ่าน: [รายการ]
❌ ต้องแก้: [รายการ + เหตุผล SaaS]
💡 แนะนำเพิ่ม: [รายการ + เหตุผล]
```
