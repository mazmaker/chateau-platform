# PROPERTY HUB × Chateau Platform — Integration Summary

> **Status**: Analysis & Design (ยังไม่ได้แตะ code)
> **Last Updated**: 2026-05-08
> **Source of truth**: Canva spec deck + Live demo (https://propertyhub-platform.vercel.app)
> **Scope**: ฟังก์ชันที่ต้องเพิ่มเข้าไปในเว็บ Chateau จาก PROPERTY HUB

---

## 🎭 4 Roles ที่จะมีในอนาคต

| Role | คือใคร | งานหลัก |
|---|---|---|
| **Owner** | Platform Owner — เจ้าของ SaaS ที่ให้ tenant แต่ละบริษัทมาใช้งาน | บริหาร platform: onboard tenant, billing, ภาพรวมข้าม tenant, support |
| **Admin** | เจ้าของโครงการ / Tenant Admin | บริหารบริษัท/โครงการของตน + จัดการ sales ใน tenant |
| **Sales** | เซลล์ / "Agent" ใน Canva | ขายลูกค้าหน้างาน: ดู Property + ส่งข้อมูลให้ลูกค้า |
| **Customer** | ลูกค้า — future role | ดูข้อมูลที่สนใจ + ติดตามสถานะของตน *(ยังไม่ scope)* |

> **Pattern ของ Chateau**: ทุก role เข้า routes เดียวกัน (`/projects`, `/properties`, ...) — แยกที่ UI/data ผ่าน role guards + RLS ไม่ใช่แยก portal

---

## 📋 10 ฟังก์ชันที่ต้องเพิ่มใหม่

### 1. Agent Assignment / Permission Matrix
**ตารางการมอบหมายตัวแทน / การอนุญาต**

- เพิ่ม UI หน้า "สิทธิ์เซลล์"
- Clone Wizard — ปุ่ม "Clone จาก Agent คนอื่น" (copy สิทธิ์ทั้งหมดจาก sales A ไป sales B)

**Roles**: Owner ✅ · Admin ✅ · Sales ❌ · Customer ❌
วอย่าง UI ที่จะต่างกัน
Admin login → เปิด /admin/agent-permissions

┌────────────────────────────────────────────┐
│  สิทธิ์เซลล์ — บ้านกุลพันธ์วิลล์            │  ← tenant ปัจจุบัน (ของตน)
├────────────────────────────────────────────┤
│  [Clone จาก Agent อื่น]  [+ เพิ่ม]         │
│                                            │
│       │KP-001│KP-002│KP-003│...            │
│ ─────────────────────────────────          │
│ สมชาย │ ✅  │ ✅  │ ❌  │...               │
│ สมศรี │ ✅  │ ❌  │ ✅  │...               │
│ ...                                        │
└────────────────────────────────────────────┘
Owner login → เปิดหน้าเดียวกัน

┌────────────────────────────────────────────┐
│  สิทธิ์เซลล์                                │
│  Tenant: [บ้านกุลพันธ์วิลล์ ▼]   ← dropdown เลือก tenant ได้ │
├────────────────────────────────────────────┤
│  [Clone จาก Agent อื่น]  [+ เพิ่ม]         │
│                                            │
│       │KP-001│KP-002│KP-003│...            │
│ ─────────────────────────────────          │
│ สมชาย │ ✅  │ ✅  │ ❌  │...               │
│ ...                                        │
└────────────────────────────────────────────┘
→ เพิ่มแค่ Tenant Selector ที่ด้านบน — ทุกอย่างอื่นเหมือนกัน
เคสที่ Owner อาจ ใช้ (edge cases)
เคส	บ่อยแค่ไหน
1. Support — เข้าไปช่วย tenant ที่ admin ติดปัญหา (เช่น ล็อกตัวเอง, ตั้งสิทธิ์ผิด)	นานๆ ครั้ง
2. Recovery — admin ของ tenant ลาออก/หาย ไม่มีคนตั้งสิทธิ์ → Owner เข้าไปแก้แทน	ไม่บ่อย
3. Audit / Compliance — สุ่มตรวจว่า tenant ใช้ permission ตาม policy หรือเปล่า	เป็นรอบ
4. Bug investigation — ลูกค้าแจ้ง bug "Sales ไม่เห็น property" → Owner debug ดู	นานๆ ครั้ง
5. Demo / Onboarding — Owner sales demo ให้ลูกค้าใหม่ดูฟีเจอร์	ตอนเปิดบริษัทใหม่
→ ทุกเคสเป็น operational support ไม่ใช่ "Owner ใช้ matrix นี้ในงานประจำ"
---

### 2. หน้าโครงการ — แยก View ระหว่าง Admin กับ Sales

**ปัจจุบันใน Chateau**:
- ไม่มี filter อัตโนมัติให้ Sales เห็นเฉพาะที่ตนรับผิดชอบ
- Sales เข้าหน้าเดียวกับ Admin ได้

**ต้องเพิ่ม**:
- หน้า Add/Edit ให้ Admin เพิ่ม/แก้ไขได้ — Sales ดูได้อย่างเดียว
- หน้า Property Detail สำหรับ Sales — Gallery + Zoom, Floor Plan, 3D Tour link, Plot Number, แผนที่, Promotion section (ราคาก่อนส่วนลด/วันหมดอายุ), Brochure/โฉนด preview
- หน้า My Profile สำหรับ Sales — แก้ข้อมูลส่วนตัว, เปลี่ยนรหัสผ่านเอง, ดู Property ทั้งหมดที่ตนมีสิทธิ์, last login

**Roles**:
- Project Add/Edit: Owner ✅ · Admin ✅ · Sales 👁️ filtered · Customer ❌
- Property Detail: Owner ✅ เห็น PII · Admin ✅ เห็น PII · Sales 👁️ ไม่เห็น PII ผู้จอง/ผู้ซื้อ
- My Profile: Sales ✅ ของตัวเอง

---

### 3. Reservation Workflow แบบครบลูป

- **Auto-revert จอง→ว่าง** เมื่อหมดเวลาและไม่ปิดดีล
- บันทึกข้อมูล**ผู้จอง** (ชื่อ/เบอร์/มัดจำ/วันจอง/วันครบกำหนด)
- บันทึกข้อมูล**ผู้ซื้อ** (ชื่อ/วันโอน/ราคาขายจริง/ค่าคอมฯ)
- **Audit Trail** ดูประวัติเปลี่ยนสถานะของแต่ละหลัง
- เปลี่ยนสถานะแบบ **Batch** หลายหลังพร้อมกัน

**อยู่หน้าไหน**: หน้า Property Detail (ปุ่มเปลี่ยนสถานะ + dialog) + หน้า Status Timeline (Audit Trail) + หน้า Property List (Batch)

**Roles**: Owner ✅ · Admin ✅ · Sales ❌ ทำไม่ได้ (เห็นแค่ status badge) · Customer ❌

---

### 4. ปุ่มแชร์ผ่าน LINE
*(Canva: Agent Portal Property Detail)*

- ปุ่ม "แชร์ Property" ในหน้า Detail — ส่งเป็นข้อความ LINE ให้ลูกค้าได้ทันที (รูป + ข้อมูลครบ + Brochure)
- ปุ่ม Download รูป / Brochure / เอกสาร แยก

**Roles**: Owner ❌ · Admin ❌ · Sales ✅ · Customer ❌
> เป็นเครื่องมือเฉพาะของ Sales ตาม Canva (Agent Portal feature)

---

### 5. In-app Notifications แบบ Real-time

**สำหรับ Sales (Agent)**:
- มี Property ใหม่ที่ตนมีสิทธิ์ขาย
- Property เปลี่ยนสถานะ (จอง/ขาย)
- สิทธิ์เข้าถึง Property ถูกเปลี่ยนแปลง

**สำหรับ Admin**:
- การจองครบกำหนดยังไม่ปิดดีล
- Property ค้างสถานะ "จอง" เกิน 30 วัน
- เซลล์ Login ผิดเกิน 5 ครั้งติดกัน (security alert)

**Roles**:
- Sales notifications: Sales ✅
- Admin notifications: Owner ✅ · Admin ✅

---

### 6. Dashboard + Reports + Activity Log

- เพิ่ม **KPI Cards**: Property รวม / ว่าง / จอง / ขาย
- เพิ่ม **กราฟยอดขายรายเดือน** (Sales Trend 12 เดือน)
- **Top 5 เซลล์** ยอดขายเดือน/YTD
- **รายงาน Property ค้าง** (อยู่นาน / จองค้างเกินกำหนด)
- **Activity Log** ใครทำอะไรเมื่อไหร่ (เพิ่ม/แก้/ลบ/เปลี่ยนสถานะ)
- **Filter ช่วงเวลา** (รายวัน / สัปดาห์ / เดือน / ปี / กำหนดเอง) + **Export Excel/PDF**

ใช้กับรายงาน:
- กราฟแนวโน้มรายเดือน (ยอดจอง / ยอดขาย / Property ใหม่)
- รายงานยอดขายราย Agent
- รายงาน Property คงค้าง
- Activity Log
- Conversion Funnel

> **Value**: ข้อมูลให้ผู้บริหารตัดสินใจ + audit trail สำหรับ compliance

**Roles**: Owner ✅ ข้าม tenant · Admin ✅ tenant ตัวเอง · Sales ❌ · Customer ❌

---

ิ
---

### 8. Project Management เสริม
*(Canva: Function ADMIN → PROJECT MANAGEMENT)*

- เพิ่ม / แก้ไขโครงการ พร้อม **Site Plan** (ผังโครงการ) + **Cover image**

> **Value**: Sales เปิด Property Detail แล้วเห็นผังโครงการ ใช้แนะนำลูกค้าได้

**Roles**: Owner ✅ · Admin ✅ · Sales 👁️ Site Plan โผล่ใน Property Detail · Customer ❌

---

### 9. Default Visibility + Coverage KPI

- ตั้งค่า **Default Visibility** ว่าเมื่อ Admin เพิ่ม Property ใหม่ ใครเห็นได้บ้าง (กำหนดเอง / ทุกคน / ไม่ให้ใครก่อน)
- KPI ใน Permission Matrix: **Coverage %** (กี่ % ของ Property ถูกมอบหมายแล้ว)

> **Value**: ลดงาน manual ของ Admin เวลาเพิ่ม Property ใหม่ + เห็นภาพรวมว่าแจกสิทธิ์ครบหรือยัง

**Roles**: Owner ✅ · Admin ✅ · Sales ❌ · Customer ❌

---

## 📊 Master Matrix — ใครเห็นอะไร + ใช้แค่ไหน

> Legend:
> 🟢 **Daily** = ใช้งานหลักประจำวัน · 🔵 **Strategic** = เห็นข้าม tenant เพื่อ insight · 🟡 **Support** = เข้าได้เฉพาะเคสพิเศษ · 👁️ **View** = ดูได้ filter/limited · ❌ ไม่เห็น/ไม่เกี่ยว

| # | ฟีเจอร์ | Owner | Admin | Sales | Customer |
|---|---|---|---|---|---|
| 1 | Permission Matrix + Clone Wizard | 🟡 support เคสพิเศษ | 🟢 daily — มอบสิทธิ์ sales | ❌ Sales รับสิทธิ์ ไม่ใช่ผู้ตั้ง | ❌ |
| 2.1 | หน้าโครงการ (Add/Edit) | 🟡 support / 🔵 cross-tenant overview | 🟢 daily CRUD | 👁️ filtered (read-only) | ❌ |
| 2.2 | Property Browse + Filter/Search | 🔵 cross-tenant view | 🟢 daily — ทุก unit ของ tenant | 👁️ เฉพาะที่ได้สิทธิ์ | ❌ |
| 2.3 | Property Detail | 🔵 cross-tenant + เห็น PII | 🟢 daily + เห็น PII | 👁️ ไม่เห็น PII ผู้จอง/ผู้ซื้อ | ❌ |
| 2.4 | My Profile | — | — | 🟢 ของตัวเอง | ❌ |
| 3 | Reservation Workflow | 🟡 audit/recovery | 🟢 daily — บันทึกจอง/ขาย | ❌ Privacy + ไม่ใช่หน้าที่ | ❌ |
| 4 | ปุ่ม LINE Share | ❌ ไม่ได้คุยลูกค้าตรง | ❌ ไม่ได้คุยลูกค้าตรง | 🟢 daily tool หลัก | ❌ |
| 5.1 | Sales Notifications | — | — | 🟢 — สิทธิ์ใหม่/สถานะเปลี่ยน | ❌ |
| 5.2 | Admin Notifications | 🔵 cross-tenant security signal | 🟢 own tenant alerts | ❌ | ❌ |
| 6 | Dashboard + Reports + Activity Log | 🔵 cross-tenant strategic | 🟢 daily — own tenant decisions | ❌ | ❌ |
| 7 | Conversion Watch (Hot + Funnel) | 🔵 cross-tenant intel — upsell/churn | 🟢 daily — pricing decisions | ❌ | ❌ |
| 8 | Project Management (Site Plan + Cover) | 🟡 support setup | 🟢 daily | 👁️ Site Plan ใน Property Detail | ❌ |
| 9 | Default Visibility + Coverage KPI | 🟡 support tenant onboarding | 🟢 daily — ลด manual work | ❌ | ❌ |

**อ่าน matrix ยังไง**: 🟢 = "primary user" ของ feature · 🔵 = "ดูแบบ aggregate ข้าม tenant" (เฉพาะ Owner) · 🟡 = "เข้าได้แต่ไม่ใช่งานหลัก"

---

## 🛣️ สรุปต่อ Role — เห็นอะไร + ได้ value อะไร

> ใช้ pattern เดิมของ Chateau: ทุก role เข้า routes เดียวกัน — แยกที่ UI/data ผ่าน role guards

---

### 👑 Owner (Platform Owner — เจ้าของ SaaS)

**งานหลัก**: บริหาร platform — onboard tenant ใหม่, จัดการ billing/subscription, ดูภาพรวมข้าม tenant, support escalation

> 💡 Owner **ไม่ใช่ daily user ของ feature 1-9** — Owner ขายระบบให้บริษัทอื่นใช้ ไม่ใช่ใช้แทนบริษัท

| ฟีเจอร์ที่เห็น | ระดับ | ได้ value อะไร |
|---|---|---|
| **Owner Dashboard / Tenants / Billing / Payments** *(มีใน Chateau)* | 🟢 daily | งานหลักของ Owner — ดูแล tenant + เก็บเงิน |
| **Dashboard + Reports (#6)** | 🔵 strategic | **เห็นข้าม tenant** — ใครเป็น power user, ใครใกล้ churn, รายได้รวม platform |
| **Conversion Watch (#7)** | 🔵 strategic | **ข้าม tenant** — เห็นว่า feature ไหน convert ดีสุด → ใช้เป็น case study + sales pitch |
| **Activity Log (#6)** | 🔵 strategic | Audit ทั้ง platform — security/compliance |
| **Admin Notifications (#5.2)** | 🔵 strategic | "Login fail 5 ครั้ง" ระดับ aggregate = security signal ของ platform |
| Permission Matrix (#1) | 🟡 support | Tenant admin ติดล็อก / ลาออก → Owner เข้าไป recover |
| Property Inventory (#2) | 🟡 support | Onboard tenant ใหม่ / debug data issue |
| Reservation Workflow (#3) | 🟡 support | Audit / รื้อข้อมูลผิดตามคำขอ tenant |
| Project Mgmt (#8), Default Visibility (#9) | 🟡 support | Help tenant setup ตอน onboard |
| LINE Share (#4), Sales Notifications (#5.1) | ❌ | ไม่เกี่ยวกับงาน Owner เลย |

**ฟีเจอร์ใหม่ที่ Owner ต้องการ** (cross-tenant — เพิ่ม Layer ใหม่):
- หน้า **Cross-tenant Analytics** (รวม #6 ของทุก tenant)
- หน้า **Cross-tenant Conversion Watch** (รวม #7)
- กลไก **"Switch context เข้า tenant"** สำหรับ support (พร้อม audit log)

---

### 🛠️ Admin (เจ้าของโครงการ — Tenant Admin)

**งานหลัก**: บริหารบริษัท/โครงการของตน — CRUD ทุกอย่างใน tenant, มอบสิทธิ์ sales, ดูรายงาน, ตัดสินใจ pricing

> 💡 Admin คือ **primary user ของ PROPERTY HUB** — feature 1-3, 5.2-9 ใช้ daily

| ฟีเจอร์ที่เห็น | ระดับ | ได้ value อะไร |
|---|---|---|
| **Permission Matrix (#1)** | 🟢 daily | กระจาย Property ให้ sales รับผิดชอบ + Clone สิทธิ์ |
| **Property Inventory (#2)** | 🟢 daily | เพิ่ม/แก้/ลบ โครงการ + ยูนิต พร้อมรูป/เอกสาร |
| **Reservation Workflow (#3)** | 🟢 daily | บันทึกจอง/ซื้อ + status workflow + audit per unit |
| **Admin Notifications (#5.2)** | 🟢 daily | จองครบกำหนดยังไม่ปิด / ค้าง 30 วัน / login fail 5x |
| **Dashboard + Reports (#6)** | 🟢 daily | KPI + Trend + Top sales + Activity ของ tenant ตน |
| **Conversion Watch (#7)** | 🟢 daily | Hot Listings + Funnel — ตัดสินใจปรับราคา/promotion |
| **Project Management (#8)** | 🟢 daily | Site Plan + Cover ของแต่ละโครงการ |
| **Default Visibility + Coverage (#9)** | 🟢 daily | Setting + KPI ว่ามอบสิทธิ์ครบหรือยัง |
| LINE Share (#4) | ❌ | Admin ไม่ได้คุยลูกค้าตรง |

**Routes ที่ Admin ใช้** (ใช้ของ Chateau เดิม + เพิ่มเติม):
- `/projects`, `/properties`, `/properties/:id` *(ของเดิม + enhance ตาม #2, #3, #8)*
- `/users` *(ของเดิม)*
- `/sales-permissions` *(ใหม่ — Permission Matrix #1, #9)*
- `/reports` *(ใหม่ — Dashboard + Reports + Conversion Watch #6, #7)*
- 🔔 Bell ใน Header — Admin notifications #5.2

---

### 💼 Sales (เซลล์ — Field Staff)

**งานหลัก**: ขายลูกค้าหน้างาน — ดู Property + ส่งให้ลูกค้า + ตอบเร็วใน 30 วินาที

> 💡 Sales focus แค่ **5 features** ที่เกี่ยวกับการขาย — ไม่ต้องการ admin/analytics tools

| ฟีเจอร์ที่เห็น | ระดับ | ได้ value อะไร |
|---|---|---|
| **Property Inventory (#2)** | 🟢 daily | ดู list **เฉพาะที่ตนรับผิดชอบ** (auto-filter ผ่าน `unit_assignments`) |
| **Property Detail (#2.3)** | 🟢 daily | ข้อมูลครบ — Gallery, Floor Plan, 3D Tour, ราคา (🚫 ไม่เห็น PII ผู้จอง/ผู้ซื้อ) |
| **My Profile (#2.4)** | 🟢 daily | ข้อมูลตัวเอง + เปลี่ยนรหัสผ่าน + ดูสิทธิ์ที่ได้รับ + last login |
| **LINE Share (#4)** | 🟢 daily | ส่งข้อมูล Property + รูป + Brochure ให้ลูกค้าทาง LINE ทันที |
| **Sales Notifications (#5.1)** | 🟢 daily | Property ใหม่ที่ตนได้สิทธิ์ / สถานะเปลี่ยน / สิทธิ์ถูกถอน |
| **Site Plan (#8)** | 👁️ view | โผล่ใน Property Detail — ใช้แนะนำลูกค้าได้ |
| Permission Matrix (#1) | ❌ | Sales **รับ** สิทธิ์ ไม่ใช่ผู้ตั้ง |
| Reservation Workflow (#3) | ❌ | Privacy — ไม่เห็น PII / ไม่ใช่หน้าที่ของ sales |
| Dashboard / Reports / Conversion (#6, #7) | ❌ | Analytics ไม่ใช่ของ sales |
| Default Visibility (#9) | ❌ | Setting ของ admin |

**Routes ที่ Sales ใช้** (ใช้ของ Chateau เดิม + role-based filter):
- `/projects`, `/properties` *(เดิม — แต่ filter ตาม `unit_assignments`)*
- `/properties/:id` *(เดิม — แต่ซ่อน PII + เพิ่มปุ่ม LINE Share)*
- `/profile` *(เดิม)*
- 🔔 Bell — Sales notifications #5.1

---

### 👤 Customer (Future role — ยังไม่ scope)

**งานหลัก** *(เมื่อพร้อม)*: ดูข้อมูล Property ที่สนใจ + ติดตามสถานะของตน (จองอะไร, รอโอน, payment status)

- ❌ ทุก feature 1-9 **ไม่เห็น** — เป็น "หลังบ้าน" ของบริษัท
- 💡 Customer features ในอนาคต = **ชุดหน้าใหม่ทั้งหมด** (browse public listings, "ของฉัน", payment tracker) ไม่ใช่ extends จาก feature 1-9
- ⏰ ค่อย design เมื่อ stakeholders พร้อม spec ออกมา

---

## 🔐 Security 2 ชั้น

ระบบต้อง enforce **ทั้ง 2 ระดับ** สำหรับแต่ละ role:

### ระดับที่ 1 — Frontend (Routing + UI)
- กั้น URL: sales เข้า `/admin/*` ไม่ได้, redirect → `/agent/properties`
- ซ่อน menu / ปุ่มที่ไม่มีสิทธิ์
- หน้า Detail ของ Sales ต้อง render โดย**ไม่รวม** PII fields ใน HTML

### ระดับที่ 2 — Database (RLS Policies)
- ตาราง `units` — Sales เห็นเฉพาะที่มี row ใน `unit_assignments`
- ตาราง `unit_reservations` — Sales SELECT ไม่ได้เลย (PII)
- ตาราง `unit_views` — Admin เท่านั้นที่ aggregate ได้ (Sales เก็บ event ได้)
- แม้ Frontend รั่ว → DB กั้นไว้อีกชั้น

---

## ✅ สรุปตัวเลข

| ข้อสรุป | จำนวน |
|---|---|
| Total features | **10 ข้อ** |
| Owner+Admin ใช้กี่ฟีเจอร์ | **9 ข้อ** (ทุกข้อยกเว้น LINE Share) |
| Sales ใช้กี่ฟีเจอร์ | **5-6 ข้อ** — Property Browse, Detail, My Profile, LINE Share, Notifications, Site Plan ใน Detail |
| Customer (อนาคต) | **0 ข้อ** — ต้อง spec แยก เมื่อพร้อม |
| Routes ใหม่ที่ต้องสร้าง | `/agent/*` (4 หน้า) + `/admin/agent-permissions` + `/admin/reports` |
| Routes เดิมที่ต้อง enhance | `/admin/properties`, `/admin/projects`, `/admin/dashboard`, `/admin/users` |

---

## 🎯 จุดที่อยากเน้นเวลานำเสนอหัวหน้า

1. **ของที่มีอยู่แล้วใน Chateau ใช้ได้เลย** — 3-role system, multi-tenant, properties+units, leads, billing, login/invite, activity logs framework → **ไม่ต้องเริ่มจาก 0**
2. **PROPERTY HUB ไม่ใช่ product แยก** — เป็น feature extension ของ Chateau → ใช้ repo เดียว, deploy ที่เดียว
3. **Conversion Watch (#7) เป็น killer feature** — ลูกค้า real-estate ทั่วไปมีแค่ inventory tool, ไม่มี analytics ดูเยอะ-ขายไม่ออก
4. **Permission Matrix (#1) สำคัญที่สุดต้องทำก่อน** — ถ้าไม่มี รองรับ จะทำอะไรไม่ได้เลย
5. **Customer role อนาคต** — ระบบจะออกแบบรองรับได้, แต่ยังไม่ต้องทำตอนนี้

---

## 📚 Source of Truth References

- **Canva spec deck**: 18 slides (Agent Portal 4 + Admin Portal 8 + Workflow 2 + Reference 4)
- **Live demo**: https://propertyhub-platform.vercel.app
- **Chateau current state**: branch `001-production-readiness`, audited 2026-05-08

---

*เอกสารนี้เป็นการวิเคราะห์/ออกแบบเท่านั้น — ยังไม่มีการแก้ไข code*


🗺️ แผนถัดไป — Phase 1: Foundation
แบ่งเป็น 4 sub-steps ลำดับตามลำดับความสำคัญ

Step 1A: Cleanup RLS ของ units (15-30 นาที)
🎯 ปิดช่องโหว่ "anyone can do anything"

DROP 3 policies หลวม: Authenticated users can view/insert/delete units
เก็บแค่ tight policies: Users can view units in their tenant + Admins can update units + Owner can delete units
(ควรทำก่อน step อื่น เพื่อไม่ให้ migration ที่จะเพิ่มขึ้นมาทับซ้อนกับ policy หลวม)
--- Step 1B: สร้าง assignment tables (1-2 ชั่วโมง)
ตามที่คุยกัน — Sales = project-scoped, Agent = unit-scoped → ใช้ 2 ตารางแยกกัน (clean กว่า union table):


-- Sales ดูแลทั้งโครงการ
CREATE TABLE sales_project_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  sales_user_id uuid REFERENCES users(id),  -- role = 'sales'
  project_id uuid REFERENCES properties(id),  -- โครงการ
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(sales_user_id, project_id)
);

-- Agent ขายเฉพาะหลัง
CREATE TABLE agent_unit_assignments (
  id uuid PRIMARY KEY,
  tenant_id uuid REFERENCES tenants(id),
  agent_user_id uuid REFERENCES users(id),  -- role = 'agent'
  unit_id uuid REFERENCES units(id),  -- หลังเฉพาะ
  assigned_by uuid REFERENCES users(id),
  assigned_at timestamptz DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE(agent_user_id, unit_id)
);
Indexes + triggers + RLS policies (admin full access, sales/agent read-only ของตัวเอง)
---- Step 1C: Update RLS ของ units (30 นาที)
เพิ่ม policy ใหม่ 2 ตัว:


-- Sales เห็นเฉพาะ unit ใน project ที่ตนถูก assign
CREATE POLICY "Sales see units in assigned projects" ON units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM users u
    JOIN sales_project_assignments spa ON spa.sales_user_id = u.id
    WHERE u.id = auth.uid()
      AND u.role = 'sales'
      AND spa.project_id = units.property_id
      AND spa.revoked_at IS NULL
  )
);

-- Agent เห็นเฉพาะ unit ที่ตนถูก assign
CREATE POLICY "Agent sees only assigned units" ON units FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM agent_unit_assignments aua
    WHERE aua.agent_user_id = auth.uid()
      AND aua.unit_id = units.id
      AND aua.revoked_at IS NULL
  )
);
Step 1D: Permission Matrix UI (3-5 ชั่วโมง)
หน้าใหม่ในเมนู ADMIN — /sales-permissions:

Tab 1: Sales × Projects — ตารางมอบหมายโครงการให้ sales
Tab 2: Agents × Units — ตารางมอบหมายยูนิตให้ agent
ปุ่ม Clone จาก user คนอื่น ทั้ง 2 tabs