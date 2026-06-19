import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { supabase } from '@/lib/supabase';
import {
  TrendingUp,
  Building,
  UserPlus as UserPlusIcon,
  Trophy,
  Layers,
  MapPin,
  BarChart3,
  ChevronRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// ภาพรวมตลาด (Market Overview) — Owner group-overview page (overview-first).
// Summarises the whole real-estate intelligence menu group across ALL tenants,
// then drills into each detail page. Read-only / live Owner RLS (no migration).
//   • KPI strip (GMV · ยูนิตขายได้ · ผู้สนใจใหม่) — responds to PeriodFilter.
//   • GMV รายเดือน (6-month bar) → /owner-market
//   • Top 5 บริษัทขายดี (company-level only) → /owner-companies
//   • สรุปสต๊อก (sell-through + status mix) → /owner-inventory
//   • จังหวัดเด่น (top provinces by sold value) → /owner-geography
// Data computation mirrors OwnerDashboard Zone 2 (computeREForPeriod).
// ──────────────────────────────────────────────────────────────────────────

// Palette + compact-money — identical tokens to OwnerDashboard/OwnerMarket.
const KK = {
  red: '#ef4444', redLight: '#fef2f2', redBorder: '#fecaca',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  purple: '#475569', purpleLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  orange: '#d97706', orangeLight: '#fef3c7',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};

// Compact THB — Thai real-estate convention "X ล้าน" / "K" (NOT M/B). Canonical formatter
// copied from OwnerDashboard / Index.tsx.
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

const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// MoM delta -> KPI trend (↑↓ vs last month); undefined when no baseline (no fake %).
const mkTrend = (d: number | null | undefined) => (d != null ? { value: Math.abs(d), up: d >= 0 } : undefined);

interface UnitRow { tenant_id: string; project_id: string; price: number | null; status: string | null; sold_at: string | null; }
interface LeadRow { tenant_id: string; created_at: string | null; }
interface TenantRow { id: string; name: string }
interface PropRow { id: string; address: { province?: string } | null }

interface CompanyRow { id: string; name: string; sold: number; soldValue: number; }
interface ProvinceRow { province: string; sold: number; soldValue: number; }

const OwnerMarketOverview = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  // Global period filter — strategic tier (trend-level, no single-day) — drives the KPI strip.
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);

  const [units, setUnits] = useState<UnitRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tenantNameById, setTenantNameById] = useState<Map<string, string>>(new Map());
  const [provById, setProvById] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Cross-tenant read — Owner RLS permits it. Exclude our own platform tenant.
      const { data: tenants } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const tList = (tenants || []) as TenantRow[];
      const ids = tList.map((t) => t.id);
      setTenantNameById(new Map(tList.map((t) => [t.id, t.name])));
      if (ids.length > 0) {
        const [uRes, lRes, pRes] = await Promise.all([
          supabase.from('units').select('tenant_id, project_id, price, status, sold_at').in('tenant_id', ids),
          supabase.from('leads').select('tenant_id, created_at').in('tenant_id', ids),
          supabase.from('properties').select('id, address').in('tenant_id', ids),
        ]);
        setUnits((uRes.data || []) as UnitRow[]);
        setLeads((lRes.data || []) as LeadRow[]);
        const pm = new Map<string, string>();
        ((pRes.data || []) as PropRow[]).forEach((p) => { pm.set(p.id, p.address?.province || 'ไม่ระบุ'); });
        setProvById(pm);
      }
    } catch (e) {
      console.error('OwnerMarketOverview fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Period-driven RE stats (same logic as OwnerDashboard.computeREForPeriod).
  const reStats = useMemo(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => {
      if (!ts) return false;
      const d = new Date(ts);
      return (!from || d >= from) && d <= to;
    };
    const soldInPeriod = units.filter((u) => u.status === 'sold' && inRange(u.sold_at));
    const gmv = soldInPeriod.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const newLeads = leads.filter((l) => inRange(l.created_at)).length;
    return { gmv, units: soldInPeriod.length, newLeads };
  }, [units, leads, period]);

  // MoM delta for GMV — current month vs previous calendar month (real, from sold_at).
  const momGmvPct = useMemo(() => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const lastMonthStart = new Date(monthStart); lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    let cur = 0, prev = 0;
    units.forEach((u) => {
      if (u.status !== 'sold' || !u.sold_at) return;
      const d = new Date(u.sold_at);
      const price = Number(u.price) || 0;
      if (d >= monthStart) cur += price;
      else if (d >= lastMonthStart) prev += price;
    });
    return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  }, [units]);

  // GMV monthly trend — sold units grouped by sold_at month (last 6 months).
  const gmvTrend = useMemo(() => {
    const byKey = new Map<string, { gmv: number; units: number }>();
    units.forEach((u) => {
      if (u.status === 'sold' && u.sold_at) {
        const d = new Date(u.sold_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const slot = byKey.get(key) || { gmv: 0, units: 0 };
        slot.gmv += Number(u.price) || 0;
        slot.units += 1;
        byKey.set(key, slot);
      }
    });
    const out: { month: string; gmv: number; units: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      out.push({ month: THAI_MONTH[d.getMonth()], ...(byKey.get(key) || { gmv: 0, units: 0 }) });
    }
    return out;
  }, [units]);

  // Top 5 companies by sold value (company-level only — no sales reps).
  const topCompanies = useMemo<CompanyRow[]>(() => {
    const agg = new Map<string, { sold: number; soldValue: number }>();
    units.forEach((u) => {
      if (u.status !== 'sold') return;
      const r = agg.get(u.tenant_id) || { sold: 0, soldValue: 0 };
      r.sold += 1; r.soldValue += Number(u.price) || 0;
      agg.set(u.tenant_id, r);
    });
    return Array.from(agg.entries())
      .map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', sold: v.sold, soldValue: v.soldValue }))
      .filter((r) => r.soldValue > 0)
      .sort((a, b) => b.soldValue - a.soldValue)
      .slice(0, 5);
  }, [units, tenantNameById]);

  // Inventory mini-summary — cumulative sell-through + status mix (all units, not period-scoped).
  const inventory = useMemo(() => {
    const total = units.length;
    const sold = units.filter((u) => u.status === 'sold').length;
    const reserved = units.filter((u) => u.status === 'reserved').length;
    const available = units.filter((u) => u.status === 'available').length;
    return { total, sold, reserved, available, sellThrough: total ? Math.round((sold / total) * 100) : 0 };
  }, [units]);

  // Top provinces by sold value (from properties.address->>'province').
  const topProvinces = useMemo<ProvinceRow[]>(() => {
    const agg = new Map<string, { sold: number; soldValue: number }>();
    units.forEach((u) => {
      if (u.status !== 'sold') return;
      const prov = provById.get(u.project_id) || 'ไม่ระบุ';
      const r = agg.get(prov) || { sold: 0, soldValue: 0 };
      r.sold += 1; r.soldValue += Number(u.price) || 0;
      agg.set(prov, r);
    });
    return Array.from(agg.entries())
      .map(([province, v]) => ({ province, sold: v.sold, soldValue: v.soldValue }))
      .filter((r) => r.soldValue > 0)
      .sort((a, b) => b.soldValue - a.soldValue)
      .slice(0, 5);
  }, [units, provById]);

  // Compact KPI card — same shape as OwnerDashboard.renderKpiCard.
  const renderKpiCard = (k: any, i: number) => (
    <div key={i} onClick={() => navigate(k.href)} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5 pr-1 flex-1">{k.label}</p>
        <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} strokeWidth={2} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">{k.value}</p>
      {k.trend ? (
        <>
          <p className="text-sm mt-3.5 font-semibold" style={{ color: k.trend.up ? KK.green : KK.red }}>
            {k.trend.up ? '↗' : '↘'} {k.trend.value}%<span className="font-normal text-gray-400"> MoM</span>
          </p>
          {k.sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{k.sub}</p>}
        </>
      ) : k.sub ? (
        <p className="text-sm text-gray-400 mt-3.5 leading-snug line-clamp-2">{k.sub}</p>
      ) : null}
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
          <main className="p-6 lg:p-8 space-y-6">
            {/* PAGE TITLE + PERIOD FILTER */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-2 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Analytics</span>
                <h1 className="text-2xl font-bold text-gray-900">ภาพรวมตลาด</h1>
                <p className="text-sm text-gray-500 mt-1.5">ภาพรวมยอดขาย สต๊อก และผู้สนใจ ข้ามทุกบริษัท — กดการ์ดเพื่อดูรายละเอียด</p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="strategic" className="self-start sm:self-auto shrink-0" />
            </div>

            {/* KPI strip — 3 cards (GMV · ยูนิตขายได้ · ผู้สนใจใหม่) — respond to period filter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: `GMV อสังหาฯ (${periodRangeLabel(period)})`, value: fmtCompact(reStats.gmv), trend: mkTrend(momGmvPct), icon: TrendingUp, color: KK.red, href: '/owner-market' },
                { label: `ยูนิตขายได้ (${periodRangeLabel(period)})`, value: reStats.units.toLocaleString(), icon: Building, color: KK.blue, href: '/owner-inventory', sub: `จาก ${inventory.total.toLocaleString()} ยูนิตทั้งหมด` },
                { label: `ผู้สนใจใหม่ (${periodRangeLabel(period)})`, value: reStats.newLeads.toLocaleString(), icon: UserPlusIcon, color: KK.green, href: '/owner-funnel', sub: `สะสม ${leads.length.toLocaleString()} ราย` },
              ].map(renderKpiCard)}
            </div>

            {/* GMV monthly bar chart (6 months) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">GMV รายเดือน</h2>
                    <p className="text-xs text-gray-500 mt-0.5">ยอดขายรวมทั้งแพลตฟอร์ม · ย้อนหลัง 6 เดือน</p>
                  </div>
                </div>
                <button onClick={() => navigate('/owner-market')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                  ดูยอดขาย <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {gmvTrend.some((d) => d.gmv > 0) ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={gmvTrend} margin={{ top: 8, right: 8, left: 0, bottom: -8 }} barCategoryGap="18%">
                    <defs>
                      <linearGradient id="overviewGmvGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.red} stopOpacity={1} />
                        <stop offset="100%" stopColor={KK.red} stopOpacity={0.65} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#d1d5db' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} width={58} />
                    <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: KK.redLight }} formatter={((v: any) => [fmtCompact(Number(v ?? 0)), 'GMV']) as any} />
                    <Bar dataKey="gmv" fill="url(#overviewGmvGrad)" radius={[8, 8, 0, 0]} maxBarSize={80} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">ยังไม่มีข้อมูลยอดขาย</p>
              )}
            </div>

            {/* Top 5 companies (left) + Inventory mini-summary (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top 5 companies — company-level only */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: KK.amber }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">อันดับบริษัทขายดี</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Top 5 · มูลค่าขายสะสม</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-companies')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {topCompanies.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลยอดขาย</p>
                ) : (() => {
                  const maxVal = Math.max(...topCompanies.map((c) => c.soldValue), 1);
                  return (
                    <div className="space-y-3.5">
                      {topCompanies.map((c, i) => (
                        <div key={c.id} className="flex items-center gap-3">
                          <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-800 truncate">{c.name}</span>
                              <div className="text-right flex-shrink-0">
                                <span className="text-sm font-bold tabular-nums block" style={{ color: KK.red }}>{fmtCompact(c.soldValue)}</span>
                                <span className="text-xs text-gray-400">{c.sold} ยูนิต</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(c.soldValue / maxVal) * 100}%`, backgroundColor: KK.red }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Inventory mini-summary */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">สรุปสต๊อก</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Sell-through และสถานะยูนิต · ทุกบริษัท</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-inventory')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดูสต๊อก <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {inventory.total === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลยูนิต</p>
                ) : (
                  <>
                    {/* Sell-through hero */}
                    <div className="flex items-end justify-between mb-1">
                      <span className="text-sm text-gray-500">Sell-through รวม</span>
                      <span className="text-2xl font-bold tabular-nums" style={{ color: KK.green }}>{inventory.sellThrough}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-5">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(inventory.sellThrough, 2)}%`, background: `linear-gradient(90deg, ${KK.green} 0%, #4ade80 100%)` }} />
                    </div>
                    {/* Status mix */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'ว่าง', value: inventory.available, color: KK.blue },
                        { label: 'จองแล้ว', value: inventory.reserved, color: KK.amber },
                        { label: 'ขายแล้ว', value: inventory.sold, color: KK.green },
                      ].map((s) => (
                        <div key={s.label} className="rounded-xl bg-gray-50 p-3 text-center">
                          <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: s.color }}>{s.value.toLocaleString()}</p>
                          <p className="text-xs text-gray-500 mt-1.5">{s.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-400 mt-4">จาก {inventory.total.toLocaleString()} ยูนิตทั้งหมด</p>
                  </>
                )}
              </div>
            </div>

            {/* Top provinces */}
            {topProvinces.length > 0 && (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: KK.green }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">จังหวัดเด่น</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Top 5 · เรียงตามมูลค่าขายสะสม</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-geography')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดูภูมิศาสตร์ <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {(() => {
                  const maxVal = Math.max(...topProvinces.map((p) => p.soldValue), 1);
                  return (
                    <div className="space-y-3.5">
                      {topProvinces.map((p, i) => (
                        <div key={p.province} className="flex items-center gap-3">
                          <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-800 truncate">{p.province}</span>
                              <div className="text-right flex-shrink-0">
                                <span className="text-sm font-bold tabular-nums block" style={{ color: KK.red }}>{fmtCompact(p.soldValue)}</span>
                                <span className="text-xs text-gray-400">{p.sold} ยูนิต</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${(p.soldValue / maxVal) * 100}%`, backgroundColor: i === 0 ? KK.red : '#fca5a5' }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerMarketOverview;
