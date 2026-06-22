# Owner Console — UX/UI Plan (แพลตฟอร์มอสังหา = CDP)

> **สถานะ:** แผนออกแบบ (ยังไม่ลงมือ) · เขียน 2026-06-15
> **ที่มา:** วิเคราะห์ "Owner ควรเห็นอะไร" + สำรวจ ERP ตัวอย่าง (Solarsell `erp-solar-cell.vercel.app`) + requirement เฮีย (คลิป 1-4 + สหกิจ)
> **อ่านคู่กับ:** `owner-hq-dashboard-plan.md` (งานที่ทำไปแล้ว) · `owner-review-clip3-4-spec.md` (เฮีย review)
> **หลักการ:** ไม่จำกัดแค่ data ที่มีตอนนี้ — ถ้ามิติไหนสำคัญต่อ "เจ้าของแพลตฟอร์มอสังหา" ใส่ไว้ แล้วมาร์คว่าต้องเก็บ data ใหม่

---

## 0. วิธีใช้ไฟล์นี้
- §3 = แผนเมนู (IA) ใหม่ · §4 = ออกแบบรายหน้า · §5 = data มี/ขาด · §7 = ลำดับทำ
- มาร์ค: ✅ มีแล้ว · 🟡 มีแต่ต้องเสริม · 🆕 ใหม่ (data มีแล้ว) · 🔴 ใหม่ (ต้องเก็บ data/schema ใหม่)

---

## 1. Vision — Owner เห็นอะไร + ทำไม
Owner = **เจ้าของแพลตฟอร์ม (control-plane)** ไม่ใช่บริษัทอสังหา. สวม 2 หมวก:
- **A. ธุรกิจ SaaS ของเรา** — รายได้/บริษัท/churn/บิล (เราโตไหม)
- **B. ปัญญาตลาดอสังหา (CDP)** — ข้อมูลคนซื้อ/ทำเล/ดีมานด์ ข้ามทุกบริษัท = **คุณค่าที่ขายได้** ("CDP สำหรับอสังหาที่ตลาดยังไม่มี")

เฮียย้ำ: ดู **data ทุกมิติ** · drill ใหญ่→เล็ก (แพลตฟอร์ม→บริษัท→โครงการ→ยูนิต→ลูกค้า) · platform ต้อง**แนะนำได้** ไม่ใช่รอลูกค้าอธิบาย

---

## 2. สิ่งที่ยืมจาก ERP Solarsell (แนวทาง)
ERP มี role: ผู้บริหาร/เซลส์/การตลาด/สต็อก/บัญชี · หน้า "ผู้บริหาร" คือเทียบเท่า Owner เรา เก็บไอเดียมา:

| Pattern จาก ERP | เอามาใช้กับ Owner อสังหา |
|---|---|
| **เมนูจัดเป็นโมดูล + badge ตัวเลข + กางดู sub-items** | เมนู Owner ใส่ badge (ลีดใหม่ / รออนุมัติ / บิลค้าง / SLA หลุด) |
| **KPI Actual vs Target (มี"เป้า" + progress bar)** | 🆕 ตั้งเป้า MRR / ยอดขายแพลตฟอร์ม / รายภูมิภาค แล้วโชว์ % |
| **KPI รายแผนก/หมวด (เทียบเป้า)** | ยอดขายรายประเภททรัพย์ / ช่วงราคา / จังหวัด เทียบเป้า |
| **Approval Workflow (คิวอนุมัติรวม)** | 🔴 คิวอนุมัติของ Owner (เปิดบริษัทใหม่ / refund / เปลี่ยนแพ็กเกจ) |
| **Alert (สต็อกต่ำ/reorder)** | 🆕 แจ้งเตือน: ยูนิตค้างสต็อกนาน / บิลเกินกำหนด / SLA ลีดหลุด |
| **Commission & KPI รายคน** | ผลงานเซลล์รายคน (commission ภายหลัง) |
| **จัดการ Tier (จัดชั้นลูกค้า)** | 🔴 จัดชั้นผู้ซื้อ (VIP/นักลงทุน/รายใหญ่) ตาม spend/score |
| **Financial Overview + Sync บัญชี (Peak)** | 🔴 เชื่อมระบบบัญชีภายหลัง · ตอนนี้ Payments พอ |
| **Movement Log / Avg Cost** | ประวัติการเคลื่อนไหวสถานะยูนิต / ราคาเฉลี่ยตามเวลา |

---

## 3. IA / เมนู Owner ที่เสนอ (ปรับจากของเดิม)
เดิม 5 กลุ่ม: Executive · ANALYTICS · TENANTS · GROWTH · SETTINGS
เสนอเพิ่ม **กลุ่ม "INTELLIGENCE"** (หมวก B — ของที่ขาดหนัก) + badge:

```
ภาพรวม
  • Executive Dashboard           ← SaaS business + เป้า

INTELLIGENCE (ปัญญาตลาด — ใหม่)        ⭐ จุดขาย
  • Customer Intelligence (CDP)   🔴 ใครซื้อ/คาแรคเตอร์/segment/รายใหญ่
  • Lead Funnel & Scoring         🆕 funnel + Quality×Financial score
  • Demand vs Supply              🔴 ดีมานด์เทียบของที่มี

ANALYTICS (มีแล้ว)
  • Sales Overview                ✅ (+ เป้ารายเดือน 🆕)
  • Geography                     ✅
  • Company Performance           ✅
  • Sales Performance             🟡 (+ "ดูเยอะ-ปิดต่ำ")
  • Marketing & Campaign          🆕 แคมเปญ/segment performance
  • Inventory & Absorption        🆕 sell-through/ค้างสต็อก

TENANTS
  • Companies · All Projects · Payments   ✅

GROWTH
  • Platform Leads (บริษัทสนใจซื้อ SaaS)  ✅
  • Approvals                     🔴 คิวอนุมัติ Owner

SETTINGS
  • Users · Support · Audit Log · Targets🆕 · Settings
```

---

## 4. ออกแบบรายโมดูล

### 4.1 Executive Dashboard ✅🆕
- คง 5 KPI SaaS (MRR/YTD/บริษัท/ลีดใหม่/churn)
- 🆕 เพิ่ม **Actual vs Target**: การ์ด MRR โชว์ "เป้า X · ทำได้ Y%" + progress bar (เหมือน ERP "เป้า 600,000฿")
- 🆕 แถบ Alert ด้านบน: บิลเกินกำหนด N · SLA ลีดหลุด N · ยูนิตค้างนาน N (คลิกไปหน้านั้น)
- กราฟแนวโน้มรายได้ (มีแล้ว)

### 4.2 Sales Overview ✅🆕
- มีแล้ว: ยอดขายตามราคา/ประเภท/แนวโน้ม + filter เดือน
- 🆕 เพิ่มเส้น **เป้า** บนกราฟแนวโน้ม (actual vs target)

### 4.3 Geography ✅
- มีแล้ว: จังหวัด→อำเภอ→โครงการ
- 🆕 ภายหลัง: heat map ประเทศไทย + "ดีมานด์รายทำเล" (ลีด/ยอดวิว ต่อจังหวัด ไม่ใช่แค่ยอดขาย)

### 4.4 Company Performance ✅
- มีแล้ว: โดนัท + best/worst + ranking + sparkline → คลิกไปโครงการบริษัท

### 4.5 Sales/Agent Performance 🟡
- มีแล้ว: โดนัท + ranking
- 🆕 **"เปิดดูเยอะ-ปิดต่ำ"** — ตาราง flag เซลล์/ยูนิตที่ถูกเปิดดูบ่อยแต่ปิดไม่ได้ (ดึง `property_views` + status) → ช่วยวิเคราะห์ "ทำเล/ราคามีปัญหา" (เฮียสั่ง)

### 4.6 🔴 Customer Intelligence (CDP) ⭐ — ช่องว่างอันดับ 1
**หน้าที่สำคัญสุดที่ยังไม่มี** — หัวใจ "CDP อสังหา"
- **KPI:** ผู้ซื้อทั้งหมด · มูลค่าซื้อเฉลี่ย/คน · ผู้ซื้อรายใหญ่สุด · segment ที่ใหญ่สุด
- **กราฟ:** สัดส่วนผู้ซื้อตาม segment (โดนัท) · อายุ/รายได้/อาชีพ (bar) · ใครซื้อราคาไหน (heatmap segment × ช่วงราคา)
- **ตาราง Top Buyers:** ชื่อ/บริษัทที่ซื้อ/มูลค่า/segment → ตรงคำเฮีย "ใครจ่ายเยอะสุด" (read-only, PDPA: เห็นข้าม tenant ระดับ aggregate; รายคนเฉพาะที่จำเป็น)
- **drill:** segment → รายชื่อลูกค้าในกลุ่ม → โปรไฟล์ (CDP timeline ที่มีอยู่แล้วใน LeadCDP)
- data: ✅ `customers.preferences` (อายุ/เพศ/อาชีพ/รายได้/หนี้ — เติมครบแล้ว) + leads + 11 segments

### 4.7 🆕 Lead Funnel & Scoring ⭐
- **Funnel ข้ามแพลตฟอร์ม:** มาใหม่ → ติดต่อ → ผ่านคุณสมบัติ → ดูโครงการ → จอง → ปิด (กรวย + % ตกหล่นแต่ละขั้น)
- **Hot/Warm/Cold** distribution
- **โมเดล 2 คะแนน (สมองแพลตฟอร์ม):** การกระจาย **Quality Score** (RF) + **Financial Score** (affordability) · conversion ตามคะแนน (พิสูจน์ว่าโมเดลแม่น)
- data: ✅ leads/activity_logs + RF model (rfModel.ts) + loanEstimation.ts

### 4.8 🆕 Inventory & Absorption
- KPI อสังหาแท้ ๆ: **Sell-through rate** · **Absorption velocity** (ขายกี่ยูนิต/เดือน) · **ยูนิตค้างสต็อก (aging)** — ค้างนานสุด
- กราฟ: สถานะยูนิต (available/reserved/sold) · aging buckets (0-3 / 3-6 / 6-12 / 12+ เดือน)
- 🆕 Alert: โครงการที่ขายช้า / ยูนิตค้าง > X เดือน
- data: ✅ units (status, sold_at) — แต่ต้องคำนวณ aging

### 4.9 🆕 Marketing & Campaign Overview
- เฮียอยากได้ "Marketing จริง": แคมเปญไหน broadcast เยอะ · **segment ไหนตอบสนองดี** · ช่องทาง (LINE/etc.)
- data: ✅ campaigns + segments (มีระบบแล้ว) → ทำ analytics overlay

### 4.10 🔴 Demand vs Supply (Advance)
- เฮีย "platform ต้องแนะนำได้": เทียบ **สิ่งที่คนหา (ลีด/วิว ตามราคา/ทำเล/ประเภท)** vs **ของที่มีขาย** → หา**ช่องว่าง** ("ทำเลนี้คนอยากได้แต่ของน้อย")
- 🔴 ต้อง track ความต้องการลูกค้า (search/filter/view ตาม attribute) — บาง data ยังไม่เก็บ

### 4.11 Payments / Finance ✅
- มีแล้ว: AR/บิล/collection chart · (🔴 ภายหลัง: เชื่อมบัญชีจริงแบบ Peak)

### 4.12 Companies / All Projects / Audit / Support / Users ✅
- มีแล้ว · All Projects 🆕 ต่อ drill โครงการ→ยูนิต ให้ครบ chain (P2 เดิม)

### 4.13 🔴 จาก ERP — Approvals · Alerts · Targets
- **Approvals:** คิวรวมสิ่งที่ Owner ต้องอนุมัติ (เปิดบริษัทใหม่ / เปลี่ยนแพ็กเกจ / refund) — ต้องนิยาม flow
- **Alerts:** ศูนย์รวมแจ้งเตือน (บิลเกินกำหนด/SLA/ค้างสต็อก) — โผล่บน Executive ด้วย
- **Targets:** หน้า/setting ตั้งเป้า (MRR, ยอดขาย, รายภูมิภาค) เพื่อ feed "Actual vs Target" — 🔴 ต้อง table เก็บเป้า

---

## 5. ข้อมูล: มีแล้ว vs ต้องเก็บใหม่
| โมดูล | data มีแล้ว? |
|---|---|
| Customer Intelligence | ✅ customers.preferences + leads + segments |
| Lead Funnel + Scoring | ✅ leads + activity_logs + RF + loan est. |
| Inventory/Absorption | ✅ units (คำนวณ aging เพิ่ม) |
| Marketing/Campaign | ✅ campaigns + segments |
| Sales "ดูเยอะ-ปิดต่ำ" | ✅ property_views + units |
| Demand vs Supply | 🔴 ต้อง track customer search/intent |
| Targets (เป้า) | 🔴 ต้อง table ใหม่ |
| Approvals | 🔴 ต้อง flow + table |
| Customer Tier | 🔴 ต้องนิยาม tier + เก็บ |

> 💡 ของที่ขาด "หนักสุด + คุ้มสุด" — **data มีอยู่แล้ว** (Customer Intelligence, Lead Funnel, Inventory) = ทำ UI ได้เลย ไม่ต้องรอ schema

---

## 6. กฎ UX กลาง (ทุกหน้า Owner ต้องตาม)
1. **Drill ใหญ่→เล็ก** ทุกที่ (แพลตฟอร์ม→บริษัท→โครงการ→ยูนิต→ลูกค้า) — read-only ฝั่ง Owner
2. **Filter/ค้นหา/จัดกลุ่ม** ทุก list (กฎที่ตั้งไว้ [[feedback_always_add_filters]])
3. **ภาพรวม = กราฟก่อน** (โดนัท/แท่ง/เส้น) เห็นก้อนใหญ่สุดทันที (เฮีย)
4. **1 เมนู = 1 ข้อมูล ไม่ซ้ำ** (เฮีย)
5. **Actual vs Target** ทุก KPI หลัก (ยืม ERP) — ถ้ามีเป้า
6. **Badge ตัวเลข** บนเมนู (ของค้าง/ใหม่)
7. UI tokens เดิม (copy OwnerDashboard — KK palette, formatTHB "ล้าน/K") [[feedback_ui_consistency]]
8. PDPA: ข้าม tenant เห็น aggregate ได้ · รายคน (PII) เฉพาะที่จำเป็น + audit

---

## 7. ลำดับความสำคัญ (เสนอ)
**Phase A — ปัญญา "คน" (จุดขาย, data พร้อม):**
1. 🔴⭐ Customer Intelligence (CDP) — ช่องว่างอันดับ 1
2. 🆕 Lead Funnel & Scoring (+ โมเดล 2 คะแนน)

**Phase B — เสริมการขาย/ของ:**
3. 🆕 Inventory & Absorption
4. 🟡 Sales "ดูเยอะ-ปิดต่ำ"
5. 🆕 Marketing & Campaign Overview

**Phase C — ระบบ/บริหาร (ยืม ERP, ต้อง schema):**
6. 🆕 Targets + Actual-vs-Target ทุก KPI
7. 🔴 Alerts center · Approvals · Customer Tier
8. 🔴 Demand vs Supply (advance)

**Phase D — ภายหลัง:** heat map · เชื่อมบัญชีจริง · drill โครงการ→ยูนิตครบ chain

---

## 8. ⚠️ คลิป 5 (Chateau 4.m4a) — แก้ความเข้าใจเดิม (สำคัญ)
**บอล (อินเทิร์น) เข้าใจผิด + ผมก็เข้าใจผิดตาม:** เคยคิดว่า "Owner ดูแค่ฝั่ง SaaS อย่างเดียว ไม่รู้เรื่องอสังหา" → เฮียยืนยันในคลิป5 ว่า **ผิด**. Owner **ต้องเห็นเรื่องอสังหาด้วย** (ลงลึกถึงโครงการ/ลูกค้า/ยอดขายรายวัน) เพื่อ analyze ตลาดทั้งประเทศ ("ปีนี้อสังหาราคาระดับไหนขายดีสุด").

**ผลต่องานที่ทำไป:** ตอน P0-1 ผมเอา GDV/ยูนิต/มูลค่าขาย **ออกจาก Executive** เพราะคิดว่าซ้ำ — แต่จริงๆ เฮียอยากให้ Executive เป็น **command center ครบ** (แบบ ERP). ต้อง**รื้อ Executive ใหม่**.

**สิ่งที่เฮียต้องการ (คลิป5):**
1. **Executive = ภาพรวมครบทุกส่วน (ERP-style)** บนหน้าเดียว: Sales (+ ยอดขายรายวัน) · Inventory/สต็อก · Marketing · Customers · บริษัทร่วม · Approve flow
2. **จัด ใหญ่→เล็ก เป็นชั้น:** 🌏 ประเทศ → ภูมิภาค → 🏢 แพลตฟอร์ม → บริษัท → โครงการ → 👤 ลูกค้า/เซลล์/ยอดขายรายวัน
3. **เพื่อวิเคราะห์+วางแผน** ไม่ใช่แค่รับรู้: เทรนด์ตลาด · revenue performance (Facebook analogy = บริษัทไหนจ่าย/สร้างรายได้เยอะสุด) · ยิ่งซอยละเอียดยิ่งดี
4. **เร่ง** — เฮียบอกช้าไปแล้ว รีบจบ

**Reconcile กับงานเดิม:** หน้า deep ที่ทำไป (Customer Intelligence, Lead Funnel, Inventory, Sales Overview, Geography, Company/Sales Perf) = **ถูกแล้ว** = คือ "ตัวเล็ก" (drill-down). ที่ต้องเพิ่ม = **Executive = "ตัวใหญ่"** ที่สรุปทุกส่วน + ลิงก์ลงไป deep pages + เพิ่มชั้นมหภาค ประเทศ/ภูมิภาค + ยอดขายรายวัน.

### Executive Dashboard ที่ต้องรื้อใหม่ (โครง)
```
1. 🌏 Market มหภาค   — ราคา/ประเภทขายดีสุดในประเทศ · แยกภูมิภาค (เหนือ/อีสาน/กลาง/ใต้/...)
2. 🏢 Platform totals — ยอดขายรวม(GDV) · ยอดขายวันนี้/เดือนนี้ · ยูนิต · ลูกค้า · บริษัท + (SaaS: MRR · บริษัทจ่ายเยอะสุด)
3. 🧩 Section tiles (สรุป + คลิก drill ลง deep page):
     Sales → Sales Overview · Inventory → Inventory · Customers → Customer Intel
     Lead Funnel → Funnel · Companies(จ่ายเยอะสุด) → Company Perf · Marketing → (ทำใหม่) · Approvals → (ทำใหม่)
```
→ **"1 เมนู 1 ข้อมูล" ยังอยู่:** Executive = สรุป/ทางเข้า (tile) · deep page = รายละเอียด — นี่คือ summary→detail ปกติ ไม่ใช่ซ้ำซ้อนแบบที่เคยตัด

### ⚠️ Approvals — ตัดออกจาก Owner scope (clarified 2026-06-15)
ERP ตัวอย่างมี "Approval Workflow" (ลดราคาเกินสิทธิ์/โปรโมชั่น) — แต่นั่นเพราะ "ผู้บริหาร" ของ ERP = เจ้าของบริษัท = เทียบเท่า **Admin** เรา ไม่ใช่ Owner. ดังนั้น:
- ลดราคาเกินสิทธิ์ · คืนมัดจำ · โปรโมชั่น · เปลี่ยนราคา = งาน **Admin (ฝั่ง tenant)** ไม่ใช่ Owner
- รับบริษัทใหม่ = ปัจจุบัน sales-led (Owner สร้าง tenant เองตอนปิดดีลผ่าน Leads) → ไม่มีคิวอนุมัติ (จะมีก็ต่อเมื่อทำ public self-signup)
- subscription (คืนค่าเช่า/เปลี่ยนแพ็กเกจ/ระงับ) = ทำเป็น action ในหน้า Companies/Payments พอ
→ **Owner ไม่ต้องมีหน้า Approvals แยก** (ตัด #8 ออก)

### ทำต่อ (priority — เฮียเร่ง)
1. 🔴 **รื้อ Executive Dashboard = command center** (macro→platform→tiles ที่ drill ลง deep pages) ← ศูนย์กลางที่เฮียถามถึงตลอด
2. 🆕 Geography เพิ่มชั้น **ประเทศ→ภูมิภาค** (เดิมเริ่มที่จังหวัด)
3. 🆕 Marketing Overview + Approvals overview (ให้ครบทุก area แบบ ERP)
4. wire tile → deep page ให้ครบ chain

---
_แผนนี้ = ทิศทาง UX/UI ของ Owner console · §8 = คำสั่งล่าสุด(คลิป5): Executive ต้องเป็น command center ครบ ใหญ่→เล็ก · เริ่มที่รื้อ Executive_
