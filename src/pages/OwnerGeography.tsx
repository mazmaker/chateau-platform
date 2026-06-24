import { useState, useEffect, useMemo, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/components/auth/PermissionGuard';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { PageShell } from '@/components/owner/EmbeddablePage';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TenantCombobox from '@/components/owner/TenantCombobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, TrendingUp, ChevronRight, Target } from 'lucide-react';
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
interface ProvinceProperty { id: string; tenant_id: string; name: string; developer: string | null; district: string; sold: number; total: number; soldValue: number; }
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

const OwnerGeography = ({ embedded = false, period: periodProp, tenantFilter: tenantFilterProp }: { embedded?: boolean; period?: PeriodKey; tenantFilter?: string }) => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Raw rows kept in state so the tenant filter can re-aggregate without refetching.
  const [rawProps, setRawProps] = useState<PropRow[]>([]);
  const [rawUnits, setRawUnits] = useState<UnitRow[]>([]);
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [tenantFilterState, setTenantFilterState] = useState<string>('all');
  const [periodState, setPeriodState] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  // Embedded in the สัดส่วนยอดขาย hub, the parent owns the filter bar and passes
  // these down; standalone, fall back to local state.
  const controlled = periodProp !== undefined;
  const period = periodProp ?? periodState;
  const tenantFilter = tenantFilterProp ?? tenantFilterState;
  // Drill-down: province → อำเภอ → โครงการ (read-only). "เรียก data ขึ้นมาดูได้" + เจาะอำเภอ.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deadModal, setDeadModal] = useState(false); // จังหวัดมีโครงการแต่ยังไม่ขาย
  const [regionModal, setRegionModal] = useState<string | null>(null); // เจาะจังหวัดในภาค
  const [provOpen, setProvOpen] = useState<string | null>(null); // จังหวัดที่กางดูโครงการในโมดัล
  useEffect(() => { setExpanded(null); }, [period, tenantFilter]);

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
      dg.projects.push({ id: p.id, tenant_id: p.tenant_id, name: p.name || 'ไม่มีชื่อ', developer: p.developer, district: dist, sold: pr.sold, total: pr.total, soldValue: pr.soldValue });
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
    return { provinces: provinces.length, soldValue, sold, withSales, top: provinces[0] };
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

  // Drill: provinces that have projects/units but ZERO sales in the period (stuck markets).
  const deadProvinces = useMemo(() => provinces.filter((p) => p.sold === 0).sort((a, b) => b.gdv - a.gdv), [provinces]);
  // Drill: provinces inside the clicked region.
  const provincesInRegion = useMemo(
    () => (regionModal ? provinces.filter((p) => regionOf(p.province) === regionModal).sort((a, b) => b.soldValue - a.soldValue) : []),
    [regionModal, provinces],
  );

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg, onClick }: {
    title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string; onClick?: () => void;
  }) => (
    <div onClick={onClick} className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 ${onClick ? 'cursor-pointer select-none' : ''}`}>
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
      <PageShell embedded={embedded} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell embedded={embedded} sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
            {!controlled && (
            <div className={`flex items-start gap-4 flex-wrap ${embedded ? 'justify-end' : 'justify-between'}`}>
              {!embedded && (
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Analytics
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Geography</h1>
                <p className="text-sm text-gray-500 mt-1.5">จังหวัดไหนขายดีที่สุด{periodRangeLabel(period)} · ข้ามทั้งแพลตฟอร์ม</p>
              </div>
              )}
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <TenantCombobox value={tenantFilter} onChange={setTenantFilterState} options={tenantList} className="w-[200px]" />
                <PeriodFilter value={period} onChange={setPeriodState} tier="strategic" />
              </div>
            </div>
            )}

            {provinces.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <MapPin className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลทำเลในระบบ</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <KpiCard title="จังหวัดขายดีสุด" value={totals.top?.province || '–'} sub={`${totals.top?.sold || 0} ยูนิต · ${fmtCompact(totals.top?.soldValue || 0)}`} icon={MapPin} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="ยอดขายรวม" value={fmtCompact(totals.soldValue)} sub={`${totals.sold} ยูนิต · ${totals.withSales} จังหวัด`} icon={TrendingUp} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="จังหวัดที่ขายได้" value={`${totals.withSales}/${totals.provinces}`} sub={totals.provinces - totals.withSales > 0 ? `${totals.provinces - totals.withSales} จังหวัดมีโครงการแต่ยังไม่ขาย · กดดู` : 'ขายได้ครบทุกจังหวัด'} icon={Target} color={KK.green} bg={KK.greenLight} onClick={deadProvinces.length > 0 ? () => setDeadModal(true) : undefined} />
                </div>

                {/* Province bars (รายจังหวัด) + region rollup (สรุปภาค) side-by-side — mirrors ราคา/ประเภท tab.
                    Both cards stretch to equal height (grid default) and fill internally so neither
                    leaves dead space below it: the province chart fills its card height (h=100%) and the
                    region rows spread (justify-between). Region has a fixed 6 ภาค so it used to be taller
                    than a few-province chart, leaving a gap under the chart — filling removes that. */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Province bar (horizontal — handles long Thai names) */}
                  <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                    <h2 className="text-base font-bold text-gray-900">ยอดขายตามจังหวัด</h2>
                    <p className="text-xs text-gray-500 mb-4 mt-0.5">มูลค่าขายในแต่ละจังหวัด · เรียงมาก→น้อย</p>
                    {barData.length === 0 ? (
                      <p className="flex-1 grid place-items-center text-sm text-gray-400 min-h-[220px]">ยังไม่มียอดขายรายจังหวัด</p>
                    ) : (
                      <div className="flex-1 min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                            <XAxis type="number" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)} ล้าน` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : `${v}`)} />
                            <YAxis type="category" dataKey="province" width={108} tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                            <Tooltip
                              contentStyle={kkTooltipStyle}
                              cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                              formatter={((_v: any, _n: any, p: any) => [`${fmtCompact(p?.payload?.soldValue || 0)} · ${p?.payload?.sold || 0} ยูนิต`, 'ขายได้']) as any}
                            />
                            <Bar dataKey="soldValue" radius={[0, 6, 6, 0]} maxBarSize={28} animationDuration={900}>
                              {barData.map((_, i) => <Cell key={i} fill={i === 0 ? KK.red : '#fca5a5'} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  {/* Region rollup (ประเทศ → ภูมิภาค) — compact side panel */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                    <h2 className="text-base font-bold text-gray-900">สรุปตามภูมิภาค</h2>
                    <p className="text-xs text-gray-500 mb-4 mt-0.5">ภาพรวมระดับภาค · <span style={{ color: KK.red }}>กดดูจังหวัดในภาค</span></p>
                    <div className="flex-1 flex flex-col justify-between gap-3">
                      {regionData.map((r, i) => (
                        <button key={r.region} type="button" onClick={() => setRegionModal(r.region)}
                          className="w-full text-left rounded-lg -mx-1.5 px-1.5 py-1 hover:bg-gray-50 transition-colors">
                          <div className="flex justify-between items-baseline gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-700 truncate">{r.region}</span>
                            <span className="text-sm tabular-nums font-semibold text-gray-800 flex-shrink-0">{fmtCompact(r.soldValue)}</span>
                          </div>
                          <div className="h-2 rounded-lg bg-gray-100 overflow-hidden"><div className="h-full rounded-lg" style={{ width: `${Math.max((r.soldValue / regionMax) * 100, 2)}%`, background: i === 0 ? KK.red : '#fca5a5' }} /></div>
                          <p className="text-xs text-gray-400 mt-1">{r.provinces} จังหวัด · {r.sold} ยูนิต</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Province table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-gray-900">รายละเอียดตามจังหวัด</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าขาย · คลิกจังหวัด → อำเภอ → โครงการ · <span style={{ color: KK.red }}>กดโครงการเพื่อดูรายละเอียด</span></p>
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
                                    <TableRow key={p.id} className="bg-gray-50/40 cursor-pointer hover:bg-gray-100"
                                      onClick={() => navigate(`/owner-projects/${p.tenant_id}/${p.id}`)}>
                                      <TableCell className="pl-16">
                                        <span className="text-sm text-gray-600">{p.name}</span>
                                        {p.developer && <span className="text-xs text-gray-400 ml-2">· {p.developer}</span>}
                                      </TableCell>
                                      <TableCell></TableCell>
                                      <TableCell className="text-right tabular-nums text-gray-500">{p.sold}/{p.total}</TableCell>
                                      <TableCell className="text-right tabular-nums text-gray-500">{fmtCompact(p.soldValue)}</TableCell>
                                      <TableCell className="text-right"><ChevronRight className="w-3.5 h-3.5 text-gray-300 inline" /></TableCell>
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

      {/* Drill: provinces with projects but ZERO sales in the period */}
      <Dialog open={deadModal} onOpenChange={(o) => { setDeadModal(o); if (!o) setProvOpen(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>จังหวัดที่มีโครงการแต่ยังไม่ขาย</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-4">มีโครงการในระบบแต่ยอดขาย = 0 ในช่วงนี้ · มูลค่าที่ยังขายไม่ออก (GDV) · กดจังหวัดเพื่อดูโครงการ</p>
          {deadProvinces.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ขายได้ครบทุกจังหวัด</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {deadProvinces.map((p) => {
                const open = provOpen === p.province;
                const projs = (distByProvince[p.province] || []).flatMap((g) => g.projects);
                return (
                  <div key={p.province}>
                    <button onClick={() => setProvOpen(open ? null : p.province)}
                      className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                      <span className="text-sm text-gray-800 flex-1 truncate">{p.province}</span>
                      <span className="text-xs text-gray-400 tabular-nums">{p.projects} โครงการ · {p.total} ยูนิต</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: KK.amber }}>{fmtCompact(p.gdv)}</span>
                    </button>
                    {open && (
                      <div className="ml-6 mb-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
                        {projs.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1 px-2">ไม่มีโครงการ</p>
                        ) : projs.map((pr) => (
                          <button key={pr.id} onClick={() => { setDeadModal(false); navigate(`/owner-projects/${pr.tenant_id}/${pr.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded px-2 py-1.5 hover:bg-gray-50 transition-colors">
                            <span className="text-xs text-gray-700 flex-1 truncate">{pr.name}{pr.developer ? ` · ${pr.developer}` : ''}</span>
                            <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">{pr.total} ยูนิต</span>
                            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drill: provinces inside the clicked region */}
      <Dialog open={!!regionModal} onOpenChange={(o) => { if (!o) { setRegionModal(null); setProvOpen(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>จังหวัดในภาค {regionModal}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-4">เรียงตามมูลค่าขาย · กดจังหวัดเพื่อดูโครงการ</p>
          {provincesInRegion.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ไม่มีจังหวัดในภาคนี้</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {provincesInRegion.map((p) => {
                const open = provOpen === p.province;
                const projs = (distByProvince[p.province] || []).flatMap((g) => g.projects);
                return (
                  <div key={p.province}>
                    <button onClick={() => setProvOpen(open ? null : p.province)}
                      className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                      <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                      <span className="text-sm text-gray-800 flex-1 truncate">{p.province}</span>
                      <span className="text-xs text-gray-400 tabular-nums">{p.sold}/{p.total} ยูนิต</span>
                      <span className="text-xs font-bold tabular-nums" style={{ color: KK.red }}>{fmtCompact(p.soldValue)}</span>
                    </button>
                    {open && (
                      <div className="ml-6 mb-1 space-y-0.5 border-l-2 border-gray-100 pl-2">
                        {projs.length === 0 ? (
                          <p className="text-xs text-gray-400 py-1 px-2">ไม่มีโครงการ</p>
                        ) : projs.map((pr) => (
                          <button key={pr.id} onClick={() => { setRegionModal(null); navigate(`/owner-projects/${pr.tenant_id}/${pr.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded px-2 py-1.5 hover:bg-gray-50 transition-colors">
                            <span className="text-xs text-gray-700 flex-1 truncate">{pr.name}{pr.developer ? ` · ${pr.developer}` : ''}</span>
                            <span className="text-[11px] text-gray-400 tabular-nums flex-shrink-0">{pr.sold}/{pr.total} ยูนิต</span>
                            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};

export default OwnerGeography;
