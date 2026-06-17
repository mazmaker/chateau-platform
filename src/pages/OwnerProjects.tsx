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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────
// Owner "จัดการโครงการ" (control-plane, read-only).
// Lens: Owner = SaaS PLATFORM owner, not a property seller. So this page
// answers ONLY platform questions — "how much is each customer USING the
// platform" (adoption/activity) and "how big is the account" (GDV) — NOT
// "how well does the tenant sell" (absorption/sell-through was deliberately
// cut; that's the tenant Admin's metric).
// Two drill levels: L0 all companies → L1 one company's projects. Drilling
// into individual UNITS was removed on purpose — inspecting unit price/specs
// is application-plane (Admin) work, not the Owner's.
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
  unit_type: string | null;
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

const OwnerProjects = () => {
  const navigate = useNavigate();
  const { tenantId } = useParams();
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

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [tRes, pRes, uRes, planRes] = await Promise.all([
        supabase.from('tenants').select('id, name, status, subscription_plan').eq('is_platform' as any, false),
        supabase.from('properties').select('id, tenant_id, name, developer, base_price, address, thumbnail_url, is_active, updated_at'),
        supabase.from('units').select('id, tenant_id, project_id, price, status, area_sqm, unit_number, floor_number, building, bedrooms, bathrooms, unit_type, updated_at'),
        (supabase as any).from('plans').select('id, max_properties'),
      ]);
      setTenants((tRes.data || []) as Tenant[]);
      setProperties((pRes.data || []) as Property[]);
      setUnits((uRes.data || []) as Unit[]);
      if (planRes.data) setPlanLimits(Object.fromEntries((planRes.data as any[]).map((p) => [p.id, p.max_properties])));
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
    return { roll, projectCount, companyCount: tenantRows.length, active7d };
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

  // ════════════════════════════════════ L1 — one company ════════════════════
  if (tenantId) {
    const tenant = tenants.find((t) => t.id === tenantId);
    const props = properties.filter((p) => p.tenant_id === tenantId);
    const tUnits = props.flatMap((p) => unitsByProject.get(p.id) || []);
    const roll = rollUp(tUnits);
    const filtered = props
      .filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()) || (p.developer || '').toLowerCase().includes(search.toLowerCase()))
      .map((p) => ({ p, roll: rollUp(unitsByProject.get(p.id) || []) }))
      .sort((a, b) => b.roll.total - a.roll.total);

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
                    {filtered.map(({ p, roll: pr }) => {
                      const projLast = Math.max(pr.lastUpdated, toEpoch(p.updated_at));
                      return (
                        <div
                          key={p.id}
                          className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-soft"
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
                            <div className="flex items-center pt-1 border-t border-gray-50">
                              <span className="text-xs text-gray-400 flex items-center gap-1 pt-2">
                                <Clock className="w-3 h-3" /> {fmtRelative(projLast)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
  const filteredTenants = tenantRows.filter((r) => !search || r.tenant.name.toLowerCase().includes(search.toLowerCase()));
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

            {/* KPIs — platform usage + scale (Owner lens) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="บริษัทที่มีโครงการ" value={platform.companyCount.toLocaleString()} sub={`จาก ${tenants.length} บริษัท`} icon={Building2} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="โครงการทั้งหมด" value={platform.projectCount.toLocaleString()} sub="ทั่วทั้งแพลตฟอร์ม" icon={Building} color={KK.slate} bg={KK.slateLight} />
              <KpiCard title="ยูนิตทั้งหมด" value={platform.roll.total.toLocaleString()} sub="ยูนิตที่ลูกค้าสร้างในระบบ" icon={Home} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="ใช้งานใน 7 วัน" value={String(platform.active7d)} sub={`จาก ${platform.companyCount} บริษัทที่มีข้อมูล · engagement`} icon={Clock} color={KK.red} bg={KK.redLight} />
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
                        <TableHead>บริษัท</TableHead>
                        <TableHead className="text-center">แพ็กเกจ</TableHead>
                        <TableHead className="text-right">โครงการ (ใช้/ลิมิต)</TableHead>
                        <TableHead className="text-right">ยูนิต</TableHead>
                        <TableHead className="text-right">ใช้งานล่าสุด</TableHead>
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
