# 🚀 Marketing Module — Implementation Roadmap

> ขั้นตอนการ implement Marketing module ของ CHATEAU ให้ใช้งานได้จริง
>
> **Scope:** ส่งข่าวสารโครงการอสังหา (ไม่ใช้ voucher)
> **เวลารวม:** ~6-8 สัปดาห์ (ทำคนเดียว) / 3-4 สัปดาห์ (ทำ 2 คน)

---

## 🎯 ภาพรวม 3 Phases

```
Phase 1: FOUNDATION (2 สัปดาห์)  → ระบบส่งได้จริง
   ↓
Phase 2: AUTOMATION (2 สัปดาห์)  → Triggers ทำงาน 24/7
   ↓
Phase 3: ADVANCED (2-4 สัปดาห์)  → Drip + Approval + Analytics
```

---

# 📌 PHASE 1 — FOUNDATION (Sprint 1, 2 สัปดาห์)

> **เป้าหมาย:** Builder Wizard กด Submit แล้วส่ง LINE ถึงลูกค้าจริง

---

## ✅ Step 1: Cleanup Voucher (ครึ่งวัน)

### ทำไมต้องทำก่อน
ระบบมี voucher ปนอยู่ — ต้องลบออกก่อนจะไม่สับสน

### Tasks
- [ ] **Update migration** `20260424000002_create_marketing_tables.sql`
  - ลบ `CREATE TABLE vouchers`
  - ลบ `voucher_id` column ออกจาก `campaigns`
- [ ] **Update migration** `20260424000003_seed_marketing_demo_data.sql`
  - ลบ `INSERT INTO vouchers`
  - ลบ voucher reference ใน campaigns/triggers seed
- [ ] **ลบไฟล์** `src/pages/Vouchers.tsx`
- [ ] **ลบ route** `/vouchers` ใน `App.tsx`
- [ ] **ลบ sidebar link** "Vouchers" ใน `Sidebar.tsx`
- [ ] **ลบ Step 3** "แนบ Voucher" ใน `CampaignBuilderWizard.tsx`
- [ ] เปลี่ยนเป็น 3-step wizard:
  - Step 1: เลือก Segment + Property
  - Step 2: ออกแบบ LINE Push (เนื้อหา + รูป)
  - Step 3: ตั้งเวลา + ยืนยัน

**เวลา:** 4 ชั่วโมง

---

## ✅ Step 2: Apply Migrations พื้นฐาน (1 ชั่วโมง)

### Tasks
- [ ] เปิด Supabase Dashboard SQL Editor
- [ ] Apply `20260424000002_create_marketing_tables.sql` (updated)
- [ ] Apply `20260424000003_seed_marketing_demo_data.sql` (updated)
- [ ] ตรวจ tables ใหม่:
  - `segments` — มี 10 records
  - `triggers` — มี 6 records
  - `campaigns` — มี 10 records
- [ ] ตรวจว่า RLS policies ทำงาน (ลอง query โดย user ที่ tenant ต่าง)

**เวลา:** 1 ชั่วโมง

---

## ✅ Step 3: สร้าง Migrations ใหม่ — Recipients + Events + Unsubscribes (1 วัน)

### Tasks
- [ ] **สร้างไฟล์** `2026XXXX_create_campaign_recipients.sql`
  ```sql
  CREATE TABLE campaign_recipients (
    id, tenant_id, campaign_id,
    lead_id, customer_id, line_user_id,
    status, sent_at, read_at, clicked_at, ...
  );
  ```
- [ ] **สร้างไฟล์** `2026XXXX_create_campaign_events.sql`
  ```sql
  CREATE TABLE campaign_events (
    id, tenant_id, campaign_id, recipient_id,
    event_type, event_data, ...
  );
  ```
- [ ] **สร้างไฟล์** `2026XXXX_create_unsubscribes.sql` ⚠️ **PDPA**
  ```sql
  CREATE TABLE unsubscribes (
    id, tenant_id, customer_id, channel,
    reason, unsubscribed_at
  );
  ```
- [ ] เพิ่ม RLS policies ทุก table
- [ ] Apply ผ่าน Supabase Dashboard

**เวลา:** 1 วัน

---

## ✅ Step 4: Builder Wizard Save จริง (2 วัน)

### Tasks
- [ ] **เพิ่ม `handleSubmit()`** ใน `CampaignBuilderWizard.tsx`
  ```typescript
  const handleSubmit = async () => {
    // 1. Validate ทุก step
    // 2. INSERT into campaigns table
    const { data: campaign } = await supabase.from('campaigns').insert({
      tenant_id, campaign_code: generateCode(),
      campaign_name, headline, message_body, cta_text, cta_url,
      template, property_id, segments,
      schedule_type, scheduled_at,
      status: 'draft',
      approval_status: 'pending',
    }).select().single();

    // 3. Toast success + redirect
    navigate(`/campaigns/${campaign.id}`);
  };
  ```
- [ ] **เพิ่ม Auto-save Draft** (ทุก 30 วินาที)
- [ ] **เพิ่ม Validation** (ก่อน submit)
- [ ] **เพิ่ม Property selector** ใน Step 1 (multi-select properties จาก DB)
- [ ] **เพิ่ม Image upload** ใน Step 2 (ใช้ Supabase Storage)
- [ ] เพิ่ม `getSegmentsFromDB()` แทน hardcoded `SEGMENTS`

**เวลา:** 2 วัน

---

## ✅ Step 5: LINE Channel Setup (1 วัน)

### Tasks
- [ ] **สร้าง LINE Official Account** ที่ https://developers.line.biz
- [ ] **สร้าง Channel** ประเภท Messaging API
- [ ] **เก็บ secrets** ใน Supabase:
  ```bash
  LINE_CHANNEL_ACCESS_TOKEN=xxx
  LINE_CHANNEL_SECRET=xxx
  ```
- [ ] **ตั้ง Webhook URL** → Supabase Edge Function
- [ ] **Test** ส่งข้อความผ่าน LINE Console ก่อน

**เวลา:** 1 วัน (รวมเวลารอ approval LINE)

---

## ✅ Step 6: Edge Function — Send Campaign (3 วัน)

### Tasks
- [ ] **สร้าง folder** `supabase/functions/send-campaign/`
- [ ] **เขียน function** `index.ts`:
  ```typescript
  // Pseudocode
  serve(async (req) => {
    const { campaign_id } = await req.json();

    // 1. Load campaign
    const campaign = await loadCampaign(campaign_id);

    // 2. Load recipients (ตาม segments)
    const segments = campaign.segments;
    const recipients = await loadRecipientsBySegments(segments);

    // 3. Filter out unsubscribers (PDPA!)
    const filtered = await filterUnsubscribed(recipients, 'line');

    // 4. Insert into campaign_recipients (status='pending')
    await insertRecipients(campaign_id, filtered);

    // 5. Build Flex Message
    const flex = buildFlexMessage(campaign);

    // 6. Send batch (100 recipients/batch)
    for (const batch of chunks(filtered, 100)) {
      await Promise.all(batch.map(r => sendLinePush(r.line_user_id, flex)));
      // Update status='sent', sent_at=now()
    }

    // 7. Insert campaign_events (event_type='sent')
    return { success: true, sent: filtered.length };
  });
  ```
- [ ] **Helper functions:**
  - `loadRecipientsBySegments()` — query segment_members or evaluate rules
  - `filterUnsubscribed()` — exclude opt-outs
  - `buildFlexMessage()` — convert template → LINE Flex JSON
  - `sendLinePush()` — call LINE Messaging API
- [ ] **Deploy:** `supabase functions deploy send-campaign`

**เวลา:** 3 วัน

---

## ✅ Step 7: LINE Webhook (1 วัน)

### Tasks
- [ ] **สร้าง folder** `supabase/functions/line-webhook/`
- [ ] **Handle events:**
  - `follow` — มีคน add LINE OA → save to leads
  - `unfollow` — INSERT unsubscribes (channel='line')
  - `message` — log message
  - `postback` — handle CTA clicks
- [ ] **Verify signature** ด้วย LINE_CHANNEL_SECRET
- [ ] **Deploy + ตั้ง webhook URL**

**เวลา:** 1 วัน

---

## ✅ Step 8: Click Tracking (1 วัน)

### Tasks
- [ ] **สร้าง Edge Function** `track-click/`
- [ ] URL pattern: `/r/{event_id}` → redirect to actual URL
- [ ] Log event:
  ```typescript
  await supabase.from('campaign_events').insert({
    campaign_id, recipient_id,
    event_type: 'clicked',
    event_data: { url: actualUrl }
  });
  ```
- [ ] **Update Builder Wizard** — wrap CTA URL ด้วย tracking URL
- [ ] **Auto-generate UTM params** ทุก link

**เวลา:** 1 วัน

---

## ✅ Step 9: ทดสอบ End-to-End (1 วัน)

### Tasks
- [ ] สร้าง campaign ใน Builder Wizard
- [ ] กด Submit → ตรวจว่า save เข้า DB
- [ ] กด "Send Now" → ตรวจว่า:
  - Recipients ถูก insert
  - LINE message ส่งจริง
  - status update เป็น 'sent'
- [ ] เปิด LINE message → ตรวจว่า read_at update
- [ ] คลิก CTA → ตรวจว่า clicked_at update
- [ ] กด Unsubscribe → ตรวจว่า INSERT into unsubscribes
- [ ] ส่ง campaign อีกครั้ง → ตรวจว่า user ที่ unsub ไม่ได้รับ

**เวลา:** 1 วัน

---

## 📊 Phase 1 Summary

| Step | Duration | Output |
|---|---|---|
| 1. Cleanup voucher | 4 ชม. | Codebase สะอาด |
| 2. Apply migrations | 1 ชม. | DB tables พร้อม |
| 3. สร้าง migrations ใหม่ 3 ตัว | 1 วัน | recipients/events/unsubscribes |
| 4. Builder Wizard save | 2 วัน | กด Submit → save DB |
| 5. LINE Channel setup | 1 วัน | LINE OA พร้อม |
| 6. Edge Function send | 3 วัน | ส่ง LINE จริงได้ |
| 7. LINE Webhook | 1 วัน | รับ events จาก LINE |
| 8. Click tracking | 1 วัน | นับ click ได้ |
| 9. E2E test | 1 วัน | ใช้งานได้ |
| **รวม** | **~10 วัน (2 สัปดาห์)** | **MVP ใช้งานได้** |

---

# 📌 PHASE 2 — AUTOMATION (Sprint 2, 2 สัปดาห์)

> **เป้าหมาย:** Triggers ทำงาน 24/7 + ส่งเร็ว + analytics จริง

---

## ✅ Step 10: สร้าง Migrations เพิ่ม (ครึ่งวัน)

- [ ] `2026XXXX_create_trigger_executions.sql` — log + กันส่งซ้ำ
- [ ] `2026XXXX_create_segment_members.sql` — cache members
- [ ] Apply ทั้งสอง

**เวลา:** 4 ชั่วโมง

---

## ✅ Step 11: Segment Members Refresh Function (1 วัน)

### Tasks
- [ ] เขียน PostgreSQL function `refresh_segment_members(seg_id)`
- [ ] **Setup pg_cron** รัน daily 02:00:
  ```sql
  SELECT cron.schedule('refresh-segments', '0 2 * * *',
    $$ SELECT refresh_segment_members(id) FROM segments WHERE is_active = true; $$
  );
  ```
- [ ] **Manual refresh button** ใน Segments page

**เวลา:** 1 วัน

---

## ✅ Step 12: Trigger Worker (3 วัน)

### Tasks
- [ ] **สร้าง Edge Function** `trigger-worker/`
- [ ] **รัน cron ทุก 5 นาที** ผ่าน pg_cron:
  ```sql
  SELECT cron.schedule('trigger-worker', '*/5 * * * *',
    $$ SELECT net.http_post(url := 'xxx/functions/v1/trigger-worker'); $$
  );
  ```
- [ ] **Logic ใน worker:**
  ```typescript
  // For each active trigger:
  // 1. Find matching events (lead.created in last 5 min, etc.)
  // 2. Filter out users already triggered today (check trigger_executions)
  // 3. Execute action (send_line_message)
  // 4. INSERT trigger_executions
  // 5. Update triggers.fired_count
  ```
- [ ] **Database triggers** สำหรับ real-time events:
  ```sql
  CREATE TRIGGER lead_created_trigger
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION queue_lead_created_event();
  ```

**เวลา:** 3 วัน

---

## ✅ Step 13: Real Marketing Analytics (2 วัน)

### Tasks
- [ ] **อัปเดต** `MarketingAnalytics.tsx`:
  - ดึงข้อมูลจริงจาก `campaign_events` table
  - คำนวณ Open Rate, Click Rate, Conversion Rate
  - Top campaigns by revenue
  - Channel breakdown (LINE only ตอนนี้)
- [ ] **เพิ่ม Charts**:
  - Trend 30 วัน — sent/opened/clicked
  - Per-segment performance
  - Per-property conversion (campaign → property view → reservation)

**เวลา:** 2 วัน

---

## ✅ Step 14: Property Linkage in Builder (1 วัน)

### Tasks
- [ ] เพิ่ม **Property Selector** ใน Builder Wizard Step 1
- [ ] Multi-select properties จาก DB
- [ ] ใช้รูปจริงจาก property database (ไม่ใช่ Unsplash)
- [ ] Track conversion: campaign click → /properties/{id} view
- [ ] Property-level analytics

**เวลา:** 1 วัน

---

## 📊 Phase 2 Summary

| Step | Duration | Output |
|---|---|---|
| 10. Migrations เพิ่ม | 4 ชม. | trigger_executions, segment_members |
| 11. Segment refresh | 1 วัน | Cache + cron |
| 12. Trigger worker | 3 วัน | Automation 24/7 |
| 13. Real analytics | 2 วัน | Dashboard ใช้ data จริง |
| 14. Property linkage | 1 วัน | Campaign ผูก property |
| **รวม** | **~7 วัน (1.5 สัปดาห์)** | **Automation ครบ** |

---

# 📌 PHASE 3 — ADVANCED (Sprint 3, 2-4 สัปดาห์)

> **เป้าหมาย:** Drip campaigns + Approval workflow + Personalization

---

## ✅ Step 15: Drip Campaigns (5 วัน)

### Tasks
- [ ] **Migration** `2026XXXX_create_campaign_sequences.sql`
- [ ] **UI: Visual sequence builder** (drag-drop)
  - Add step
  - Set delay (immediate / 1 day / 3 days / 7 days / 14 days)
  - Branch logic (if opened → A, else → B)
- [ ] **Worker** — รัน cron ทุกชั่วโมง:
  - Find recipients ที่ถึง delay
  - Send next step
  - Update progress

**เวลา:** 5 วัน

---

## ✅ Step 16: Approval Workflow (3 วัน)

### Tasks
- [ ] **Migration** `2026XXXX_create_campaign_approvals.sql`
- [ ] **Builder Wizard** — เพิ่มปุ่ม "Submit for Approval"
- [ ] **Owner Inbox page** — รายการ pending campaigns
- [ ] **Approve/Reject** + comment
- [ ] **Notification** ให้ admin เมื่อ approved/rejected
- [ ] **Revision history** UI

**เวลา:** 3 วัน

---

## ✅ Step 17: Personalization Tokens (2 วัน)

### Tasks
- [ ] **Token picker** ใน textarea ของ Builder Wizard
- [ ] Tokens:
  - `{{first_name}}`, `{{last_name}}`
  - `{{property_interested}}`
  - `{{tenant_name}}`
  - `{{sales_name}}`
- [ ] **Render function** — แทนที่ token ตอนส่ง

**เวลา:** 2 วัน

---

## ✅ Step 18: A/B Testing (3 วัน) — Optional

- ส่ง variant A vs B ให้ 50/50
- Auto-pick winner หลัง 2 ชั่วโมง
- Apply winner กับ remaining audience

**เวลา:** 3 วัน

---

## 📊 Phase 3 Summary

| Step | Duration | Output |
|---|---|---|
| 15. Drip campaigns | 5 วัน | Multi-step sequences |
| 16. Approval workflow | 3 วัน | 2-eye principle |
| 17. Personalization | 2 วัน | Tokens |
| 18. A/B Testing (optional) | 3 วัน | Variant testing |
| **รวม** | **~10-13 วัน (2-3 สัปดาห์)** | **Production-grade** |

---

# 📅 Timeline ภาพรวม

```
Week 1-2:  Phase 1 — Foundation
           ├── Cleanup voucher
           ├── Migrations พื้นฐาน
           ├── Builder Wizard save
           ├── LINE Channel setup
           ├── Edge Functions
           └── E2E test
           ✅ MVP ใช้งานได้

Week 3-4:  Phase 2 — Automation
           ├── Triggers backend
           ├── Real analytics
           ├── Segment cache
           └── Property linkage
           ✅ Automation ครบ

Week 5-7:  Phase 3 — Advanced
           ├── Drip campaigns
           ├── Approval workflow
           ├── Personalization
           └── A/B testing (optional)
           ✅ Production-ready
```

---

# 🎯 Quick Win — เริ่มทำอันแรกตอนนี้

ถ้ามีเวลาแค่ **1 สัปดาห์แรก** ทำ 5 อันนี้ก่อน:

### 1. Cleanup voucher (ครึ่งวัน)
- ลบ Vouchers.tsx + route
- Update migrations ตัด voucher

### 2. Apply migrations พื้นฐาน (1 ชั่วโมง)
- Apply migration ที่ update แล้ว
- มี segments + triggers + campaigns พร้อม

### 3. Builder Wizard ปรับเป็น 3 step (1 วัน)
- Step 1: Segment + Property
- Step 2: LINE content
- Step 3: Schedule

### 4. Builder Wizard save จริง (2 วัน)
- handleSubmit() → INSERT campaigns table
- Auto-save draft

### 5. LINE Channel setup (1 วัน)
- สร้าง LINE OA
- เก็บ tokens
- Test ส่งจาก console

→ **5-6 วัน** จะมี Builder Wizard ที่ save จริงและ LINE OA พร้อมใช้

---

# 🛠️ Skills ที่ต้องการ

| Skill | จำเป็น | สำหรับ |
|---|---|---|
| TypeScript / React | ⭐⭐⭐ | Frontend pages |
| Tailwind CSS | ⭐⭐ | Styling |
| Supabase (PostgreSQL) | ⭐⭐⭐ | DB + RLS |
| Supabase Edge Functions (Deno) | ⭐⭐⭐ | Backend logic |
| LINE Messaging API | ⭐⭐⭐ | LINE integration |
| pg_cron / SQL functions | ⭐⭐ | Scheduled jobs |
| REST APIs | ⭐⭐ | LINE / external |

---

# 📋 Checklist — ก่อนปล่อย Production

### Functional
- [ ] Builder Wizard save campaign จริง
- [ ] LINE message ส่งถึงลูกค้าจริง
- [ ] ลูกค้ากด unsubscribe ได้ + ระบบเคารพ
- [ ] Triggers ทำงานอัตโนมัติทุกวัน
- [ ] Marketing Analytics แสดงข้อมูลจริง
- [ ] Property linkage ทุก campaign

### Compliance
- [ ] PDPA — opt-out tracking
- [ ] Privacy policy versioning
- [ ] Cookie consent banner
- [ ] Data export request (GDPR-style)
- [ ] Right to be forgotten

### Performance
- [ ] Segment cache refresh ทุกคืน
- [ ] Send batch 100/batch (ไม่ flood LINE API)
- [ ] Rate limiting (1000 req/min ต่อ tenant)
- [ ] Index ทุก foreign key

### Security
- [ ] RLS ทุก table
- [ ] Verify LINE webhook signature
- [ ] Sanitize message body (XSS)
- [ ] Audit log ทุก campaign send

### Monitoring
- [ ] Error tracking (Sentry?)
- [ ] LINE API quota monitoring
- [ ] Failed sends alert
- [ ] Trigger executions dashboard

---

# 🚦 Risk & Mitigation

| Risk | ผลกระทบ | วิธีลด |
|---|---|---|
| **LINE API rate limit** | Campaign ส่งช้า/fail | Batch 100/batch + retry queue |
| **PDPA non-compliance** | ปรับ 5M บาท | unsubscribes table + audit log |
| **Spam complaint** | LINE OA ถูกระงับ | Frequency capping + best-time send |
| **Segment evaluation ช้า** | UX แย่ | segment_members cache |
| **Campaign ส่งผิด** | เสียลูกค้า | Approval workflow + preview |
| **Trigger รันซ้ำ** | ส่งซ้ำซ้อน | trigger_executions + idempotency |

---

# 📚 References

## Documentation
- LINE Messaging API: https://developers.line.biz/en/docs/messaging-api/
- LINE Flex Message: https://developers.line.biz/en/docs/messaging-api/using-flex-messages/
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- pg_cron: https://github.com/citusdata/pg_cron
- PDPA Thailand: https://www.pdpc.or.th

## Internal Docs
- [`production-readiness-gap-analysis.md`](production-readiness-gap-analysis.md) — Full gap analysis
- [`marketing-migrations-plan.md`](marketing-migrations-plan.md) — DB migrations details

---

# 🎬 เริ่มเลย — Action Items แรก

```bash
# วันที่ 1
1. Update migration 20260424000002 (ตัด voucher) — 30 นาที
2. Apply migration via Supabase Dashboard — 15 นาที
3. ลบไฟล์ Vouchers.tsx + route — 10 นาที
4. Restart dev server + ตรวจ — 10 นาที

# วันที่ 2-3
5. ปรับ Builder Wizard เป็น 3 step (ตัด voucher step)
6. เพิ่ม handleSubmit() — INSERT into campaigns
7. ตรวจว่า save จริง

# วันที่ 4
8. สมัคร LINE Developer
9. สร้าง Channel + เก็บ tokens

# วันที่ 5-7
10. เขียน Edge Function send-campaign
11. ทดสอบส่ง LINE จริง

# สัปดาห์ที่ 2
12. สร้าง migrations campaign_recipients + events + unsubscribes
13. เขียน LINE webhook
14. Click tracking
15. E2E test
```

→ **ภายใน 2 สัปดาห์ จะมี Marketing module ที่ใช้งานได้จริง**

---

*เอกสารนี้สรุปขั้นตอนการ implement Marketing module แบบ step-by-step*
*อัปเดต: 2026-04-24*
