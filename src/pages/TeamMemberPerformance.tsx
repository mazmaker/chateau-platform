import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Loader2 } from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import SelfPerformanceSection from '@/components/dashboard/SelfPerformanceSection';

// Admin drill-down: view ONE staff member's self-performance scorecard.
// Re-uses SelfPerformanceSection with `showName` so the heading reads
// "ผลงานของ {name}" instead of "ผลงานของคุณ".
//
// Route: /team/:userId/performance
// Access: Owner / Admin only — Sales/Agent are limited to their own /my-dashboard.

interface StaffUser {
  id: string;
  full_name: string | null;
  email: string;
  phone?: string | null;
  role: string;
  tenant_id: string;
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'เจ้าของแพลตฟอร์ม',
  admin: 'ผู้ดูแลบริษัท',
  sales: 'พนักงานขาย',
  agent: 'นายหน้า',
};

export default function TeamMemberPerformance() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { userRole, currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staff, setStaff] = useState<StaffUser | null>(null);
  const [loading, setLoading] = useState(true);

  const allowed = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (!userId || !allowed) return;
    const load = async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('users') as any)
          .select('id, full_name, email, phone, role, tenant_id')
          .eq('id', userId)
          .maybeSingle();
        setStaff(data as StaffUser | null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId, allowed]);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 px-4 text-center">
        หน้านี้สำหรับ Admin / Owner เท่านั้น
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 lg:p-8">
          <div className="max-w-5xl mx-auto space-y-5">
            <Button variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-4 h-4 mr-1" /> กลับ
            </Button>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : !staff ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-sm text-gray-500">
                ไม่พบข้อมูลพนักงาน
              </div>
            ) : (
              <>
                {/* Staff header card */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="w-14 h-14 rounded-full bg-chateau text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
                      {(staff.full_name || staff.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h1 className="text-xl font-bold text-gray-900">
                        {staff.full_name || staff.email}
                      </h1>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {ROLE_LABEL[staff.role] || staff.role}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-600 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Mail className="w-3.5 h-3.5 text-gray-400" /> {staff.email}
                        </span>
                        {staff.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3.5 h-3.5 text-gray-400" /> {staff.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Self performance scorecard — same component the staff member sees on
                    /my-dashboard, just rendered in admin context with their name shown. */}
                {currentTenant?.id && (
                  <SelfPerformanceSection
                    userId={staff.id}
                    tenantId={staff.tenant_id || currentTenant.id}
                    showName
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
