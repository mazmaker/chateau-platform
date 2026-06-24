import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Users, AlertTriangle, Award, ArrowUpDown, Loader2, CheckCircle, Search, ChevronRight,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

// Standalone "Team Performance" page for Owner/Admin.
// Decouples the per-staff drill-down from /analytics — managers can land here
// directly from the sidebar instead of scrolling to find the Sales Leaderboard.
// Reuses the same data shape; click any row to navigate to /team/:id/performance.

interface LeadLite {
  id: string;
  status: string | null;
  assigned_to: string | null;
  estimated_value: number | null;
  created_at: string;
  updated_at: string;
}

interface UserLite {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface TeamRow {
  userId: string;
  name: string;
  role: string;
  leadsTotal: number;     // total leads ever assigned
  leadsThisMonth: number; // new leads created this month
  won: number;            // deals closed this month
  wonValue: number;       // revenue this month
  openLeads: number;      // active leads in pipeline
  convRate: number;       // won / leads ratio (0-100)
}

type SortKey = 'wonValue' | 'won' | 'convRate' | 'leadsThisMonth' | 'openLeads';
type RoleFilter = 'all' | 'sales' | 'agent';

const ROLE_LABEL: Record<string, string> = {
  sales: 'พนักงานขาย',
  agent: 'นายหน้า',
  admin: 'ผู้ดูแลบริษัท',
  owner: 'เจ้าของแพลตฟอร์ม',
};

// Compact THB — Thai convention "X ล้าน" / "K" (matches canonical formatTHB in Index.tsx).
const formatTHB = (n: number) => {
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

const startOfMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};

export default function TeamPerformance() {
  const navigate = useNavigate();
  const { userRole, currentTenant } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [users, setUsers] = useState<UserLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [atRiskOnly, setAtRiskOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('wonValue');
  const [sortDesc, setSortDesc] = useState(true);
  const [nameQuery, setNameQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // "At risk" rule kept identical to the KPI definition below so the count on the
  // card and the rows the table highlights are always consistent.
  const isAtRisk = (r: TeamRow) => r.won === 0 && r.openLeads > 0;

  const allowed = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (!allowed || !currentTenant?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [leadsRes, usersRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, status, assigned_to, estimated_value, created_at, updated_at')
            .eq('tenant_id', currentTenant.id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('users') as any)
            .select('id, full_name, email, role')
            .eq('tenant_id', currentTenant.id)
            .in('role', ['sales', 'agent']),
        ]);
        setLeads((leadsRes.data || []) as LeadLite[]);
        setUsers((usersRes.data || []) as UserLite[]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [allowed, currentTenant?.id]);

  // ─── Derive per-user metrics ──────────────────────────────
  const rows: TeamRow[] = useMemo(() => {
    if (users.length === 0) return [];
    const tStart = startOfMonth();
    const out: TeamRow[] = [];

    for (const u of users) {
      const my = leads.filter(l => l.assigned_to === u.id);
      const myWonThisMonth = my.filter(l =>
        l.status === 'won' && new Date(l.updated_at) >= tStart
      );
      const myLeadsThisMonth = my.filter(l => new Date(l.created_at) >= tStart);
      const myOpen = my.filter(l => l.status && !['won', 'lost'].includes(l.status));
      const wonValue = myWonThisMonth.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
      const convRate = my.length > 0
        ? Math.round((myWonThisMonth.length / my.length) * 1000) / 10
        : 0;
      out.push({
        userId: u.id,
        name: u.full_name || u.email,
        role: u.role,
        leadsTotal: my.length,
        leadsThisMonth: myLeadsThisMonth.length,
        won: myWonThisMonth.length,
        wonValue,
        openLeads: myOpen.length,
        convRate,
      });
    }
    return out;
  }, [leads, users]);

  // Apply role filter + sort
  const filteredSortedRows = useMemo(() => {
    let r = rows;
    if (roleFilter !== 'all') r = r.filter(x => x.role === roleFilter);
    if (atRiskOnly) r = r.filter(isAtRisk);
    r = [...r].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      return sortDesc ? bv - av : av - bv;
    });
    return r;
  }, [rows, roleFilter, atRiskOnly, sortKey, sortDesc]);

  // ─── Top-of-page KPI cards ────────────────────────────────
  // Return the same shape in both branches so TypeScript doesn't think totalDeals /
  // totalLeads / teamConvRate are possibly undefined when filteredSortedRows is empty
  // — they're 0, not missing.
  const summary = useMemo(() => {
    const active = filteredSortedRows;
    if (active.length === 0) {
      return {
        topPerformer: null as (typeof filteredSortedRows)[number] | null,
        teamWonTotal: 0,
        totalDeals: 0,
        teamConvRate: 0,
        totalLeads: 0,
        atRisk: 0,
      };
    }
    const topByValue = [...active].sort((a, b) => b.wonValue - a.wonValue)[0];
    const teamWonTotal = active.reduce((s, r) => s + r.wonValue, 0);
    const totalDeals = active.reduce((s, r) => s + r.won, 0);
    const totalLeads = active.reduce((s, r) => s + r.leadsTotal, 0);
    const teamConvRate = totalLeads > 0 ? Math.round((totalDeals / totalLeads) * 1000) / 10 : 0;
    const atRisk = active.filter(r => r.won === 0 && r.openLeads > 0).length;
    return { topPerformer: topByValue, teamWonTotal, totalDeals, teamConvRate, totalLeads, atRisk };
  }, [filteredSortedRows]);

  // Name search (find a specific person) + pagination — keeps the sort order intact.
  const nq = nameQuery.trim().toLowerCase();
  const searchedRows = nq
    ? filteredSortedRows.filter((r) => r.name.toLowerCase().includes(nq))
    : filteredSortedRows;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = searchedRows.slice(pageStart, pageStart + pageSize);

  // Reset to first page whenever the filter / search / sort changes.
  useEffect(() => { setCurrentPage(1); }, [nameQuery, roleFilter, atRiskOnly, sortKey, sortDesc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDesc(!sortDesc);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
  };

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600 px-4 text-center">
        หน้านี้สำหรับ Owner / Admin เท่านั้น
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 lg:p-8 space-y-7">
            {/* Page header */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">ผลงานทีม</h1>
                    <p className="text-gray-600 mt-1">
                      ภาพรวมผลงานพนักงานขายและนายหน้า
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Summary KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <KpiCard
                label="ยอดขายรวมเดือนนี้"
                value={formatTHB(summary.teamWonTotal)}
                icon={Award}
                tone="green"
              />
              <KpiCard
                label="Top Performer"
                value={summary.topPerformer ? summary.topPerformer.name : '—'}
                sub={summary.topPerformer ? formatTHB(summary.topPerformer.wonValue) : ''}
                icon={Trophy}
                tone="amber"
              />
              <KpiCard
                label="อัตราปิดดีลทีม"
                value={`${summary.teamConvRate}%`}
                sub={`${summary.totalDeals} ดีล จาก ${summary.totalLeads} leads`}
                icon={ArrowUpDown}
                tone="blue"
              />
              <KpiCard
                label="ดีลปิดรวมเดือนนี้"
                value={`${summary.totalDeals} ดีล`}
                sub={summary.totalDeals > 0 ? `${filteredSortedRows.filter(r => r.won > 0).length} คนปิดดีลได้` : 'ยังไม่มีดีลปิดเดือนนี้'}
                icon={CheckCircle}
                tone="green"
              />
            </div>

            {/* Filter tabs */}
            <div className="flex items-center gap-3 flex-wrap">
              <Tabs value={roleFilter} onValueChange={(v) => setRoleFilter(v as RoleFilter)}>
                <TabsList>
                  <TabsTrigger value="all">ทั้งหมด ({rows.length})</TabsTrigger>
                  <TabsTrigger value="sales">พนักงานขาย ({rows.filter(r => r.role === 'sales').length})</TabsTrigger>
                  <TabsTrigger value="agent">นายหน้า ({rows.filter(r => r.role === 'agent').length})</TabsTrigger>
                </TabsList>
              </Tabs>
              {summary.atRisk > 0 && (
                <button
                  onClick={() => setAtRiskOnly(v => !v)}
                  className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md border transition-colors ${
                    atRiskOnly
                      ? 'bg-white text-red-800 border-red-400'
                      : 'bg-white text-red-700 border-red-200 hover:border-red-400'
                  }`}
                >
                  <AlertTriangle className="w-3 h-3" />
                  ต้องช่วยเหลือ
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {summary.atRisk}
                  </span>
                  {atRiskOnly && <span className="text-red-400 ml-0.5">✕</span>}
                </button>
              )}
              <div className="relative sm:ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อพนักงาน..."
                  value={nameQuery}
                  onChange={(e) => setNameQuery(e.target.value)}
                  className="h-9 w-[200px] pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
              </div>
            </div>

            {/* Team table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                  </div>
                ) : searchedRows.length === 0 ? (
                  <div className="text-center py-16 text-sm text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    {nameQuery.trim() ? 'ไม่พบชื่อที่ค้นหา' : 'ไม่มีพนักงานในตัวกรองนี้'}
                  </div>
                ) : (
                  <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left py-3 px-3 font-medium">อันดับ</th>
                          <th className="text-left py-3 px-3 font-medium">พนักงาน</th>
                          <th className="text-left py-3 px-3 font-medium">บทบาท</th>
                          <SortableTH label="Leads เดือนนี้" active={sortKey === 'leadsThisMonth'} desc={sortDesc} onClick={() => handleSort('leadsThisMonth')} />
                          <SortableTH label="ปิดดีล" active={sortKey === 'won'} desc={sortDesc} onClick={() => handleSort('won')} />
                          <SortableTH label="ยอดขาย" active={sortKey === 'wonValue'} desc={sortDesc} onClick={() => handleSort('wonValue')} />
                          <SortableTH label="Conv %" active={sortKey === 'convRate'} desc={sortDesc} onClick={() => handleSort('convRate')} />
                          <SortableTH label="กำลังดูแล" active={sortKey === 'openLeads'} desc={sortDesc} onClick={() => handleSort('openLeads')} />
                          <th className="text-right py-3 px-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginated.map((r, i) => (
                          <tr
                            key={r.userId}
                            onClick={() => navigate(`/team/${r.userId}/performance`)}
                            className="border-b border-gray-50 hover:bg-chateau/5 cursor-pointer transition-colors"
                            title="คลิกเพื่อดูผลงานละเอียด"
                          >
                            <td className="py-3 px-3">
                              {sortKey === 'wonValue' && sortDesc && (pageStart + i) === 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm bg-amber-100 text-amber-700">
                                  #1
                                </span>
                              ) : (
                                <span className="text-gray-500 font-semibold tabular-nums">#{pageStart + i + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900">{r.name}</p>
                                {isAtRisk(r) && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-red-50 text-red-700 border border-red-200"
                                    title="ยังไม่ปิดดีลเดือนนี้ และมี leads ในมือ"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    ต้องช่วยเหลือ
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                                r.role === 'agent'
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}>
                                {ROLE_LABEL[r.role] || r.role}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-gray-700">{r.leadsThisMonth}</td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold text-green-700">
                              {r.won || '—'}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-bold text-gray-900">
                              {formatTHB(r.wonValue)}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-gray-700">{r.convRate}%</td>
                            <td className="py-3 px-3 text-right tabular-nums text-gray-700">{r.openLeads}</td>
                            <td className="py-3 px-3 text-right">
                              <Button variant="ghost" size="sm" className="text-chateau hover:bg-chateau/10">
                                ดูละเอียด →
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {searchedRows.length > pageSize && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 pb-4 pt-3 border-t border-gray-100">
                      <span className="text-sm text-gray-500">แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, searchedRows.length)} จาก {searchedRows.length} คน</span>
                      <div className="flex items-center gap-1">
                        <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                          <ChevronRight className="w-4 h-4 rotate-180" />
                        </Button>
                        {(() => {
                          const pages: number[] = [];
                          const to = Math.min(totalPages, Math.max(1, safePage - 2) + 4);
                          for (let p = Math.max(1, to - 4); p <= to; p++) pages.push(p);
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
                  </>
                )}
              </CardContent>
            </Card>
        </main>
      </div>
    </div>
  );
}

/* ─── Helpers ─── */

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  tone: 'green' | 'amber' | 'blue' | 'red';
  onClick?: () => void;
  /** When true, render a filled/highlighted state to signal the filter is active. */
  active?: boolean;
}

function KpiCard({ label, value, sub, icon: Icon, tone, onClick, active }: KpiCardProps) {
  // White card body — color signal is now only on the icon chip, matching the
  // rest of the platform's KPI style (Analytics, MyDashboard, etc.).
  const palette: Record<KpiCardProps['tone'], { iconBg: string; iconColor: string; ring: string; activeBg: string }> = {
    green: { iconBg: 'bg-green-50', iconColor: 'text-green-600', ring: 'ring-green-200', activeBg: 'bg-green-50' },
    amber: { iconBg: 'bg-amber-50', iconColor: 'text-amber-600', ring: 'ring-amber-200', activeBg: 'bg-amber-50' },
    blue:  { iconBg: 'bg-blue-50',  iconColor: 'text-blue-600',  ring: 'ring-blue-200',  activeBg: 'bg-blue-50' },
    red:   { iconBg: 'bg-red-50',   iconColor: 'text-red-600',   ring: 'ring-red-200',   activeBg: 'bg-red-50' },
  };
  const p = palette[tone];
  const clickable = Boolean(onClick);
  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      className={`border rounded-xl p-4 shadow-soft transition-all ${
        active
          ? `${p.activeBg} border-transparent ring-2 ${p.ring}`
          : 'bg-white border-gray-100'
      } ${clickable ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-medium text-gray-600">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.iconBg}`}>
          <Icon className={`w-4 h-4 ${p.iconColor}`} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 truncate" title={value}>{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1 truncate">{sub}</p>}
    </div>
  );
}

interface SortableTHProps {
  label: string;
  active: boolean;
  desc: boolean;
  onClick: () => void;
}

function SortableTH({ label, active, desc, onClick }: SortableTHProps) {
  return (
    <th
      onClick={onClick}
      className={`text-right py-3 px-3 font-medium cursor-pointer select-none hover:text-gray-900 transition-colors ${
        active ? 'text-chateau' : ''
      }`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <span className="text-[10px]">{desc ? '▼' : '▲'}</span>}
      </span>
    </th>
  );
}
