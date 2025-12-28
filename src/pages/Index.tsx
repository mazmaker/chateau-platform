import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import GlobalFilters from "@/components/dashboard/GlobalFilters";
import SalesOverview from "@/components/dashboard/SalesOverview";
import ProjectPerformance from "@/components/dashboard/ProjectPerformance";
import CustomerStats from "@/components/dashboard/CustomerStats";
import RevenueOverviewChart from "@/components/dashboard/RevenueOverviewChart";
import GuestStatusChart from "@/components/dashboard/GuestStatusChart";
import BookingsTable from "@/components/dashboard/BookingsTable";
import TopProperties from "@/components/dashboard/TopProperties";
import { DashboardControls, QuickActions, DataProtectionNotice } from "@/components/dashboard/DashboardControls";
import { usePermissions } from "@/components/auth/PermissionGuard";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import { Loader2 } from "lucide-react";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isOwner, isAdmin, isSales } = usePermissions();
  const { currentTenant, userRole, authChecked } = useSimpleAuth();

  // Data is ready when we have a tenant and role
  const isDataReady = authChecked && currentTenant && userRole;

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Dashboard Content - Role-Based Implementation */}
        <main className="p-6">
          <DashboardControls
            title="Chateau Platform Dashboard"
            description="ภาพรวมการจัดการอสังหาริมทรัพย์แบบ Multi-tenant"
          >
            {/* Role-specific welcome banner */}
            <div className={`rounded-xl p-5 mb-6 ${
              !isDataReady ? 'bg-secondary border border-border' :
              isOwner ? 'bg-purple-50 border border-purple-200' :
              isAdmin ? 'bg-blue-50 border border-blue-200' :
              'bg-green-50 border border-green-200'
            }`}>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold">
                  {!isDataReady ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      กำลังโหลดข้อมูล...
                    </span>
                  ) : isOwner ? '👑 Welcome, Owner!' :
                   isAdmin ? '🛡️ Welcome, Administrator!' :
                   '💼 Welcome, Sales Professional!'}
                </h3>
                <div className="ml-auto text-sm">
                  {isDataReady && isOwner && 'คุณมีสิทธิ์ควบคุมระบบทั้งหมด'}
                  {isDataReady && isAdmin && 'คุณมีสิทธิ์จัดการผู้ใช้และข้อมูลทั้งหมด'}
                  {isDataReady && isSales && 'คุณสามารถจัดการข้อมูลและลูกค้าได้'}
                </div>
              </div>
            </div>

            {/* Data Protection Notice */}
            <DataProtectionNotice isDataReady={isDataReady} />

            {/* Quick Actions for different roles */}
            <QuickActions isDataReady={isDataReady} />

            {/* Global Filters - Available for all roles */}
            <GlobalFilters />

            {/* Sales Overview - Available for all roles */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-foreground mb-4">📊 Sales Overview</h2>
              <SalesOverview />
            </div>

            {/* Analytics Sections - All roles get full functionality */}
            <>
              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">🏗️ Project Performance</h2>
                <ProjectPerformance />
              </div>

              <div className="mb-8">
                <h2 className="text-lg font-semibold text-foreground mb-4">👥 Customer Statistics</h2>
                <CustomerStats />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2">
                  <RevenueOverviewChart />
                </div>
                <div className="lg:col-span-1">
                  <GuestStatusChart />
                </div>
              </div>
            </>

            {/* Recent Activities - All roles have access */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-card rounded-xl border border-border shadow-soft p-5">
                <h3 className="text-lg font-medium mb-3">Recent Bookings</h3>
                <BookingsTable />
              </div>
              <div className="bg-card rounded-xl border border-border shadow-soft p-5">
                <h3 className="text-lg font-medium mb-3">Top Properties</h3>
                <TopProperties />
              </div>
            </div>

            {/* Role-specific Information */}
            <div className="mt-8 space-y-4">
              {!isDataReady && (
                <div className="bg-secondary border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">กำลังโหลดข้อมูลสิทธิ์...</span>
                  </div>
                </div>
              )}

              {isDataReady && isSales && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <h4 className="font-medium text-green-800 mb-2">💼 สิทธิ์พนักงานขาย:</h4>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• สร้างและจัดการข้อมูลลูกค้าได้</li>
                    <li>• จัดการโครงการและยูนิตได้</li>
                    <li>• สร้างและจัดการการจองได้</li>
                    <li>• ดูรายงานและ analytics ได้</li>
                  </ul>
                </div>
              )}

              {isDataReady && isAdmin && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <h4 className="font-medium text-blue-800 mb-2">🛡️ สิทธิ์ผู้ดูแลระบบ:</h4>
                  <ul className="text-sm text-blue-700 space-y-1">
                    <li>• จัดการผู้ใช้และสิทธิ์ได้</li>
                    <li>• เข้าถึงข้อมูลและการตั้งค่าทั้งหมด</li>
                    <li>• ดูและจัดการระบบได้ทุกอย่าง</li>
                    <li>• สร้างและจัดการเนื้อหาได้</li>
                  </ul>
                </div>
              )}

              {isDataReady && isOwner && (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
                  <h4 className="font-medium text-purple-800 mb-2">👑 สิทธิ์เจ้าของ:</h4>
                  <ul className="text-sm text-purple-700 space-y-1">
                    <li>• ควบคุมทุกอย่างในระบบได้</li>
                    <li>• จัดการ billing และ subscription ได้</li>
                    <li>• ตั้งค่า security และ policies ได้</li>
                    <li>• สร้างและจัดการ tenant ใหม่ได้</li>
                  </ul>
                </div>
              )}
            </div>
          </DashboardControls>
        </main>
      </div>
    </div>
  );
};

export default Index;