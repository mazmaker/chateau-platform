import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { LEAD_STATUS_LABELS } from '@/lib/leadStatus';
import { SubscriptionGuard } from '@/hooks/useSubscriptionFeatures';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  UserPlus,
  PhoneOff,
  Clock,
  Target,
  RefreshCw,
  AlertTriangle,
  Users,
  Briefcase,
  DollarSign,
  TrendingUp,
  Eye,
} from 'lucide-react';

const KK = {
  red: '#e60023', redLight: '#fff1f2',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
  indigo: '#4f46e5', indigoLight: '#eef2ff',
};

const tooltipStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

interface LeadRow {
  id: string;
  customer_id: string | null;
  status: string | null;
  source: string | null;
  priority: string | null;
  urgency_level: string | null;
  potential_score: number | null;
  estimated_value: number | null;
  last_contact_date: string | null;
  assigned_to: string | null;
  property_id: string | null;
  unit_id: string | null;
  created_at: string;
  customer?: { full_name: string | null; phone: string | null } | null;
}

interface ActivityRow {
  id: string;
  activity_type: string;
  metadata: any;
  created_at: string;
}

interface InterestRow {
  id: string;
  unit_id: string | null;
  lead_id: string | null;
}

interface UnitRow {
  id: string;
  unit_number: string;
  project_id: string;
  status: string;
  thumbnail_url: string | null;
}

interface PropertyRow {
  id: string;
  name: string;
}

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

interface PropertyViewRow {
  unit_id: string | null;
  visitor_id: string;
}

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost'] as const;
const STATUS_LABEL: Record<string, string> = {
  new: 'ลีดใหม่',
  contacted: 'ติดต่อแล้ว',
  qualified: 'คัดกรองแล้ว',
  negotiating: 'กำลังเจรจา',
  won: LEAD_STATUS_LABELS.won,
  lost: LEAD_STATUS_LABELS.lost,
};
// Mono Chateau-red gradient — darker stages = deeper red, won = brand, lost = neutral
const STATUS_COLOR: Record<string, string> = {
  new: '#fee2e2',         // red-100 (palest)
  contacted: '#fecaca',   // red-200
  qualified: '#fca5a5',   // red-300
  negotiating: '#f87171', // red-400
  won: '#e60023',         // chateau red (deepest, success)
  lost: '#e5e7eb',        // gray-200 (neutral, faded)
};
// Label / count text colors — readable on white card
const STATUS_COLOR_TEXT: Record<string, string> = {
  new: '#9f1239',         // rose-800
  contacted: '#9f1239',
  qualified: '#9f1239',
  negotiating: '#9f1239',
  won: '#e60023',         // chateau brand
  lost: '#6b7280',        // gray-500 (de-emphasized)
};

const SOURCE_LABEL: Record<string, string> = {
  // Online channels
  online_facebook: 'Facebook',
  online_google: 'Google',
  online_line: 'LINE',
  // Offline channels — 'offline' and 'walk_in' both mean customer came in person; unify under one label
  offline: 'Walk-in',
  walk_in: 'Walk-in',
  // Referrals
  agent_referral: 'นายหน้าแนะนำ',
  // Catch-all for sources that don't fit a primary channel (TikTok, YouTube, brochure variants, etc.)
  other: 'อื่นๆ',
};

const sourceShort = (raw: string | null) => {
  if (!raw) return 'ไม่ระบุ';
  if (SOURCE_LABEL[raw]) return SOURCE_LABEL[raw];
  // Handle malformed "other_other: other_other: foo" → "อื่นๆ: foo" (legacy dirty data)
  if (raw.startsWith('other_') || raw.startsWith('other:')) {
    let cleaned = raw;
    // Strip up to 5 levels of nested "other_" / "other:" prefixes
    for (let i = 0; i < 5; i++) {
      const next = cleaned.replace(/^other_|^other:\s*/i, '').trim();
      if (next === cleaned) break;
      cleaned = next;
    }
    return cleaned ? `อื่นๆ: ${cleaned}` : 'อื่นๆ';
  }
  return raw;
};

// Currency format — see Index.tsx for the canonical version (ล้าน / K with
// thousand separators + scale-based decimal precision).
const formatTHB = (n: number) => {
  if (n === 0) return '฿0';
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

const Analytics = () => {
  const navigate = useNavigate();
  const { currentTenant } = useSimpleAuth();
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  // Anonymous browse signals (Funnel layer 1). Used by Hot Listings to show real
  // traffic per unit alongside lead_interests (committed interest).
  const [propertyViews, setPropertyViews] = useState<PropertyViewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const load = async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    try {
      setLoading(true);
      const tid = currentTenant.id;
      const [leadsRes, actsRes, intRes, unitsRes, propsRes, usersRes, viewsRes] = await Promise.all([
        (supabase.from('leads') as any)
          .select('id, customer_id, status, source, priority, urgency_level, potential_score, estimated_value, last_contact_date, assigned_to, property_id, unit_id, created_at, customer:customers(full_name, phone)')
          .eq('tenant_id', tid)
          .order('created_at', { ascending: false }),
        (supabase.from('activity_logs') as any)
          .select('id, activity_type, metadata, created_at')
          .eq('tenant_id', tid)
          .in('activity_type', ['lead_created', 'lead_contacted', 'lead_qualified', 'lead_won', 'lead_status_updated'])
          .order('created_at', { ascending: false })
          .limit(2000),
        (supabase.from('lead_interests') as any)
          .select('id, unit_id, lead_id')
          .eq('tenant_id', tid),
        (supabase.from('units') as any)
          .select('id, unit_number, project_id, status, thumbnail_url')
          .eq('tenant_id', tid),
        (supabase.from('properties') as any)
          .select('id, name')
          .eq('tenant_id', tid),
        (supabase.from('users') as any)
          .select('id, full_name, email, role')
          .eq('tenant_id', tid),
        // Anonymous + authed property views — used to compute browse stats per unit
        // (Hot Listings funnel). Limit to ~10k to bound payload; for active tenants
        // we'd add a since=last-90-days filter, but for demo full-history is fine.
        (supabase.from('property_views') as any)
          .select('unit_id, visitor_id')
          .eq('tenant_id', tid)
          .not('unit_id', 'is', null)
          .limit(10000),
      ]);
      setLeads((leadsRes.data || []) as LeadRow[]);
      setActivities((actsRes.data || []) as ActivityRow[]);
      setInterests((intRes.data || []) as InterestRow[]);
      setUnits((unitsRes.data || []) as UnitRow[]);
      setProperties((propsRes.data || []) as PropertyRow[]);
      setUsers((usersRes.data || []) as UserRow[]);
      setPropertyViews((viewsRes.data || []) as PropertyViewRow[]);
    } catch (e) {
      console.error('Analytics load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentTenant?.id]);

  // Re-load when the user returns to this tab/window so adding a hot lead in
  // /leads and coming back here updates the count + list immediately. Cheap:
  // the focus event fires only on the active tab and load() is bounded by tenant.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant?.id]);

  // ─── Period window ─────────────────────────────────────
  const periodDays = period === '7d' ? 7 : period === '30d' ? 30 : 90;
  const periodStart = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - periodDays); d.setHours(0, 0, 0, 0); return d;
  }, [periodDays]);
  const now = new Date();

  // Lookup maps
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const propById = useMemo(() => new Map(properties.map((p) => [p.id, p])), [properties]);
  const unitById = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  // ─── KPI: New leads in period ──────────────────────────
  const newInPeriod = leads.filter((l) => new Date(l.created_at) >= periodStart);

  // ─── KPI: Silent leads (>7/14/30 days no contact) ───
  const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const fourteenDaysAgo = new Date(); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const isSilent = (l: LeadRow, since: Date) => {
    if (l.status === 'won' || l.status === 'lost') return false;
    const lastTouch = l.last_contact_date ? new Date(l.last_contact_date) : new Date(l.created_at);
    return lastTouch < since;
  };
  const silent7 = leads.filter((l) => isSilent(l, sevenDaysAgo));
  const silent14 = leads.filter((l) => isSilent(l, fourteenDaysAgo));
  const silent30 = leads.filter((l) => isSilent(l, thirtyDaysAgo));

  // ─── KPI: SLA breach ──
  const twoHoursAgo = new Date(); twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
  const slaBreach = leads.filter((l) => {
    if (l.status !== 'new') return false;
    return new Date(l.created_at) < twoHoursAgo && !l.last_contact_date;
  });

  // ─── KPI: Conversion rate ──
  const totalClosed = leads.filter((l) => l.status === 'won' || l.status === 'lost').length;
  const totalWon = leads.filter((l) => l.status === 'won').length;
  const totalLost = leads.filter((l) => l.status === 'lost').length;
  const conversionRate = totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0;
  const leadLossRate = totalClosed > 0 ? (totalLost / totalClosed) * 100 : 0;

  // Lead Loss Rate zone
  const leadLossZones = [
    { upTo: 40, color: KK.green, label: 'ปกติ' },
    { upTo: 70, color: KK.amber, label: 'เฝ้าระวัง' },
    { upTo: 100, color: KK.red, label: 'วิกฤต' },
  ];
  const leadLossZone = leadLossZones.find((z) => leadLossRate <= z.upTo) || leadLossZones[leadLossZones.length - 1];
  const leadLossZoneBg =
    leadLossZone.color === KK.green ? KK.greenLight
    : leadLossZone.color === KK.amber ? KK.amberLight
    : KK.redLight;

  // ─── KPI: Pipeline Value (snapshot, no period — sum of estimated_value across open leads)
  const openStatusSet = new Set(['new', 'contacted', 'qualified', 'negotiating']);
  const pipelineValue = leads
    .filter((l) => openStatusSet.has(l.status || ''))
    .reduce((sum, l) => sum + Number(l.estimated_value || 0), 0);
  const pipelineLeadCount = leads.filter((l) => openStatusSet.has(l.status || '')).length;

  // Revenue/avg-deal calculations removed — those numbers live on Executive Dashboard
  // now ("ยอดขายเดือนนี้"). Analytics focuses on funnel efficiency (conversion rate).

  // ─── Cumulative funnel reach (used to compute stage-to-stage pass %)
  // A lead has "reached" stage X if its current status is X or any later stage in the forward chain.
  // Lost is treated as a parallel exit (not part of the forward chain).
  const forwardChain = ['new', 'contacted', 'qualified', 'negotiating', 'won'] as const;
  const reachedBeyond: Record<string, number> = {};
  forwardChain.forEach((stage, idx) => {
    const stagesAtOrBeyond = forwardChain.slice(idx);
    reachedBeyond[stage] = leads.filter((l) => (stagesAtOrBeyond as readonly string[]).includes(l.status || '')).length;
  });
  // Helper for funnel widget: "% of those who reached the previous stage who also reached this stage"
  const stagePassRate = (currentStage: string): number | null => {
    const idx = forwardChain.indexOf(currentStage as any);
    if (idx <= 0) return null; // first stage or not in forward chain
    const prevReach = reachedBeyond[forwardChain[idx - 1]];
    if (!prevReach) return null;
    return (reachedBeyond[currentStage] / prevReach) * 100;
  };

  // Thai-natural money formatter — alias for the file-level formatTHB so
  // both functions render the same way.
  const fmtMoney = formatTHB;

  // ─── Funnel ──
  // Cross-section counts (kept around for "lost" which is a terminal exit, not in forward chain)
  const funnelCounts: Record<string, number> = {};
  STATUS_ORDER.forEach((s) => { funnelCounts[s] = 0; });
  leads.forEach((l) => {
    const s = l.status || 'new';
    if (s in funnelCounts) funnelCounts[s]++;
  });
  // Bars use CUMULATIVE reach (true funnel shape — always narrowing) for forward-chain stages.
  // For 'lost' (parallel exit), keep the cross-section count.
  // reachedBeyond is computed earlier from the same forwardChain.
  const funnelData = STATUS_ORDER.map((s) => {
    const isForward = (forwardChain as readonly string[]).includes(s);
    const count = isForward ? (reachedBeyond[s] || 0) : (funnelCounts[s] || 0);
    return {
      stage: STATUS_LABEL[s],
      key: s,
      count,
      currentCount: funnelCounts[s] || 0,
      isForward,
      color: STATUS_COLOR[s],
      textColor: STATUS_COLOR_TEXT[s],
    };
  });
  const maxFunnel = Math.max(...funnelData.map((d) => d.count), 1);

  // ─── Source breakdown ──
  const sourceCounts: Record<string, number> = {};
  leads.forEach((l) => {
    const s = sourceShort(l.source);
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  });
  const sourceData = Object.entries(sourceCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ─── Trend ──
  const trendData = useMemo(() => {
    const days: { date: string; key: string; new: number; contacted: number; won: number }[] = [];
    for (let i = periodDays - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      days.push({ date: label, key, new: 0, contacted: 0, won: 0 });
    }
    leads.forEach((l) => {
      const k = (l.created_at || '').slice(0, 10);
      const day = days.find((d) => d.key === k);
      if (day) day.new++;
    });
    activities.forEach((a) => {
      const k = (a.created_at || '').slice(0, 10);
      const day = days.find((d) => d.key === k);
      if (!day) return;
      if (a.activity_type === 'lead_contacted') day.contacted++;
      if (a.activity_type === 'lead_won') day.won++;
    });
    return days;
  }, [leads, activities, periodDays]);

  // ─── Hot Leads ──
  // Manual flag from Sales is the single source of truth here. Algorithm scores
  // (potential_score) and urgency_level checkboxes were removed because the team
  // on the ground reads conversation context the score model can't see — a lead
  // saying "I'm getting married next month" is hot even with a 40 score.
  // Sales toggles l.priority='high' from LeadPriorityEditor; this surface
  // updates in real time.
  const hotLeads = leads
    .filter((l) => {
      if (l.status === 'won' || l.status === 'lost') return false;
      return l.priority === 'high';
    })
    .map((l) => ({
      ...l,
      assignedName: l.assigned_to ? userById.get(l.assigned_to)?.full_name || null : null,
      propName: l.property_id ? propById.get(l.property_id)?.name || null : null,
      unitNumber: l.unit_id ? unitById.get(l.unit_id)?.unit_number || null : null,
    }))
    // Most recent first — Sales just flagged this lead = top of the list.
    // (Lead type doesn't include updated_at in this view; last_contact_date is the
    // best signal of recent Sales attention, falling back to created_at.)
    // No more slice — show ALL hot leads; the container below is scrollable so
    // a long Hot Leads list doesn't push the rest of the page down.
    .sort((a, b) => {
      const ta = new Date(a.last_contact_date || a.created_at).getTime();
      const tb = new Date(b.last_contact_date || b.created_at).getTime();
      return tb - ta;
    });

  // ─── Silent Leads list ──
  const silentList = silent7
    .map((l) => {
      const lastTouch = l.last_contact_date ? new Date(l.last_contact_date) : new Date(l.created_at);
      const daysCount = Math.floor((now.getTime() - lastTouch.getTime()) / 86400000);
      return {
        ...l,
        daysCount,
        assignedName: l.assigned_to ? userById.get(l.assigned_to)?.full_name || null : null,
        propName: l.property_id ? propById.get(l.property_id)?.name || null : null,
      };
    })
    .sort((a, b) => b.daysCount - a.daysCount);

  // ─── Hot Listings ──
  // Combines two signals so the card tells a full funnel story:
  //   (1) property_views   — browse events (anonymous + authed) per unit
  //   (2) lead_interests   — committed interest (Sales/Admin/Agent registered)
  // Sorted by views (top-of-funnel signal) since the section is about discovery
  // intent; the inquiry chip alongside shows how well those views convert.
  const unitInquiryMap = new Map<string, { count: number; leadIds: Set<string> }>();
  interests.forEach((i) => {
    if (!i.unit_id) return;
    const existing = unitInquiryMap.get(i.unit_id) || { count: 0, leadIds: new Set<string>() };
    existing.count++;
    if (i.lead_id) existing.leadIds.add(i.lead_id);
    unitInquiryMap.set(i.unit_id, existing);
  });

  const unitViewMap = new Map<string, { views: number; visitorIds: Set<string> }>();
  propertyViews.forEach((v) => {
    if (!v.unit_id) return;
    const e = unitViewMap.get(v.unit_id) || { views: 0, visitorIds: new Set<string>() };
    e.views++;
    if (v.visitor_id) e.visitorIds.add(v.visitor_id);
    unitViewMap.set(v.unit_id, e);
  });

  // Build candidate set from BOTH sources so a unit with views but no leads
  // still surfaces (early funnel) and a unit with leads but no tracked views
  // (e.g., walk-in registered without browsing first) still shows up.
  const candidateUnitIds = new Set<string>([
    ...unitInquiryMap.keys(),
    ...unitViewMap.keys(),
  ]);

  const hotListings = Array.from(candidateUnitIds)
    .map((unitId) => {
      const unit = unitById.get(unitId);
      if (!unit) return null;
      const inq = unitInquiryMap.get(unitId);
      const vw = unitViewMap.get(unitId);
      return {
        unitId,
        unitNumber: unit.unit_number,
        thumbnail: unit.thumbnail_url,
        status: unit.status,
        propName: propById.get(unit.project_id)?.name || '(ไม่ระบุโครงการ)',
        inquiries: inq?.count || 0,
        uniqueLeads: inq?.leadIds.size || 0,
        views: vw?.views || 0,
        uniqueVisitors: vw?.visitorIds.size || 0,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    // Composite score — heavily weight views (top-of-funnel discovery) but use
    // committed-interest counts as a strong secondary signal so a unit with
    // 1 view but 5 leads (sales-driven inquiry) still ranks above 5 views with 0 leads.
    .sort((a, b) => (b.views + b.uniqueLeads * 10) - (a.views + a.uniqueLeads * 10))
    .slice(0, 6);

  const kpiCards = [
    {
      title: 'ลีดมาใหม่',
      value: newInPeriod.length.toLocaleString(),
      sub: `${periodDays} วันล่าสุด`,
      icon: UserPlus,
      color: KK.red,
      bg: KK.redLight,
    },
    {
      title: 'ลีดเงียบ > 7 วัน',
      value: silent7.length.toLocaleString(),
      sub: `${silent14.length} เงียบ >14 วัน · ${silent30.length} >30 วัน`,
      icon: PhoneOff,
      color: KK.orange,
      bg: KK.orangeLight,
    },
    {
      title: 'SLA Breach',
      value: slaBreach.length.toLocaleString(),
      sub: 'ลีดใหม่ที่ยังไม่ติดต่อใน 2 ชม.',
      icon: Clock,
      color: KK.amber,
      bg: KK.amberLight,
    },
    {
      // Renamed from "Pipeline Value" — sum of estimated_value for OPEN leads
      // (new/contacted/qualified/negotiating). Distinct from Executive Dashboard's
      // "มูลค่าการจอง" which counts only reserved units — this number is wider
      // because it includes everything Sales is still chasing.
      title: 'มูลค่าลีดทั้งหมด',
      value: fmtMoney(pipelineValue),
      sub: `${pipelineLeadCount} ลีดที่ยังเปิดอยู่`,
      icon: TrendingUp,
      color: KK.blue,
      bg: KK.blueLight,
    },
    {
      // Conversion rate replaces the redundant "รายได้รวม" card — revenue lives
      // on Executive Dashboard ("ยอดขายเดือนนี้"). Sales managers care more about
      // funnel efficiency than absolute dollars here.
      title: 'อัตราปิดดีล',
      value: `${conversionRate.toFixed(1)}%`,
      sub: totalClosed > 0
        ? `Won ${totalWon} จาก ${totalClosed} ดีลที่จบแล้ว`
        : 'ยังไม่มีดีลที่จบในช่วงนี้',
      icon: DollarSign,
      color: KK.green,
      bg: KK.greenLight,
    },
  ];

  return (
    <SubscriptionGuard feature="analytics" showUpgradePrompt={true}>
      <div className="p-6 lg:p-8 space-y-7">
        {/* Title */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
              Lead Analytics
            </span>
            <h1 className="text-2xl font-bold text-gray-900">วิเคราะห์ลีด</h1>
            <p className="text-[15px] text-gray-500 mt-1.5">ภาพรวมตัวเลข · คนที่ต้องตาม · ทีมขาย</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${period === p ? 'text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'}`}
                  style={period === p ? { backgroundColor: KK.red } : {}}
                >
                  {p === '7d' ? '7 วัน' : p === '30d' ? '30 วัน' : '90 วัน'}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> รีเฟรช
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-12 bg-white rounded-2xl border border-gray-100">
            <RefreshCw className="w-5 h-5 animate-spin" style={{ color: KK.red }} />
            <span className="ml-2 text-sm text-gray-500">กำลังโหลดข้อมูล...</span>
          </div>
        )}

        {/* KPI Row */}
        <div className={`grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          {kpiCards.map((k, i) => (
            <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft">
              <div className="flex items-start justify-between mb-5">
                <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{k.title}</p>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                  <k.icon className="w-5 h-5" style={{ color: k.color }} strokeWidth={2.2} />
                </div>
              </div>
              <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{k.value}</p>
              <p className="text-[12px] font-medium text-gray-500 mt-3.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Lead Loss Rate — featured panel with breakdown */}
        <div className={`bg-white border border-gray-100 rounded-2xl shadow-soft p-7 relative overflow-hidden ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: leadLossZone.color }} />
          <div className="pl-3 grid grid-cols-1 sm:grid-cols-2 gap-7 items-center">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-4">Lead Loss Rate</p>
              <div className="flex items-baseline gap-2 mb-3">
                <p className="text-[32px] font-bold tabular-nums leading-none text-gray-900 tracking-tight">
                  {totalClosed > 0 ? leadLossRate.toFixed(1) : '—'}
                </p>
                {totalClosed > 0 && <span className="text-lg font-medium text-gray-500">%</span>}
              </div>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ backgroundColor: totalClosed > 0 ? leadLossZoneBg : '#f3f4f6' }}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: totalClosed > 0 ? leadLossZone.color : '#9ca3af' }} />
                <span className="text-[11px] font-semibold" style={{ color: totalClosed > 0 ? leadLossZone.color : '#9ca3af' }}>
                  {totalClosed > 0 ? leadLossZone.label : 'ข้อมูลไม่พอ'}
                </span>
              </span>
            </div>
            <div className="space-y-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">รายละเอียด</p>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-600">Won</span>
                  <span className="font-bold tabular-nums text-gray-900">{totalWon}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0}%`, backgroundColor: KK.green }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-600">Loss</span>
                  <span className="font-bold tabular-nums text-gray-900">{totalLost}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${totalClosed > 0 ? (totalLost / totalClosed) * 100 : 0}%`, backgroundColor: KK.red }} />
                </div>
              </div>
              <p className="text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                รวม Won + Loss ทั้งหมด <span className="font-semibold text-gray-700 tabular-nums">{totalClosed}</span> ดีล
              </p>
            </div>
          </div>
        </div>

        {/* ═══ INSIGHT — ภาพรวมตัวเลข ═══ */}
        <div className={`space-y-2 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">INSIGHT — ภาพรวมตัวเลข</h2>
        </div>

        {/* Row 1: Funnel + Source */}
        <div className={`grid grid-cols-1 xl:grid-cols-3 gap-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Lead Funnel</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  กรวยปิดดีล · ลีดทั้งหมด {leads.length} คน · ตัวเลข = ลีดที่<strong>เคยผ่าน</strong> stage นี้ ('ปิดการขายไม่สำเร็จ' = นับเฉพาะปัจจุบัน)
                </p>
              </div>
            </div>
            <div className="flex-1 flex items-end justify-between gap-3 sm:gap-4 min-h-[14rem] px-2 pt-6 pb-2">
              {funnelData.map((f) => {
                const heightPct = (f.count / maxFunnel) * 100;
                const totalPct = leads.length > 0 ? (f.count / leads.length) * 100 : 0;
                const pass = stagePassRate(f.key);
                // For forward-chain stages, show "ค้างอยู่ N" if some leads are still parked at this stage
                const showCurrent = f.isForward && f.currentCount > 0 && f.currentCount !== f.count;
                return (
                  <div key={f.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    {/* Count on top */}
                    <div className="flex flex-col items-center mb-1.5">
                      <span className="text-sm font-bold text-gray-900 tabular-nums leading-none">{f.count}</span>
                      <span className="text-[10px] text-gray-600 tabular-nums mt-0.5">{totalPct.toFixed(0)}%</span>
                      {showCurrent && (
                        <span className="text-[9px] text-gray-400 tabular-nums mt-0.5" title="ลีดที่ยังอยู่ที่ stage นี้ตอนนี้ (ไม่นับที่เลื่อนไปข้างหน้าแล้ว)">
                          ค้าง {f.currentCount}
                        </span>
                      )}
                    </div>
                    {/* Bar */}
                    <div className="w-full max-w-[64px] rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(heightPct, 3)}%`,
                        backgroundColor: f.key === 'lost' ? '#9ca3af' : '#f87171',
                        minHeight: f.count > 0 ? '6px' : '2px',
                        opacity: f.count > 0 ? 1 : 0.3,
                      }}
                    />
                    {/* Label below */}
                    <div className="mt-2 flex flex-col items-center min-h-[34px]">
                      <span className="text-[11px] font-semibold text-gray-800 text-center leading-tight">{f.stage}</span>
                      {pass !== null && (
                        <span
                          className={`text-[9px] font-semibold mt-0.5 ${pass >= 50 ? 'text-emerald-600' : pass >= 25 ? 'text-amber-600' : 'text-rose-600'}`}
                          title="อัตราที่ลีดผ่านจาก stage ก่อนหน้ามาถึง stage นี้ (cumulative)"
                        >
                          → ผ่าน {pass.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
            <h3 className="text-base font-bold text-gray-900">แหล่งที่มาของลีด</h3>
            <p className="text-xs text-gray-500 mt-0.5 mb-5">Lead Sources</p>
            {sourceData.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-4">
                {sourceData.map((s, i) => {
                  const max = Math.max(...sourceData.map((x) => x.value), 1);
                  const widthPct = (s.value / max) * 100;
                  // Monochromatic — all bars in brand red, opacity fades by rank
                  const denom = Math.max(sourceData.length - 1, 1);
                  const opacity = Math.max(0.25, 1 - (i / denom) * 0.75);
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700">{s.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color: KK.red }}>{s.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, backgroundColor: KK.red, opacity }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Trend */}
        <div className={`bg-white border border-gray-100 rounded-2xl shadow-soft p-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900">แนวโน้ม Lead รายวัน</h3>
              <p className="text-xs text-gray-500 mt-0.5">{periodDays} วันล่าสุด · ลีดมาใหม่ vs ติดต่อกลับ vs ปิดดีล</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="newGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={KK.red} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="contGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={KK.amber} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={KK.amber} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="wonGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={KK.green} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={KK.green} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={Math.max(0, Math.floor(periodDays / 12))} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="new" name="ลีดใหม่" stroke={KK.red} strokeWidth={2.5} fill="url(#newGrad)" dot={false} />
              <Area type="monotone" dataKey="contacted" name="ติดต่อกลับ" stroke={KK.amber} strokeWidth={2} fill="url(#contGrad)" dot={false} />
              <Area type="monotone" dataKey="won" name="ปิดดีล" stroke={KK.green} strokeWidth={2} fill="url(#wonGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex gap-5 mt-3 pl-2">
            <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.red }} /><span className="text-xs text-gray-600">ลีดใหม่</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.amber }} /><span className="text-xs text-gray-600">ติดต่อกลับ</span></div>
            <div className="flex items-center gap-2"><div className="w-2.5 h-0.5 rounded" style={{ backgroundColor: KK.green }} /><span className="text-xs text-gray-600">ปิดดีล</span></div>
          </div>
        </div>

        {/* ═══ ACTION — คนที่ต้องตาม + ทีมขาย ═══ */}
        <div className={`space-y-2 pt-3 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">ACTION — ลงมือเลย</h2>
        </div>

        {/* Row 3: Hot Leads + Silent Leads */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-gray-900">Hot Leads</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                {hotLeads.length} ต้องตามด่วน
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">ลีดที่ทีมขายติ๊กว่าด่วน (priority = สูง) · กดเพื่อเปิด lead</p>
            {hotLeads.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดร้อนตอนนี้</div>
            ) : (
              // Scrollable so an unbounded number of hot leads doesn't push the rest
              // of the page down. ~500px ≈ 8 rows visible; the user scrolls inside the
              // panel to see more.
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {hotLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/leads/${l.id}`)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: KK.redLight }}>
                        <Users className="w-4 h-4" style={{ color: KK.red }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{l.customer?.full_name || 'ไม่ระบุชื่อ'}</p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {STATUS_LABEL[l.status || 'new']} · {l.propName || sourceShort(l.source)}
                          {l.assignedName ? ` · ${l.assignedName}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      {/* "Last touch" — when Sales last contacted this hot lead. Replaces
                          the legacy potential_score readout, which was misleading once we
                          switched to manual priority flagging (a 39-score lead could still
                          be Hot if Sales flagged it). Sales scanning this list cares about
                          "who haven't I called in a while" far more than the model score. */}
                      {l.last_contact_date ? (() => {
                        const days = Math.floor((Date.now() - new Date(l.last_contact_date).getTime()) / 86400000);
                        return (
                          <>
                            <p className="text-sm font-bold tabular-nums" style={{ color: days >= 7 ? KK.red : days >= 3 ? '#d97706' : '#475569' }}>
                              {days === 0 ? 'วันนี้' : `${days} วัน`}
                            </p>
                            <p className="text-[10px] text-gray-400">ติดต่อล่าสุด</p>
                          </>
                        );
                      })() : (
                        <>
                          <p className="text-sm font-bold tabular-nums" style={{ color: KK.red }}>ยังไม่ได้ติดต่อ</p>
                          <p className="text-[10px] text-gray-400">รีบโทร</p>
                        </>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: KK.orangeLight }}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" style={{ color: KK.orange }} />
                <h3 className="text-base font-bold text-gray-900">Silent Leads</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: KK.orange, backgroundColor: KK.orangeLight }}>
                {silentList.length} เสี่ยงหลุด
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">ไม่ติดต่อมากกว่า 7 วัน · เรียงเก่าสุด · กดเพื่อเปิด lead</p>
            {silentList.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดเงียบ — ทีมขายทำดีมาก</div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                {silentList.map((l) => {
                  const sev = l.daysCount >= 30 ? KK.red : l.daysCount >= 14 ? KK.orange : KK.amber;
                  return (
                    <button
                      key={l.id}
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 border border-gray-50 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: KK.orangeLight }}>
                          <PhoneOff className="w-4 h-4" style={{ color: sev }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{l.customer?.full_name || 'ไม่ระบุชื่อ'}</p>
                          <p className="text-[11px] text-gray-500 truncate">
                            {STATUS_LABEL[l.status || 'new']} · {l.propName || sourceShort(l.source)}
                            {l.assignedName ? ` · ${l.assignedName}` : ''}
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

        {/* Row 4: Hot Listings */}
        <div className={`bg-white border border-gray-100 rounded-2xl shadow-soft p-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4" style={{ color: KK.red }} />
            <h3 className="text-base font-bold text-gray-900">Hot Listings</h3>
          </div>
          <p className="text-xs text-gray-500 mb-5">ยูนิตที่มี traffic + ความสนใจสูงสุด · top 6</p>
          {hotListings.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">ยังไม่มียูนิตที่มีคนสนใจ</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {hotListings.map((u, i) => {
                const statusBadge =
                  u.status === 'sold'     ? { label: 'ขายแล้ว', color: KK.red, bg: KK.redLight } :
                  u.status === 'reserved' ? { label: 'จองอยู่',  color: KK.amber, bg: KK.amberLight } :
                                            { label: 'พร้อมขาย', color: KK.green, bg: KK.greenLight };
                return (
                  <button
                    key={u.unitId}
                    onClick={() => navigate(`/units/${u.unitId}`)}
                    className="text-left bg-gray-50 hover:bg-gray-100 rounded-xl overflow-hidden transition-colors group"
                  >
                    <div className="aspect-[4/3] relative overflow-hidden bg-gray-200">
                      {u.thumbnail ? (
                        <img src={u.thumbnail} alt={u.unitNumber} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">no image</div>
                      )}
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                        {statusBadge.label}
                      </div>
                      <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: KK.red, color: 'white' }}>
                        #{i + 1}
                      </div>
                    </div>
                    <div className="p-2.5">
                      <p className="text-xs font-bold text-gray-900 truncate">{u.unitNumber}</p>
                      <p className="text-[11px] text-gray-500 truncate">{u.propName}</p>
                      {/* Two-row funnel readout. Top: anonymous browse traffic (property_views).
                          Bottom: committed interest (lead_interests). Tells the funnel story
                          "X people looked · Y of them became leads." Either row is hidden when
                          the underlying count is 0 to avoid noisy 0s on fresh units. */}
                      <div className="mt-1 space-y-0.5">
                        {u.views > 0 && (
                          <p className="text-[11px] tabular-nums text-gray-600 flex items-center gap-1">
                            <Eye className="w-3 h-3" style={{ color: KK.indigo }} />
                            <span>{u.views} ดู · {u.uniqueVisitors} คน</span>
                          </p>
                        )}
                        {u.uniqueLeads > 0 && (
                          <p className="text-[11px] tabular-nums" style={{ color: KK.red }}>
                            {u.uniqueLeads} Lead สนใจ
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </SubscriptionGuard>
  );
};

export default Analytics;
