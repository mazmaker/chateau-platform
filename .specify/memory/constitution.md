<!-- Sync Impact Report:
- Version change: 1.0.0 → 1.1.0 (Added AI/LLM development principles)
- Modified principles: N/A (all preserved, new section added)
- Added sections: AI/LLM Development Principles, MCP Tools Integration
- Removed sections: N/A
- Templates requiring updates: ⚠ plan-template.md (add AI task types), ⚠ tasks-template.md (MCP task categories)
- Follow-up TODOs: Update template files to include AI/LLM and MCP-specific guidance
-->

# CHATEAU Constitution
<!-- Prop Tech Intelligence Platform Constitution -->

## Core Principles

### I. Prototype Experience Preservation
All changes MUST preserve the working user experience that already exists. The prototype's proven user flows and UI/UX patterns are considered validated and should only be enhanced, not replaced. Any modification to core user journeys MUST provide measurable improvement without disrupting existing users.

### II. SaaS Multi-Tenancy First
The system MUST implement strict multi-tenant architecture with complete data isolation between companies. All database operations MUST use tenant-scoped queries with Row Level Security (RLS). Development MUST test with multiple tenants to prevent data leakage. No tenant data should ever be accessible to another tenant under any circumstances.

### III. Real-Time By Default
All critical state changes (unit status, booking locks, user assignments) MUST propagate to all relevant users within 500ms. The system MUST use Supabase Realtime subscriptions for live updates. Background processing MUST be asynchronous with proper queuing. Dashboard data MUST refresh automatically without user intervention.

### IV. Security & Compliance Non-Negotiable
All user data MUST be encrypted at rest (AES-256) and in transit (TLS 1.3). The system MUST maintain PDPA compliance with consent logging and data retention policies. All API endpoints MUST implement rate limiting and OWASP protection. Authentication MUST include session management with 30-minute auto-logout. No sensitive data may be logged or exposed in error messages.

### V. AI Score Integration
Customer Potential Score and Financial Score MUST be integrated into all relevant workflows. Sales representatives MUST see these scores prominently in customer views. The scoring algorithm MUST be consistent and transparent. AI-based segmentation MUST be available for campaign targeting. All AI features MUST maintain explainability.

## AI/LLM Development Principles

### VI. AI-Assisted Development Mandate
All development activities MUST leverage available MCP (Model Context Protocol) tools for enhanced productivity and consistency. Context7 MUST be used for maintaining conversation context across development sessions. Supabase MCP MUST be used for database operations. Playwright MUST be used for test generation and validation. Shadcn components MUST be preferred for UI consistency.

### VII. Context Preservation
All AI-assisted development MUST maintain context using Context7 MCP. Critical decisions, architectural patterns, and business logic MUST be documented and retrievable across sessions. No significant implementation should start without reviewing relevant historical context. The system MUST track the evolution of features from prototype through production.

### VIII. Automated Quality Assurance
Playwright MCP MUST be used to generate E2E tests for all user-facing features. Tests MUST cover multi-tenant scenarios. Test generation MUST happen concurrently with feature development. All critical user journeys from the prototype MUST have automated test coverage before any modifications.

## Production Requirements

### MCP Tools Integration
The system MUST integrate and utilize four core MCP tools:
1. **Context7** for persistent AI conversation context and knowledge management
2. **Supabase** for database operations, authentication, and real-time subscriptions
3. **Playwright** for automated E2E testing and quality assurance
4. **Shadcn** for consistent, accessible UI component library

### Technology Stack Enforcement
Frontend MUST use React.js with Tailwind CSS and Shadcn components. Backend MUST use Node.js with NestJS framework. Database MUST be Supabase (PostgreSQL). All new components MUST follow established patterns from the prototype. Technology changes require architecture review and migration plan.

### Performance Standards
Dashboard pages MUST load within 1.5 seconds. API responses MUST be under 200ms for non-computational endpoints. Real-time updates MUST reach all clients within 500ms. The system MUST support 1000 concurrent users per tenant. Database queries MUST use connection pooling via Supavisor.

### Data Integrity Requirements
Unit locking MUST prevent double booking with 15-minute reservation windows. All financial transactions MUST be ACID compliant. Data imports MUST be validated and transactional. Audit logs MUST track all data modifications with user, timestamp, and change details. No customer data may be deleted without soft-delete and retention period.

## Development Workflow

### Test-First Implementation
All new features MUST have failing tests before implementation. Integration tests MUST cover multi-tenant scenarios. Contract tests MUST verify API responses. UI tests MUST validate critical user journeys. No feature may be deployed without passing all tests in multi-tenant environment.

### Incremental Delivery
Features MUST be developed as independent, releasable units. Each user story MUST provide standalone value. MVP releases MUST preserve existing functionality. Feature flags MUST control rollouts. Hotfixes MUST be possible without full redeployment.

### Code Quality Standards
All code MUST pass linting and formatting rules. Complex business logic MUST have unit tests with >80% coverage. Database migrations MUST be forward and backward compatible. API changes MUST maintain backward compatibility for one version. Security reviews are mandatory for authentication and data access changes.

## Governance

This constitution supersedes all conflicting practices. Amendments require:
1. Written justification identifying the specific limitation
2. Impact analysis on existing features and tenants
3. Migration plan for backward compatibility
4. Approval from system architect and product lead
5. Version increment following semantic versioning

All pull requests MUST verify constitutional compliance. Complexity beyond these principles requires explicit approval and documentation. Use runtime guidance documents for day-to-day development decisions.

**Version**: 1.1.0 | **Ratified**: 2025-01-19 | **Last Amended**: 2025-12-19