# รายงานการออกแบบ Monorepo — CHATEAU Platform

**วันที่วิเคราะห์:** 2026-05-12
**สถานะโปรเจ็ค:** Production (Vercel) — branch `001-production-readiness`
**ผู้เขียน:** Architecture Analysis Session

---

## 📌 TL;DR — สรุปบรรทัดเดียว

**ตอนนี้:** ยังไม่ต้อง migrate monorepo — เป็น single SPA ที่ work อยู่
**ต้อง migrate เมื่อ:** เริ่มสร้าง Customer Portal (Phase 3) หรือ Mobile App
**สิ่งที่ทำได้ตอนนี้:** เขียนโค้ดให้ "monorepo-ready" — ใช้ `@/` imports, centralize theme, แยก data layer

---

## 1. สถานะปัจจุบัน (Current State)

### 1.1 โครงสร้างที่มีอยู่

```
chateau-platform/                  ← single repo, single app
├── src/                            ← React 19 + Vite SPA
│   ├── pages/                      ← 25+ pages (Index, MyDashboard, SalesOperations,
│   │                                  OwnerDashboard, PropertyManagement, LeadManagement,
│   │                                  UnitDetail, UnitEdit, Permissions, ...)
│   ├── components/
│   │   ├── ui/                     ← 50+ shadcn primitives
│   │   ├── dashboard/              ← Sidebar, Header, KPI cards
│   │   ├── properties/             ← Property/Unit modals, LocationPicker, MasterPlanSVG
│   │   ├── leads/                  ← Lead modals
│   │   ├── permissions/            ← AdminProjectMatrix, SalesUnitMatrix, etc.
│   │   ├── users/                  ← User management
│   │   ├── auth/                   ← ProtectedRoute, PermissionGuard
│   │   └── ... 15+ feature dirs
│   ├── contexts/                   ← AuthContextSimple
│   ├── hooks/                      ← usePermissions, useSubscriptionFeatures, etc.
│   ├── lib/                        ← supabase client, api helpers, utilities
│   │   ├── api/                    ← dashboard.ts, leads.ts (still mostly inline in pages)
│   │   ├── billing-scheduler.ts
│   │   └── ...
│   ├── types/                      ← TypeScript interfaces
│   └── App.tsx                     ← routes
├── supabase/
│   ├── migrations/                 ← 100+ migrations
│   └── functions/                  ← edge functions (invite-user, accept-invite, ...)
├── scripts/                        ← Node utility scripts (apply-migration, check-roles, ...)
├── documents/                      ← markdown docs
├── public/
└── package.json                    ← single deps, no workspaces
```

### 1.2 Deployable Units ปัจจุบัน

| Unit | จำนวน | สถานะ |
|---|:---:|---|
| Web SPA (Vercel) | 1 | ✅ Production |
| Supabase Edge Functions | 11 | ✅ Production |
| DB Migrations | 100+ | ✅ Applied |
| Marketing site | 0 | ❌ ไม่มี |
| Mobile app | 0 | ❌ ไม่มี |
| Customer portal | 0 | ❌ ไม่มี |

→ **มี deployable เดียวสำหรับ web app** → monorepo ยังไม่จำเป็น

### 1.3 Roles + Page Map ปัจจุบัน

```
Pages ในระบบ ทั้งหมดอยู่ใน src/pages/ (single app)
แต่ละ role เห็นเมนูต่างกัน (role-based routing + Sidebar guards)

Owner       → 18 menus (เห็นทุกอย่าง)
Admin       → 12 menus (ของบริษัทตัวเอง)
Sales       → 5 menus (My Dashboard + Sales Ops + Properties + Leads + Settings)
Agent       → 4 menus (My Dashboard + Properties + Leads + Settings)
Customer    → ยังไม่มี portal
```

---

## 2. ทำไมต้อง Monorepo? — เกณฑ์ตัดสิน

### 2.1 Monorepo ดีเมื่อไหร่
| สถานการณ์ | ต้อง monorepo? | เหตุผล |
|---|:---:|---|
| มี 1 app | ❌ ไม่ | overhead > benefit |
| มี 2+ apps + share code มาก | ✅ ใช่ | DRY, single source of truth |
| มี web + mobile | ✅ ใช่ | คนละ framework, share types/api |
| มี marketing site (SSR) | ✅ ใช่ | คนละ runtime (Next.js vs Vite) |
| ทีม dev > 3 คน | ⚠️ พิจารณา | ownership boundaries |
| Build time > 30s | ⚠️ พิจารณา | parallel builds |

### 2.2 Monorepo แยกตามอะไร?

**❌ ไม่ใช่:** แยกตาม Role (Sales app, Admin app)
- Role เป็นเรื่อง **permission/routing** ไม่ใช่ deployment
- บันทึก memory ของโปรเจ็ค: "No separate /agent portal — Sales uses same pages as Admin"

**✅ ใช่:** แยกตาม **Deployable Unit + Audience**
- คนละ deployment URL
- คนละ framework
- คนละ audience (internal staff vs customer)
- คนละ branding (white-label per tenant ในอนาคต)

---

## 3. การออกแบบ Monorepo ที่แนะนำ (Future State)

### 3.1 Architecture Overview

```
chateau-platform/                         ← monorepo root
│
├── apps/                                  ← Deployable applications
│   ├── portal/                            ← Web SPA สำหรับพนักงาน (Owner/Admin/Sales/Agent)
│   │   ├── src/                              ← ย้ายจาก src/ ปัจจุบัน
│   │   │   ├── pages/                        ← Executive, My, Sales Ops, Owner, ...
│   │   │   ├── routes/
│   │   │   └── main.tsx
│   │   ├── public/
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── customer-portal/                   ← Web app สำหรับลูกค้าซื้อบ้าน (NEW Phase 3)
│   │   ├── src/
│   │   │   ├── pages/                        ← My Properties, Documents, Messages, Payments
│   │   │   └── ...
│   │   ├── vite.config.ts (หรือ Next.js)
│   │   └── package.json
│   │
│   ├── marketing-site/                    ← chateau.com — public landing (Next.js SSR)
│   │   ├── pages/                            ← / · /features · /pricing · /blog
│   │   ├── next.config.js
│   │   └── package.json
│   │
│   └── mobile/                            ← React Native (Sales + Customer)
│       ├── src/
│       └── package.json
│
├── packages/                              ← Shared libraries
│   ├── ui/                                ← shadcn components (Button, Card, Dialog, ...)
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── index.ts
│   │   ├── tailwind.config.js
│   │   └── package.json
│   │
│   ├── data/                              ← Supabase client + queries + types
│   │   ├── src/
│   │   │   ├── client.ts                    ← createClient
│   │   │   ├── queries/
│   │   │   │   ├── units.ts                  ← getUnitsByTenant, etc.
│   │   │   │   ├── leads.ts
│   │   │   │   └── tenants.ts
│   │   │   ├── types/                       ← Database, Unit, Lead, ...
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── auth/                              ← Auth context + permission helpers
│   │   ├── src/
│   │   │   ├── AuthContext.tsx
│   │   │   ├── usePermissions.ts
│   │   │   └── guards.tsx
│   │   └── package.json
│   │
│   ├── theme/                             ← Brand color, typography, Tailwind preset
│   │   ├── src/
│   │   │   ├── palette.ts                   ← C constant (soft red theme)
│   │   │   ├── tailwind-preset.js
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── utils/                             ← formatTHB, dates, validators, etc.
│   │   ├── src/
│   │   │   ├── currency.ts
│   │   │   ├── date.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── types/                             ← Shared TS types ที่ไม่ใช่ DB
│       ├── src/
│       │   ├── role.ts
│       │   └── domain.ts
│       └── package.json
│
├── supabase/                              ← DB migrations + edge functions (shared)
│   ├── migrations/
│   ├── functions/
│   └── seed.sql
│
├── scripts/                               ← Build/dev helper scripts
├── docs/                                  ← Architecture, ADRs
├── .github/workflows/                     ← CI/CD per app
│
├── turbo.json                             ← Turborepo config (task pipeline)
├── pnpm-workspace.yaml                    ← Workspace declaration
└── package.json                           ← Root: only dev tools (turbo, eslint, prettier)
```

### 3.2 ใครใช้ app ไหน

| Role | Portal | Customer Portal | Marketing Site | Mobile |
|---|:---:|:---:|:---:|:---:|
| Owner | ✅ | — | (admin) | optional |
| Admin | ✅ | — | (admin) | optional |
| **Sales** | ✅ | — | — | ✅ **mobile-first** |
| **Agent** | ✅ | — | — | ✅ **mobile-first** |
| **Customer** | — | ✅ | ✅ (public) | ✅ |

---

## 4. รายละเอียดแต่ละ App

### 4.1 `apps/portal/` — Staff Web App
**Audience:** Internal staff (Owner, Admin, Sales, Agent)
**Tech:** Vite + React 19 + TS + shadcn
**Deploy:** `app.chateau.com` (Vercel)
**Pages:** 25+ (ของปัจจุบันทั้งหมด)

**Bundle strategy:**
- Code-split per role group
- Owner-only pages lazy load
- Sales gets smaller bundle

### 4.2 `apps/customer-portal/` — Customer Web (Phase 3)
**Audience:** End customers (ลูกค้าซื้อบ้าน)
**Tech:** Vite + React 19 + TS + shadcn (หรือ Next.js ถ้าต้อง SEO)
**Deploy:** `my.chateau.com` หรือ `[tenant].chateau.com` (white-label)
**Pages (estimate):**
- My Properties (ยูนิตที่ฉันซื้อ/จอง)
- Documents (สัญญา, ใบเสร็จ)
- Payments (ค่างวด, due dates)
- Messages (คุยกับ Sales)
- Profile

**Branding:** ใช้ logo + color ของ tenant (white-label)

### 4.3 `apps/marketing-site/` — Public Site
**Audience:** Prospects ที่ยังไม่ได้สมัคร
**Tech:** Next.js 15 (SSR สำหรับ SEO)
**Deploy:** `chateau.com` (Vercel หรือ Cloudflare Pages)
**Pages:**
- Landing (`/`)
- Features
- Pricing
- Blog/Resources
- Sign up / Contact

### 4.4 `apps/mobile/` — React Native (Future)
**Audience:** Sales (on-site), Customer
**Tech:** React Native + Expo
**Deploy:** App Store + Play Store
**Features:**
- Quick lead capture (Sales walk-in)
- Push notifications
- Offline mode (เก็บ leads ตอนไม่มีเน็ตที่ site visit)

---

## 5. รายละเอียดแต่ละ Shared Package

### 5.1 `packages/ui/`
**คืออะไร:** ฐานของ shadcn/ui components — Button, Card, Dialog, Input, Select, Table, ...

**ใช้โดย:** `portal`, `customer-portal`, `marketing-site` (web เท่านั้น — RN ไม่ใช้)

**ไม่ใช่:** application-specific components (เช่น `<UnitCard>` อยู่ใน app, ไม่ใช่ที่นี่)

**Export:** named exports สำหรับ tree-shaking
```ts
// packages/ui/src/index.ts
export { Button } from './button';
export { Card, CardContent, ... } from './card';
```

### 5.2 `packages/data/`
**คืออะไร:** Supabase client + queries + types

**โครงสร้าง:**
```
packages/data/src/
├── client.ts                ← createClient(supabaseUrl, key)
├── types/                   ← จาก supabase typegen
│   └── database.ts
├── queries/
│   ├── units.ts             ← export const getUnitsByTenant, etc.
│   ├── leads.ts
│   ├── tenants.ts
│   └── activity.ts
└── mutations/
    ├── leads.ts             ← createLead, updateLeadStatus
    └── units.ts             ← updateUnitStatus (เปลี่ยน reservation)
```

**ใช้โดย:** ทุก app ที่ติดกับ Supabase

### 5.3 `packages/auth/`
**คืออะไร:** Authentication context + permission guards

**Export:**
```ts
export { AuthProvider, useAuth } from './AuthContext';
export { PermissionGuard, RoleGuard } from './guards';
export { usePermissions } from './usePermissions';
export type { Role, Permission } from './types';
```

**Why แยก:** Auth logic + RLS helpers ใช้ใน portal, customer-portal, mobile — แต่ละ app ตั้ง redirect ต่างกัน

### 5.4 `packages/theme/`
**คืออะไร:** Brand color palette + Tailwind preset + typography tokens

**Export:**
```ts
// packages/theme/src/palette.ts
export const palette = {
  red:        '#ef4444',
  redLight:   '#fef2f2',
  redDeep:    '#e11d48',
  amber:      '#d97706',
  green:      '#16a34a',
  charcoal:   '#475569',
  slate:      '#94a3b8',
  // ...
};

// packages/theme/tailwind-preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: palette.red, ... }
      }
    }
  }
};
```

**ทำไมสำคัญตอนนี้:** ตอนนี้ทุกหน้าประกาศ `const C = { ... }` ซ้ำกัน — เป็น code duplication ที่ migrate ยาก. ต้อง centralize ก่อน

### 5.5 `packages/utils/`
**คืออะไร:** Pure utility functions (no React, no Supabase)

**ตัวอย่าง:**
```ts
// formatTHB('1234567') → '฿1.2M'
export const formatTHB = (n: number): string => { ... };

// timeAgo('2026-05-10') → '2 วันก่อน'
export const timeAgo = (iso: string): string => { ... };

// validators
export const isValidEmail = (s: string): boolean => { ... };
```

**Why pure functions:** ใช้ได้ทุก app + ทุก framework (web, RN, marketing)

### 5.6 `packages/types/`
**คืออะไร:** Domain types ที่ไม่ใช่ DB schema

```ts
export type Role = 'owner' | 'admin' | 'sales' | 'agent' | 'customer';
export type Permission = 'view_units' | 'edit_units' | 'manage_users' | ...;
export type UnitStatus = 'available' | 'reserved' | 'sold' | 'unavailable';
```

---

## 6. Tooling Decisions

### 6.1 Package Manager: **pnpm** (recommended)
**Reasons:**
- Workspace-native (`pnpm-workspace.yaml`)
- Strict dependency hoisting (catch bugs early)
- Fast install, disk-efficient
- ใช้โดย Vue, Vite, Vercel เอง

**Alternatives:** npm workspaces (built-in but slower), Yarn berry (complex)

### 6.2 Build Orchestrator: **Turborepo**
**Reasons:**
- Caching builds (เห็นผลจริงเมื่อ apps > 2)
- Task pipelines (`build` → `lint` → `test` parallel)
- Simple `turbo.json` config
- ใช้กันใน Vercel ecosystem

**Alternatives:** Nx (more powerful but heavier), Bazel (overkill)

### 6.3 Type System: **TypeScript Project References**
**Reasons:**
- Incremental builds (compile only changed)
- Cross-package type checking
- เป็น standard ที่ Microsoft ออกแบบมาเฉพาะ monorepo

### 6.4 Sample `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "type-check": { "dependsOn": ["^build"] }
  }
}
```

### 6.5 Sample `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

---

## 7. Migration Strategy — เมื่อถึงเวลา

### Phase A: เตรียมพื้นที่ (1-2 วัน)
1. Audit `src/` หา circular imports
2. Audit page→page imports (ห้ามมี)
3. Move shared utilities ที่กระจายอยู่ → `src/lib/`

### Phase B: Set up monorepo skeleton (1 วัน)
1. Init `pnpm-workspace.yaml` + `turbo.json`
2. Create `apps/` และ `packages/` empty
3. Test build ของ root works

### Phase C: Extract packages ทีละตัว (3-5 วัน)
ทำตามลำดับนี้:
1. **`packages/utils/`** — แตะน้อย, dependency น้อยสุด
2. **`packages/types/`** — pure types
3. **`packages/theme/`** — centralize color palette
4. **`packages/ui/`** — shadcn components
5. **`packages/data/`** — Supabase queries
6. **`packages/auth/`** — auth context

แต่ละขั้น: ย้าย → fix imports → test → commit

### Phase D: Move current app (1 วัน)
- ย้าย `src/` → `apps/portal/src/`
- Update `vite.config.ts` paths
- Update CI/CD

### Phase E: Build new apps (per phase ของ roadmap)
- `apps/customer-portal/` ตอนทำ Phase 3
- `apps/marketing-site/` ตอนมี content/blog
- `apps/mobile/` ตอนต้องการ native features

**Total migration effort:** 1-2 สัปดาห์ของ refactor เมื่อถึงเวลา

---

## 8. ✅ Preparation Tasks — สิ่งที่ทำได้ "ตอนนี้" เพื่อให้ migrate ง่ายในอนาคต

### Priority 1 — ทำเลย (cheap, high-value)

#### 8.1 ใช้ `@/` absolute imports เสมอ
```ts
// ❌ ห้าม
import { Button } from '../../../components/ui/button';
// ✅ ใช้
import { Button } from '@/components/ui/button';
```
**Status ปัจจุบัน:** ✅ ทำแล้ว — `tsconfig.json` มี `paths` set แล้ว

#### 8.2 ห้าม Page import จาก Page
```ts
// ❌ ห้าม
// src/pages/Index.tsx
import { something } from '@/pages/OwnerDashboard';
// ✅ ทำ
// shared logic ย้ายเข้า lib/
import { something } from '@/lib/dashboard-helpers';
```
**Status:** ⚠️ ต้อง audit — ไม่แน่ใจว่ามีหรือเปล่า

#### 8.3 Centralize Theme/Palette
ตอนนี้ทุก dashboard ประกาศ `const C = { red: '#ef4444', ... }` ซ้ำกัน
**ต้องทำ:** ย้ายเข้า `src/lib/theme.ts` แล้ว import ทุกที่
```ts
// src/lib/theme.ts (NEW)
export const palette = {
  red:        '#ef4444',
  redLight:   '#fef2f2',
  // ... ตามที่ใช้ใน Index.tsx
} as const;
```
แล้วในทุก page:
```ts
import { palette as C } from '@/lib/theme';
```
**Status:** ❌ ยังไม่ทำ — high priority

### Priority 2 — ทำเมื่อมีเวลา (medium-value)

#### 8.4 Refactor Supabase queries → `src/lib/api/`
ตอนนี้แต่ละ page เขียน `supabase.from('units').select(...)` เอง
**ต้องทำ:** สร้าง wrapper functions
```ts
// src/lib/api/units.ts (NEW)
export const getUnitsByTenant = (tenantId: string) =>
  supabase.from('units')
    .select('id, status, price, deposit_amount, sold_at, reserved_at, project_id')
    .eq('tenant_id', tenantId);
```
**Status:** ⚠️ มี `src/lib/api/dashboard.ts` แล้ว แต่ยังไม่ครอบคลุม

#### 8.5 จัดระเบียบ folder structure ให้ "feature-based"
อนาคต split ง่ายขึ้น:
```
src/
├── shared/                  ← จะกลายเป็น packages/ ในอนาคต
│   ├── ui/                  ← (เดิม components/ui/)
│   ├── auth/
│   ├── data/                ← (เดิม lib/api/)
│   ├── theme/
│   └── utils/
├── features/                ← จัดตาม feature
│   ├── dashboard/
│   ├── leads/
│   ├── properties/
│   ├── permissions/
│   └── admin/
└── routes/
```
**Status:** ❌ ยังไม่ทำ — medium priority (cosmetic refactor)

### Priority 3 — ทำตอนใกล้จะ migrate

#### 8.6 Type extraction → `src/types/database.ts`
ใช้ `supabase gen types typescript` สร้าง type จริง
**Status:** ⚠️ บางส่วนทำแล้ว

#### 8.7 Strict ESLint rule for circular imports
ติด ESLint plugin `import/no-cycle` ป้องกัน regression
**Status:** ❌ ยังไม่ทำ

---

## 9. Signals — เมื่อไหร่ควร migrate

### Hard signals (ต้อง migrate)
- [ ] เริ่มสร้าง Customer Portal (Phase 3) ← **trigger หลัก**
- [ ] เริ่มสร้าง Mobile App
- [ ] เริ่มสร้าง marketing site SSR (Next.js)

### Soft signals (พิจารณา migrate)
- [ ] Build time > 30 วินาที
- [ ] Bundle size > 1.5MB
- [ ] ทีม dev > 3 คน
- [ ] เห็น code duplication เกิดบ่อย

### Current status (2026-05-12)
- ✅ Build time: ~285 ms (Vite — fast)
- ✅ มี 1 app
- ✅ Team size: 1 dev
- ❌ **ยังไม่มี trigger** — keep monolith

---

## 10. ความเสี่ยง + วิธีลดความเสี่ยง

| Risk | Mitigation |
|---|---|
| Premature optimization (migrate เร็วเกิน) | รอจน trigger signal เกิดจริง |
| Refactor ใหญ่ break ของเดิม | Branch + test ทั้ง regression suite |
| Tooling learning curve (Turbo, pnpm) | Start small — 1 package extract แรกก่อน |
| Tenant data leaks between apps | ใช้ same Supabase + RLS, ไม่ต้องกังวล |
| Build slowness ตอน migrate | Turborepo cache จะแก้เอง |
| Confusion ในทีม | Doc + ADR (Architecture Decision Records) |

---

## 11. ตัดสินใจล่าสุด (Decision Log)

| Decision | Reason | Date |
|---|---|---|
| ไม่แยกตาม Role (no `/agent` portal) | Role = permission ไม่ใช่ deployment | 2026-05-08 |
| Single SPA ตอนนี้ | overhead > benefit | 2026-05-12 |
| Plan monorepo เมื่อสร้าง Customer Portal | natural trigger | 2026-05-12 |
| Tool: pnpm + Turborepo | Industry standard + Vercel-aligned | 2026-05-12 (planned) |
| Customer Portal เป็น app แยก | คนละ audience, branding, URL | 2026-05-12 |

---

## 12. แนวทาง Roadmap (Suggested)

```
2026 Q2          2026 Q3              2026 Q4              2027 Q1
─────────────    ──────────────────   ────────────────     ────────────────
                                                          
[ตอนนี้]         [Phase 3]            [Migration]          [Phase 4+]
Stay single SPA  Start Customer       Monorepo migration   Mobile app
                 Portal design        (when CP starts)     (extension)
                 ↓                    ↓                    ↓
                 Trigger detected!    Refactor → split     New package: mobile
                                      apps/portal +
                                      apps/customer-portal
                                      packages/ui, data,
                                      auth, theme, utils
```

---

## 13. คำแนะนำสุดท้าย

### ❌ Don't do now
- อย่า migrate monorepo ก่อนมี trigger signal
- อย่า over-engineer folder structure ตอน 1 app
- อย่าเลือก tooling (Turbo/Nx) ก่อนจำเป็น

### ✅ Do now
- **ทำ Preparation 8.3 (Centralize Theme)** — high-value, low-cost
- **ทำ Preparation 8.2 (Audit page→page imports)** — ป้องกันปัญหา
- Continue building features ที่ค้างใน roadmap (Conversion Watch, Activity Feed, etc.)

### ✅ Do later
- ตอนเริ่ม Phase 3 (Customer Portal) → ติด `pnpm-workspace.yaml` + `turbo.json`
- Extract packages ตามลำดับ Section 7 Phase C
- Create ADR documents สำหรับการตัดสินใจสำคัญ

---

## เอกสารอ้างอิง

- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- Vercel monorepo guide: https://vercel.com/docs/monorepos
- [Nx vs Turborepo comparison](https://blog.nrwl.io/nx-and-turborepo)

---

**สรุปสุดท้าย:** Chateau อยู่ในจุดที่ดี — single SPA ที่ structured ดี.
Monorepo เป็น **อนาคต** ที่ trigger โดย Customer Portal.
**ก่อนถึงเวลานั้น**: focus ที่ build features + เขียนโค้ดให้ "monorepo-ready"
