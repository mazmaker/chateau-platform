import { useState } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { Header } from "@/components/dashboard/Header";
import { RevenueOverviewChart } from "@/components/dashboard/RevenueOverviewChart";
import { GuestStatusChart } from "@/components/dashboard/GuestStatusChart";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { TopProperties } from "@/components/dashboard/TopProperties";
import { RevenueByCountry } from "@/components/dashboard/RevenueByCountry";
import { CustomerObjectives } from "@/components/dashboard/CustomerObjectives";

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Dashboard Content - Exact Lovable Layout */}
        <main className="p-6">
          {/* Stats Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Revenue Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-indigo-500 rounded"></div>
                <span className="text-xs text-green-600 font-medium">+12.5%</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-2">Total Revenue</h3>
              <p className="text-2xl font-bold text-gray-900">$4,385,000</p>
            </div>

            {/* Bookings Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-blue-500 rounded"></div>
                <span className="text-xs text-green-600 font-medium">+8.2%</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-2">Total Bookings</h3>
              <p className="text-2xl font-bold text-gray-900">1,234</p>
            </div>

            {/* Cancel Rate Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-yellow-500 rounded"></div>
                <span className="text-xs text-red-600 font-medium">-2.1%</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-2">Cancel Rate</h3>
              <p className="text-2xl font-bold text-gray-900">12.3%</p>
            </div>

            {/* Conversion Rate Card */}
            <div className="bg-white rounded-lg border border-[#e2e8f0] p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="w-8 h-8 bg-green-500 rounded"></div>
                <span className="text-xs text-green-600 font-medium">+15.3%</span>
              </div>
              <h3 className="text-sm text-gray-600 mb-2">Conversion Rate</h3>
              <p className="text-2xl font-bold text-gray-900">24.8%</p>
            </div>
          </div>

          {/* Charts Row - Revenue Overview and Guest Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <RevenueOverviewChart />
            </div>
            <div className="lg:col-span-1">
              <GuestStatusChart />
            </div>
          </div>

          {/* Tables Row - Bookings and Top Properties */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <BookingsTable />
            <TopProperties />
          </div>

          {/* Bottom Row - Revenue by Country and Customer Objectives */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RevenueByCountry />
            <CustomerObjectives />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
