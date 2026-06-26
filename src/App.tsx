import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import UserManagement from "./pages/UserManagement";
import { SimpleLogin } from "./pages/SimpleLogin";
import NotFound from "./pages/NotFound";
import OwnerDashboard from "./pages/OwnerDashboard";
import OwnerInsights from "./pages/OwnerInsights";
import OwnerLeads from "./pages/OwnerLeads";
import OwnerSupport from "./pages/OwnerSupport";
import OwnerProjects from "./pages/OwnerProjects";
import OwnerUnitDetail from "./pages/OwnerUnitDetail";
import OwnerMarketOverview from "./pages/OwnerMarketOverview";
import OwnerSalesBreakdown from "./pages/OwnerSalesBreakdown";
import OwnerCompanies from "./pages/OwnerCompanies";
import OwnerCustomers from "./pages/OwnerCustomers";
import OwnerTenantHealth from "./pages/OwnerTenantHealth";
import OwnerMarketing from "./pages/OwnerMarketing";
import OwnerAudit from "./pages/OwnerAudit";
import OwnerSystemHealth from "./pages/OwnerSystemHealth";
import TenantManagement from "./pages/TenantManagement";
import PaymentDashboard from "./pages/PaymentDashboard";
import PropertyManagement from "./pages/PropertyManagement";
import UnitDetail from "./pages/UnitDetail";
import UnitEdit from "./pages/UnitEdit";
import ProjectEdit from "./pages/ProjectEdit";
import LeadManagement from "./pages/LeadManagement";
import LeadCDP from "./pages/LeadCDP";
import CampaignManagement from "./pages/CampaignManagement";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignBuilderWizard from "./pages/CampaignBuilderWizard";
import Triggers from "./pages/Triggers";
import MarketingAnalytics from "./pages/MarketingAnalytics";
import AdminCustomization from "./pages/AdminCustomization";
import Analytics from "./pages/Analytics";
import ApiManagement from "./pages/ApiManagement";
import Settings from "./pages/Settings";
import Permissions from "./pages/Permissions";
import LegalDocument from "./pages/LegalDocument";
import CustomerLogin from "./pages/customer/CustomerLogin";
import CustomerLineCallback from "./pages/customer/CustomerLineCallback";
import CustomerDashboard from "./pages/customer/CustomerDashboard";
import CustomerProperties from "./pages/customer/CustomerProperties";
import CustomerPropertyDetail from "./pages/customer/CustomerPropertyDetail";
import CustomerUnitDetail from "./pages/customer/CustomerUnitDetail";
import CustomerProfile from "./pages/customer/CustomerProfile";
import CustomerBookings from "./pages/customer/CustomerBookings";
import MyDashboard from "./pages/MyDashboard";
import PropertyPlansEditor from "./pages/PropertyPlansEditor";
import TeamMemberPerformance from "./pages/TeamMemberPerformance";
import TeamPerformance from "./pages/TeamPerformance";
import AcceptInvite from "./pages/AcceptInvite";
import ForcePasswordChange from "./pages/ForcePasswordChange";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { ProtectedRouteSimple } from "@/components/auth/ProtectedRouteSimple";
import { TenantStatusGuard } from "@/components/auth/TenantStatusGuard";
import ErrorBoundary from "@/components/ErrorBoundary";
import { DashboardLayout } from "@/components/layouts/DashboardLayout";

const App = () => (
  <ErrorBoundary
    showRetry={true}
    showHome={true}
    resetOnLocationChange={true}
    context={{ application: 'chateau-platform', layer: 'app-root' }}
  >
    <TenantStatusGuard>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          {/* Authentication Routes - Only accessible when not logged in */}
          <Route path="/auth/login" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าเข้าสู่ระบบได้"
              context={{ page: 'login' }}
            >
              <ProtectedRouteSimple onlyGuests={true}>
                <SimpleLogin />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Accept Invite Route - For user to accept invite and set password */}
          <Route path="/auth/accept-invite" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้ารับคำเชิญได้"
              context={{ page: 'accept-invite' }}
            >
              <AcceptInvite />
            </ErrorBoundary>
          } />

          {/* Force Password Change Route - For users with temporary passwords */}
          <Route path="/auth/change-password" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าเปลี่ยนรหัสผ่านได้"
              context={{ page: 'force-password-change' }}
            >
              <ProtectedRouteSimple>
                <ForcePasswordChange />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Forgot Password — shows the feature in the demo; the reset-email backend isn't wired yet. */}
          <Route path="/auth/forgot-password" element={
            <ErrorBoundary showRetry={true} showHome={true} errorMessage="ไม่สามารถโหลดหน้าลืมรหัสผ่านได้" context={{ page: 'forgot-password' }}>
              <ForgotPasswordForm />
            </ErrorBoundary>
          } />

          {/* Alias for login */}
          <Route path="/login" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าเข้าสู่ระบบได้"
              context={{ page: 'login' }}
            >
              <ProtectedRouteSimple onlyGuests={true}>
                <SimpleLogin />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Legal documents — public (Terms / Privacy / DPA). Placeholder content for now. */}
          <Route path="/terms" element={
            <ErrorBoundary showHome={true} errorMessage="ไม่สามารถโหลดเอกสารได้" context={{ page: 'legal-terms' }}>
              <LegalDocument doc="terms" />
            </ErrorBoundary>
          } />
          <Route path="/privacy" element={
            <ErrorBoundary showHome={true} errorMessage="ไม่สามารถโหลดเอกสารได้" context={{ page: 'legal-privacy' }}>
              <LegalDocument doc="privacy" />
            </ErrorBoundary>
          } />
          <Route path="/dpa" element={
            <ErrorBoundary showHome={true} errorMessage="ไม่สามารถโหลดเอกสารได้" context={{ page: 'legal-dpa' }}>
              <LegalDocument doc="dpa" />
            </ErrorBoundary>
          } />

          {/* Main Dashboard Route - Protected */}
          <Route path="/" element={
            <ErrorBoundary
              showRetry={true}
              showHome={false}
              errorMessage="ไม่สามารถโหลดแดชบอร์ดได้"
              context={{ page: 'dashboard' }}
            >
              <ProtectedRouteSimple>
                <Index />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Protected Routes */}
          <Route path="/users" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการผู้ใช้ได้"
              context={{ page: 'user-management' }}
            >
              <ProtectedRouteSimple>
                <UserManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Owner-only Routes */}
          <Route path="/owner" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้า Executive Dashboard ได้"
              context={{ page: 'owner-dashboard' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerDashboard />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-insights" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าข้อมูลเชิงลึกได้"
              context={{ page: 'owner-insights' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerInsights />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-leads" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้า Leads ได้"
              context={{ page: 'owner-leads' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerLeads />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-support" element={
            <ProtectedRouteSimple requireRole="owner">
              <OwnerSupport />
            </ProtectedRouteSimple>
          } />

          {/* Owner จัดการโครงการ — cross-tenant, read-only (control-plane).
              Three drill levels share one component via route params:
              all companies → one company's projects → one project's units
              (inventory view only, no customer PII). */}
          <Route path="/owner-projects" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้า Project Dashboard ได้"
              context={{ page: 'owner-projects' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerProjects />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-projects/:tenantId" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดโครงการของบริษัทได้"
              context={{ page: 'owner-projects-tenant' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerProjects />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-projects/:tenantId/:projectId" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดยูนิตของโครงการได้"
              context={{ page: 'owner-projects-units' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerProjects />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* L3 — one unit's full read-only spec sheet (inventory view, no PII). */}
          <Route path="/owner-projects/:tenantId/:projectId/:unitId" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียดยูนิตได้"
              context={{ page: 'owner-projects-unit-detail' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerUnitDetail />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Owner ANALYTICS — cross-tenant real-estate intelligence (HQ lens).
              See documents/owner-hq-dashboard-plan.md. */}
          {/* ภาพรวมผู้ซื้อ รวมเข้ากับ ฐานข้อมูลผู้สนใจ → /owner-customers (overview เดิมบางกว่า drill เลยรวมเป็นหน้าเดียวที่ครบ 2026-06-25). ไฟล์ OwnerBuyerOverview.tsx ยังอยู่ใน git เผื่อ rollback */}
          <Route path="/owner-buyer-overview" element={<Navigate to="/owner-customers" replace />} />
          <Route path="/owner-customers" element={
            <ErrorBoundary showRetry={true} showHome={true} errorMessage="ไม่สามารถโหลดหน้า Customer Intelligence ได้" context={{ page: 'owner-customers' }}>
              <ProtectedRouteSimple requireRole="owner">
                <OwnerCustomers />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />
          {/* Funnel & คะแนนผู้สนใจ ถูกตัดออกจาก Owner console (KPI ซ้ำ ภาพรวมผู้ซื้อ + กรวยเป็น tenant-operational ไม่ใช่ SaaS-owner metric) — รีไดเรกต์กันลิงก์เก่าพัง. ไฟล์ OwnerFunnel.tsx ยังอยู่ใน git เผื่อ rollback */}
          <Route path="/owner-funnel" element={<Navigate to="/owner-customers" replace />} />
          {/* Inventory & Absorption ถูกตัดออกจาก Owner console (เป็น tenant-operational ไม่ใช่ SaaS-owner metric) — รีไดเรกต์กันลิงก์เก่าพัง. ไฟล์ OwnerInventory.tsx ยังอยู่ใน git เผื่อ rollback */}
          <Route path="/owner-inventory" element={<Navigate to="/owner-market-overview" replace />} />
          <Route path="/owner-marketing" element={
            <ErrorBoundary showRetry={true} showHome={true} errorMessage="ไม่สามารถโหลดหน้า Marketing ได้" context={{ page: 'owner-marketing' }}>
              <ProtectedRouteSimple requireRole="owner">
                <OwnerMarketing />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />
          <Route path="/owner-health" element={
            <ErrorBoundary showRetry={true} showHome={true} errorMessage="ไม่สามารถโหลดหน้าภาพรวมผู้เช่าได้" context={{ page: 'owner-health' }}>
              <ProtectedRouteSimple requireRole="owner">
                <OwnerTenantHealth />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />
          <Route path="/owner-market-overview" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าภาพรวมการขายได้"
              context={{ page: 'owner-market-overview' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerMarketOverview />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-sales-breakdown" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าสัดส่วนยอดขายได้"
              context={{ page: 'owner-sales-breakdown' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerSalesBreakdown />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Merged into สัดส่วนยอดขาย — keep old links working */}
          <Route path="/owner-market" element={<Navigate to="/owner-sales-breakdown" replace />} />
          <Route path="/owner-geography" element={<Navigate to="/owner-sales-breakdown" replace />} />

          <Route path="/owner-companies" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าประสิทธิภาพบริษัทได้"
              context={{ page: 'owner-companies' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerCompanies />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Sales Performance ถูกยุบรวมเข้า "อันดับยอดขาย" (/owner-companies) — เก่ารีไดเรกต์ไป */}
          <Route path="/owner-agents" element={<Navigate to="/owner-companies" replace />} />

          <Route path="/owner-audit" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าบันทึกการตรวจสอบได้"
              context={{ page: 'owner-audit' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerAudit />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/owner-system" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าสถานะระบบได้"
              context={{ page: 'owner-system' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <OwnerSystemHealth />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/tenants" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการบริษัทได้"
              context={{ page: 'tenant-management' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <TenantManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/tenants/:id" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียดบริษัทได้"
              context={{ page: 'tenant-detail' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <TenantManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/payments" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการการชำระเงินได้"
              context={{ page: 'payment-dashboard' }}
            >
              <ProtectedRouteSimple requireRole="owner">
                <PaymentDashboard />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Admin Routes - Property & Lead Management */}
          <Route path="/properties" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการโครงการได้"
              context={{ page: 'property-management' }}
            >
              <ProtectedRouteSimple>
                <PropertyManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/units/:unitId" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียดยูนิตได้"
              context={{ page: 'unit-detail' }}
            >
              <ProtectedRouteSimple>
                <UnitDetail />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/units/:unitId/edit" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดฟอร์มแก้ไขยูนิตได้"
              context={{ page: 'unit-edit' }}
            >
              <ProtectedRouteSimple>
                <UnitEdit />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/properties/:id/plans" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการผังโครงการได้"
              context={{ page: 'property-plans-editor' }}
            >
              <ProtectedRouteSimple>
                <PropertyPlansEditor />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/properties/:id/edit" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดฟอร์มแก้ไขโครงการได้"
              context={{ page: 'project-edit' }}
            >
              <ProtectedRouteSimple>
                <ProjectEdit />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/properties/:id" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียดโครงการได้"
              context={{ page: 'property-detail' }}
            >
              <ProtectedRouteSimple>
                <PropertyManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/leads" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าจัดการ Leads ได้"
              context={{ page: 'lead-management' }}
            >
              <ProtectedRouteSimple>
                <LeadManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/sales-operations" element={<Navigate to="/analytics" replace />} />

          <Route path="/my-dashboard" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้า My Dashboard ได้"
              context={{ page: 'my-dashboard' }}
            >
              <ProtectedRouteSimple>
                <MyDashboard />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/team" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าผลงานทีมได้"
              context={{ page: 'team-performance' }}
            >
              <ProtectedRouteSimple>
                <TeamPerformance />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/team/:userId/performance" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าผลงานพนักงานได้"
              context={{ page: 'team-member-performance' }}
            >
              <ProtectedRouteSimple>
                <TeamMemberPerformance />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Customer Portal — public login + protected pages */}
          <Route path="/customer/login" element={<CustomerLogin />} />
          <Route path="/customer/line-callback" element={<CustomerLineCallback />} />
          {/* Customer Portal entry point. Renders TWO modes from one component:
                - Anonymous: public welcome / featured projects / wishlist (localStorage) / recently-viewed (from property_views)
                - Authenticated: personal dashboard with bookings + saved units
              CustomerDashboard internally branches on auth.getUser(). This unifies the
              "organic visitor lands on chateau.com/customer" UX with the logged-in dashboard.
          */}
          <Route path="/customer" element={<CustomerDashboard />} />
          {/* Public browse — anonymous visitors can view properties/units (Funnel layer 1).
              Gated actions (express interest, contact) trigger a login modal inline. */}
          <Route path="/customer/properties" element={<CustomerProperties />} />
          <Route path="/customer/properties/:id" element={<CustomerPropertyDetail />} />
          <Route path="/customer/units/:id" element={<CustomerUnitDetail />} />
          <Route path="/customer/profile" element={
            <ProtectedRouteSimple><CustomerProfile /></ProtectedRouteSimple>
          } />
          <Route path="/customer/bookings" element={
            <ProtectedRouteSimple><CustomerBookings /></ProtectedRouteSimple>
          } />

          <Route path="/leads/:id" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียด Lead ได้"
              context={{ page: 'lead-detail' }}
            >
              <ProtectedRouteSimple>
                <LeadManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/leads/:leadId/cdp" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้า CDP ได้"
              context={{ page: 'lead-cdp' }}
            >
              <ProtectedRouteSimple>
                <LeadCDP />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/campaigns" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าแคมเปญได้"
              context={{ page: 'campaigns' }}
            >
              <ProtectedRouteSimple>
                <CampaignManagement />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/campaigns/:id" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดรายละเอียดแคมเปญได้"
              context={{ page: 'campaign-detail' }}
            >
              <ProtectedRouteSimple>
                <CampaignDetail />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/builder" element={
            <ErrorBoundary showRetry showHome errorMessage="ไม่สามารถโหลด Builder Wizard ได้" context={{ page: 'campaign-builder' }}>
              <ProtectedRouteSimple>
                <CampaignBuilderWizard />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/triggers" element={
            <ErrorBoundary showRetry showHome errorMessage="ไม่สามารถโหลด Triggers ได้" context={{ page: 'triggers' }}>
              <ProtectedRouteSimple>
                <Triggers />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/marketing-analytics" element={
            <ErrorBoundary showRetry showHome errorMessage="ไม่สามารถโหลด Marketing Analytics ได้" context={{ page: 'marketing-analytics' }}>
              <ProtectedRouteSimple>
                <MarketingAnalytics />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/permissions" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าสิทธิ์ผู้ใช้งานได้"
              context={{ page: 'permissions' }}
            >
              <ProtectedRouteSimple>
                <Permissions />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          <Route path="/customization" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าปรับแต่งระบบได้"
              context={{ page: 'admin-customization' }}
            >
              <ProtectedRouteSimple>
                <AdminCustomization />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* Premium Feature Routes - Subscription-based access (wrapped with DashboardLayout) */}
          <Route element={
            <ProtectedRouteSimple>
              <DashboardLayout />
            </ProtectedRouteSimple>
          }>
            <Route path="/analytics" element={
              <ProtectedRouteSimple requireRole={['owner', 'admin']}>
                <ErrorBoundary
                  showRetry={true}
                  showHome={true}
                  errorMessage="ไม่สามารถโหลดหน้ารายงานวิเคราะห์ได้"
                  context={{ page: 'analytics' }}
                >
                  <Analytics />
                </ErrorBoundary>
              </ProtectedRouteSimple>
            } />

            <Route path="/api" element={
              <ErrorBoundary
                showRetry={true}
                showHome={true}
                errorMessage="ไม่สามารถโหลดหน้าการจัดการ API ได้"
                context={{ page: 'api-management' }}
              >
                <ApiManagement />
              </ErrorBoundary>
            } />
          </Route>

          {/* Settings Route - Available to all authenticated users */}
          <Route path="/settings" element={
            <ErrorBoundary
              showRetry={true}
              showHome={true}
              errorMessage="ไม่สามารถโหลดหน้าตั้งค่าได้"
              context={{ page: 'settings' }}
            >
              <ProtectedRouteSimple>
                <Settings />
              </ProtectedRouteSimple>
            </ErrorBoundary>
          } />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </TenantStatusGuard>
  </ErrorBoundary>
);

export default App;