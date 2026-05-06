# รายงานการออกแบบ Monorepo แยกตาม Role — CHATEAU Platform

**วันที่วิเคราะห์:** 5 พฤษภาคม 2569  
**วิเคราะห์จาก:** branch `001-production-readiness` (production)

---

## 1. วิเคราะห์ระบบ Role ปัจจุบัน

### Role ที่มีในระบบ (3 roles)

| Role | ชื่อ | หน้าที่ |
|------|------|--------|
| `owner` | เจ้าของแพลตฟอร์ม | ดูแล tenant ทั้งหมด, billing, payment |
| `admin` | ผู้ดูแลบริษัท | ดูแล user, property, campaign ของบริษัทตัวเอง |
| `sales` | พนักงานขาย | จัดการ lead, ลูกค้า, ดู property |

> **หมายเหตุ:** `customer` ยังไม่มีในระบบปัจจุบัน — ลูกค้าเป็นแค่ข้อมูลใน database ยังไม่ได้ login ได้ → ต้องสร้างใหม่

---

### หน้า (Pages) ปัจจุบัน แยกตาม Role

#### Owner เท่านั้น
| Route | Page | ไฟล์ |
|-------|------|------|
| `/owner` | Owner Dashboard | `pages/OwnerDashboard.tsx` |
| `/tenants` | จัดการ Tenant ทั้งหมด | `pages/TenantManagement.tsx` |
| `/billing` | Billing Management | `pages/BillingManagement.tsx` |
| `/payments` | Payment Dashboard | `pages/PaymentDashboard.tsx` |

#### Owner + Admin
| Route | Page | ไฟล์ |
|-------|------|------|
| `/users` | จัดการผู้ใช้ | `pages/UserManagement.tsx` |
| `/campaigns` | Campaign Management | `pages/CampaignManagement.tsx` |
| `/customization` | Admin Customization | `pages/AdminCustomization.tsx` |
| `/analytics` | Analytics | `pages/Analytics.tsx` |
| `/api` | API Management | `pages/ApiManagement.tsx` |

#### Owner + Admin + Sales (ทุก Role)
| Route | Page | ไฟล์ |
|-------|------|------|
| `/` | Dashboard | `pages/Index.tsx` |
| `/leads` | Lead Management | `pages/LeadManagement.tsx` |
| `/leads/:id/cdp` | Lead CDP | `pages/LeadCDP.tsx` |
| `/properties` | Property Management | `pages/PropertyManagement.tsx` |
| `/projects` | Projects | `pages/Projects.tsx` |
| `/settings` | Settings | `pages/Settings.tsx` |

---

### สิทธิ์ (Permissions) ปัจจุบัน

| Permission | Owner | Admin | Sales | Customer (ใหม่) |
|-----------|:-----:|:-----:|:-----:|:--------------:|
| ดู property | ✓      | ✓     | ✓        | ✓ |
| จัดการ property| ✓   | ✓      | ✗       | ✗ |
| จัดการ leads | ✓     | ✓     | ✓       | ✗ |
| จัดการ user | ✓     | ✓      | ✗        | ✗ |
| จัดการ billing | ✓  | ✗      | ✗        | ✗ |
| ดู tenant ทั้งหมด | ✓ | ✗      | ✗        | ✗ |
| ดู booking ตัวเอง | ✗ | ✗       | ✗        | ✓ |
| ติดต่อ sales     | ✗  | ✗ |     ✗ |         ✓ |

---

## 2. โครงสร้าง Monorepo ที่ออกแบบ

### แนวคิดหลัก
> **1 Role = 1 App = 1 URL แยกกัน**  
> ทุก App ใช้ shared packages ร่วมกัน (UI, Types, Supabase)

```
chateau-platform/                      ← monorepo root
│
├── apps/
│   ├── owner/      → owner.chateau.app      ← เจ้าของแพลตฟอร์ม
│   ├── admin/      → app.chateau.app        ← ผู้ดูแลบริษัท
│   ├── sales/      → sales.chateau.app      ← พนักงานขาย
│   └── customer/   → my.chateau.app         ← ลูกค้า (ใหม่)
│
├── packages/
│   ├── ui/         → @chateau/ui            ← component กลาง
│   ├── types/      → @chateau/types         ← TypeScript types กลาง
│   ├── supabase/   → @chateau/supabase      ← Supabase client + auth
│   └── config/     → @chateau/config        ← tailwind + tsconfig
│
├── supabase/                               ← database (ไม่เปลี่ยน)
│   ├── migrations/
│   └── functions/
│
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. รายละเอียดแต่ละ App

---

### 🟣 apps/owner — Owner Portal

**URL:** `owner.chateau.app`  
**ผู้ใช้:** เจ้าของแพลตฟอร์ม CHATEAU  
**หน้าที่:** มองเห็นและจัดการทุกบริษัท (tenant) บนแพลตฟอร์ม

#### หน้าที่ย้ายมาจากระบบเดิม

```
apps/owner/src/
├── pages/
│   ├── Dashboard.tsx          ← จาก OwnerDashboard.tsx
│   ├── TenantList.tsx         ← จาก TenantManagement.tsx
│   ├── TenantDetail.tsx       ← จาก TenantManagement.tsx (/:id)
│   ├── Billing.tsx            ← จาก BillingManagement.tsx
│   ├── Payments.tsx           ← จาก PaymentDashboard.tsx
│   └── Settings.tsx           ← จาก Settings.tsx (owner section)
├── components/
│   ├── TenantCard.tsx
│   ├── RevenueChart.tsx
│   ├── PlatformStats.tsx
│   └── SubscriptionBadge.tsx
└── App.tsx
```

#### สิ่งที่เห็นใน Dashboard

```
┌─────────────────────────────────────────┐
│  CHATEAU Owner Portal                    │
├──────────────┬──────────────────────────┤
│  Sidebar:    │  Overview:               │
│  📊 Dashboard│  - จำนวน tenant ทั้งหมด  │
│  🏢 Tenants  │  - Revenue รวม           │
│  💳 Billing  │  - Tenant ที่ active      │
│  💰 Payments │  - Subscription breakdown│
│  ⚙️ Settings │                          │
└──────────────┴──────────────────────────┘
```

---

### 🔵 apps/admin — Admin Portal

**URL:** `app.chateau.app`  
**ผู้ใช้:** ผู้ดูแลบริษัทอสังหาริมทรัพย์แต่ละแห่ง  
**หน้าที่:** บริหารจัดการบริษัทของตัวเอง (property, user, lead, campaign)

#### หน้าที่ย้ายมาจากระบบเดิม

```
apps/admin/src/
├── pages/
│   ├── Dashboard.tsx          ← จาก Index.tsx (admin view)
│   ├── UserManagement.tsx     ← จาก UserManagement.tsx
│   ├── PropertyManagement.tsx ← จาก PropertyManagement.tsx
│   ├── Projects.tsx           ← จาก Projects.tsx
│   ├── LeadManagement.tsx     ← จาก LeadManagement.tsx
│   ├── Campaigns.tsx          ← จาก CampaignManagement.tsx
│   ├── Analytics.tsx          ← จาก Analytics.tsx
│   ├── Customization.tsx      ← จาก AdminCustomization.tsx
│   ├── ApiManagement.tsx      ← จาก ApiManagement.tsx
│   └── Settings.tsx           ← จาก Settings.tsx (admin section)
├── components/
│   ├── StatsCards.tsx
│   ├── SalesOverview.tsx
│   ├── PropertyTable.tsx
│   └── InviteUserModal.tsx
└── App.tsx
```

#### สิ่งที่เห็นใน Dashboard

```
┌─────────────────────────────────────────────┐
│  CHATEAU Admin — [ชื่อบริษัท]               │
├──────────────┬──────────────────────────────┤
│  Sidebar:    │  Overview:                   │
│  📊 Dashboard│  - KPI รายเดือน             │
│  🏠 Property │  - สถิติ lead                │
│  👥 Users    │  - Sales performance        │
│  📋 Leads    │  - Revenue chart            │
│  📣 Campaign │                              │
│  🎨 Customize│                              │
│  ⚙️ Settings │                              │
└──────────────┴──────────────────────────────┘
```

---

### 🟢 apps/sales — Sales Portal

**URL:** `sales.chateau.app`  
**ผู้ใช้:** พนักงานขายของแต่ละบริษัท  
**หน้าที่:** จัดการ lead และลูกค้าของตัวเอง ดู property

#### หน้าที่ย้ายมาจากระบบเดิม

```
apps/sales/src/
├── pages/
│   ├── Dashboard.tsx          ← จาก Index.tsx (sales view)
│   ├── MyLeads.tsx            ← จาก LeadManagement.tsx (filtered by sales_id)
│   ├── LeadDetail.tsx         ← จาก LeadManagement.tsx /:id
│   ├── LeadCDP.tsx            ← จาก LeadCDP.tsx
│   ├── Properties.tsx         ← จาก PropertyManagement.tsx (view only)
│   ├── Projects.tsx           ← จาก Projects.tsx (view only)
│   └── Settings.tsx           ← จาก Settings.tsx (profile only)
├── components/
│   ├── MyLeadCard.tsx
│   ├── LoanEstimationCard.tsx ← จาก components/leads/
│   ├── PotentialScoreCard.tsx ← จาก components/leads/
│   └── PaymentModal.tsx       ← จาก components/leads/
└── App.tsx
```

#### สิ่งที่เห็นใน Dashboard

```
┌─────────────────────────────────────────────┐
│  CHATEAU Sales — [ชื่อพนักงาน]              │
├──────────────┬──────────────────────────────┤
│  Sidebar:    │  My Performance:             │
│  📊 Dashboard│  - Lead ที่ดูแลอยู่          │
│  📋 My Leads │  - เป้าหมายเดือนนี้          │
│  🏠 Property │  - Converted leads           │
│  👤 Profile  │  - Commission estimate       │
└──────────────┴──────────────────────────────┘
```

---

### 🟡 apps/customer — Customer Portal (ใหม่ทั้งหมด)

**URL:** `my.chateau.app`  
**ผู้ใช้:** ลูกค้าที่สนใจซื้อ/เช่า property  
**หน้าที่:** ดู property, ติดตาม booking ของตัวเอง, ติดต่อ sales

> ต้องสร้างใหม่ทั้งหมด — ปัจจุบัน customer ยังไม่มี login ได้

#### ต้องสร้างใหม่

```
apps/customer/src/
├── pages/
│   ├── Home.tsx               ← หน้าแรก แสดง property ที่แนะนำ
│   ├── Properties.tsx         ← ค้นหา/กรอง property (public view)
│   ├── PropertyDetail.tsx     ← รายละเอียด property + จอง
│   ├── MyBookings.tsx         ← การจองของฉัน
│   ├── MyDocuments.tsx        ← เอกสารที่เกี่ยวข้อง
│   ├── ContactSales.tsx       ← ติดต่อพนักงานขาย
│   └── Profile.tsx            ← ข้อมูลส่วนตัว
├── components/
│   ├── PropertyCard.tsx
│   ├── BookingStatus.tsx
│   ├── DocumentList.tsx
│   └── SalesContact.tsx
└── App.tsx
```

#### สิ่งที่เห็น

```
┌─────────────────────────────────────────────┐
│  CHATEAU — [ชื่อลูกค้า]                     │
├──────────────┬──────────────────────────────┤
│  Menu:       │  สวัสดี, [ชื่อลูกค้า]        │
│  🏠 Property │                              │
│  📅 Booking  │  - สถานะ booking ล่าสุด      │
│  📄 Documents│  - Property ที่สนใจ           │
│  📞 Contact  │  - นัดหมายครั้งถัดไป         │
│  👤 Profile  │                              │
└──────────────┴──────────────────────────────┘
```

---

## 4. Shared Packages

### packages/ui — @chateau/ui

Components ที่ใช้ร่วมกันทุก app:

```
packages/ui/src/
├── primitives/           ← จาก src/ui/ เดิม (46 components)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── input.tsx
│   ├── select.tsx
│   └── ... (46 ไฟล์)
├── patterns/             ← จาก src/components/ui/ เดิม
│   ├── DataTable.tsx
│   ├── Modal.tsx
│   ├── LoadingSpinner.tsx
│   └── EmptyState.tsx
└── index.ts              ← export ทั้งหมด
```

### packages/types — @chateau/types

```
packages/types/src/
├── database.ts           ← รวม database-types.ts + types/database.ts
├── roles.ts              ← 'owner' | 'admin' | 'sales' | 'customer'
├── payment.ts            ← จาก types/payment.ts
├── lead-scoring.ts       ← จาก types/leadScoring.ts
├── errors.ts             ← จาก types/errors.ts
└── index.ts
```

### packages/supabase — @chateau/supabase

```
packages/supabase/src/
├── client.ts             ← Supabase client (จาก lib/supabase.ts)
├── auth.ts               ← Auth logic (จาก AuthContextSimple.tsx)
├── query-client.ts       ← TanStack Query config
├── lead-scoring.ts       ← จาก lib/leadScoring.ts
├── loan-estimation.ts    ← จาก lib/loanEstimation.ts
├── billing-scheduler.ts  ← จาก lib/billing-scheduler.ts
├── invoice-pdf/          ← จาก lib/invoice-pdf*.ts
└── index.ts
```

### packages/config — @chateau/config

```
packages/config/
├── tailwind.base.js      ← luxury design system (colors, fonts, radius)
├── tsconfig.base.json    ← base TypeScript config
└── eslint.base.js        ← ESLint rules
```

---

## 5. Authentication Flow ข้าม Apps

### ปัญหา: แต่ละ app อยู่คนละ domain

```
owner.chateau.app    ← owner login
app.chateau.app      ← admin login
sales.chateau.app    ← sales login
my.chateau.app       ← customer login
```

### แนวทาง: Single Login Page + Role-Based Redirect

```
auth.chateau.app/login
        │
        ├── role = 'owner'    → redirect → owner.chateau.app
        ├── role = 'admin'    → redirect → app.chateau.app
        ├── role = 'sales'    → redirect → sales.chateau.app
        └── role = 'customer' → redirect → my.chateau.app
```

หรือแบบง่ายกว่า (แนะนำสำหรับตอนนี้):

```
app.chateau.app/login    ← login หน้าเดียว
        │
        ├── owner  → /owner/dashboard
        ├── admin  → /admin/dashboard
        ├── sales  → /sales/dashboard
        └── customer → /customer/home
```

---

## 6. Deployment Strategy

### แต่ละ App = Vercel Project แยก

| App | Vercel Project | Domain |
|-----|---------------|--------|
| apps/owner | chateau-owner | owner.chateau.app |
| apps/admin | chateau-admin | app.chateau.app |
| apps/sales | chateau-sales | sales.chateau.app |
| apps/customer | chateau-customer | my.chateau.app |

### Turborepo Build Pipeline

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": { "cache": false, "persistent": true }
  }
}
```

---

## 7. แผนการ Migration (ทำทีละ Phase)

### Phase 0 — เตรียม (1–2 วัน)
```
[ ] สร้าง branch: chore/monorepo-setup
[ ] ติดตั้ง pnpm + Turborepo
[ ] สร้าง pnpm-workspace.yaml + turbo.json
[ ] ย้าย src/ → apps/admin/src/ (rename, ไม่ตัดโค้ด)
[ ] ทดสอบ apps/admin build ผ่านเหมือนเดิม
```

### Phase 1 — สร้าง Shared Packages (2–3 วัน)
```
[ ] สร้าง packages/config (tailwind base + tsconfig)
[ ] สร้าง packages/types (รวม types ที่ซ้ำ)
[ ] สร้าง packages/ui (ย้าย src/ui/ + src/components/ui/)
[ ] สร้าง packages/supabase (ย้าย lib/ logic)
[ ] อัปเดต import ใน apps/admin
[ ] ทดสอบ build + dev ผ่าน
```

### Phase 2 — แยก apps/owner (1–2 วัน)
```
[ ] สร้าง apps/owner จาก pages/OwnerDashboard + TenantManagement + Billing + Payments
[ ] ใช้ @chateau/ui, @chateau/types, @chateau/supabase
[ ] ตั้ง route แยก
[ ] ทดสอบ build
[ ] Deploy บน Vercel project ใหม่
```

### Phase 3 — แยก apps/sales (1–2 วัน)
```
[ ] สร้าง apps/sales จาก pages ที่ sales เข้าได้
[ ] Filter lead data ให้เห็นเฉพาะของตัวเอง
[ ] ทดสอบ build + deploy
```

### Phase 4 — สร้าง apps/customer (3–5 วัน)
```
[ ] ออกแบบ customer schema (เพิ่ม customer role ใน DB)
[ ] สร้าง customer auth flow
[ ] สร้าง pages ใหม่ทั้งหมด
[ ] เชื่อม booking/property data
[ ] ทดสอบ + deploy
```

### Phase 5 — ทำความสะอาด (1 วัน)
```
[ ] ลบ code เก่าที่ย้ายแล้วออกจาก apps/admin
[ ] จัด scripts/ ให้เป็นหมวดหมู่
[ ] อัปเดต CI/CD (GitHub Actions)
[ ] อัปเดต documentation
```

---

## 8. สิ่งที่ต้องเพิ่มใน Database สำหรับ Customer

```sql
-- เพิ่ม customer role
ALTER TYPE user_role ADD VALUE 'customer';

-- เชื่อม customer กับ leads table
ALTER TABLE customers ADD COLUMN auth_user_id UUID REFERENCES auth.users(id);
ALTER TABLE customers ADD COLUMN can_login BOOLEAN DEFAULT false;

-- Customer สามารถดูเฉพาะ booking ของตัวเอง
CREATE POLICY "Customers can view own bookings" ON bookings
    FOR SELECT USING (
        customer_id IN (
            SELECT id FROM customers WHERE auth_user_id = auth.uid()
        )
    );
```

---

## 9. สรุปเปรียบเทียบ

| หัวข้อ | ระบบเดิม | ระบบใหม่ (Monorepo) |
|--------|---------|-------------------|
| **จำนวน App** | 1 | 4 |
| **Security** | Hide UI ด้วย JS | แยก codebase จริง ไม่มีโค้ด owner ใน app sales |
| **Bundle size** | โหลดโค้ดทุก role | โหลดเฉพาะโค้ดของ role ตัวเอง |
| **URL** | เดียวกัน | แยก domain ต่างกัน |
| **Customer login** | ไม่มี | มี (ใหม่) |
| **Deploy** | 1 Vercel project | 4 Vercel projects |
| **Team work** | code ชนกันบ่อย | แต่ละ role ทำงานแยกกัน |

---

## 10. ข้อควรระวัง

| ความเสี่ยง | วิธีป้องกัน |
|-----------|-----------|
| Migration ทำ production พัง | ทำใน branch แยก ทดสอบก่อน merge |
| Import path เปลี่ยนหมด | ใช้ script find-and-replace + ทดสอบ build |
| Customer portal ต้องออกแบบ UX ใหม่ | ทำ Phase นี้แยก ไม่รีบ |
| 4 Vercel deployments = ค่าใช้จ่ายเพิ่ม | Vercel Hobby plan รองรับ 3 projects ฟรี |
| Auth ข้าม domain อาจซับซ้อน | เริ่มด้วย subdomain เดียวก่อน แยก domain ทีหลัง |
