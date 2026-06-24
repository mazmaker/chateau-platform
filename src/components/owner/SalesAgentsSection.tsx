import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, Percent, Users, ChevronRight, Search } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { type PeriodKey, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';

// ──────────────────────────────────────────────────────────────────────────
// อันดับผู้ขาย (เจาะรายคน) — extracted from the old standalone "Sales Performance"
// page and merged into อันดับยอดขายรายบริษัท as a drill-down section: the company
// rollup is shown first (ดูรวมก่อน), then this per-salesperson detail below it.
// Owner cross-tenant ranking of sales staff + agents, measured from leads
// (assigned + won). NO per-customer PII (PDPA). Read-only via Owner RLS.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', border: '#e5e7eb',
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
const ROLE_TH: Record<string, string> = { sales: 'พนักงานขาย', agent: 'นายหน้า', admin: 'ผู้ดูแลบริษัท', owner: 'แพลตฟอร์ม' };
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
};
const PIE_COLORS = ['#1e3a5f', '#ef4444', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'];

interface UserRow { id: string; full_name: string | null; role: string | null; tenant_id: string | null; }
interface LeadRow { assigned_to: string | null; status: string | null; estimated_value: number | null; referred_by_agent_id: string | null; updated_at: string | null; }
interface PerfRow {
  id: string; name: string; role: string; company: string;
  assigned: number; won: number; wonValue: number; referrals: number; conversion: number;
}

const SalesAgentsSection = ({ period }: { period: PeriodKey }) => {
  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState<UserRow[]>([]);
  const [rawLeads, setRawLeads] = useState<LeadRow[]>([]);
  const [tenantNameMap, setTenantNameMap] = useState<Map<string, string>>(new Map());
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => { fetchAll(); }, []);
  useEffect(() => { setCurrentPage(1); }, [searchQuery, roleFilter, period]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const tlist = (tenants || []) as { id: string; name: string }[];
      const ids = tlist.map((t) => t.id);
      setTenantNameMap(new Map(tlist.map((t) => [t.id, t.name])));
      if (ids.length > 0) {
        const [uRes, lRes] = await Promise.all([
          supabase.from('users').select('id, full_name, role, tenant_id').in('tenant_id', ids),
          supabase.from('leads').select('assigned_to, status, estimated_value, referred_by_agent_id, updated_at').in('tenant_id', ids),
        ]);
        setRawUsers((uRes.data || []) as UserRow[]);
        setRawLeads((lRes.data || []) as LeadRow[]);
      }
    } catch (e) {
      console.error('SalesAgentsSection fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Per-salesperson rollup — scoped to the selected period via lead activity date (updated_at).
  // No won_at column → updated_at ≈ the won/last-touch date (same proxy as the deal card).
  const rows = useMemo<PerfRow[]>(() => {
    const { from, to } = periodToRange(period);
    const inPeriod = (s: string | null) => { if (!s) return false; const t = new Date(s); return (!from || t >= from) && t <= to; };
    const perf = new Map<string, { assigned: number; won: number; wonValue: number; referrals: number }>();
    const ensure = (id: string) => {
      let r = perf.get(id);
      if (!r) { r = { assigned: 0, won: 0, wonValue: 0, referrals: 0 }; perf.set(id, r); }
      return r;
    };
    rawLeads.forEach((l) => {
      if (!inPeriod(l.updated_at)) return;
      if (l.assigned_to) {
        const r = ensure(l.assigned_to);
        r.assigned += 1;
        if (l.status === 'won') { r.won += 1; r.wonValue += Number(l.estimated_value) || 0; }
      }
      if (l.referred_by_agent_id) ensure(l.referred_by_agent_id).referrals += 1;
    });
    return rawUsers
      .map((u) => {
        const p = perf.get(u.id);
        if (!p) return null;
        return {
          id: u.id,
          name: u.full_name || 'ไม่ระบุชื่อ',
          role: u.role || 'unknown',
          company: tenantNameMap.get(u.tenant_id || '') || '–',
          assigned: p.assigned, won: p.won, wonValue: p.wonValue, referrals: p.referrals,
          conversion: p.assigned > 0 ? Math.round((p.won / p.assigned) * 100) : 0,
        } as PerfRow;
      })
      // ทีมขาย = พนักงานขาย (sales) + นายหน้า (agent) เท่านั้น — admin/owner ไม่ใช่ทีมขาย
      .filter((r): r is PerfRow => r !== null && (r.role === 'sales' || r.role === 'agent') && (r.assigned > 0 || r.referrals > 0))
      .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won);
  }, [rawLeads, rawUsers, tenantNameMap, period]);

  const totals = useMemo(() => {
    const won = rows.reduce((s, r) => s + r.won, 0);
    const assigned = rows.reduce((s, r) => s + r.assigned, 0);
    const wonValue = rows.reduce((s, r) => s + r.wonValue, 0);
    return { people: rows.length, won, wonValue, conversion: assigned > 0 ? Math.round((won / assigned) * 100) : 0 };
  }, [rows]);

  const pieData = useMemo(() => {
    const withVal = rows.filter((r) => r.wonValue > 0);
    const grand = withVal.reduce((s, r) => s + r.wonValue, 0) || 1;
    const TOP = 8;
    const head = withVal.slice(0, TOP);
    const restVal = withVal.slice(TOP).reduce((s, r) => s + r.wonValue, 0);
    const items = head.map((r, i) => ({
      name: r.name, value: r.wonValue, color: PIE_COLORS[i % PIE_COLORS.length],
      pct: Math.round((r.wonValue / grand) * 100),
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

  const q = searchQuery.trim().toLowerCase();
  const filtered = rows.filter((r) =>
    (roleFilter === 'all' || r.role === roleFilter) &&
    (!q || r.name.toLowerCase().includes(q) || r.company.toLowerCase().includes(q))
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

  return (
    <div className="space-y-7">
      <p className="text-sm text-gray-500">พนักงานขาย/นายหน้าทั้งแพลตฟอร์ม · วัดจาก Lead ที่ดูแลและปิดได้ · {periodRangeLabel(period)}</p>

      {loading ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-sm text-gray-500">กำลังโหลดอันดับทีมขาย...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
          <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">ยังไม่มีข้อมูลผลงานทีมขาย</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard title="ทีมขายทั้งหมด" value={totals.people.toLocaleString()} sub="มี Lead ดูแล" icon={Users} color={KK.blue} bg={KK.blueLight} />
            <KpiCard title="ดีลปิดรวม (won)" value={totals.won.toLocaleString()} sub="ทั้งแพลตฟอร์ม" icon={Trophy} color={KK.green} bg={KK.greenLight} />
            <KpiCard title="มูลค่าดีล (ประเมิน)" value={fmtCompact(totals.wonValue)} sub="ประเมินจาก Lead" icon={TrendingUp} color={KK.red} bg={KK.redLight} />
            <KpiCard title="Conversion เฉลี่ย" value={`${totals.conversion}%`} sub="ปิดได้ / ดูแลทั้งหมด" icon={Percent} color={KK.amber} bg={KK.amberLight} />
          </div>

          {pieData.length > 0 && (
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">สัดส่วนมูลค่าดีลที่ปิดได้ตามทีมขาย</h2>
                <p className="text-xs text-gray-500 mt-0.5">ก้อนใหญ่สุด = คนในทีมขายที่ปิดดีลได้มูลค่ามากสุด · ชี้ที่กราฟเพื่อดูมูลค่า</p>
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
                    <div key={i} className="flex items-center justify-between gap-3 text-sm">
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

          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900">อันดับทีมขาย</h2>
                <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าดีลที่ปิดได้</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="ค้นหาชื่อ / บริษัท..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 w-[200px] pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                  />
                </div>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกบทบาท</SelectItem>
                    <SelectItem value="sales">พนักงานขาย</SelectItem>
                    <SelectItem value="agent">นายหน้า</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead>รายชื่อ</TableHead>
                    <TableHead>บริษัท</TableHead>
                    <TableHead className="text-right">Lead ดูแล</TableHead>
                    <TableHead className="text-right">ปิดได้</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">มูลค่าดีล</TableHead>
                    <TableHead className="text-right">แนะนำ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-gray-400 tabular-nums">{pageStart + i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{r.name}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">{ROLE_TH[r.role] || r.role}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-gray-600">{r.company}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold" style={{ color: KK.green }}>{r.won}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.conversion}%</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtCompact(r.wonValue)}</TableCell>
                      <TableCell className="text-right tabular-nums text-gray-500">{r.referrals || '–'}</TableCell>
                    </TableRow>
                  ))}
                  {paginated.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-sm text-gray-400 py-8">ไม่พบรายชื่อที่ตรงเงื่อนไข</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
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
    </div>
  );
};

export default SalesAgentsSection;
