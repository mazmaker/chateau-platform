# Rule: Owner Role = SaaS Platform Owner Perspective

## บทบาทของ Owner
`owner` = เราเอง (ผู้สร้างและขายแพลตฟอร์ม Chateau) ไม่ใช่บริษัทอสังหา
- Tenant = บริษัทอสังหา (ลูกค้าของเรา)
- Admin / Sales / Agent = พนักงานของ tenant

## คำถามที่ต้องถามตัวเองก่อนทำทุก Owner page

> "เจ้าของ SaaS จะใช้ข้อมูลนี้ทำอะไร? มันตอบโจทย์ MRR / churn / retention / upsell ไหม?"

## กฎเฉพาะ Owner

1. **ข้อมูล technical** (slug, UUID, internal ID) ไม่โชว์ในตารางหลัก — ซ่อนไว้ใน detail/settings
2. **KPI ที่ซ้ำ** กับหน้าอื่นไม่ควรโชว์ เว้นแต่ granularity ต่างกัน (เช่น MRR รวม vs MRR ต่อ tenant)
3. **Health card** ต้องตอบ "เสี่ยงสูญเงินเท่าไร" ไม่ใช่แค่ "มีกี่บริษัท"
4. **Drill-down** ทุกที่: แพลตฟอร์ม → บริษัท → โครงการ → ยูนิต → ลูกค้า (read-only ฝั่ง Owner)
5. **Label** ใช้ "เจ้าของแพลตฟอร์ม" ไม่ใช่ "เจ้าของบริษัท"

## Metrics ที่ Owner สนใจ
- MRR / ARR / YTD Revenue
- Churn rate / At-risk tenants
- Trial conversion (Trial → Active)
- Health score ต่อ tenant
- Revenue at risk (at-risk tenants × MRR)
- Customer lifetime value

## สิ่งที่ Owner ไม่สนใจ
- รายละเอียด operation ของ tenant (Admin ดูแลเอง)
- ข้อมูล PII ลูกค้ารายคน (PDPA — เห็นได้แค่ aggregate)
