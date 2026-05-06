import { useState } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3, MousePointerClick, Eye, Send, TrendingUp, Megaphone } from "lucide-react";

const KK = {
  red: '#e60023', redLight: '#fff1f2',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
};

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid #e5e7eb`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

const TREND_DATA = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2024, 3, i + 1);
  const base = 1500 + Math.sin(i / 4) * 400 + (d.getDay() >= 5 ? 600 : 0);
  return {
    date: `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`,
    sent: Math.round(base + Math.random() * 200),
    opened: Math.round((base + Math.random() * 200) * 0.85),
    clicked: Math.round((base + Math.random() * 200) * 0.58),
  };
});

const CHANNEL_DATA = [
  { name: "LINE OA",   value: 8420, color: KK.green },
  { name: "Email",     value: 4210, color: KK.blue },
  { name: "SMS",       value: 1850, color: KK.purple },
  { name: "Push App",  value: 920,  color: KK.orange },
];

const TOP_CAMPAIGNS = [
  { name: "ลดสนั่น Q2",         sent: 5247, ctr: 34.4, revenue: 1284000 },
  { name: "ซื้อเลย Family",      sent: 3120, ctr: 23.2, revenue: 892000 },
  { name: "คุ้มสุดๆ ดอกเบี้ย 0%", sent: 2480, ctr: 18.5, revenue: 654000 },
  { name: "ฟรีดาวน์ใหม่",        sent: 1820, ctr: 16.3, revenue: 412000 },
  { name: "Welcome Lead",       sent: 8940, ctr: 12.5, revenue: 287000 },
];

const MarketingAnalytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const totalSent = TREND_DATA.reduce((sum, d) => sum + d.sent, 0);
  const totalOpened = TREND_DATA.reduce((sum, d) => sum + d.opened, 0);
  const totalClicked = TREND_DATA.reduce((sum, d) => sum + d.clicked, 0);
  const avgCtr = ((totalClicked / totalSent) * 100).toFixed(1);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-7">
            {/* === Page Title === */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                Marketing
              </span>
              <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Marketing Analytics</h1>
              <p className="text-[15px] text-gray-500 mt-1.5">รายงานวิเคราะห์ผล Campaigns / Triggers / Vouchers · 30 วันล่าสุด</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "Total Sent",    value: totalSent.toLocaleString(),    icon: Send,             color: KK.red,    bg: KK.redLight,    trend: 12.4 },
                { title: "Open Rate",     value: `${((totalOpened/totalSent)*100).toFixed(1)}%`,  icon: Eye, color: KK.blue, bg: KK.blueLight, trend: 8.2 },
                { title: "Click Rate",    value: `${avgCtr}%`,                  icon: MousePointerClick, color: KK.purple, bg: KK.purpleLight, trend: 15.6 },
                { title: "Active Campaigns", value: "12",                       icon: Megaphone,         color: KK.green,  bg: KK.greenLight, trend: 4.3 },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft">
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                      <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
                  <div className="flex items-center gap-1.5 mt-3.5">
                    <span className="text-[13px] font-semibold" style={{ color: KK.green }}>↗ {kpi.trend}%</span>
                    <span className="text-[13px] text-gray-400">vs เดือนก่อน</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Row 1: Trend chart (2/3) + Channel breakdown (1/3) */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">แนวโน้ม Sent / Opened / Clicked</h2>
                    <p className="text-xs text-gray-500 mt-0.5">30 วันล่าสุด · ทุกช่องทาง</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>30 วัน</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={TREND_DATA} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.red} stopOpacity={0.25} />
                        <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="openedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.blue} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={KK.blue} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="clickedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.purple} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={KK.purple} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(1)}k`} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Area type="monotone" dataKey="sent"    stroke={KK.red}    strokeWidth={2.5} fill="url(#sentGrad)"    dot={false} />
                    <Area type="monotone" dataKey="opened"  stroke={KK.blue}   strokeWidth={2}   fill="url(#openedGrad)"  dot={false} />
                    <Area type="monotone" dataKey="clicked" stroke={KK.purple} strokeWidth={2}   fill="url(#clickedGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                <div className="flex gap-5 mt-3 pl-2">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-600">Sent</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.blue }} /><span className="text-xs text-gray-600">Opened</span></div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.purple }} /><span className="text-xs text-gray-600">Clicked</span></div>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <h2 className="text-base font-bold text-gray-900">ช่องทางการส่ง</h2>
                <p className="text-xs text-gray-500 mt-0.5 mb-5">Distribution by channel · เดือนนี้</p>
                <div className="space-y-4">
                  {CHANNEL_DATA.map((ch, i) => {
                    const max = Math.max(...CHANNEL_DATA.map(c => c.value));
                    const widthPct = (ch.value / max) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs font-medium text-gray-700">{ch.name}</span>
                          <span className="text-xs font-bold tabular-nums" style={{ color: ch.color }}>{ch.value.toLocaleString()}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${widthPct}%`, backgroundColor: ch.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Campaigns Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4" style={{ color: KK.red }} />
                <h2 className="text-base font-bold text-gray-900">Top Performing Campaigns</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">เรียงตาม Revenue สูงสุด · 30 วันล่าสุด</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={TOP_CAMPAIGNS} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {TOP_CAMPAIGNS.map((_, i) => {
                      const tones = ['#e60023', '#ef4458', '#f87171', '#fca5a5', '#fecdd3'];
                      return <Cell key={i} fill={tones[i] || '#fecdd3'} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-x-auto mt-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500">Campaign</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Sent</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">CTR</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_CAMPAIGNS.map((c, i) => (
                      <tr key={i} className="border-t border-gray-50 hover:bg-gray-50/70">
                        <td className="px-3 py-3 text-sm font-medium text-gray-800">{c.name}</td>
                        <td className="px-3 py-3 text-sm text-right tabular-nums text-gray-600">{c.sent.toLocaleString()}</td>
                        <td className="px-3 py-3 text-sm text-right tabular-nums font-semibold" style={{ color: KK.red }}>{c.ctr}%</td>
                        <td className="px-3 py-3 text-sm text-right tabular-nums font-bold text-gray-900">฿{c.revenue.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default MarketingAnalytics;
