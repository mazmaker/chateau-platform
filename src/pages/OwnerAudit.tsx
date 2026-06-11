import { useState } from 'react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import { Shield } from 'lucide-react';

// บันทึกการตรวจสอบ — platform-wide audit log viewer over activity_logs.
// Placeholder shell (Phase 1); real table + filters land in Phase 7, alongside
// the enum fix for the campaign_* audit bug. See documents/owner-hq-dashboard-plan.md.
const OwnerAudit = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8">
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: '#ef4444', backgroundColor: '#fef2f2' }}>Settings</span>
            <h1 className="text-2xl font-bold text-gray-900">บันทึกการตรวจสอบ</h1>
            <p className="text-[15px] text-gray-500 mt-1.5">ประวัติการแก้ไขข้อมูลทั้งแพลตฟอร์ม เพื่อความปลอดภัยและความโปร่งใส</p>
            <div className="mt-8 flex items-center gap-3 text-gray-400 bg-white border border-gray-100 rounded-2xl p-8 shadow-soft">
              <Shield className="w-5 h-5" />
              <span className="text-sm">กำลังพัฒนา — ตารางบันทึกการตรวจสอบจะมาในเฟสถัดไป</span>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerAudit;
