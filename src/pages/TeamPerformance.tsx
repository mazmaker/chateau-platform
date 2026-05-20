import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Trophy, Users, AlertTriangle, Award, ArrowUpDown, Loader2, Target, X,
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

interface SalesTarget {
  user_id: string;
  target_deals: number;
  target_revenue: number;
  target_leads: number;
}

type SortKey = 'wonValue' | 'won' | 'convRate' | 'leadsThisMonth' | 'openLeads';
type RoleFilter = 'all' | 'sales' | 'agent';

const ROLE_LABEL: Record<string, string> = {
  sales: 'พนักงานขาย',
  agent: 'นายหน้า',
  admin: 'ผู้ดูแล',
  owner: 'เจ้าของ',
};

const formatTHB = (n: number) =>
  n >= 1_000_000
    ? `฿${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    : n > 0
      ? `฿${n.toLocaleString('th-TH')}`
      : '—';

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
  const [targets, setTargets] = useState<Record<string, SalesTarget>>({});
  const [targetModal, setTargetModal] = useState<{ userId: string; name: string } | null>(null);
  const [targetForm, setTargetForm] = useState({ target_deals: 0, target_revenue: 0, target_leads: 0 });
  const [targetSaving, setTargetSaving] = useState(false);

  // "At risk" rule kept identical to the KPI definition below so the count on the
  // card and the rows the table highlights are always consistent.
  const isAtRisk = (r: TeamRow) => r.won === 0 && r.openLeads > 0;

  const allowed = userRole === 'owner' || userRole === 'admin';

  useEffect(() => {
    if (!allowed || !currentTenant?.id) return;
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date();
        const [leadsRes, usersRes, targetsRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, status, assigned_to, estimated_value, created_at, updated_at')
            .eq('tenant_id', currentTenant.id),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('users') as any)
            .select('id, full_name, email, role')
            .eq('tenant_id', currentTenant.id)
            .in('role', ['sales', 'agent']),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('sales_targets') as any)
            .select('user_id, target_deals, target_revenue, target_leads')
            .eq('tenant_id', currentTenant.id)
            .eq('period_year', now.getFullYear())
            .eq('period_month', now.getMonth() + 1),
        ]);
        setLeads((leadsRes.data || []) as LeadLite[]);
        setUsers((usersRes.data || []) as UserLite[]);
        const tMap: Record<string, SalesTarget> = {};
        for (const t of (targetsRes.data || [])) tMap[t.user_id] = t;
        setTargets(tMap);
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
  const summary = useMemo(() => {
    const active = filteredSortedRows;
    if (active.length === 0) {
      return { topPerformer: null, teamWonTotal: 0, atRisk: 0, avgConv: 0 };
    }
    const topByValue = [...active].sort((a, b) => b.wonValue - a.wonValue)[0];
    const teamWonTotal = active.reduce((s, r) => s + r.wonValue, 0);
    // "At risk" = active rep with 0 deals this month AND has open leads
    const atRisk = active.filter(r => r.won === 0 && r.openLeads > 0).length;
    const avgConv = active.length > 0
      ? Math.round((active.reduce((s, r) => s + r.convRate, 0) / active.length) * 10) / 10
      : 0;
    return { topPerformer: topByValue, teamWonTotal, atRisk, avgConv };
  }, [filteredSortedRows]);

  const openTargetModal = (e: React.MouseEvent, userId: string, name: string) => {
    e.stopPropagation();
    const existing = targets[userId];
    setTargetForm({
      target_deals: existing?.target_deals || 0,
      target_revenue: existing?.target_revenue || 0,
      target_leads: existing?.target_leads || 0,
    });
    setTargetModal({ userId, name });
  };

  const saveTarget = async () => {
    if (!targetModal || !currentTenant?.id) return;
    setTargetSaving(true);
    const now = new Date();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('sales_targets') as any).upsert({
      tenant_id: currentTenant.id,
      user_id: targetModal.userId,
      period_year: now.getFullYear(),
      period_month: now.getMonth() + 1,
      ...targetForm,
    }, { onConflict: 'tenant_id,user_id,period_year,period_month' });
    setTargets(prev => ({ ...prev, [targetModal.userId]: { user_id: targetModal.userId, ...targetForm } }));
    setTargetSaving(false);
    setTargetModal(null);
  };

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
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-5">
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
                      ภาพรวมผลงานพนักงานขายและนายหน้า · กดแถวเพื่อดูรายละเอียด
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
                label="Conversion เฉลี่ย"
                value={`${summary.avgConv}%`}
                icon={ArrowUpDown}
                tone="blue"
              />
              {/* At-risk card is interactive: clicking it filters the table down to just
                  the people who need help. When count = 0 the card stays passive to avoid
                  a misleading "clickable but no result" state. */}
              <KpiCard
                label="ต้องช่วยเหลือ"
                value={`${summary.atRisk} คน`}
                sub={atRiskOnly ? 'คลิกอีกครั้งเพื่อแสดงทั้งหมด' : 'คลิกเพื่อดูเฉพาะคนที่ต้องช่วย'}
                icon={AlertTriangle}
                tone="red"
                onClick={summary.atRisk > 0 ? () => setAtRiskOnly(v => !v) : undefined}
                active={atRiskOnly}
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
              {atRiskOnly && (
                <button
                  onClick={() => setAtRiskOnly(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors"
                >
                  <AlertTriangle className="w-3 h-3" />
                  กรองเฉพาะ "ต้องช่วยเหลือ"
                  <span className="text-red-400 ml-1">✕</span>
                </button>
              )}
            </div>

            {/* Team table */}
            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
                  </div>
                ) : filteredSortedRows.length === 0 ? (
                  <div className="text-center py-16 text-sm text-gray-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    ไม่มีพนักงานในตัวกรองนี้
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50/50">
                          <th className="text-left py-3 px-3 font-medium">อันดับ</th>
                          <th className="text-left py-3 px-3 font-medium">พนักงาน</th>
                          <th className="text-left py-3 px-3 font-medium">บทบาท</th>
                          <SortableTH label="Leads เดือนนี้" active={sortKey === 'leadsThisMonth'} desc={sortDesc} onClick={() => handleSort('leadsThisMonth')} />
                          <SortableTH label="ปิดดีล / เป้า" active={sortKey === 'won'} desc={sortDesc} onClick={() => handleSort('won')} />
                          <SortableTH label="ยอดขาย / เป้า" active={sortKey === 'wonValue'} desc={sortDesc} onClick={() => handleSort('wonValue')} />
                          <SortableTH label="Conv %" active={sortKey === 'convRate'} desc={sortDesc} onClick={() => handleSort('convRate')} />
                          <SortableTH label="กำลังดูแล" active={sortKey === 'openLeads'} desc={sortDesc} onClick={() => handleSort('openLeads')} />
                          <th className="text-right py-3 px-3 font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSortedRows.map((r, i) => (
                          <tr
                            key={r.userId}
                            onClick={() => navigate(`/team/${r.userId}/performance`)}
                            className="border-b border-gray-50 hover:bg-chateau/5 cursor-pointer transition-colors"
                            title="คลิกเพื่อดูผลงานละเอียด"
                          >
                            <td className="py-3 px-3">
                              {sortKey === 'wonValue' && sortDesc && i === 0 ? (
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full text-sm bg-amber-100 text-amber-700">
                                  🏆
                                </span>
                              ) : (
                                <span className="text-gray-500 font-semibold tabular-nums">#{i + 1}</span>
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
                            <td className="py-3 px-3 text-right">
                              <p className="tabular-nums font-semibold text-green-700">
                                {r.won || '—'}
                                {targets[r.userId]?.target_deals > 0 && (
                                  <span className="text-gray-400 font-normal">/{targets[r.userId].target_deals}</span>
                                )}
                              </p>
                              {targets[r.userId]?.target_deals > 0 && (
                                <div className="w-full h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(100, (r.won / targets[r.userId].target_deals) * 100)}%` }} />
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <p className="tabular-nums font-bold text-gray-900">{formatTHB(r.wonValue)}</p>
                              {targets[r.userId]?.target_revenue > 0 && (
                                <>
                                  <p className="text-[10px] text-gray-400 tabular-nums">เป้า {formatTHB(targets[r.userId].target_revenue)}</p>
                                  <div className="w-full h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                                    <div className="h-full rounded-full bg-chateau transition-all" style={{ width: `${Math.min(100, (r.wonValue / targets[r.userId].target_revenue) * 100)}%` }} />
                                  </div>
                                </>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums text-gray-700">{r.convRate}%</td>
                            <td className="py-3 px-3 text-right tabular-nums text-gray-700">{r.openLeads}</td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-500 hover:bg-gray-100 text-xs"
                                  onClick={(e) => openTargetModal(e, r.userId, r.name)}
                                  title="ตั้งเป้าหมาย"
                                >
                                  <Target className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="sm" className="text-chateau hover:bg-chateau/10">
                                  ดูละเอียด →
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Target modal */}
      {targetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setTargetModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Target className="w-4 h-4 text-chateau" /> ตั้งเป้าหมาย
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{targetModal.name} · เดือนนี้</p>
              </div>
              <button onClick={() => setTargetModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { key: 'target_deals', label: 'จำนวนดีลที่ปิด (unit)', placeholder: '5' },
                { key: 'target_revenue', label: 'ยอดขาย (บาท)', placeholder: '5000000' },
                { key: 'target_leads', label: 'Leads ใหม่ (ราย)', placeholder: '15' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-medium text-gray-700 block mb-1">{f.label}</label>
                  <input
                    type="number"
                    min={0}
                    placeholder={f.placeholder}
                    value={(targetForm as any)[f.key] || ''}
                    onChange={e => setTargetForm(prev => ({ ...prev, [f.key]: Number(e.target.value) || 0 }))}
                    className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-chateau/20 focus:border-chateau"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => setTargetModal(null)}>ยกเลิก</Button>
              <Button
                className="flex-1 bg-chateau hover:bg-chateau/90 text-white"
                onClick={saveTarget}
                disabled={targetSaving}
              >
                {targetSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'บันทึก'}
              </Button>
            </div>
          </div>
        </div>
      )}
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
