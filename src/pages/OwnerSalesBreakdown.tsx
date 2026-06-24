import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import OwnerMarket from './OwnerMarket';
import OwnerGeography from './OwnerGeography';

// ──────────────────────────────────────────────────────────────────────────
// สัดส่วนยอดขาย — merges the two period-scoped sales-distribution analytics
// pages (ราคา/ประเภท + ทำเล) into one hub with tabs. Each tab embeds its source
// page (OwnerMarket / OwnerGeography) via the `embedded` prop, keeping its own
// company + period filters. Inventory & Absorption stays separate (snapshot).
// ──────────────────────────────────────────────────────────────────────────

const KK = { red: '#ef4444', redLight: '#fef2f2' };

const OwnerSalesBreakdown = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialTab = searchParams.get('tab') === 'geo' ? 'geo' : 'price';

  if (!isOwner) { navigate('/'); return null; }

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                Analytics
              </span>
              <h1 className="text-2xl font-bold text-gray-900">สัดส่วนยอดขาย</h1>
              <p className="text-sm text-gray-500 mt-1.5">ยอดขายแยกตามราคา/ประเภท และทำเล · ข้ามทั้งแพลตฟอร์ม</p>
            </div>

            <Tabs defaultValue={initialTab} className="space-y-7">
              <TabsList>
                <TabsTrigger value="price">ราคา / ประเภท</TabsTrigger>
                <TabsTrigger value="geo">ทำเล</TabsTrigger>
              </TabsList>
              <TabsContent value="price" className="mt-2 focus-visible:outline-none">
                <OwnerMarket embedded />
              </TabsContent>
              <TabsContent value="geo" className="mt-2 focus-visible:outline-none">
                <OwnerGeography embedded />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerSalesBreakdown;
