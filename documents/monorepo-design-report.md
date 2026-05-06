# รายงานการออกแบบ Monorepo — CHATEAU Platform

**วันที่วิเคราะห์:** 5 พฤษภาคม 2569  
**สถานะโปรเจ็ค:** Production (Vercel) — branch `001-production-readiness`

---

## 1. สรุปสถานะปัจจุบัน

### โครงสร้างที่มีอยู่

```
chateau-platform/               ← root (single app)
├── src/                        ← React app ทั้งหมดอยู่ที่นี่
│   ├── components/             ← 93 components
│   ├── pages/                  ← 23 pages
│   ├── ui/                     ← 46 shadcn/ui primitives (ซ้ำกับ src/components/ui/)
│   ├── dashboard/              ← chart components เก่า (ซ้ำกับ components/dashboard/)
│   ├── lib/                    ← utilities, supabase client, business logic
│   ├── hooks/                  ← 5 custom hooks
│   ├── types/                  ← TypeScript types
│   └── contexts/               ← Auth context
├── chateau-dashboard/          ← ว่างเปล่า (ตั้งใจไว้แต่ยังไม่ได้ทำ)
├── supabase/                   ← 106+ migrations, 11 edge functions
├── scripts/                    ← 36+ utility scripts (Node.js)
├── specs/                      ← specifications
└── package.json                ← dependency เดียว ไม่มี workspace
```

### ปัญหาที่พบในโครงสร้างปัจจุบัน

| ปัญหา | รายละเอียด |
|-------|-----------|
| **Code duplication** | `src/ui/` และ `src/components/ui/` มี component ซ้ำกัน 46+ ไฟล์ |
| **Code duplication** | `src/dashboard/` และ `src/components/dashboard/` มี chart ซ้ำกัน |
| **ไม่มี workspace** | `package.json` เดียว ทุกอย่างรวมกัน แยกไม่ได้ |
| **Scripts รก** | 36+ scripts กระจัดกระจาย ไม่มี structure |
| **chateau-dashboard ว่าง** | folder ถูกสร้างไว้แต่ไม่มีโค้ด |
| **Type ซ้ำซ้อน** | `src/types/database.ts` และ `src/lib/database-types.ts` แยกกันอยู่ |

---

## 2. เหตุผลที่ควรทำ Monorepo

### ข้อดีสำหรับโปรเจ็คนี้

1. **แยก concern ชัดเจน** — frontend / backend types / UI library แยกออกจากกัน
2. **Reuse code ได้** — `packages/ui` ใช้ร่วมกันได้ระหว่าง apps
3. **Scale ได้** — เพิ่ม app ใหม่ (mobile, public portal) โดยไม่ต้อง copy โค้ด
4. **Build cache** — Turborepo cache ทำให้ build เร็วขึ้น 3–10x
5. **Type safety ข้าม package** — share types ได้โดยไม่ต้อง maintain หลายชุด

---

## 3. โครงสร้าง Monorepo ที่ออกแบบ

### Tooling ที่แนะนำ

| เครื่องมือ | บทบาท | เหตุผล |
|-----------|-------|--------|
| **Turborepo** | Build system + caching | Industry standard, setup ง่าย |
| **pnpm workspaces** | Package manager | ประหยัด disk 40–60%, เร็วกว่า npm |

### โครงสร้างใหม่

```
chateau-platform/                    ← monorepo root
│
├── apps/
│   ├── web/                         ← Main app (ย้ายจาก src/ เดิม)
│   │   ├── src/
│   │   │   ├── components/          ← components เฉพาะ web app
│   │   │   │   ├── auth/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── leads/
│   │   │   │   ├── properties/
│   │   │   │   ├── invoices/
│   │   │   │   ├── users/
│   │   │   │   └── layouts/
│   │   │   ├── pages/               ← 23 pages เดิม
│   │   │   ├── hooks/               ← 5 custom hooks
│   │   │   ├── contexts/
│   │   │   └── App.tsx
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   └── index.html
│   │
│   └── dashboard/                   ← Operator Dashboard (chateau-dashboard เดิม)
│       ├── src/
│       │   ├── components/          ← components เฉพาะ dashboard
│       │   └── pages/
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── ui/                          ← Shared UI Component Library
│   │   ├── src/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── dialog.tsx
│   │   │   └── ... (46+ components จาก src/ui/ และ src/components/ui/)
│   │   ├── package.json             ← { "name": "@chateau/ui" }
│   │   └── tailwind.config.js
│   │
│   ├── types/                       ← Shared TypeScript Types
│   │   ├── src/
│   │   │   ├── database.ts          ← รวม database-types + types/database.ts
│   │   │   ├── payment.ts
│   │   │   ├── lead-scoring.ts
│   │   │   └── errors.ts
│   │   └── package.json             ← { "name": "@chateau/types" }
│   │
│   ├── supabase/                    ← Supabase Client + Utilities
│   │   ├── src/
│   │   │   ├── client.ts            ← supabase.ts เดิม
│   │   │   ├── query-client.ts
│   │   │   ├── lead-scoring.ts
│   │   │   ├── loan-estimation.ts
│   │   │   ├── billing-scheduler.ts
│   │   │   ├── suspension-service.ts
│   │   │   └── invoice-pdf/
│   │   └── package.json             ← { "name": "@chateau/supabase" }
│   │
│   └── config/                      ← Shared Configs
│       ├── tailwind.base.js         ← base Tailwind config
│       ├── tsconfig.base.json       ← base TypeScript config
│       └── package.json             ← { "name": "@chateau/config" }
│
├── supabase/                        ← Supabase backend (ไม่เปลี่ยน)
│   ├── migrations/                  ← 106+ SQL migrations
│   └── functions/                   ← 11 edge functions
│
├── scripts/                         ← Utility scripts (จัดกลุ่มใหม่)
│   ├── users/
│   ├── database/
│   └── migrations/
│
├── turbo.json                       ← Turborepo configuration
├── pnpm-workspace.yaml              ← pnpm workspaces
└── package.json                     ← root package (devDependencies เท่านั้น)
```

---

## 4. Dependency Map

```
apps/web ──────────────────────────────────────────┐
  depends on:                                       │
  ├── @chateau/ui       (UI components)             │
  ├── @chateau/types    (TypeScript types)          │
  └── @chateau/supabase (Supabase client + logic)  │
                                                    ▼
apps/dashboard ──────────────────────────────────── shared packages
  depends on:
  ├── @chateau/ui
  ├── @chateau/types
  └── @chateau/supabase

packages/supabase ──────────────────────────────────
  depends on:
  └── @chateau/types

packages/ui ─────────────────────────────────────────
  depends on:
  └── @chateau/config (tailwind base)
```

---

## 5. การจัดการ Git Branch (ควรทำคู่กัน)

### แนะนำ: GitHub Flow

```
main  (production → Vercel deploy)
  │
  ├── feature/leads-export-pdf
  ├── feature/booking-calendar
  ├── fix/invoice-status-bug
  └── chore/migrate-to-monorepo
```

**Branch protection rules (ตั้งบน GitHub):**
- ห้าม push ตรงเข้า `main`
- ต้องผ่าน Pull Request
- ต้อง review อย่างน้อย 1 คน

---

## 6. แผนการ Migration (ทำทีละขั้น)

### Phase 1 — ตั้งโครงสร้าง (ไม่ break production)
```
1. สร้าง turbo.json + pnpm-workspace.yaml
2. สร้าง packages/config (tailwind + tsconfig base)
3. ย้าย src/ui/ + src/components/ui/ → packages/ui
4. ทดสอบ apps/web build ผ่าน
```

### Phase 2 — แยก Packages
```
5. สร้าง packages/types (รวม types ที่ซ้ำซ้อน)
6. สร้าง packages/supabase (supabase client + business logic)
7. อัปเดต import ใน apps/web ให้ใช้ @chateau/*
8. ทดสอบ build + dev
```

### Phase 3 — เพิ่ม Dashboard App
```
9. สร้าง apps/dashboard จาก chateau-dashboard
10. Reuse @chateau/ui + @chateau/types
11. ตั้ง Vercel project ใหม่สำหรับ dashboard
```

### Phase 4 — CI/CD + Optimization
```
12. ตั้ง GitHub Actions (lint + test + build)
13. Turborepo remote cache
14. จัดระเบียบ scripts/
```

---

## 7. ไฟล์ Config หลักที่ต้องสร้าง

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### `packages/ui/package.json`
```json
{
  "name": "@chateau/ui",
  "version": "0.0.1",
  "exports": {
    "./button": "./src/button.tsx",
    "./card": "./src/card.tsx"
  },
  "peerDependencies": {
    "react": "^19.0.0"
  }
}
```

---

## 8. สรุปเปรียบเทียบ

| หัวข้อ | ปัจจุบัน | หลัง Monorepo |
|--------|---------|--------------|
| **โครงสร้าง** | Single app ทุกอย่างรวม | แยก apps + packages ชัดเจน |
| **UI Components** | ซ้ำ 2 ที่ (src/ui + src/components/ui) | `@chateau/ui` ที่เดียว |
| **Types** | กระจาย 2 ไฟล์ | `@chateau/types` ที่เดียว |
| **Dashboard** | ว่างเปล่า | `apps/dashboard` พร้อมใช้ |
| **Build time** | ทุกครั้ง build ทั้งหมด | Turborepo cache เฉพาะที่เปลี่ยน |
| **Scale** | เพิ่ม app ใหม่ยาก | เพิ่ม `apps/xxx` ได้เลย |
| **Onboarding** | อ่านโค้ดยาก (ทุกอย่างใน src/) | แต่ละ package มี scope ชัดเจน |

---

## 9. ความเสี่ยงและข้อควรระวัง

| ความเสี่ยง | ระดับ | การป้องกัน |
|-----------|------|-----------|
| Migration ทำให้ production พัง | สูง | ทำใน branch แยก ไม่ merge จนกว่าจะ test ครบ |
| Import paths เปลี่ยนหมด | กลาง | ทำทีละ phase ใช้ script อัปเดต path |
| pnpm ไม่ compatible กับ Vercel | ต่ำ | Vercel รองรับ pnpm เต็ม 100% |
| Turborepo learning curve | ต่ำ | Config ไม่ซับซ้อน เริ่มต้นได้เร็ว |

---

## 10. คำแนะนำสุดท้าย

**ควรทำ Monorepo เมื่อ:**
- ต้องการสร้าง `apps/dashboard` จริงๆ
- ทีมโต หรือมีคนทำงานหลายส่วนพร้อมกัน

**ยังไม่ต้องทำถ้า:**
- โปรเจ็คยังมีคนเดียวหรือสองคน
- ยังไม่มีแผนสร้าง dashboard app จริงๆ

**สิ่งที่ควรทำก่อน (ได้ประโยชน์ทันที ไม่ต้อง migrate ทั้งหมด):**
1. ลบ code ซ้ำระหว่าง `src/ui/` และ `src/components/ui/`
2. รวม `src/types/database.ts` กับ `src/lib/database-types.ts`
3. จัด `scripts/` ให้เป็นหมวดหมู่
4. ตั้ง Git branch strategy ให้ถูกต้อง (`main` = production)
