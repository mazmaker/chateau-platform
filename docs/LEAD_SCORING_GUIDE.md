# Lead Scoring & Loan Estimation - คู่มือการใช้งาน

## 📋 ภาพรวม

ฟีเจอร์ Lead Scoring และ Loan Estimation ช่วยประเมิน:
1. **คะแนนความน่าจะเป็นในการซื้อ** (Potential Score) - ประเมินว่า Lead มีโอกาสซื้อมากน้อยแค่ไหน
2. **วงเงินกู้ที่สามารถขอได้** (Loan Estimation) - ประเมินความสามารถในการกู้เงินซื้ออสังหาริมทรัพย์

---

## 🚀 การเริ่มใช้งาน

### 1. Run Database Migration

```bash
# เชื่อมต่อกับ Supabase project
cd supabase

# Push migration
npx supabase db push
```

หรือรัน migration ผ่าน Supabase Dashboard:
1. เข้า https://supabase.com/dashboard
2. เลือก Project
3. ไปที่ SQL Editor
4. Copy & Paste จากไฟล์ `supabase/migrations/20260112_add_lead_scoring_fields.sql`
5. Run SQL

### 2. ตรวจสอบว่า Migration สำเร็จ

```sql
-- ตรวจสอบว่ามี columns ใหม่
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'leads'
  AND column_name IN ('credit_score', 'potential_score', 'max_loan_amount');
```

---

## 📊 ฟิลด์ข้อมูลที่เพิ่มเข้ามา

### Financial Information
| Field | Type | Description | Range |
|-------|------|-------------|-------|
| `credit_score` | INTEGER | คะแนนเครดิต | 300-850 |
| `monthly_debt` | DECIMAL | หนี้สินต่อเดือน (บาท) | >= 0 |
| `down_payment_ready` | DECIMAL | เงินดาวน์ที่พร้อม (บาท) | >= 0 |
| `savings` | DECIMAL | เงินออม (บาท) | >= 0 |

### Employment Information
| Field | Type | Description | Options |
|-------|------|-------------|---------|
| `employment_type` | VARCHAR | ประเภทงาน | government, private, business, freelance |
| `years_employed` | DECIMAL | อายุงาน (ปี) | >= 0 |
| `company_name` | VARCHAR | ชื่อบริษัท | - |

### Demographics
| Field | Type | Description |
|-------|------|-------------|
| `household_size` | INTEGER | จำนวนสมาชิก |
| `marital_status` | VARCHAR | สถานภาพ (single/married/divorced/widowed) |
| `has_co_borrower` | BOOLEAN | มีผู้กู้ร่วมหรือไม่ |
| `number_of_dependents` | INTEGER | จำนวนผู้ที่ต้องดูแล |

### Property History
| Field | Type | Description |
|-------|------|-------------|
| `is_first_time_buyer` | BOOLEAN | ซื้อครั้งแรกหรือไม่ |
| `existing_properties` | INTEGER | อสังหาฯที่มีอยู่ (จำนวน) |
| `sold_property_recently` | BOOLEAN | เพิ่งขายอสังหาฯหรือไม่ |

### Behavioral Data
| Field | Type | Description |
|-------|------|-------------|
| `website_visits` | INTEGER | จำนวนครั้งที่เข้าชมเว็บ |
| `pages_viewed` | INTEGER | จำนวนหน้าที่ดู |
| `time_on_site` | INTEGER | เวลาบนเว็บ (นาที) |
| `brochure_downloads` | INTEGER | ดาวน์โหลดโบรชัวร์ |
| `site_visit_attended` | BOOLEAN | เยี่ยมชมโครงการแล้วหรือไม่ |

### Intent Signals
| Field | Type | Description | Options |
|-------|------|-------------|---------|
| `urgency_level` | VARCHAR | ความเร่งด่วน | high, medium, low |
| `decision_maker` | BOOLEAN | ผู้ตัดสินใจหลักหรือไม่ | - |
| `financing_approved` | BOOLEAN | ได้รับอนุมัติสินเชื่อแล้วหรือไม่ | - |

### Scoring Results (Cached)
| Field | Type | Description |
|-------|------|-------------|
| `potential_score` | INTEGER | คะแนนรวม (0-100) |
| `financial_score` | INTEGER | คะแนนด้านการเงิน (0-100) |
| `engagement_score` | INTEGER | คะแนนการมีส่วนร่วม (0-100) |
| `urgency_score` | INTEGER | คะแนนความเร่งด่วน (0-100) |
| `fit_score` | INTEGER | คะแนนความเหมาะสม (0-100) |
| `conversion_probability` | DECIMAL | โอกาสซื้อ (0-1) |
| `score_last_updated` | TIMESTAMP | วันที่คำนวณล่าสุด |

### Loan Estimation Results (Cached)
| Field | Type | Description |
|-------|------|-------------|
| `max_loan_amount` | DECIMAL | วงเงินกู้สูงสุด (บาท) |
| `estimated_monthly_payment` | DECIMAL | ค่างวดต่อเดือน (บาท) |
| `estimated_interest_rate` | DECIMAL | อัตราดอกเบี้ย (%) |
| `loan_term_years` | INTEGER | ระยะเวลากู้ (ปี) |
| `dti_ratio` | DECIMAL | Debt-to-Income ratio (%) |
| `ltv_ratio` | DECIMAL | Loan-to-Value ratio (%) |
| `loan_approval_probability` | DECIMAL | โอกาสอนุมัติ (0-1) |
| `loan_last_updated` | TIMESTAMP | วันที่คำนวณล่าสุด |

---

## 💻 การใช้งานใน Code

### 1. คำนวณ Lead Score

```typescript
import { calculateLeadScore } from '@/lib/leadScoring';
import type { LeadScoringData } from '@/types/leadScoring';

// เตรียมข้อมูล Lead
const leadData: LeadScoringData = {
  // Financial
  credit_score: 750,
  monthly_income: 80000,
  monthly_debt: 15000,
  down_payment_ready: 2000000,

  // Employment
  employment_type: 'private',
  years_employed: 5,

  // Demographics
  age: 35,
  marital_status: 'married',
  household_size: 4,

  // Behavioral
  website_visits: 8,
  pages_viewed: 25,
  site_visit_attended: true,
  brochure_downloads: 3,

  // Intent
  urgency_level: 'high',
  decision_maker: true,
  interest_level: 'high',

  // Budget
  budget_min: 5000000,
  budget_max: 7000000,
  purchase_timeline: '3_months',
};

// คำนวณคะแนน
const score = calculateLeadScore(leadData);

console.log('Overall Score:', score.overall_score); // 0-100
console.log('Conversion Probability:', score.conversion_probability); // 0-1
console.log('Breakdown:', score.score_breakdown);
console.log('Recommendations:', score.recommendations);
```

### 2. คำนวณวงเงินกู้

```typescript
import { estimateLoan } from '@/lib/loanEstimation';
import type { LoanEstimationInput } from '@/types/leadScoring';

const loanInput: LoanEstimationInput = {
  // Required
  monthly_income: 80000,
  monthly_debt: 15000,
  property_value: 6000000,
  down_payment: 1800000,
  credit_score: 750,

  // Optional
  age: 35,
  employment_type: 'private',
  years_employed: 5,
  loan_term_years: 30,
  has_co_borrower: true,
};

const estimation = estimateLoan(loanInput);

console.log('Max Loan:', estimation.max_loan_amount);
console.log('Monthly Payment:', estimation.monthly_payment);
console.log('Interest Rate:', estimation.interest_rate);
console.log('DTI Ratio:', estimation.affordability.dti_ratio);
console.log('Approval Probability:', estimation.affordability.approval_probability);
```

### 3. แสดงผลใน CDP Page

```typescript
import { PotentialScoreCard } from '@/components/leads/PotentialScoreCard';
import { LoanEstimationCard } from '@/components/leads/LoanEstimationCard';

function LeadCDPPage() {
  const [score, setScore] = useState<PotentialScore | null>(null);
  const [estimation, setEstimation] = useState<LoanEstimation | null>(null);

  useEffect(() => {
    // Load lead data from database
    const leadData = loadLeadData();

    // Calculate scores
    const calculatedScore = calculateLeadScore(leadData);
    setScore(calculatedScore);

    // Calculate loan estimation (if enough data)
    if (canCalculateLoan(leadData)) {
      const loanEst = estimateLoan({
        monthly_income: leadData.monthly_income!,
        monthly_debt: leadData.monthly_debt || 0,
        property_value: leadData.budget_max!,
        down_payment: leadData.down_payment_ready || 0,
        credit_score: leadData.credit_score!,
        age: leadData.age,
        employment_type: leadData.employment_type,
        years_employed: leadData.years_employed,
      });
      setEstimation(loanEst);
    }
  }, []);

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {score && <PotentialScoreCard score={score} />}
      {estimation && <LoanEstimationCard estimation={estimation} />}
    </div>
  );
}
```

---

## 🎯 Scoring Algorithm

### คะแนนรวม (Overall Score) = 0-100

คำนวณจาก 4 ปัจจัยหลัก:

```
Overall Score =
  (Financial Score × 0.35) +
  (Engagement Score × 0.25) +
  (Urgency Score × 0.20) +
  (Fit Score × 0.20)
```

### 1. Financial Score (35%)

**ปัจจัยย่อย:**
- **คะแนนเครดิต (40%)**: 750+ = 100, 700-749 = 80, 650-699 = 60, <650 = 30
- **อัตราส่วนรายได้ต่อราคา (30%)**: ≤3x = 100, ≤5x = 70, ≤7x = 40, >7x = 20
- **เงินดาวน์ (20%)**: ≥30% = 100, ≥20% = 80, ≥10% = 50, <10% = 20
- **ความมั่นคงในงาน (10%)**: ข้าราชการ+5ปี = 100, เอกชน+5ปี = 70

### 2. Engagement Score (25%)

**ปัจจัยย่อย:**
- **กิจกรรมบนเว็บ (30%)**: เข้าชม + หน้าที่ดู
- **ดาวน์โหลดเอกสาร (25%)**: จำนวนโบรชัวร์ที่ดาวน์โหลด
- **เยี่ยมชมโครงการ (25%)**: เคย/ไม่เคย
- **การติดต่อ (20%)**: จำนวนครั้งที่ติดต่อ

### 3. Urgency Score (20%)

**ปัจจัยย่อย:**
- **ระดับความเร่งด่วน (60%)**: High = 100, Medium = 60, Low = 30
- **กรอบเวลาซื้อ (40%)**: 1 เดือน = 100, 3 เดือน = 80, 6 เดือน = 60, >6 เดือน = 30

### 4. Fit Score (20%)

**ปัจจัยย่อย:**
- **ระดับความสนใจ (40%)**: High = 100, Medium = 60, Low = 30
- **ความชัดเจนงบประมาณ (30%)**: ช่วงราคาแคบ = ดี
- **ผู้ตัดสินใจ (20%)**: ใช่ = 100, ไม่ = 50
- **อนุมัติสินเชื่อแล้ว (10%)**: ใช่ = 100, ไม่ = 40

---

## 💰 Loan Estimation Algorithm

### การคำนวณวงเงินกู้สูงสุด

```
Max Loan = MIN(
  Max Loan by DTI,
  Max Loan by LTV
)
```

#### 1. Max Loan by DTI (Debt-to-Income)

```
Max Monthly Debt = Monthly Income × 43%
Available for Housing = Max Monthly Debt - Existing Debt
Max Loan = Calculate from Monthly Payment using Amortization Formula
```

#### 2. Max Loan by LTV (Loan-to-Value)

```
Max Loan by LTV = Property Value × 90%
Max Loan after Down Payment = Property Value - Down Payment
Max Loan = MIN(Max Loan by LTV, Max Loan after Down Payment)
```

### อัตราดอกเบี้ย (Interest Rate)

**Base Rate by Credit Score:**
- 750+: 4.5% ต่อปี
- 700-749: 5.5% ต่อปี
- 650-699: 6.5% ต่อปี
- <650: 7.5% ต่อปี

**Adjustments:**
- ข้าราชการ: -0.5%
- Freelance: +0.5%

### DTI & LTV Standards

**DTI (Debt-to-Income) Ratio:**
- Excellent: ≤ 28%
- Good: ≤ 36%
- Fair: ≤ 43%
- Poor: > 43%

**LTV (Loan-to-Value) Ratio:**
- Excellent: ≤ 70%
- Good: ≤ 80%
- Fair: ≤ 90%
- Poor: > 90%

### Approval Probability

```
Probability = Base(50%) +
  Credit Score Impact(40%) +
  DTI Ratio Impact(30%) +
  LTV Ratio Impact(20%) +
  Employment Stability(10%)
```

---

## 🎨 UI Components

### PotentialScoreCard

แสดง:
- คะแนนรวม (0-100) พร้อมความเชื่อมั่น
- โอกาสในการซื้อ (%)
- รายละเอียดคะแนนแยกตามปัจจัย
- ปัจจัยสำคัญที่มีผลต่อคะแนน
- จุดแข็ง/จุดอ่อน
- คำแนะนำและแผนการดำเนินการ

### LoanEstimationCard

แสดง:
- วงเงินกู้สูงสุดและแนะนำ
- ค่างวดต่อเดือน
- อัตราดอกเบี้ยและระยะเวลา
- โอกาสอนุมัติ
- DTI, LTV, Housing Expense Ratio
- รายละเอียดสินเชื่อ (ดอกเบี้ย, ยอดชำระรวม)
- ปัจจัยการอนุมัติ
- ข้อควรระวังและคำแนะนำ

---

## 📈 Best Practices

### 1. การเก็บข้อมูล

**ข้อมูลที่สำคัญที่สุด (Must Have):**
- คะแนนเครดิต
- รายได้ต่อเดือน
- หนี้สินต่อเดือน
- งบประมาณ
- เงินดาวน์ที่พร้อม

**ข้อมูลที่ควรมี (Should Have):**
- ประเภทงานและอายุงาน
- การมีส่วนร่วม (website visits, downloads)
- ระดับความเร่งด่วน
- การเยี่ยมชมโครงการ

### 2. การอัพเดทคะแนน

```typescript
// อัพเดทคะแนนทุกครั้งที่มีการเปลี่ยนแปลงข้อมูลสำคัญ
async function updateLeadScore(leadId: string) {
  // 1. ดึงข้อมูล Lead
  const lead = await getLeadById(leadId);

  // 2. คำนวณคะแนนใหม่
  const score = calculateLeadScore(lead);

  // 3. บันทึกลง Database
  await supabase
    .from('leads')
    .update({
      potential_score: score.overall_score,
      financial_score: score.score_breakdown.financial_score,
      engagement_score: score.score_breakdown.engagement_score,
      urgency_score: score.score_breakdown.urgency_score,
      fit_score: score.score_breakdown.fit_score,
      conversion_probability: score.conversion_probability,
      score_last_updated: new Date().toISOString(),
    })
    .eq('id', leadId);
}
```

### 3. Performance Optimization

- **Cache scores**: เก็บคะแนนที่คำนวณแล้วใน database
- **Background jobs**: คำนวณคะแนนแบบ async
- **Batch processing**: คำนวณหลาย leads พร้อมกัน

```typescript
// Background job example
async function recalculateAllScores() {
  const leads = await getAllLeads();

  for (const lead of leads) {
    try {
      await updateLeadScore(lead.id);
    } catch (error) {
      console.error(`Failed to update score for lead ${lead.id}:`, error);
    }
  }
}

// Run every night at 2 AM
scheduleJob('0 2 * * *', recalculateAllScores);
```

---

## 🔄 Roadmap

### Phase 1: Rule-based (Current) ✅
- Rule-based scoring algorithm
- Loan estimation calculator
- UI components

### Phase 2: Machine Learning (Next)
- Collect historical data (100-500 leads)
- Train ML model (GradientBoostingClassifier)
- Hybrid approach (Rule-based + ML)
- Model evaluation and tuning

### Phase 3: Advanced Features
- A/B testing different scoring models
- Real-time score updates
- Predictive analytics
- Integration with CRM workflows
- Automated lead routing based on scores

---

## ❓ FAQ

### Q: ต้องมีข้อมูลครบทุกฟิลด์ไหม?
A: ไม่จำเป็น Algorithm สามารถทำงานได้แม้ข้อมูลไม่ครบ แต่ยิ่งมีข้อมูลมาก ความแม่นยำยิ่งสูง

### Q: คะแนนต่ำกว่า 50 แปลว่าอะไร?
A: แปลว่า Lead นี้มีโอกาสซื้อต่ำ แต่ไม่ควรทิ้ง ควร nurture และติดตามต่อ

### Q: จะปรับ weights ของ scoring ได้ไหม?
A: ได้ แก้ไขได้ที่ `src/lib/leadScoring.ts` ในส่วน `DEFAULT_CONFIG`

### Q: Loan estimation แม่นยำแค่ไหน?
A: เป็นการประเมินเบื้องต้น ธนาคารแต่ละแห่งอาจมีเกณฑ์ต่างกัน ควรใช้เป็นแนวทางเท่านั้น

### Q: สามารถใช้ ML model แทนได้ไหม?
A: ได้ เมื่อมีข้อมูล historical มากพอ (100-500 leads) สามารถเทรน ML model และรวมกับ rule-based

---

## 📞 Support

หากมีปัญหาหรือคำถาม:
1. ตรวจสอบ logs ใน console
2. ดู error messages จาก API
3. ตรวจสอบว่า migration รันสำเร็จ
4. ติดต่อทีมพัฒนา

---

**Created**: 2026-01-12
**Version**: 1.0.0
**Model**: Rule-based Scoring Algorithm
