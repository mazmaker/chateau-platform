# 📋 Marketing Module — Database Migrations Plan

> แผนการสร้างตาราง database สำหรับ Marketing Module ของ CHATEAU
>
> **อัปเดต:** 2026-04-24 (Final — ตัด Voucher ออก, เน้น content distribution)
> **Scope:** ส่งข่าวสารโครงการอสังหาให้ลูกค้ากลุ่มเป้าหมาย
> **จำนวน Migrations:** 9 ไฟล์ (2 update + 7 ใหม่)

---

## 🎯 ภาพรวม

CHATEAU Marketing Module ใช้สำหรับ **ส่งข่าวสารโครงการอสังหาให้ลูกค้า** (ไม่ใช่ส่ง voucher/coupon)

### สิ่งที่ระบบต้องทำได้
1. ✅ สร้าง campaign + เลือกกลุ่มเป้าหมาย
2. ✅ ส่ง LINE ถึงลูกค้าจริง (พร้อมรูป + link)
3. ✅ Track ใครเปิด/คลิก/แปลงเป็น lead
4. ✅ ส่งอัตโนมัติเมื่อเกิด event (วันเกิด, lead ใหม่, ฯลฯ)
5. ✅ ส่งหลาย step ตามเวลา (drip)
6. ✅ Approval workflow ก่อนส่ง
7. ✅ เคารพ unsubscribe (PDPA)

---

## 📊 รายการ Migrations ทั้งหมด

| # | ไฟล์ | Action | Phase | สำคัญ |
|---|---|---|---|---|
| 1 | `20260424000002_create_marketing_tables.sql` | 🔄 Update | 1 | ⭐⭐⭐ |
| 2 | `20260424000003_seed_marketing_demo_data.sql` | 🔄 Update | 1 | ⭐⭐⭐ |
| 3 | `2026XXXX_create_campaign_recipients.sql` | 🆕 Create | 1 | ⭐⭐⭐ |
| 4 | `2026XXXX_create_campaign_events.sql` | 🆕 Create | 1 | ⭐⭐⭐ |
| 5 | `2026XXXX_create_unsubscribes.sql` | 🆕 Create | 1 | ⭐⭐⭐ |
| 6 | `2026XXXX_create_trigger_executions.sql` | 🆕 Create | 2 | ⭐⭐ |
| 7 | `2026XXXX_create_segment_members.sql` | 🆕 Create | 2 | ⭐⭐ |
| 8 | `2026XXXX_create_campaign_sequences.sql` | 🆕 Create | 3 | ⭐⭐ |
| 9 | `2026XXXX_create_campaign_approvals.sql` | 🆕 Create | 3 | ⭐⭐ |

---

# 🔄 ส่วนที่ 1 — Update Migrations เดิม (Phase 1)

---

## Migration 1: `20260424000002_create_marketing_tables.sql` — Update

### 🎯 ทำไมต้อง migrate
- สร้างตารางพื้นฐาน 3 ตัว (`segments`, `triggers`) ที่ Marketing Module ทุกอย่างต้องใช้
- เพิ่ม columns ใน `campaigns` ให้รองรับ Builder Wizard
- **ต้อง update** เพื่อตัด voucher ออก (ไม่อยู่ใน scope แล้ว)

### 📦 Tables ที่สร้าง
| Table | หน้าที่ |
|---|---|
| `segments` | กลุ่มเป้าหมายลูกค้า (filter rules) |
| `triggers` | Marketing automation rules |
| `campaigns` (extend) | เพิ่ม columns content + property |

### ❌ สิ่งที่ต้องลบออก
- `CREATE TABLE vouchers` ทั้งบล็อก
- `voucher_id UUID REFERENCES vouchers(id)` ใน `campaigns`
- ปรับ action_type ของ triggers ตัด `send_voucher`

### 📝 Schema (after update)

```sql
-- 1. SEGMENTS
CREATE TABLE segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filter_rules JSONB DEFAULT '{}',  -- {"income_min": 100000, ...}
  member_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, code)
);

-- 2. TRIGGERS (ปรับ action_type)
CREATE TABLE triggers (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  name VARCHAR(255),
  description TEXT,
  event_type VARCHAR(100),     -- 'lead.created', 'customer.birthday', etc.
  action_type VARCHAR(100),    -- 'send_line_message', 'send_email', 'assign_to_sales'
  action_config JSONB,
  is_active BOOLEAN,
  fired_count INT,
  ...
);

-- 3. EXTEND CAMPAIGNS (ตัด voucher_id)
ALTER TABLE campaigns ADD COLUMN
  property_id UUID REFERENCES properties(id),  -- 🏠 ผูกโครงการ
  campaign_type VARCHAR(50),                   -- launch/open_house/news/etc.
  cta_text VARCHAR(100),
  cta_url TEXT,
  template VARCHAR(50),                        -- bubble/carousel/image
  headline TEXT,
  message_body TEXT,
  attachment_urls JSONB,                       -- รูป + PDF
  schedule_type VARCHAR(20),                   -- now/schedule
  scheduled_at TIMESTAMPTZ,
  approval_status VARCHAR(20),
  approver_id UUID,
  approved_at TIMESTAMPTZ,
  utm_params JSONB;
```

### 🔗 ความสัมพันธ์
- `segments` ← campaigns ใช้ (ผ่าน column `segments TEXT[]`)
- `triggers` → ใช้ `segments` ผ่าน action_config
- `campaigns` → `properties` (ผูกโครงการ)

---

## Migration 2: `20260424000003_seed_marketing_demo_data.sql` — Update

### 🎯 ทำไมต้อง migrate
- ใส่ข้อมูลตัวอย่างให้ทดสอบระบบได้ทันที (ไม่ต้องสร้างเอง)
- **ต้อง update** ตัด voucher seed data ออก

### 📦 ข้อมูลที่ Seed
| Type | จำนวน | ตัวอย่าง |
|---|---|---|
| segments | 10 | รายได้สูง, ครอบครัว, บ้านหลังแรก, ฯลฯ |
| triggers | 6 | Lead ใหม่, วันเกิด, Cart abandoned, ฯลฯ |
| campaigns | 10 | BAAN ISSARA Phase 2, Family Weekend, ฯลฯ |

### ❌ สิ่งที่ต้องลบออก
- `INSERT INTO vouchers (...)` ทั้งบล็อก (6 records)
- ลบการ reference voucher ใน triggers seed
- ลบ voucher_code จาก campaign seed

---

# 🆕 ส่วนที่ 2 — Migrations ใหม่ (Phase 1 — Critical)

---

## Migration 3: `create_campaign_recipients.sql` 🆕

### 🎯 ทำไมต้อง migrate
1. **กันส่งซ้ำ** — ป้องกันลูกค้าได้รับ campaign เดียวกัน 2 ครั้ง
2. **Track delivery** — รู้ว่าใคร ส่งสำเร็จ/fail/bounced
3. **Retry logic** — ระบบส่งใหม่ได้ถ้า LINE API timeout
4. **Per-recipient analytics** — track พฤติกรรมแต่ละคน

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
ส่ง campaign → ใส่ใน queue → ส่ง LINE
ถ้า LINE API fail → ไม่รู้ว่าใครได้/ไม่ได้
ส่งใหม่ → คนที่ได้แล้วได้อีก = spam
```

**หลังมี:**
```
ส่ง campaign → INSERT 5,000 recipients (status='pending')
              → Worker หยิบ batch 100 → ส่ง LINE
              → Update status='sent' ทีละคน
ถ้า fail → status='failed' → retry ภายหลัง
```

### 📝 Schema
```sql
CREATE TABLE campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id),
  customer_id UUID REFERENCES customers(id),
  line_user_id TEXT,
  status VARCHAR(20) DEFAULT 'pending',  -- pending/sending/sent/failed/bounced
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, line_user_id)  -- 🔒 กันส่งซ้ำ
);

CREATE INDEX ON campaign_recipients(campaign_id, status);
CREATE INDEX ON campaign_recipients(scheduled_at) WHERE status = 'pending';
```

### 🔗 ความสัมพันธ์
- `campaigns` ← recipients (1:N)
- `leads` / `customers` ← recipients (1:N)
- `campaign_events` → recipients (track event)

### 💡 Use case จริง
```
Campaign "เปิดโครงการ BAAN ISSARA Phase 2"
  ↓
1. หาคนใน segment "รายได้สูง + บ้านหลังแรก" = 4,820 คน
2. INSERT 4,820 records (status='pending')
3. Edge Function หยิบ 100 records → ส่ง LINE
4. ส่งสำเร็จ → status='sent', sent_at=now()
5. LINE webhook → update read_at เมื่อเปิด
6. คลิก link → update clicked_at
```

---

## Migration 4: `create_campaign_events.sql` 🆕

### 🎯 ทำไมต้อง migrate
1. **Marketing analytics จริง** — ตอนนี้ Analytics ใช้ mock data
2. **คำนวณ ROI** — campaign ไหน work / ไม่ work
3. **Track conversion funnel** — campaign → property view → reservation
4. **Audit trail** — ทุก event ที่เกิดมี log

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
ส่ง campaign → ไม่รู้ว่ามีคนเปิด/คลิกกี่คน
Analytics dashboard = mock data ไม่จริง
ตัดสินใจไม่ได้ว่าจะปรับปรุงอะไร
```

**หลังมี:**
```
ทุก event → INSERT log
   sent / delivered / read / clicked / viewed_property / requested_info / scheduled_visit
        ↓
Aggregate query → CTR, conversion rate, revenue attribution
```

### 📝 Schema
```sql
CREATE TABLE campaign_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES campaign_recipients(id) ON DELETE CASCADE,
  event_type VARCHAR(30) NOT NULL,
  -- Event types:
  -- 'sent', 'delivered', 'read', 'clicked',
  -- 'viewed_property', 'requested_info', 'scheduled_visit',
  -- 'unsubscribed', 'bounced'
  event_data JSONB,
  -- เช่น: {url, property_id, action, conversion_amount, ...}
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON campaign_events(campaign_id, event_type);
CREATE INDEX ON campaign_events(created_at DESC);
CREATE INDEX ON campaign_events(recipient_id);
```

### 🔗 ความสัมพันธ์
- `campaigns` ← events (1:N)
- `campaign_recipients` ← events (1:N)

### 💡 Use case จริง
```sql
-- Marketing Analytics: คำนวณ CTR + Conversion ของ campaign
SELECT
  COUNT(*) FILTER (WHERE event_type = 'sent')              AS sent,
  COUNT(*) FILTER (WHERE event_type = 'read')              AS opened,
  COUNT(*) FILTER (WHERE event_type = 'clicked')           AS clicked,
  COUNT(*) FILTER (WHERE event_type = 'viewed_property')   AS viewed,
  COUNT(*) FILTER (WHERE event_type = 'scheduled_visit')   AS visits,
  ROUND(100.0 * COUNT(*) FILTER (WHERE event_type = 'clicked')
        / NULLIF(COUNT(*) FILTER (WHERE event_type = 'sent'), 0), 2) AS ctr_pct
FROM campaign_events
WHERE campaign_id = 'xxx'
  AND created_at > NOW() - INTERVAL '30 days';
```

---

## Migration 5: `create_unsubscribes.sql` 🆕 ⚠️ **PDPA**

### 🎯 ทำไมต้อง migrate — กฎหมายบังคับ
**พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)** บังคับ:
- ลูกค้ามีสิทธิ์ขอหยุดรับ marketing **ตลอดเวลา**
- ถ้าส่งซ้ำหลัง opt-out → **ปรับสูงสุด 5 ล้านบาท** ต่อกรณี
- จำคุก 6 เดือน - 1 ปี + ปรับ 500k-1M

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
Day 1: ลูกค้ากด "ยกเลิกการรับข่าวสาร"
Day 2: ระบบส่ง campaign ใหม่ → ลูกค้าได้รับอีก
Day 3: ลูกค้าร้องเรียน PDPA committee
Day 4: ปรับ 1-5 ล้านบาท + เสียชื่อเสียง
```

**หลังมี:**
```
ลูกค้ากด unsubscribe → INSERT into unsubscribes
ก่อนส่งทุกครั้ง → SELECT exclude users in unsubscribes
✅ PDPA compliant
```

### 📝 Schema
```sql
CREATE TABLE unsubscribes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  customer_id UUID REFERENCES customers(id),
  lead_id UUID REFERENCES leads(id),
  channel VARCHAR(20) NOT NULL,    -- 'line', 'email', 'sms'
  reason VARCHAR(255),              -- "ไม่อยากได้แล้ว", "เยอะเกิน"
  unsubscribed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, channel),
  UNIQUE(lead_id, channel)
);

CREATE INDEX ON unsubscribes(channel, customer_id);
```

### 🔗 ความสัมพันธ์
- ใช้กับ `customers` / `leads`
- Filter ก่อนส่งทุก campaign / trigger

### 💡 Use case จริง
```typescript
// ก่อนส่ง campaign — เช็ค unsubscribes
const recipients = await supabase
  .from('customers')
  .select('id, line_user_id')
  .in('id', segmentMemberIds)
  .not('id', 'in',
    supabase.from('unsubscribes')
      .select('customer_id')
      .eq('channel', 'line')
  );
// ✅ ส่งเฉพาะคนที่ยังไม่ unsubscribe
```

### ⚖️ ผลทางกฎหมายถ้าไม่ทำ
| โทษ | จำนวน |
|---|---|
| ปรับทางปกครอง | สูงสุด **5,000,000 บาท** ต่อกรณี |
| โทษอาญา | จำคุก 6 เดือน - 1 ปี |
| ค่าเสียหายทางแพ่ง | ตามที่ลูกค้าฟ้อง |
| ชื่อเสียง | ขึ้นข่าว/social media |

---

# 🆕 ส่วนที่ 3 — Migrations เพิ่มเติม (Phase 2 — Automation)

---

## Migration 6: `create_trigger_executions.sql` 🆕

### 🎯 ทำไมต้อง migrate
1. **กันส่งซ้ำ** — trigger "วันเกิด" ส่งให้คนเดิมในวันเดียวกัน 2 ครั้งไม่ได้
2. **Debug** — รู้ว่า trigger รันสำเร็จ/fail เมื่อไร ที่ไหน
3. **Audit trail** — ใครได้ trigger อะไรเมื่อไร
4. **Idempotency** — รัน trigger ซ้ำได้โดยไม่ส่งซ้ำ

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
Cron 09:00 รัน "วันเกิดลูกค้า" → ส่งให้ 50 คน
Cron 10:00 รันอีกรอบ (ผิดพลาด) → ส่งซ้ำให้ 50 คนอีก
ลูกค้าได้ HBD message 2 ครั้ง = ดูไม่ pro
```

**หลังมี:**
```
Cron 09:00 รัน → INSERT trigger_executions → ส่ง
Cron 10:00 รันอีก → SELECT FROM trigger_executions WHERE today = ✅ skip
✅ ส่ง 1 ครั้งต่อวัน
```

### 📝 Schema
```sql
CREATE TABLE trigger_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  target_id UUID NOT NULL,        -- lead_id หรือ customer_id
  target_type VARCHAR(20),        -- 'lead' or 'customer'
  status VARCHAR(20),             -- queued/running/success/failed
  result_data JSONB,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  -- 🔒 Idempotency: 1 trigger ส่งให้ 1 target ได้ 1 ครั้งต่อวัน
  UNIQUE(trigger_id, target_id, DATE(executed_at))
);

CREATE INDEX ON trigger_executions(trigger_id, executed_at DESC);
CREATE INDEX ON trigger_executions(target_id);
```

### 🔗 ความสัมพันธ์
- `triggers` ← executions (1:N)
- ใช้กับ `leads` / `customers`

### 💡 Use case จริง
```sql
-- Cron 09:00 — ส่งวันเกิด
WITH birthday_customers AS (
  SELECT c.id FROM customers c
  WHERE EXTRACT(MONTH FROM c.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    AND EXTRACT(DAY FROM c.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
),
already_sent AS (
  SELECT target_id FROM trigger_executions
  WHERE trigger_id = 'birthday-trigger-id'
    AND DATE(executed_at) = CURRENT_DATE
)
SELECT id FROM birthday_customers
WHERE id NOT IN (SELECT target_id FROM already_sent);
-- ✅ ส่งเฉพาะคนที่ยังไม่ได้รับวันนี้
```

---

## Migration 7: `create_segment_members.sql` 🆕 (Performance)

### 🎯 ทำไมต้อง migrate
**ส่ง campaign ช้ามาก** ถ้าต้อง re-evaluate segment rules ทุกครั้ง

### 📌 ปัญหาที่แก้
**ก่อนมี (ไม่มี cache):**
```
ส่ง campaign 1: query 5 วินาที (filter customers ตาม rules)
ส่ง campaign 2: query 5 วินาที (re-evaluate ใหม่อีกรอบ)
ส่ง campaign 3: query 5 วินาที
รวม: 15 วินาที × ทุกครั้ง
```

**หลังมี (cache):**
```
[02:00 ทุกคืน] Refresh cache: 60 วินาที (ครั้งเดียว/วัน)

ส่ง campaign 1: 0.05 วินาที (lookup จาก cache)
ส่ง campaign 2: 0.05 วินาที
ส่ง campaign 3: 0.05 วินาที
รวม: 0.15 วินาที (เร็วขึ้น 100 เท่า)
```

### 📝 Schema
```sql
CREATE TABLE segment_members (
  segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  member_id UUID NOT NULL,
  member_type VARCHAR(20) NOT NULL,  -- 'lead' or 'customer'
  added_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (segment_id, member_id, member_type)
);

CREATE INDEX ON segment_members(member_id);
CREATE INDEX ON segment_members(segment_id);

-- Function refresh
CREATE FUNCTION refresh_segment_members(seg_id UUID) RETURNS void AS $$
BEGIN
  DELETE FROM segment_members WHERE segment_id = seg_id;
  -- Re-evaluate rules + INSERT
  INSERT INTO segment_members (segment_id, member_id, member_type)
  SELECT seg_id, c.id, 'customer'
  FROM customers c WHERE -- evaluate filter_rules from segments table
    ...;
  UPDATE segments SET member_count = (
    SELECT COUNT(*) FROM segment_members WHERE segment_id = seg_id
  ) WHERE id = seg_id;
END;
$$ LANGUAGE plpgsql;

-- pg_cron — refresh daily 02:00
SELECT cron.schedule('refresh-segments', '0 2 * * *',
  $$ SELECT refresh_segment_members(id) FROM segments WHERE is_active = true; $$);
```

### 🔗 ความสัมพันธ์
- `segments` ← members (1:N) — cache table
- ใช้กับ `customers` / `leads`

### 💡 Performance Impact
```
ส่ง campaign 5 อันต่อวัน × 50,000 customers:
- ❌ ไม่มี cache: 25 วินาที × 5 = 125 วิ/campaign run = หนัก DB
- ✅ มี cache:    Refresh 60 วิ + 5×0.05 = 60.25 วิ/วัน
                = เร็วขึ้น 1000x ในระยะยาว
```

---

# 🆕 ส่วนที่ 4 — Migrations Advanced (Phase 3)

---

## Migration 8: `create_campaign_sequences.sql` 🆕

### 🎯 ทำไมต้อง migrate
รองรับ **Drip Campaigns** — ส่งหลาย step ตามเวลา

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
Lead ใหม่ → ส่ง welcome message ครั้งเดียว → จบ
ลูกค้าลืม CHATEAU ภายใน 1 สัปดาห์
```

**หลังมี:**
```
Lead ใหม่ → ส่ง drip series:
  Day 0:  Welcome + brochure
  Day 3:  Floor plan
  Day 7:  Customer testimonials
  Day 14: Construction update
  Day 30: Special offer
ลูกค้าจำ CHATEAU ตลอดเดือน → conversion สูงขึ้น 5×
```

### 📝 Schema
```sql
CREATE TABLE campaign_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name VARCHAR(100),
  delay_hours INT DEFAULT 0,  -- 0=immediate, 24=Day 1, 168=Day 7
  template VARCHAR(50),        -- bubble/carousel/image/buttons
  headline TEXT,
  message_body TEXT,
  attachment_urls JSONB,
  cta_text VARCHAR(100),
  cta_url TEXT,
  branch_condition JSONB,      -- {if_opened: 'step_3', else: 'step_5'}
  UNIQUE(campaign_id, step_order)
);

CREATE INDEX ON campaign_sequences(campaign_id, step_order);
```

### 🔗 ความสัมพันธ์
- `campaigns` ← sequences (1:N)
- ใช้ `campaign_recipients` track progress per step

### 💡 Use case จริง
```
"Welcome Series" สำหรับ Lead ใหม่:
campaign_sequences:
  Step 1 (delay=0):    Welcome message
  Step 2 (delay=72):   Floor plan (Day 3)
  Step 3 (delay=168):  Testimonials (Day 7)
  Step 4 (delay=336):  Construction update (Day 14)
  Step 5 (delay=720):  Open house invitation (Day 30)
```

---

## Migration 9: `create_campaign_approvals.sql` 🆕

### 🎯 ทำไมต้อง migrate
รองรับ **Approval Workflow** — admin สร้าง + owner approve ก่อนส่ง

### 📌 ปัญหาที่แก้
**ก่อนมี:**
```
Admin คลิก "Send" → ส่งทันที 5,000 คน
ถ้าราคาผิด → ลูกค้ามาทวงสิทธิ์ → เสียหาย
```

**หลังมี (2-Eye Principle):**
```
Admin สร้าง → "Submit for Approval"
Status: pending_approval
  ↓
Owner เห็นใน inbox → preview ทุกอย่าง
  ↓
Approve / Reject + comment
  ↓ ถ้า Approved → ส่งจริง
```

### 📝 Schema
```sql
CREATE TABLE campaign_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id),
  action VARCHAR(20) NOT NULL,  -- requested/approved/rejected/revised
  comment TEXT,
  reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON campaign_approvals(campaign_id, reviewed_at DESC);
```

### 🔗 ความสัมพันธ์
- `campaigns` ← approvals (1:N) — revision history
- `users` ← approvals (approver)

### 💡 Use case จริง
```
Day 1 09:00: Admin สร้าง campaign → action='requested'
Day 1 14:00: Owner reject → action='rejected', comment='ราคาผิด'
Day 1 15:00: Admin แก้ + submit → action='requested' (ใหม่)
Day 1 16:00: Owner approve → action='approved'
Day 1 18:00: Cron worker ส่งจริง
```

---

# 📅 Roadmap การ Apply

## Sprint 1 (สัปดาห์ 1-2) — พื้นฐานทำงานได้
```sql
1. Update 20260424000002_create_marketing_tables.sql  -- ตัด voucher
2. Update 20260424000003_seed_marketing_demo_data.sql -- ตัด voucher seed
3. Apply ทั้งสอง

4. Create 2026XXXX_create_campaign_recipients.sql
5. Create 2026XXXX_create_campaign_events.sql
6. Create 2026XXXX_create_unsubscribes.sql            -- PDPA
7. Apply ทั้งสาม
```
✅ Builder Wizard save ได้ + LINE ส่งจริง + tracking + PDPA compliant

## Sprint 2 (สัปดาห์ 3-4) — Triggers Backend
```sql
8. Create 2026XXXX_create_trigger_executions.sql
9. Create 2026XXXX_create_segment_members.sql
10. Apply ทั้งสอง + Setup pg_cron
```
✅ Triggers รันได้จริง + ส่งเร็ว 100×

## Sprint 3 (สัปดาห์ 5-6) — Advanced
```sql
11. Create 2026XXXX_create_campaign_sequences.sql
12. Create 2026XXXX_create_campaign_approvals.sql
13. Apply ทั้งสอง
```
✅ Drip campaigns + Approval workflow

---

# 🛡️ Row Level Security (RLS) Pattern

ทุก table ต้องมี RLS policies เหมือนกัน — filter by tenant:

```sql
-- Pattern เดียวกันทุก table:
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_<table>" ON <table> FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_insert_<table>" ON <table> FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_update_<table>" ON <table> FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "tenant_delete_<table>" ON <table> FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
```

---

# 📊 ER Diagram (ภาพรวม)

```
tenants
  │
  ├── segments
  │     └── segment_members (cache, 1:N)
  │
  ├── triggers
  │     └── trigger_executions (log, 1:N)
  │
  ├── campaigns ←─── property_id ──→ properties
  │     ├── campaign_recipients (1:N) ←─── lead/customer
  │     ├── campaign_events (1:N)
  │     ├── campaign_sequences (1:N)  -- drip steps
  │     └── campaign_approvals (1:N)  -- workflow
  │
  └── unsubscribes ←─── lead/customer (PDPA)
```

---

# 🔧 วิธี Apply Migrations

## Option A: Supabase Dashboard (แนะนำ)
1. ไป https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql/new
2. Copy SQL จากไฟล์ใน `supabase/migrations/`
3. Paste → Run **ทีละไฟล์ตามลำดับ timestamp**
4. ตรวจ tables ใน Database tab

## Option B: Supabase CLI
```bash
npm install -g supabase
supabase link --project-ref pqnjvcbmnatrtvpqnrdx
supabase db push
```

## Option C: ผ่าน MCP
ตอนนี้ access token issue — ต้อง refresh

---

# 📋 Checklist หลัง Apply

### ตรวจสอบ schema
- [ ] `segments` table มีอยู่ + 10 records
- [ ] `triggers` table มีอยู่ + 6 records
- [ ] `campaigns` มี columns ใหม่ครบ
- [ ] `campaign_recipients` พร้อมใช้
- [ ] `campaign_events` พร้อมใช้
- [ ] `unsubscribes` พร้อมใช้

### ตรวจสอบ RLS
- [ ] Login ด้วย user ของ tenant A → เห็นเฉพาะ tenant A
- [ ] ลอง query tenant อื่น → ถูก reject

### ตรวจสอบ indexes
- [ ] `campaign_recipients(campaign_id, status)` — fast lookup
- [ ] `campaign_events(campaign_id, event_type)` — fast aggregation
- [ ] `unsubscribes(channel, customer_id)` — fast filter

---

# 📝 สรุปสั้นๆ — แต่ละตารางทำไม

| Table | ทำไม |
|---|---|
| **segments** | กลุ่มเป้าหมายที่ filter ตาม rules — campaign ทุกอันต้องมี |
| **triggers** | Automation rules — ส่งอัตโนมัติเมื่อเกิด event |
| **campaigns** (extend) | เพิ่มฟิลด์ content + property linkage |
| **campaign_recipients** | กันส่งซ้ำ + track per-recipient |
| **campaign_events** | Analytics จริง (open/click/conversion) |
| **unsubscribes** | PDPA — ลูกค้ายกเลิกแล้วไม่ส่งซ้ำ (ปรับ 5M) |
| **trigger_executions** | กัน trigger รันซ้ำ + audit log |
| **segment_members** | Cache เพื่อ performance (เร็วขึ้น 100×) |
| **campaign_sequences** | Drip campaigns (Day 1, 3, 7, 14) |
| **campaign_approvals** | 2-eye principle ก่อนส่งจริง |

---

# 🚦 Critical Path

**ขั้นต่ำที่ต้องมีก่อน production:**
1. ✅ **unsubscribes** — กฎหมาย PDPA บังคับ (ปรับ 5M ถ้าไม่มี)
2. ✅ **campaign_recipients** — กันส่งซ้ำ
3. ✅ **campaign_events** — analytics จริง

**ทำหลังก็ได้ (ไม่ critical):**
- `trigger_executions` — เริ่มไม่มีก็ได้ (ส่งซ้ำได้แต่ไม่ดี)
- `segment_members` — เริ่มไม่มีก็ได้ (ช้าแต่ทำงาน)
- `campaign_sequences` — เริ่มไม่มีก็ได้ (ส่งครั้งเดียวได้)
- `campaign_approvals` — เริ่มไม่มีก็ได้ (ใช้ trust admin)

---

# 📚 Reference

- **PDPA Thailand:** https://www.pdpc.or.th
- **Supabase RLS:** https://supabase.com/docs/guides/auth/row-level-security
- **pg_cron:** https://github.com/citusdata/pg_cron
- **LINE Messaging API:** https://developers.line.biz/en/docs/messaging-api/

---

*เอกสารนี้สรุปแผน database migrations สำหรับ Marketing Module · อัปเดต 2026-04-24*
*หลัง apply ทุก migration → Marketing Module พร้อม production*
