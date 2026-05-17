import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  AlertTriangle,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Flame,
  Megaphone,
  Send,
  Target,
  TrendingUp,
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
  source: string | null;
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

interface ReferralLead {
  id: string;
  status: string | null;
  estimated_value: number | null;
  updated_at: string;
  assigned_to: string | null;
  customers?: { full_name: string | null } | null;
}

const MyDashboard = () => {
  const navigate = useNavigate();
  const { user, userProfile, currentTenant, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [myLeads, setMyLeads] = useState<LeadRow[]>([]);
  const [allLeads, setAllLeads] = useState<{ assigned_to: string | null; status: string | null; estimated_value: number | null; updated_at: string }[]>([]);
  const [myLockedUnits, setMyLockedUnits] = useState<UnitLockedRow[]>([]);
  const [myAssignedUnits, setMyAssignedUnits] = useState<UnitLockedRow[]>([]);
  const [myReferrals, setMyReferrals] = useState<ReferralLead[]>([]);
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
            .select('id, customer_id, status, priority, source, estimated_value, assigned_to, last_contact_date, next_follow_up, created_at, updated_at, property_id, unit_id, customers(full_name, phone)')
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

        // Agent: fetch assigned units + referrals (leads I handed off to Sales)
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

          // Referrals: activity_logs of type 'handoff_to_sales' where I'm the from_user
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: handoffActs } = await (supabase.from('activity_logs') as any)
            .select('metadata, created_at')
            .eq('tenant_id', tenantId)
            .eq('activity_type', 'handoff_to_sales')
            .order('created_at', { ascending: false })
            .limit(100);
          const myHandoffLeadIds = Array.from(new Set(
            ((handoffActs || []) as any[])
              .filter((a: any) => a.metadata?.from_user_id === myId && a.metadata?.lead_id)
              .map((a: any) => a.metadata.lead_id)
          ));
          if (myHandoffLeadIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: refLeads } = await (supabase.from('leads') as any)
              .select('id, status, estimated_value, updated_at, assigned_to, customers(full_name)')
              .in('id', myHandoffLeadIds);
            setMyReferrals((refLeads || []) as ReferralLead[]);
          }
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

  // Lookup map — used by today's tasks aggregation below
  const propById = new Map(properties.map((p) => [p.id, p.name]));

  // Today's tasks — phone follow-ups (leads with next_follow_up = today)
  const todayPhoneFollowUps = myOpenLeads.filter((l) => {
    if (!l.next_follow_up) return false;
    const d = new Date(l.next_follow_up);
    return d >= todayStart && d <= todayEnd;
  });

  // Today's site visits (subset of upcomingVisits where viewing_date is today)
  const todaySiteVisits = upcomingVisits.filter((v) => {
    const d = new Date(v.viewing_date);
    return d >= todayStart && d <= todayEnd;
  });

  // Unified "งานวันนี้" — both phone follow-ups + site visits + reservations expiring today
  type TodayTask = {
    key: string;
    kind: 'call' | 'visit' | 'expiring';
    title: string;
    sub: string;
    time?: string;
    leadId?: string;
    unitId?: string;
  };
  const todayTasks: TodayTask[] = [
    ...todayPhoneFollowUps.map((l): TodayTask => ({
      key: `call-${l.id}`,
      kind: 'call',
      title: l.customers?.full_name || '(ไม่ระบุชื่อ)',
      sub: l.property_id ? propById.get(l.property_id) || '—' : 'นัดโทรติดต่อ',
      leadId: l.id,
    })),
    ...todaySiteVisits.map((v): TodayTask => ({
      key: `visit-${v.id}`,
      kind: 'visit',
      title: v.customer_name || 'ลูกค้า',
      sub: `ยูนิต ${v.unit_number || '—'}`,
      time: new Date(v.viewing_date).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
      leadId: v.lead_id,
      unitId: v.unit_id,
    })),
  ];

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

  // ─── Sales personal analytics ───────────────────────────────
  // Lead Source breakdown — where my leads came from
  const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    online_facebook: { label: '📘 Facebook', color: '#1877f2' },
    online_google:   { label: '🔍 Google',   color: '#fbbc04' },
    online_line:     { label: '💬 LINE',     color: '#06c755' },
    agent_referral:  { label: '🤝 นายหน้า',   color: '#ec4899' },
    offline:         { label: '🚶 Walk-in',  color: C.green },
  };
  const sourceCounts: Record<string, number> = {};
  myLeads.forEach((l) => {
    const key = (l.source || 'unknown').toLowerCase();
    sourceCounts[key] = (sourceCounts[key] || 0) + 1;
  });
  const mySourceBreakdown = Object.entries(sourceCounts)
    .map(([key, count]) => ({
      key,
      label: SOURCE_LABELS[key]?.label || key,
      color: SOURCE_LABELS[key]?.color || C.slate,
      count,
      pct: myLeads.length > 0 ? (count / myLeads.length) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Personal funnel — my own conversion rate per stage
  const myFunnelStages = [
    { key: 'new', label: 'ใหม่' },
    { key: 'contacted', label: 'ติดต่อแล้ว' },
    { key: 'qualified', label: 'คัดกรอง' },
    { key: 'negotiating', label: 'เจรจา' },
    { key: 'won', label: 'ปิดได้' },
  ];
  const myFunnelData = myFunnelStages.map((s) => ({
    ...s,
    count: myLeads.filter((l) => l.status === s.key).length,
  }));
  const myFunnelMax = Math.max(...myFunnelData.map((s) => s.count), 1);
  const myConversionRate = myLeads.length > 0
    ? (myLeads.filter((l) => l.status === 'won').length / myLeads.length) * 100
    : 0;

  // ─── Agent-specific metrics ─────────────────────────────────
  // Units I manage — breakdown by status
  const unitsAvailable = myAssignedUnits.filter((u) => u.status === 'available').length;
  const unitsReserved = myAssignedUnits.filter((u) => u.status === 'reserved').length;
  const unitsSold = myAssignedUnits.filter((u) => u.status === 'sold').length;

  // Referrals — leads I handed off to Sales
  const referralsOpen = myReferrals.filter((r) => openStatuses.has(r.status || ''));
  const referralsWon = myReferrals.filter((r) => r.status === 'won');
  const referralsLost = myReferrals.filter((r) => r.status === 'lost');
  const referralWonValueMTD = referralsWon
    .filter((r) => new Date(r.updated_at) >= startOfMonth)
    .reduce((s, r) => s + Number(r.estimated_value || 0), 0);
  const referralConversionRate = myReferrals.length > 0
    ? (referralsWon.length / myReferrals.length) * 100
    : 0;

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
              {userRole === 'agent'
                ? 'ยูนิตที่ดูแล · ลูกค้าที่ส่งต่อให้ Sales · ผลงานของคุณ'
                : 'ผลงานของคุณ · งานที่ต้องทำวันนี้ · ลีดที่ต้องตาม'}
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
              {/* Row 1: Personal KPIs — Sales sees 3 cards (no ranking), Agent/Admin/Owner see 4 */}
              <div className={`grid grid-cols-2 gap-4 ${userRole === 'sales' ? 'md:grid-cols-3' : 'md:grid-cols-4'}`}>
                {userRole === 'agent' ? (
                  <>
                    <KpiCard
                      title="ยูนิตที่ดูแล"
                      value={myAssignedUnits.length.toString()}
                      icon={Briefcase}
                      color={C.red}
                      bg={C.redLight}
                      sub={<span className="text-xs text-gray-500">{unitsAvailable} ว่าง · {unitsReserved} จอง · {unitsSold} ขายแล้ว</span>}
                    />
                    <KpiCard
                      title="Referrals กำลังดูแล"
                      value={referralsOpen.length.toString()}
                      icon={Wallet}
                      color={C.amber}
                      bg={C.amberLight}
                      sub={<span className="text-xs text-gray-500">{myReferrals.length} referrals ทั้งหมด</span>}
                    />
                    <KpiCard
                      title="Referrals ปิดดีลได้"
                      value={referralsWon.length.toString()}
                      icon={CheckCircle2}
                      color={C.redDeep}
                      bg={C.redDeepLight}
                      sub={<span className="text-xs text-gray-500">{formatTHB(referralWonValueMTD)} เดือนนี้</span>}
                    />
                  </>
                ) : (
                  <>
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
                      sub={<span className="text-xs text-gray-500">{myHotLeads.length > 0 ? 'คลิกดูรายชื่อ →' : 'ระดับความสำคัญสูง'}</span>}
                      onClick={myHotLeads.length > 0 ? () => navigate('/leads?priority=high') : undefined}
                    />
                  </>
                )}
                {userRole === 'agent' ? (
                  <KpiCard
                    title="อัตราการแปลง"
                    value={`${referralConversionRate.toFixed(0)}%`}
                    icon={TrendingUp}
                    color={C.charcoal}
                    bg={C.charcoalLight}
                    sub={
                      myReferrals.length > 0
                        ? <span className="text-xs text-gray-500">{referralsWon.length} ปิด · {referralsLost.length} เสีย</span>
                        : <span className="text-xs text-gray-400">ยังไม่มี referrals</span>
                    }
                  />
                ) : (userRole === 'admin' || userRole === 'owner') ? (
                  /* Ranking is supervisor info only — Sales focuses on their own performance,
                     not comparison to peers (industry practice: Sansiri/AP keep this off Sales view) */
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
                ) : null}
              </div>

              {/* Row 2: Today's Tasks */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Today's tasks — phone follow-ups + site visits unified */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">งานวันนี้</h2>
                    {todayTasks.length > 0 && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                        {todayTasks.length} งาน
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">นัดโทร · นัดดูยูนิตวันนี้</p>
                  {todayTasks.length === 0 ? (
                    <div className="h-[140px] flex items-center justify-center text-sm text-gray-400">ไม่มีงานนัดวันนี้ 🎉</div>
                  ) : (
                    <div className="space-y-2.5">
                      {todayTasks.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => navigate(t.leadId ? `/leads?lead=${t.leadId}` : '/leads')}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="text-base flex-shrink-0 mt-0.5">
                              {t.kind === 'visit' ? '🏠' : '📞'}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{t.sub}</p>
                            </div>
                          </div>
                          <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: t.kind === 'visit' ? C.amber : C.red }}>
                            {t.kind === 'visit' ? (t.time || 'นัดดู') : 'โทร'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inactive leads — Sales-only (Agent doesn't chase customers) */}
                {userRole !== 'agent' && (
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
                )}

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

              {/* Row 3: Active Deals (Sales) | Referrals (Agent) */}
              {userRole === 'agent' ? (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">ลูกค้าที่ฉันส่งต่อ Sales</h2>
                    <span className="ml-auto text-xs text-gray-500">{myReferrals.length} referrals</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">ติดตามสถานะ referrals ของคุณ</p>
                  {myReferrals.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 text-center px-4">
                      ยังไม่มี referral — ส่งต่อ Lead ที่หน้า Leads ผ่านปุ่ม "ส่งต่อ Sales"
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-gray-100">
                            <th className="text-left py-2 px-3 font-medium">ลูกค้า</th>
                            <th className="text-left py-2 px-3 font-medium">Sales ที่รับช่วง</th>
                            <th className="text-left py-2 px-3 font-medium">สถานะ</th>
                            <th className="text-right py-2 px-3 font-medium">มูลค่า</th>
                            <th className="text-right py-2 px-3 font-medium">อัพเดต</th>
                          </tr>
                        </thead>
                        <tbody>
                          {myReferrals.map((r) => {
                            const badge = stageBadge(r.status);
                            return (
                              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/leads?lead=${r.id}`)}>
                                <td className="py-3 px-3 font-medium text-gray-900">{r.customers?.full_name || '(ไม่ระบุ)'}</td>
                                <td className="py-3 px-3 text-gray-700 text-xs">{r.assigned_to ? '✓ ส่งต่อแล้ว' : '— รอ Sales'}</td>
                                <td className="py-3 px-3">
                                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold" style={{ color: badge.color, backgroundColor: badge.bg }}>
                                    {badge.label}
                                  </span>
                                </td>
                                <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.charcoal }}>
                                  {formatTHB(Number(r.estimated_value || 0))}
                                </td>
                                <td className="py-3 px-3 text-right text-xs text-gray-500">{timeAgo(r.updated_at)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : (
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
              )}

              {/* Row 3.5: Sales personal analytics — source breakdown + mini funnel (Sales only) */}
              {userRole !== 'agent' && myLeads.length > 0 && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* Lead Source breakdown */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Megaphone className="w-4 h-4" style={{ color: C.amber }} />
                      <h2 className="text-base font-bold text-gray-900">แหล่งที่มาของลีดฉัน</h2>
                      <span className="ml-auto text-xs text-gray-500">{myLeads.length} leads</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-5">ช่องทางไหนทำลีดฉันมามากที่สุด</p>
                    {mySourceBreakdown.length === 0 ? (
                      <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">ยังไม่มี source data</div>
                    ) : (
                      <div className="space-y-3">
                        {mySourceBreakdown.map((s) => (
                          <div key={s.key}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-gray-700">{s.label}</span>
                              <span className="text-xs tabular-nums">
                                <span className="font-bold" style={{ color: s.color }}>{s.count}</span>
                                <span className="text-gray-400 ml-1.5">({s.pct.toFixed(0)}%)</span>
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${s.pct}%`, backgroundColor: s.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Mini personal funnel */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <TrendingUp className="w-4 h-4" style={{ color: C.red }} />
                      <h2 className="text-base font-bold text-gray-900">Funnel ของฉัน</h2>
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.green, backgroundColor: C.greenLight }}>
                        {myConversionRate.toFixed(0)}% ปิดได้
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-5">เห็นภาพรวม pipeline ส่วนตัว</p>
                    <div className="space-y-2.5">
                      {myFunnelData.map((s, i) => {
                        const widthPct = (s.count / myFunnelMax) * 100;
                        const prev = i > 0 ? myFunnelData[i - 1].count : 0;
                        const drop = prev > 0 && s.count < prev ? ((prev - s.count) / prev) * 100 : 0;
                        return (
                          <div key={s.key}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-gray-700">{s.label}</span>
                                {i > 0 && drop > 0 && (
                                  <span className="text-[10px] font-medium text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded">
                                    -{drop.toFixed(0)}%
                                  </span>
                                )}
                              </div>
                              <span className="text-xs font-bold tabular-nums" style={{ color: s.key === 'won' ? C.green : C.charcoal }}>
                                {s.count}
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${Math.max(widthPct, 2)}%`, backgroundColor: s.key === 'won' ? C.green : '#fca5a5' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

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
  onClick?: () => void;
}

const KpiCard = ({ title, value, icon: Icon, color, bg, sub, onClick }: KpiCardProps) => (
  <div
    onClick={onClick}
    className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 ${onClick ? 'cursor-pointer hover:border-gray-200' : ''}`}
    title={onClick ? 'คลิกเพื่อดูรายการ' : undefined}
  >
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
