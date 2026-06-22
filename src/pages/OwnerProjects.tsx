import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Building,
  Home,
  ArrowUpRight,
  ArrowLeft,
  Search,
  MapPin,
  TrendingUp,
  Clock,
  ChevronRight,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  BedDouble,
  Bath,
  Car,
  Maximize,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────
// Owner "จัดการโครงการ" (control-plane, read-only).
// Lens: Owner = SaaS PLATFORM owner, not a property seller. So this page
// answers ONLY platform questions — "how much is each customer USING the
// platform" (adoption/activity) and "how big is the account" (GDV) — NOT
// "how well does the tenant sell" (absorption/sell-through was deliberately
// cut; that's the tenant Admin's metric).
// Three drill levels: L0 all companies → L1 one company's projects → L2 one
// project's units (a read-only INVENTORY view — unit specs/price/status only,
// never customer PII; that's still application-plane Admin data).
// Cross-tenant reads use the live "Owner can view all" RLS on properties +
// units; no migration needed.
// ──────────────────────────────────────────────────────────────────────────

interface Tenant {
  id: string;
  name: string;
  status: string;
  subscription_plan: string;
}

interface Property {
  id: string;
  tenant_id: string;
  name: string;
  developer: string | null;
  base_price: number | null;
  address: { province?: string; district?: string } | null;
  thumbnail_url: string | null;
  is_active: boolean | null;
  updated_at: string | null;
}

interface Unit {
  id: string;
  tenant_id: string;
  project_id: string;
  price: number | null;
  status: string | null;
  area_sqm: number | null;
  unit_number: string | null;
  floor_number: number | null;
  building: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  unit_type: string | null;
  thumbnail_url: string | null;
  updated_at: string | null;
}

// Soft luxury palette — identical tokens to OwnerDashboard for consistency.
const KK = {
  red: '#ef4444', redLight: '#fef2f2', redBorder: '#fecaca',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  slate: '#475569', slateLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};

const toEpoch = (s?: string | null) => (s ? new Date(s).getTime() : 0);

// "Last activity" relative time — Owner-relevant signal of whether a tenant is
// still actively using the platform (a silent customer = churn risk).
const fmtRelative = (epoch: number) => {
  if (!epoch) return '–';
  const days = Math.floor((Date.now() - epoch) / 86_400_000);
  if (days <= 0) return 'วันนี้';
  if (days === 1) return 'เมื่อวาน';
  if (days < 30) return `${days} วันก่อน`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} เดือนก่อน`;
  return `${Math.floor(months / 12)} ปีก่อน`;
};

// Compact currency — Thai real-estate convention "X ล้าน" / "K" (NOT M/B).
// Copied verbatim from Index.tsx (the canonical formatter); see its comment
// for the scale rules. Matches AP Thailand / DDproperty / Hipflat listings.
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

// Per-unit roll-up shared by every level.
interface Rollup {
  total: number;
  sold: number;
  reserved: number;
  available: number;
  gdv: number;        // total property value managed (= "account size" for Owner)
  soldValue: number;  // value of sold units
  lastUpdated: number; // most recent unit edit (epoch ms) — activity signal
}

const rollUp = (units: Unit[]): Rollup => {
  const r: Rollup = { total: 0, sold: 0, reserved: 0, available: 0, gdv: 0, soldValue: 0, lastUpdated: 0 };
  for (const u of units) {
    r.total += 1;
    const price = Number(u.price) || 0;
    r.gdv += price;
    if (u.status === 'sold') { r.sold += 1; r.soldValue += price; }
    else if (u.status === 'reserved') r.reserved += 1;
    else r.available += 1;
    const t = toEpoch(u.updated_at);
    if (t > r.lastUpdated) r.lastUpdated = t;
  }
  return r;
};

const planBadge = (plan: string) => {
  const map: Record<string, string> = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Starter' };
  return map[plan] || plan;
};

// Unit status → Thai label + KK color (same palette/convention as Analytics.tsx).
const UNIT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sold:      { label: 'ขายแล้ว', color: KK.red,   bg: KK.redLight },
  reserved:  { label: 'จองอยู่',  color: KK.amber, bg: KK.amberLight },
  available: { label: 'ว่าง',     color: KK.green, bg: KK.greenLight },
};
const unitStatusMeta = (s: string | null) => UNIT_STATUS[s || 'available'] || UNIT_STATUS.available;
// Sort rank so an unknown status doesn't NaN the comparator.
const statusRank = (s: string | null) => (s === 'sold' ? 2 : s === 'reserved' ? 1 : 0);

const OwnerProjects = () => {
  const navigate = useNavigate();
  const { tenantId, projectId } = useParams();
  const { user } = useSimpleAuth();
  const { isOwner } = usePermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [planLimits, setPlanLimits] = useState<Record<string, number>>({}); // planId → max_properties limit
  const [salesStaffByTenant, setSalesStaffByTenant] = useState<Record<string, number>>({}); // tenantId → #sales/agent users
  // L0 column sort (reuse OwnerTenantHealth pattern).
  const [sortKey, setSortKey] = useState<'projects' | 'units' | 'lastActive' | 'name'>('projects');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  // L1 (one company's project grid) has its own pagination, separate from L0.
  const [projPage, setProjPage] = useState(1);
  // L2 (one project's unit table) — own search, pagination, and column sort.
  const [unitSearch, setUnitSearch] = useState('');
  const [unitPage, setUnitPage] = useState(1);
  const [unitSortKey, setUnitSortKey] = useState<'unit' | 'area' | 'price' | 'status'>('unit');
  const [unitSortDir, setUnitSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  // Reset L0 page when the company search/sort changes.
  useEffect(() => { setCurrentPage(1); }, [search, sortKey, sortDir]);
  // Reset L1 project-grid page when switching company or searching inside it.
  useEffect(() => { setProjPage(1); }, [tenantId, search]);
  // Reset L2 unit-table page when switching project or searching inside it.
  useEffect(() => { setUnitPage(1); }, [projectId, unitSearch]);

  const toggleSort = (key: 'projects' | 'units' | 'lastActive' | 'name') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, uRes, planRes, staffRes] = await Promise.all([
        supabase.from('tenants').select('id, name, status, subscription_plan').eq('is_platform' as any, false),
        supabase.from('properties').select('id, tenant_id, name, developer, base_price, address, thumbnail_url, is_active, updated_at'),
        supabase.from('units').select('id, tenant_id, project_id, price, status, area_sqm, unit_number, floor_number, building, bedrooms, bathrooms, parking_spaces, unit_type, thumbnail_url, updated_at'),
        (supabase as any).from('plans').select('id, max_properties'),
        supabase.from('users').select('tenant_id, role').in('role', ['sales', 'agent']),
      ]);
      setTenants((tRes.data || []) as Tenant[]);
      setProperties((pRes.data || []) as Property[]);
      setUnits((uRes.data || []) as Unit[]);
      if (planRes.data) setPlanLimits(Object.fromEntries((planRes.data as any[]).map((p) => [p.id, p.max_properties])));
      const staffCount: Record<string, number> = {};
      ((staffRes.data || []) as { tenant_id: string }[]).forEach((u) => { staffCount[u.tenant_id] = (staffCount[u.tenant_id] || 0) + 1; });
      setSalesStaffByTenant(staffCount);
    } catch (e) {
      console.error('OwnerProjects fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Units grouped by project — the join everything else derives from.
  const unitsByProject = useMemo(() => {
    const m = new Map<string, Unit[]>();
    for (const u of units) {
      const arr = m.get(u.project_id) || [];
      arr.push(u);
      m.set(u.project_id, arr);
    }
    return m;
  }, [units]);

  // Per-tenant aggregate (only tenants that actually have projects).
  const tenantRows = useMemo(() => {
    const byTenant = new Map<string, Property[]>();
    for (const p of properties) {
      const arr = byTenant.get(p.tenant_id) || [];
      arr.push(p);
      byTenant.set(p.tenant_id, arr);
    }
    return tenants
      .map((t) => {
        const props = byTenant.get(t.id) || [];
        const tUnits = props.flatMap((p) => unitsByProject.get(p.id) || []);
        const roll = rollUp(tUnits);
        // Tenant activity = newest of its unit edits OR its project edits
        // (a project edited with no unit change still counts as activity).
        const lastUpdated = props.reduce((mx, p) => Math.max(mx, toEpoch(p.updated_at)), roll.lastUpdated);
        return { tenant: t, projectCount: props.length, roll: { ...roll, lastUpdated } };
      })
      // Show ALL companies — even those with 0 projects (เฮีย: ทุกบริษัทต้องโผล่, แสดง "0/limit").
      // Companies with projects rank first; empty ones fall to the bottom.
      .sort((a, b) => b.projectCount - a.projectCount);
  }, [tenants, properties, unitsByProject]);

  // L0 platform totals.
  const platform = useMemo(() => {
    const roll = tenantRows.reduce<Rollup>((acc, r) => ({
      total: acc.total + r.roll.total,
      sold: acc.sold + r.roll.sold,
      reserved: acc.reserved + r.roll.reserved,
      available: acc.available + r.roll.available,
      gdv: acc.gdv + r.roll.gdv,
      soldValue: acc.soldValue + r.roll.soldValue,
      lastUpdated: Math.max(acc.lastUpdated, r.roll.lastUpdated),
    }), { total: 0, sold: 0, reserved: 0, available: 0, gdv: 0, soldValue: 0, lastUpdated: 0 });
    const projectCount = tenantRows.reduce((s, r) => s + r.projectCount, 0);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const active7d = tenantRows.filter((r) => r.roll.lastUpdated >= weekAgo).length;
    // Onboarding/churn signal — tenants that subscribed but never created a project.
    const notStarted = tenantRows.filter((r) => r.projectCount === 0).length;
    return { roll, projectCount, companyCount: tenantRows.length, active7d, notStarted };
  }, [tenantRows]);

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

  // Reusable KPI card (same shape as OwnerDashboard).
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
      <p className="text-3xl font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  // Project usage vs the tenant's plan limit — the Owner's upsell/churn signal.
  const projectQuota = (used: number, planId: string): { text: string; near: boolean } => {
    const limit = planLimits[planId];
    if (limit == null || limit === -1) return { text: `${used} / ไม่จำกัด`, near: false };
    return { text: `${used} / ${limit}`, near: limit > 0 && used / limit >= 0.8 };
  };

  // ════════════════════════════════════ L2 — one project's units ════════════
  // Inventory view: read-only unit list (specs/price/status only, no PII).
  if (tenantId && projectId) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const project = properties.find((p) => p.id === projectId);
    const projUnits = units.filter((u) => u.project_id === projectId);
    const roll = rollUp(projUnits);
    // Price range across units that actually carry a price.
    const priced = projUnits.map((u) => Number(u.price) || 0).filter((n) => n > 0);
    const minPrice = priced.length ? Math.min(...priced) : 0;
    const maxPrice = priced.length ? Math.max(...priced) : 0;

    const q = unitSearch.trim().toLowerCase();
    const filteredUnits = projUnits
      .filter((u) => !q
        || (u.unit_number || '').toLowerCase().includes(q)
        || (u.unit_type || '').toLowerCase().includes(q))
      .sort((a, b) => {
        const dir = unitSortDir === 'asc' ? 1 : -1;
        if (unitSortKey === 'area') return ((Number(a.area_sqm) || 0) - (Number(b.area_sqm) || 0)) * dir;
        if (unitSortKey === 'price') return ((Number(a.price) || 0) - (Number(b.price) || 0)) * dir;
        if (unitSortKey === 'status') return (statusRank(a.status) - statusRank(b.status)) * dir;
        // 'unit' — natural-ish sort on unit_number string.
        return (a.unit_number || '').localeCompare(b.unit_number || '', 'th', { numeric: true }) * dir;
      });

    // 12 cards / page = exactly 3 rows on the xl 4-column grid.
    const unitPageSize = 12;
    const unitTotalPages = Math.max(1, Math.ceil(filteredUnits.length / unitPageSize));
    const unitSafePage = Math.min(unitPage, unitTotalPages);
    const unitStart = (unitSafePage - 1) * unitPageSize;
    const pagedUnits = filteredUnits.slice(unitStart, unitStart + unitPageSize);

    // Sort options for the card-grid "เรียงตาม" dropdown (cards have no
    // clickable column headers, so sorting moves into a Select control).
    const UNIT_SORT_OPTIONS: { value: 'unit' | 'price' | 'area' | 'status'; label: string }[] = [
      { value: 'unit', label: 'เลขยูนิต' },
      { value: 'price', label: 'ราคา' },
      { value: 'area', label: 'พื้นที่' },
      { value: 'status', label: 'สถานะ' },
    ];

    return (
      <OwnerGuard>
        <div className="min-h-screen bg-gray-50">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="lg:ml-[260px] min-h-screen">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="p-6 lg:p-8 space-y-7">
              {/* Breadcrumb + header */}
              <div>
                <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-3 flex-wrap">
                  <button onClick={() => navigate('/owner-projects')} className="hover:text-gray-900 transition-colors">ทุกบริษัท</button>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <button onClick={() => navigate(`/owner-projects/${tenantId}`)} className="hover:text-gray-900 transition-colors">{tenant?.name || 'บริษัท'}</button>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
                  <span className="text-gray-900 font-medium">{project?.name || 'โครงการ'}</span>
                </nav>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  รายการยูนิต
                </span>
                <h1 className="text-2xl font-bold text-gray-900">{project?.name || 'โครงการ'}</h1>
                <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
                  {project?.developer && <span>{project.developer}</span>}
                  {project?.developer && project?.address?.province && <span className="text-gray-300">·</span>}
                  {project?.address?.province && (
                    <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {project.address.province}</span>
                  )}
                </p>
              </div>

              {/* KPIs — inventory mix + price (Owner inventory lens) */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard title="ยูนิตทั้งหมด" value={roll.total.toLocaleString()} sub="ในโครงการนี้" icon={Home} color={KK.slate} bg={KK.slateLight} />
                <KpiCard title="ขายแล้ว" value={roll.sold.toLocaleString()} sub={roll.total ? `${Math.round((roll.sold / roll.total) * 100)}% ของยูนิต` : undefined} icon={Building2} color={KK.red} bg={KK.redLight} />
                <KpiCard title="จองอยู่" value={roll.reserved.toLocaleString()} sub={roll.total ? `${Math.round((roll.reserved / roll.total) * 100)}% ของยูนิต` : undefined} icon={Clock} color={KK.amber} bg={KK.amberLight} />
                <KpiCard title="ว่าง" value={roll.available.toLocaleString()} sub={roll.total ? `${Math.round((roll.available / roll.total) * 100)}% ของยูนิต` : undefined} icon={Building} color={KK.green} bg={KK.greenLight} />
                <KpiCard title="ราคาเริ่มต้น" value={priced.length ? fmtCompact(minPrice) : '–'} sub="ยูนิตที่ตั้งราคาแล้ว" icon={TrendingUp} color={KK.blue} bg={KK.blueLight} />
                <KpiCard title="ราคาสูงสุด" value={priced.length ? fmtCompact(maxPrice) : '–'} sub="ช่วงราคาในโครงการ" icon={TrendingUp} color={KK.slate} bg={KK.slateLight} />
              </div>

              {/* Units — property-style card grid (read-only inventory) */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">ยูนิตในโครงการ</h2>
                    <p className="text-xs text-gray-500 mt-0.5">ข้อมูลสินค้าคงคลัง · อ่านอย่างเดียว</p>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <Input placeholder="ค้นหาเลขยูนิต / ประเภท" value={unitSearch} onChange={(e) => setUnitSearch(e.target.value)} className="pl-9 h-9" />
                    </div>
                    {/* "เรียงตาม" — replaces the old clickable table headers */}
                    <Select value={unitSortKey} onValueChange={(v) => { setUnitSortKey(v as typeof unitSortKey); setUnitPage(1); }}>
                      <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="เรียงตาม" /></SelectTrigger>
                      <SelectContent>
                        {UNIT_SORT_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>เรียงตาม{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 px-2.5"
                      title={unitSortDir === 'asc' ? 'น้อยไปมาก' : 'มากไปน้อย'}
                      onClick={() => { setUnitSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); setUnitPage(1); }}
                    >
                      {unitSortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                {filteredUnits.length === 0 ? (
                  <div className="text-center py-12">
                    <Home className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">{projUnits.length === 0 ? 'โครงการนี้ยังไม่มียูนิต' : 'ไม่พบยูนิตที่ค้นหา'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {pagedUnits.map((u) => {
                      const meta = unitStatusMeta(u.status);
                      return (
                        <div
                          key={u.id}
                          onClick={() => navigate(`/owner-projects/${tenantId}/${projectId}/${u.id}`)}
                          className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden cursor-pointer"
                        >
                          {/* รูปภาพ + chip เลขยูนิต + สถานะ */}
                          <div className="relative aspect-[4/3] bg-gray-50">
                            {u.thumbnail_url ? (
                              <img src={u.thumbnail_url} alt={u.unit_number || 'unit'} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-gray-300">
                                <Home className="w-8 h-8 mb-1" />
                                <span className="text-xs text-gray-400">ไม่มีรูป</span>
                              </div>
                            )}
                            {u.unit_number && (
                              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-xs font-semibold bg-black/60 text-white backdrop-blur-sm">
                                {u.unit_number}
                              </span>
                            )}
                            <span className="absolute top-2 right-2">
                              <Badge style={{ backgroundColor: meta.bg, color: meta.color, border: 'none' }}>{meta.label}</Badge>
                            </span>
                          </div>
                          {/* เนื้อการ์ด */}
                          <div className="p-4">
                            <p className="text-xs text-gray-500 truncate">
                              {[u.unit_type || 'ยูนิต', u.area_sqm != null ? `${Number(u.area_sqm).toLocaleString()} ตร.ม.` : null].filter(Boolean).join(' · ')}
                            </p>
                            <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{u.price ? fmtCompact(Number(u.price)) : '–'}</p>
                            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap mt-3 text-xs text-gray-500 tabular-nums">
                              <span className="inline-flex items-center gap-1"><BedDouble className="w-3.5 h-3.5 text-gray-400" />{u.bedrooms ?? '–'}</span>
                              <span className="inline-flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-gray-400" />{u.bathrooms ?? '–'}</span>
                              <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5 text-gray-400" />{u.parking_spaces ?? '–'}</span>
                              <span className="inline-flex items-center gap-1"><Maximize className="w-3.5 h-3.5 text-gray-400" />{u.area_sqm != null ? Number(u.area_sqm).toLocaleString() : '–'}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {filteredUnits.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      แสดง {unitStart + 1}–{Math.min(unitStart + unitPageSize, filteredUnits.length)} จาก {filteredUnits.length} ยูนิต
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={unitSafePage <= 1} onClick={() => setUnitPage((p) => Math.max(1, p - 1))}>
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </Button>
                      {(() => {
                        const pages: number[] = [];
                        const to = Math.min(unitTotalPages, Math.max(1, unitSafePage - 2) + 4);
                        for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                        return pages.map((p) => (
                          <Button key={p} variant={p === unitSafePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === unitSafePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setUnitPage(p)}>{p}</Button>
                        ));
                      })()}
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={unitSafePage >= unitTotalPages} onClick={() => setUnitPage((p) => Math.min(unitTotalPages, p + 1))}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </OwnerGuard>
    );
  }

  // ════════════════════════════════════ L1 — one company ════════════════════
  if (tenantId) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const props = properties.filter((p) => p.tenant_id === tenantId);
    const tUnits = props.flatMap((p) => unitsByProject.get(p.id) || []);
    const roll = rollUp(tUnits);

    // ── "ปัจจัยการขาย" — descriptive profile (NOT proven cause). The factors we can
    // read from platform data: where, price band, type, unit size, sales-team size,
    // and how much has actually sold. External drivers (brand, marketing, economy)
    // are out of system, so this is context to eyeball — not a causal explanation.
    const provinces = Array.from(new Set(props.map((p) => p.address?.province).filter(Boolean))) as string[];
    const pricedUnits = tUnits.map((u) => Number(u.price) || 0).filter((n) => n > 0);
    const minP = pricedUnits.length ? Math.min(...pricedUnits) : 0;
    const maxP = pricedUnits.length ? Math.max(...pricedUnits) : 0;
    const areaVals = tUnits.map((u) => Number(u.area_sqm) || 0).filter((n) => n > 0);
    const avgArea = areaVals.length ? Math.round(areaVals.reduce((s, n) => s + n, 0) / areaVals.length) : 0;
    const typeCount = new Map<string, number>();
    tUnits.forEach((u) => { const t = u.unit_type || '–'; typeCount.set(t, (typeCount.get(t) || 0) + 1); });
    const topTypeRaw = Array.from(typeCount.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || '–';
    const TYPE_TH: Record<string, string> = { condo: 'คอนโด', single_house: 'บ้านเดี่ยว', twin_house: 'บ้านแฝด', townhome: 'ทาวน์โฮม', house: 'บ้าน' };
    const topType = TYPE_TH[topTypeRaw] || topTypeRaw;
    const sellThroughPct = roll.total ? Math.round((roll.sold / roll.total) * 100) : 0;
    const salesStaff = salesStaffByTenant[tenantId] || 0;
    const saleFactors = [
      { label: 'ทำเล', value: provinces.length ? (provinces.length === 1 ? provinces[0] : `${provinces.length} จังหวัด`) : '–', sub: provinces.length > 1 ? provinces.join(' · ') : 'ที่ตั้งโครงการ', icon: MapPin, color: KK.green },
      { label: 'ช่วงราคา', value: pricedUnits.length ? `${fmtCompact(minP)}–${fmtCompact(maxP)}` : '–', sub: 'ต่ำสุด–สูงสุด', icon: TrendingUp, color: KK.red },
      { label: 'ประเภทหลัก', value: topType, sub: 'ประเภทยูนิตที่มีมากสุด', icon: Home, color: KK.blue },
      { label: 'พื้นที่เฉลี่ย', value: avgArea ? `${avgArea.toLocaleString()} ตร.ม.` : '–', sub: 'ขนาดต่อยูนิต', icon: Maximize, color: KK.slate },
      { label: 'ทีมขาย', value: `${salesStaff} คน`, sub: 'พนักงานขาย/นายหน้าในระบบ', icon: Building2, color: KK.amber },
      { label: 'Sell-through', value: `${sellThroughPct}%`, sub: `ขายแล้ว ${roll.sold}/${roll.total} ยูนิต`, icon: Building, color: KK.green },
    ];

    const filtered = props
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.developer || '').toLowerCase().includes(search.toLowerCase()))
      .map((p) => ({ p, roll: rollUp(unitsByProject.get(p.id) || []) }))
      .sort((a, b) => b.roll.total - a.roll.total);

    // L1 project-grid pagination (12 cards / page).
    const projPageSize = 12;
    const projTotalPages = Math.max(1, Math.ceil(filtered.length / projPageSize));
    const projSafePage = Math.min(projPage, projTotalPages);
    const projStart = (projSafePage - 1) * projPageSize;
    const pagedProjects = filtered.slice(projStart, projStart + projPageSize);

    return (
      <OwnerGuard>
        <div className="min-h-screen bg-gray-50">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="lg:ml-[260px] min-h-screen">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <main className="p-6 lg:p-8 space-y-7">
              {/* Breadcrumb + back */}
              <div>
                <button onClick={() => navigate('/owner-projects')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3">
                  <ArrowLeft className="w-4 h-4" /> กลับไปทุกบริษัท
                </button>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  จัดการโครงการ
                </span>
                <h1 className="text-2xl font-bold text-gray-900">{tenant?.name || 'บริษัท'}</h1>
                <p className="text-sm text-gray-500 mt-1.5">{props.length} โครงการ · {roll.total} ยูนิต · แพ็กเกจ {planBadge(tenant?.subscription_plan || '')}</p>
              </div>

              {/* KPIs — usage + account size (Owner lens), no sales performance */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard title="โครงการ" value={props.length.toLocaleString()} sub="ทั้งหมดของบริษัท" icon={Building2} color={KK.blue} bg={KK.blueLight} />
                <KpiCard title="ยูนิตทั้งหมด" value={roll.total.toLocaleString()} sub="ในระบบของบริษัทนี้" icon={Home} color={KK.slate} bg={KK.slateLight} />
                <KpiCard title="โควต้าโครงการ" value={projectQuota(props.length, tenant?.subscription_plan || '').text} sub="โครงการที่ใช้ / ลิมิตแพ็กเกจ" icon={TrendingUp} color={KK.red} bg={KK.redLight} />
                <KpiCard title="ใช้งานล่าสุด" value={fmtRelative(roll.lastUpdated)} sub="อัปเดตข้อมูลครั้งล่าสุด" icon={Clock} color={KK.green} bg={KK.greenLight} />
              </div>

              {/* ปัจจัยการขาย — descriptive sales-factor profile for this company */}
              {tUnits.length > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                    <h2 className="text-base font-bold text-gray-900">ปัจจัยการขาย</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">โปรไฟล์ประกอบการพิจารณา — ปัจจัยภายในระบบ (ทำเล/ราคา/ประเภท/ทีมขาย) ไม่ใช่ข้อสรุปว่าขายดีเพราะปัจจัยใดปัจจัยหนึ่ง · แบรนด์/การตลาด/เศรษฐกิจ อยู่นอกระบบ</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {saleFactors.map((f) => (
                      <div key={f.label} className="rounded-xl bg-gray-50 p-3.5">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <f.icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: f.color }} />
                          <span className="text-xs font-medium text-gray-500">{f.label}</span>
                        </div>
                        <p className="text-base font-bold text-gray-900 tabular-nums leading-tight truncate" title={typeof f.value === 'string' ? f.value : undefined}>{f.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate" title={f.sub}>{f.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects grid */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">โครงการทั้งหมด</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่ารวม</p>
                  </div>
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input placeholder="ค้นหาโครงการ" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
                  </div>
                </div>
                {filtered.length === 0 ? (
                  <div className="text-center py-12">
                    <Building className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">ไม่พบโครงการ</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pagedProjects.map(({ p, roll: pr }) => {
                      const projLast = Math.max(pr.lastUpdated, toEpoch(p.updated_at));
                      return (
                        <div
                          key={p.id}
                          onClick={() => navigate(`/owner-projects/${tenantId}/${p.id}`)}
                          className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-soft cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 hover:border-gray-200 transition-all duration-200"
                        >
                          <div className="h-32 bg-gray-100 relative overflow-hidden">
                            {p.thumbnail_url ? (
                              <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center"><Building2 className="w-8 h-8 text-gray-300" /></div>
                            )}
                            <div className="absolute top-2 right-2">
                              <Badge style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: KK.slate }}>{pr.total} ยูนิต</Badge>
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900 truncate">{p.name}</p>
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1 truncate">
                                {p.address?.province ? <><MapPin className="w-3 h-3 flex-shrink-0" /> {p.address.province}</> : (p.developer || '–')}
                              </p>
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                              <span className="text-xs text-gray-400 flex items-center gap-1 pt-2">
                                <Clock className="w-3 h-3" /> {fmtRelative(projLast)}
                              </span>
                              <span className="text-xs font-medium flex items-center gap-0.5 pt-2" style={{ color: KK.red }}>
                                ดูยูนิต <ArrowUpRight className="w-3 h-3" />
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {filtered.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">
                      แสดง {projStart + 1}–{Math.min(projStart + projPageSize, filtered.length)} จาก {filtered.length} โครงการ
                    </span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={projSafePage <= 1} onClick={() => setProjPage((p) => Math.max(1, p - 1))}>
                        <ChevronRight className="w-4 h-4 rotate-180" />
                      </Button>
                      {(() => {
                        const pages: number[] = [];
                        const from = Math.max(1, projSafePage - 2);
                        const to = Math.min(projTotalPages, from + 4);
                        for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                        return pages.map((p) => (
                          <Button key={p} variant={p === projSafePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === projSafePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setProjPage(p)}>{p}</Button>
                        ));
                      })()}
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={projSafePage >= projTotalPages} onClick={() => setProjPage((p) => Math.min(projTotalPages, p + 1))}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </OwnerGuard>
    );
  }

  // ════════════════════════════════════ L0 — all companies ══════════════════
  const matchedTenants = tenantRows.filter((r) => !search || r.tenant.name.toLowerCase().includes(search.toLowerCase()));
  // Sort by the active column, then paginate the sorted list.
  const filteredTenants = [...matchedTenants].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'name') return a.tenant.name.localeCompare(b.tenant.name, 'th') * dir;
    if (sortKey === 'units') return (a.roll.total - b.roll.total) * dir;
    if (sortKey === 'lastActive') return (a.roll.lastUpdated - b.roll.lastUpdated) * dir;
    return (a.projectCount - b.projectCount) * dir; // 'projects'
  });
  const totalPages = Math.max(1, Math.ceil(filteredTenants.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedTenants = filteredTenants.slice(pageStart, pageStart + pageSize);

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            {/* Title */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                Platform
              </span>
              <h1 className="text-2xl font-bold text-gray-900">จัดการโครงการ</h1>
              <p className="text-sm text-gray-500 mt-1.5">ภาพรวมการใช้งานข้ามทุกบริษัท · เจาะเข้าบริษัท → โครงการ</p>
            </div>

            {/* KPIs — platform adoption (Owner lens): how many customers, how much
                they've built, who hasn't started, who's recently active. */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="บริษัททั้งหมด" value={platform.companyCount.toLocaleString()} sub="ที่ใช้ระบบอยู่" icon={Building2} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="โครงการทั้งหมด" value={platform.projectCount.toLocaleString()} sub="ทั่วทั้งแพลตฟอร์ม" icon={Building} color={KK.slate} bg={KK.slateLight} />
              <KpiCard title="ยังไม่เริ่มใช้งาน" value={platform.notStarted.toLocaleString()} sub="0 โครงการ · ควร onboard" icon={AlertTriangle} color={KK.amber} bg={KK.amberLight} />
              <KpiCard title="อัปเดตข้อมูลใน 7 วัน" value={String(platform.active7d)} sub={`จาก ${platform.companyCount} บริษัท · engagement`} icon={Clock} color={KK.green} bg={KK.greenLight} />
            </div>

            {/* Companies table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
                <div>
                  <h2 className="text-base font-bold text-gray-900">การใช้งานตามบริษัท</h2>
                  <p className="text-xs text-gray-500 mt-0.5">เรียงตามขนาดพอร์ต · คลิกเพื่อดูรายโครงการ</p>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input placeholder="ค้นหาบริษัท" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
                </div>
              </div>
              {filteredTenants.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm text-gray-500">ยังไม่มีบริษัทที่มีโครงการ</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="cursor-pointer select-none" onClick={() => toggleSort('name')}>
                          <span className="inline-flex items-center gap-1">
                            บริษัท
                            {sortKey === 'name'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead className="text-center">แพ็กเกจ</TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('projects')}>
                          <span className="inline-flex items-center justify-end gap-1 w-full">
                            โครงการ (ใช้/ลิมิต)
                            {sortKey === 'projects'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('units')}>
                          <span className="inline-flex items-center justify-end gap-1 w-full">
                            ยูนิต
                            {sortKey === 'units'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead className="text-right cursor-pointer select-none" onClick={() => toggleSort('lastActive')}>
                          <span className="inline-flex items-center justify-end gap-1 w-full">
                            ใช้งานล่าสุด
                            {sortKey === 'lastActive'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTenants.map(({ tenant, projectCount, roll }) => (
                        <TableRow key={tenant.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/owner-projects/${tenant.id}`)}>
                          <TableCell className="font-semibold text-gray-900">{tenant.name}</TableCell>
                          <TableCell className="text-center"><Badge variant="outline" className="capitalize">{planBadge(tenant.subscription_plan)}</Badge></TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span style={projectQuota(projectCount, tenant.subscription_plan).near ? { color: KK.amber, fontWeight: 600 } : undefined}>
                              {projectQuota(projectCount, tenant.subscription_plan).text}
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{roll.total}</TableCell>
                          <TableCell className="text-right text-gray-500 tabular-nums">{fmtRelative(roll.lastUpdated)}</TableCell>
                          <TableCell className="text-right"><ArrowUpRight className="w-4 h-4 text-gray-400 inline" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {filteredTenants.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filteredTenants.length)} จาก {filteredTenants.length} บริษัท</span>
                    <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                      <SelectTrigger className="h-8 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 / หน้า</SelectItem>
                        <SelectItem value="25">25 / หน้า</SelectItem>
                        <SelectItem value="50">50 / หน้า</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </Button>
                    {(() => {
                      const pages: number[] = [];
                      const from = Math.max(1, safePage - 2);
                      const to = Math.min(totalPages, from + 4);
                      for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                      return pages.map((p) => (
                        <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setCurrentPage(p)}>{p}</Button>
                      ));
                    })()}
                    <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerProjects;
