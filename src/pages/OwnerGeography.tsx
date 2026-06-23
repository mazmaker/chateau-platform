import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, TrendingUp, Building, Home, Banknote, ChevronRight } from 'lucide-react';
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

interface PropRow { id: string; tenant_id: string; name: string | null; developer: string | null; address: { province?: string; district?: string } | null; }
interface UnitRow { tenant_id: string; project_id: string; price: number | null; status: string | null; sold_at: string | null; }
interface ProvinceAgg { province: string; sold: number; soldValue: number; total: number; gdv: number; projects: number; }
// Drill-down: province → อำเภอ (district) → โครงการ (property) + unit rollup.
interface ProvinceProperty { id: string; name: string; developer: string | null; district: string; sold: number; total: number; soldValue: number; }
interface DistrictGroup { district: string; sold: number; total: number; soldValue: number; projects: ProvinceProperty[]; }

// Province → region (ภาค) for the macro rollup (เฮีย: เริ่มระดับประเทศ → ภูมิภาค).
const REGION_OF: Record<string, string> = {
  'กรุงเทพมหานคร': 'กรุงเทพฯ & ปริมณฑล', 'นนทบุรี': 'กรุงเทพฯ & ปริมณฑล', 'ปทุมธานี': 'กรุงเทพฯ & ปริมณฑล', 'สมุทรปราการ': 'กรุงเทพฯ & ปริมณฑล', 'สมุทรสาคร': 'กรุงเทพฯ & ปริมณฑล', 'นครปฐม': 'กรุงเทพฯ & ปริมณฑล',
  'เชียงใหม่': 'ภาคเหนือ', 'เชียงราย': 'ภาคเหนือ', 'ลำปาง': 'ภาคเหนือ', 'พิษณุโลก': 'ภาคเหนือ',
  'นครราชสีมา': 'ภาคอีสาน', 'ขอนแก่น': 'ภาคอีสาน', 'อุดรธานี': 'ภาคอีสาน', 'อุบลราชธานี': 'ภาคอีสาน',
  'ชลบุรี': 'ภาคตะวันออก', 'ระยอง': 'ภาคตะวันออก', 'จันทบุรี': 'ภาคตะวันออก',
  'ประจวบคีรีขันธ์': 'ภาคตะวันตก', 'เพชรบุรี': 'ภาคตะวันตก', 'ราชบุรี': 'ภาคตะวันตก', 'กาญจนบุรี': 'ภาคตะวันตก',
  'ภูเก็ต': 'ภาคใต้', 'สงขลา': 'ภาคใต้', 'สุราษฎร์ธานี': 'ภาคใต้', 'กระบี่': 'ภาคใต้', 'นครศรีธรรมราช': 'ภาคใต้',
  'พระนครศรีอยุธยา': 'ภาคกลาง', 'สระบุรี': 'ภาคกลาง',
};
const regionOf = (p: string) => REGION_OF[p] || 'อื่น ๆ';

const OwnerGeography = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Raw rows kept in state so the tenant filter can re-aggregate without refetching.
  const [rawProps, setRawProps] = useState<PropRow[]>([]);
  const [rawUnits, setRawUnits] = useState<UnitRow[]>([]);
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  // Drill-down: province → อำเภอ → โครงการ (read-only). "เรียก data ขึ้นมาดูได้" + เจาะอำเภอ.
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setExpanded(null); }, [period]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const ids = (tenants || []).map((t: any) => t.id);
      setTenantList((tenants || []).map((t: any) => ({ id: t.id, name: t.name || t.id })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      if (ids.length > 0) {
        const [pRes, uRes] = await Promise.all([
          supabase.from('properties').select('id, tenant_id, name, developer, address').in('tenant_id', ids),
          supabase.from('units').select('tenant_id, project_id, price, status, sold_at').in('tenant_id', ids),
        ]);
        setRawProps((pRes.data || []) as PropRow[]);
        setRawUnits((uRes.data || []) as UnitRow[]);
      }
    } catch (e) {
      console.error('OwnerGeography fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Aggregate province summary + province → อำเภอ → โครงการ drill-down.
  // Scopes the raw rows to the selected company first, so KPIs / bars / table /
  // drill-down all reflect the chosen tenant (drill-down runs on the subset).
  const { provinces, distByProvince } = useMemo(() => {
    const { from, to } = periodToRange(period);
    const soldInPeriod = (u: UnitRow) => { if (u.status !== 'sold' || !u.sold_at) return false; const t = new Date(u.sold_at); return (!from || t >= from) && t <= to; };
    const props = tenantFilter === 'all' ? rawProps : rawProps.filter((p) => p.tenant_id === tenantFilter);
    const units = tenantFilter === 'all' ? rawUnits : rawUnits.filter((u) => u.tenant_id === tenantFilter);

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

    // Roll units up to BOTH province (summary) and property (drill-down) level.
    const provAggM = new Map<string, ProvinceAgg>();
    const propAgg = new Map<string, { sold: number; total: number; soldValue: number }>();
    const ensureProv = (prov: string) => {
      let r = provAggM.get(prov);
      if (!r) { r = { province: prov, sold: 0, soldValue: 0, total: 0, gdv: 0, projects: projInProvince.get(prov)?.size || 0 }; provAggM.set(prov, r); }
      return r;
    };
    const ensureProp = (id: string) => {
      let r = propAgg.get(id);
      if (!r) { r = { sold: 0, total: 0, soldValue: 0 }; propAgg.set(id, r); }
      return r;
    };
    units.forEach((u) => {
      const prov = provById.get(u.project_id) || 'ไม่ระบุ';
      const r = ensureProv(prov);
      const pr = ensureProp(u.project_id);
      const price = Number(u.price) || 0;
      r.total += 1; r.gdv += price; pr.total += 1;
      if (soldInPeriod(u)) { r.sold += 1; r.soldValue += price; pr.sold += 1; pr.soldValue += price; }
    });

    // Group properties: province → อำเภอ (district) → โครงการ, with a district rollup.
    const byProv: Record<string, Record<string, DistrictGroup>> = {};
    props.forEach((p) => {
      const prov = p.address?.province || 'ไม่ระบุ';
      const dist = p.address?.district || 'ไม่ระบุอำเภอ';
      const pr = propAgg.get(p.id) || { sold: 0, total: 0, soldValue: 0 };
      const distMap = byProv[prov] = byProv[prov] || {};
      const dg = distMap[dist] = distMap[dist] || { district: dist, sold: 0, total: 0, soldValue: 0, projects: [] };
      dg.sold += pr.sold; dg.total += pr.total; dg.soldValue += pr.soldValue;
      dg.projects.push({ id: p.id, name: p.name || 'ไม่มีชื่อ', developer: p.developer, district: dist, sold: pr.sold, total: pr.total, soldValue: pr.soldValue });
    });
    const distByProv: Record<string, DistrictGroup[]> = {};
    Object.entries(byProv).forEach(([prov, distMap]) => {
      const groups = Object.values(distMap);
      groups.forEach((g) => g.projects.sort((a, b) => b.soldValue - a.soldValue));
      groups.sort((a, b) => b.soldValue - a.soldValue);
      distByProv[prov] = groups;
    });

    return {
      provinces: Array.from(provAggM.values()).sort((a, b) => b.soldValue - a.soldValue),
      distByProvince: distByProv,
    };
  }, [rawProps, rawUnits, tenantFilter, period]);

  const totals = useMemo(() => {
    const soldValue = provinces.reduce((s, r) => s + r.soldValue, 0);
    const sold = provinces.reduce((s, r) => s + r.sold, 0);
    const withSales = provinces.filter((p) => p.sold > 0).length;
    return { provinces: provinces.length, soldValue, sold, withSales, avgPerProvince: withSales > 0 ? soldValue / withSales : 0, top: provinces[0] };
  }, [provinces]);

  // Bars: provinces that actually have sold units, by sold count (descending).
  const barData = useMemo(() => provinces.filter((p) => p.sold > 0).map((p) => ({ province: p.province, sold: p.sold, soldValue: p.soldValue })), [provinces]);

  // Region rollup: aggregate provinces into ภาค (the macro layer above provinces).
  const regionData = useMemo(() => {
    const m = new Map<string, { sold: number; soldValue: number; provinces: number }>();
    provinces.forEach((p) => {
      const r = regionOf(p.province);
      const cur = m.get(r) || { sold: 0, soldValue: 0, provinces: 0 };
      cur.sold += p.sold; cur.soldValue += p.soldValue; cur.provinces += 1;
      m.set(r, cur);
    });
    return Array.from(m.entries()).map(([region, v]) => ({ region, ...v })).sort((a, b) => b.soldValue - a.soldValue);
  }, [provinces]);
  const regionMax = useMemo(() => Math.max(...regionData.map((r) => r.soldValue), 1), [regionData]);

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
      <p className="text-2xl font-bold text-gray-900 leading-none tracking-tight truncate">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
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
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Analytics
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Geography</h1>
                <p className="text-sm text-gray-500 mt-1.5">จังหวัดไหนขายดีที่สุด{periodRangeLabel(period)} · ข้ามทั้งแพลตฟอร์ม</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <Select value={tenantFilter} onValueChange={(v) => { setTenantFilter(v); setExpanded(null); }}>
                  <SelectTrigger className="h-9 w-[200px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกบริษัท</SelectItem>
                    {tenantList.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <PeriodFilter value={period} onChange={setPeriod} tier="strategic" />
              </div>
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

                {/* Region rollup (ประเทศ → ภูมิภาค) — เริ่มจากระดับใหญ่ก่อนเจาะจังหวัด */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <h2 className="text-base font-bold text-gray-900">ยอดขายตามภูมิภาค</h2>
                  <p className="text-xs text-gray-500 mb-4 mt-0.5">ภาพรวมระดับประเทศ → ภาค (ก่อนเจาะรายจังหวัดด้านล่าง)</p>
                  <div className="space-y-3">
                    {regionData.map((r, i) => (
                      <div key={r.region}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-700 font-medium">{r.region} <span className="text-gray-400 font-normal">· {r.provinces} จังหวัด</span></span>
                          <span className="tabular-nums text-gray-500">{r.sold} ยูนิต · <span className="text-gray-700 font-semibold">{fmtCompact(r.soldValue)}</span></span>
                        </div>
                        <div className="h-3 rounded-lg bg-gray-100 overflow-hidden"><div className="h-full rounded-lg" style={{ width: `${Math.max((r.soldValue / regionMax) * 100, 2)}%`, background: i === 0 ? KK.red : '#fca5a5' }} /></div>
                      </div>
                    ))}
                  </div>
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
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าขาย · คลิกจังหวัดเพื่อดูอำเภอและโครงการในจังหวัดนั้น</p>
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
                        {provinces.map((r) => {
                          const isOpen = expanded === r.province;
                          const groups = distByProvince[r.province] || [];
                          return (
                            <Fragment key={r.province}>
                              <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(isOpen ? null : r.province)}>
                                <TableCell className="font-semibold text-gray-900">
                                  <span className="inline-flex items-center gap-1.5">
                                    <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                                    {r.province}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right tabular-nums">{r.projects}</TableCell>
                                <TableCell className="text-right tabular-nums">{r.sold}/{r.total}</TableCell>
                                <TableCell className="text-right tabular-nums">{fmtCompact(r.soldValue)}</TableCell>
                                <TableCell className="text-right tabular-nums text-gray-500">{fmtCompact(r.gdv)}</TableCell>
                              </TableRow>
                              {isOpen && groups.map((g) => (
                                <Fragment key={g.district}>
                                  {/* อำเภอ sub-header — province → district → project */}
                                  <TableRow className="bg-gray-50">
                                    <TableCell className="pl-10">
                                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                                        <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                        {g.district}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-xs text-gray-400">{g.projects.length} โครงการ</TableCell>
                                    <TableCell className="text-right tabular-nums text-gray-600">{g.sold}/{g.total}</TableCell>
                                    <TableCell className="text-right tabular-nums text-gray-600">{fmtCompact(g.soldValue)}</TableCell>
                                    <TableCell></TableCell>
                                  </TableRow>
                                  {g.projects.map((p) => (
                                    <TableRow key={p.id} className="bg-gray-50/40">
                                      <TableCell className="pl-16">
                                        <span className="text-sm text-gray-600">{p.name}</span>
                                        {p.developer && <span className="text-xs text-gray-400 ml-2">· {p.developer}</span>}
                                      </TableCell>
                                      <TableCell></TableCell>
                                      <TableCell className="text-right tabular-nums text-gray-500">{p.sold}/{p.total}</TableCell>
                                      <TableCell className="text-right tabular-nums text-gray-500">{fmtCompact(p.soldValue)}</TableCell>
                                      <TableCell></TableCell>
                                    </TableRow>
                                  ))}
                                </Fragment>
                              ))}
                              {isOpen && groups.length === 0 && (
                                <TableRow className="bg-gray-50/60">
                                  <TableCell colSpan={5} className="pl-10 text-sm text-gray-400">ไม่มีโครงการในจังหวัดนี้</TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })}
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
