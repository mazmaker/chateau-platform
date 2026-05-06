# 🎯 Segment Recommendations — CHATEAU Marketing

> คู่มือเลือก Segment สำหรับยิงแคมเปญ + ข้อมูลที่ใช้คำนวณ
>
> **อัปเดต:** 2026-04-24
> **Scope:** Real Estate Marketing (CHATEAU Platform)

---

## 💡 แบ่ง Segments เป็น 4 กลุ่มใหญ่

```
👤 ใคร?            →  Demographic (อายุ/รายได้/ครอบครัว)
📊 อยู่ stage ไหน?  →  Lifecycle (Lead ใหม่ → Lost)
🏠 สนใจอะไร?       →  Interest (ประเภท/งบ/โครงการ)
💰 มูลค่าแค่ไหน?    →  Tier (VIP/Gold/Repeat)
```

---

# 🎯 Top 10 Segments ที่ควรใช้

## 🔥 ส่งบ่อยสุด (4 อัน)

| # | Segment | ส่งอะไร | ข้อมูลที่ใช้ |
|---|---|---|---|
| 1 | **Lead ใหม่ 7 วัน** | Welcome + Brochure | `leads.created_at` |
| 2 | **Hot Lead** (qualified + high priority) | Sales push, exclusive | `leads.status` + `priority` |
| 3 | **Cold Lead เงียบ 30 วัน** | Win-back, ความคืบหน้า | `leads.last_contact_date` |
| 4 | **ดูแล้วไม่ติดต่อ 24 ชม.** | Auto follow-up + floor plan | `lead_interests.created_at` |

## 💼 ตามประเภทลูกค้า (3 อัน)

| # | Segment | ส่งอะไร | ข้อมูลที่ใช้ |
|---|---|---|---|
| 5 | **บ้านหลังแรก** | Starter guide, low down | `lead_interests.purpose` |
| 6 | **ลงทุน/เก็งกำไร** | ROI, rental yield | `lead_interests.purpose` |
| 7 | **ครอบครัว** (มี dependents) | บ้าน 3-4 ห้อง | `customers.preferences` |

## 💰 ตามมูลค่า (3 อัน)

| # | Segment | ส่งอะไร | ข้อมูลที่ใช้ |
|---|---|---|---|
| 8 | **VIP** (ซื้อ 10M+) | Penthouse, private tour | `bookings.total_amount` |
| 9 | **ลูกค้าซื้อซ้ำ** | Referral, exclusive | `bookings` count |
| 10 | **ครบรอบ 1 ปี** | ขอบคุณ + ข่าวสาร | `customers.created_at` |

---

# 🗺️ ตารางเลือก Segment ตาม Campaign

> **อยากส่งอะไร? เลือก Segment นี้!**

## 🏗️ เปิดโครงการใหม่ (Project Launch)
**Segments แนะนำ:**
- ✅ **VIP** (ลูกค้าซื้อแพง)
- ✅ **Hot Lead** (qualified + high priority)
- ✅ **บ้านหลังแรก** (ถ้าโครงการตรง target)
- ✅ **สนใจประเภทเดียวกัน** (condo/house)

## 🏠 Open House (นัดดูบ้าน)
**Segments แนะนำ:**
- ✅ **ครอบครัว** (มีบุตร)
- ✅ **Lead ใหม่ 7-30 วัน**
- ✅ **สนใจประเภทตรงกัน**

## 📈 Construction Update
**Segments แนะนำ:**
- ✅ **ลูกค้าที่จองแล้ว**
- ✅ **สนใจโครงการนี้**

## 🔥 Sales Update (ห้องเหลือ)
**Segments แนะนำ:**
- ✅ **Cold Lead** (กระตุ้นกลับ)
- ✅ **ดูแล้วไม่ติดต่อ**
- ✅ **สนใจประเภทนี้**

## 🎉 Event Invitation
**Segments แนะนำ:**
- ✅ **VIP**
- ✅ **ครอบครัว**
- ✅ **ลูกค้า + Hot Lead** ทั้งหมด

## 📰 Newsletter
**Segments แนะนำ:**
- ✅ **ทุกคน** ที่ยังไม่ unsubscribe

---

# 📦 ข้อมูลใช้คำนวณ — มาจาก 3 ตารางหลัก

```
👤 customers
   ├── อายุ        ← date_of_birth
   ├── รายได้     ← preferences (JSONB)
   ├── ครอบครัว    ← preferences
   └── ครบรอบ      ← created_at

🎯 leads
   ├── สถานะ       ← status (new/qualified/won/lost)
   ├── อายุ Lead   ← created_at
   ├── เงียบนานแค่ไหน ← last_contact_date
   └── ความสำคัญ    ← priority

🏠 lead_interests
   ├── สนใจโครงการไหน  ← property_id
   ├── ประเภท          ← properties.type (condo/house)
   ├── จุดประสงค์      ← purpose (first_home/investment)
   └── งบประมาณ       ← budget_range

💰 bookings (สำหรับ tier)
   ├── มูลค่ารวม     ← SUM(total_amount)
   └── จำนวนซื้อ      ← COUNT(id)
```

---

# 🔍 7 หมวด Segments แบบละเอียด

## A. 👤 Demographic — ใคร

### A1. รายได้สูง (income > 100k) 💰
**ส่ง:** Penthouse, VIP exclusive
**Filter:** `customers.preferences->>'income' >= 100000`

### A2. รายได้ปานกลาง (30k-100k)
**ส่ง:** Mass-market projects, ฟรีค่าโอน
**Filter:** `30000 <= income <= 100000`

### A3. กลุ่มอายุน้อย (18-30) 🎓
**ส่ง:** คอนโดเริ่มต้น, ใกล้ BTS, first home
**Filter:** อายุจาก `date_of_birth` ระหว่าง 18-30

### A4. วัยกลางคน (31-50) 👨‍💼
**ส่ง:** บ้านเดี่ยว, townhouse, ครอบครัว
**Filter:** อายุ 31-50

### A5. ครอบครัว (มี dependents) 👨‍👩‍👧
**ส่ง:** บ้าน 3-4 ห้องนอน, ใกล้โรงเรียน
**Filter:** `household_size >= 2 AND has_children = true`

---

## B. 📊 Lead Lifecycle — Stage

### B1. Lead ใหม่ 7 วัน 🌱
**ส่ง:** Welcome series, brochure
**Filter:** `created_at >= NOW() - 7 days`

### B2. Hot Lead 🔥
**ส่ง:** Sales priority, exclusive offers
**Filter:** `status IN ('qualified', 'negotiating') AND priority = 'high'`

### B3. Cold Lead (เงียบ 30 วัน) 🥶
**ส่ง:** Re-engagement, win-back
**Filter:** `last_contact_date < NOW() - 30 days`

### B4. Lost Lead 💔
**ส่ง:** Special win-back campaign
**Filter:** `status = 'lost'`

---

## C. 👀 Activity-based — พฤติกรรม

### C1. ดูโครงการแล้วไม่ติดต่อ 24 ชม.
**ส่ง:** Auto follow-up + floor plan
**Filter:** ดูใน `lead_interests` แต่ `last_contact_date` ก่อนหน้านั้น

### C2. นัดดูห้องแล้ว ⭐
**ส่ง:** Reminder, prep checklist

### C3. ดูห้องแล้วยังไม่จอง 🤔
**ส่ง:** Compare other units, special offer

### C4. กำลังเจรจา 🤝
**ส่ง:** Sales push, financial options
**Filter:** `status = 'negotiating'`

---

## D. 🏠 Property Interest — สนใจอะไร

### D1. สนใจคอนโด 🏢
**ส่ง:** เปิดคอนโดใหม่, urban living
**Filter:** `lead_interests` join `properties.type = 'condo'`

### D2. สนใจบ้านเดี่ยว 🏡
**Filter:** `properties.type = 'house'`

### D3. สนใจ Property เฉพาะ
**ส่ง:** Project update, construction progress
**Filter:** `lead_interests.property_id = X`

### D4. งบ 1-3 ล้าน 💵
**Filter:** `leads.estimated_value` ระหว่าง 1-3M

### D5. งบ 3-10 ล้าน
**Filter:** `estimated_value` 3-10M

### D6. งบ 10M+ (Premium)
**ส่ง:** Penthouse, luxury exclusive
**Filter:** `estimated_value >= 10M`

---

## E. 🎯 Buyer Type — จุดประสงค์

### E1. บ้านหลังแรก 🏠
**ส่ง:** First-buyer guide, low down-payment
**Filter:** `lead_interests.purpose = 'first_home'`

### E2. ลงทุน/เก็งกำไร 📈
**ส่ง:** ROI analysis, rental yield
**Filter:** `purpose = 'investment'`

### E3. ปล่อยเช่า 🏘️
**ส่ง:** Rental management, location near transit
**Filter:** `purpose = 'rental'`

### E4. อยู่อาศัยจริง
**Filter:** `purpose = 'primary_residence'`

---

## F. 👑 Customer Tier — มูลค่าลูกค้า

### F1. VIP (ซื้อ 10M+)
**ส่ง:** Exclusive events, private penthouse tour
**Filter:** `SUM(bookings.total_amount) >= 10M`

### F2. Gold (5-10M) 🥇
**Filter:** `SUM >= 5M AND SUM < 10M`

### F3. ลูกค้าซื้อซ้ำ (Repeat) 🔁
**ส่ง:** Referral programs
**Filter:** `COUNT(bookings) >= 2`

### F4. ลูกค้าใหม่ (ซื้อ < 1 ปี) 🌟
**ส่ง:** Welcome, post-purchase support

### F5. ครบรอบ 1 ปี 🎂
**ส่ง:** Anniversary message
**Filter:** `customers.created_at` ตรงวัน/เดือนนี้

---

## G. 📧 Engagement — LINE behavior

### G1. High Engagement (เปิด > 50%)
**ส่ง:** Premium campaigns ที่ต้องการ ROI สูง

### G2. Low Engagement (เปิด < 10%)
**ส่ง:** Re-activation, ลด frequency

### G3. Never Opened
**ส่ง:** Different channel (email/SMS), or remove

---

# 🎬 3 Scenarios จริง

## Scenario 1: เปิดโครงการ BAAN ISSARA Phase 2

```
👥 ใครได้รับ?
  ├─ ✅ VIP (ลูกค้าซื้อแพง)
  ├─ ✅ Hot Lead (กำลังเจรจา)
  ├─ ✅ สนใจ Phase 1 ก่อนหน้า
  └─ ✅ งบ 5-10M

📊 รวม ~800 คน · คาด CTR 35%
```

## Scenario 2: Re-engage Cold Leads

```
👥 ใครได้รับ?
  ├─ ✅ Lead เงียบ 30 วัน
  ├─ ✅ Lost lead
  └─ ❌ หัก unsubscribed ออก

📊 รวม ~1,200 คน · คาด CTR 12%
```

## Scenario 3: Open House วันเสาร์

```
👥 ใครได้รับ?
  ├─ ✅ ครอบครัว (มีบุตร)
  ├─ ✅ Lead ใหม่ 30 วัน
  ├─ ✅ สนใจบ้านเดี่ยว
  └─ ❌ หักคนที่จองแล้ว

📊 รวม ~3,500 คน · คาด CTR 18%
```

---

# 📋 ตาราง Segment x Campaign Type

✅ = แนะนำมาก / ⚠️ = ใช้ได้บ้าง / ❌ = ไม่เหมาะ

| Segment | Project Launch | Open House | Construction | Sales Update | Newsletter |
|---|---|---|---|---|---|
| รายได้สูง | ✅ Premium | ✅ VIP slot | ✅ | ❌ | ⚠️ |
| รายได้ปานกลาง | ✅ Mass | ✅ Public | ✅ | ✅ | ✅ |
| กลุ่มอายุน้อย | ✅ Condo | ⚠️ | ⚠️ | ✅ | ✅ |
| วัยกลางคน | ✅ บ้าน | ✅ | ✅ | ✅ | ✅ |
| ครอบครัว | ✅ บ้านใหญ่ | ✅ Family | ✅ | ✅ | ✅ |
| Lead ใหม่ 7d | ❌ | ✅ Welcome | ❌ | ❌ | ✅ Drip |
| Hot Lead | ✅ Pre-sale | ✅ Priority | ✅ | ✅ Urgent | ❌ |
| Cold Lead | ⚠️ | ❌ | ✅ Win-back | ✅ Discount | ⚠️ |
| สนใจคอนโด | ✅ คอนโดใหม่ | ⚠️ | ✅ | ✅ | ✅ |
| สนใจบ้าน | ❌ | ✅ Open house | ✅ | ✅ | ✅ |
| งบ 10M+ | ✅ Penthouse | ✅ VIP | ✅ | ❌ | ⚠️ |
| First Home | ✅ Starter | ✅ | ✅ | ✅ | ✅ |
| Investment | ⚠️ ROI | ⚠️ | ✅ Yield | ✅ | ✅ |
| VIP | ✅ Exclusive | ✅ Private | ✅ | ❌ | ⚠️ |
| Repeat | ✅ Pre-launch | ✅ Priority | ✅ | ✅ | ✅ Loyalty |

---

# ⚡ กฎ 3 ข้อในการเลือก Segment

## 1. **เลือกให้ตรง** ไม่กว้างเกิน
- ❌ ส่ง "ทุกคน" → CTR ต่ำ + spam + เสียเงิน
- ✅ ส่ง "ครอบครัว + งบ 5M" → CTR สูง 3-5×

## 2. **หัก unsubscribed ทุกครั้ง**
- ระบบทำให้อัตโนมัติ (PDPA บังคับ)
- ฝ่าฝืน → ปรับสูงสุด 5 ล้านบาท

## 3. **อย่าส่งซ้ำกลุ่มเดียวกัน 7 วัน**
- ส่งซ้ำ → Annoying → Unsubscribe → ผิดกฎหมาย

---

# 🚀 แนะนำเริ่มต้น

ถ้าเพิ่งเริ่มใช้ระบบ — สร้าง **5 segments** นี้ก่อนพอ:

| ลำดับ | Segment | ใช้กับ |
|---|---|---|
| 1 | **Lead ใหม่ 7 วัน** | Welcome series |
| 2 | **Hot Lead** | Sales priority |
| 3 | **Cold Lead 30 วัน** | Re-engage |
| 4 | **VIP ลูกค้า** | Exclusive events |
| 5 | **ครอบครัว + งบ 5M+** | Premium campaigns |

ค่อยเพิ่มเป็น **10-15 segments** เมื่อมีข้อมูลเยอะขึ้น

---

# 📐 Source Tables Summary

| Segment Type | Tables ที่ใช้ | Fields หลัก |
|---|---|---|
| **Demographic** | `customers` | preferences, date_of_birth, nationality |
| **Lead Lifecycle** | `leads` | status, created_at, last_contact_date |
| **Activity** | `leads`, `lead_interests` | status, last_contact_date |
| **Property Interest** | `lead_interests`, `properties` | property_id, property_type |
| **Buyer Type** | `lead_interests` | purpose |
| **Customer Tier** | `customers`, `bookings` | total_amount, booking_count |
| **Engagement** | `campaign_events` (รอสร้าง) | event_type, opened_at |
| **Geographic** | `customers.address` | province, district |

---

# 🎯 Best Practices

## ทำ ✅
- ✅ ใช้ AND ระหว่าง segments (เจาะจง)
- ✅ Refresh `member_count` ทุกคืน
- ✅ Test ส่งกับกลุ่มเล็ก 100 คน ก่อน rollout
- ✅ Track CTR per segment เพื่อปรับ

## ไม่ทำ ❌
- ❌ ส่งทุกคนใน DB (= spam)
- ❌ ใช้ segment เดียวกันส่งซ้ำๆ
- ❌ ไม่เคยทดสอบ → blast 10,000 คน
- ❌ ลืมเช็ค unsubscribes

---

# 📊 KPI Benchmark (Real Estate Marketing)

| Metric | Bad | Average | Good | Excellent |
|---|---|---|---|---|
| **Open Rate** | < 30% | 30-50% | 50-70% | 70%+ |
| **Click Rate** | < 5% | 5-15% | 15-25% | 25%+ |
| **Conversion** | < 0.5% | 0.5-2% | 2-5% | 5%+ |
| **Unsubscribe** | > 2% | 1-2% | 0.5-1% | < 0.5% |

**เป้าหมาย CHATEAU:**
- Open Rate ≥ 50%
- Click Rate ≥ 15%
- Unsubscribe ≤ 1%

---

# 🔗 References

- [`marketing-migrations-plan.md`](marketing-migrations-plan.md) — Database migrations
- [`marketing-implementation-roadmap.md`](marketing-implementation-roadmap.md) — Implementation steps
- [`production-readiness-gap-analysis.md`](production-readiness-gap-analysis.md) — Gap analysis
- [`database-structure-overview.md`](database-structure-overview.md) — All DB tables

---

*เอกสารนี้สรุปคำแนะนำ Segments สำหรับ CHATEAU Marketing · อัปเดต 2026-04-24*
