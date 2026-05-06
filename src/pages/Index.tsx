import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  Inbox,
  Megaphone,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { getDashboardStatistics, DashboardStats } from "@/lib/api/dashboard";

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

// ─── Mock Data ────────────────────────────────────────────────
const buildRevenue30D = () => {
  const arr = [];
  const startDate = new Date(2024, 2, 25);
  for (let i = 0; i < 28; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const day = d.getDay();
    const base = 175000 + Math.sin(i / 3) * 25000;
    const spike = (day === 0 || day === 6) ? 110000 + Math.random() * 30000 : Math.random() * 20000;
    arr.push({
      date: `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`,
      revenue: Math.round(base + spike),
    });
  }
  return arr;
};

const REVENUE_30D = buildRevenue30D();

const VISITOR_FORECAST = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2024, 3, 24 + i);
  const day = d.getDay();
  const base = 480 + (day === 0 || day === 6 ? 220 : 0) + Math.sin(i / 4) * 40;
  return {
    date: `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`,
    forecast: Math.round(base),
    upper: Math.round(base + 80),
    lower: Math.round(base - 80),
  };
});

const TOP_BRANCHES = [
  { name: 'BAAN ISSARA', admission: 95000,  fnb: 65000 },
  { name: 'CHATEAU A',   admission: 92000,  fnb: 62000 },
  { name: 'CHATEAU B',   admission: 155000, fnb: 140000 },
  { name: 'GRAND',       admission: 145000, fnb: 130000 },
  { name: 'ROYAL',       admission: 50000,  fnb: 75000 },
  { name: 'SKY VILLA',   admission: 48000,  fnb: 72000 },
  { name: 'PARKWAY',     admission: 45000,  fnb: 70000 },
];

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid ${KK.border}`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

const Index = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const totalLeads = stats?.leads.totalLeads ?? 16137;
  const totalCustomers = stats?.leads.convertedToCustomers ?? 12850;
  const totalProjects = stats?.projects.total ?? 20;
  const completedProjects = stats?.projects.completed ?? 5;

  const KPIS: KpiCardProps[] = [
    {
      title: 'Revenue MTD',
      value: '฿6,131,668',
      icon: Wallet,
      color: KK.red,
      bg: KK.redLight,
      trend: { value: 18.4, up: true },
    },
    {
      title: 'Leads MTD',
      value: totalLeads.toLocaleString(),
      icon: Users,
      color: KK.blue,
      bg: KK.blueLight,
      trend: { value: 12.5, up: true },
    },
    {
      title: 'ลูกค้าทั้งระบบ',
      value: totalCustomers.toLocaleString(),
      icon: Sparkles,
      color: KK.purple,
      bg: KK.purpleLight,
      trend: { value: 8.2, up: true },
    },
    {
      title: 'Active Campaigns',
      value: '5',
      icon: Megaphone,
      color: KK.green,
      bg: KK.greenLight,
      sub: 'เดือนนี้',
    },
    {
      title: 'Open Tickets',
      value: '3',
      icon: Inbox,
      color: KK.orange,
      bg: KK.orangeLight,
      sub: 'ทั้งระบบ',
    },
    {
      title: 'Properties Online',
      value: `${completedProjects}/${totalProjects}`,
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
              ภาพรวมระบบ — Revenue / Leads / Properties / Campaigns / Tickets · อัปเดตล่าสุด {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
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
            {/* Revenue Chart (2/3) */}
            <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Revenue ทั้งระบบ</h2>
                  <p className="text-xs text-gray-500 mt-0.5">30 วันล่าสุด — Stacked all properties</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  30 วัน
                </span>
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={REVENUE_30D} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
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
                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [`฿${Number(v).toLocaleString()}`, 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={KK.red}
                    strokeWidth={2.5}
                    fill="url(#revGrad)"
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
                <LineChart data={VISITOR_FORECAST} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={KK.purple} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={KK.purple} stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={4} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="upper" stroke="none" fill="url(#confGrad)" />
                  <Area type="monotone" dataKey="lower" stroke="none" fill="#fff" />
                  <Line type="monotone" dataKey="forecast" stroke={KK.purple} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-3 p-3 rounded-xl" style={{ backgroundColor: KK.purpleLight }}>
                <p className="text-xs font-semibold" style={{ color: KK.purple }}>คาดการณ์เฉลี่ย 580 leads/วัน</p>
                <p className="text-[11px] text-gray-500 mt-0.5">ช่วง confidence 95% (±80) · weekend +35%</p>
              </div>
            </div>
          </div>

          {/* === Row 2: Top Properties + Churn Risk === */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Top Properties (2/3) */}
            <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <h2 className="text-base font-bold text-gray-900">Top Properties Performance MTD</h2>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">เปรียบเทียบยอดขาย Admission vs F&B</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={TOP_BRANCHES} margin={{ top: 10, right: 8, left: -10, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                  <Bar dataKey="admission" stackId="a" fill={KK.red}    radius={[0, 0, 0, 0]} />
                  <Bar dataKey="fnb"       stackId="a" fill={KK.orange} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="flex gap-4 mt-3 pl-2">
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-600">Admission</span></div>
                <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: KK.orange }} /><span className="text-xs text-gray-600">F&B / Add-ons</span></div>
              </div>
            </div>

            {/* Churn Risk (1/3) */}
            <div className="bg-white border rounded-2xl shadow-soft p-5" style={{ borderColor: KK.amberLight }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="w-4 h-4" style={{ color: KK.amber }} />
                <h2 className="text-base font-bold text-gray-900">Churn Risk Alert</h2>
              </div>
              <p className="text-xs text-gray-500 mb-4">ลูกค้าเสี่ยงเลิกใช้บริการ</p>

              <div className="rounded-xl p-4 mb-3" style={{ backgroundColor: KK.redLight, border: `1px solid ${KK.redBorder}` }}>
                <div className="text-4xl font-bold leading-none" style={{ color: KK.red }}>142</div>
                <div className="text-xs text-gray-600 mt-1.5">ลูกค้าเสี่ยงทั้งหมด</div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl p-3" style={{ backgroundColor: KK.redLight }}>
                  <div className="text-xs text-gray-600 mb-1">High Risk</div>
                  <div className="text-2xl font-bold" style={{ color: KK.red }}>38</div>
                </div>
                <div className="rounded-xl p-3" style={{ backgroundColor: KK.amberLight }}>
                  <div className="text-xs text-gray-600 mb-1">Medium</div>
                  <div className="text-2xl font-bold" style={{ color: KK.amber }}>104</div>
                </div>
              </div>

              <button className="w-full mt-4 text-xs font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-colors" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                ดูรายละเอียด <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* === Row 3: Quick Stats + Activity === */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4" style={{ color: KK.green }} />
                <h2 className="text-base font-bold text-gray-900">Conversion Funnel</h2>
              </div>
              <div className="space-y-3">
                <FunnelStep label="Visitors"    value={45200} max={45200} color={KK.gray} />
                <FunnelStep label="Leads"       value={16137} max={45200} color={KK.blue} />
                <FunnelStep label="Qualified"   value={8420}  max={45200} color={KK.purple} />
                <FunnelStep label="Customers"   value={12850} max={45200} color={KK.green} />
                <FunnelStep label="Repeat"      value={3260}  max={45200} color={KK.red} />
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4" style={{ color: KK.red }} />
                <h2 className="text-base font-bold text-gray-900">Sales Trend</h2>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={REVENUE_30D.slice(-14)} margin={{ top: 10, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"  stopColor={KK.red} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                  <Area type="monotone" dataKey="revenue" stroke={KK.red} strokeWidth={2.5} fill="url(#trendGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4" style={{ color: KK.purple }} />
                <h2 className="text-base font-bold text-gray-900">Recent Activity</h2>
              </div>
              <div className="space-y-3">
                {[
                  { type: 'lead',     text: 'มีลูกค้าใหม่ 42 ราย',          time: '2 นาทีที่แล้ว', color: KK.blue },
                  { type: 'sale',     text: 'ปิดดีล BAAN ISSARA #24',       time: '15 นาทีที่แล้ว', color: KK.green },
                  { type: 'campaign', text: 'แคมเปญ Q2 ลงโฆษณาแล้ว',     time: '1 ชั่วโมงที่แล้ว', color: KK.orange },
                  { type: 'alert',    text: 'Churn risk เพิ่มขึ้น 4 ราย',   time: '3 ชั่วโมงที่แล้ว', color: KK.red },
                  { type: 'system',   text: 'รายงานเดือน เม.ย. พร้อม',     time: 'เมื่อวาน',        color: KK.purple },
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
