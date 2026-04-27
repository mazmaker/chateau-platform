# 🔄 Resume Prompt — สำหรับเริ่มงานต่อในเซสชันใหม่

> **วันที่บันทึก:** 2026-04-27
> **ผู้สั่ง:** maz_dsi@mazmaker.com (ชิตพล)
> **Branch:** `001-production-readiness`
> **เป้าหมาย:** Paste prompt นี้เป็น message แรกในเซสชัน Claude Code ใหม่ → ทำงานต่อได้ทันที

---

## 📋 วิธีใช้

1. เปิด Claude Code ใหม่ในโปรเจค `chateau-platform`
2. Copy ส่วน **"🤖 PROMPT START"** → **"🤖 PROMPT END"**
3. Paste เป็น message แรก
4. Claude AI จะอ่าน context และถามว่าจะทำงานข้อไหนต่อ

---

## 🤖 PROMPT START

```
สวัสดี Claude — ผมกลับมาทำงานต่อจากเซสชันที่แล้ว (2026-04-27)
ขอให้คุณอ่าน context ทั้งหมดด้านล่างก่อนเริ่มทำงาน แล้วบอกผมว่าคุณเข้าใจบริบทครบหรือไม่
ก่อนถามผมว่าจะทำงานข้อไหนต่อ
```

### 🏗️ Project Context

- **Project:** CHATEAU Platform — Real Estate SaaS Platform (multi-tenant, Thai market)
- **Working dir:** `c:\chitpon59\dev\project\Chatuae\chateau-platform2\chateau-platform`
- **Tech stack:** React 19 + Vite 7 + TypeScript + Tailwind v3 + shadcn/ui + Supabase (Postgres + Auth + Storage)
- **Branch ปัจจุบัน:** `001-production-readiness` (default branch on GitHub)
- **Latest commit:** `45d81ea fix(properties): dedupe project list + cleanup duplicate records`
- **Tenant ID หลัก:** `00000000-0000-0000-0000-000000000001` (ของคุณ chitp)

### 🔐 Login Credentials (สำหรับทดสอบ UI)

| Role | Email | Password | สถานะ |
|------|-------|----------|-------|
| ADMIN | `sales@chateau.com` | `Admin@2026!` | ✅ ใช้งานได้ (ผมรีเซ็ตในเซสชันก่อน) |
| OWNER | (ยังไม่ได้รีเซ็ต) | - | 🟡 ใน DB มี `mazmakerv2.sup@gmail.com` แต่รหัสไม่ทราบ |
| SALES | (ไม่มี user role=sales ใน DB) | - | 🔴 ต้องสร้างใหม่ผ่าน UI |

### 🔌 MCP Servers

ทั้ง 4 ตัวเชื่อมต่อแล้ว: Context7, Playwright, Shadcn, Supabase
- `.mcp.json` ที่ root (ไม่ใช่ `.mcp/mcp.json`)
- ใช้ `npx.cmd` (Windows) ไม่ใช่ `npx`
- Supabase project: `pqnjvcbmnatrtvpqnrdx`

---

### 📊 สิ่งที่ทำสำเร็จในเซสชันก่อน (2026-04-27)

#### 1. ✅ Branch Strategy — รวมงานเข้า main branch

- **Merged** `origin/002-production-readiness` → `001-production-readiness` (commit `2a7fbc0`)
- **Merged** `feature/multi-role` → `001-production-readiness` (commit `1e11611`)
  - มี 15 conflict files → user เลือก Strategy B (favor feature/multi-role)
- **Push** ทุกอย่างขึ้น `origin/001-production-readiness` แล้ว
- **Local 002** sync กับ remote (28 commits behind ก่อนหน้า)
- **Backup tags** push ขึ้น remote: `backup/001-before-merge-2026-04-27`, `backup/feature-multi-role-2026-04-27`

> 💡 ตอนนี้ `001` มีงานครบทั้งจาก `002` และ `feature/multi-role`

#### 2. ✅ DashboardLayout Refactor (Phase 1+2 แล้ว) — commit `083f6f5`

- สร้าง `src/components/layouts/DashboardLayout.tsx` ใช้ Outlet pattern
- ใช้ใน `/analytics` และ `/api` (แก้บั๊ก Sidebar หาย)
- หน้าอื่น 15 หน้ายังใช้ pattern เดิม (import Sidebar/Header เอง) — รอ migrate ใน Phase 3

#### 3. ✅ Property Management Quick Wins — commit `faba006`

แก้ปัญหา UX 4 ข้อ:
- **Search ยูนิต:** ใส่ `unitSearchQuery` state + bind onChange + filter logic
- **Toast notifications:** เพิ่ม `import { toast } from 'sonner'` → ใส่ใน `handleSaveUnit`, `handleDeleteProperty`, `handleDeleteUnit`
- **Project save error:** ลบ `handleSaveProperty` เก่า (dead code)
- **Dead code cleanup:** ลบ `propertyForm`, `setPropertyForm`, `resetPropertyForm`

#### 4. ✅ Surgical UI Merge — commit `083f6f5` (เดียวกับ #2)

User ตัดสินใจกู้คืน UI จาก `origin/002` แต่เก็บ feature/multi-role ในส่วน Lead Scoring:
- **Restore 10 ไฟล์** จาก `origin/002` (font, Stats Cards, Header, modals, Index)
- **Surgical** PropertyManagement.tsx: เก็บ Lead integration จาก feature/multi-role + เปลี่ยน Stats Cards UI เป็นแบบ 002 (plain Card)
- **เก็บ Quick Wins** ที่ทำก่อนหน้า

#### 5. ✅ Properties Dedup Bug — แก้ครบ Step C+A+B (commit `45d81ea`)

**ปัญหาเดิม:** หน้า `/properties` แสดง 105 cards แทน 53 เพราะ:
- Code: `fetchProperties()` ไม่ dedupe เวลา merge `properties` + `projects`
- Data: มี duplicate records (19 ชื่อใน properties + 20 ใน projects) — orphan records ไม่มี FK

**ที่ทำ:**
- **Step C (FK Check):** ตรวจ `units`, `lead_interests`, `leads` — พบเฉพาะ THE FORESTIAS มี units จริง 21 ตัว, ที่เหลือ orphan
- **Step A (Code Fix):** ใส่ `Map<string, Property>` dedupe ใน `fetchProperties()` (prefer projects entry)
- **Step B (Data Cleanup):** สร้าง `scripts/cleanup-property-duplicates.cjs` (dry-run + auto-backup) → ลบ 20 records (19 จาก properties + 19 sync จาก projects + 1 IDEO MOBI orphan)
- **Backup:** เก็บ JSON ใน `backups/` (gitignored)

**ผลลัพธ์:** properties=33, projects=33, cards user เห็น=33, FORESTIAS+units=21 ไม่กระทบ

#### 6. ✅ Documentation

- **`docs/PROPERTY_MANAGEMENT_REPORT.md`** (781 บรรทัด) — รายงานครบ 16 sections, อัพเดต v2 หลังแก้บั๊ก
- **`docs/PROPERTY_MANAGEMENT_TEST_PROMPT.md`** (668 บรรทัด) — Test Plan v2 มี **200 test cases** ครอบคลุม 100% ของรายงาน

#### 7. ✅ Helper Scripts (commit `018043d`)

- `scripts/list-admins.cjs` — ดู users ที่เป็น owner/admin
- `scripts/reset-admin-password.cjs` — reset รหัสผ่าน user ผ่าน Supabase Admin API
- `scripts/cleanup-property-duplicates.cjs` — cleanup duplicate records (dry-run + backup)

---

### 🌐 Git State ปัจจุบัน

#### Local Branches
| Branch | Commit | Sync Status |
|--------|--------|-------------|
| `001-production-readiness` ⭐ (current) | `45d81ea` | ✅ Sync |
| `002-production-readiness` | `f4f0e08` | ✅ Sync |
| `feature/multi-role` | `2c3f681` | ✅ Sync |

#### Recent Commits บน 001
```
45d81ea fix(properties): dedupe project list + cleanup duplicate records
018043d feat(scripts): add admin user listing and password reset utilities
faba006 refactor(properties): Quick Wins + surgical UI merge
083f6f5 feat: add DashboardLayout + restore UI from 002-production-readiness
1e11611 merge: integrate feature/multi-role into 001-production-readiness
2a7fbc0 merge: integrate 002-production-readiness into 001-production-readiness
```

#### Uncommitted Changes
- `M .claude/settings.local.json` — auto-perm churn (ไม่ต้อง commit)
- `M docs/PROPERTY_MANAGEMENT_REPORT.md` — เขียน v2 ใหม่ (อาจต้อง commit)
- `?? *.png` — screenshots ทดสอบ (ไม่ต้อง commit)
- `?? backups/` — gitignored

> 💡 มี 1 ไฟล์ที่อาจต้อง commit: `docs/PROPERTY_MANAGEMENT_REPORT.md` v2 + `docs/PROPERTY_MANAGEMENT_TEST_PROMPT.md` v2 + `docs/RESUME_PROMPT_2026-04-27.md` (ไฟล์นี้)

---

### 📚 Memory Files ที่บันทึกไว้

อ่านได้ที่ `C:\Users\chitp\.claude\projects\c--chitpon59-dev-project-Chatuae-chateau-platform2-chateau-platform\memory\`:

| ไฟล์ | บทบาท |
|------|------|
| `MEMORY.md` | Index ของ memory ทั้งหมด |
| `user_ide.md` | User ใช้ Antigravity IDE บน Windows 11 |
| `project_mcp_setup_complete.md` | MCP setup สำเร็จแล้วเมื่อ 2026-04-16 |
| `project_leads_integration_plan.md` | แผน import leads จาก WP Form, FB, LINE (ยังไม่ implement) |
| `project_properties_dedup_bug.md` | **Bug RESOLVED 2026-04-27** — มี details ของวิธีแก้ |

---

### 🎯 งานที่รอทำต่อ (Pending Work)

#### Priority 1: Comprehensive E2E Testing (~4 ชั่วโมง)
**ไฟล์ instruction:** `docs/PROPERTY_MANAGEMENT_TEST_PROMPT.md`
- 200 test cases ครอบคลุม 15 categories (A-O)
- ทดสอบผ่าน Playwright MCP (UI only — ห้ามแก้ DB)
- ถ้าเจอ FAIL → fix code → retest จนผ่าน
- Output: `docs/PROPERTY_MANAGEMENT_TEST_RESULTS.md`

> 💡 **เริ่มได้ทันที** ถ้าต้องการ — บอก "เริ่มทำ test plan v2" แล้วผมจะอ่าน prompt และเริ่ม

#### Priority 2: Properties Architecture Refactor (large)
2 ตาราง `properties` + `projects` ทำงานคู่กัน — ควร refactor เป็นตารางเดียว
- ต้องวางแผน DB migration
- กระทบหลายหน้า (PropertyManagement, CreateProjectModal, units FK)
- เลื่อนทำได้

#### Priority 3: Cascade Delete สำหรับ Project + Units
ตอนนี้ลบ project แล้ว units จะกลายเป็น orphan
- เพิ่ม cascade delete ใน DB หรือ delete units ก่อนใน handler

#### Priority 4: DashboardLayout Migration (Phase 3)
ทยอย migrate หน้าที่เหลือ (~15 หน้า) เข้า DashboardLayout
- ลด ~10 บรรทัดต่อหน้า
- ทำได้ทีละหน้า ไม่เร่งด่วน

#### Priority 5: Leads Integration (จาก memory)
แผนเก่าใน `project_leads_integration_plan.md`:
- Webhook API endpoint รับ leads จาก WP Form, FB Messenger, LINE
- เพิ่ม fields: source, social_platform, social_id ใน leads table

#### Priority 6: ทดสอบ + แก้บั๊กหน้าอื่น
- `/leads` (Lead Scoring)
- `/campaigns`
- `/analytics`
- `/api` (API Management)
- `/customization`
- `/users`

---

### 🛠️ Quick Start Commands

```bash
# ตรวจสถานะ
git status -sb
git log --oneline -5
git branch -vv

# รัน dev server
npm run dev
# → http://localhost:5173/

# เปิด Playwright (MCP)
# ใช้ ToolSearch โหลด schema ก่อน

# Login admin: sales@chateau.com / Admin@2026!

# ดูรายการ users ที่เป็น admin/owner
node scripts/list-admins.cjs

# Reset password ของ user
# (แก้ TARGET_EMAIL และ NEW_PASSWORD ในไฟล์ก่อน)
node scripts/reset-admin-password.cjs

# Cleanup property duplicates (ถ้ากลับมามีอีก)
node scripts/cleanup-property-duplicates.cjs           # dry-run
node scripts/cleanup-property-duplicates.cjs --execute # actually delete + auto-backup
```

---

### 📁 Key Files Reference

#### Documentation
- `docs/PROPERTY_MANAGEMENT_REPORT.md` (781 lines) — Source of truth สำหรับ /properties page
- `docs/PROPERTY_MANAGEMENT_TEST_PROMPT.md` (668 lines) — Test Plan v2, 200 cases
- `docs/RESUME_PROMPT_2026-04-27.md` ← **ไฟล์นี้**

#### Source Code (สำคัญ)
- `src/pages/PropertyManagement.tsx` (2,096 lines) — หน้า /properties
- `src/components/properties/CreateProjectModal.tsx` — Modal สร้าง/แก้โครงการ
- `src/components/leads/AddLeadModal.tsx` — Modal เพิ่ม lead จาก unit
- `src/components/auth/PermissionGuard.tsx` — 3-role permission system
- `src/components/layouts/DashboardLayout.tsx` (ใหม่) — Outlet layout
- `src/lib/supabase.ts` — Supabase client
- `src/contexts/AuthContextSimple.tsx` — Auth state

#### Config
- `.mcp.json` (root, MCP active config)
- `.env.local` (Supabase keys)
- `.claude/settings.local.json` (permissions)
- `.gitignore` (มี `backups/`, `*.bak`, `.playwright-mcp/`)

---

### 🚦 หลังอ่าน Context เสร็จ

ขอให้ทำตามนี้:
1. **ยืนยันความเข้าใจ:** สรุปสั้นๆ ว่าเข้าใจ context อะไรบ้าง
2. **ตรวจ git status + branch ปัจจุบัน** ว่าตรงตามที่ระบุหรือไม่
3. **ถามว่าจะทำงานข้อไหน:**
   - "เริ่มทำ test plan v2" → อ่าน `docs/PROPERTY_MANAGEMENT_TEST_PROMPT.md` และเริ่มทันที
   - "ทำหน้าอื่น" → ทดสอบหรือแก้หน้าอื่น (`/leads`, `/campaigns`, etc.)
   - "Refactor properties+projects" → วางแผน DB migration
   - "Cascade delete" → แก้ handleDeleteProperty
   - "อื่นๆ" → ทำตามที่ผมบอก

4. **อย่าลืม:**
   - Login admin: `sales@chateau.com` / `Admin@2026!`
   - Branch: `001-production-readiness`
   - ห้ามแก้ DB โดยตรง (ใช้ UI เท่านั้น)
   - ห้าม commit/push โดยไม่ขออนุญาต
   - มี backup tags ใน remote ถ้าต้อง revert

---

## 🤖 PROMPT END

---

## 📊 สรุปจาก Resume Prompt นี้

| รายการ | จำนวน |
|--------|-------|
| งานที่เสร็จในเซสชันก่อน | 7 หมวดใหญ่ |
| Commits ที่ push ไปแล้ว | 5+ commits ใหม่ |
| Lines of documentation | ~2,100 บรรทัด (3 ไฟล์) |
| Pending priorities | 6 หมวด |
| Test cases ที่รอรัน | 200 cases |
| Memory files | 5 ไฟล์ |

---

## 💡 Tips สำหรับการ Resume

1. **ก่อน paste prompt:** ตรวจว่าโปรเจคเปิดใน Claude Code (folder: `chateau-platform`)
2. **หลัง Claude AI ตอบ:** ตรวจ git status + branch ตรงตาม resume prompt
3. **ถ้า memory files หายไป:** ผม regenerate ได้จาก resume prompt นี้
4. **ถ้าอยากทำงานหลายอย่างพร้อมกัน:** บอก priority ลำดับ
5. **Resume prompt นี้ valid:** อย่างน้อย 30 วันจากวันบันทึก

---

*Resume Prompt สร้างขึ้นโดย Claude Code (Opus 4.7) เมื่อ 2026-04-27 17:30 น.*
*ใช้ในเซสชัน Claude AI ใหม่หลังพักงาน — context จะถูกโหลดอัตโนมัติ*
