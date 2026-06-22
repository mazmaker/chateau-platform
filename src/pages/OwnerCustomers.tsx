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
import { Users, Banknote, Target, Briefcase, Contact, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

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
const DONUT_COLORS = [KK.blue, KK.red, KK.green, KK.amber, KK.slate, '#7c3aed', '#0891b2', '#db2777'];

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
interface LeadLite { customer_id: string | null; status: string | null; estimated_value: number | null; financial_score: number | null; }
interface Enriched {
  id: string; name: string; occupation: string; purpose: string;
  age: number; income: number; debt: number; estValue: number; financial: number; won: boolean;
}

const OwnerCustomers = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Enriched[]>([]);
  const [search, setSearch] = useState('');
  const [occ, setOcc] = useState('all');
  const [purpose, setPurpose] = useState('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
        const [cRes, lRes] = await Promise.all([
          supabase.from('customers').select('id, full_name, tenant_id, acquisition_source, preferences').in('tenant_id', ids),
          supabase.from('leads').select('customer_id, status, estimated_value, financial_score').in('tenant_id', ids),
        ]);
        const customers = (cRes.data || []) as CustomerRow[];
        const leads = (lRes.data || []) as LeadLite[];

        // Per-customer rollup from leads: biggest estimated deal + won flag + financial score.
        const byCust = new Map<string, { estValue: number; financial: number; won: boolean }>();
        leads.forEach((l) => {
          if (!l.customer_id) return;
          const r = byCust.get(l.customer_id) || { estValue: 0, financial: 0, won: false };
          r.estValue = Math.max(r.estValue, Number(l.estimated_value) || 0);
          r.financial = Math.max(r.financial, Number(l.financial_score) || 0);
          if (l.status === 'won') r.won = true;
          byCust.set(l.customer_id, r);
        });

        const enriched: Enriched[] = customers.map((c) => {
          const p = c.preferences || {};
          const lead = byCust.get(c.id);
          return {
            id: c.id,
            name: c.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'ไม่ระบุชื่อ',
            occupation: p.occupation || 'other',
            purpose: p.purchase_purpose || 'other',
            age: Number(p.age) || 0,
            income: Number(p.monthly_income) || 0,
            debt: Number(p.monthly_debt) || 0,
            estValue: lead?.estValue || 0,
            financial: lead?.financial || 0,
            won: lead?.won || false,
          };
        });
        setRows(enriched);
      }
    } catch (e) {
      console.error('OwnerCustomers fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── Distributions ────────────────────────────────────────────────────────
  const purposeData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => { if (r.purpose && r.purpose !== 'other') m.set(r.purpose, (m.get(r.purpose) || 0) + 1); });
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: PURPOSE_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const occData = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach((r) => m.set(r.occupation, (m.get(r.occupation) || 0) + 1));
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: OCC_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const ageData = useMemo(() => AGE_BANDS.map((b) => ({
    label: b.label, count: rows.filter((r) => r.age >= b.min && r.age < b.max).length,
  })), [rows]);

  const incomeData = useMemo(() => INCOME_BANDS.map((b) => ({
    label: b.label, count: rows.filter((r) => r.income >= b.min && r.income < b.max).length,
  })), [rows]);

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const total = rows.length;
    const incomes = rows.map((r) => r.income).filter((v) => v > 0);
    const avgIncome = incomes.length ? Math.round(incomes.reduce((s, v) => s + v, 0) / incomes.length) : 0;
    const wonVals = rows.filter((r) => r.estValue > 0);
    const avgDeal = wonVals.length ? Math.round(wonVals.reduce((s, r) => s + r.estValue, 0) / wonVals.length) : 0;
    const topPurpose = purposeData[0];
    return { total, avgIncome, avgDeal, topPurpose };
  }, [rows, purposeData]);

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

  const Donut = ({ title, sub, data }: { title: string; sub: string; data: { name: string; value: number; color: string }[] }) => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500 mb-2 mt-0.5">{sub}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={54} outerRadius={84} paddingAngle={2} stroke="white" strokeWidth={2}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} คน`, n]) as any} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {data.slice(0, 6).map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600 flex-1 truncate">{d.name}</span>
              <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
              <span className="text-gray-400 tabular-nums w-9 text-right">{Math.round((d.value / (data.reduce((s, x) => s + x.value, 0) || 1)) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const BarBlock = ({ title, sub, data }: { title: string; sub: string; data: { label: string; count: number }[] }) => (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <p className="text-xs text-gray-500 mb-4 mt-0.5">{sub}</p>
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
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                ผู้สนใจ
              </span>
              <h1 className="text-2xl font-bold text-gray-900">ฐานข้อมูลผู้สนใจ</h1>
              <p className="text-sm text-gray-500 mt-1.5">ผู้สนใจซื้ออสังหาฯ ข้ามทุกบริษัท · มีรายชื่อ ≠ ซื้อแล้ว (CDP)</p>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Contact className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลลูกค้าในระบบ</p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="ผู้สนใจซื้อทั้งหมด" value={kpis.total.toLocaleString()} sub="ข้ามทุกบริษัท" icon={Users} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="รายได้เฉลี่ย/เดือน" value={fmtCompact(kpis.avgIncome)} sub="ต่อคน" icon={Banknote} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="มูลค่าดีลเฉลี่ย" value={fmtCompact(kpis.avgDeal)} sub="ประเมินจากลีด" icon={Target} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="วัตถุประสงค์เด่น" value={kpis.topPurpose?.name || '–'} sub={`${kpis.topPurpose?.value || 0} คน`} icon={Briefcase} color={KK.amber} bg={KK.amberLight} />
                </div>

                {/* Donuts: purpose + occupation */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Donut title="วัตถุประสงค์การซื้อ" sub="เฉพาะผู้ที่ระบุ · ลงทุน vs อยู่อาศัย" data={purposeData} />
                  <Donut title="อาชีพผู้ซื้อ" sub="สัดส่วนตามกลุ่มอาชีพ" data={occData} />
                </div>

                {/* Bars: age + income */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <BarBlock title="ช่วงอายุ" sub="จำนวนลูกค้าตามช่วงอายุ" data={ageData} />
                  <BarBlock title="ช่วงรายได้/เดือน" sub="จำนวนลูกค้าตามช่วงรายได้" data={incomeData} />
                </div>

                {/* Top customers table + filters */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">ลูกค้ารายใหญ่</h2>
                      <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าดีล/รายได้</p>
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
