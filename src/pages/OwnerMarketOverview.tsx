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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',     color: '#16a34a', bg: '#f0fdf4' },
  trial:     { label: 'Trial',      color: '#d97706', bg: '#fefce8' },
  suspended: { label: 'ระงับ',     color: '#ef4444', bg: '#fef2f2' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc' },
};
const getBadge = (s: string) => STATUS_BADGE[s] ?? STATUS_BADGE['active'];

interface UnitRow { tenant_id: string; project_id: string; price: number | null; status: string | null; sold_at: string | null; created_at: string | null; unit_type: string | null; area_sqm: number | null; }

// unit_type enum → Thai (free-text layouts like "1 Bedroom" pass through unchanged).
const TYPE_TH: Record<string, string> = { condo: 'คอนโด', single_house: 'บ้านเดี่ยว', twin_house: 'บ้านแฝด', townhome: 'ทาวน์โฮม', house: 'บ้าน' };
interface LeadRow { tenant_id: string; created_at: string | null; status: string | null; }
interface TenantRow { id: string; name: string; status: string; subscription_plan?: string | null }
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
  const [tenantStatusById, setTenantStatusById] = useState<Map<string, string>>(new Map());
  const [provById, setProvById] = useState<Map<string, string>>(new Map());
  const [salesStaffByTenant, setSalesStaffByTenant] = useState<Record<string, number>>({});
  const [tenantPlanById, setTenantPlanById] = useState<Map<string, string>>(new Map());
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);
  const [expandedProvince, setExpandedProvince] = useState<string | null>(null);
  const [adoptionModalOpen, setAdoptionModalOpen] = useState(false);
  const [adoptionSearch, setAdoptionSearch] = useState('');
  const [depthModalOpen, setDepthModalOpen] = useState(false);
  const [depthSearch, setDepthSearch] = useState('');
  // Customer-segment filter — scope the whole page to a plan / lifecycle status.
  const [segment, setSegment] = useState<'all' | 'active' | 'trial' | 'enterprise' | 'professional' | 'starter'>('all');

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Cross-tenant read — Owner RLS permits it. Exclude our own platform tenant.
      const { data: tenants } = await supabase.from('tenants').select('id, name, status, subscription_plan').eq('is_platform' as any, false);
      const tList = (tenants || []) as TenantRow[];
      const ids = tList.map((t) => t.id);
      setTenantNameById(new Map(tList.map((t) => [t.id, t.name])));
      setTenantStatusById(new Map(tList.map((t) => [t.id, t.status || 'active'])));
      setTenantPlanById(new Map(tList.map((t) => [t.id, t.subscription_plan || ''])));
      if (ids.length > 0) {
        const [uRes, lRes, pRes, sRes] = await Promise.all([
          supabase.from('units').select('tenant_id, project_id, price, status, sold_at, created_at, unit_type, area_sqm').in('tenant_id', ids),
          supabase.from('leads').select('tenant_id, created_at, status').in('tenant_id', ids),
          supabase.from('properties').select('id, address').in('tenant_id', ids),
          supabase.from('users').select('tenant_id, role').in('tenant_id', ids).in('role', ['sales', 'agent']),
        ]);
        setUnits((uRes.data || []) as UnitRow[]);
        setLeads((lRes.data || []) as LeadRow[]);
        const pm = new Map<string, string>();
        ((pRes.data || []) as PropRow[]).forEach((p) => { pm.set(p.id, p.address?.province || 'ไม่ระบุ'); });
        setProvById(pm);
        const staff: Record<string, number> = {};
        ((sRes.data || []) as { tenant_id: string }[]).forEach((u) => { staff[u.tenant_id] = (staff[u.tenant_id] || 0) + 1; });
        setSalesStaffByTenant(staff);
      }
    } catch (e) {
      console.error('OwnerMarketOverview fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Customer-segment scope — which tenants the whole page is filtered to.
  const allowedTenantIds = useMemo(() => {
    if (segment === 'all') return null; // null = no filter (all tenants)
    const set = new Set<string>();
    tenantNameById.forEach((_, id) => {
      const matches = segment === 'active' || segment === 'trial'
        ? (tenantStatusById.get(id) || 'active') === segment
        : tenantPlanById.get(id) === segment;
      if (matches) set.add(id);
    });
    return set;
  }, [segment, tenantNameById, tenantStatusById, tenantPlanById]);
  const inScope = (tenantId: string) => !allowedTenantIds || allowedTenantIds.has(tenantId);
  const scopedUnits = useMemo(() => (allowedTenantIds ? units.filter((u) => allowedTenantIds.has(u.tenant_id)) : units), [units, allowedTenantIds]);
  const scopedLeads = useMemo(() => (allowedTenantIds ? leads.filter((l) => allowedTenantIds.has(l.tenant_id)) : leads), [leads, allowedTenantIds]);

  // Period-driven RE stats (same logic as OwnerDashboard.computeREForPeriod).
  const reStats = useMemo(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => {
      if (!ts) return false;
      const d = new Date(ts);
      return (!from || d >= from) && d <= to;
    };
    const soldInPeriod = scopedUnits.filter((u) => u.status === 'sold' && inRange(u.sold_at));
    const gmv = soldInPeriod.reduce((s, u) => s + (Number(u.price) || 0), 0);
    const newLeads = scopedLeads.filter((l) => inRange(l.created_at)).length;
    // Owner adoption signal: how many paying customers actually transacted on the platform.
    const transacting = new Set(soldInPeriod.map((u) => u.tenant_id)).size;
    let activeTenants = 0; tenantStatusById.forEach((s, id) => { if (s === 'active' && inScope(id)) activeTenants += 1; });
    return { gmv, units: soldInPeriod.length, newLeads, transacting, activeTenants };
  }, [scopedUnits, scopedLeads, period, tenantStatusById, allowedTenantIds]);

  // GMV delta — selected period vs the immediately-preceding equal-length window
  // (so the % always matches the period shown on the KPI, not a fixed calendar month).
  // "ทั้งหมด" has no prior window → no trend.
  const gmvDeltaPct = useMemo(() => {
    const { from, to } = periodToRange(period);
    if (!from) return null;
    const span = to.getTime() - from.getTime();
    const prevTo = new Date(from.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - span);
    let cur = 0, prev = 0;
    scopedUnits.forEach((u) => {
      if (u.status !== 'sold' || !u.sold_at) return;
      const d = new Date(u.sold_at);
      const price = Number(u.price) || 0;
      if (d >= from && d <= to) cur += price;
      else if (d >= prevFrom && d <= prevTo) prev += price;
    });
    return prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null;
  }, [scopedUnits, period]);

  // GMV monthly trend — sold units grouped by sold_at month (last 6 months).
  const gmvTrend = useMemo(() => {
    const byKey = new Map<string, { gmv: number; units: number }>();
    scopedUnits.forEach((u) => {
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
  }, [scopedUnits]);

  // Top 5 companies by sold value in the selected period (company-level only — no sales reps).
  const topCompanies = useMemo<CompanyRow[]>(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => { if (!ts) return false; const d = new Date(ts); return (!from || d >= from) && d <= to; };
    const agg = new Map<string, { sold: number; soldValue: number }>();
    scopedUnits.forEach((u) => {
      if (u.status !== 'sold' || !inRange(u.sold_at)) return;
      const r = agg.get(u.tenant_id) || { sold: 0, soldValue: 0 };
      r.sold += 1; r.soldValue += Number(u.price) || 0;
      agg.set(u.tenant_id, r);
    });
    return Array.from(agg.entries())
      .map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', sold: v.sold, soldValue: v.soldValue }))
      .filter((r) => r.soldValue > 0)
      .sort((a, b) => b.soldValue - a.soldValue)
      .slice(0, 5);
  }, [scopedUnits, tenantNameById, period]);

  // Per-company "ปัจจัยการขาย" — descriptive profile (ทำเล/ราคา/ประเภท/ทีมขาย/sell-through)
  // shown when a leaderboard row is expanded. Profile only — NOT a causal explanation.
  const factorsByTenant = useMemo(() => {
    const byT = new Map<string, UnitRow[]>();
    units.forEach((u) => { const a = byT.get(u.tenant_id) || []; a.push(u); byT.set(u.tenant_id, a); });
    const out = new Map<string, {
      provinces: string[]; minP: number; maxP: number; avgArea: number;
      topType: string; sellThrough: number; sold: number; total: number; staff: number;
    }>();
    byT.forEach((us, tid) => {
      const provinces = Array.from(new Set(us.map((u) => provById.get(u.project_id)).filter((p): p is string => !!p && p !== 'ไม่ระบุ')));
      const priced = us.map((u) => Number(u.price) || 0).filter((n) => n > 0);
      const areas = us.map((u) => Number(u.area_sqm) || 0).filter((n) => n > 0);
      const typeCount = new Map<string, number>();
      us.forEach((u) => { const t = u.unit_type || '–'; typeCount.set(t, (typeCount.get(t) || 0) + 1); });
      const topTypeRaw = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '–';
      const sold = us.filter((u) => u.status === 'sold').length;
      out.set(tid, {
        provinces,
        minP: priced.length ? Math.min(...priced) : 0,
        maxP: priced.length ? Math.max(...priced) : 0,
        avgArea: areas.length ? Math.round(areas.reduce((s, n) => s + n, 0) / areas.length) : 0,
        topType: TYPE_TH[topTypeRaw] || topTypeRaw,
        sellThrough: us.length ? Math.round((sold / us.length) * 100) : 0,
        sold, total: us.length,
        staff: salesStaffByTenant[tid] || 0,
      });
    });
    return out;
  }, [units, provById, salesStaffByTenant]);

  // Inventory mini-summary — cumulative sell-through + status mix (all units, not period-scoped).
  const inventory = useMemo(() => {
    const total = scopedUnits.length;
    const sold = scopedUnits.filter((u) => u.status === 'sold').length;
    const reserved = scopedUnits.filter((u) => u.status === 'reserved').length;
    const available = scopedUnits.filter((u) => u.status === 'available').length;
    return { total, sold, reserved, available, sellThrough: total ? Math.round((sold / total) * 100) : 0 };
  }, [scopedUnits]);

  // Depth-of-usage — how many units each customer manages in the platform (= data gravity /
  // lock-in). Active tenants with little/no inventory loaded = shallow = churn risk.
  const inventoryDepth = useMemo(() => {
    const byTenant = new Map<string, number>();
    scopedUnits.forEach((u) => byTenant.set(u.tenant_id, (byTenant.get(u.tenant_id) || 0) + 1));
    const ids = new Set<string>(byTenant.keys());
    tenantStatusById.forEach((s, id) => { if (s === 'active' && inScope(id)) ids.add(id); });
    const rows = Array.from(ids)
      .map((id) => ({ id, name: tenantNameById.get(id) || '–', status: tenantStatusById.get(id) || 'active', units: byTenant.get(id) || 0 }))
      .sort((a, b) => b.units - a.units);
    // 0 units = paid but hasn't set up yet → onboarding signal (NOT churn — count alone
    // doesn't measure churn; a small company with few units is fine, see scope notes).
    return {
      notOnboarded: rows.filter((r) => r.status === 'active' && r.units === 0),
      ranked: rows.filter((r) => !(r.status === 'active' && r.units === 0)),
    };
  }, [scopedUnits, tenantNameById, tenantStatusById, allowedTenantIds]);


  // Top provinces by sold value in the selected period (from properties.address->>'province').
  const topProvinces = useMemo<ProvinceRow[]>(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => { if (!ts) return false; const d = new Date(ts); return (!from || d >= from) && d <= to; };
    const agg = new Map<string, { sold: number; soldValue: number }>();
    scopedUnits.forEach((u) => {
      if (u.status !== 'sold' || !inRange(u.sold_at)) return;
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
  }, [scopedUnits, provById, period]);

  // Adoption breakdown — active customers split into "transacted" vs "dormant" this period.
  // The dormant payers are the actionable bit behind the "X/Y" KPI (paying but not using).
  const adoptionBreakdown = useMemo(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => { if (!ts) return false; const d = new Date(ts); return (!from || d >= from) && d <= to; };
    const byTenant = new Map<string, { sold: number; value: number }>();
    scopedUnits.forEach((u) => {
      if (u.status !== 'sold' || !inRange(u.sold_at)) return;
      const r = byTenant.get(u.tenant_id) || { sold: 0, value: 0 };
      r.sold += 1; r.value += Number(u.price) || 0; byTenant.set(u.tenant_id, r);
    });
    const transacting: { id: string; name: string; sold: number; value: number }[] = [];
    const dormant: { id: string; name: string; plan: string }[] = [];
    tenantStatusById.forEach((s, id) => {
      if (s !== 'active' || !inScope(id)) return;
      const t = byTenant.get(id);
      if (t) transacting.push({ id, name: tenantNameById.get(id) || '–', sold: t.sold, value: t.value });
      else dormant.push({ id, name: tenantNameById.get(id) || '–', plan: tenantPlanById.get(id) || '' });
    });
    transacting.sort((a, b) => b.value - a.value);
    dormant.sort((a, b) => a.name.localeCompare(b.name, 'th'));
    return { transacting, dormant };
  }, [scopedUnits, period, tenantStatusById, tenantNameById, tenantPlanById, allowedTenantIds]);

  // Companies selling in each province (period-scoped) — for the จังหวัด inline expand.
  const companiesByProvince = useMemo(() => {
    const { from, to } = periodToRange(period);
    const inRange = (ts: string | null) => { if (!ts) return false; const d = new Date(ts); return (!from || d >= from) && d <= to; };
    const m = new Map<string, Map<string, { sold: number; value: number }>>();
    scopedUnits.forEach((u) => {
      if (u.status !== 'sold' || !inRange(u.sold_at)) return;
      const prov = provById.get(u.project_id) || 'ไม่ระบุ';
      const inner = m.get(prov) || new Map<string, { sold: number; value: number }>();
      const r = inner.get(u.tenant_id) || { sold: 0, value: 0 };
      r.sold += 1; r.value += Number(u.price) || 0;
      inner.set(u.tenant_id, r); m.set(prov, inner);
    });
    const out = new Map<string, { id: string; name: string; sold: number; value: number }[]>();
    m.forEach((inner, prov) => {
      out.set(prov, Array.from(inner.entries())
        .map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', sold: v.sold, value: v.value }))
        .sort((a, b) => b.value - a.value));
    });
    return out;
  }, [scopedUnits, provById, period, tenantNameById]);

  // Compact KPI card — same shape as OwnerDashboard.renderKpiCard.
  const renderKpiCard = (k: any, i: number) => (
    <div key={i} onClick={k.onClick ?? (k.href ? () => navigate(k.href) : undefined)} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5 pr-1 flex-1">{k.label}</p>
        <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} strokeWidth={2} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">{k.value}</p>
      {k.trend ? (
        <>
          <p className="text-sm mt-3.5 font-semibold" style={{ color: k.trend.up ? KK.green : KK.red }}>
            {k.trend.up ? '↗' : '↘'} {k.trend.value}%<span className="font-normal text-gray-400"> {k.trendLabel || 'MoM'}</span>
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
                <p className="text-sm text-gray-500 mt-1.5">บริษัทผู้เช่า (อสังหาฯ) ใช้แพลตฟอร์มทำธุรกรรมมากแค่ไหน — ยิ่งขายผ่านเรา ยิ่งขาดเราไม่ได้</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                <select
                  value={segment}
                  onChange={(e) => setSegment(e.target.value as typeof segment)}
                  className="text-xs font-semibold border rounded-xl px-2.5 py-2 bg-white cursor-pointer focus:outline-none"
                  style={{ color: '#111827', borderColor: '#e5e7eb' }}
                  title="กรองตามกลุ่มบริษัท"
                >
                  <option value="all">บริษัททั้งหมด</option>
                  <option value="active">เฉพาะ Active</option>
                  <option value="trial">เฉพาะ Trial</option>
                  <option value="enterprise">แพ็กเกจ Enterprise</option>
                  <option value="professional">แพ็กเกจ Professional</option>
                  <option value="starter">แพ็กเกจ Starter</option>
                </select>
                <PeriodFilter value={period} onChange={setPeriod} tier="strategic" />
              </div>
            </div>

            {/* KPI strip — Owner-native only: sales value, adoption, inventory depth.
                (Leads moved out — leads/buyer analytics live in BUYER INTELLIGENCE / ภาพรวมผู้ซื้อ.) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: `มูลค่าอสังหาฯ ที่ขายผ่านระบบ (${periodRangeLabel(period)})`, value: fmtCompact(reStats.gmv), trend: mkTrend(gmvDeltaPct), trendLabel: 'เทียบช่วงก่อน', icon: TrendingUp, color: KK.red, href: '/owner-companies' },
                { label: `บริษัทที่ใช้งาน (${periodRangeLabel(period)})`, value: reStats.activeTenants > 0 ? `${reStats.transacting}/${reStats.activeTenants}` : '—', icon: Building, color: KK.blue, onClick: () => setAdoptionModalOpen(true), sub: adoptionBreakdown.dormant.length > 0 ? `⚠️ ${adoptionBreakdown.dormant.length} บริษัทจ่ายเงินแต่ไม่ใช้ · กดดู` : 'บริษัท active ที่ใช้งานระบบ' },
                { label: 'ยูนิตในระบบ · ณ ปัจจุบัน', value: inventory.total.toLocaleString(), icon: Layers, color: KK.purple, onClick: () => setDepthModalOpen(true), sub: 'ยูนิตทั้งหมดที่บริษัทจัดการในระบบ · กดดูรายบริษัท' },
              ].map(renderKpiCard)}
            </div>

            {/* Row 1: transaction trend (wide) + inventory snapshot (narrow) */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">
            {/* GMV monthly bar chart (6 months) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">ธุรกรรมผ่านระบบรายเดือน</h2>
                    <p className="text-xs text-gray-500 mt-0.5">แพลตฟอร์มถูกใช้งานเพิ่มขึ้นไหม · ย้อนหลัง 6 เดือน</p>
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
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} width={58} />
                    <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: KK.redLight }} formatter={((v: any) => [fmtCompact(Number(v ?? 0)), 'GMV']) as any} />
                    <Bar dataKey="gmv" fill="url(#overviewGmvGrad)" radius={[8, 8, 0, 0]} maxBarSize={80} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-400 text-center py-12">ยังไม่มีข้อมูลยอดขาย</p>
              )}
            </div>
            {/* Inventory snapshot donut — paired with the trend chart */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">สถานะยูนิตในระบบ</h2>
                    <p className="text-xs text-gray-500 mt-0.5">ว่าง / จอง / ขายแล้ว · ณ ปัจจุบัน</p>
                  </div>
                </div>
                <button onClick={() => navigate('/owner-inventory')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                  ดูสต๊อก <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {inventory.total === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลยูนิต</p>
              ) : (() => {
                const mix = [
                  { name: 'ว่าง', value: inventory.available, color: KK.blue },
                  { name: 'จองแล้ว', value: inventory.reserved, color: KK.amber },
                  { name: 'ขายแล้ว', value: inventory.sold, color: KK.green },
                ].filter((s) => s.value > 0);
                return (
                  <div className="flex items-center gap-5 flex-1">
                    <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
                      <PieChart width={150} height={150}>
                        <Pie data={mix} cx={72} cy={72} innerRadius={48} outerRadius={68} dataKey="value" strokeWidth={2} stroke="#fff" startAngle={90} endAngle={-270}>
                          {mix.map((s, i) => <Cell key={i} fill={s.color} />)}
                        </Pie>
                      </PieChart>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-2xl font-bold tabular-nums leading-none" style={{ color: KK.green }}>{inventory.sellThrough}%</div>
                        <div className="text-xs text-gray-400 mt-1">Sell-through</div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2.5">
                      {mix.map((s) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                          <span className="text-sm text-gray-500 flex-1">{s.name}</span>
                          <span className="text-sm font-bold tabular-nums text-gray-800">{s.value.toLocaleString()}</span>
                          <span className="text-xs text-gray-400 w-9 text-right">{Math.round((s.value / inventory.total) * 100)}%</span>
                        </div>
                      ))}
                      <div className="pt-2 mt-1 border-t border-gray-100">
                        <span className="text-xs text-gray-400">จาก {inventory.total.toLocaleString()} ยูนิตทั้งหมด</span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
            </div>

            {/* Row 2: top customers (left) + geography zones (right) — both ranked lists */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Top 5 companies — company-level only */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: KK.amber }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">บริษัทที่ขายผ่านระบบมากสุด</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Top 5 · มูลค่าขายผ่านระบบมากสุด ({periodRangeLabel(period)}) · กดดูปัจจัย</p>
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
                    <div className="space-y-1">
                      {topCompanies.map((c, i) => {
                        const open = expandedCompany === c.id;
                        const f = factorsByTenant.get(c.id);
                        return (
                          <div key={c.id} className="rounded-lg -mx-2">
                            {/* Row — click to expand the factor profile in place */}
                            <div onClick={() => setExpandedCompany(open ? null : c.id)}
                              className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors group">
                              <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-gray-900">{c.name}</span>
                                    {(() => { const b = getBadge(tenantStatusById.get(c.id) || 'active'); return <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: b.color, backgroundColor: b.bg }}>{b.label}</span>; })()}
                                    {(() => {
                                      const plan = tenantPlanById.get(c.id) || '';
                                      if (!plan) return null;
                                      const label = plan.charAt(0).toUpperCase() + plan.slice(1);
                                      return (
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 border whitespace-nowrap" style={{ color: '#e11d48', backgroundColor: '#fff', borderColor: '#fda4af' }}>{label}</span>
                                      );
                                    })()}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-sm font-bold tabular-nums block" style={{ color: KK.red }}>{fmtCompact(c.soldValue)}</span>
                                    <span className="text-xs text-gray-400">{c.sold} ยูนิต</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${(c.soldValue / maxVal) * 100}%`, backgroundColor: KK.red }} />
                                </div>
                              </div>
                              <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                            </div>

                            {/* Expanded — descriptive sales-factor profile */}
                            {open && (
                              <div className="mx-2 mb-2 mt-1 rounded-xl bg-gray-50 border border-gray-100 p-3.5">
                                <p className="text-xs font-semibold text-gray-500 mb-2.5">ปัจจัยการขาย <span className="font-normal text-gray-400">· โปรไฟล์ประกอบ ไม่ใช่สาเหตุที่พิสูจน์แล้ว</span></p>
                                {!f ? (
                                  <p className="text-xs text-gray-400">ไม่มีข้อมูลยูนิต</p>
                                ) : (
                                  <>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                                      {[
                                        { label: 'ทำเล', value: f.provinces.length ? (f.provinces.length === 1 ? f.provinces[0] : `${f.provinces.length} จังหวัด`) : '–', icon: MapPin, color: KK.green },
                                        { label: 'ช่วงราคา', value: f.minP > 0 ? `${fmtCompact(f.minP)}–${fmtCompact(f.maxP)}` : '–', icon: TrendingUp, color: KK.red },
                                        { label: 'ประเภทหลัก', value: f.topType, icon: Building, color: KK.blue },
                                        { label: 'พื้นที่เฉลี่ย', value: f.avgArea ? `${f.avgArea.toLocaleString()} ตร.ม.` : '–', icon: Layers, color: KK.purple },
                                        { label: 'ทีมขาย', value: `${f.staff} คน`, icon: UserPlusIcon, color: KK.amber },
                                        { label: 'Sell-through', value: `${f.sellThrough}%`, icon: Trophy, color: KK.green },
                                      ].map((x) => (
                                        <div key={x.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                                          <div className="flex items-center gap-1 mb-1">
                                            <x.icon className="w-3 h-3 flex-shrink-0" style={{ color: x.color }} />
                                            <span className="text-[11px] text-gray-400">{x.label}</span>
                                          </div>
                                          <p className="text-xs font-bold text-gray-800 tabular-nums truncate" title={String(x.value)}>{x.value}</p>
                                        </div>
                                      ))}
                                    </div>
                                    {f.provinces.length > 1 && <p className="text-[11px] text-gray-400 mt-2 truncate">ทำเล: {f.provinces.join(' · ')}</p>}
                                    <button onClick={(e) => { e.stopPropagation(); navigate(`/owner-projects/${c.id}`); }}
                                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: KK.red }}>
                                      ดูโครงการทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Geography zones — paired with the leaderboard (both ranked lists) */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: KK.green }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">ยอดขายตามจังหวัด</h2>
                      <p className="text-xs text-gray-500 mt-0.5">Top 5 จังหวัดที่ธุรกรรมหนาแน่น · เป้าหมายหา developer รายใหม่</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-geography')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดูภูมิศาสตร์ <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {(() => {
                  const maxVal = Math.max(...topProvinces.map((p) => p.soldValue), 1);
                  return (
                    <div className="space-y-1">
                      {topProvinces.map((p, i) => {
                        const open = expandedProvince === p.province;
                        const cos = companiesByProvince.get(p.province) || [];
                        return (
                          <div key={p.province} className="rounded-lg -mx-2">
                            <div onClick={() => setExpandedProvince(open ? null : p.province)}
                              className="flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors group">
                              <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-sm font-semibold text-gray-800 truncate group-hover:text-gray-900">{p.province}</span>
                                  <div className="text-right flex-shrink-0">
                                    <span className="text-sm font-bold tabular-nums block" style={{ color: KK.red }}>{fmtCompact(p.soldValue)}</span>
                                    <span className="text-xs text-gray-400">{p.sold} ยูนิต</span>
                                  </div>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${(p.soldValue / maxVal) * 100}%`, backgroundColor: i === 0 ? KK.red : '#fca5a5' }} />
                                </div>
                              </div>
                              <ChevronRight className={`w-4 h-4 text-gray-300 flex-shrink-0 group-hover:text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                            </div>
                            {open && (
                              <div className="mx-2 mb-2 mt-1 rounded-xl bg-gray-50 border border-gray-100 p-3">
                                <p className="text-xs font-semibold text-gray-500 mb-2">บริษัทที่ขายในจังหวัดนี้ ({cos.length})</p>
                                <div className="space-y-1.5">
                                  {cos.map((c) => (
                                    <button key={c.id} onClick={(e) => { e.stopPropagation(); navigate(`/owner-projects/${c.id}`); }}
                                      className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-white transition-colors">
                                      <span className="text-sm text-gray-700 flex-1 truncate">{c.name}</span>
                                      <span className="text-xs font-bold tabular-nums" style={{ color: KK.red }}>{fmtCompact(c.value)}</span>
                                      <span className="text-xs text-gray-400">· {c.sold} ยูนิต</span>
                                      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </main>
        </div>
      </div>
      {/* Adoption breakdown — who transacted vs who's paying-but-dormant */}
      <Dialog open={adoptionModalOpen} onOpenChange={(o) => { setAdoptionModalOpen(o); if (!o) setAdoptionSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>การใช้งานของบริษัท · {periodRangeLabel(period)}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-3">บริษัท active {reStats.activeTenants} ราย — ใช้งาน {adoptionBreakdown.transacting.length} · ไม่ใช้ {adoptionBreakdown.dormant.length}</p>
          <input value={adoptionSearch} onChange={(e) => setAdoptionSearch(e.target.value)} placeholder="ค้นหาบริษัท..."
            className="w-full mb-3 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {(() => {
              const q = adoptionSearch.trim().toLowerCase();
              const dm = q ? adoptionBreakdown.dormant.filter((c) => c.name.toLowerCase().includes(q)) : adoptionBreakdown.dormant;
              const tx = q ? adoptionBreakdown.transacting.filter((c) => c.name.toLowerCase().includes(q)) : adoptionBreakdown.transacting;
              const txShown = q ? tx : tx.slice(0, 8);
              if (dm.length === 0 && tx.length === 0) {
                return <p className="text-sm text-gray-400 text-center py-8">{q ? 'ไม่พบบริษัท' : 'ไม่มีข้อมูล'}</p>;
              }
              return (
                <>
                  {dm.length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: KK.red }}>⚠️ จ่ายเงินแต่ไม่ใช้ — เสี่ยง</p>
                      <div className="space-y-1">
                        {dm.map((d) => (
                          <button key={d.id} onClick={() => { setAdoptionModalOpen(false); navigate(`/tenants/${d.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors border border-gray-100">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: KK.red }} />
                            <span className="text-sm text-gray-800 flex-1 truncate">{d.name}</span>
                            {d.plan && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: KK.red, background: KK.redLight }}>{d.plan}</span>}
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {txShown.length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: KK.green }}>{q ? 'ผลค้นหา (ใช้งาน)' : '✅ ใช้งานในช่วงนี้'}</p>
                      <div className="space-y-1">
                        {txShown.map((t) => (
                          <button key={t.id} onClick={() => { setAdoptionModalOpen(false); navigate(`/owner-projects/${t.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors">
                            <span className="text-sm text-gray-700 flex-1 truncate">{t.name}</span>
                            <span className="text-xs font-bold tabular-nums" style={{ color: KK.green }}>{fmtCompact(t.value)}</span>
                            <span className="text-xs text-gray-400">· {t.sold} ยูนิต</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                      {!q && tx.length > 8 && (
                        <button onClick={() => { setAdoptionModalOpen(false); navigate('/owner-companies'); }}
                          className="w-full mt-1.5 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors" style={{ color: KK.red }}>
                          และอีก {tx.length - 8} บริษัท · ดูอันดับเต็ม <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Depth-of-usage — how much each customer manages in the platform (lock-in by company) */}
      <Dialog open={depthModalOpen} onOpenChange={(o) => { setDepthModalOpen(o); if (!o) setDepthSearch(''); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ยูนิตในระบบ · รายบริษัท</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-3">เรียงตามปริมาณที่บริษัทจัดการในระบบ · เจ้าที่จ่ายแล้วยังไม่โหลด = ไปช่วย onboard</p>
          <input value={depthSearch} onChange={(e) => setDepthSearch(e.target.value)} placeholder="ค้นหาบริษัท..."
            className="w-full mb-3 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-gray-300" />
          <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
            {(() => {
              const q = depthSearch.trim().toLowerCase();
              const no = q ? inventoryDepth.notOnboarded.filter((c) => c.name.toLowerCase().includes(q)) : inventoryDepth.notOnboarded;
              const rk = q ? inventoryDepth.ranked.filter((c) => c.name.toLowerCase().includes(q)) : inventoryDepth.ranked;
              const rkShown = q ? rk : rk.slice(0, 8);
              if (no.length === 0 && rk.length === 0) {
                return <p className="text-sm text-gray-400 text-center py-8">{q ? 'ไม่พบบริษัท' : 'ไม่มีข้อมูล'}</p>;
              }
              return (
                <>
                  {no.length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: KK.amber }}>จ่ายแล้วแต่ยังไม่โหลด — ต้องช่วย onboard</p>
                      <div className="space-y-1">
                        {no.map((c) => (
                          <button key={c.id} onClick={() => { setDepthModalOpen(false); navigate(`/tenants/${c.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors border border-gray-100">
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: KK.amber }} />
                            <span className="text-sm text-gray-800 flex-1 truncate">{c.name}</span>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ color: KK.amber, background: KK.amberLight }}>ยังไม่โหลด</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {rkShown.length > 0 && (
                    <div>
                      <p className="text-xs font-bold mb-2" style={{ color: KK.purple }}>{q ? 'ผลค้นหา' : 'บัญชีใหญ่สุด (เรียงตามยูนิตในระบบ)'}</p>
                      <div className="space-y-1">
                        {rkShown.map((c) => (
                          <button key={c.id} onClick={() => { setDepthModalOpen(false); navigate(`/tenants/${c.id}`); }}
                            className="w-full flex items-center gap-2 text-left rounded-lg px-2 py-1.5 hover:bg-gray-50 transition-colors">
                            <span className="text-sm text-gray-700 flex-1 truncate">{c.name}</span>
                            <span className="text-sm font-bold tabular-nums" style={{ color: KK.purple }}>{c.units}</span>
                            <span className="text-xs text-gray-400">ยูนิต</span>
                            <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                          </button>
                        ))}
                      </div>
                      {!q && rk.length > 8 && (
                        <button onClick={() => { setDepthModalOpen(false); navigate('/owner-companies'); }}
                          className="w-full mt-1.5 flex items-center justify-center gap-1 py-2 text-xs font-semibold rounded-lg hover:bg-gray-50 transition-colors" style={{ color: KK.red }}>
                          และอีก {rk.length - 8} บริษัท · ดูทั้งหมด <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </OwnerGuard>
  );
};

export default OwnerMarketOverview;
