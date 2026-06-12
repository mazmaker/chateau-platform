# แผนรื้อ Owner HQ Dashboard (เจ้าของแพลตฟอร์ม)

> **วิธีใช้ไฟล์นี้ (อ่านก่อนลงมือทุกครั้ง):**
> 1. ก่อนเริ่มแต่ละ Phase ให้เปิดอ่านไฟล์นี้ก่อน แล้วทำตามลำดับ Phase
> 2. ทำเสร็จข้อไหน ติ๊ก `[x]` ในไฟล์นี้ เพื่อกันทำซ้ำ/ลืม
> 3. ห้ามข้ามกฎใน §8 (ขอบเขต/ข้อห้าม) เด็ดขาด
> 4. ชื่อเมนูใน §4 = ชื่อสุดท้ายที่ตกลงแล้ว อย่าเปลี่ยนเองโดยไม่ถาม

## 🔖 RESUME — สถานะ (อัปเดต 2026-06-11)

**✅ เสร็จครบทั้ง 7 เฟส · typecheck ผ่าน (exit 0) · เฟส 2-7 ยังไม่ commit**
- Phase 0 → เช็ค DB (§6.1)
- Phase 1 → Sidebar ANALYTICS + 5 หน้า + routes (**commit f03cc27**)
- Phase 2 → `OwnerDashboard.tsx`: หัว "ภาพรวมแพลตฟอร์ม" + scope chip · KPI 6 ใบ · ตารางบริษัท + best/worst (units+leads ข้าม tenant · `fmtCompact`/`salesStats`/`companyRows`)
- Phase 3 → `OwnerMarket.tsx`: KPI + กราฟช่วงราคา(bar)/ประเภท(donut)/เทรนด์(area)
- Phase 4 → `OwnerCompanies.tsx`: best/worst + sparkline ต่อบริษัท + ตารางอันดับ
- Phase 5 → `OwnerGeography.tsx`: bar แนวนอนต่อจังหวัด + ตาราง
- Phase 6 → `OwnerAgents.tsx`: อันดับทีมขายจาก leads (assigned/won/conversion/มูลค่าดีล)
- Phase 7 → `OwnerAudit.tsx`: ตาราง activity_logs + ฟิลเตอร์หมวด + ค้นหา

**หมายเหตุสำคัญ:** บั๊ก audit enum (campaign_*) ที่เคยสงสัย — **ไม่มีในDBจริง** (activity_type ไม่มี CHECK constraint แล้ว, campaign_* เขียนได้) → **ไม่ต้อง migration**

**ถัดไป (ถ้าจะทำ):** commit เฟส 2-7 · QA หน้าจริงด้วย login owner (`.env.test.local`) · อนาคต: heat-map จังหวัด, ต่อสาย RF model ทำ predictive (Tier 3), **ปุ่มสลับภาษา ไทย/อังกฤษ (i18n ทั้งระบบ — งานใหญ่ ทำหลังเดโม)**

**ภาษา UI (สรุป 2026-06-11):** เมนู+หัวหน้า Owner = **อังกฤษ** (Executive Dashboard / Market Overview / Geography / Company Performance / Sales Performance / Leads / Support / Audit Log); เนื้อหา/คำอธิบาย/ปุ่ม = ไทย. คำว่า "ใช้ไทย" ของ user = ให้ Claude คุยไทย ไม่ใช่แปล UI — ดู [[feedback_thai_is_conversation_not_ui]]

---

## 🆕 อัปเดตล่าสุด (2026-06-11 รอบ 2) — งานหลังเฟส 7 (ยังไม่ commit)

**ทำเพิ่มแล้ว (typecheck ผ่านทุกครั้ง):**
- **แก้การ์ดซ้ำ 5 หน้า Owner** (เลขซ้ำในหน้าเดียว/การ์ดผิดกลุ่ม): Dashboard ตัด KPI "บริษัท" ซ้ำ → "มูลค่าขายแล้ว" · ตารางบริษัท → ปุ่มลิงก์ไป Company Performance · Companies card4 → "มูลค่าพอร์ต (GDV)" · Market card1 → "ราคาเฉลี่ยต่อยูนิต" · Geography card3/4 → "จังหวัดที่มียอดขาย"/"มูลค่าขายเฉลี่ย/จังหวัด" · Agents → "มูลค่าดีล (ประเมิน)"
- **เมนูเป็นอังกฤษทั้งหมด ทุก role** (`Sidebar.tsx`): Executive Dashboard / Market Overview / Geography / Company Performance / Sales Performance / Companies / All Projects / Payments / Leads / Users / Support / Audit Log / Settings / My Dashboard / Team Performance / Permissions / Log Out. หัวหน้า Owner ก็อังกฤษตรงกัน. **หัวข้อ "ข้างใน" หน้าเก่า (Tenants/Payments/Properties/Team/Permissions/Settings/MyDashboard) ยังเป็นไทย — user บอก "ข้างในยังไม่เป็นไร" ยังไม่ต้องแก้**
- **✅ ต่อสาย Random Forest เสร็จ:** `src/lib/rfModel.ts` (inference 50 ต้นไม้) + ฝังโมเดล `src/lib/leadScoringModel.json` (18KB = lead_scoring_rf v2) + ต่อใน `src/lib/recomputeLeadScore.ts` (ทับ conversion_probability ด้วยผลโมเดล). ทดสอบ: เกรดดี→1.0, แย่→0.04 ✅. **โมเดล overfit (accuracy 100%, ค่ากลาง→0.996) คะแนนเอียงสูง → ควรเทรนใหม่ด้วยข้อมูลจริงทีหลัง.** เลือกฝังไฟล์เพราะ RLS `ml_models` ให้อ่านเฉพาะ owner/platform-tenant (sales/admin อ่านไม่ได้)

**Requirement ใหม่จากเฮีย (รอบ 2) + การตัดสินใจ:**
1. RFM model (กลุ่มบริษัทจ่าย subscription) → ❌ **ตัดทิ้ง**
2. Random Forest (quality คนซื้อบ้าน) → ✅ **ทำแล้ว**
3. Activity Logs / Customer Journey timeline (หน้าไทม์ไลน์ลูกค้าให้เซลล์ตามงาน) → 🟡 **รอ user เคาะ** (มีข้อมูลดิบแล้ว: property_views + leads behavioral + ตาราง `customer_interactions` ที่ยังว่าง — แค่ยังไม่ทำ UI ไทม์ไลน์)
4. ส่งแคมเปญจริง (LINE/Email/WhatsApp/WeChat) → ❌ **ข้าม** (เน้น UI ก่อน)
5. แชร์ลิงก์ให้ Sales → **แค่มีปุ่มลิงก์พอ** ไม่ทำระบบ track (ปัจจุบันปุ่ม `?ref=` track เฉพาะ agent ใน `UnitDetail.tsx`)

**เหลือ user ตัดสินใจ:**
- **#6** บน Executive: (ก) การ์ด "จำนวน User ทั้งหมด" (เฮียขอใน point 1; ตอนนี้ chip มีแค่บริษัท+โครงการ) + (ข) teaser insight 1 บรรทัด (ราคา/จังหวัด/เอเจนท์ขายดีสุด + ลิงก์) → ยังไม่เคาะ
- **#3** customer journey timeline → ยังไม่เคาะ

**งานค้างทำ (เมื่อ user พร้อม):**
- commit ทั้งหมด (เฟส 2-7 + dedup + English nav + RF) — แตะเฉพาะไฟล์ Owner HQ + `rfModel.ts`/`recomputeLeadScore.ts`/`leadScoringModel.json`; **ไม่แตะ** ไฟล์ที่ user แก้ค้างเอง
- QA login owner ดูหน้าจริง (ยังไม่เคยเปิด browser)
- (optional) batch recompute lead เก่าให้ได้คะแนน RF
- (อนาคต) เทรน RF ใหม่ด้วยข้อมูลจริง · ปุ่มสลับภาษา 2 ภาษา · customer journey timeline

**ที่มา:** คลิปเสียงประชุม "Chateau น้องบอล.m4a" (สรุปผ่าน NotebookLM) + เว็บอ้างอิง https://kids-kingdom-hq.vercel.app/ (HQ เชนร้านเด็ก 4 สาขา) ที่เฮียยกเป็นตัวอย่างความครอบคลุมของข้อมูล
**อัปเดตล่าสุด:** 2026-06-11

---

## 1. เป้าหมาย (หนึ่งประโยค)

ยกหน้า Owner จาก "แดชบอร์ดยอดขาย Subscription มิติเดียว" → **ศูนย์ HQ ที่เห็นข้อมูลตลาดอสังหาฯ ระดับมหภาคข้ามทุกบริษัท** และไล่ดูแบบ แพลตฟอร์ม → บริษัท → โครงการ → ยูนิต

## 2. ปัญหาปัจจุบัน (ยืนยันจากโค้ดจริง)

- `src/pages/OwnerDashboard.tsx` โชว์แค่ MRR / Churn / Subscription / จำนวนบริษัท-โครงการ — **ไม่มีข้อมูลตลาดอสังหาฯ เลย**
- คำนวณ `topTenants` (Top 5 รายได้) ไว้แล้วที่ `OwnerDashboard.tsx:410-418` **แต่ไม่ได้ render**
- เมนู Owner (`Sidebar.tsx:70-75`) ไม่มีคำว่า ตลาด/โครงการ/เอเจนท์ เลย → ดูข้อมูลน้อย
- หน้า `OwnerProjects.tsx` (`/owner-projects`) **มีอยู่แล้วแต่ไม่อยู่ในเมนู**

## 3. ข้อตัดสินที่ล็อกแล้ว (ห้ามรื้อ)

| เรื่อง | สถานะ |
|---|---|
| ค่าคอมมิชชัน / `?ref=` commission | ❌ ตัดทิ้ง (บอสสั่งพัก) |
| คูปอง / Voucher / Reward | ❌ ตัดทิ้ง (ไม่ใช่ของอสังหาฯ; ใช้ promo รายยูนิตแทน) |
| Segmentation | ✅ มีแล้ว (11 segment, สมาชิก 839) — ไม่ต้องทำใหม่ |
| Random Forest model | ⚠️ เทรนแล้ว อยู่ใน `ml_models` + `scripts/upload_model.py` **แต่เว็บยังไม่เรียกใช้** (runtime เป็น rule-based `leadScoring.ts`) → งาน "ต่อสาย inference" ทำทีหลัง ไม่ใช่ตอนนี้ |
| Affiliate link + click tracking | ✅ มีครบ (`property_views`, silent attribution) — ไม่ต้องแตะ |
| Customer UI / โบรชัวร์ดิจิทัล | ✅ เกือบครบ (gallery, แปลน 2D, 3D link, Google Map) — ไม่รื้อ |
| Trigger vs Campaign | ✅ แยก 2 ระบบ — คงไว้ ห้ามรวม |

## 4. โครงสร้างเมนู Owner (ชื่อสุดท้าย)

> หัวกลุ่ม = อังกฤษตัวใหญ่ (ตามทั้งแอป) · เมนูที่คลิกได้ = ไทยทางการ · ไอคอน = lucide-react (**ห้าม emoji ใน nav**)
> แก้ที่ `OWNER_NAV_GROUPS` + `getAllNavItems()` ใน `src/components/dashboard/Sidebar.tsx`

| กลุ่ม | เมนู (ไทย) | route | icon (lucide) | สถานะ |
|---|---|---|---|---|
| _(top)_ | ภาพรวมแพลตฟอร์ม | `/owner` | LayoutDashboard | ปรับเนื้อหา |
| **ANALYTICS** | ภาพรวมตลาด | `/owner-market` | TrendingUp | 🆕 หน้าใหม่ |
| **ANALYTICS** | ทำเลและจังหวัด | `/owner-geography` | MapPin | 🆕 หน้าใหม่ |
| **ANALYTICS** | ประสิทธิภาพบริษัท | `/owner-companies` | BarChart3 | 🆕 หน้าใหม่ |
| **ANALYTICS** | ประสิทธิภาพทีมขาย | `/owner-agents` | Trophy | 🆕 หน้าใหม่ (เซลล์+นายหน้า) |
| **TENANTS** | จัดการบริษัท | `/tenants` | Building2 | ✅ มีแล้ว |
| **TENANTS** | โครงการทั้งหมด | `/owner-projects` | Building | ✅ มีหน้า แค่ใส่เมนู |
| **TENANTS** | การชำระเงิน | `/payments` | CreditCard | ✅ มีแล้ว |
| **GROWTH** | การขายแพลตฟอร์ม | `/owner-leads` | Briefcase | ✅ มีแล้ว (เปลี่ยนชื่อจาก "Leads") |
| **SETTINGS** | จัดการผู้ใช้ | `/users` | Users | ✅ มีแล้ว |
| **SETTINGS** | ศูนย์ช่วยเหลือ | `/owner-support` | MessageSquare | ✅ มีแล้ว (เปลี่ยนชื่อจาก "Support") |
| **SETTINGS** | บันทึกการตรวจสอบ | `/owner-audit` | Shield | 🆕 (ตาราง `activity_logs` มีแล้ว) |
| **SETTINGS** | การตั้งค่า | `/settings` | Settings | ✅ มีแล้ว |

**เหตุผลการตั้งชื่อ (กันโดนถามซ้ำ):**
- "ประสิทธิภาพทีมขาย" ไม่ใช้ "เอเจนท์" เพราะทับศัพท์ + แคบ; role ไทยคือ พนักงานขาย/นายหน้า → "ทีมขาย" คลุมทั้งคู่
- "การขายแพลตฟอร์ม" แยกให้ชัดจากยอดขายอสังหาฯ (อันนี้คือขายตัว SaaS ให้บริษัทใหม่)
- "บันทึกการตรวจสอบ" = คำไทยมาตรฐานของ Audit Log
- route ใช้รูปแบบ `/owner-xxx` (มี hyphen) ตามของเดิม (`/owner-leads`, `/owner-projects`, `/owner-support`)

## 5. สเปกหน้า (Tier 1 — ทำก่อน)

แนวคิดหลักจาก Kids Kingdom: **ใช้ศัพท์ตัวเลขชุดเดียวกันทุกชั้น** (ยอดขาย/ยูนิต/leads/conversion โผล่ซ้ำที่ แพลตฟอร์ม→บริษัท→โครงการ) + **drill-down ผ่าน URL ที่มี id** + **breadcrumb กลับ**

### 5.1 ภาพรวมแพลตฟอร์ม `/owner` (ปรับของเดิม)
- **Scope chip** บนหัว: "ทั้งแพลตฟอร์ม · N บริษัท · M โครงการ" _(ไอเดีย KK #1)_
- **KPI row (สมดุล 3 มิติ ไม่ใช่แค่ SaaS):**
  - มูลค่าขายรวม (GDV) เดือนนี้ + %เทียบเดือนก่อน
  - ยูนิตขายได้ (เดือนนี้) + %
  - Leads ใหม่ทั้งแพลตฟอร์ม + %
  - MRR (เก็บไว้ = สุขภาพ SaaS, เป็น 1 ใน 3 มิติ)
  - จำนวนบริษัท active/total
  - Churn / ต่ออายุใกล้ครบ
- **การ์ดบริษัทเด่น / บริษัทร่วง** (Best/Worst by ยอดขาย) _(ไอเดีย KK #2)_
- **กราฟ:** เทรนด์ GDV รวม 6 เดือน (area) · สัดส่วนยอดขายตามช่วงราคา (donut)
- **ตารางเทียบบริษัท** → คลิกแถว drill ไป `/owner-projects?tenant=:id`

### 5.2 ภาพรวมตลาด `/owner-market` 🆕
- การ์ด: ช่วงราคาขายดีสุด · ประเภททรัพย์ขายดีสุด · ราคาเฉลี่ย/ตร.ม. · ระยะเวลาขายเฉลี่ย (ถ้ามีข้อมูล sold_at)
- กราฟ: ยอดขายแยกช่วงราคา (bar) · ยอดขายแยกประเภททรัพย์ (donut) · เทรนด์ราคาเฉลี่ยตามเวลา (line)

### 5.3 ทำเลและจังหวัด `/owner-geography` 🆕
- เริ่มด้วย bar ต่อจังหวัด (ทำง่าย) → อัปเกรดเป็นแผนที่ไทย heat ทีหลัง
- การ์ด: จังหวัดขายดีสุด · ภาค/โซนขายดีสุด
- ตาราง: จังหวัด → ยอดขาย/ยูนิต/ราคาเฉลี่ย → drill
- _หมายเหตุ: KK ไม่มี map — อันนี้เราจะเหนือกว่าเขา_

### 5.4 ประสิทธิภาพบริษัท `/owner-companies` 🆕
- การ์ด Best/Worst company
- **sparkline ต่อบริษัท** (small-multiples: มินิกราฟ + %change ต่อบริษัท) _(ไอเดีย KK #3)_
- ตารางอันดับ: บริษัท / ยอดขาย / ยูนิต / leads / conversion / การใช้งาน → drill

### 5.5 ประสิทธิภาพทีมขาย `/owner-agents` 🆕
- การ์ด: เซลล์/นายหน้าเก่งสุด · conversion เฉลี่ย
- ตารางอันดับ: ชื่อ / บริษัท / ยอดปิด / จำนวนดีล / conversion
- ⛔ **หยุดที่ระดับ performance — ห้ามเจาะ PII ลูกค้ารายคน** (ดู §8 PDPA)

### 5.6 บันทึกการตรวจสอบ `/owner-audit` 🆕
- ตาราง `activity_logs` ทั้งแพลตฟอร์ม + filter (บริษัท/ประเภท/ช่วงเวลา)
- 🐛 **แก้บั๊กไปด้วย:** enum `activity_type` ไม่มีค่า `campaign_*` ทำให้ audit ของแคมเปญ insert ล้มเหลวเงียบ (`CampaignManagement.tsx:446-550`) → เพิ่มค่าใน enum (ต้อง migration → ขออนุมัติก่อน)

## 6. แหล่งข้อมูล — ⚠️ Phase 0 ต้องเช็ค DB จริงก่อน

อย่าเดา column — ใช้ Supabase MCP (`list_tables`/`execute_sql`) ยืนยันก่อนเขียน query:
- `properties` / `units` / projects: ราคา (`price`), ประเภททรัพย์, จังหวัด/ที่อยู่, สถานะขาย (sold), วันที่ขาย (`sold_at`?)
- `leads`: `assigned_to`, `referred_by_agent_id`, `status`, `created_at`, conversion
- `invoices`: ยอด MRR
- `users`: role, tenant_id (สำหรับอันดับเซลล์/นายหน้า)
- ทั้งหมดดึงข้าม tenant ผ่านสิทธิ์ Owner (RLS owner cross-tenant)
- **เป้า:** ดูว่าทำ Tier 1 ได้โดย "ไม่ต้องเก็บข้อมูลใหม่" แค่ไหน; ส่วนที่ข้อมูลไม่พอให้ทำ note ไว้ ไม่ใส่กราฟลวง

### 6.1 ผลเช็ค DB (Phase 0 — เสร็จ 2026-06-11)

**ข้อเท็จจริงที่ยืนยันแล้ว (ใช้อันนี้ ห้ามเดาใหม่):**
- **`properties` = ตารางโครงการที่ active** (ไม่ใช่ `projects`). units เชื่อมผ่าน **`units.project_id` → `properties.id`** (ครบ 143/143). ตาราง `projects` เป็น schema คู่ขนาน — **อย่าใช้**
- pattern ดึง cross-tenant + การ์ด + formatter + `rollUp` มีครบใน `src/pages/OwnerProjects.tsx` → **copy มาเลย** (palette `KK`, `fmtCompact`, `KpiCard`, `rollUp`)
- ขายแล้ว = `units.status = 'sold'` (ตาม `rollUp` เดิม; `sold_at` มีแต่ไม่ตรงเป๊ะ 37 vs 39)
- **ประเภททรัพย์:** ใช้ `properties.type` (enum) — **ห้ามใช้ `units.unit_type`** (ข้อมูลเละ)
- **จังหวัด:** `properties.address->>'province'` (string ไทย, ครบ 33 โครงการ, 9 จังหวัด) — มี `province_id` ด้วยแต่ใช้ string ง่ายกว่า
- **เซลล์/นายหน้า:** `leads.assigned_to` + `leads.referred_by_agent_id`; ชื่อจาก `users.full_name`/`role`/`referral_code`
- **scale ปัจจุบัน:** 8 บริษัท · 33 โครงการ · 143 ยูนิต (37 ขาย) · ราคา 2.5–66 ล้าน — เป็น demo scale แต่พอ render กราฟจริง

## 7. กฎ reuse (ห้ามคิดเอง)

- เงิน: ใช้ `formatTHB` จาก `src/pages/Index.tsx:76` (รูปแบบ "X ล้าน"/"K" — **ห้าม M/B**)
- สี: ใช้ palette `C` จาก `Index.tsx:35`
- การ์ด/ฟอนต์/ขนาด: copy จาก `OwnerDashboard.tsx` (canonical) — ห้ามตั้งขนาดใหม่เอง
- กราฟ: `recharts` (Area/Bar/Pie) ตามที่ Index/OwnerDashboard ใช้
- เมนู: ตามแพทเทิร์น `NavGroup`/`NavItem` เดิมใน `Sidebar.tsx`

## 8. ขอบเขต & ข้อห้าม (เส้นที่ห้ามข้าม)

- **PDPA / multi-tenant:** Owner เห็น "ข้อมูลรวม/มหภาค" ข้ามบริษัทได้ (ราคา/โซน/อันดับ) แต่ **ห้ามเจาะ PII ลูกค้ารายคนของบริษัทอื่น** (Customer 360 รายคน = งาน Admin บริษัทนั้น). Owner ลึกได้ถึง โครงการ/ยูนิต/อันดับเซลล์ เท่านั้น
- **RLS:** ทุก query/policy ใหม่ต้องมีสิทธิ์ Owner cross-tenant
- **ห้าม migration โดยไม่ขออนุมัติ** (รวมการแก้ enum audit)
- **ห้าม commit/push เอง** — ผู้ใช้ batch เอง
- **UI consistency:** ทุกหน้าใหม่ต้องเหมือน OwnerDashboard (ฟอนต์/การ์ด/พาเลต)
- **ไม่ทำ predictive** จนกว่าจะต่อสาย RF model (Tier 3)

## 9. ลำดับการทำ (Build Order)

- [ ] **Phase 0** — เช็ค DB columns (§6) + ร่าง read queries ที่ใช้ได้จริง (ไม่มี migration)
- [ ] **Phase 1 (quick wins)** — แก้ `Sidebar.tsx`: เพิ่มกลุ่ม ANALYTICS, โผล่ "โครงการทั้งหมด", เปลี่ยนชื่อ (การขายแพลตฟอร์ม/ศูนย์ช่วยเหลือ), เพิ่ม "บันทึกการตรวจสอบ" + route placeholder ของหน้าใหม่
- [ ] **Phase 2** — ปรับ `/owner` Executive Dashboard: KPI 3 มิติ + scope chip + การ์ด best/worst + ตารางเทียบบริษัท (+ render `topTenants` ที่ค้างอยู่)
- [ ] **Phase 3** — หน้า `/owner-market`
- [ ] **Phase 4** — หน้า `/owner-companies` (+ sparkline ต่อบริษัท)
- [ ] **Phase 5** — หน้า `/owner-geography` (เริ่ม bar → map ทีหลัง)
- [ ] **Phase 6** — หน้า `/owner-agents`
- [ ] **Phase 7** — หน้า `/owner-audit` + เสนอ migration แก้ enum (รออนุมัติ)
- [ ] **ภายหลัง (Tier 3)** — ต่อสาย RF model ทำ predictive · benchmark เทียบค่าเฉลี่ยตลาด

## 10. ไอเดียจาก Kids Kingdom ที่หยิบมาใช้

1. Scope chip บนหัว ("ทั้งแพลตฟอร์ม · N บริษัท")
2. การ์ด Best/Worst performer (ไม่ใช่แค่ตาราง)
3. Sparkline small-multiples ต่อบริษัท
4. ศัพท์ตัวเลขชุดเดียวกันทุกชั้น drill-down
5. ตัวเลขเชิงการเงิน (GDV, conversion) ให้ดูเป็นมุมผู้บริหาร
6. drill-down ผ่าน URL + id + breadcrumb กลับ
7. แสดง "ความสด" ของข้อมูล (อัปเดตล่าสุดเมื่อ...)
8. แถวที่ยังไม่มีข้อมูลโชว์ "—" อย่างซื่อสัตย์ ไม่ซ่อน

---
_ไฟล์นี้คือ source of truth ของงานรื้อ Owner — แก้ที่นี่เมื่อ scope เปลี่ยน_
