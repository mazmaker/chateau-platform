# CHATEAU Platform — Project Guide

Multi-tenant real-estate SaaS for property developers (prototype → production).
Specs live under `specs/002-production-readiness/`.

## Stack
React + TypeScript + Vite · Supabase (Postgres + RLS) · Tailwind + shadcn/ui.
Multi-tenant via `tenant_id` + RLS. Roles: **owner** (platform) / admin / sales / agent / customer.

## MCP tools (configured in `.mcp.json` — call directly; they work regardless of this file)
- **Supabase** — DB work: `execute_sql`, `apply_migration`, advisors/logs. Run `list_tables` to check schema before changes. **Never apply a migration without explicit approval.**
- **Playwright** — E2E / visual QA. NOTE: full-page snapshots are large and linger in context — prefer typecheck + SQL/grep checks; screenshot only when the visual itself matters, once at the end.
- **Shadcn** — UI components from `@/components/ui/*`.
- **Context7** — fetch current library/framework docs before answering API/config questions.

## Critical rules
- ✅ Preserve existing UI/UX — don't break validated user flows.
- ✅ New UI must match existing fonts/sizes/cards/palette — copy a sibling page (canonical: `src/pages/OwnerDashboard.tsx`). Don't hand-roll new sizing.
- ✅ Reuse, never reinvent: before writing any formatter/util/token/label, **grep for an existing one and copy it**. Compact money = Thai "X ล้าน" / "K" (canonical `formatTHB` in `src/pages/Index.tsx`) — NEVER "M"/"B".
- ✅ Strict multi-tenant isolation (RLS). Owner keeps cross-tenant read access; every new table/policy must include Owner access.
- ✅ PDPA: Thai-market data handling; audit admin actions.
- ✅ Check the Constitution before structural changes.
- ❌ Don't commit/push or apply migrations without an explicit ask (user batches their own commits).
- ❌ Don't mix tenant data · don't deploy without review.

## Typography — Standard Scale (ใช้ทุกหน้าทุกเมนู)
ห้ามใช้ arbitrary size เช่น `text-[13px]`, `text-[15px]`, `text-[26px]` — ใช้เฉพาะ Tailwind standard:

| ใช้กับ | Class | ขนาด |
|---|---|---|
| Page title (h1) | `text-2xl font-bold` | 24px |
| Section title (h2) | `text-base font-bold` | 16px |
| ข้อความปกติ | `text-sm` | 14px |
| Meta / helper / badge | `text-xs` | 12px |
| ตัวเลข KPI ใหญ่ | `text-2xl` หรือ `text-3xl` | 24–30px |

**ข้อยกเว้น:** chart axis label / bar badge ที่ space จำกัดมาก ใช้ `text-[10px]`/`text-[11px]` ได้ (แค่ใน chart components)

## Owner Role — วิเคราะห์มุม SaaS เจ้าของแพลตฟอร์ม
เมื่อทำงานใน Owner pages ให้วิเคราะห์จากมุมมอง **เจ้าของแพลตฟอร์ม SaaS** ที่ขายระบบบริหารอสังหาฯ ให้ developer (tenant) ไม่ใช่มุมของบริษัทอสังหาเอง:
- ถามตัวเองก่อนเสมอ: "เจ้าของ SaaS จะใช้ข้อมูลนี้ทำอะไร? มันตอบโจทย์ MRR / churn / retention / upsell ไหม?"
- ข้อมูล technical (slug, UUID, internal ID) ไม่ควรโชว์ในตารางหลัก — ซ่อนไว้ใน detail/settings
- KPI ที่มีอยู่แล้วในหน้าอื่นไม่ควรซ้ำ เว้นแต่ granularity ต่างกัน (เช่น MRR รวม vs MRR ต่อ tenant)
- การ์ดบนหน้า health dashboard ต้องตอบคำถาม "เสี่ยงสูญเงินเท่าไร" ไม่ใช่แค่ "มีกี่บริษัท"

## UI Data Rules
- ✅ ทุก list/table ต้องมี filter/search — ห้าม dump ข้อมูลแบบ flat ไม่มีตัวกรอง
- ✅ ทุก field ที่แสดงใน Detail UI ต้องแก้ไขได้ใน Edit form
- ✅ feature ใหม่ต้องครบ end-to-end: trigger → save → display → action
- ✅ Period filter ใส่เฉพาะเมื่อข้อมูลเปลี่ยนตาม period จริง — ห้ามใส่ filter ที่ไม่ส่งผลต่อข้อมูล
- ✅ Badge / status label ให้ใช้สีและ style เดียวกันทุกหน้า (อ้างอิง `OwnerTenantHealth.tsx` HEALTH_META)

## Drill-down Navigation (ทุก Owner page)
แพลตฟอร์ม → บริษัท → โครงการ → ยูนิต → ลูกค้า (read-only ฝั่ง Owner)
- ปุ่ม "ดูรายละเอียด →" ต้อง navigate ไป `/route/:id` ที่ถูกต้อง ไม่ใช่แค่ list page
- Geography: จังหวัด → อำเภอ → โครงการ (expand row)

## เมื่อมีกฎใหม่จากผู้ใช้
เพิ่มทั้ง 3 ที่พร้อมกัน:
1. สรุปสั้นใน `CLAUDE.md` (auto-loaded ทุก session)
2. รายละเอียดครบใน `.claude/rules/` (ดู index ด้านล่าง)
3. Memory ใน `~/.claude/projects/.../memory/` (ถ้าเกี่ยว preference ผู้ใช้)

## Rules Index (`.claude/rules/`)
| ไฟล์ | เนื้อหา |
|---|---|
| `01-typography.md` | Font size scale + mapping arbitrary→standard |
| `02-owner-saas-perspective.md` | บทบาท Owner, คำถามที่ต้องถามตัวเองก่อนทำ, metrics |
| `03-ui-data-standards.md` | Filter/search, badge style, money format, drill-down |
| `04-workflow-rules.md` | สิ่งห้ามทำโดยไม่ขอ, วิธีเสนองาน, RLS |

## Targets
API <200ms (p95) · page load <2s · realtime <500ms · test coverage 80% on critical paths.

## Key references
- Constitution: `.specify/memory/constitution.md`
- PRD: `documents/PRD.md` · Tasks: `specs/002-production-readiness/tasks.md` · Plan: `specs/002-production-readiness/plan.md`
- Migrations: `supabase/migrations/` · UI components: `src/components/ui/` · MCP config: `.mcp.json`

---
*Previous version (full 4-agent "orchestrator" activation prompts) is in git history if needed.*

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
