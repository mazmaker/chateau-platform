import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { MapPin, TrendingUp, Building, Home, Banknote } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// ทำเลและจังหวัด — Owner cross-tenant geographic breakdown (HQ lens).
// Which province sells best across the whole platform.
// Data: sold units joined to properties.address->>'province'. Read-only / Owner RLS.
// (Phase 5 = province bars + table; a Thailand heat-map is a future upgrade.)
// See documents/owner-hq-dashboard-plan.md.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  slate: '#475569', slateLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 1000) return `${sign}฿${Math.round(m).toLocaleString('en-US')} ล้าน`;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${abs.toFixed(0)}`;
};

interface PropRow { id: string; address: { province?: string } | null; }
interface UnitRow { project_id: string; price: number | null; status: string | null; }
interface ProvinceAgg { province: string; sold: number; soldValue: number; total: number; gdv: number; projects: number; }

const OwnerGeography = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [provinces, setProvinces] = useState<ProvinceAgg[]>([]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id').eq('is_platform' as any, false);
      const ids = (tenants || []).map((t: any) => t.id);
      if (ids.length > 0) {
        const [pRes, uRes] = await Promise.all([
          supabase.from('properties').select('id, address').in('tenant_id', ids),
          supabase.from('units').select('project_id, price, status').in('tenant_id', ids),
        ]);
        const props = (pRes.data || []) as PropRow[];
        const units = (uRes.data || []) as UnitRow[];

        // property id → province
        const provById = new Map<string, string>();
        const projInProvince = new Map<string, Set<string>>();
        props.forEach((p) => {
          const prov = p.address?.province || 'ไม่ระบุ';
          provById.set(p.id, prov);
          const set = projInProvince.get(prov) || new Set<string>();
          set.add(p.id);
          projInProvince.set(prov, set);
        });

        const m = new Map<string, ProvinceAgg>();
        const ensure = (prov: string) => {
          let r = m.get(prov);
          if (!r) { r = { province: prov, sold: 0, soldValue: 0, total: 0, gdv: 0, projects: projInProvince.get(prov)?.size || 0 }; m.set(prov, r); }
          return r;
        };
        units.forEach((u) => {
          const prov = provById.get(u.project_id) || 'ไม่ระบุ';
          const r = ensure(prov);
          const price = Number(u.price) || 0;
          r.total += 1; r.gdv += price;
          if (u.status === 'sold') { r.sold += 1; r.soldValue += price; }
        });

        setProvinces(Array.from(m.values()).sort((a, b) => b.soldValue - a.soldValue));
      }
    } catch (e) {
      console.error('OwnerGeography fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const soldValue = provinces.reduce((s, r) => s + r.soldValue, 0);
    const sold = provinces.reduce((s, r) => s + r.sold, 0);
    const withSales = provinces.filter((p) => p.sold > 0).length;
    return { provinces: provinces.length, soldValue, sold, withSales, avgPerProvince: withSales > 0 ? soldValue / withSales : 0, top: provinces[0] };
  }, [provinces]);

  // Bars: provinces that actually have sold units, by sold count (descending).
  const barData = useMemo(() => provinces.filter((p) => p.sold > 0).map((p) => ({ province: p.province, sold: p.sold, soldValue: p.soldValue })), [provinces]);

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg }: {
    title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string;
  }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-[24px] font-bold text-gray-900 leading-none tracking-tight truncate">{value}</p>
      {sub && <p className="text-[13px] text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  if (loading) {
    return (
      <OwnerGuard>
        <div className="min-h-screen bg-gray-50">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="lg:ml-[260px] min-h-screen">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          </div>
        </div>
      </OwnerGuard>
    );
  }

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
              <h1 className="text-2xl font-bold text-gray-900">Geography</h1>
              <p className="text-[15px] text-gray-500 mt-1.5">จังหวัดไหนขายดีที่สุดข้ามทั้งแพลตฟอร์ม</p>
            </div>

            {provinces.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลทำเลในระบบ</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="จังหวัดขายดีสุด" value={totals.top?.province || '–'} sub={`${totals.top?.sold || 0} ยูนิต · ${fmtCompact(totals.top?.soldValue || 0)}`} icon={MapPin} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="จังหวัดที่มีโครงการ" value={totals.provinces.toLocaleString()} sub="ทั่วประเทศ" icon={Building} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="จังหวัดที่มียอดขาย" value={totals.withSales.toLocaleString()} sub={`จาก ${totals.provinces} จังหวัด`} icon={TrendingUp} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="มูลค่าขายเฉลี่ย/จังหวัด" value={fmtCompact(totals.avgPerProvince)} sub="เฉลี่ยต่อจังหวัดที่ขายได้" icon={Banknote} color={KK.amber} bg={KK.amberLight} />
                </div>

                {/* Province bar (horizontal — handles long Thai names) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <h2 className="text-base font-bold text-gray-900">ยอดขายตามจังหวัด</h2>
                  <p className="text-xs text-gray-500 mb-4 mt-0.5">จำนวนยูนิตที่ขายได้ในแต่ละจังหวัด</p>
                  {barData.length === 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">ยังไม่มียอดขายรายจังหวัด</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(220, barData.length * 46)}>
                      <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="province" width={108} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                        <Tooltip
                          contentStyle={kkTooltipStyle}
                          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                          formatter={((v: any, _n: any, p: any) => [`${v} ยูนิต · ${fmtCompact(p?.payload?.soldValue || 0)}`, 'ขายได้']) as any}
                        />
                        <Bar dataKey="sold" radius={[0, 6, 6, 0]} maxBarSize={28} animationDuration={900}>
                          {barData.map((_, i) => <Cell key={i} fill={i === 0 ? KK.red : '#fca5a5'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Province table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-gray-900">รายละเอียดตามจังหวัด</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าขาย</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>จังหวัด</TableHead>
                          <TableHead className="text-right">โครงการ</TableHead>
                          <TableHead className="text-right">ยูนิต (ขาย/ทั้งหมด)</TableHead>
                          <TableHead className="text-right">มูลค่าขาย</TableHead>
                          <TableHead className="text-right">GDV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {provinces.map((r) => (
                          <TableRow key={r.province}>
                            <TableCell className="font-semibold text-gray-900">{r.province}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.projects}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.sold}/{r.total}</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtCompact(r.soldValue)}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{fmtCompact(r.gdv)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerGeography;
