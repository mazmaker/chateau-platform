import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { ProjectHeader } from "@/components/dashboard/ProjectHeader";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { UnitDonutChart } from "@/components/dashboard/UnitDonutChart";
import { SalesPercentDonut } from "@/components/dashboard/SalesPercentDonut";
import { ProjectSalesBar } from "@/components/dashboard/ProjectSalesBar";
import { StatusReport } from "@/components/dashboard/StatusReport";
import { CustomerLeadChart } from "@/components/dashboard/CustomerLeadChart";
import { BookingCancelChart } from "@/components/dashboard/BookingCancelChart";
import { SalesDataTable } from "@/components/dashboard/SalesDataTable";
import { CustomerObjectives } from "@/components/dashboard/CustomerObjectives";
import { MonthTabs } from "@/components/dashboard/MonthTabs";
import { ObjectivePieChart } from "@/components/dashboard/ObjectivePieChart";
import { OnlineLeadsChart } from "@/components/dashboard/OnlineLeadsChart";
import { OfflineLeadsChart } from "@/components/dashboard/OfflineLeadsChart";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeMonth, setActiveMonth] = useState("ทั้งหมด");

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen flex flex-col">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {/* Project Header */}
          <ProjectHeader />

          {/* Stats Cards */}
          <StatsCards />

          {/* Sales Report Section */}
          <h2 className="text-lg font-semibold text-foreground mb-4">รายงานการขาย</h2>
          
          {/* Sales Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div className="animate-fade-in">
              <UnitDonutChart />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
              <SalesPercentDonut />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
            <div className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '200ms' }}>
              <ProjectSalesBar />
            </div>
            <div className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '300ms' }}>
              <StatusReport />
            </div>
            <div className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '400ms' }}>
              <CustomerLeadChart />
            </div>
            <div className="lg:col-span-1 animate-fade-in" style={{ animationDelay: '500ms' }}>
              <BookingCancelChart />
            </div>
          </div>

          {/* Sales Data Table */}
          <SalesDataTable />

          {/* Customer Objectives */}
          <CustomerObjectives />

          {/* Month Tabs */}
          <MonthTabs activeMonth={activeMonth} onMonthChange={setActiveMonth} />

          {/* Bottom Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="animate-fade-in" style={{ animationDelay: '600ms' }}>
              <ObjectivePieChart title="รายงานวัตถุประสงค์การซื้อของลูกค้าแต่ละเดือน" />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '700ms' }}>
              <OnlineLeadsChart 
                title="รายงานลีดออนไลน์ที่ทำให้ลูกค้ารับรู้แต่ละเดือน" 
                color="hsl(180, 70%, 50%)"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '800ms' }}>
              <OfflineLeadsChart 
                title="รายงานลีดออฟไลน์ที่ทำให้ลูกค้ารับรู้แต่ละเดือน" 
                color="hsl(340, 82%, 65%)"
              />
            </div>
            <div className="animate-fade-in" style={{ animationDelay: '900ms' }}>
              <ObjectivePieChart title="รายงานแหล่งที่มาแต่ละเดือน" />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
