# แผนขั้นตอนถัดไป — CHATEAU Platform

**วันที่:** 5 พฤษภาคม 2569

---

## คำถามหลัก: ควรทำ UI ใหม่ก่อน หรือ แยก Monorepo ก่อน?

---

## การวิเคราะห์

### ถ้าแยก Monorepo ก่อน แล้วค่อยทำ UI ใหม่

```
Monorepo → UI Redesign
```

**ปัญหาที่จะเกิด:**

- ต้องย้าย component เก่าเข้า `packages/ui` ก่อน
- พอออกแบบ UI ใหม่ → component เปลี่ยน → ต้องแก้ `packages/ui` ซ้ำอีกรอบ
- **ทำงานซ้ำ 2 รอบ** — ย้ายโค้ดเก่า แล้วเขียนใหม่ทับ

---

### ถ้าทำ UI ใหม่ก่อน แล้วค่อยแยก Monorepo

```
UI Redesign → Monorepo
```

**ข้อดี:**

- Component ที่ย้ายเข้า `packages/ui` เป็น version สุดท้าย ไม่ต้องแก้ซ้ำ
- โครงสร้าง package สะท้อนดีไซน์จริง
- ทำงานครั้งเดียว ได้ผลถาวร

**ข้อเสีย:**

- ทีมยังคง merge code ชนกันบน branch เดียวระหว่าง redesign

---

## คำแนะนำ: ทำ UI ใหม่ก่อน ✓

> **เหตุผลหลัก:** component ที่จะย้ายเข้า `packages/ui` ควรเป็น version สุดท้าย  
> ถ้าย้ายโค้ดเก่าก่อน แล้วมาแก้ UI ทีหลัง = ทำงานซ้ำ 2 รอบโดยไม่จำเป็น

---

## แผนลำดับขั้นตอนที่แนะนำ

```
ขั้นที่ 1  →  ขั้นที่ 2  →  ขั้นที่ 3  →  ขั้นที่ 4
UI Design     UI Build      Monorepo      Deploy
(ออกแบบ)     (พัฒนา)       (แยก repo)    (ปล่อย)
```

---

### ขั้นที่ 1 — ออกแบบ UI ใหม่ (Design Phase)

**ทำอะไร:**
- ออกแบบ Design System กลาง (สี, font, spacing, component style)
- ออกแบบหน้าของแต่ละ role แยกกัน
  - Owner Portal UI
  - Admin Portal UI
  - Sales Portal UI
  - Customer Portal UI (ใหม่)
- ทำ Figma / prototype ให้อนุมัติก่อนลงมือโค้ด

**Output:** Figma file หรือ Style Guide ที่ approved แล้ว

---

### ขั้นที่ 2 — พัฒนา UI ใหม่ (Build Phase)

**ทำอะไร:**
- สร้าง Design System ใน `src/` ที่มีอยู่ก่อน (ยังไม่แยก repo)
- เขียน component ใหม่ให้ครบ
- ทดสอบทุก role บน branch เดิม

**ทำไมยังไม่แยก repo:**
- แก้ไขเร็วกว่า — ไม่ต้อง build หลาย package
- ทดสอบง่ายกว่า — app เดียว
- ถ้ามี bug แก้ที่เดียวจบ

---

### ขั้นที่ 3 — แยก Monorepo (Restructure Phase)

**ทำอะไร:**
- ตั้ง Turborepo + pnpm workspaces
- ย้าย component ที่ออกแบบใหม่แล้วเข้า `packages/ui`
- แยก `apps/owner`, `apps/admin`, `apps/sales`, `apps/customer`
- ตั้ง Vercel project ใหม่แต่ละ app

**ทำได้เลยเพราะ:** UI นิ่งแล้ว ย้ายครั้งเดียวจบ ไม่ต้องแก้ซ้ำ

---

### ขั้นที่ 4 — Deploy & Monitor

**ทำอะไร:**
- Deploy แต่ละ app บน domain แยก
- ตั้ง CI/CD (GitHub Actions)
- Monitor และแก้ bug หลัง launch

---

## สรุปตารางเวลาโดยประมาณ

| ขั้นตอน | งาน | เวลาโดยประมาณ |
|--------|-----|--------------|
| **1. UI Design** | ออกแบบ Design System + ทุก role | 1–2 สัปดาห์ |
| **2. UI Build** | เขียน component + pages ใหม่ | 2–4 สัปดาห์ |
| **3. Monorepo** | แยก repo + migrate | 1 สัปดาห์ |
| **4. Deploy** | ตั้ง domain + CI/CD | 2–3 วัน |

---

## สิ่งที่ต้องตัดสินใจก่อนเริ่ม UI

1. **Design Tool** — ใช้ Figma หรือออกแบบตรงใน code?
2. **Component Library** — ใช้ shadcn/ui เหมือนเดิม หรือเปลี่ยน?
3. **Design System** — ใช้ gold/luxury theme เดิม หรือเปลี่ยน?
4. **Customer Portal** — ต้องการ feature อะไรบ้าง?

---

## เอกสารที่เกี่ยวข้อง

| เอกสาร | เนื้อหา |
|--------|--------|
| [monorepo-design-report.md](./monorepo-design-report.md) | ภาพรวม Monorepo พร้อม tooling |
| [monorepo-by-role-design.md](./monorepo-by-role-design.md) | ออกแบบแยกตาม Role ละเอียด |
| [next-steps-plan.md](./next-steps-plan.md) | แผนขั้นตอน (ไฟล์นี้) |
