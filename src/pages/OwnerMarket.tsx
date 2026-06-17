import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { TrendingUp, Tag, Home, Banknote, BarChart3 } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// ภาพรวมตลาด — Owner cross-tenant market intelligence (HQ lens).
// Answers เฮีย's question: ช่วงราคาไหน / ประเภทไหน ขายดีที่สุดในแพลตฟอร์ม.
// Data: sold units (units.status='sold') across all customer tenants, joined to
// properties for the property type. Read-only via live Owner RLS; no migration.
// See documents/owner-hq-dashboard-plan.md.
// ──────────────────────────────────────────────────────────────────────────

// Palette + compact-money — identical tokens to OwnerDashboard/OwnerProjects.
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

// Property type enum (verified in DB) → Thai labels.
const TYPE_TH: Record<string, string> = {
  single_house: 'บ้านเดี่ยว',
  twin_house: 'บ้านแฝด',
  townhome: 'ทาวน์โฮม',
  condo: 'คอนโด',
};

// Price tiers (Thai real-estate convention).
const TIERS = [
  { label: 'ต่ำกว่า 3 ล้าน', min: 0, max: 3_000_000 },
  { label: '3–5 ล้าน', min: 3_000_000, max: 5_000_000 },
  { label: '5–10 ล้าน', min: 5_000_000, max: 10_000_000 },
  { label: '10–20 ล้าน', min: 10_000_000, max: 20_000_000 },
  { label: '20 ล้านขึ้นไป', min: 20_000_000, max: Infinity },
];
const DONUT_COLORS = [KK.blue, KK.red, KK.green, KK.amber, KK.slate];
const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const ymOf = (ts: string | null) => { if (!ts) return ''; const d = new Date(ts); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthLabelTH = (ym: string) => { const [y, m] = ym.split('-').map(Number); return `${THAI_MONTH[m - 1]} ${y + 543}`; };

interface UnitRow {
  tenant_id: string;
  project_id: string;
  price: number | null;
  status: string | null;
  sold_at: string | null;
  price_per_sqm: number | null;
}

const OwnerMarket = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [typeById, setTypeById] = useState<Record<string, string>>({});
  const [month, setMonth] = useState('all');

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
        const [uRes, pRes] = await Promise.all([
          supabase.from('units').select('tenant_id, project_id, price, status, sold_at, price_per_sqm').in('tenant_id', ids),
          supabase.from('properties').select('id, type').in('tenant_id', ids),
        ]);
        setUnits((uRes.data || []) as UnitRow[]);
        const map: Record<string, string> = {};
        (pRes.data || []).forEach((p: any) => { map[p.id] = p.type; });
        setTypeById(map);
      }
    } catch (e) {
      console.error('OwnerMarket fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const sold = useMemo(() => units.filter((u) => u.status === 'sold'), [units]);

  // Months that have sales — newest first, for the month filter.
  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    sold.forEach((u) => { const ym = ymOf(u.sold_at); if (ym) set.add(ym); });
    return Array.from(set).sort().reverse();
  }, [sold]);

  // KPI + price-tier + type views respect the month filter; the trend stays full 12-month.
  const view = useMemo(() => (month === 'all' ? sold : sold.filter((u) => ymOf(u.sold_at) === month)), [sold, month]);

  // Sold units bucketed by price tier — bar chart + "best tier" KPI.
  const tierData = useMemo(() => TIERS.map((t) => {
    const inTier = view.filter((u) => { const p = Number(u.price) || 0; return p >= t.min && p < t.max; });
    return { label: t.label, count: inTier.length, value: inTier.reduce((s, u) => s + (Number(u.price) || 0), 0) };
  }), [view]);

  // Sold units by property type — donut + "best type" KPI.
  const typeData = useMemo(() => {
    const m = new Map<string, number>();
    view.forEach((u) => { const ty = typeById[u.project_id] || 'unknown'; m.set(ty, (m.get(ty) || 0) + 1); });
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: TYPE_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [view, typeById]);

  // Sold units per month — last 12 months trend.
  const trendData = useMemo(() => {
    const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
    const out: { month: string; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      const next = new Date(base.getFullYear(), base.getMonth() - i + 1, 1);
      const count = sold.filter((u) => {
        if (!u.sold_at) return false;
        const t = new Date(u.sold_at);
        return t >= d && t < next;
      }).length;
      out.push({ month: THAI_MONTH[d.getMonth()], count });
    }
    return out;
  }, [sold]);

  const bestTier = useMemo(() => tierData.reduce((a, b) => (b.count > a.count ? b : a), tierData[0]), [tierData]);
  const bestType = typeData[0];
  const avgPpsqm = useMemo(() => {
    const arr = view.map((u) => Number(u.price_per_sqm) || 0).filter((v) => v > 0);
    return arr.length ? Math.round(arr.reduce((s, v) => s + v, 0) / arr.length) : 0;
  }, [view]);
  const avgUnitPrice = useMemo(() => (view.length ? Math.round(view.reduce((s, u) => s + (Number(u.price) || 0), 0) / view.length) : 0), [view]);

  // Reusable KPI card — same shape as OwnerProjects/OwnerDashboard.
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
      <p className="text-2xl font-bold text-gray-900 leading-none tracking-tight">{value}</p>
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
            {/* Title */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Analytics
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Sales Overview</h1>
                <p className="text-sm text-gray-500 mt-1.5">วิเคราะห์การขายข้ามทุกบริษัท · ช่วงราคา · ประเภททรัพย์ · แนวโน้ม</p>
              </div>
              {sold.length > 0 && (
                <select
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 mt-1 focus:outline-none focus:ring-2 focus:ring-red-100"
                >
                  <option value="all">ทุกเดือน</option>
                  {monthOptions.map((ym) => (
                    <option key={ym} value={ym}>{monthLabelTH(ym)}</option>
                  ))}
                </select>
              )}
            </div>

            {sold.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <BarChart3 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลการขายในแพลตฟอร์ม</p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="ราคาเฉลี่ยต่อยูนิต" value={fmtCompact(avgUnitPrice)} sub="เฉลี่ยต่อยูนิตที่ขายได้" icon={TrendingUp} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="ช่วงราคาขายดีสุด" value={bestTier?.label || '–'} sub={`${bestTier?.count || 0} ยูนิต`} icon={Tag} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="ประเภทขายดีสุด" value={bestType?.name || '–'} sub={`${bestType?.value || 0} ยูนิต`} icon={Home} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="ราคาเฉลี่ย/ตร.ม." value={fmtCompact(avgPpsqm)} sub="ของยูนิตที่ขายแล้ว" icon={Banknote} color={KK.amber} bg={KK.amberLight} />
                </div>

                {/* Price tiers (bar) + Type (donut) */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <h2 className="text-base font-bold text-gray-900">ยอดขายตามช่วงราคา</h2>
                    <p className="text-xs text-gray-500 mb-4 mt-0.5">จำนวนยูนิตที่ขายได้ในแต่ละช่วงราคา</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={tierData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip
                          contentStyle={kkTooltipStyle}
                          cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                          formatter={((v: any, _n: any, p: any) => [`${v} ยูนิต · ${fmtCompact(p?.payload?.value || 0)}`, 'ขายได้']) as any}
                        />
                        <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={KK.red} maxBarSize={64} animationDuration={900}>
                          {tierData.map((_, i) => <Cell key={i} fill={i === tierData.findIndex((t) => t.label === bestTier?.label) ? KK.red : '#fca5a5'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <h2 className="text-base font-bold text-gray-900">ยอดขายตามประเภท</h2>
                    <p className="text-xs text-gray-500 mb-2 mt-0.5">สัดส่วนยูนิตที่ขายได้</p>
                    <div className="relative" style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeData} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2} dataKey="value">
                            {typeData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                          <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [`${v} ยูนิต`, '']) as any} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <div className="text-2xl font-bold text-gray-900 tabular-nums">{view.length}</div>
                        <div className="text-xs text-gray-500">ขายแล้ว</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                      {typeData.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                          <span className="text-gray-600 flex-1">{item.name}</span>
                          <span className="font-semibold text-gray-800 tabular-nums">{item.value}</span>
                          <span className="text-gray-400 tabular-nums">({Math.round((item.value / (view.length || 1)) * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Monthly sold trend */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <h2 className="text-base font-bold text-gray-900">แนวโน้มยอดขาย</h2>
                  <p className="text-xs text-gray-500 mb-4 mt-0.5">จำนวนยูนิตที่ขายได้ · 12 เดือนล่าสุด</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="marketTrendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={KK.red} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [`${v} ยูนิต`, 'ขายได้']) as any} />
                      <Area type="monotone" dataKey="count" stroke={KK.red} strokeWidth={2.5} fill="url(#marketTrendGrad)" dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} animationDuration={1200} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerMarket;
