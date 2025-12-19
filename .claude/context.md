# CHATEAU Project Context

## Project Overview
CHATEAU is a Prop Tech Intelligence platform - a multi-tenant SaaS solution for real estate management.

## Architecture
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **State Management**: TanStack Query
- **Testing**: Vitest + React Testing Library + Playwright
- **Multi-tenancy**: Row Level Security (RLS)

## Key Features
1. Dashboard with real-time statistics
2. Property management (units, projects, pricing)
3. Customer relationship management with AI scoring
4. Sales team management and performance tracking
5. Marketing campaign automation
6. Comprehensive audit logging

## Development Commands
```bash
# Development
npm run dev

# Testing
npm run test
npm run test:ui
npm run test:e2e

# Build
npm run build
npm run preview

# Supabase
supabase start
supabase db push
supabase gen types typescript --local > src/types/database.ts
```

## Important Files
- `specs/001-production-readiness/` - Implementation plan for production readiness
- `src/lib/supabase.ts` - Supabase client configuration
- `src/types/database.ts` - Generated TypeScript types
- `.specify/memory/constitution.md` - Project constitution and principles

## Current Status
- ✅ Prototype phase complete
- 🔄 Production readiness enhancement in progress
- 📋 Working on incremental deployment strategy

## Current Git Status
- **Branch**: 001-production-readiness
- **Commit**: 6e9583a
- **Status**:
```
 M .DS_Store
 M .claude/settings.local.json
 M .specify/memory/constitution.md
 D PRD.md
 D ProjectBrief.md
?? .claude/context.md
?? .claude/hooks/
?? .vscode/
?? documents/
?? node_modules/
?? package-lock.json
?? package.json
?? scripts/
?? specs/
```
