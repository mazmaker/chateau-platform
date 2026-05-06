# CHATEAU Platform — Gap Analysis เพื่อใช้งานจริง

> วิเคราะห์สิ่งที่ขาดเทียบกับ Real Estate CRM ระดับสากล (R-CRM, Follow Up Boss, kvCORE) เพื่อให้ CHATEAU ใช้ใน production ได้
>
> **อัปเดตล่าสุด:** 2026-04-24
> **ผู้วิเคราะห์:** AI Code Review

---

## 📊 สรุปคะแนนเทียบกับคู่แข่ง

| Feature Group | CHATEAU ตอนนี้ | R-CRM (TH) | Follow Up Boss | kvCORE |
|---|---|---|---|---|
| Lead Management | 60% | 90% | 95% | 90% |
| Property Mgmt | 70% | 80% | 50% | 95% |
| Marketing Automation | 30% *(UI only)* | 85% | 80% | 90% |
| Communication | 10% *(LINE concept)* | 90% | 85% | 80% |
| Pipeline/Tasks | 20% | 80% | 95% | 85% |
| Reporting | 50% | 75% | 80% | 85% |
| Mobile | 30% *(responsive)* | 70% | 95% | 90% |
| Integrations | 10% | 60% | 90% | 80% |
| **Overall** | **~35%** | **~80%** | **~85%** | **~88%** |

---

## 🚨 CRITICAL — ขาดถึงใช้จริงไม่ได้ (Phase 1)

### 1. LINE Integration ของจริง
**สถานะ:** UI mockup เท่านั้น
- ❌ Builder Wizard มีแค่ preview · กด Send ไม่ส่งจริง
- ❌ ไม่มี LINE Channel Access Token / Webhook config
- ❌ ไม่มี LINE LIFF mini-app สำหรับลูกค้า

**ต้องการ:**
- LINE Messaging API setup
- Push Message API
- Flex Message API
- Webhook handler

---

### 2. Backend Logic ที่ทำงานจริง
**สถานะ:** UI ครบ แต่ไม่มี backend execution

| Module | UI | Backend |
|---|---|---|
| Triggers | ✅ | ❌ ไม่มี cron/queue worker |
| Campaigns | ✅ | ❌ กด Send ไม่ส่ง |
| Vouchers | ✅ | ❌ ใช้ที่ POS/checkout ไม่ได้ |

**ต้องการ:**
- Supabase Edge Functions
- Cron jobs (pg_cron / external scheduler)
- Queue system (BullMQ / Inngest)

---

### 3. Visual Sales Pipeline (Kanban)
**สถานะ:** ขาดเลย
- ❌ Leads มี list ธรรมดา ไม่มี kanban drag & drop
- ❌ ไม่เห็นภาพรวม pipeline (Lead ใหม่ → ติดต่อ → นัดดู → จอง → ปิดดีล)
- ✅ R-CRM, Follow Up Boss, kvCORE มีหมด

---

### 4. Task Management + Reminders
**สถานะ:** ไม่มี
- ❌ ไม่มีระบบ task assign ให้ sales
- ❌ ไม่มี reminder notification (โทรกลับ X วัน)
- ❌ ไม่มี calendar integration

**ต้องการ:**
- `tasks` table
- Push notifications (web/mobile)
- Calendar sync (Google/Outlook)

---

### 5. Email/SMS Channel
**สถานะ:** ใช้ LINE อย่างเดียว
- ❌ ส่ง invoice/welcome ใช้ email ไม่ได้
- ❌ ไม่มี SMS เป็น channel สำรอง

**ต้องการ:**
- SendGrid / Mailgun (transactional + marketing email)
- ThaiBulkSMS / SMSMaster (Thai SMS gateway)

---

## ⚠️ HIGH PRIORITY (Phase 2)

### 6. Property Availability Matrix
- ❌ ไม่เห็นว่าห้องไหนว่าง/จอง/ขายแล้ว แบบ real-time grid
- ✅ R-CRM โชว์ floor plan + status ของแต่ละ unit ได้

### 7. Lead Scoring (Real Algorithm)
- ❌ มี `potential_score` field แต่ไม่มี algorithm
- ❌ ไม่มี behavioral tracking (click/view/time-spent)
- ✅ Follow Up Boss มี smart score

### 8. Drip Campaigns / Sequences
- ❌ ส่งได้แค่ครั้งเดียว
- ❌ ไม่มี nurture flow (ส่ง email/LINE ตามลำดับ Day 1, 3, 7, 14)
- ✅ Customer.io, Klaviyo เด่นเรื่องนี้

### 9. Custom Fields
- ❌ Schema ตายตัว
- ❌ ทุก tenant เห็น fields เหมือนกัน
- ⚠️ ใช้จริงแต่ละ developer ต้องการ field ต่างกัน:
  - "ราคา/ตร.ม."
  - "วิวทะเล"
  - "ใกล้ BTS"
  - "ชั้นไหน"

### 10. Reporting Export
- ❌ Export PDF/Excel ทำได้แค่บางหน้า
- ❌ Custom report builder ไม่มี

---

## 📈 MEDIUM PRIORITY (Phase 3)

| # | Feature | สถานะ | หมายเหตุ |
|---|---|---|---|
| 11 | A/B Testing Campaigns | ❌ | ส่ง variant A vs B |
| 12 | Commission Tracking | ❌ | sales ทำดีลแล้วได้กี่ % |
| 13 | Document Management | ❌ | สัญญา/contract/ใบเสร็จ |
| 14 | Public Property Search | ❌ | DDP/Hipflat มี |
| 15 | Customer Portal | ❌ | ลูกค้าดูสถานะห้องตัวเอง |
| 16 | Mobile App | ❌ | sales ใช้มือถือเป็นหลัก |
| 17 | Calendar Integration | ❌ | Google/Outlook |
| 18 | Accounting Integration | ❌ | QuickBooks/Xero/FlowAccount |
| 19 | Property Portal Sync | ❌ | DDP/Hipflat sync listings |
| 20 | Bank API Integration | ❌ | Payment verification |

---

## 🛡️ COMPLIANCE & SECURITY

### 21. PDPA Compliance ของจริง
**สถานะ:** มี field แต่ไม่ครบ
- ⚠️ มี `pdpa_consent` ใน leads แต่ไม่มี:
  - Cookie consent banner
  - Right to be forgotten (delete data API)
  - Data export ลูกค้า request ได้
  - Privacy policy versioning

### 22. 2FA / SSO
- ❌ ไม่มี
- ⚠️ admin role ที่จัดการ tenant ทั้งหมดควรต้อง 2FA

### 23. Audit Log
- ⚠️ มี table แต่ไม่ใช้ครบ
- ❌ ไม่มี UI ดู log

---

## 🎯 Roadmap ที่แนะนำ — ปล่อย MVP ใช้จริง

### Sprint 1 (2-3 สัปดาห์) — Make it WORK
- [ ] Apply migration `20260424000002_create_marketing_tables.sql`
- [ ] Apply seed `20260424000003_seed_marketing_demo_data.sql`
- [ ] **LINE Messaging API integration** (Channel + Webhook)
- [ ] Builder Wizard **save จริงเข้า DB**
- [ ] **Visual Sales Pipeline** (kanban สำหรับ leads)

### Sprint 2 (2-3 สัปดาห์) — Make it USABLE
- [ ] **Tasks + reminders** สำหรับ sales
- [ ] **Email service** (SendGrid)
- [ ] **PDPA proper** (consent banner + delete request)
- [ ] **Property Availability Matrix**

### Sprint 3 (2-3 สัปดาห์) — Make it AUTOMATED
- [ ] **Triggers backend** (Edge Function + cron)
- [ ] **Drip Campaigns** (Day 1, 3, 7, 14)
- [ ] **Reports export** PDF/Excel
- [ ] **Custom fields** support

### Sprint 4+ — Make it SCALABLE
- [ ] Mobile app (React Native)
- [ ] Real AI Lead Scoring
- [ ] Public listing portal
- [ ] Marketplace integrations

---

## 📚 Reference — เว็บที่ใกล้เคียง CHATEAU

### Direct Competitors (Thai)
| Platform | URL | จุดแข็ง |
|---|---|---|
| **R-CRM** (Wisesight) | r-crm.co | LINE-first CRM, Thai market |
| **AssetWise CRM** | assetwise.co.th | Thai developer CRM |
| **DDProperty Pro** | ddproperty.com/agent-zone | Listing + lead capture |
| **Hipflat** | hipflat.co.th | Property + lead management |

### Global Inspiration
| Platform | URL | จุดแข็ง |
|---|---|---|
| **Follow Up Boss** | followupboss.com | Lead pipeline + Action Plans |
| **kvCORE** | insiderealestate.com/kvcore | All-in-one platform |
| **Lofty (Chime)** | lofty.com | AI assistant + Smart Plan |
| **BoomTown** | boomtownroi.com | Predictive lead scoring |

### Marketing Platforms
| Platform | URL | จุดแข็ง |
|---|---|---|
| **Customer.io** | customer.io | Visual workflow builder |
| **Klaviyo** | klaviyo.com | Segment + A/B testing |
| **Braze** | braze.com | Multi-channel canvas |
| **MoEngage** | moengage.com | LINE + email mixed (Asia) |

### LINE-Specific
| Platform | URL | จุดแข็ง |
|---|---|---|
| **LINE OA Manager** | manager.line.biz | Native broadcast + Flex |
| **LINE LIFF Docs** | developers.line.biz/en/docs/liff | Platform integration |
| **Stylish Studio** | stylish.studio | LINE LIFF + commerce |

### Design Reference (KK)
| Platform | URL |
|---|---|
| **Kids Kingdom Platform** | kids-kingdom-platform.vercel.app |

---

## 🏆 ข้อเสนอแนะที่จะทำให้ CHATEAU โดดเด่น

1. **Niche ลงไปที่ Thai real estate** — R-CRM ทั่วไป, เราเฉพาะอสังหา
2. **LINE-native** เป็นหลัก (ตลาดไทย LINE > Email/SMS)
3. **Property → Campaign linkage** — แคมเปญทุกอันผูกกับโครงการ (จุดที่ R-CRM ไม่มี)
4. **AI Forecast** สำหรับ developer (ขายห้องไหนได้ก่อน)
5. **PDPA compliance** built-in (ตลาดไทยจำเป็น)
6. **Multi-tenant** จริง (white-label สำหรับ developer แต่ละราย)

---

## 📋 สถานะ Mock vs Real Data ตอนนี้

### ✅ ใช้ DB จริง (Real)
- `tenants`, `users`, `properties`, `units`
- `leads`, `lead_interests`
- `invoices`, `payments`
- `company_settings`

### ⚠️ Mixed (ดึง DB + fallback)
- `campaigns` — ดึงจริง · ลบ MOCK_CAMPAIGNS แล้ว
- Owner Dashboard KPIs — บางตัวจริง บางตัว mock

### ❌ Mock 100% (รอ apply migration)
- ~~Triggers~~ → ✅ เปลี่ยนเป็นดึง `triggers` table แล้ว (รอ apply migration)
- ~~Vouchers~~ → ✅ เปลี่ยนเป็นดึง `vouchers` table แล้ว (รอ apply migration)
- Marketing Analytics charts — ยัง mock อยู่
- Index Dashboard charts — ยัง mock อยู่

### 🗃️ Migration Files พร้อม Apply
- `20260424000002_create_marketing_tables.sql` — สร้าง segments/vouchers/triggers tables
- `20260424000003_seed_marketing_demo_data.sql` — Seed 10 campaigns + 6 vouchers + 6 triggers + 10 segments

**วิธี Apply:**
1. **Supabase Dashboard:** https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql/new → Paste SQL → Run
2. **Supabase CLI:** `supabase db push`

---

## 📝 Notes สำคัญ

1. **MCP Supabase MCP server ใน .mcp/mcp.json มี auth issue** — apply migration อัตโนมัติไม่ได้ ต้องรันด้วยตนเอง
2. ถ้า apply migration แล้ว — Triggers/Vouchers/Campaigns จะแสดงข้อมูลจริงจาก DB ทันที
3. Mock arrays ที่ลบไปแล้ว: `MOCK_CAMPAIGNS`, `TRIGGERS`, `VOUCHERS` (ใน .tsx files)

---

*เอกสารนี้สร้างจากการวิเคราะห์ CHATEAU เทียบกับคู่แข่ง · อัปเดตได้ตามสถานะการพัฒนา*
