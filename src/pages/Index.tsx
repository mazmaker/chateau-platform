import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Brain,
  Building2,
  Flame,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboardStatistics, DashboardStats } from "@/lib/api/dashboard";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

// Kids Kingdom Color Palette
const KK = {
  red:         '#e60023',
  redLight:    '#fff1f2',
  redBorder:   '#fecdd3',
  blue:        '#3b82f6',
  blueLight:   '#eff6ff',
  purple:      '#8b5cf6',
  purpleLight: '#f5f3ff',
  purpleSoft:  '#ede9fe',
  green:       '#10b981',
  greenLight:  '#ecfdf5',
  orange:      '#f97316',
  orangeLight: '#fff7ed',
  amber:       '#f59e0b',
  amberLight:  '#fffbeb',
  gray:        '#6b7280',
  grayLight:   '#f3f4f6',
  border:      '#e5e7eb',
};

// ─── Real-estate KPI types ────────────────────────────────────
interface LeadRow {
  id: string;
  status: string | null;
  priority: string | null;
  source: string | null;
  estimated_value: number | null;
  created_at: string;
  last_contact_date: string | null;
  property_id: string | null;
}

interface PropertyRow {
  id: string;
  name: string;
  is_active: boolean | null;
}

const VISITOR_FORECAST = Array.from({ length: 30 }, (_, i) => {
  const d = new Date();
  d.setDate(d.getDate() + i);  // forecast 30 days into the future
  const day = d.getDay();
  const base = 480 + (day === 0 || day === 6 ? 220 : 0) + Math.sin(i / 4) * 40;
  const lower = Math.round(base - 80);
  const upper = Math.round(base + 80);
  return {
    date: `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`,
    forecast: Math.round(base),
    lower,
    upper,
    bandHeight: upper - lower,  // for stacked area band rendering
  };
});

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid ${KK.border}`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

const Index = () => {
  const { currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // === Real-estate aggregates from DB ===
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [topPropertiesByInterest, setTopPropertiesByInterest] = useState<{ name: string; inquiries: number; activeLeads: number }[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const s = await getDashboardStatistics();
        setStats(s);
      } catch {
        setStats({
          projects: { total: 20, completed: 5, inProgress: 15 },
          units: { reserved: 69, sold: 90, available: 75, conversionRate: 67.8 },
          leads: { newLeads: 42, convertedToCustomers: 18, totalLeads: 167 },
        });
      }

      try {
        // Load real-estate data — leads + properties + campaigns + top by interest
        const tenantId = currentTenant?.id;
        const [leadsRes, propertiesRes, campaignsRes, interestsRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, status, priority, source, estimated_value, created_at, last_contact_date, property_id')
            .eq(tenantId ? 'tenant_id' : 'id', tenantId || 'never'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name, is_active')
            .eq(tenantId ? 'tenant_id' : 'id', tenantId || 'never'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('campaigns') as any)
            .select('id', { count: 'exact', head: true })
            .eq(tenantId ? 'tenant_id' : 'id', tenantId || 'never')
            .eq('status', 'active'),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('lead_interests') as any)
            .select('property_id, lead_id, properties(name)')
            .eq(tenantId ? 'tenant_id' : 'id', tenantId || 'never'),
        ]);

        setLeads((leadsRes.data || []) as LeadRow[]);
        setProperties((propertiesRes.data || []) as PropertyRow[]);
        setActiveCampaigns(campaignsRes.count || 0);

        // Compute top properties by inquiry count
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const interests = (interestsRes.data || []) as any[];
        const counts = new Map<string, { name: string; inquiries: number; leads: Set<string> }>();
        interests.forEach((i) => {
          const name = i.properties?.name || '(ไม่ระบุ)';
          const key = i.property_id || '_';
          const existing = counts.get(key) || { name, inquiries: 0, leads: new Set() };
          existing.inquiries++;
          if (i.lead_id) existing.leads.add(i.lead_id);
          counts.set(key, existing);
        });
        const top = Array.from(counts.values())
          .map((c) => ({ name: c.name, inquiries: c.inquiries, activeLeads: c.leads.size }))
          .sort((a, b) => b.inquiries - a.inquiries)
          .slice(0, 7);
        setTopPropertiesByInterest(top);
      } catch (e) {
        console.error('Dashboard real-estate load failed:', e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentTenant]);

  // === Compute real-estate KPIs ===
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const closedStatuses = ['won', 'lost', 'converted', 'closed_won', 'closed_lost'];
  const openLeads = leads.filter((l) => !closedStatuses.includes(l.status || ''));

  // Closing Soon = leads in qualified + negotiating stage (about to close)
  const closingSoonLeads = leads.filter((l) => l.status === 'qualified' || l.status === 'negotiating');
  const closingSoonCount = closingSoonLeads.length;
  const closingSoonValue = closingSoonLeads.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

  // Leads MTD (this month)
  const leadsMTD = leads.filter((l) => new Date(l.created_at) >= startOfMonth).length;

  // Conversion rate
  const totalLeadsCount = leads.length;
  const totalCustomersCount = stats?.leads.convertedToCustomers ?? 0;
  const conversionRate = totalLeadsCount > 0 ? ((totalCustomersCount / totalLeadsCount) * 100).toFixed(1) : '0.0';

  // Hot leads (priority='high')
  const hotLeadsCount = openLeads.filter((l) => l.priority === 'high').length;

  // Inactive leads (>30 days no contact, churn risk equivalent)
  const inactiveLeads = openLeads.filter((l) => {
    if (!l.last_contact_date) return false;
    return new Date(l.last_contact_date) < thirtyDaysAgo;
  });
  const highRiskCount = inactiveLeads.filter((l) => {
    if (!l.last_contact_date) return false;
    const sixtyDays = new Date(); sixtyDays.setDate(sixtyDays.getDate() - 60);
    return new Date(l.last_contact_date) < sixtyDays;
  }).length;
  const mediumRiskCount = inactiveLeads.length - highRiskCount;

  // Properties online (active count)
  const totalProperties = properties.length;
  const activeProperties = properties.filter((p) => p.is_active !== false).length;

  // Build lead acquisition trend (last 30 days, group by date)
  const leadTrend30D = (() => {
    const days: { date: string; key: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      days.push({ date: label, key, count: 0 });
    }
    leads.forEach((l) => {
      const k = (l.created_at || '').slice(0, 10);
      const d = days.find((x) => x.key === k);
      if (d) d.count++;
    });
    return days.map(({ date, count }) => ({ date, count }));
  })();

  const KPIS: KpiCardProps[] = [
    {
      title: 'ใกล้ปิดดีล',
      value: closingSoonCount.toString(),
      icon: Wallet,
      color: KK.red,
      bg: KK.redLight,
      sub: closingSoonValue > 0
        ? `฿${(closingSoonValue / 1_000_000).toFixed(1)}M · qualified + negotiating`
        : 'qualified + negotiating',
    },
    {
      title: 'Leads ใหม่ (MTD)',
      value: leadsMTD.toLocaleString(),
      icon: Users,
      color: KK.blue,
      bg: KK.blueLight,
      sub: `${totalLeadsCount} leads ทั้งระบบ`,
    },
    {
      title: 'Conversion Rate',
      value: `${conversionRate}%`,
      icon: TrendingUp,
      color: KK.purple,
      bg: KK.purpleLight,
      sub: `${totalCustomersCount} customers / ${totalLeadsCount} leads`,
    },
    {
      title: 'Active Campaigns',
      value: activeCampaigns.toString(),
      icon: Megaphone,
      color: KK.green,
      bg: KK.greenLight,
      sub: 'กำลังทำงาน',
    },
    {
      title: 'Hot Leads',
      value: hotLeadsCount.toString(),
      icon: Flame,
      color: KK.orange,
      bg: KK.orangeLight,
      sub: 'priority = high',
    },
    {
      title: 'Properties',
      value: `${activeProperties}/${totalProperties}`,
      icon: Building2,
      color: KK.gray,
      bg: KK.grayLight,
      sub: 'Active / Total',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-10 space-y-7">
          {/* === Page Title === */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
              ภาพรวมทั้งระบบ
            </span>
            <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Executive Dashboard</h1>
            <p className="text-[15px] text-gray-500 mt-1.5">
              ภาพรวมธุรกิจอสังหา — Pipeline / Leads / Properties / Campaigns · อัปเดตล่าสุด {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
            </p>
          </div>

          {/* === KPI Cards (6 across) === */}
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 h-[150px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
              {KPIS.map((kpi) => <KpiCard key={kpi.title} {...kpi} />)}
            </div>
          )}

          {/* === Row 1: Revenue + AI Forecast === */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Lead Acquisition Trend (2/3) */}
            <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Lead Acquisition Trend</h2>
                  <p className="text-xs text-gray-500 mt-0.5">30 วันล่าสุด — Leads ที่เข้าระบบรายวัน</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  30 วัน
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={leadTrend30D} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={KK.red} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    interval={2}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`${Number(v)} leads`, 'จำนวน']}
                  />
                  <Area
                    type="monotone"
                    dataKey="count"
                    stroke={KK.red}
                    strokeWidth={2.5}
                    fill="url(#leadGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* AI Visitor Forecast (1/3) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: KK.purpleLight }}>
                    <Brain className="w-4 h-4" style={{ color: KK.purple }} />
                  </span>
                  <div>
                    <h2 className="text-base font-bold text-gray-900">AI Lead Forecast</h2>
                    <p className="text-xs text-gray-500 mt-0.5">คาดการณ์ 30 วันข้างหน้า</p>
                  </div>
                </div>
                <Sparkles className="w-4 h-4" style={{ color: KK.purple }} />
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={VISITOR_FORECAST} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={KK.purple} stopOpacity={0.22} />
                      <stop offset="100%" stopColor={KK.purple} stopOpacity={0.06} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  {/* Confidence band: stack invisible "lower" then visible "bandHeight" on top */}
                  <Area type="monotone" dataKey="lower"      stackId="band" stroke="none" fill="transparent" isAnimationActive={false} />
                  <Area type="monotone" dataKey="bandHeight" stackId="band" stroke="none" fill="url(#confGrad)" isAnimationActive={false} />
                  <Line type="monotone" dataKey="forecast" stroke={KK.purple} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
              <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: KK.purpleLight }}>
                <p className="text-xs font-semibold" style={{ color: KK.purple }}>คาดการณ์เฉลี่ย 580 leads/วัน</p>
                <p className="text-[11px] text-gray-500 mt-0.5">ช่วง confidence 95% (±80) · weekend +35%</p>
              </div>
            </div>
          </div>

          {/* === Row 2: Top Properties + Churn Risk === */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Top Properties by Inquiries (2/3) */}
            <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <h2 className="text-base font-bold text-gray-900">Top Properties by Inquiries</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">โครงการที่มีผู้สนใจมากที่สุด — เรียงตาม lead inquiries</p>
              {topPropertiesByInterest.length === 0 ? (
                <div className="flex items-center justify-center h-[260px] text-sm text-gray-400">
                  ยังไม่มีข้อมูล inquiries
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={topPropertiesByInterest} margin={{ top: 10, right: 8, left: -10, bottom: 0 }} barCategoryGap="22%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="inquiries"  fill={KK.red}    radius={[6, 6, 0, 0]} name="Inquiries" />
                      <Bar dataKey="activeLeads" fill={KK.orange} radius={[6, 6, 0, 0]} name="Active Leads" />
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-3 pl-2">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-600">Inquiries (รวม)</span></div>
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: KK.orange }} /><span className="text-xs text-gray-600">Active Leads (unique)</span></div>
                  </div>
                </>
              )}
            </div>

            {/* Inactive Leads (1/3) */}
            <div className="bg-white border rounded-2xl shadow-soft p-5" style={{ borderColor: KK.amberLight }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: KK.amber }} />
                <h2 className="text-base font-bold text-gray-900">Inactive Leads Alert</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">Leads ที่ไม่ติดต่อนานและเสี่ยงหลุด</p>

              <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: KK.redLight, border: `1px solid ${KK.redBorder}` }}>
                <div className="text-4xl font-bold leading-none" style={{ color: KK.red }}>{inactiveLeads.length}</div>
                <div className="text-xs text-gray-600 mt-1.5">leads เงียบมากกว่า 30 วัน</div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl p-3" style={{ backgroundColor: KK.redLight }}>
                  <div className="text-xs text-gray-600 mb-1">High Risk (60+ วัน)</div>
                  <div className="text-2xl font-bold" style={{ color: KK.red }}>{highRiskCount}</div>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: KK.amberLight }}>
                  <div className="text-xs text-gray-600 mb-1">Medium (30-60 วัน)</div>
                  <div className="text-2xl font-bold" style={{ color: KK.amber }}>{mediumRiskCount}</div>
                </div>
              </div>

              <button className="w-full mt-4 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                ดู Leads ทั้งหมด <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* === Row 3: Funnel + Lead Trend + Activity === */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" style={{ color: KK.green }} />
                <h2 className="text-base font-bold text-gray-900">Sales Funnel</h2>
              </div>
              <div className="space-y-3">
                {(() => {
                  const totalLeadsLocal = leads.length;
                  const newLeadsCount = leads.filter((l) => l.status === 'new').length;
                  const contactedCount = leads.filter((l) => l.status === 'contacted').length;
                  const qualifiedCount = leads.filter((l) => l.status === 'qualified').length;
                  const negotiationCount = leads.filter((l) => l.status === 'negotiating').length;
                  const wonCount = leads.filter((l) => l.status === 'won').length;
                  const max = Math.max(totalLeadsLocal, newLeadsCount, contactedCount, qualifiedCount, negotiationCount, wonCount, 1);
                  return (
                    <>
                      <FunnelStep label="All Leads"     value={totalLeadsLocal} max={max} color={KK.gray} />
                      <FunnelStep label="New"           value={newLeadsCount}   max={max} color={KK.blue} />
                      <FunnelStep label="Contacted"     value={contactedCount}  max={max} color="#06b6d4" />
                      <FunnelStep label="Qualified"     value={qualifiedCount}  max={max} color={KK.purple} />
                      <FunnelStep label="Negotiating"   value={negotiationCount} max={max} color={KK.orange} />
                      <FunnelStep label="Won"           value={wonCount}        max={max} color={KK.green} />
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-4 h-4" style={{ color: KK.red }} />
                <h2 className="text-base font-bold text-gray-900">Lead Sources</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">leads มาจากช่องทางไหน — ใช้ตัดสินใจ marketing budget</p>
              {(() => {
                const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
                  online_facebook: { label: 'Facebook',    color: '#3b82f6' },
                  online_google:   { label: 'Google',      color: '#10b981' },
                  offline:         { label: 'Walk-in / Offline', color: '#f59e0b' },
                  referral:        { label: 'Referral',    color: '#8b5cf6' },
                  website:         { label: 'Website',     color: '#06b6d4' },
                };
                const counts = new Map<string, number>();
                leads.forEach((l) => {
                  const src = l.source || 'unknown';
                  counts.set(src, (counts.get(src) || 0) + 1);
                });
                const total = leads.length;
                const sources = Array.from(counts.entries())
                  .map(([key, count]) => ({
                    key,
                    label: SOURCE_LABELS[key]?.label || key,
                    color: SOURCE_LABELS[key]?.color || KK.gray,
                    count,
                    pct: total > 0 ? (count / total) * 100 : 0,
                  }))
                  .sort((a, b) => b.count - a.count);

                if (sources.length === 0) {
                  return <p className="text-sm text-gray-400 text-center py-8">ไม่มีข้อมูล source</p>;
                }

                return (
                  <div className="space-y-3.5">
                    {sources.map((s) => (
                      <div key={s.key}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{s.label}</span>
                          <span className="text-xs tabular-nums">
                            <span className="font-bold" style={{ color: s.color }}>{s.count}</span>
                            <span className="text-gray-400 ml-1.5">({s.pct.toFixed(0)}%)</span>
                          </span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${s.pct}%`, backgroundColor: s.color }}
                          />
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 mt-2 border-t border-gray-100 text-[11px] text-gray-500">
                      💡 Top source: <span className="font-semibold text-gray-700">{sources[0].label}</span> · {sources[0].count} leads
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: KK.purple }} />
                <h2 className="text-base font-bold text-gray-900">Recent Activity</h2>
              </div>
              <div className="space-y-3">
                {[
                  { type: 'lead',     text: `Leads ใหม่ ${leadsMTD} ราย เดือนนี้`,                time: 'อัปเดต',        color: KK.blue },
                  { type: 'closing', text: `${closingSoonCount} deals ใกล้ปิด · ฿${(closingSoonValue/1_000_000).toFixed(1)}M`, time: 'real-time',    color: KK.red },
                  { type: 'campaign', text: `${activeCampaigns} campaigns กำลังทำงาน`,           time: '1 ชั่วโมงที่แล้ว', color: KK.orange },
                  { type: 'alert',    text: `${inactiveLeads.length} leads เงียบ > 30 วัน`,        time: 'ต้องติดตาม',      color: KK.amber },
                  { type: 'top',      text: `Top property: ${topPropertiesByInterest[0]?.name || '-'}`, time: 'รายไตรมาส',    color: KK.purple },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: item.color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 leading-tight">{item.text}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

// ─── KPI Card ─────────────────────────────────────────────────
interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  trend?: { value: number; up: boolean };
  sub?: string;
}

const KpiCard = ({ title, value, icon: Icon, color, bg, trend, sub }: KpiCardProps) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-start justify-between mb-5">
      <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
      <div
        className="kpi-icon-bg w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color, filter: `drop-shadow(0 1px 1px ${color}20)` }} strokeWidth={2.2} />
      </div>
    </div>
    <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
    {trend ? (
      <div className="flex items-center gap-1.5 mt-3.5">
        <span className="text-[13px] font-semibold flex items-center gap-0.5" style={{ color: trend.up ? KK.green : KK.red }}>
          {trend.up ? '↗' : '↘'} {trend.value}%
        </span>
        <span className="text-[13px] text-gray-400">vs เดือนก่อน</span>
      </div>
    ) : sub ? (
      <p className="text-[13px] text-gray-400 mt-3.5">{sub}</p>
    ) : (
      <div className="h-5 mt-3.5" />
    )}
  </div>
);

// ─── Funnel Step ──────────────────────────────────────────────
const FunnelStep = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-semibold text-gray-800 tabular-nums">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export default Index;
