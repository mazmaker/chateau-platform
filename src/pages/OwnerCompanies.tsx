import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, TrendingUp, Percent, ArrowUpRight, ChevronRight, Search } from 'lucide-react';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import SalesAgentsSection from '@/components/owner/SalesAgentsSection';

// ──────────────────────────────────────────────────────────────────────────
// ประสิทธิภาพบริษัท — Owner cross-tenant company performance (HQ lens).
// Best/worst by sales value + per-company sparkline small-multiples + ranking,
// each row drills into that company's projects (/owner-projects/:id).
// Data: sold units across all customer tenants; read-only via Owner RLS.
// See documents/owner-hq-dashboard-plan.md.
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
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
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
const THAI_MONTH = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
// Donut slice palette — distinct hues so each company reads apart at a glance.
const PIE_COLORS = ['#1e3a5f', '#ef4444', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'];

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Active',     color: '#16a34a', bg: '#f0fdf4' },
  trial:     { label: 'Trial',      color: '#d97706', bg: '#fefce8' },
  suspended: { label: 'ระงับ',     color: '#ef4444', bg: '#fef2f2' },
  cancelled: { label: 'Cancelled', color: '#94a3b8', bg: '#f8fafc' },
};
const getBadge = (s: string) => STATUS_BADGE[s] ?? STATUS_BADGE['active'];

interface UnitRow { tenant_id: string; price: number | null; status: string | null; sold_at: string | null; }
interface CompanyAgg {
  id: string; name: string; plan: string; status: string;
  gdv: number; sold: number; total: number; soldValue: number; leads: number;
  sellThrough: number;
  series: { month: string; count: number }[];
}

const buildSeries = (dates: (string | null)[]) => {
  const base = new Date(); base.setDate(1); base.setHours(0, 0, 0, 0);
  const out: { month: string; count: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const next = new Date(base.getFullYear(), base.getMonth() - i + 1, 1);
    out.push({
      month: THAI_MONTH[d.getMonth()],
      count: dates.filter((s) => { if (!s) return false; const t = new Date(s); return t >= d && t < next; }).length,
    });
  }
  return out;
};

const OwnerCompanies = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rawUnits, setRawUnits] = useState<UnitRow[]>([]);
  const [tlist, setTlist] = useState<{ id: string; name: string; subscription_plan: string; status: string }[]>([]);
  const [leadCountMap, setLeadCountMap] = useState<Map<string, number>>(new Map());
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  useEffect(() => { setCurrentPage(1); }, [period, searchQuery, statusFilter]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, name, subscription_plan, status').eq('is_platform' as any, false);
      const tlist = (tenants || []) as { id: string; name: string; subscription_plan: string; status: string }[];
      const ids = tlist.map((t) => t.id);
      if (ids.length > 0) {
        const [uRes, lRes] = await Promise.all([
          supabase.from('units').select('tenant_id, price, status, sold_at').in('tenant_id', ids),
          supabase.from('leads').select('tenant_id').in('tenant_id', ids),
        ]);
        const units = (uRes.data || []) as UnitRow[];
        const leads = (lRes.data || []) as { tenant_id: string }[];
        const leadCount = new Map<string, number>();
        leads.forEach((l) => leadCount.set(l.tenant_id, (leadCount.get(l.tenant_id) || 0) + 1));
        setRawUnits(units);
        setTlist(tlist);
        setLeadCountMap(leadCount);
      }
    } catch (e) {
      console.error('OwnerCompanies fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Per-company aggregate — SALES metrics (sold / soldValue / sell-through / series)
  // scope to the selected period; total/GDV stay all-time (portfolio snapshot).
  // Ranked by sold value IN the period → "who sold most this window".
  const rows = useMemo<CompanyAgg[]>(() => {
    const { from, to } = periodToRange(period);
    const inRange = (s: string | null) => { if (!s) return false; const t = new Date(s); return (!from || t >= from) && t <= to; };
    const byTenant = new Map<string, UnitRow[]>();
    rawUnits.forEach((u) => { const arr = byTenant.get(u.tenant_id) || []; arr.push(u); byTenant.set(u.tenant_id, arr); });
    return tlist.map((t) => {
      const tUnits = byTenant.get(t.id) || [];
      let gdv = 0, sold = 0, soldValue = 0;
      const soldDates: (string | null)[] = [];
      tUnits.forEach((u) => {
        const price = Number(u.price) || 0;
        gdv += price;
        if (u.status === 'sold' && inRange(u.sold_at)) { sold += 1; soldValue += price; soldDates.push(u.sold_at); }
      });
      return {
        id: t.id, name: t.name, plan: t.subscription_plan, status: t.status || 'active',
        gdv, sold, total: tUnits.length, soldValue, leads: leadCountMap.get(t.id) || 0,
        sellThrough: tUnits.length > 0 ? Math.round((sold / tUnits.length) * 100) : 0,
        series: buildSeries(soldDates),
      };
    }).filter((r) => r.total > 0).sort((a, b) => b.soldValue - a.soldValue);
  }, [rawUnits, tlist, leadCountMap, period]);

  const totals = useMemo(() => {
    const soldValue = rows.reduce((s, r) => s + r.soldValue, 0);
    const sold = rows.reduce((s, r) => s + r.sold, 0);
    const total = rows.reduce((s, r) => s + r.total, 0);
    const gdv = rows.reduce((s, r) => s + r.gdv, 0);
    return { companies: rows.length, soldValue, sold, gdv, sellThrough: total > 0 ? Math.round((sold / total) * 100) : 0 };
  }, [rows]);

  // Donut data: share of sold value by company. Top 8 explicit, rest pooled into "อื่น ๆ".
  const pieData = useMemo(() => {
    const withVal = rows.filter((r) => r.soldValue > 0);
    const grand = withVal.reduce((s, r) => s + r.soldValue, 0) || 1;
    const TOP = 8;
    const top = withVal.slice(0, TOP);
    const restVal = withVal.slice(TOP).reduce((s, r) => s + r.soldValue, 0);
    const items = top.map((r, i) => ({
      name: r.name, value: r.soldValue, color: PIE_COLORS[i % PIE_COLORS.length],
      pct: Math.round((r.soldValue / grand) * 100),
    }));
    if (restVal > 0) items.push({ name: 'อื่น ๆ', value: restVal, color: KK.gray, pct: Math.round((restVal / grand) * 100) });
    return items;
  }, [rows]);

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

  const q = searchQuery.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    (statusFilter === 'all' || r.status === statusFilter) &&
    (!q || r.name.toLowerCase().includes(q))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Analytics
                </span>
                <h1 className="text-2xl font-bold text-gray-900">อันดับยอดขาย</h1>
                <p className="text-sm text-gray-500 mt-1.5">เรียงตามมูลค่าขาย{periodRangeLabel(period)} · ข้ามทั้งแพลตฟอร์ม · Sell-through/GDV = สะสม</p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="strategic" className="self-start sm:self-auto shrink-0" />
            </div>

            <Tabs defaultValue="company" className="space-y-7">
              <TabsList>
                <TabsTrigger value="company">รายบริษัท</TabsTrigger>
                <TabsTrigger value="agents">ทีมขาย</TabsTrigger>
              </TabsList>

              <TabsContent value="company" className="space-y-7 mt-2 focus-visible:outline-none">
            {rows.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีบริษัทที่มียูนิตในระบบ</p>
              </div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <KpiCard title="บริษัทในอันดับ" value={totals.companies.toLocaleString()} sub="มียูนิตในระบบ" icon={Building2} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="มูลค่าขายเฉลี่ย/บริษัท" value={fmtCompact(totals.companies > 0 ? totals.soldValue / totals.companies : 0)} sub="ต่อบริษัทที่มียูนิต" icon={TrendingUp} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="Sell-through รวม" value={`${totals.sellThrough}%`} sub="ขายแล้ว / ทั้งหมด" icon={Percent} color={KK.amber} bg={KK.amberLight} />
                </div>

                {/* Overview donut: share of sold value by company (เฮีย: ภาพรวมต้องเป็นวงกลม เห็นก้อนใหญ่สุด) */}
                {pieData.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-bold text-gray-900">สัดส่วนมูลค่าขายตามบริษัท</h2>
                      <p className="text-xs text-gray-500 mt-0.5">ก้อนใหญ่สุด = บริษัทที่ทำยอดขายได้มากสุด · ชี้ที่กราฟเพื่อดูมูลค่า</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={100} paddingAngle={2} stroke="white" strokeWidth={2}>
                              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [fmtCompact(Number(v)), n]) as any} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {pieData.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="truncate text-gray-700">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                              <span className="text-gray-900 font-semibold">{fmtCompact(d.value)}</span>
                              <span className="text-gray-400 w-10 text-right">{d.pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Ranking table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">อันดับบริษัท</h2>
                      <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าขาย · คลิกเพื่อดูรายโครงการ</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="ค้นหาบริษัท..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="h-9 w-[180px] pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                        />
                      </div>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทุกสถานะ</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="suspended">ระงับ</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>บริษัท</TableHead>
                          <TableHead>สถานะ</TableHead>
                          <TableHead className="text-right">มูลค่าขาย</TableHead>
                          <TableHead className="text-right">ยูนิต (ขาย/ทั้งหมด)</TableHead>
                          <TableHead className="text-right">Sell-through</TableHead>
                          <TableHead className="text-right">Leads</TableHead>
                          <TableHead className="text-right">GDV</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginated.map((r, i) => (
                          <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate(`/owner-projects/${r.id}`)}>
                            <TableCell className="text-gray-400 tabular-nums">{pageStart + i + 1}</TableCell>
                            <TableCell className="font-semibold text-gray-900">{r.name}</TableCell>
                            <TableCell>
                              {(() => {
                                const b = getBadge(r.status);
                                return (
                                  <span
                                    className="text-xs font-semibold px-2 py-0.5 rounded-full cursor-pointer whitespace-nowrap"
                                    style={{ color: b.color, backgroundColor: b.bg }}
                                    onClick={(e) => { e.stopPropagation(); navigate(`/tenants/${r.id}`); }}
                                    title="ดูรายละเอียดบริษัท"
                                  >
                                    {b.label}
                                  </span>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{fmtCompact(r.soldValue)}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.sold}/{r.total}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.sellThrough}%</TableCell>
                            <TableCell className="text-right tabular-nums">{r.leads}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{fmtCompact(r.gdv)}</TableCell>
                            <TableCell className="text-right"><ArrowUpRight className="w-4 h-4 text-gray-400 inline" /></TableCell>
                          </TableRow>
                        ))}
                        {paginated.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="text-center text-sm text-gray-400 py-8">ไม่พบบริษัทที่ตรงเงื่อนไข</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {filtered.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} จาก {filtered.length} บริษัท</span>
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
              </TabsContent>

              <TabsContent value="agents" className="mt-2 focus-visible:outline-none">
                <SalesAgentsSection period={period} />
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerCompanies;
