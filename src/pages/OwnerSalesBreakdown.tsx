import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TenantCombobox from '@/components/owner/TenantCombobox';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD } from '@/components/dashboard/PeriodFilter';
import { supabase } from '@/lib/supabase';
import OwnerMarket from './OwnerMarket';
import OwnerGeography from './OwnerGeography';

// ──────────────────────────────────────────────────────────────────────────
// สัดส่วนยอดขาย — merges the two period-scoped sales-distribution analytics
// pages (ราคา/ประเภท + ทำเล) into one hub with tabs. Each tab embeds its source
// page (OwnerMarket / OwnerGeography) via the `embedded` prop, keeping its own
// company + period filters.
// ──────────────────────────────────────────────────────────────────────────

const KK = { red: '#ef4444', redLight: '#fef2f2' };

const OwnerSalesBreakdown = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const initialTab = searchParams.get('tab') === 'geo' ? 'geo' : 'price';

  // Shared filters — lifted here so the tabs row owns one filter bar (top-right
  // corner) and both tabs stay in sync, instead of each embedded page rendering
  // its own filter row on a separate line.
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    supabase.from('tenants').select('id, name').eq('is_platform' as any, false).then(({ data }) => {
      setTenantList((data || []).map((t: any) => ({ id: t.id, name: t.name || t.id })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
    });
  }, []);

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
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <TabsList>
                  <TabsTrigger value="price">ราคา / ประเภท</TabsTrigger>
                  <TabsTrigger value="geo">ทำเล</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 flex-wrap">
                  <TenantCombobox value={tenantFilter} onChange={setTenantFilter} options={tenantList} className="w-[200px]" />
                  <PeriodFilter value={period} onChange={setPeriod} tier="strategic" />
                </div>
              </div>
              <TabsContent value="price" className="mt-2 focus-visible:outline-none">
                <OwnerMarket embedded period={period} tenantFilter={tenantFilter} />
              </TabsContent>
              <TabsContent value="geo" className="mt-2 focus-visible:outline-none">
                <OwnerGeography embedded period={period} tenantFilter={tenantFilter} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerSalesBreakdown;
