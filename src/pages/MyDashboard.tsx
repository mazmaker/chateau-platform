import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  AlertTriangle,
  BarChart3,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  PhoneOff,
  Send,
  Target,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import SelfPerformanceSection from "@/components/dashboard/SelfPerformanceSection";

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
  indigo:     '#4f46e5',
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
  potential_score: number | null;
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
  sales_person?: { full_name: string | null } | null;
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
  // Funnel layer 1: anonymous views attributed to this Agent's ref_code over the last 30 days.
  const [viewStats, setViewStats] = useState<{
    totalViews: number;
    uniqueVisitors: number;
    returningVisitors: number;
    avgDurationSec: number;
    topUnits: Array<{ unit_id: string | null; unit_number: string; views: number }>;
  }>({ totalViews: 0, uniqueVisitors: 0, returningVisitors: 0, avgDurationSec: 0, topUnits: [] });
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
            .select('id, customer_id, status, priority, source, estimated_value, potential_score, assigned_to, last_contact_date, next_follow_up, created_at, updated_at, property_id, unit_id, customers(full_name, phone)')
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

          // Referrals = leads attributed to this Agent via their referral link
          // (leads.referred_by_agent_id). This is the single source of truth for "who did
          // I bring in" — covers customers who arrived via ?ref=AG-... and expressed interest.
          // (Previously this read 'handoff_to_sales' activity, which missed link referrals.)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: refLeads } = await (supabase.from('leads') as any)
            .select('id, status, estimated_value, updated_at, assigned_to, customers(full_name), sales_person:users!assigned_to(full_name)')
            .eq('tenant_id', tenantId)
            .eq('referred_by_agent_id', myId)
            .order('updated_at', { ascending: false });
          setMyReferrals((refLeads || []) as ReferralLead[]);

          // Funnel-layer-1 stats — anonymous visitor views attributed to this Agent
          // via property_views.ref_agent_id (set when ?ref=AG-2026-NNN matched on visit).
          // 30-day window matches the "ผลงาน 30 วัน" KPI cards above.
          const since = new Date(Date.now() - 30 * 86400000).toISOString();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: viewRows } = await (supabase.from('property_views') as any)
            .select('visitor_id, unit_id, duration_sec, visited_at')
            .eq('ref_agent_id', myId)
            .gte('visited_at', since);
          const views = (viewRows || []) as Array<{ visitor_id: string; unit_id: string | null; duration_sec: number | null; visited_at: string }>;
          if (views.length > 0) {
            const visitorCounts = new Map<string, number>();
            const unitCounts = new Map<string, number>();
            let durationSum = 0;
            let durationN = 0;
            for (const v of views) {
              visitorCounts.set(v.visitor_id, (visitorCounts.get(v.visitor_id) || 0) + 1);
              if (v.unit_id) unitCounts.set(v.unit_id, (unitCounts.get(v.unit_id) || 0) + 1);
              if (typeof v.duration_sec === 'number') {
                durationSum += v.duration_sec;
                durationN += 1;
              }
            }
            // Resolve unit numbers for the top units list (single round-trip)
            const topUnitEntries = Array.from(unitCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);
            let unitLookup = new Map<string, string>();
            if (topUnitEntries.length > 0) {
              const ids = topUnitEntries.map(([id]) => id);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: unitsResolve } = await (supabase.from('units') as any)
                .select('id, unit_number').in('id', ids);
              unitLookup = new Map((unitsResolve || []).map((u: any) => [u.id, u.unit_number]));
            }
            setViewStats({
              totalViews: views.length,
              uniqueVisitors: visitorCounts.size,
              returningVisitors: Array.from(visitorCounts.values()).filter((c) => c >= 2).length,
              avgDurationSec: durationN > 0 ? Math.round(durationSum / durationN) : 0,
              topUnits: topUnitEntries.map(([unitId, count]) => ({
                unit_id: unitId,
                unit_number: unitLookup.get(unitId) || '—',
                views: count,
              })),
            });
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
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  // Agent referral scorecard — derived from leads the Agent handed off to Sales
  // (myReferrals) + link reach (viewStats). Replaces the Sales-style funnel, which
  // measures own-closing performance — the wrong lens for a นายหน้า whose job is to refer.
  const referralStats = useMemo(() => {
    const total = myReferrals.length;
    const won = myReferrals.filter((r) => r.status === 'won');
    const active = myReferrals.filter((r) => r.status && !['won', 'lost'].includes(r.status));
    const wonValue = won.reduce((s, r) => s + Number(r.estimated_value || 0), 0);
    return { total, wonCount: won.length, activeCount: active.length, wonValue };
  }, [myReferrals]);

  // 6-month revenue trend — wins by month (uses updated_at as proxy for won_at).
  // Drives the headline area chart that replaces the old "wall of KPI cards" feel.
  const trend6Months = useMemo(() => {
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const out: Array<{ month: string; revenue: number; deals: number }> = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mStart = new Date(d.getFullYear(), d.getMonth(), 1);
      const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
      // For Sales: use own won leads. For Agent: use referrals that closed (proxy for their value).
      const source = userRole === 'agent' ? myReferrals : myLeads;
      const won = source.filter((l) =>
        l.status === 'won' &&
        new Date(l.updated_at) >= mStart &&
        new Date(l.updated_at) <= mEnd
      );
      out.push({
        month: months[d.getMonth()],
        revenue: won.reduce((s, l) => s + Number(l.estimated_value || 0), 0),
        deals: won.length,
      });
    }
    return out;
  }, [myLeads, myReferrals, userRole]);

  const openStatuses = new Set(['new', 'contacted', 'qualified', 'negotiating']);

  // My closed deals MTD
  const myWonMTD = myLeads.filter((l) => l.status === 'won' && new Date(l.updated_at) >= startOfMonth);
  const myWonValueMTD = myWonMTD.reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  // My active pipeline
  const myOpenLeads = myLeads.filter((l) => openStatuses.has(l.status || ''));
  const myPipelineValue = myOpenLeads.reduce((s, l) => s + Number(l.estimated_value || 0), 0);

  // My hot leads — manual flag (priority=high) OR ML-detected (score >= 70)
  // Two sources of "hot": Sales reads context the model can't see, but the model
  // catches leads Sales hasn't gotten to yet (e.g., new high-credit lead in queue).
  const ML_HOT_THRESHOLD = 70;
  const myHotLeads = myOpenLeads.filter((l) => (
    l.priority === 'high' || ((l.potential_score ?? 0) >= ML_HOT_THRESHOLD)
  ));

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

  // Silent leads — open + no contact in 7+ days (looser than inactive)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const silentLeadsList = myOpenLeads
    .filter((l) => {
      const ref = l.last_contact_date ? new Date(l.last_contact_date) : new Date(l.created_at);
      return ref < sevenDaysAgo;
    })
    .map((l) => {
      const ref = l.last_contact_date ? new Date(l.last_contact_date) : new Date(l.created_at);
      const daysCount = Math.floor((now.getTime() - ref.getTime()) / 86400000);
      return { ...l, daysCount };
    })
    .sort((a, b) => b.daysCount - a.daysCount);

  // Hot leads — sorted by last contact (recent flagging = most actionable)
  const hotLeadsList = myHotLeads
    .slice()
    .sort((a, b) => {
      const ta = new Date(a.last_contact_date || a.created_at).getTime();
      const tb = new Date(b.last_contact_date || b.created_at).getTime();
      return tb - ta;
    });

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
    online_facebook: { label: 'Facebook',  color: C.indigo },
    online_google:   { label: 'Google',    color: C.amber },
    online_line:     { label: 'LINE',      color: C.green },
    agent_referral:  { label: 'นายหน้า',   color: C.redDeep },
    offline:         { label: 'Walk-in',   color: C.charcoal },
  };
  const sourceCounts: Record<string, number> = {};
  myLeads.forEach((l) => {
    const raw = (l.source || 'unknown').toLowerCase();
    // Collapse all "other*" variants (other, other_other: xxx, online_other: xxx) into a single bucket
    const key = raw.startsWith('other') || raw.startsWith('online_other') || raw === 'unknown' ? 'other' : raw;
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
                ? 'ยูนิตที่ดูแล · รายการส่งต่อให้ Sales · สรุปผลงาน'
                : 'ภาพรวมผลงาน · งานที่ต้องทำวันนี้ · ลีดที่ต้องติดตาม'}
            </p>
          </div>

          {loading ? (
            <div className="space-y-7">
              <div className="bg-white rounded-2xl h-[300px] animate-pulse" />
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white rounded-2xl h-[300px] animate-pulse" />
                <div className="bg-white rounded-2xl h-[300px] animate-pulse" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl h-[260px] animate-pulse" />
                <div className="bg-white rounded-2xl h-[260px] animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {/* SECTION 1 — Performance Scorecard (full width).
                  Sales/Admin see the Sales scorecard (own-closing funnel). Agents get a
                  REFERRAL scorecard instead — their role is to refer customers, not close
                  deals themselves, so a "Sales Funnel" of own leads is the wrong lens. */}
              {myId && currentTenant?.id && (
                userRole === 'agent' ? (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Send className="w-4 h-4" style={{ color: C.red }} />
                      <h2 className="text-base font-bold text-gray-900">ผลงานการแนะนำ</h2>
                      <span className="ml-auto text-xs text-gray-500">ภาพรวมจากการแนะนำลูกค้าของคุณ</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-4">
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 p-5 pl-6">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">คนสนใจจากลิงก์</p>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.redLight}f0 0%, ${C.redLight} 100%)` }}>
                            <Eye className="w-4 h-4" style={{ color: C.red }} strokeWidth={2.2} />
                          </div>
                        </div>
                        <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{viewStats.uniqueVisitors}</p>
                        <p className="text-xs text-gray-400 mt-2.5">30 วันล่าสุด</p>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 p-5 pl-6">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">ส่งต่อให้ Sales</p>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.redDeepLight}f0 0%, ${C.redDeepLight} 100%)` }}>
                            <Send className="w-4 h-4" style={{ color: C.redDeep }} strokeWidth={2.2} />
                          </div>
                        </div>
                        <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{referralStats.total}</p>
                        <p className="text-xs text-gray-400 mt-2.5">รายการทั้งหมด</p>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 p-5 pl-6">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">กำลังดำเนินการ</p>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.amberLight}f0 0%, ${C.amberLight} 100%)` }}>
                            <Clock className="w-4 h-4" style={{ color: C.amber }} strokeWidth={2.2} />
                          </div>
                        </div>
                        <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{referralStats.activeCount}</p>
                        <p className="text-xs text-gray-400 mt-2.5">Sales กำลังดูแล</p>
                      </div>
                      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 p-5 pl-6">
                        <div className="flex items-start justify-between mb-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">ปิดได้จากการแนะนำ</p>
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${C.greenLight}f0 0%, ${C.greenLight} 100%)` }}>
                            <CheckCircle2 className="w-4 h-4" style={{ color: C.green }} strokeWidth={2.2} />
                          </div>
                        </div>
                        <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{referralStats.wonCount} ดีล</p>
                        <p className="text-xs text-gray-400 mt-2.5">{formatTHB(referralStats.wonValue)}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <SelfPerformanceSection userId={myId} tenantId={currentTenant.id} />
                )
              )}

              {/* SECTION 2 — Revenue trend (2/3) + Today timeline (1/3).
                  The area chart is the headline visual variety the user asked for —
                  was missing entirely from the old layout (which was wall-to-wall bars + cards). */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" style={{ color: C.red }} />
                      <h2 className="text-base font-bold text-gray-900">
                        {userRole === 'agent' ? 'ดีลที่ปิดได้จากการแนะนำลูกค้า' : 'ผลงาน 6 เดือนล่าสุด'}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                      6 เดือน
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">
                    {trend6Months.reduce((s, m) => s + m.deals, 0) === 0
                      ? 'ยังไม่มีดีลปิดในช่วงนี้'
                      : `รวม ${trend6Months.reduce((s, m) => s + m.deals, 0)} ดีล · ${formatTHB(trend6Months.reduce((s, m) => s + m.revenue, 0))}`}
                  </p>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={trend6Months} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="myRevGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={C.red} stopOpacity={0.32} />
                          <stop offset="100%" stopColor={C.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${Math.round(v / 1_000)}K` : `${v}`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'white',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          fontSize: '12px',
                          padding: '8px 12px',
                        }}
                        formatter={(value, name) => {
                          const v = typeof value === 'number' ? value : 0;
                          return name === 'revenue' ? [formatTHB(v), 'มูลค่ารวม'] : [v, 'จำนวนดีล'];
                        }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke={C.red} strokeWidth={2.5} fill="url(#myRevGrad)" dot={false} activeDot={{ r: 4, fill: C.red, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Today timeline — compact stack of phone/visit tasks */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">งานวันนี้</h2>
                    {todayTasks.length > 0 && (
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                        {todayTasks.length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-4">นัดโทร · นัดดูยูนิต</p>
                  {todayTasks.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-gray-400 text-center">ไม่มีงานนัดวันนี้</div>
                  ) : (
                    <div className="space-y-2 max-h-[240px] overflow-y-auto">
                      {todayTasks.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => navigate(t.leadId ? `/leads/${t.leadId}` : '/leads')}
                          className="w-full flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="flex items-start gap-2.5 min-w-0 flex-1">
                            <span className="text-base flex-shrink-0 mt-0.5">{t.kind === 'visit' ? '' : ''}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{t.title}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{t.sub}</p>
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
              </div>

              {/* SECTION 3 — Source donut + Combined alerts (Sales/Admin/Owner).
                  Replaces the old "Row 3.5 source bars" with a donut chart, and merges the
                  old 3 alert cards (ลูกค้าเงียบหาย / การจองใกล้หมดอายุ) into one prioritized list. */}
              {userRole !== 'agent' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Source breakdown — horizontal bars scale better than a donut once you
                      have 5+ sources. Each row shows: label, bar (length = pct), count, pct. */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <BarChart3 className="w-4 h-4" style={{ color: C.amber }} />
                      <h2 className="text-base font-bold text-gray-900">แหล่งที่มาของลีด</h2>
                      <span className="ml-auto text-xs text-gray-500">{myLeads.length} leads</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-5">ช่องทางไหนทำลีดให้คุณมากที่สุด</p>
                    {mySourceBreakdown.length === 0 ? (
                      <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ยังไม่มี source data</div>
                    ) : (
                      <div className="space-y-3.5">
                        {mySourceBreakdown.map((s) => (
                          <div key={s.key}>
                            <div className="flex items-center justify-between mb-1.5 gap-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                <span className="text-sm font-medium text-gray-700 truncate">{s.label}</span>
                              </div>
                              <span className="tabular-nums text-xs shrink-0 flex items-center gap-2">
                                <span className="font-bold text-gray-900">{s.count}</span>
                                <span className="text-gray-400 w-9 text-right">{s.pct.toFixed(0)}%</span>
                              </span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(s.pct, 2)}%`, backgroundColor: s.color }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Unit lock expiring soon — separated from Silent Leads which covers idle leads */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Target className="w-4 h-4" style={{ color: C.amber }} />
                      <h2 className="text-base font-bold text-gray-900">ยูนิตจองใกล้หมดอายุ</h2>
                      {expiringSoon.length > 0 && (
                        <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                          {expiringSoon.length}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-4">ยูนิตที่จองไว้ใกล้หมดอายุภายใน 7 วัน · ต้องปิดดีลให้ทัน</p>
                    {expiringSoon.length === 0 ? (
                      <div className="h-[180px] flex items-center justify-center text-sm text-gray-400 text-center">
                        ไม่มียูนิตจองใกล้หมดอายุ
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">
                        {expiringSoon.map((u) => {
                          const days = daysFromNow(u.locked_until);
                          const urgent = days !== null && days <= 1;
                          return (
                            <button
                              key={`exp-${u.id}`}
                              onClick={() => navigate(`/units/${u.id}`)}
                              className="w-full flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <Target className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: urgent ? C.red : C.amber }} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-gray-900 truncate">ยูนิต {u.unit_number} · จองใกล้หมด</p>
                                  <p className="text-xs text-gray-500 mt-0.5 truncate">{propById.get(u.project_id) || '—'} · {formatTHB(Number(u.price))}</p>
                                </div>
                              </div>
                              <span className="text-xs font-semibold tabular-nums shrink-0" style={{ color: urgent ? C.red : C.amber }}>
                                เหลือ {days ?? '—'} วัน
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 3 (Agent) — Assigned units (full width).
                  Agents refer and hand off — they don't chase leads after handoff — so the
                  "stale referral" follow-up card was removed as out-of-role. */}
              {userRole === 'agent' && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase className="w-4 h-4" style={{ color: C.redDeep }} />
                      <h2 className="text-base font-bold text-gray-900">ยูนิตที่รับมอบหมาย</h2>
                      <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.redDeep, backgroundColor: C.redDeepLight }}>
                        {myAssignedUnits.length}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">{unitsAvailable} ว่าง · {unitsReserved} จอง · {unitsSold} ขายแล้ว</p>
                    {myAssignedUnits.length === 0 ? (
                      <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ยังไม่มียูนิตที่ได้รับมอบหมาย</div>
                    ) : (
                      <div className="space-y-2 max-h-[240px] overflow-y-auto">
                        {myAssignedUnits.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => navigate(`/units/${u.id}`)}
                            className="w-full flex items-start justify-between gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">{u.unit_number}</p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{propById.get(u.project_id) || '—'} · {formatTHB(Number(u.price))}</p>
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
              )}

              {/* ACTION — Hot Leads + Silent Leads (Sales only) */}
              {userRole !== 'agent' && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">ACTION — ลงมือเลย</p>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Hot Leads */}
                    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4" style={{ color: C.red }} />
                          <h3 className="text-base font-bold text-gray-900">Hot Leads</h3>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                          {hotLeadsList.length} ต้องตามด่วน
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">ติ๊กด่วน (Sales) + AI แนะนำ (score ≥ 70)</p>
                      {hotLeadsList.length === 0 ? (
                        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดร้อนตอนนี้</div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {hotLeadsList.map((l) => {
                            const badge = stageBadge(l.status);
                            const isManualHot = l.priority === 'high';
                            const isAiHot = !isManualHot && (l.potential_score ?? 0) >= ML_HOT_THRESHOLD;
                            return (
                              <button
                                key={l.id}
                                onClick={() => navigate(`/leads/${l.id}`)}
                                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.redLight }}>
                                    <Users className="w-4 h-4" style={{ color: C.red }} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <p className="text-sm font-semibold text-gray-900 truncate">{l.customers?.full_name || 'ไม่ระบุชื่อ'}</p>
                                      {isManualHot && (
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0" style={{ color: C.red, backgroundColor: C.redLight }}>
                                          ติ๊กด่วน
                                        </span>
                                      )}
                                      {isAiHot && (
                                        <span className="inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold flex-shrink-0" style={{ color: C.indigo, backgroundColor: '#eef2ff' }}>
                                          AI {l.potential_score}%
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-gray-500 truncate">
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1" style={{ color: badge.color, backgroundColor: badge.bg }}>
                                        {badge.label}
                                      </span>
                                      {l.property_id ? propById.get(l.property_id) || '—' : '—'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                  {l.last_contact_date ? (() => {
                                    const days = Math.floor((Date.now() - new Date(l.last_contact_date).getTime()) / 86400000);
                                    return (
                                      <>
                                        <p className="text-sm font-bold tabular-nums" style={{ color: days >= 7 ? C.red : days >= 3 ? C.amber : C.charcoal }}>
                                          {days === 0 ? 'วันนี้' : `${days} วัน`}
                                        </p>
                                        <p className="text-[10px] text-gray-400">ติดต่อล่าสุด</p>
                                      </>
                                    );
                                  })() : (
                                    <>
                                      <p className="text-sm font-bold tabular-nums" style={{ color: C.red }}>ยังไม่ติด</p>
                                      <p className="text-[10px] text-gray-400">รีบโทร</p>
                                    </>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Silent Leads */}
                    <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.amberLight }}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4" style={{ color: C.amber }} />
                          <h3 className="text-base font-bold text-gray-900">Silent Leads</h3>
                        </div>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                          {silentLeadsList.length} เสี่ยงหลุด
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mb-4">ไม่ติดต่อมากกว่า 7 วัน · เรียงเก่าสุด</p>
                      {silentLeadsList.length === 0 ? (
                        <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดเงียบ — ติดตามครบทุกคน</div>
                      ) : (
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                          {silentLeadsList.map((l) => {
                            const sev = l.daysCount >= 30 ? C.red : l.daysCount >= 14 ? C.amber : '#d97706';
                            const badge = stageBadge(l.status);
                            return (
                              <button
                                key={l.id}
                                onClick={() => navigate(`/leads/${l.id}`)}
                                className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 text-left"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: C.amberLight }}>
                                    <PhoneOff className="w-4 h-4" style={{ color: sev }} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-gray-900 truncate">{l.customers?.full_name || 'ไม่ระบุชื่อ'}</p>
                                    <p className="text-[11px] text-gray-500 truncate">
                                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold mr-1" style={{ color: badge.color, backgroundColor: badge.bg }}>
                                        {badge.label}
                                      </span>
                                      {l.property_id ? propById.get(l.property_id) || '—' : '—'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right flex-shrink-0 ml-2">
                                  <p className="text-sm font-bold tabular-nums" style={{ color: sev }}>{l.daysCount}</p>
                                  <p className="text-[10px] text-gray-400">วัน</p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 4 — Active Deals (Sales) | Referrals (Agent) */}
              {userRole === 'agent' ? (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Send className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">รายการส่งต่อให้ Sales</h2>
                    <span className="ml-auto text-xs text-gray-500">{myReferrals.length} referrals</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">ติดตามสถานะรายการส่งต่อ</p>
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
                              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/leads/${r.id}`)}>
                                <td className="py-3 px-3 font-medium text-gray-900">{r.customers?.full_name || '(ไม่ระบุ)'}</td>
                                <td className="py-3 px-3 text-gray-700 text-xs">{r.sales_person?.full_name || (r.assigned_to ? '✓ ส่งต่อแล้ว' : '— รอ Sales')}</td>
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
                    <h2 className="text-base font-bold text-gray-900">ดีลที่อยู่ในความรับผิดชอบ</h2>
                    <span className="ml-auto text-xs text-gray-500">{activeDeals.length} ดีล</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">เรียงตามขั้นตอนการปิดดีล</p>
                  {activeDeals.length === 0 ? (
                    <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
                      ยังไม่มีดีลที่ดูแล — ขอให้แอดมินมอบหมายลูกค้าให้
                    </div>
                  ) : (
                    <div className="overflow-auto max-h-[480px]">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white z-10">
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
                              <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/leads/${l.id}`)}>
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

              {/* SECTION 5 — Upcoming site visits (full width) */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center gap-2 mb-1">
                  <CalendarDays className="w-4 h-4" style={{ color: C.amber }} />
                  <h2 className="text-base font-bold text-gray-900">นัดดูยูนิตที่กำลังจะถึง</h2>
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                    {upcomingVisits.length} นัด
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-4">นัดเข้าชมยูนิตที่อยู่ในความดูแล</p>
                {upcomingVisits.length === 0 ? (
                  <div className="h-[100px] flex items-center justify-center text-sm text-gray-400">ยังไม่มีนัดดูยูนิตที่กำลังจะถึง</div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[240px] overflow-y-auto">
                    {upcomingVisits.map((v) => {
                      const d = new Date(v.viewing_date);
                      const isToday = d.toDateString() === new Date().toDateString();
                      const dateLabel = d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                      return (
                        <button
                          key={v.id}
                          onClick={() => navigate(`/leads`)}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left border border-gray-100"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{v.customer_name || 'ลูกค้า'} · ยูนิต {v.unit_number || '—'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{dateLabel}</p>
                          </div>
                          <span className="text-xs font-semibold tabular-nums shrink-0 px-2 py-0.5 rounded-full" style={{
                            color: isToday ? C.red : C.amber,
                            backgroundColor: isToday ? C.redLight : C.amberLight,
                          }}>
                            {isToday ? 'วันนี้' : 'เร็วๆนี้'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 6 (Agent only) — View stats / audience attribution */}
              {userRole === 'agent' && viewStats.totalViews > 0 && (
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Eye className="w-4 h-4" style={{ color: C.indigo }} />
                    <h2 className="text-base font-bold text-gray-900">ผู้สนใจจากลิงก์อ้างอิง</h2>
                    <span className="ml-auto text-xs text-gray-500">30 วันล่าสุด</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">คนที่กดลิงก์จากคุณแล้วเข้ามาดูยูนิต/โครงการ — ก่อนกลายเป็น Lead</p>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                      <p className="text-[11px] text-gray-500 font-medium">การเข้าชม</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{viewStats.totalViews}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                      <p className="text-[11px] text-gray-500 font-medium">ผู้ใช้ไม่ซ้ำ</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">{viewStats.uniqueVisitors}</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                      <p className="text-[11px] text-gray-500 font-medium">กลับมาดูซ้ำ</p>
                      <p className="text-2xl font-bold text-amber-700 tabular-nums mt-1">{viewStats.returningVisitors}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">สัญญาณสนใจสูง</p>
                    </div>
                    <div className="rounded-xl border border-gray-100 bg-gray-50/40 p-4">
                      <p className="text-[11px] text-gray-500 font-medium">เวลาเฉลี่ย</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums mt-1">
                        {viewStats.avgDurationSec >= 60
                          ? `${Math.floor(viewStats.avgDurationSec / 60)}:${String(viewStats.avgDurationSec % 60).padStart(2, '0')}`
                          : `${viewStats.avgDurationSec}s`}
                      </p>
                    </div>
                  </div>

                  {viewStats.topUnits.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-700 mb-2">ยูนิตที่ถูกดูมากที่สุด</p>
                      <div className="space-y-1.5">
                        {viewStats.topUnits.map((u) => {
                          const maxViews = viewStats.topUnits[0]?.views || 1;
                          const pct = Math.round((u.views / maxViews) * 100);
                          return (
                            <button
                              key={u.unit_id || u.unit_number}
                              onClick={() => u.unit_id && navigate(`/units/${u.unit_id}`)}
                              className="w-full flex items-center gap-3 text-left rounded-lg px-3 py-2 hover:bg-gray-50"
                            >
                              <span className="text-xs font-medium text-gray-700 min-w-[80px]">ยูนิต {u.unit_number}</span>
                              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.indigo }} />
                              </div>
                              <span className="text-xs tabular-nums text-gray-600 min-w-[40px] text-right">{u.views}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
