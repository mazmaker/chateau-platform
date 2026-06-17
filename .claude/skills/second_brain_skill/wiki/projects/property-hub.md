---
title: PROPERTY HUB Platform (Mazmaker proposal v2)
category: project
tags: [property-hub, real-estate, saas, reference-system, mazmaker]
related: [sources/property-hub-v2.md, concepts/two-portal-architecture.md, concepts/permission-matrix-rbac.md, concepts/conversion-watch.md]
sources: [property-hub-v2]
updated: 2026-05-18
---

## What this is
A productized real-estate platform proposal from Mazmaker. **It is a reference system / feature library — not the product being built.** The Chateau Platform takes UX patterns, feature names, and workflows from PROPERTY HUB without copying its demo data, project names, or unit codes.

> 🎯 Opinionated framing baked in by the user: PROPERTY HUB is **system, not data**. Chateau has its own listings; PROPERTY HUB supplies the *shape* of the experience.

## Positioning
- **Vendor:** Mazmaker — https://mazmaker.com — pusitt.n@mazmaker.com — 099 136 8998
- **Tagline:** Real-time Property Database for Sales Teams
- **Audience:** developers/agencies running an in-house agent team that needs a shared, live property inventory + permission-controlled distribution + conversion analytics.
- **Live demo:** `propertyhub-platform.vercel.app/admin/dashboard` (per existing reference memory).

## Architecture summary
Two parallel responsive web portals over one Supabase backend:

| | Agent Portal | Admin Portal |
|---|---|---|
| Form factor | Mobile-first (phone/tablet/desktop) | Desktop-first |
| Permission | Read-only on Property + own profile | Full CRUD across project/property/agent/permission/user |
| Functions | 3 (Browse, Detail, Profile) | 8 (Inventory, Status, Agent Assignment, Users, Activity/Reports, Project, Notification, Conversion Watch) |
| Outbound channel | Share to LINE + brochure download | — |
| Inbound channel | In-app bell + toast notifications | Real-time activity surfacing |

See [two-portal-architecture](../concepts/two-portal-architecture.md) for the pattern abstracted from this proposal.

## Tech stack (pinned by deck)
- Frontend: **Next.js 15**
- Backend: **Node.js**
- DB/Auth/Storage/Realtime: **Supabase** (Pro tier)
- Hosting: **Vercel** (Pro tier)
- Maps: **Google Maps Embed API**
- Charts: **Recharts**

## Feature inventory (cross-referenced)
- Property CRUD with images / floor plan / 3D tour / brochure
- Project module with **site plan + drag-and-drop marker** (Lat/Lng + Plot Number) — see [site-plan-marker](../concepts/site-plan-marker.md)
- **Permission matrix with Clone Wizard** for agent × property — see [permission-matrix-rbac](../concepts/permission-matrix-rbac.md)
- Status lifecycle with **auto-revert booking countdown** + audit trail — see [auto-revert-countdown](../concepts/auto-revert-countdown.md)
- **Conversion Watch** (Hot Listings + Funnel by project) — see [conversion-watch](../concepts/conversion-watch.md)
- In-app notification via **Supabase Realtime** + bell + toast — see [in-app-notification-stack](../concepts/in-app-notification-stack.md)
- LINE share for outbound — see [line-share-integration](../tools/line-share-integration.md)
- Aging report (property time-in-inventory)
- Activity log + Excel/PDF export + drill-down chart interactions
- User management: invite, role (Admin/Agent), active/inactive, force password reset, suspend

## Delivery model
- **8-week build, 2 phases.** Phase 1 (wk 1–4) = foundation + property mgmt + agent portal. Phase 2 (wk 5–8) = permissions/users + notifications + reports + deploy/training.
- **One-time:** 250,000 THB (excl. VAT 7%), ~30-day project-based.
- **Recurring:** Hosting ~2,500/mo, MA 37,500/mo, 1,000 LINE notifications/mo included.
- **Capacity:** 4,000 properties / 100k sessions per year / 500 users / 5–10× upgrade headroom.

## Relationship to Chateau Platform
- Chateau already has the project→unit drill-down (per memory: `project_chateau_existing_property_flow.md`) — PROPERTY HUB additions are **enhancements not rebuilds**.
- Chateau uses **role-based guards on shared pages**, no separate `/agent/*` routes (per `project_chateau_no_separate_agent_portal.md`). PROPERTY HUB's two-portal model is a UX reference, not an architectural mandate for Chateau.
- Any new table/policy added to Chateau from PROPERTY HUB features MUST include Owner cross-tenant access (per `project_owner_sees_all_principle.md`).

## Open questions to resolve with vendor
1. **5 vs 8 admin functions** — budget slide says "ADMIN PORTAL (5 FUNCTIONS)" but capability slide details 8. Which 3 are bundled?
2. **Permission matrix verbs** — does "permission" mean just visibility, or also view/edit/share/book granularity?
3. **Tag taxonomy** — exact tag names (highlight / recommended / featured / new / hot / etc) not legible from extraction.
4. **Filter axes for Property Browse** — which fields are filterable?
5. **Notification preference granularity** — per-channel? per-event? per-project?

## See Also
- [sources/property-hub-v2.md](../sources/property-hub-v2.md) — raw spec ingest
- [concepts/two-portal-architecture.md](../concepts/two-portal-architecture.md)
- [concepts/conversion-watch.md](../concepts/conversion-watch.md)
