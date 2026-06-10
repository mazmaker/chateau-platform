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

## Targets
API <200ms (p95) · page load <2s · realtime <500ms · test coverage 80% on critical paths.

## Key references
- Constitution: `.specify/memory/constitution.md`
- PRD: `documents/PRD.md` · Tasks: `specs/002-production-readiness/tasks.md` · Plan: `specs/002-production-readiness/plan.md`
- Migrations: `supabase/migrations/` · UI components: `src/components/ui/` · MCP config: `.mcp.json`

---
*Previous version (full 4-agent "orchestrator" activation prompts) is in git history if needed.*
