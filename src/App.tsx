import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import UserManagement from "./pages/UserManagement";
import Projects from "./pages/Projects";
import { SimpleLogin } from "./pages/SimpleLogin";
import NotFound from "./pages/NotFound";
import OwnerDashboard from "./pages/OwnerDashboard";
import TenantManagement from "./pages/TenantManagement";
import BillingManagement from "./pages/BillingManagement";
import PropertyManagement from "./pages/PropertyManagement";
import LeadManagement from "./pages/LeadManagement";
import AdminCustomization from "./pages/AdminCustomization";
import Settings from "./pages/Settings";
import { ProtectedRouteSimple } from "@/components/auth/ProtectedRouteSimple";
import ErrorBoundary from "@/components/ErrorBoundary";

const App = () => (
  <ErrorBoundary
    showRetry={true}
    showHome={true}
    resetOnLocationChange={true}
    context={{ application: 'chateau-platform', layer: 'app-root' }}
  >
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

        <Route path="/projects" element={
          <ErrorBoundary
            showRetry={true}
            showHome={true}
            errorMessage="ไม่สามารถโหลดหน้าโครงการได้"
            context={{ page: 'projects' }}
          >
            <ProtectedRouteSimple>
              <Projects />
            </ProtectedRouteSimple>
          </ErrorBoundary>
        } />

        {/* Owner-only Routes */}
        <Route path="/owner" element={
          <ErrorBoundary
            showRetry={true}
            showHome={true}
            errorMessage="ไม่สามารถโหลดหน้า Owner Dashboard ได้"
            context={{ page: 'owner-dashboard' }}
          >
            <ProtectedRouteSimple requireRole="owner">
              <OwnerDashboard />
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

        <Route path="/billing" element={
          <ErrorBoundary
            showRetry={true}
            showHome={true}
            errorMessage="ไม่สามารถโหลดหน้าจัดการ Billing ได้"
            context={{ page: 'billing-management' }}
          >
            <ProtectedRouteSimple requireRole="owner">
              <BillingManagement />
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
  </ErrorBoundary>
);

export default App;