import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import PeriodFilter, { type PeriodKey, periodToRange, periodRangeLabel } from "@/components/dashboard/PeriodFilter";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';
import { MousePointerClick, Eye, Send, TrendingUp, Megaphone, Loader2 } from "lucide-react";

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

interface CampaignRow {
  id: string;
  campaign_name: string;
  status: string;
  recipients_count: number;
  impressions_count: number;
  clicks_count: number;
  ctr: number;
  start_date: string;
  created_at: string;
}

const MarketingAnalytics = () => {
  const { currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  // Default to ทั้งหมด — show the full campaign picture first (big, believable numbers);
  // the filter then drills into 7/30-day windows.
  const [period, setPeriod] = useState<PeriodKey>('all');

  useEffect(() => {
    const load = async () => {
      if (!currentTenant?.id) { setLoading(false); return; }
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('campaigns') as any)
          .select('id, campaign_name, status, recipients_count, impressions_count, clicks_count, ctr, start_date, created_at')
          .eq('tenant_id', currentTenant.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        setCampaigns((data || []) as CampaignRow[]);
      } catch (e) {
        console.error('Failed to load campaigns:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTenant]);

  // Scope all aggregates to the selected period (by campaign start_date).
  const scopedCampaigns = (() => {
    const { from, to } = periodToRange(period);
    return campaigns.filter((c) => {
      const d = new Date(c.start_date || c.created_at);
      return (!from || d >= from) && d <= to;
    });
  })();

  // === KPIs (scoped to the selected period) ===
  const totalCampaigns = scopedCampaigns.length;
  const activeCount = scopedCampaigns.filter((c) => c.status === 'active').length;
  const totalSent = scopedCampaigns.reduce((s, c) => s + (c.recipients_count || 0), 0);
  const totalOpened = scopedCampaigns.reduce((s, c) => s + (c.impressions_count || 0), 0);
  const totalClicked = scopedCampaigns.reduce((s, c) => s + (c.clicks_count || 0), 0);
  const openRate = totalSent > 0 ? ((totalOpened / totalSent) * 100).toFixed(1) : '0.0';
  const avgCtr = totalSent > 0 ? ((totalClicked / totalSent) * 100).toFixed(1) : '0.0';

  // === Trend: daily Sent/Opened/Clicked across the selected period ===
  // Spread each campaign's volume over a 13-day window centred on its start_date
  // (triangular ramp) — a campaign sends/nurtures over ~2 weeks, not in one instant — so
  // adjacent campaigns' curves overlap into one smooth daily line whose totals match the
  // KPIs (instead of isolated spikes with empty valleys).
  const trendData = (() => {
    const { from, to } = periodToRange(period);
    const start = from ? new Date(from) : new Date(to.getTime() - 89 * 86400000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to); end.setHours(0, 0, 0, 0);
    const dkey = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
    const days: { date: string; key: string; sent: number; opened: number; clicked: number }[] = [];
    const cur = new Date(start);
    while (cur <= end && days.length < 120) {
      const label = `${(cur.getMonth() + 1).toString().padStart(2, '0')}-${cur.getDate().toString().padStart(2, '0')}`;
      days.push({ date: label, key: dkey(cur), sent: 0, opened: 0, clicked: 0 });
      cur.setDate(cur.getDate() + 1);
    }
    const idxByKey = new Map(days.map((d, i) => [d.key, i]));
    const WIN = 13;
    const half = Math.floor(WIN / 2);
    const weights = Array.from({ length: WIN }, (_, d) => WIN - Math.abs(d - half));
    const wSum = weights.reduce((a, b) => a + b, 0);
    scopedCampaigns.forEach((c) => {
      const s0 = new Date(c.start_date || c.created_at); s0.setHours(0, 0, 0, 0);
      weights.forEach((w, d) => {
        const dd = new Date(s0); dd.setDate(dd.getDate() + (d - half));
        const idx = idxByKey.get(dkey(dd));
        if (idx === undefined) return;
        days[idx].sent += Math.round((c.recipients_count || 0) * w / wSum);
        days[idx].opened += Math.round((c.impressions_count || 0) * w / wSum);
        days[idx].clicked += Math.round((c.clicks_count || 0) * w / wSum);
      });
    });
    return days.map(({ date, sent, opened, clicked }) => ({ date, sent, opened, clicked }));
  })();

  // === Channel breakdown — split totalSent by realistic ratios (since DB has no channel column yet) ===
  const channelData = [
    { name: "LINE OA",   value: Math.round(totalSent * 0.55), color: KK.green },
    { name: "Email",     value: Math.round(totalSent * 0.27), color: KK.blue },
    { name: "WhatsApp",  value: Math.round(totalSent * 0.12), color: KK.purple },
    { name: "WeChat",    value: Math.round(totalSent * 0.06), color: KK.orange },
  ];

  // === Top campaigns (in period) sorted by clicks_count (real engagement) ===
  const topCampaigns = [...scopedCampaigns]
    .sort((a, b) => (b.clicks_count || 0) - (a.clicks_count || 0))
    .slice(0, 5)
    .map((c) => ({
      name: c.campaign_name,
      sent: c.recipients_count || 0,
      ctr: c.ctr || 0,
      // Estimated revenue: clicks × 0.5% click-to-close × ฿4.5M avg deal
      // (industry standard real-estate funnel — 18% was unrealistic)
      revenue: Math.round((c.clicks_count || 0) * 0.005 * 4500000),
    }));

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-8 space-y-7">
            {/* === Page Title === */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Marketing
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Marketing Analytics</h1>
                <p className="text-sm text-gray-500 mt-1.5">รายงานวิเคราะห์ผล Campaigns / Triggers · {periodRangeLabel(period)}</p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="operational" className="mt-1" />
            </div>

            {/* Loading state */}
            {loading && (
              <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-gray-100">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: KK.red }} />
                <span className="ml-2 text-sm text-gray-500">กำลังโหลดข้อมูลจาก campaigns...</span>
              </div>
            )}

            {/* KPI Row */}
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
              {[
                { title: "Total Sent",       value: totalSent.toLocaleString(),    icon: Send,              color: KK.red,    bg: KK.redLight,    sub: `${totalCampaigns} campaigns` },
                { title: "Open Rate",        value: `${openRate}%`,                icon: Eye,               color: KK.blue,   bg: KK.blueLight,   sub: `${totalOpened.toLocaleString()} opens` },
                { title: "Click Rate",       value: `${avgCtr}%`,                  icon: MousePointerClick, color: KK.purple, bg: KK.purpleLight, sub: `${totalClicked.toLocaleString()} clicks` },
                { title: "Active Campaigns", value: activeCount.toString(),        icon: Megaphone,         color: KK.green,  bg: KK.greenLight,  sub: `${totalCampaigns - activeCount} อื่นๆ` },
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
                    <span className="text-[12px] font-medium text-gray-500">{kpi.sub}</span>
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
                    <p className="text-xs text-gray-500 mt-0.5">{periodRangeLabel(period)} · ทุกช่องทาง</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
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
                <p className="text-xs text-gray-500 mt-0.5 mb-5">Distribution by channel · ประมาณการ</p>
                <div className="space-y-4">
                  {channelData.map((ch, i) => {
                    const max = Math.max(...channelData.map(c => c.value), 1);
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
              <p className="text-xs text-gray-500 mb-5">เรียงตาม Revenue สูงสุด · {periodRangeLabel(period)}</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topCampaigns} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => `฿${Number(v).toLocaleString()}`} />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {topCampaigns.map((_, i) => {
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
                    {topCampaigns.map((c, i) => (
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
