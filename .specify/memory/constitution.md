<!-- Sync Impact Report:
- Version change: 0.0.0 → 1.0.0 (Initial constitution)
- Modified principles: N/A (initial creation)
- Added sections: Core Principles (5), Production Requirements, Development Workflow, Governance
- Removed sections: N/A
- Templates requiring updates: ✅ plan-template.md, ✅ spec-template.md, ✅ tasks-template.md (all aligned with new principles)
- Follow-up TODOs: None
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

## Production Requirements

### Technology Stack Enforcement
Frontend MUST use React.js with Tailwind CSS. Backend MUST use Node.js with NestJS framework. Database MUST be Supabase (PostgreSQL). All new components MUST follow established patterns from the prototype. Technology changes require architecture review and migration plan.

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

**Version**: 1.0.0 | **Ratified**: 2025-01-19 | **Last Amended**: 2025-01-19