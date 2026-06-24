import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import TenantCombobox from '@/components/owner/TenantCombobox';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Layers, Home, Percent, Timer, Gauge, ChevronRight } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';

// ──────────────────────────────────────────────────────────────────────────
// Inventory & Absorption — Owner cross-tenant supply health (real-estate KPI).
// Sell-through, status mix, aging (unsold inventory), absorption velocity.
// Data: units + properties.type across all tenants. Read-only / Owner RLS.
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

const TYPE_TH: Record<string, string> = {
  single_house: 'บ้านเดี่ยว', twin_house: 'บ้านแฝด', townhome: 'ทาวน์โฮม', condo: 'คอนโด',
};
const STATUS_TH: Record<string, string> = { available: 'ว่าง', reserved: 'จองแล้ว', sold: 'ขายแล้ว' };
const STATUS_COLOR: Record<string, string> = { available: KK.blue, reserved: KK.amber, sold: KK.green };
const AGE_BANDS = [
  { label: '0–3 ด.', min: 0, max: 3 },
  { label: '3–6 ด.', min: 3, max: 6 },
  { label: '6–12 ด.', min: 6, max: 12 },
  { label: '12+ ด.', min: 12, max: 9999 },
];

// Compact Thai money — "X ล้าน" / "฿XK" (never M/B), same basis as sibling pages.
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
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

interface UnitRow { tenant_id: string; project_id: string; status: string | null; price: number | null; created_at: string | null; sold_at: string | null; }

const monthsSince = (ts: string | null) => {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / (1000 * 60 * 60 * 24 * 30));
};

const OwnerInventory = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [typeById, setTypeById] = useState<Record<string, string>>({});
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('all');
  const [typeModal, setTypeModal] = useState<string | null>(null); // raw property type key
  const [bandModal, setBandModal] = useState<string | null>(null); // aging band label
  const [statusModal, setStatusModal] = useState<string | null>(null); // raw status key

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
        const [uRes, pRes] = await Promise.all([
          supabase.from('units').select('tenant_id, project_id, status, price, created_at, sold_at').in('tenant_id', ids),
          supabase.from('properties').select('id, type').in('tenant_id', ids),
        ]);
        setUnits((uRes.data || []) as UnitRow[]);
        const m: Record<string, string> = {};
        (pRes.data || []).forEach((p: any) => { m[p.id] = p.type; });
        setTypeById(m);
      }
    } catch (e) {
      console.error('OwnerInventory fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Scope raw units to the selected company before any aggregate is computed.
  const scopedUnits = useMemo(
    () => (tenantFilter === 'all' ? units : units.filter((u) => u.tenant_id === tenantFilter)),
    [units, tenantFilter],
  );

  const kpis = useMemo(() => {
    const total = scopedUnits.length;
    const sold = scopedUnits.filter((u) => u.status === 'sold').length;
    const available = scopedUnits.filter((u) => u.status === 'available').length;
    // absorption = sold in the last 90 days → monthly pace → months to clear remaining stock
    const recent = scopedUnits.filter((u) => u.status === 'sold' && u.sold_at && monthsSince(u.sold_at) < 3).length;
    const monthsToClear = recent > 0 ? Math.round((available / (recent / 3)) * 10) / 10 : null;
    return { total, sold, available, sellThrough: total ? Math.round((sold / total) * 100) : 0, recent, monthsToClear };
  }, [scopedUnits]);

  const statusData = useMemo(() => {
    const m = new Map<string, number>();
    scopedUnits.forEach((u) => { const s = u.status || 'available'; m.set(s, (m.get(s) || 0) + 1); });
    return ['available', 'reserved', 'sold'].filter((s) => m.has(s)).map((s) => ({ status: s, name: STATUS_TH[s] || s, value: m.get(s) || 0, color: STATUS_COLOR[s] }));
  }, [scopedUnits]);

  // Aging: available units bucketed by months since created.
  const agingData = useMemo(() => AGE_BANDS.map((b) => ({
    label: b.label,
    count: scopedUnits.filter((u) => u.status === 'available' && (() => { const mo = monthsSince(u.created_at); return mo >= b.min && mo < b.max; })()).length,
  })), [scopedUnits]);

  // Sell-through by property type.
  const typeData = useMemo(() => {
    const agg = new Map<string, { sold: number; total: number }>();
    scopedUnits.forEach((u) => {
      const ty = typeById[u.project_id] || 'other';
      const r = agg.get(ty) || { sold: 0, total: 0 };
      r.total += 1; if (u.status === 'sold') r.sold += 1;
      agg.set(ty, r);
    });
    return Array.from(agg.entries())
      .map(([k, v]) => ({ key: k, label: TYPE_TH[k] || k, pct: v.total ? Math.round((v.sold / v.total) * 100) : 0, sold: v.sold, total: v.total }))
      .sort((a, b) => b.pct - a.pct);
  }, [scopedUnits, typeById]);

  // Drill: per-company stock for the clicked property type (sold / total / sell-through).
  const tenantNameById = useMemo(() => new Map(tenantList.map((t) => [t.id, t.name])), [tenantList]);
  const companiesInType = useMemo(() => {
    if (!typeModal) return [] as { id: string; name: string; sold: number; total: number; pct: number }[];
    const m = new Map<string, { sold: number; total: number }>();
    scopedUnits.forEach((u) => {
      if ((typeById[u.project_id] || 'other') !== typeModal) return;
      const r = m.get(u.tenant_id) || { sold: 0, total: 0 };
      r.total += 1; if (u.status === 'sold') r.sold += 1; m.set(u.tenant_id, r);
    });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', sold: v.sold, total: v.total, pct: v.total ? Math.round((v.sold / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [typeModal, scopedUnits, typeById, tenantNameById]);

  // Drill: which companies hold the stale stock in the clicked aging band (count + ฿ tied up).
  const companiesInBand = useMemo(() => {
    if (!bandModal) return [] as { id: string; name: string; count: number; value: number }[];
    const band = AGE_BANDS.find((b) => b.label === bandModal);
    if (!band) return [];
    const m = new Map<string, { count: number; value: number }>();
    scopedUnits.forEach((u) => {
      if (u.status !== 'available') return;
      const mo = monthsSince(u.created_at);
      if (mo >= band.min && mo < band.max) {
        const r = m.get(u.tenant_id) || { count: 0, value: 0 };
        r.count += 1; r.value += Number(u.price) || 0; m.set(u.tenant_id, r);
      }
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', ...v })).sort((a, b) => b.count - a.count);
  }, [bandModal, scopedUnits, tenantNameById]);

  // Drill: which companies hold units of the clicked status (ว่าง / จอง / ขายแล้ว).
  const companiesInStatus = useMemo(() => {
    if (!statusModal) return [] as { id: string; name: string; count: number; value: number }[];
    const m = new Map<string, { count: number; value: number }>();
    scopedUnits.forEach((u) => {
      if ((u.status || 'available') !== statusModal) return;
      const r = m.get(u.tenant_id) || { count: 0, value: 0 };
      r.count += 1; r.value += Number(u.price) || 0; m.set(u.tenant_id, r);
    });
    return Array.from(m.entries()).map(([id, v]) => ({ id, name: tenantNameById.get(id) || '–', ...v })).sort((a, b) => b.count - a.count);
  }, [statusModal, scopedUnits, tenantNameById]);

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
      <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
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
                <h1 className="text-2xl font-bold text-gray-900">Inventory &amp; Absorption</h1>
                <p className="text-sm text-gray-500 mt-1.5">สุขภาพสต็อกข้ามทุกบริษัท · ขายเร็ว-ช้า · ยูนิตค้างสต็อก</p>
              </div>
              <TenantCombobox value={tenantFilter} onChange={setTenantFilter} options={tenantList} className="w-[200px] mt-1" />
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="ยูนิตทั้งหมด" value={kpis.total.toLocaleString()} sub="ข้ามทุกบริษัท" icon={Layers} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="Sell-through" value={`${kpis.sellThrough}%`} sub={`ขายแล้ว ${kpis.sold} ยูนิต`} icon={Percent} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="ยูนิตว่าง" value={kpis.available.toLocaleString()} sub="พร้อมขาย" icon={Home} color={KK.amber} bg={KK.amberLight} />
              <KpiCard title="ขายหมดในกี่เดือน" value={kpis.monthsToClear !== null ? `${kpis.monthsToClear} เดือน` : '—'} sub={kpis.monthsToClear !== null ? `อิงขายได้ ${kpis.recent} ยูนิต/90 วัน` : 'ยังไม่มีขายใน 90 วัน'} icon={Gauge} color={KK.red} bg={KK.redLight} />
            </div>

            {/* Status donut + Aging bar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <h2 className="text-base font-bold text-gray-900">สถานะยูนิต</h2>
                <p className="text-xs text-gray-500 mb-2 mt-0.5">สัดส่วน ว่าง / จอง / ขายแล้ว · <span style={{ color: KK.red }}>กดเพื่อดูบริษัท</span></p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div className="relative h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={56} outerRadius={86} paddingAngle={2} stroke="white" strokeWidth={2}
                          onClick={(d: any) => { const k = d?.status || d?.payload?.status; if (k) setStatusModal(k); }}>
                          {statusData.map((d, i) => <Cell key={i} fill={d.color} cursor="pointer" />)}
                        </Pie>
                        <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} ยูนิต`, n]) as any} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-2xl font-bold text-gray-900 tabular-nums">{kpis.total}</div>
                      <div className="text-xs text-gray-500">ยูนิต</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {statusData.map((d, i) => (
                      <button key={i} type="button" onClick={() => setStatusModal(d.status)}
                        className="flex items-center gap-2 text-sm w-full text-left rounded px-1.5 py-1 hover:bg-gray-50 transition-colors">
                        <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                        <span className="text-gray-600 flex-1">{d.name}</span>
                        <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                        <span className="text-gray-400 tabular-nums w-9 text-right">{kpis.total ? Math.round((d.value / kpis.total) * 100) : 0}%</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                <div className="flex items-center gap-2">
                  <Timer className="w-4 h-4 text-gray-400" />
                  <h2 className="text-base font-bold text-gray-900">ยูนิตค้างสต็อก (Aging)</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4 mt-0.5">ยูนิตที่ยังว่าง · ระยะเวลาตั้งแต่เปิดขาย · <span style={{ color: KK.red }}>คลิกแท่งเพื่อดูบริษัท</span></p>
                {/* Chart fills the card so it matches the (taller, legend-bearing) status-donut card. */}
                <div className="flex-1 min-h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={agingData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={((v: any) => [`${v} ยูนิต`, 'ค้าง']) as any} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={800}
                        cursor="pointer" onClick={(d: any) => d?.label && setBandModal(d.label)}>
                        {agingData.map((_, i) => <Cell key={i} fill={i >= 2 ? KK.red : '#fca5a5'} cursor="pointer" />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Sell-through by type */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <h2 className="text-base font-bold text-gray-900">อัตราระบายตามประเภท</h2>
              <p className="text-xs text-gray-500 mb-4 mt-0.5">ประเภทไหนขายออกเร็วสุด · % ที่ระบายแล้ว (sell-through) · <span style={{ color: KK.red }}>คลิกเพื่อดูบริษัท</span></p>
              <div className="space-y-3">
                {typeData.map((t) => (
                  <button key={t.key} onClick={() => setTypeModal(t.key)} className="w-full text-left rounded-lg -mx-1 px-1 py-1 hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium group-hover:text-gray-900">{t.label}</span>
                      <span className="tabular-nums text-gray-500">{t.sold}/{t.total} <span className="text-gray-400">· {t.pct}%</span></span>
                    </div>
                    <div className="h-6 rounded-lg bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-lg transition-all duration-700"
                        style={{ width: `${Math.max(t.pct, 2)}%`, background: `linear-gradient(90deg, ${KK.green} 0%, #4ade80 100%)` }} />
                    </div>
                  </button>
                ))}
                {typeData.length === 0 && <p className="text-center text-sm text-gray-400 py-6">ยังไม่มีข้อมูลยูนิต</p>}
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* Drill: per-company stock for the clicked property type */}
      <Dialog open={!!typeModal} onOpenChange={(o) => !o && setTypeModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{typeModal ? (TYPE_TH[typeModal] || typeModal) : ''} · รายบริษัท</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-4">Sell-through ของแต่ละบริษัท · เรียงตามจำนวนยูนิต</p>
          {companiesInType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {companiesInType.map((c) => (
                <button key={c.id} onClick={() => { setTypeModal(null); navigate(`/owner-projects/${c.id}`); }}
                  className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-800 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{c.sold}/{c.total}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: KK.green }}>{c.pct}%</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drill: companies holding the stale stock in the clicked aging band */}
      <Dialog open={!!bandModal} onOpenChange={(o) => !o && setBandModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>ยูนิตค้าง {bandModal} · รายบริษัท</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-4">ยูนิตว่างที่ค้างในช่วงอายุนี้ · มูลค่าที่จมอยู่ · เรียงตามจำนวน</p>
          {companiesInBand.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ไม่มียูนิตค้างในช่วงนี้</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {companiesInBand.map((c) => (
                <button key={c.id} onClick={() => { setBandModal(null); navigate(`/owner-projects/${c.id}`); }}
                  className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-800 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{c.count} ยูนิต</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: KK.red }}>{fmtCompact(c.value)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Drill: companies by the clicked unit status */}
      <Dialog open={!!statusModal} onOpenChange={(o) => !o && setStatusModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{statusModal ? (STATUS_TH[statusModal] || statusModal) : ''} · รายบริษัท</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-gray-400 -mt-1 mb-4">จำนวนยูนิต · มูลค่ารวม · เรียงตามจำนวน</p>
          {companiesInStatus.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล</p>
          ) : (
            <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
              {companiesInStatus.map((c) => (
                <button key={c.id} onClick={() => { setStatusModal(null); navigate(`/owner-projects/${c.id}`); }}
                  className="w-full flex items-center gap-3 text-left rounded-lg px-2 py-2 hover:bg-gray-50 transition-colors">
                  <span className="text-sm text-gray-800 flex-1 truncate">{c.name}</span>
                  <span className="text-xs text-gray-400 tabular-nums">{c.count} ยูนิต</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: STATUS_COLOR[statusModal || 'available'] }}>{fmtCompact(c.value)}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </OwnerGuard>
  );
};

export default OwnerInventory;
