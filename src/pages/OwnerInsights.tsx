import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, AlertTriangle, TrendingDown, TrendingUp, Search, ChevronRight, Info, Clock,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';
import { useOwnerInsights, Insight, InsightCategory, InsightSeverity, InsightChart } from '@/hooks/useOwnerInsights';

// ──────────────────────────────────────────────────────────────────────────
// ข้อมูลเชิงลึก (Insights) — the cross-domain narrative action feed.
// Reads from useOwnerInsights (one engine, canonical numbers). Ranked by ฿ impact,
// every card drills to its source page. The "morning briefing" surface for the
// platform owner — what to act on today, framed as MRR / churn / upsell.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};

const fmtTHB = (n: number) => {
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

const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};
// Short money for chart axis only (space-constrained) — "ล." = ล้าน, "K" = พัน.
const axisMoney = (v: number) => {
  if (!v) return '฿0';
  if (Math.abs(v) >= 1_000_000) return `฿${(v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1)}ล.`;
  if (Math.abs(v) >= 1_000) return `฿${Math.round(v / 1_000)}K`;
  return `฿${v}`;
};

const SEVERITY_META: Record<InsightSeverity, { label: string; color: string; bg: string }> = {
  critical: { label: 'เร่งด่วน', color: KK.red, bg: KK.redLight },
  warning: { label: 'ต้องติดตาม', color: KK.amber, bg: KK.amberLight },
  positive: { label: 'โอกาส', color: KK.green, bg: KK.greenLight },
  info: { label: 'ข้อมูล', color: KK.blue, bg: KK.blueLight },
};

const CATEGORY_META: Record<InsightCategory, { label: string }> = {
  revenue: { label: 'รายได้' },
  churn: { label: 'ความเสี่ยง' },
  upsell: { label: 'โอกาสขายเพิ่ม' },
  ops: { label: 'ปฏิบัติการ' },
};

const severityIcon = (s: InsightSeverity) => {
  if (s === 'critical') return AlertTriangle;
  if (s === 'warning') return Clock;
  if (s === 'positive') return TrendingUp;
  return Info;
};

const OwnerInsights = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const { insights, summary, charts, loading } = useOwnerInsights();

  const filtered = useMemo(() => insights.filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (severityFilter !== 'all' && i.severity !== severityFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !i.detail.toLowerCase().includes(q) && !(i.entity || '').toLowerCase().includes(q)) return false;
    }
    return true;
  }), [insights, categoryFilter, severityFilter, search]);

  // All hooks above this guard (Rules of Hooks). Route is already OwnerGuard-protected.
  if (!isOwner) { navigate('/'); return null; }

  const hasFilter = categoryFilter !== 'all' || severityFilter !== 'all' || !!search;

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  // Annotated chart — a chart "pulled" from an overview page + its auto-caption.
  // Compact + read-only; the header link opens the full interactive chart.
  const AnnotatedChart = ({ c }: { c: InsightChart }) => {
    const fmtVal = (v: any) => (c.valueFormat === 'thb' ? fmtTHB(Number(v) || 0) : `${Number(v) || 0}`);
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-bold text-gray-900">{c.title}</h3>
          <button onClick={() => navigate(c.href)} className="text-xs font-semibold flex items-center gap-1 hover:opacity-70 transition-opacity flex-shrink-0" style={{ color: KK.red }}>
            ดูเต็ม <ChevronRight className="w-3 h-3" />
          </button>
        </div>

        {c.kind === 'area' && (
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={c.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${c.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={KK.red} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: any) => axisMoney(Number(v))} />
              <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [fmtVal(v), c.title]) as any} />
              <Area type="monotone" dataKey="v" stroke={KK.red} strokeWidth={2.5} fill={`url(#grad-${c.id})`} dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} animationDuration={900} />
            </AreaChart>
          </ResponsiveContainer>
        )}

        {c.kind === 'bar' && (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={c.data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={46} tickFormatter={(v: any) => axisMoney(Number(v))} />
              <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={((v: any) => [fmtVal(v), 'MRR']) as any} />
              <Bar dataKey="v" radius={[6, 6, 0, 0]} maxBarSize={56} animationDuration={800}>
                {c.data.map((d, i) => <Cell key={i} fill={d.color || KK.red} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}

        {c.kind === 'donut' && (
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0" style={{ width: 150, height: 150 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={c.data as any} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={2}>
                    {c.data.map((d, i) => <Cell key={i} fill={d.color || KK.gray} />)}
                  </Pie>
                  <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} บริษัท`, n]) as any} />
                </PieChart>
              </ResponsiveContainer>
              {c.centerLabel && (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-2xl font-bold text-gray-900 tabular-nums">{c.centerLabel}</div>
                  <div className="text-xs text-gray-400">บริษัท</div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {c.data.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                  <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Narrative caption — the auto-generated sentence under the chart */}
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2.5" style={{ backgroundColor: KK.grayLight, border: `1px solid ${KK.border}` }}>
          <Sparkles className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: KK.red }} />
          <p className="text-xs text-gray-600 leading-relaxed">{c.caption}</p>
        </div>
      </div>
    );
  };

  const InsightRow = ({ i }: { i: Insight }) => {
    const sm = SEVERITY_META[i.severity];
    const Icon = severityIcon(i.severity);
    return (
      <button
        type="button"
        onClick={() => navigate(i.href)}
        className="w-full flex items-stretch gap-0 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        {/* Severity accent bar */}
        <span className="w-1 flex-shrink-0 rounded-full my-3" style={{ backgroundColor: sm.color }} />
        <div className="flex items-center gap-3 flex-1 min-w-0 px-4 py-3.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sm.bg }}>
            <Icon className="w-4 h-4" style={{ color: sm.color }} strokeWidth={2.2} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ color: sm.color, backgroundColor: sm.bg }}>{sm.label}</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-md text-gray-500 bg-gray-50 border border-gray-100">{CATEGORY_META[i.category].label}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 leading-snug">{i.title}</p>
            <p className="text-xs text-gray-400 mt-0.5 leading-snug">{i.detail}</p>
          </div>
          {i.metric && (
            <span className="text-sm font-bold tabular-nums flex-shrink-0 whitespace-nowrap" style={{ color: sm.color }}>{i.metric}</span>
          )}
          <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
        </div>
      </button>
    );
  };

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  <Sparkles className="w-3 h-3" />Insights
                </span>
                <h1 className="text-2xl font-bold text-gray-900">ข้อมูลเชิงลึก (Insights)</h1>
                <p className="text-sm text-gray-500 mt-1.5">
                  สิ่งที่ต้องลงมือวันนี้ · วิเคราะห์ข้ามทุกโดเมน เรียงตามเงินที่กระทบ · <span className="font-semibold text-gray-700">ข้อมูล ณ วันนี้</span>
                </p>
              </div>
            </div>

            {/* Summary KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <KpiCard
                title="ต้องเร่งดำเนินการ"
                value={loading ? '—' : summary.critical.toLocaleString()}
                sub="รายการระดับเร่งด่วน (ความเสี่ยงสูญเงิน)"
                icon={AlertTriangle} color={KK.red} bg={KK.redLight}
              />
              <KpiCard
                title="รายได้ที่เสี่ยงรวม"
                value={loading ? '—' : fmtTHB(summary.revenueAtRisk)}
                sub="MRR รวมจากทุกสัญญาณ churn / รายได้"
                icon={TrendingDown} color={KK.amber} bg={KK.amberLight}
              />
              <KpiCard
                title="โอกาสขายเพิ่ม (Upsell)"
                value={loading ? '—' : summary.opportunities.toLocaleString()}
                sub="บริษัทที่พร้อมอัปเกรด / ขายเพิ่ม"
                icon={TrendingUp} color={KK.green} bg={KK.greenLight}
              />
            </div>

            {/* Zone 1 — เรื่องเด่นวันนี้: charts pulled from overview pages + auto-captions */}
            {(loading || charts.length > 0) && (
              <div>
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3 mb-4">
                  <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
                  <span className="text-sm font-semibold text-gray-700">เรื่องเด่นวันนี้</span>
                  <span className="text-xs text-gray-400 hidden sm:inline">· กราฟจากหน้าภาพรวม พร้อมคำบรรยายอัตโนมัติ</span>
                </div>
                {loading ? (
                  <div className="flex items-center justify-center h-40 text-sm text-gray-400">กำลังวิเคราะห์ข้อมูล...</div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {charts.map((c) => <AnnotatedChart key={c.id} c={c} />)}
                  </div>
                )}
              </div>
            )}

            {/* Zone 2 — Feed: ranked action items */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">สิ่งที่ต้องลงมือ</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามความเร่งด่วน → เงินที่กระทบ · กดเพื่อไปยังหน้าต้นทาง</p>
                  </div>
                  {hasFilter && (
                    <button
                      onClick={() => { setCategoryFilter('all'); setSeverityFilter('all'); setSearch(''); }}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                    >
                      <span>ล้างตัวกรอง</span><span className="text-gray-400">×</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ค้นหา insight / บริษัท..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกหมวด</SelectItem>
                      <SelectItem value="revenue">รายได้</SelectItem>
                      <SelectItem value="churn">ความเสี่ยง</SelectItem>
                      <SelectItem value="upsell">โอกาสขายเพิ่ม</SelectItem>
                      <SelectItem value="ops">ปฏิบัติการ</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={severityFilter} onValueChange={setSeverityFilter}>
                    <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกระดับ</SelectItem>
                      <SelectItem value="critical">เร่งด่วน</SelectItem>
                      <SelectItem value="warning">ต้องติดตาม</SelectItem>
                      <SelectItem value="positive">โอกาส</SelectItem>
                      <SelectItem value="info">ข้อมูล</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">กำลังวิเคราะห์ข้อมูล...</div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Sparkles className="w-9 h-9 mb-3" style={{ color: KK.green }} />
                  <span className="text-sm font-semibold text-gray-700">{insights.length === 0 ? 'ทุกอย่างอยู่ในเกณฑ์ปกติ' : 'ไม่พบรายการตามตัวกรอง'}</span>
                  <span className="text-xs text-gray-400 mt-0.5">{insights.length === 0 ? 'ไม่มีความเสี่ยงหรือโอกาสที่ต้องดำเนินการ' : 'ลองล้างตัวกรองเพื่อดูทั้งหมด'}</span>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 -mx-1">
                  {filtered.map((i) => <InsightRow key={i.id} i={i} />)}
                </div>
              )}

              {!loading && filtered.length > 0 && (
                <div className="px-2 pt-4 mt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">แสดง {filtered.length} จาก {insights.length} รายการ</span>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerInsights;
