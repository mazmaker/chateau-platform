import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Target,
  Trophy,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

const C = {
  red:        '#ef4444',
  redLight:   '#fef2f2',
  redDeep:    '#e11d48',
  redDeepLight: '#fff1f2',
  amber:      '#d97706',
  amberLight: '#fefce8',
  green:      '#16a34a',
  greenLight: '#f0fdf4',
  charcoal:   '#475569',
  charcoalLight: '#f1f5f9',
  slate:      '#94a3b8',
  slateLight: '#f1f5f9',
  gray:       '#94a3b8',
  grayLight:  '#fafafa',
  border:     '#e5e7eb',
};

// Industry-standard commission rate for Thai real estate sales (placeholder)
const COMMISSION_RATE_SALES = 0.015; // 1.5% — in-house sales
const COMMISSION_RATE_AGENT = 0.025; // 2.5% — external broker (typical industry rate)

// Stage → close probability (used for projected commission)
const STAGE_PROBABILITY: Record<string, number> = {
  new:         0.05,
  contacted:   0.15,
  qualified:   0.35,
  negotiating: 0.65,
  won:         1.00,
  lost:        0.00,
};

const formatTHB = (n: number) => {
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
};

const timeAgo = (iso: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 30) return `${Math.floor(days / 30)} เดือนก่อน`;
  if (days >= 1) return `${days} วันก่อน`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours} ชม.ก่อน`;
  return `เพิ่งนี้`;
};

const daysFromNow = (iso: string | null): number | null => {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000);
};

interface LeadRow {
  id: string;
  customer_id: string | null;
  customers?: { full_name: string | null; phone: string | null } | null;
  status: string | null;
  priority: string | null;
  estimated_value: number | null;
  assigned_to: string | null;
  last_contact_date: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
  property_id: string | null;
  unit_id: string | null;
}

interface UnitLockedRow {
  id: string;
  unit_number: string;
  status: string;
  locked_until: string | null;
  price: number;
  project_id: string;
}

interface PropertyRow {
  id: string;
  name: string;
}

const MyDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, currentTenant, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myLeads, setMyLeads] = useState<LeadRow[]>([]);
  const [allLeads, setAllLeads] = useState<{ assigned_to: string | null; status: string | null; estimated_value: number | null; updated_at: string }[]>([]);
  const [myLockedUnits, setMyLockedUnits] = useState<UnitLockedRow[]>([]);
  const [myAssignedUnits, setMyAssignedUnits] = useState<UnitLockedRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [upcomingVisits, setUpcomingVisits] = useState<Array<{
    id: string;
    viewing_date: string;
    lead_id: string;
    unit_id: string;
    customer_name: string | null;
    unit_number: string | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  // The current user's public.users.id (used as assigned_to in leads)
  const myId = userProfile?.id || user?.id || '';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tenantId = currentTenant?.id;
        if (!tenantId || !myId) {
          setLoading(false);
          return;
        }

        const [myLeadsRes, allLeadsRes, lockedRes, propsRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, customer_id, status, priority, estimated_value, assigned_to, last_contact_date, next_follow_up, created_at, updated_at, property_id, unit_id, customers(full_name, phone)')
            .eq('tenant_id', tenantId)
            .eq('assigned_to', myId),
          // For rank — only need won deals' assigned_to + value (others)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('assigned_to, status, estimated_value, updated_at')
            .eq('tenant_id', tenantId),
          // Sales: units locked by me | Agent: no locked units (uses assignments instead)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          userRole === 'sales'
            ? (supabase.from('units') as any)
                .select('id, unit_number, status, locked_until, price, project_id')
                .eq('tenant_id', tenantId)
                .eq('locked_by', myId)
            : Promise.resolve({ data: [] }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name')
            .eq('tenant_id', tenantId),
        ]);

        setMyLeads((myLeadsRes.data || []) as LeadRow[]);
        setAllLeads(allLeadsRes.data || []);
        setMyLockedUnits((lockedRes.data || []) as UnitLockedRow[]);
        setProperties((propsRes.data || []) as PropertyRow[]);

        // Agent: fetch assigned units separately
        if (userRole === 'agent') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: agentAssignments } = await (supabase.from('agent_unit_assignments') as any)
            .select('units(id, unit_number, status, locked_until, price, project_id)')
            .eq('tenant_id', tenantId)
            .eq('agent_user_id', myId)
            .is('revoked_at', null);
          const units = (agentAssignments || [])
            .map((r: any) => r.units)
            .filter(Boolean) as UnitLockedRow[];
          setMyAssignedUnits(units);
        }

        // Upcoming site visits — leads assigned to me with viewing_date in future
        const myLeadIds = ((myLeadsRes.data || []) as LeadRow[]).map((l) => l.id);
        if (myLeadIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: visitRows } = await (supabase.from('lead_interests') as any)
            .select('id, viewing_date, lead_id, unit_id, leads(customers(full_name)), units(unit_number)')
            .in('lead_id', myLeadIds)
            .gte('viewing_date', new Date().toISOString())
            .order('viewing_date', { ascending: true })
            .limit(10);
          setUpcomingVisits((visitRows || []).map((r: any) => ({
            id: r.id,
            viewing_date: r.viewing_date,
            lead_id: r.lead_id,
            unit_id: r.unit_id,
            customer_name: r.leads?.customers?.full_name || null,
            unit_number: r.units?.unit_number || null,
          })));
        }
      } catch (e) {
        console.error('My Dashboard load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTenant, myId]);

  // ─── Compute personal KPIs ──────────────────────────────────
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const openStatuses = new Set(['new', 'contacted', 'qualified', 'negotiating']);

  // My closed deals MTD
  const myWonMTD = myLeads.filter((l) => l.status === 'won' && new Date(l.updated_at) >= startOfMonth);
  const myWonValueMTD = myWonMTD.reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  // My active pipeline
  const myOpenLeads = myLeads.filter((l) => openStatuses.has(l.status || ''));
  const myPipelineValue = myOpenLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  // My hot leads (priority=high, open)
  const myHotLeads = myOpenLeads.filter((l) => l.priority === 'high');

  // My rank in team — based on won deal value (all-time)
  const repWonValueMap = new Map<string, number>();
  allLeads.forEach((l) => {
    if (l.status === 'won' && l.assigned_to) {
      repWonValueMap.set(l.assigned_to, (repWonValueMap.get(l.assigned_to) || 0) + Number(l.estimated_value || 0));
    }
  });
  const ranking = Array.from(repWonValueMap.entries()).sort((a, b) => b[1] - a[1]);
  const totalReps = ranking.length;
  const myRankIndex = ranking.findIndex((r) => r[0] === myId);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;
  const myAllTimeWonValue = repWonValueMap.get(myId) || 0;

  // Today's tasks — leads to follow up today
  const todayFollowUps = myOpenLeads.filter((l) => {
    if (!l.next_follow_up) return false;
    const d = new Date(l.next_follow_up);
    return d >= todayStart && d <= todayEnd;
  });

  // Inactive leads — open + no contact in 30+ days
  const inactiveLeads = myOpenLeads.filter((l) => l.last_contact_date && new Date(l.last_contact_date) < thirtyDaysAgo);

  // Reservations expiring in the next 7 days
  const expiringSoon = myLockedUnits.filter((u) => {
    if (u.status !== 'reserved' || !u.locked_until) return false;
    const days = daysFromNow(u.locked_until);
    return days !== null && days >= 0 && days <= 7;
  });

  // Active deals (for table)
  const activeDeals = myOpenLeads
    .slice()
    .sort((a, b) => {
      // Sort by stage seriousness then by recency
      const stageOrder: Record<string, number> = { negotiating: 4, qualified: 3, contacted: 2, new: 1 };
      const sa = stageOrder[a.status || ''] || 0;
      const sb = stageOrder[b.status || ''] || 0;
      if (sa !== sb) return sb - sa;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

  // Commission projection — different rate per role
  const commissionRate = userRole === 'agent' ? COMMISSION_RATE_AGENT : COMMISSION_RATE_SALES;
  const confirmedCommission = myWonValueMTD * commissionRate;
  const projectedCommission = myOpenLeads.reduce((s, l) => {
    const prob = STAGE_PROBABILITY[l.status || ''] || 0;
    return s + (Number(l.estimated_value || 0) * prob * commissionRate);
  }, 0);

  const propById = new Map(properties.map((p) => [p.id, p.name]));

  // Stage badge color
  const stageBadge = (status: string | null) => {
    switch (status) {
      case 'negotiating': return { label: 'กำลังเจรจา',   color: C.amber, bg: C.amberLight };
      case 'qualified':   return { label: 'มีคุณสมบัติ',  color: C.charcoal, bg: C.charcoalLight };
      case 'contacted':   return { label: 'ติดต่อแล้ว',   color: C.slate, bg: C.slateLight };
      case 'new':         return { label: 'ใหม่',         color: C.gray, bg: C.grayLight };
      case 'won':         return { label: 'ปิดดีลแล้ว',   color: C.green, bg: C.greenLight };
      case 'lost':        return { label: 'สูญเสีย',      color: C.red, bg: C.redLight };
      case 'proposal':    return { label: 'เสนอราคา',     color: C.slate, bg: C.slateLight };
      default:            return { label: status || '—',  color: C.gray, bg: C.grayLight };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 lg:p-10 space-y-7">
          {/* Title */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: C.red, backgroundColor: C.redLight }}>
              My Dashboard
            </span>
            <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">
              สวัสดี {userProfile?.full_name?.split(' ')[0] || 'คุณ'}
            </h1>
            <p className="text-[15px] text-gray-500 mt-1.5">
              ผลงานของคุณ · งานที่ต้องทำวันนี้ · ค่าคอมที่จะได้
            </p>
          </div>

          {loading ? (
            <div className="space-y-7">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-[170px] animate-pulse" />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-[260px] animate-pulse" />)}
              </div>
            </div>
          ) : (
            <>
              {/* Row 1: Personal KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <KpiCard
                  title="ปิดดีลได้เดือนนี้"
                  value={myWonMTD.length.toString()}
                  icon={CheckCircle2}
                  color={C.red}
                  bg={C.redLight}
                  sub={<span className="text-xs text-gray-500">มูลค่ารวม {formatTHB(myWonValueMTD)}</span>}
                />
                <KpiCard
                  title="มูลค่ายอดขายที่กำลังขาย"
                  value={formatTHB(myPipelineValue)}
                  icon={Wallet}
                  color={C.amber}
                  bg={C.amberLight}
                  sub={<span className="text-xs text-gray-500">{myOpenLeads.length} ดีลที่เปิดอยู่</span>}
                />
                <KpiCard
                  title="ลูกค้าด่วน"
                  value={myHotLeads.length.toString()}
                  icon={Flame}
                  color={C.redDeep}
                  bg={C.redDeepLight}
                  sub={<span className="text-xs text-gray-500">ระดับความสำคัญสูง</span>}
                />
                <KpiCard
                  title="อันดับในทีม"
                  value={myRank ? `#${myRank}` : '—'}
                  icon={Trophy}
                  color={C.charcoal}
                  bg={C.charcoalLight}
                  sub={
                    myRank
                      ? <span className="text-xs text-gray-500">จาก {totalReps} คน · {formatTHB(myAllTimeWonValue)}</span>
                      : <span className="text-xs text-gray-400">ยังไม่มีดีลปิด</span>
                  }
                />
              </div>

              {/* Row 2: Today's Tasks */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Follow-ups due today */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">นัดติดตามวันนี้</h2>
                    {todayFollowUps.length > 0 && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                        {todayFollowUps.length} ราย
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">นัดติดต่อตามแผนวันนี้</p>
                  {todayFollowUps.length === 0 ? (
                    <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">ไม่มีนัดติดตามวันนี้ 🎉</div>
                  ) : (
                    <div className="space-y-2.5">
                      {todayFollowUps.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => navigate(`/leads?lead=${l.id}`)}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.customers?.full_name || '(ไม่ระบุชื่อ)'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {l.property_id ? propById.get(l.property_id) || '—' : '—'}
                              {l.estimated_value ? ` · ${formatTHB(Number(l.estimated_value))}` : ''}
                            </p>
                          </div>
                          <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: C.red }}>
                            {stageBadge(l.status).label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inactive leads (mine) */}
                <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.amberLight }}>
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4" style={{ color: C.amber }} />
                    <h2 className="text-base font-bold text-gray-900">ลูกค้าที่เงียบหาย</h2>
                    {inactiveLeads.length > 0 && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                        {inactiveLeads.length} ราย
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ไม่ติดต่อมา {'>'} 30 วัน</p>
                  {inactiveLeads.length === 0 ? (
                    <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">ไม่มี — ทำงานเก่งมาก 👍</div>
                  ) : (
                    <div className="space-y-2.5">
                      {inactiveLeads.slice(0, 4).map((l) => {
                        const days = l.last_contact_date ? Math.floor((Date.now() - new Date(l.last_contact_date).getTime()) / 86400000) : 0;
                        return (
                          <button
                            key={l.id}
                            onClick={() => navigate(`/leads?lead=${l.id}`)}
                            className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{l.customers?.full_name || '(ไม่ระบุชื่อ)'}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{l.property_id ? propById.get(l.property_id) || '—' : '—'}</p>
                            </div>
                            <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: days >= 60 ? C.red : C.amber }}>
                              {days} วัน
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reservations expiring (Sales) | Assigned units (Agent) */}
                {userRole === 'agent' ? (
                  <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.redLight }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4" style={{ color: C.redDeep }} />
                      <h2 className="text-base font-bold text-gray-900">ยูนิตที่รับมอบหมาย</h2>
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.redDeep, backgroundColor: C.redDeepLight }}>
                        {myAssignedUnits.length} ยูนิต
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">ยูนิตที่ได้รับมอบหมายให้ดูแล</p>
                    {myAssignedUnits.length === 0 ? (
                      <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">ยังไม่มียูนิตที่ได้รับมอบหมาย</div>
                    ) : (
                      <div className="space-y-2.5 max-h-[200px] overflow-y-auto">
                        {myAssignedUnits.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => navigate(`/units/${u.id}`)}
                            className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{u.unit_number}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{propById.get(u.project_id) || '—'} · {formatTHB(Number(u.price))}</p>
                            </div>
                            <span className="text-xs font-semibold tabular-nums shrink-0" style={{
                              color: u.status === 'available' ? C.green : u.status === 'reserved' ? C.amber : C.charcoal
                            }}>
                              {u.status === 'available' ? 'ว่าง' : u.status === 'reserved' ? 'จอง' : u.status === 'sold' ? 'ขายแล้ว' : u.status}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.redLight }}>
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4" style={{ color: C.redDeep }} />
                      <h2 className="text-base font-bold text-gray-900">การจองใกล้หมดอายุ</h2>
                      {expiringSoon.length > 0 && (
                        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.redDeep, backgroundColor: C.redDeepLight }}>
                          {expiringSoon.length} ยูนิต
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">ภายใน 7 วัน — ต้องปิดดีลก่อนหลุด</p>
                    {expiringSoon.length === 0 ? (
                      <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">ไม่มีการจองที่ใกล้หมดอายุ</div>
                    ) : (
                      <div className="space-y-2.5">
                        {expiringSoon.map((u) => {
                          const days = daysFromNow(u.locked_until);
                          return (
                            <button
                              key={u.id}
                              onClick={() => navigate(`/units/${u.id}`)}
                              className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-gray-900 truncate">{u.unit_number}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{propById.get(u.project_id) || '—'} · {formatTHB(Number(u.price))}</p>
                              </div>
                              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: days !== null && days <= 1 ? C.red : C.amber }}>
                                เหลือ {days ?? '—'} วัน
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Upcoming Site Visits */}
              <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.amberLight }}>
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4" style={{ color: C.amber }} />
                  <h2 className="text-base font-bold text-gray-900">นัดดูยูนิตที่กำลังจะถึง</h2>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                    {upcomingVisits.length} นัด
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">ลูกค้านัดมาดูยูนิตที่ฉันดูแล</p>
                {upcomingVisits.length === 0 ? (
                  <div className="h-[100px] flex items-center justify-center text-sm text-gray-400">
                    ยังไม่มีนัดดูยูนิตที่กำลังจะถึง
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
                    {upcomingVisits.map((v) => {
                      const d = new Date(v.viewing_date);
                      const isToday = d.toDateString() === new Date().toDateString();
                      const dateLabel = d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={v.id}
                          onClick={() => navigate(`/leads`)}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {v.customer_name || 'ลูกค้า'} · ยูนิต {v.unit_number || '—'}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
                          </div>
                          <span className="text-xs font-semibold tabular-nums shrink-0 px-2 py-0.5 rounded-full" style={{
                            color: isToday ? C.red : C.amber,
                            backgroundColor: isToday ? C.redLight : C.amberLight,
                          }}>
                            {isToday ? 'วันนี้' : 'กำลังจะถึง'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Row 3: Active Deals Table */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="w-4 h-4" style={{ color: C.red }} />
                  <h2 className="text-base font-bold text-gray-900">ดีลที่ฉันดูแลอยู่</h2>
                  <span className="ml-auto text-xs text-gray-500">{activeDeals.length} ดีล</span>
                </div>
                <p className="text-xs text-gray-500 mb-5">เรียงตามขั้นตอนที่ใกล้ปิด</p>
                {activeDeals.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
                    ยังไม่มีดีลที่ดูแล — ขอให้แอดมินมอบหมายลูกค้าให้
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left py-2 px-3 font-medium">ลูกค้า</th>
                          <th className="text-left py-2 px-3 font-medium">โครงการ</th>
                          <th className="text-left py-2 px-3 font-medium">สถานะ</th>
                          <th className="text-right py-2 px-3 font-medium">มูลค่า</th>
                          <th className="text-right py-2 px-3 font-medium">ติดต่อล่าสุด</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDeals.map((l) => {
                          const badge = stageBadge(l.status);
                          return (
                            <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/leads?lead=${l.id}`)}>
                              <td className="py-3 px-3 font-medium text-gray-900">{l.customers?.full_name || '(ไม่ระบุ)'}</td>
                              <td className="py-3 px-3 text-gray-700">{l.property_id ? propById.get(l.property_id) || '—' : '—'}</td>
                              <td className="py-3 px-3">
                                <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={{ color: badge.color, backgroundColor: badge.bg }}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.charcoal }}>
                                {formatTHB(Number(l.estimated_value || 0))}
                              </td>
                              <td className="py-3 px-3 text-right text-xs text-gray-500">{timeAgo(l.last_contact_date)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Row 4: Commission Projection */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4" style={{ color: C.amber }} />
                  <h2 className="text-base font-bold text-gray-900">คาดการณ์ค่าคอม</h2>
                </div>
                <p className="text-xs text-gray-500 mb-5">
                  คำนวณที่ commission rate {(commissionRate * 100).toFixed(1)}%
                  {userRole === 'agent' ? ' (อัตรานายหน้าภายนอก — ของจริงตามสัญญา)' : ' (ของจริงให้ confirm กับ HR)'}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="rounded-xl p-4" style={{ backgroundColor: C.greenLight }}>
                    <p className="text-xs text-gray-600 mb-1">💵 ปิดได้แล้ว (เดือนนี้)</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: C.green }}>
                      {formatTHB(confirmedCommission)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{myWonMTD.length} ดีล · ฿{(myWonValueMTD / 1_000_000).toFixed(1)}M ยอดขาย</p>
                  </div>

                  <div className="rounded-xl p-4" style={{ backgroundColor: C.amberLight }}>
                    <p className="text-xs text-gray-600 mb-1">📊 คาดการณ์จาก pipeline</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: C.amber }}>
                      {formatTHB(projectedCommission)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">ถ่วงน้ำหนักด้วย probability ตาม stage</p>
                  </div>

                  <div className="rounded-xl p-4" style={{ backgroundColor: C.redLight }}>
                    <p className="text-xs text-gray-600 mb-1">🎯 รวมถ้าทุกอย่างผ่าน</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: C.red }}>
                      {formatTHB(confirmedCommission + projectedCommission)}
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">เป้าหมายเดือนนี้</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────

interface KpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  sub?: React.ReactNode;
}

const KpiCard = ({ title, value, icon: Icon, color, bg, sub }: KpiCardProps) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-start justify-between mb-4">
      <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
      </div>
    </div>
    <p className="text-[28px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
    <div className="mt-3.5 min-h-[20px]">{sub}</div>
  </div>
);

export default MyDashboard;
