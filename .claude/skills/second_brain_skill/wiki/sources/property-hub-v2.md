---
title: PROPERTY HUB PLATFORM Ver.2 — Proposal Deck
category: source
tags: [property-hub, proposal, real-estate, saas, mazmaker]
related: [projects/property-hub.md, concepts/two-portal-architecture.md, concepts/permission-matrix-rbac.md, concepts/conversion-watch.md, concepts/auto-revert-countdown.md, concepts/site-plan-marker.md, concepts/in-app-notification-stack.md, tools/supabase-realtime.md, tools/line-share-integration.md]
sources: [property-hub-v2]
updated: 2026-05-18
---

## Provenance
- **File:** `note/raw/[Temp] PROPERTY HUB PLATFORM VER.2 (1).pdf`
- **Pages:** 170 (mostly Canva-rendered visual slides)
- **Vendor:** Mazmaker (pusitt.n@mazmaker.com, 099 136 8998, https://mazmaker.com)
- **Tagline:** "Real-time Property Database for Sales Teams"
- **Extraction note:** `pdftotext -layout` produced ~308 lines. Thai text in subsetted fonts dropped to whitespace/dashes; structural English captions and bullet headers survived. Treat any captured Thai phrasing as approximate — re-read the PDF visually for verbatim copy.

## Document structure
1. Proposed Solution overview
2. Agent Portal — platform types, permissions, capabilities, core functions, site map
3. Admin Portal — same sections, deeper feature list (8 functions)
4. Platform Workflow (listing → inquiry → LINE share → booking → close)
5. Reference screenshots (Agent + Admin)
6. Project Timeline (8 weeks, 2 phases)
7. Budget (one-time + recurring)
8. Contact slide

## Headline takeaways
1. **Two-portal split is the central architecture choice.** Agent Portal = read-only, mobile/tablet/desktop responsive, 3 core functions (Browse, Detail, Profile). Admin Portal = full CRUD, desktop-first, 8 core functions. They share the same database but ship as separate UX surfaces.
2. **8-week build, 2 phases.** Phase 1 (wk 1–4): Next.js 15 + Supabase setup, DB schema + RLS, Auth/RBAC, UI foundation, Property CRUD, Project module with site-plan marker, Audit trail, Agent Portal (browse/filter/search, detail with map + floor plan, LINE share/download). Phase 2 (wk 5–8): Permission matrix + clone, user mgmt, notification schema + Supabase Realtime + bell/toast, KPI dashboard + Recharts, aging report, conversion watch, activity log + export, deploy to Vercel + SSL + training + 3-month go-live support.
3. **Notification stack is explicit and layered.** In-app via Supabase Realtime push (bell icon + toast UI) + LINE share for outbound prospect comms. Recurring plan budgets 1,000 LINE notifications/month.
4. **Permission Matrix has a "Clone Permission" wizard.** Bulk assign agents to properties; cloning a permission profile from one agent to another is called out as a primary admin workflow.
5. **"Conversion Watch" and "Auto-revert" are named features.** Conversion Watch = Hot Listings + conversion funnel grouped by project. Auto-revert = booking countdown that flips status back if the agent doesn't close within the window. Both should be treated as proper-noun features in Chateau, not generic capabilities.
6. **Tech stack pinned.** Next.js 15 (frontend) + Node.js (backend) + Supabase (DB + Auth + Storage + Realtime) + Vercel (hosting) + Google Maps Embed API. Charts via Recharts.
7. **Capacity & pricing benchmarks.** 4,000 properties, ~100k sessions/year, 500 users, 5–10× upgrade headroom. One-time project 250,000 THB (excl. VAT 7%, ~30 days). Recurring: hosting ~2,500/mo (Vercel Pro + Supabase Pro), MA 37,500/mo (monitoring + bug fixes + minor enhancements).

## Agent Portal — full feature inventory
**Platform:** Responsive web (mobile / tablet / desktop). **Permission:** Agent = read-only on Property + own profile.

- **PROPERTY BROWSE:** list + Filter + Search. Grid/List toggle. Filter by property type/status/price/etc (specific filter axes obscured by Thai font drop).
- **PROPERTY DETAIL:** Gallery with zoom, plot number on site plan, Floor Plan + 3D Tour, Site Plan section, Promotion section, Brochure preview/download (limited by privacy gates), share to LINE.
- **MY PROFILE:** email/phone edit, password reset, notification preferences.
- **NOTIFICATIONS:** in-app (property updates / status changes / permission changes).

**Site map:** Authentication (Login) → Properties (Grid/List + Filter/Search → Detail with Gallery + Specs + Map + Floor Plan + Promotion + Site Plan + Share to LINE) → Profile (password reset + notification settings) → Notifications.

## Admin Portal — full feature inventory
**Platform:** Responsive web, desktop/tablet/mobile. **Permission:** Admin/Owner = full access to project/property/agent/permission/user.

8 core functions:
1. **PROPERTY INVENTORY** — full CRUD, images/floor plan/3D tour/brochure, tags (highlight/recommended/etc — exact tag taxonomy obscured), drag-and-drop site-plan marker placement with Lat/Lng + Plot Number, default visibility per property.
2. **STATUS MANAGEMENT** — status lifecycle with audit trail, auto-revert on booking countdown timeout.
3. **AGENT ASSIGNMENT** — assign agents to properties (1:N), permission matrix per agent per property/project, clone-permission wizard for bulk profile reuse.
4. **USER MANAGEMENT** — invite by email/phone, role assignment (Admin / Agent), active/inactive toggle, force password reset, suspend, real-time activity surfacing.
5. **ACTIVITY & REPORTS** — KPI dashboard (Property total / status breakdown / sales trend / top-5), aging report (property age in inventory), conversion watch (hot listings + funnel by project), activity log with filters + export to Excel/PDF, drill-down chart interactions.
6. **PROJECT MANAGEMENT** — project CRUD with site plan / cover image / floor map.
7. **NOTIFICATION** — schema + triggers + Supabase Realtime push + bell + toast.
8. **CONVERSION WATCH** — Hot Listings + Conversion Funnel grouped by project (listed both standalone and as part of Reports).

**Site map:** Login → Dashboard (KPI cards + sales trend + top-5 + status pie) → Properties (Grid + Filter + Search + Detail with Status Timeline) → Agent Permissions (Permission Matrix + Clone Wizard) → Users → Reports (Aging + Conversion Watch + Conversion Funnel + Activity Log).

## Platform Workflow (one-flow narrative)
1. **Add Property** — Admin uploads property + floor plan + images + 3D.
2. **Set Sales Permissions** — Admin grants property visibility to agent(s) via permission matrix.
3. **Real-time Notify** — In-app notification fires to assigned agents.
4. **Customer Inquiry** — Customer reaches out (channel not specified, likely LINE inbound).
5. **Browse on Mobile** — Agent uses Agent Portal filter/search on mobile.
6. **Share to LINE** — Agent shares property detail + brochure to customer via LINE.
7. **Update Booked** — Agent or Admin marks status = booked, kicks off countdown timer.
8. **Auto-Notify + Countdown** — Notification fires, countdown auto-reverts status if not closed.
9. **Close Deal Sold** — Status flips to sold, audit trail updated.

## Tech stack (verbatim from deck)
| Layer | Choice |
|---|---|
| Frontend | Next.js 15 |
| Backend | Node.js |
| Database / Auth / Storage / Realtime | Supabase |
| Hosting | Vercel (Pro tier) |
| Maps | Google Maps Embed API |
| Charts | Recharts |

## Budget (verbatim)
- **One-time, project-based:** 250,000 THB (excl. VAT 7%, ~30-day delivery). Covers: Admin Portal (5 functions billed), Agent Portal (3 functions billed), in-app notification, UI/UX, project setup + deploy. (Note: deck elsewhere says 8 admin functions — the 5/3 billing split appears to bucket the 8 into 5 paid units. Verify with vendor.)
- **Recurring / operational:**
  - Domain (.com) + SSL: ~1,000 THB/year (registration cost only).
  - Hosting: Vercel Pro + Supabase Pro = ~2,500 THB/month.
  - LINE notifications: 1,000 messages/month included.
  - MA agreement: 37,500 THB/month — monitoring + bug fixes + minor enhancements.
- **Capacity headroom:** 4,000 properties, ~100k user sessions/year, 500 users, 5–10× upgrade ceiling without architectural rework.

## Caveats / unknowns
- **Thai labels lost.** Most Thai feature descriptions did not extract. Visual deck is the source of truth for exact wording (matches existing "Canva = source of truth" guidance).
- **5 vs 8 admin functions.** Budget slide lists "ADMIN PORTAL (5 FUNCTIONS)" while Admin Portal capability slide details 8. Either the billing units bundle some functions, or the budget pre-dates feature creep. Resolve with vendor.
- **Filter axes for Property Browse** not legible from extraction.
- **Tag taxonomy** (highlight/recommended/featured/etc) names not legible.
- **Notification preference** granularity (per-channel, per-event) not legible.
- **Permission Matrix dimensions** — confirmed it's per agent × per property/project, but whether it has finer-grained verbs (view/edit/share) is unclear.
- **Page count vs content density.** 170 pages with ~308 lines of text means the vast majority is screenshots/visuals — when implementation questions come up, open the PDF visually rather than relying on this extraction.

## See Also
- [projects/property-hub.md](../projects/property-hub.md)
- [concepts/two-portal-architecture.md](../concepts/two-portal-architecture.md)
- [concepts/permission-matrix-rbac.md](../concepts/permission-matrix-rbac.md)
- [concepts/conversion-watch.md](../concepts/conversion-watch.md)
- [concepts/auto-revert-countdown.md](../concepts/auto-revert-countdown.md)
- [concepts/site-plan-marker.md](../concepts/site-plan-marker.md)
- [concepts/in-app-notification-stack.md](../concepts/in-app-notification-stack.md)
- [tools/supabase-realtime.md](../tools/supabase-realtime.md)
- [tools/line-share-integration.md](../tools/line-share-integration.md)
