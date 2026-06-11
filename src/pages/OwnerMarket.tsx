import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import { TrendingUp } from 'lucide-react';

// ภาพรวมตลาด — Owner cross-tenant market intelligence (price tiers, property
// type, sales trend). Placeholder shell (Phase 1); real charts land in Phase 3.
// See documents/owner-hq-dashboard-plan.md.
const OwnerMarket = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>Analytics</span>
            <h1 className="text-2xl font-bold text-gray-900">ภาพรวมตลาด</h1>
            <p className="text-[15px] text-gray-500 mt-1.5">วิเคราะห์ราคา · ประเภททรัพย์ · แนวโน้มการขายข้ามทุกบริษัท</p>
            <div className="mt-8 flex items-center gap-3 text-gray-400 bg-white border border-gray-100 rounded-2xl p-8 shadow-soft">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">กำลังพัฒนา — กราฟวิเคราะห์ตลาดจะมาในเฟสถัดไป</span>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerMarket;
