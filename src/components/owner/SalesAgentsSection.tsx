import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trophy, TrendingUp, Percent, Users, ChevronRight, Search, Phone, Mail, Building2, Calendar, Clock, Tag } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
// Thai mobile 10-digit → 0XX-XXX-XXXX
const fmtPhone = (p: string | null): string | null => {
  if (!p) return null;
  const d = p.replace(/\D/g, '');
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : p;
};
const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '–');
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
};
const PIE_COLORS = ['#1e3a5f', '#ef4444', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'];

// Labelled contact/meta row for the detail panel.
const InfoItem = ({ icon: Icon, label, value, muted }: { icon: React.ElementType; label: string; value: string; muted?: boolean }) => (
  <div className="flex items-start gap-2.5 min-w-0">
    <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
    <div className="min-w-0">
      <p className="text-xs text-gray-400 leading-tight">{label}</p>
      <p className={`text-sm truncate mt-0.5 ${muted ? 'text-gray-400' : 'text-gray-800 font-medium'}`}>{value}</p>
    </div>
  </div>
);

// KPI cell for the detail panel performance strip (no background tint — sits in a divided card).
const StatBox = ({ value, label, color }: { value: string; label: string; color?: string }) => (
  <div className="py-3 px-2 text-center">
    <div className="text-base font-bold tabular-nums leading-tight" style={{ color: color || '#111827' }}>{value}</div>
    <div className="text-xs text-gray-500 mt-1">{label}</div>
  </div>
);

interface UserRow {
  id: string; full_name: string | null; role: string | null; tenant_id: string | null;
  email: string | null; phone: string | null; is_active: boolean | null;
  last_sign_in_at: string | null; created_at: string | null; referral_code: string | null;
}
interface LeadRow { assigned_to: string | null; status: string | null; estimated_value: number | null; referred_by_agent_id: string | null; updated_at: string | null; property_id: string | null; }
interface Deal { project: string; value: number; date: string | null; }
interface PerfRow {
  id: string; name: string; role: string; company: string;
  assigned: number; won: number; wonValue: number; referrals: number; conversion: number;
  email: string | null; phone: string | null; isActive: boolean | null;
  lastLogin: string | null; joined: string | null; referralCode: string | null;
}

const SalesAgentsSection = ({ period }: { period: PeriodKey }) => {
  const [loading, setLoading] = useState(true);
  const [rawUsers, setRawUsers] = useState<UserRow[]>([]);
  const [rawLeads, setRawLeads] = useState<LeadRow[]>([]);
  const [tenantNameMap, setTenantNameMap] = useState<Map<string, string>>(new Map());
  const [propMap, setPropMap] = useState<Map<string, string>>(new Map());
  const [selected, setSelected] = useState<PerfRow | null>(null);
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
        const [uRes, lRes, pRes] = await Promise.all([
          supabase.from('users').select('id, full_name, role, tenant_id, email, phone, is_active, last_sign_in_at, created_at, referral_code').in('tenant_id', ids),
          supabase.from('leads').select('assigned_to, status, estimated_value, referred_by_agent_id, updated_at, property_id').in('tenant_id', ids),
          supabase.from('properties').select('id, name').in('tenant_id', ids),
        ]);
        setRawUsers((uRes.data || []) as UserRow[]);
        setRawLeads((lRes.data || []) as LeadRow[]);
        setPropMap(new Map(((pRes.data || []) as { id: string; name: string }[]).map((p) => [p.id, p.name])));
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
          email: u.email, phone: u.phone, isActive: u.is_active,
          lastLogin: u.last_sign_in_at, joined: u.created_at, referralCode: u.referral_code,
        } as PerfRow;
      })
      // ทีมขาย = พนักงานขาย (sales) + นายหน้า (agent) เท่านั้น — admin/owner ไม่ใช่ทีมขาย
      .filter((r): r is PerfRow => r !== null && (r.role === 'sales' || r.role === 'agent') && (r.assigned > 0 || r.referrals > 0))
      .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won);
  }, [rawLeads, rawUsers, tenantNameMap, period]);

  // Won-deal breakdown per person (in-period) — the source behind each row's "มูลค่าดีล",
  // so the detail panel can answer "เงินก้อนนี้มาจากดีลไหนบ้าง" (project + value only, no customer PII).
  const dealsByPerson = useMemo<Map<string, Deal[]>>(() => {
    const { from, to } = periodToRange(period);
    const inPeriod = (s: string | null) => { if (!s) return false; const t = new Date(s); return (!from || t >= from) && t <= to; };
    const m = new Map<string, Deal[]>();
    rawLeads.forEach((l) => {
      if (l.status !== 'won' || !l.assigned_to || !inPeriod(l.updated_at)) return;
      const arr = m.get(l.assigned_to) || [];
      arr.push({ project: propMap.get(l.property_id || '') || 'ไม่ระบุโครงการ', value: Number(l.estimated_value) || 0, date: l.updated_at });
      m.set(l.assigned_to, arr);
    });
    m.forEach((arr) => arr.sort((a, b) => b.value - a.value));
    return m;
  }, [rawLeads, propMap, period]);

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
                    <TableRow key={r.id} className="cursor-pointer hover:bg-gray-50 group" onClick={() => setSelected(r)}>
                      <TableCell className="text-gray-400 tabular-nums">{pageStart + i + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900">{r.name}</span>
                          <Badge variant="outline" className="text-xs px-1.5 py-0">{ROLE_TH[r.role] || r.role}</Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-chateau transition-colors flex-shrink-0" />
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

      {/* Salesperson detail — contact + activity + performance + deal sources (no customer PII) */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[88vh] overflow-y-auto p-0 gap-0">
          {selected && (() => {
            const deals = dealsByPerson.get(selected.id) || [];
            const maxDeal = Math.max(...deals.map((d) => d.value), 1);
            const initial = (selected.name.trim()[0] || '?').toUpperCase();
            const accent = selected.role === 'agent' ? KK.blue : KK.red;
            return (
              <>
                {/* Header band — avatar + identity */}
                <div className="px-6 pt-6 pb-5 border-b border-gray-100">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow-soft"
                      style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)` }}>
                      {initial}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <DialogTitle className="text-lg font-bold text-gray-900 leading-tight">{selected.name}</DialogTitle>
                        <Badge variant="outline" className="text-xs px-1.5 py-0">{ROLE_TH[selected.role] || selected.role}</Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1.5 text-gray-500">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="text-sm truncate">{selected.company}</span>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 mt-2.5 text-xs px-2 py-0.5 rounded-full font-medium ${selected.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: selected.isActive ? KK.green : KK.gray }} />
                        {selected.isActive ? 'ใช้งานอยู่' : 'ปิดใช้งาน'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* ติดต่อ / meta — labelled 2-col grid */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3.5">
                    <InfoItem icon={Mail} label="อีเมล" value={selected.email || '–'} />
                    <InfoItem icon={Phone} label="เบอร์โทร" value={fmtPhone(selected.phone) || 'ยังไม่ได้กรอก'} muted={!selected.phone} />
                    {selected.referralCode && <InfoItem icon={Tag} label="โค้ดแนะนำ" value={selected.referralCode} />}
                    <InfoItem icon={Clock} label="เข้าใช้งานล่าสุด" value={fmtDate(selected.lastLogin)} muted={!selected.lastLogin} />
                    <InfoItem icon={Calendar} label="เข้าร่วมเมื่อ" value={fmtDate(selected.joined)} />
                  </div>

                  {/* ผลงานช่วงที่เลือก — tinted stat boxes */}
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2.5">ผลงาน · {periodRangeLabel(period)}</p>
                    <div className="grid grid-cols-4 rounded-xl border border-gray-100 divide-x divide-gray-100">
                      <StatBox value={selected.assigned.toLocaleString()} label="Lead ดูแล" />
                      <StatBox value={selected.won.toLocaleString()} label="ปิดได้" color={KK.green} />
                      <StatBox value={`${selected.conversion}%`} label="Conversion" />
                      <StatBox value={fmtCompact(selected.wonValue)} label="มูลค่าดีล" color={KK.red} />
                    </div>
                  </div>

                  {/* ที่มาของมูลค่า — ranked deals with relative bars */}
                  <div>
                    <div className="flex items-baseline justify-between mb-1">
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">ดีลที่ปิดได้ · ที่มาของมูลค่า</p>
                      <span className="text-xs text-gray-400 tabular-nums">{deals.length} ดีล</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">{fmtCompact(selected.wonValue)} แยกตามโครงการ · ไม่แสดงข้อมูลลูกค้า (PDPA)</p>
                    {deals.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-xl">ไม่มีดีลปิดในช่วงนี้</p>
                    ) : (
                      <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1 -mr-1">
                        {deals.map((d, idx) => (
                          <div key={idx} className="flex items-center gap-3">
                            <span className="w-5 text-xs font-bold tabular-nums text-gray-300 text-center flex-shrink-0">{idx + 1}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm text-gray-700 truncate">{d.project}</span>
                                <span className="text-sm font-semibold text-gray-900 tabular-nums flex-shrink-0">{fmtCompact(d.value)}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden flex-1">
                                  <div className="h-full rounded-full" style={{ width: `${Math.max((d.value / maxDeal) * 100, 3)}%`, background: idx === 0 ? KK.red : '#fca5a5' }} />
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0 tabular-nums">{fmtDate(d.date)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SalesAgentsSection;
