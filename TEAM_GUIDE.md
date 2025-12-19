# Team Guide - CHATEAU Platform Production Readiness

## 📅 Date: 2025-12-19
## 🌟 Status: Ready for Team Development

## 🎯 Objective
Transform CHATEAU prototype into production-ready SaaS platform while maintaining existing functionality.

## 🚀 Quick Start for Team Members

### 1. Get the Code
```bash
git clone https://github.com/mazmaker/chateau-platform.git
cd chateau-platform
git checkout 002-production-readiness
npm install
```

### 2. Start Development
```bash
# Start Redis (required for Context7 MCP)
brew services start redis

# Start the app
npm run dev

# App runs on: http://localhost:5173
```

### 3. Run Tests
```bash
# All tests
npm test

# E2E tests
npm run test:e2e

# Test UI
npm run test:ui
```

## 📋 What's Been Done

### ✅ MCP Tools Installed (4/4)
1. **Context7** - AI conversation context management
2. **Supabase** - Database and backend services
3. **Playwright** - E2E testing automation
4. **Shadcn** - Modern UI components

### ✅ Documentation Complete
- **Production Readiness Spec** - Requirements and priorities
- **Implementation Plan** - Technical approach
- **105 Tasks** - Ready for development
- **Research Findings** - Backend patterns, optimization, security

### ✅ Database Ready
- 5 migration scripts for 70-90% performance improvement
- Multi-tenant architecture with RLS
- Optimized indexes for queries

## 📝 Task Overview

### Total: 105 Tasks Across 6 User Stories

#### Phase 1-2: Foundation (30 tasks)
- Setup and infrastructure
- API patterns and error handling

#### Phase 3: UI/UX Preservation (10 tasks) - **PRIORITY 1**
- Keep all existing functionality
- Add error boundaries
- No changes to user experience

#### Phase 4: Backend Infrastructure (20 tasks) - **PRIORITY 1**
- API layer with Express.js patterns
- Centralized error handling
- Performance monitoring

#### Phase 5: Authentication & Security (15 tasks) - **PRIORITY 1**
- Role-based access control
- Session management
- PDPA compliance

#### Phase 6-8: Additional Features (45 tasks)
- Error handling improvements
- Performance optimization
- Testing infrastructure

## 🎯 How to Start

### For Immediate Deployment (Week 1)
1. **Pick tasks from Phase 3** (UI Preservation)
2. Each task takes 1-2 hours
3. Tasks are marked `[P]` for parallel work
4. Example tasks:
   - `T021`: Create E2E test for login flow
   - `T026`: Add error boundary to App.tsx
   - `T028`: Add logging without changing UI

### Task Format
```
- [ ] TaskID [P] [Story] Description with file path
```

Example:
- [ ] T034 [P] [US2] Implement ApiService class in src/lib/api/ApiService.ts

## 🔄 Development Workflow

### Using MCP Tools
```bash
# Check Context7 is working
curl http://localhost:7373/set/test -d '{"value":"working"}'

# Run Playwright tests
npx playwright test

# Generate components with shadcn
npx shadcn@latest add [component-name]
```

### Branch Strategy
- Work on feature branches from `002-production-readiness`
- Each phase can be deployed independently
- MVP ready after Phase 3 completion

### Code Quality
- All code must pass: `npm run lint`
- TypeScript must compile: `npm run build`
- Tests must pass: `npm test`

## 📚 Key Documents

1. **[Tasks List](specs/002-production-readiness/tasks.md)**
   - All 105 tasks with details
   - Parallel execution opportunities
   - Dependencies between tasks

2. **[Production Spec](specs/002-production-readiness/spec.md)**
   - Feature requirements
   - Acceptance criteria
   - Success metrics

3. **[Implementation Plan](specs/002-production-readiness/plan.md)**
   - Technical decisions
   - Architecture patterns
   - Constitution compliance

4. **[Constitution](.specify/memory/constitution.md)**
   - Project principles v1.1.0
   - AI/LLM development guidelines
   - Must-follow rules

## 🎯 Deployment Strategy

### Incremental Releases
- **Week 1**: Deploy UI Preservation (Phase 3)
- **Week 2**: Deploy Backend Infrastructure
- **Week 3**: Deploy Authentication
- **Week 4-5**: Deploy remaining features

### Quality Gates
Each release must pass:
- All tests
- Code review
- Security scan
- Performance benchmarks

## ❓ Questions?

Check these documents first:
- `specs/002-production-readiness/tasks.md` - Task details
- `specs/002-production-readiness/research.md` - Research findings
- `.specify/memory/constitution.md` - Project rules

Still need help? Ask the team lead or check the GitHub Issues.

---

## 🚀 Let's Build!

Your development environment is ready. Pick a task from Phase 3 and start coding! 🎉

Remember: Preserve existing UI/UX first, then enhance with new features.