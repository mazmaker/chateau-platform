import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Users, Contact, ChevronRight, Percent, TrendingUp } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';
import TenantCombobox from '@/components/owner/TenantCombobox';

// ──────────────────────────────────────────────────────────────────────────
// Customer Intelligence (CDP) — Owner cross-tenant buyer intelligence.
// The platform's stated identity: a CDP for real estate. Answers เฮีย's
// "ใครจ่ายเยอะสุด / data ทุกมิติ": who buys, their characteristics, segments.
// Data: customers.preferences (age/income/occupation/purpose…) + leads (scores,
// estimated_value, customer_id) across all customer tenants. Read-only / Owner RLS.
// PDPA: aggregate view; the top-buyers table shows name at owner level only.
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
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${abs.toFixed(0)}`;
};

// preference enums → Thai (fall back to raw value if unmapped).
const OCC_TH: Record<string, string> = {
  private_company: 'พนักงานบริษัท', government: 'ข้าราชการ', state_enterprise: 'รัฐวิสาหกิจ',
  business_owner: 'เจ้าของธุรกิจ', freelance: 'อาชีพอิสระ', professional: 'วิชาชีพเฉพาะ',
  employee: 'พนักงาน', retired: 'เกษียณ', student: 'นักศึกษา', other: 'อื่น ๆ',
};
const PURPOSE_TH: Record<string, string> = {
  investment: 'ลงทุน', residence: 'อยู่อาศัยเอง', rental: 'ปล่อยเช่า',
  family: 'ซื้อให้ครอบครัว', vacation: 'บ้านพักตากอากาศ', other: 'อื่น ๆ',
};
const SOURCE_TH: Record<string, string> = {
  walk_in: 'Walk-in (มาเอง)', online_google: 'Google', agent_referral: 'นายหน้าแนะนำ',
  online_line: 'LINE', online_facebook: 'Facebook', online_tiktok: 'TikTok', online_youtube: 'YouTube',
  brochure: 'โบรชัวร์', event: 'อีเวนต์', friend: 'เพื่อนแนะนำ', referral: 'แนะนำต่อ', other: 'อื่น ๆ',
};
const DONUT_COLORS = [KK.blue, KK.red, KK.green, KK.amber, KK.slate, '#7c3aed', '#0891b2', '#db2777'];

// Occupations have a long freeform tail (CFO, วิศวกร, …, mostly 1 person each) that
// turns a donut into unreadable slivers. Keep the top N and roll the rest into one
// "อื่นๆ" entry so a ranked bar list stays clean no matter how dirty the data is.
const TOP_OCC = 7;
const groupTail = (arr: { name: string; value: number; color: string }[]): { name: string; value: number; color: string }[] => {
  if (arr.length <= TOP_OCC + 1) return arr;
  const top = arr.slice(0, TOP_OCC);
  const rest = arr.slice(TOP_OCC);
  const restSum = rest.reduce((s, d) => s + d.value, 0);
  if (restSum <= 0) return top;
  return [...top, { name: `อื่นๆ (${rest.length} อาชีพ)`, value: restSum, color: KK.gray }];
};

const INCOME_BANDS = [
  { label: '< 30K', min: 0, max: 30_000 },
  { label: '30–50K', min: 30_000, max: 50_000 },
  { label: '50–100K', min: 50_000, max: 100_000 },
  { label: '100–300K', min: 100_000, max: 300_000 },
  { label: '300K+', min: 300_000, max: Infinity },
];
const AGE_BANDS = [
  { label: '< 30', min: 0, max: 30 },
  { label: '30–40', min: 30, max: 40 },
  { label: '40–50', min: 40, max: 50 },
  { label: '50–60', min: 50, max: 60 },
  { label: '60+', min: 60, max: 200 },
];

interface CustomerRow {
  id: string; full_name: string | null; tenant_id: string;
  acquisition_source: string | null; preferences: any;
}
interface LeadLite {
  customer_id: string | null; tenant_id: string | null; status: string | null; created_at: string | null;
  estimated_value: number | null; financial_score: number | null; potential_score: number | null;
  financing_approved: boolean | null; max_loan_amount: number | null;
  website_visits: number | null; site_visit_attended: boolean | null;
}
interface Enriched {
  id: string; name: string; tenantId: string; occupation: string; purpose: string; source: string;
  age: number; income: number; debt: number; estValue: number; wonValue: number; financial: number; won: boolean;
}

const OwnerCustomers = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allRows, setAllRows] = useState<Enriched[]>([]);
  const [allLeads, setAllLeads] = useState<LeadLite[]>([]);
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('all');
  const [search, setSearch] = useState('');
  const [occ, setOcc] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [occMode, setOccMode] = useState<'count' | 'value'>('count');
  const [demoMode, setDemoMode] = useState<'age' | 'income'>('age');
  const [purposeMode, setPurposeMode] = useState<'purpose' | 'source'>('purpose');
  const [barsReady, setBarsReady] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenantRows } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const ids = (tenantRows || []).map((t: any) => t.id);
      setTenants(((tenantRows || []) as any[]).map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      if (ids.length > 0) {
        const [cRes, lRes] = await Promise.all([
          supabase.from('customers').select('id, full_name, tenant_id, acquisition_source, preferences').in('tenant_id', ids),
          supabase.from('leads').select('customer_id, tenant_id, status, created_at, estimated_value, financial_score, potential_score, financing_approved, max_loan_amount, website_visits, site_visit_attended').in('tenant_id', ids),
        ]);
        const customers = (cRes.data || []) as CustomerRow[];
        const leads = (lRes.data || []) as LeadLite[];

        // Per-customer rollup from leads: biggest estimated deal + won flag + financial score
        // + total value of WON deals only (for the "ซื้อจริง" occupation view — closed value,
        // not the largest estimate among any lead).
        const byCust = new Map<string, { estValue: number; wonValue: number; financial: number; won: boolean }>();
        leads.forEach((l) => {
          if (!l.customer_id) return;
          const r = byCust.get(l.customer_id) || { estValue: 0, wonValue: 0, financial: 0, won: false };
          r.estValue = Math.max(r.estValue, Number(l.estimated_value) || 0);
          r.financial = Math.max(r.financial, Number(l.financial_score) || 0);
          if (l.status === 'won') { r.won = true; r.wonValue += Number(l.estimated_value) || 0; }
          byCust.set(l.customer_id, r);
        });

        const enriched: Enriched[] = customers.map((c) => {
          const p = c.preferences || {};
          const lead = byCust.get(c.id);
          return {
            id: c.id,
            name: c.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
            tenantId: c.tenant_id,
            occupation: p.occupation || 'other',
            purpose: p.purchase_purpose || 'other',
            source: c.acquisition_source || 'other',
            age: Number(p.age) || 0,
            income: Number(p.monthly_income) || 0,
            debt: Number(p.monthly_debt) || 0,
            estValue: lead?.estValue || 0,
            wonValue: lead?.wonValue || 0,
            financial: lead?.financial || 0,
            won: lead?.won || false,
          };
        });
        setAllRows(enriched);
        setAllLeads(leads);
      }
    } catch (e) {
      console.error('OwnerCustomers fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Company scope — selecting a tenant re-scopes the WHOLE page (KPI/HERO/charts/
  // trend/table) by filtering the two source arrays; every memo derives from these.
  const rows = useMemo(
    () => (selectedTenant === 'all' ? allRows : allRows.filter((r) => r.tenantId === selectedTenant)),
    [allRows, selectedTenant],
  );
  const leadsRaw = useMemo(
    () => (selectedTenant === 'all' ? allLeads : allLeads.filter((l) => l.tenant_id === selectedTenant)),
    [allLeads, selectedTenant],
  );
  const selectedTenantName = selectedTenant === 'all' ? null : (tenants.find((t) => t.id === selectedTenant)?.name ?? null);
  // Reset table filters when switching company (stale occupation/purpose would show empty).
  useEffect(() => { setOcc('all'); setPurpose('all'); setSearch(''); setCurrentPage(1); }, [selectedTenant]);

  // ── Distributions ────────────────────────────────────────────────────────
  const purposeData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => { if (r.purpose && r.purpose !== 'other') m.set(r.purpose, (m.get(r.purpose) || 0) + 1); });
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: PURPOSE_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const sourceData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.source, (m.get(r.source) || 0) + 1));
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: SOURCE_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  // Stable color per occupation (by headcount desc) so a given occupation keeps the
  // SAME donut color when toggling จำนวน↔มูลค่าซื้อ (the two datasets have different sets).
  const occColorMap = useMemo(() => {
    const counts = new Map<string, number>();
    rows.forEach((r) => counts.set(r.occupation, (counts.get(r.occupation) || 0) + 1));
    const keys = Array.from(counts.keys()).sort((a, b) => (counts.get(b) || 0) - (counts.get(a) || 0));
    const map: Record<string, string> = {};
    keys.forEach((k, i) => { map[k] = DONUT_COLORS[i % DONUT_COLORS.length]; });
    return map;
  }, [rows]);

  const occData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.occupation, (m.get(r.occupation) || 0) + 1));
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: OCC_TH[k] || k, value: v, color: occColorMap[k] || DONUT_COLORS[0] }))
      .sort((a, b) => b.value - a.value);
  }, [rows, occColorMap]);

  // "อาชีพไหนซื้อเยอะ" — by actual WON-deal value (sum of closed deals), not headcount (เฮีย's ask).
  const occValueData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => { if (r.wonValue > 0) m.set(r.occupation, (m.get(r.occupation) || 0) + r.wonValue); });
    return Array.from(m.entries())
      .map(([k, v]) => ({ name: OCC_TH[k] || k, value: v, color: occColorMap[k] || DONUT_COLORS[0] }))
      .sort((a, b) => b.value - a.value);
  }, [rows, occColorMap]);

  // Active occupation dataset (count vs won-value) grouped to Top 7 + อื่นๆ for the bar list.
  const occBars = useMemo(() => groupTail(occMode === 'value' ? occValueData : occData), [occMode, occData, occValueData]);

  const ageData = useMemo(() => AGE_BANDS.map((b) => ({
    label: b.label, count: rows.filter((r) => r.age >= b.min && r.age < b.max).length,
  })), [rows]);

  const incomeData = useMemo(() => INCOME_BANDS.map((b) => ({
    label: b.label, count: rows.filter((r) => r.income >= b.min && r.income < b.max).length,
  })), [rows]);

  // ── Lead-level aggregates (CDP proof) — from the same leads fetch, no extra query ──
  const leadKpis = useMemo(() => {
    const total = leadsRaw.length;
    const tenantsActive = new Set(leadsRaw.map((l) => l.tenant_id)).size;
    const won = leadsRaw.filter((l) => l.status === 'won').length;
    const conversion = total ? Math.round((won / total) * 100) : 0;
    const hot = leadsRaw.filter((l) => (l.potential_score ?? -1) >= 70).length;
    const pipeline = leadsRaw.filter((l) => l.status !== 'won' && l.status !== 'lost').reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    return { total, tenantsActive, won, conversion, hot, pipeline };
  }, [leadsRaw]);

  // HERO — AI score band → actual close-rate (proves the engine predicts).
  const bands = useMemo(() => {
    const scored = leadsRaw.filter((l) => l.potential_score != null);
    const def: { key: string; label: string; range: string; color: string; test: (s: number) => boolean }[] = [
      { key: 'hot', label: 'HOT', range: 'สกอร์ 70+', color: KK.red, test: (s) => s >= 70 },
      { key: 'warm', label: 'WARM', range: 'สกอร์ 40–69', color: KK.amber, test: (s) => s >= 40 && s < 70 },
      { key: 'cold', label: 'COOL', range: 'สกอร์ < 40', color: KK.gray, test: (s) => s < 40 },
    ];
    return def.map((b) => {
      const r = scored.filter((l) => b.test(Number(l.potential_score)));
      const won = r.filter((l) => l.status === 'won').length;
      return { ...b, leads: r.length, won, winPct: r.length ? Math.round((won / r.length) * 100) : 0 };
    });
  }, [leadsRaw]);

  // เทรนด์ผู้สนใจใหม่ต่อเดือน (lead inflow) — นับ leads ตาม created_at ย้อนหลัง 6 เดือน.
  const trendData = useMemo(() => {
    const TH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const now = new Date();
    const months: { label: string; count: number; key: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ label: TH[d.getMonth()], count: 0, key: `${d.getFullYear()}-${d.getMonth()}` });
    }
    const idx = new Map(months.map((m, i) => [m.key, i]));
    leadsRaw.forEach((l) => {
      if (!l.created_at) return;
      const d = new Date(l.created_at);
      const i = idx.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i !== undefined) months[i].count++;
    });
    return months;
  }, [leadsRaw]);

  // ── Filtered table ───────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (occ !== 'all' && r.occupation !== occ) return false;
        if (purpose !== 'all' && r.purpose !== purpose) return false;
        if (q && !`${r.name} ${OCC_TH[r.occupation] || r.occupation}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => (b.estValue - a.estValue) || (b.income - a.income));
  }, [rows, search, occ, purpose]);

  // Pagination — same pattern as the Admin Leads table (10/25/50 per page).
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);
  useEffect(() => { setCurrentPage(1); }, [search, occ, purpose, pageSize]);

  // Animate the HERO score bars from 0 → winPct once data has loaded.
  useEffect(() => {
    if (loading) { setBarsReady(false); return; }
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => { raf2 = requestAnimationFrame(() => setBarsReady(true)); });
    return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2); };
  }, [loading]);

  const occOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.occupation))), [rows]);

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
      <p className="text-2xl font-bold text-gray-900 leading-none tracking-tight truncate">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  const Donut = ({ title, sub, data, headerRight, fmt }: {
    title: string; sub: string; data: { name: string; value: number; color: string }[];
    headerRight?: React.ReactNode; fmt?: (v: number) => string;
  }) => {
    const format = fmt || ((v: number) => `${v} คน`);
    const sum = data.reduce((s, x) => s + x.value, 0) || 1;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mb-2 mt-0.5">{sub}</p>
          </div>
          {headerRight}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center flex-1">
          <div className="h-[200px]">
            {data.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-gray-400">ยังไม่มีข้อมูล</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={0} stroke="none">
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [format(Number(v)), n]) as any} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="space-y-1.5">
            {data.slice(0, 6).map((d, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                <span className="font-semibold text-gray-800 tabular-nums">{format(d.value)}</span>
                <span className="text-gray-400 tabular-nums w-9 text-right">{Math.round((d.value / sum) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const BarBlock = ({ title, sub, data, headerRight }: { title: string; sub: string; data: { label: string; count: number }[]; headerRight?: React.ReactNode }) => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
        </div>
        {headerRight}
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={((v: any) => [`${v} คน`, '']) as any} />
          <Bar dataKey="count" radius={[6, 6, 0, 0]} fill={KK.red} maxBarSize={56} animationDuration={800} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  // Horizontal ranked-bar list — best for many categories (label + value + % stay
  // readable at any count, unlike a donut's slivers). Bars animate width via barsReady.
  const RankBars = ({ title, sub, data, headerRight, fmt }: {
    title: string; sub: string; data: { name: string; value: number; color: string }[];
    headerRight?: React.ReactNode; fmt?: (v: number) => string;
  }) => {
    const format = fmt || ((v: number) => `${v} คน`);
    const sum = data.reduce((s, x) => s + x.value, 0) || 1;
    const max = Math.max(1, ...data.map((d) => d.value));
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col h-full">
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
          </div>
          {headerRight}
        </div>
        {data.length === 0 ? (
          <div className="flex-1 min-h-[200px] flex items-center justify-center text-sm text-gray-400">ยังไม่มีข้อมูล</div>
        ) : (
          <div className="flex-1 flex flex-col justify-center space-y-2.5">
            {data.map((d, i) => (
              <div key={i}>
                <div className="flex items-center justify-between text-sm mb-1 gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-gray-700 truncate">{d.name}</span>
                  </span>
                  <span className="flex items-baseline gap-2 flex-shrink-0 tabular-nums">
                    <span className="font-semibold text-gray-900">{format(d.value)}</span>
                    <span className="text-gray-400 w-9 text-right">{Math.round((d.value / sum) * 100)}%</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: barsReady ? `${Math.max((d.value / max) * 100, 2)}%` : '0%', backgroundColor: d.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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

  const hotBand = bands.find((b) => b.key === 'hot');
  const coldBand = bands.find((b) => b.key === 'cold');

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-2 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Analytics</span>
                <h1 className="text-2xl font-bold text-gray-900">ภาพรวมผู้ซื้อ</h1>
                <p className="text-sm text-gray-500 mt-1.5">
                  {selectedTenantName
                    ? <>ผู้สนใจซื้ออสังหาฯ ของ <span className="font-semibold text-gray-700">{selectedTenantName}</span> + หลักฐานว่า CDP &amp; AI scoring ทำงานจริง · {leadKpis.total.toLocaleString()} ลีดในบริษัทนี้</>
                    : <>ผู้สนใจซื้ออสังหาฯ ข้ามทุกบริษัท + หลักฐานว่า CDP &amp; AI scoring ทำงานจริง · จาก {leadKpis.tenantsActive} บริษัทที่ใช้ระบบ</>}
                </p>
              </div>
              <TenantCombobox
                value={selectedTenant}
                onChange={setSelectedTenant}
                options={tenants}
                placeholder="เลือกบริษัท"
                className="w-full sm:w-[240px] flex-shrink-0"
              />
            </div>

            {rows.length === 0 && leadsRaw.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Contact className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลผู้สนใจในระบบ</p>
              </div>
            ) : (
              <>
                {/* KPI strip — lead-level glance */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <KpiCard title="ผู้สนใจในระบบ" value={rows.length.toLocaleString()} sub={`${leadKpis.tenantsActive} บริษัทที่ใช้ระบบ`} icon={Users} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="อัตราปิดการขาย" value={`${leadKpis.conversion}%`} sub="ปิดได้ / ลีดทั้งหมด" icon={Percent} color={KK.green} bg={KK.greenLight} />
                </div>

                {/* HERO — AI score accuracy proof (full-width centerpiece) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="mb-1">
                    <h2 className="text-base font-bold text-gray-900">AI ให้คะแนนแม่นแค่ไหน</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">สกอร์ที่ระบบให้แต่ละลีด เทียบ<span className="font-semibold text-gray-700">อัตราปิดจริง</span> · ยิ่งสกอร์สูง ยิ่งปิดได้ = สมองที่เราขาย</p>
                  <div className="space-y-4">
                    {bands.map((b) => (
                      <div key={b.key}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium text-gray-700">
                            <span className="font-bold tracking-wide" style={{ color: b.color }}>{b.label}</span> <span className="text-xs text-gray-400">· {b.range} · {b.leads.toLocaleString()} ลีด</span>
                          </span>
                          <span className="tabular-nums font-bold" style={{ color: b.color }}>{b.winPct}% <span className="text-xs font-normal text-gray-400">ปิดได้</span></span>
                        </div>
                        <div className="flex items-center gap-2.5">
                          <div className="flex-1 h-7 rounded-lg bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-lg transition-[width] duration-1000 ease-out"
                              style={{ width: barsReady ? `${Math.max(b.winPct, 1.5)}%` : '0%', background: `linear-gradient(90deg, ${b.color}cc 0%, ${b.color} 100%)` }} />
                          </div>
                          <span className="text-xs font-semibold tabular-nums w-12 text-right flex-shrink-0" style={{ color: b.color }}>{b.won}/{b.leads}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {hotBand && coldBand && (
                    <p className="text-xs text-gray-500 mt-4 leading-relaxed">
                      ลีดที่ระบบบอกว่า <span className="font-semibold" style={{ color: KK.red }}>HOT ปิดได้ {hotBand.winPct}%</span> เทียบ <span className="font-semibold text-gray-600">COOL {coldBand.winPct}%</span> — ทีมขายโฟกัสถูกตัว ไม่เสียเวลา = คุณค่าที่ลูกค้าจ่ายค่าระบบ
                    </p>
                  )}
                </div>

                {/* เทรนด์ผู้สนใจใหม่ (กว้าง) + ช่วงอายุ/รายได้ (แคบ) — ต่างขนาด = hierarchy */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                      <h2 className="text-base font-bold text-gray-900">ผู้สนใจใหม่เข้าระบบ</h2>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">จำนวนคนที่เพิ่งสนใจต่อเดือน · ย้อนหลัง 6 เดือน — ฐานผู้ซื้อโตหรือแผ่ว</p>
                    <ResponsiveContainer width="100%" height={210}>
                      <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <defs>
                          <linearGradient id="custTrendGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={KK.red} stopOpacity={0.28} />
                            <stop offset="100%" stopColor={KK.red} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} width={32} />
                        <Tooltip contentStyle={kkTooltipStyle} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} formatter={((v: any) => [`${v} คน`, 'ผู้สนใจใหม่']) as any} />
                        <Area type="monotone" dataKey="count" stroke={KK.red} strokeWidth={2.5} fill="url(#custTrendGrad)" dot={{ r: 3, fill: KK.red, strokeWidth: 0 }} activeDot={{ r: 5, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} animationDuration={900} animationEasing="ease-out" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <BarBlock
                    title={demoMode === 'age' ? 'ช่วงอายุ' : 'ช่วงรายได้/เดือน'}
                    sub={demoMode === 'age' ? 'จำนวนผู้สนใจตามช่วงอายุ' : 'จำนวนผู้สนใจตามช่วงรายได้'}
                    data={demoMode === 'age' ? ageData : incomeData}
                    headerRight={
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0 self-start">
                        <button onClick={() => setDemoMode('age')} className={`px-2.5 py-1 transition-colors ${demoMode === 'age' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>อายุ</button>
                        <button onClick={() => setDemoMode('income')} className={`px-2.5 py-1 transition-colors ${demoMode === 'income' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>รายได้</button>
                      </div>
                    }
                  />
                </div>

                {/* Demographics donuts — อาชีพ + วัตถุประสงค์/ช่องทาง (1/2 + 1/2) */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <RankBars
                    title="อาชีพผู้ซื้อ"
                    sub={occMode === 'value' ? 'อาชีพไหน "ซื้อจริง" เยอะสุด · มูลค่าดีลที่ปิดได้' : 'เรียงตามจำนวนคน · รวมอาชีพย่อยเป็น "อื่นๆ"'}
                    data={occBars}
                    fmt={occMode === 'value' ? fmtCompact : undefined}
                    headerRight={
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0 self-start">
                        <button onClick={() => setOccMode('count')} className={`px-2.5 py-1 transition-colors ${occMode === 'count' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>จำนวน</button>
                        <button onClick={() => setOccMode('value')} className={`px-2.5 py-1 transition-colors ${occMode === 'value' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>มูลค่าซื้อ</button>
                      </div>
                    }
                  />
                  <Donut
                    title={purposeMode === 'source' ? 'ช่องทางที่มา' : 'วัตถุประสงค์การซื้อ'}
                    sub={purposeMode === 'source' ? 'ผู้ซื้อมาจากช่องทางไหน' : 'เฉพาะผู้ที่ระบุ · ลงทุน vs อยู่อาศัย'}
                    data={purposeMode === 'source' ? sourceData : purposeData}
                    headerRight={
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs flex-shrink-0 self-start">
                        <button onClick={() => setPurposeMode('purpose')} className={`px-2.5 py-1 transition-colors ${purposeMode === 'purpose' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>วัตถุประสงค์</button>
                        <button onClick={() => setPurposeMode('source')} className={`px-2.5 py-1 transition-colors ${purposeMode === 'source' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>ช่องทาง</button>
                      </div>
                    }
                  />
                </div>

                {/* Top customers table + filters */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">รายชื่อข้อมูลผู้สนใจ</h2>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <select value={purpose} onChange={(e) => setPurpose(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-100">
                        <option value="all">ทุกวัตถุประสงค์</option>
                        {Object.keys(PURPOSE_TH).map((k) => <option key={k} value={k}>{PURPOSE_TH[k]}</option>)}
                      </select>
                      <select value={occ} onChange={(e) => setOcc(e.target.value)} className="h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 max-w-[160px] focus:outline-none focus:ring-2 focus:ring-red-100">
                        <option value="all">ทุกอาชีพ</option>
                        {occOptions.map((k) => <option key={k} value={k}>{OCC_TH[k] || k}</option>)}
                      </select>
                      <div className="relative w-full sm:w-56">
                        <Input placeholder="ค้นหาชื่อ / อาชีพ" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>ลูกค้า</TableHead>
                          <TableHead>อาชีพ</TableHead>
                          <TableHead>วัตถุประสงค์</TableHead>
                          <TableHead className="text-right">อายุ</TableHead>
                          <TableHead className="text-right">รายได้/เดือน</TableHead>
                          <TableHead className="text-right">มูลค่าดีล</TableHead>
                          <TableHead className="text-right">Financial</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((r, i) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-gray-400 tabular-nums">{pageStart + i + 1}</TableCell>
                            <TableCell className="font-semibold text-gray-900">
                              {r.name}
                              {r.won && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ color: KK.green, backgroundColor: KK.greenLight }}>ปิดแล้ว</span>}
                            </TableCell>
                            <TableCell className="text-gray-600">{OCC_TH[r.occupation] || r.occupation}</TableCell>
                            <TableCell className="text-gray-600">{PURPOSE_TH[r.purpose] || r.purpose}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.age || '–'}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.income ? fmtCompact(r.income) : '–'}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">{r.estValue ? fmtCompact(r.estValue) : '–'}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{r.financial ? `${Math.round(r.financial)}` : '–'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-8">ไม่พบลูกค้าที่ตรงเงื่อนไข</p>}
                  </div>
                  {filtered.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} จาก {filtered.length} ราย</span>
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
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerCustomers;
