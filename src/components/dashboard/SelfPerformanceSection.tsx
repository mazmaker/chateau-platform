import { useEffect, useState, useMemo } from 'react';
import {
  Trophy, TrendingUp, TrendingDown, Minus, Clock, Award,
  AlertTriangle, Sparkles, Loader2, Target,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Self-Performance scorecard. Used in two places:
//   1. /my-dashboard         — shows the logged-in user's own stats
//   2. /team/:userId/...     — Admin drill-down to a specific staff member
//
// Single component drives both — the only prop difference is which user we
// pull data for. All computations happen client-side from the leads + users
// tables that this component fetches scoped to one tenant.
//
// Why not pre-aggregate in SQL: the data volumes are small (hundreds of leads
// per tenant), the comparisons we need are dynamic (this month vs last month,
// vs team average), and shipping a single materialized view would be premature
// optimization for the demo.

interface Props {
  userId: string;
  tenantId: string;
  showName?: boolean;
}


interface LeadLite {
  id: string;
  status: string | null;
  assigned_to: string | null;
  source: string | null;
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

const FUNNEL_STAGES = [
  { key: 'new', label: 'ใหม่' },
  { key: 'contacted', label: 'ติดต่อแล้ว' },
  { key: 'qualified', label: 'มีคุณสมบัติ' },
  { key: 'negotiating', label: 'เจรจา' },
  { key: 'won', label: 'ปิดดีล' },
] as const;

// Theme colors aligned with docs/design-system.html — brand chateau red is the
// primary, green/red used only for status signals (positive/negative deltas).
// Indigo/purple was removed because it isn't part of the brand palette.
const C = {
  chateau: '#e60023', // brand red — used for funnel bars / primary visualizations
  red:     '#ef4444', // negative-delta signal
  amber:   '#d97706',
  green:   '#16a34a', // win signal (final funnel stage, positive deltas)
  gray:    '#94a3b8',
};

const formatTHB = (n: number) =>
  n >= 1_000_000
    ? `฿${(n / 1_000_000).toFixed(n >= 10_000_000 ? 1 : 2)}M`
    : `฿${n.toLocaleString('th-TH')}`;

// First day of current/previous month — used for MoM comparison windows.
const startOfMonth = (offset = 0) => {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfMonth = (offset = 0) => {
  const d = startOfMonth(offset + 1);
  d.setMilliseconds(-1);
  return d;
};

export default function SelfPerformanceSection({ userId, tenantId, showName = false }: Props) {
  const [leads, setLeads] = useState<LeadLite[]>([]);
  const [allSalesUsers, setAllSalesUsers] = useState<UserLite[]>([]);
  const [thisUser, setThisUser] = useState<UserLite | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!userId || !tenantId) return;
    const load = async () => {
      setLoading(true);
      try {
        const [leadsRes, usersRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, status, assigned_to, source, estimated_value, created_at, updated_at')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('users') as any)
            .select('id, full_name, email, role')
            .eq('tenant_id', tenantId)
            .in('role', ['sales', 'agent']),
        ]);
        setLeads((leadsRes.data || []) as LeadLite[]);
        const users = (usersRes.data || []) as UserLite[];
        setAllSalesUsers(users);
        setThisUser(users.find(u => u.id === userId) || null);
      } catch (e) {
        console.error('SelfPerformance load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userId, tenantId]);

  // ─── Computed metrics ─────────────────────────────────────
  const metrics = useMemo(() => {
    if (leads.length === 0) {
      return null;
    }

    const tStart = startOfMonth(0);
    const lmStart = startOfMonth(-1);
    const lmEnd = endOfMonth(-1);

    const myLeads = leads.filter(l => l.assigned_to === userId);

    // Won this month (we use updated_at as the close-time proxy since the schema
    // doesn't yet carry an immutable won_at; this is "good enough" for demo but
    // would be replaced by leads.won_at in a follow-up migration).
    const myWonThisMonth = myLeads.filter(l =>
      l.status === 'won' && new Date(l.updated_at) >= tStart
    );
    const myWonLastMonth = myLeads.filter(l =>
      l.status === 'won' &&
      new Date(l.updated_at) >= lmStart &&
      new Date(l.updated_at) <= lmEnd
    );

    const wonValue = myWonThisMonth.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    const wonValueLastMonth = myWonLastMonth.reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    const wonValueMoM = wonValueLastMonth > 0
      ? Math.round(((wonValue - wonValueLastMonth) / wonValueLastMonth) * 100)
      : null;

    // Conversion rate — won / (all leads assigned in this period)
    const myActiveLeads = myLeads.filter(l =>
      new Date(l.created_at) >= tStart || (l.status && !['won', 'lost'].includes(l.status))
    );
    const myConvRate = myActiveLeads.length > 0
      ? Math.round((myWonThisMonth.length / myActiveLeads.length) * 1000) / 10
      : 0;

    // Team avg conversion this month (for benchmarking)
    const teamWon = leads.filter(l => l.status === 'won' && new Date(l.updated_at) >= tStart);
    const teamConvRate = leads.length > 0
      ? Math.round((teamWon.length / leads.length) * 1000) / 10
      : 0;

    // Pipeline Value — sum of estimated_value across active (still-being-worked) leads
    // for THIS user. Excludes won/lost/dropped because those have left the pipeline.
    // This is the "money I'm currently chasing" number — sales reps and managers care
    // about it because a high pipeline = healthy near-term forecast, low pipeline = need
    // more lead-gen now.
    const activeStatuses = new Set(['new', 'contacted', 'qualified', 'negotiating', 'reserved']);
    const myPipelineValue = myLeads
      .filter(l => l.status && activeStatuses.has(l.status))
      .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    const teamPipelineValue = leads
      .filter(l => l.status && activeStatuses.has(l.status))
      .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);

    // Avg time-to-close (days) — for the user's won deals this month
    const myAvgDays = myWonThisMonth.length > 0
      ? Math.round(
          myWonThisMonth.reduce((s, l) => {
            const days = (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000;
            return s + days;
          }, 0) / myWonThisMonth.length
        )
      : null;
    // Team avg time-to-close for benchmarking
    const teamWonAll = leads.filter(l => l.status === 'won');
    const teamAvgDays = teamWonAll.length > 0
      ? Math.round(
          teamWonAll.reduce((s, l) => {
            const days = (new Date(l.updated_at).getTime() - new Date(l.created_at).getTime()) / 86400000;
            return s + days;
          }, 0) / teamWonAll.length
        )
      : null;

    // Rank — order team members by won value this month (desc); find me.
    const valByUser = new Map<string, number>();
    for (const l of leads) {
      if (l.status !== 'won' || new Date(l.updated_at) < tStart) continue;
      if (!l.assigned_to) continue;
      valByUser.set(l.assigned_to, (valByUser.get(l.assigned_to) || 0) + (Number(l.estimated_value) || 0));
    }
    const ranked = Array.from(valByUser.entries()).sort((a, b) => b[1] - a[1]);
    const myRank = ranked.findIndex(([uid]) => uid === userId) + 1; // 0 = not in list
    const totalRanked = allSalesUsers.length;

    // Funnel — counts at each stage for THIS month's leads
    // (uses lead.status; "lost" + "dropped" are excluded — they're dead-ends, not funnel stages)
    const stageCounts: Record<string, number> = {};
    for (const s of FUNNEL_STAGES) stageCounts[s.key] = 0;
    for (const l of myActiveLeads) {
      if (l.status && stageCounts[l.status] !== undefined) stageCounts[l.status]++;
    }
    // For each stage, count how many leads have CROSSED that stage (i.e., are at or past it).
    // This makes the funnel readout cumulative — the way Sansiri/AP show it.
    const stageReached: Record<string, number> = {};
    const stageOrder: string[] = FUNNEL_STAGES.map(s => s.key);
    for (let i = 0; i < stageOrder.length; i++) {
      let reached = 0;
      for (const l of myActiveLeads) {
        if (!l.status) continue;
        const idx = stageOrder.indexOf(l.status);
        if (idx >= i) reached++;
      }
      stageReached[stageOrder[i]] = reached;
    }
    // Pass-rate between consecutive stages — flags the biggest leak
    const stagePassRate: Record<string, number | null> = {};
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const cur = stageReached[stageOrder[i]];
      const next = stageReached[stageOrder[i + 1]];
      stagePassRate[stageOrder[i]] = cur > 0 ? Math.round((next / cur) * 100) : null;
    }

    // Team avg pass-rate per stage (for "leak vs team")
    const teamStageReached: Record<string, number> = {};
    for (let i = 0; i < stageOrder.length; i++) {
      let reached = 0;
      for (const l of leads) {
        if (!l.status) continue;
        const idx = stageOrder.indexOf(l.status);
        if (idx >= i) reached++;
      }
      teamStageReached[stageOrder[i]] = reached;
    }
    const teamPassRate: Record<string, number | null> = {};
    for (let i = 0; i < stageOrder.length - 1; i++) {
      const cur = teamStageReached[stageOrder[i]];
      const next = teamStageReached[stageOrder[i + 1]];
      teamPassRate[stageOrder[i]] = cur > 0 ? Math.round((next / cur) * 100) : null;
    }

    // Best source by revenue (not volume — revenue is what matters for performance)
    const revBySource = new Map<string, number>();
    for (const l of myWonThisMonth) {
      const src = (l.source || 'unknown').split('_')[0]; // collapse "online_facebook" -> "online"? actually keep as-is
      revBySource.set(l.source || 'ไม่ระบุ', (revBySource.get(l.source || 'ไม่ระบุ') || 0) + (Number(l.estimated_value) || 0));
    }
    const sourceRanked = Array.from(revBySource.entries()).sort((a, b) => b[1] - a[1]);
    const topSource = sourceRanked[0] || null;

    return {
      wonCount: myWonThisMonth.length,
      wonValue,
      wonValueMoM,
      wonCountMoM: myWonLastMonth.length,
      convRate: myConvRate,
      teamConvRate,
      avgDays: myAvgDays,
      teamAvgDays,
      myRank,
      totalRanked,
      pipelineValue: myPipelineValue,
      teamPipelineValue,
      stageReached,
      stagePassRate,
      teamPassRate,
      topSource,
      activeLeadCount: myActiveLeads.length,
      lostCount: myLeads.filter(l => l.status === 'lost').length,
    };
  }, [leads, allSalesUsers, userId]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
      </div>
    );
  }
  if (!metrics) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 text-center text-sm text-gray-400">
        ยังไม่มีข้อมูลสำหรับวิเคราะห์ผลงาน
      </div>
    );
  }

  // Identify the worst stage drop (vs team) for the "leak detection" annotation
  let leakStage: string | null = null;
  let leakDelta = 0;
  for (const s of FUNNEL_STAGES.slice(0, -1)) {
    const my = metrics.stagePassRate[s.key];
    const team = metrics.teamPassRate[s.key];
    if (my == null || team == null) continue;
    const delta = team - my; // positive = my pass-rate is below team
    if (delta > leakDelta && delta >= 10) {
      leakDelta = delta;
      leakStage = s.label;
    }
  }

  const monthLabel = new Date().toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-500" />
            {showName && thisUser ? `สรุปผลงาน — ${thisUser.full_name || thisUser.email}` : 'สรุปผลงาน'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{monthLabel}</p>
        </div>
      </div>

      {/* KPI Cards — 4 base + optional Rank (only shown when team > 2).
          Column count tracks the card count so we never leave an orphan on its own row:
          4 cards → single row of 4; 5 cards → 3+2. (2 cols on mobile throughout.) */}
      <div className={`grid grid-cols-2 ${metrics.totalRanked > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-3`}>
        <KpiCard
          label="ปิดดีลเดือนนี้"
          value={`${metrics.wonCount} ดีล`}
          sub={formatTHB(metrics.wonValue)}
          delta={metrics.wonValueMoM}
          deltaLabel="vs เดือนก่อน"
          icon={Award}
          tone="green"
        />
        {/* Pipeline Value — money currently being chased; healthy near-term forecast */}
        <KpiCard
          label="Pipeline (ดีลที่ตามอยู่)"
          value={formatTHB(metrics.pipelineValue)}
          sub={`ทีมรวม ${formatTHB(metrics.teamPipelineValue)}`}
          icon={TrendingUp}
          tone="indigo"
        />
        <KpiCard
          label="Conversion Rate (อัตราการปิดดีล)"
          value={`${metrics.convRate}%`}
          delta={metrics.convRate - metrics.teamConvRate}
          deltaUnit="%"
          deltaLabel={`ทีม ${metrics.teamConvRate}%`}
          icon={Target}
          tone="blue"
        />
        <KpiCard
          label="ปิดดีลเฉลี่ย"
          value={metrics.avgDays != null ? `${metrics.avgDays} วัน` : '—'}
          // delta = me - team with invertDelta — see comment on metric formula above.
          delta={metrics.avgDays != null && metrics.teamAvgDays != null ? metrics.avgDays - metrics.teamAvgDays : null}
          deltaUnit=" วัน"
          deltaLabel={metrics.teamAvgDays != null ? `ทีม ${metrics.teamAvgDays} วัน` : ''}
          icon={Clock}
          tone="indigo"
          invertDelta
        />
        {/* Rank — smart hide for tiny teams. "#1 จาก 2 คน" is pseudo-meaningful;
            below 3 sales members the leaderboard concept doesn't carry signal. */}
        {metrics.totalRanked > 2 && (
          <KpiCard
            label="อันดับในทีม"
            value={metrics.myRank > 0 ? `#${metrics.myRank}` : '—'}
            sub={metrics.totalRanked > 0 ? `จาก ${metrics.totalRanked} คน` : ''}
            icon={Trophy}
            tone="amber"
          />
        )}
      </div>

      {/* Funnel */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-chateau" />
            Sales Funnel · {metrics.activeLeadCount} leads
          </h3>
          {leakStage && (
            <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              คอขวดที่ "{leakStage}" — drop เยอะกว่าทีม
            </span>
          )}
        </div>
        <div className="space-y-1.5">
          {FUNNEL_STAGES.map((s, i) => {
            const reached = metrics.stageReached[s.key];
            const top = metrics.stageReached[FUNNEL_STAGES[0].key];
            const widthPct = top > 0 ? Math.max(8, (reached / top) * 100) : 0;
            const passToNext = metrics.stagePassRate[s.key];
            const teamPass = metrics.teamPassRate[s.key];
            const isWeak = passToNext != null && teamPass != null && (teamPass - passToNext) >= 10;
            // Explicit fraction makes the line self-explanatory: a first-time admin reading
            // "4 จาก 7 คน ไปต่อ ติดต่อแล้ว" understands instantly without needing to learn what
            // "57% pass-rate" refers to. The % stays as a secondary label in parentheses.
            const nextStage = i < FUNNEL_STAGES.length - 1 ? FUNNEL_STAGES[i + 1] : null;
            const nextReached = nextStage ? metrics.stageReached[nextStage.key] : 0;
            return (
              <div key={s.key}>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-gray-700 w-20 flex-shrink-0">{s.label}</span>
                  <div className="flex-1 h-7 rounded-md bg-gray-100 overflow-hidden relative">
                    <div
                      className="h-full transition-all"
                      style={{
                        width: `${widthPct}%`,
                        // Final stage (won) is green — success signal.
                        // All prior stages are brand chateau red, fading as the funnel narrows
                        // so the visual hierarchy follows the data (top = most leads = most filled).
                        backgroundColor: i === FUNNEL_STAGES.length - 1 ? C.green : C.chateau,
                        opacity: i === FUNNEL_STAGES.length - 1 ? 1 : (1 - (i * 0.12)),
                      }}
                    />
                    <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-white" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
                      {reached}
                    </span>
                  </div>
                </div>
                {nextStage && (
                  <div className="flex items-center gap-3 pl-20 mt-1 mb-0.5">
                    <div className="text-[11px] tabular-nums" style={{ color: isWeak ? C.red : C.gray }}>
                      ↓ {nextReached} จาก {reached} คน ไปต่อ "{nextStage.label}"
                      {passToNext != null && (
                        <span className="ml-1 opacity-75">({passToNext}%)</span>
                      )}
                      {teamPass != null && (
                        <span className="ml-2 text-gray-400">· ทีมเฉลี่ย {teamPass}%</span>
                      )}
                      {isWeak && <span className="ml-2 font-semibold text-amber-600">leak</span>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {metrics.lostCount > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-gray-400 w-20 flex-shrink-0">เสียดีล</span>
              <div className="flex-1 h-7 rounded-md bg-gray-100 overflow-hidden relative">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(6, (metrics.lostCount / Math.max(metrics.activeLeadCount + metrics.lostCount, 1)) * 100)}%`,
                    backgroundColor: '#d1d5db',
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-gray-400">
                  {metrics.lostCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Best Source */}
      {metrics.topSource && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-chateau" />
            <p className="text-xs font-semibold text-gray-700">ช่องทางที่ปิดดีลให้คุณดีสุด</p>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-base font-bold text-gray-900 capitalize">{metrics.topSource[0]}</p>
            <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatTHB(metrics.topSource[1])}</p>
            <p className="text-[11px] text-gray-500">ในเดือนนี้</p>
          </div>
        </div>
      )}

    </div>
  );
}


interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  deltaUnit?: string;
  deltaLabel?: string;
  icon: React.ElementType;
  tone: 'green' | 'blue' | 'indigo' | 'amber' | 'red';
  /** When true, a NEGATIVE delta is treated as good (used for time-to-close: less days = better). */
  invertDelta?: boolean;
}

function KpiCard({ label, value, sub, delta, deltaUnit = '%', deltaLabel, icon: Icon, tone, invertDelta }: KpiCardProps) {
  // White card body — color is only on the icon chip, matching /analytics + /team
  // KPI card style. Brand chateau red is used for the primary tone (amber stays
  // for "rank" since it pairs with the trophy icon).
  const palette: Record<KpiCardProps['tone'], { iconBg: string; iconColor: string }> = {
    green:  { iconBg: 'bg-green-50',   iconColor: 'text-green-600' },
    blue:   { iconBg: 'bg-blue-50',    iconColor: 'text-blue-600' },
    indigo: { iconBg: 'bg-chateau/10', iconColor: 'text-chateau' },
    amber:  { iconBg: 'bg-amber-50',   iconColor: 'text-amber-600' },
    red:    { iconBg: 'bg-red-50',     iconColor: 'text-red-600' },
  };
  const p = palette[tone];

  const showDelta = typeof delta === 'number' && !isNaN(delta);
  const isPositive = showDelta && delta !== 0 && (invertDelta ? delta < 0 : delta > 0);
  const isNegative = showDelta && delta !== 0 && (invertDelta ? delta > 0 : delta < 0);
  const DeltaIcon = showDelta ? (delta === 0 ? Minus : (isPositive ? TrendingUp : TrendingDown)) : null;
  const deltaColor = !showDelta || delta === 0 ? 'text-gray-500' : (isPositive ? 'text-green-700' : 'text-red-700');

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3.5 shadow-soft">
      <div className="flex items-start justify-between mb-2">
        <p className="text-[11px] font-medium text-gray-600">{label}</p>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${p.iconBg}`}>
          <Icon className={`w-3.5 h-3.5 ${p.iconColor}`} />
        </div>
      </div>
      <p className="text-xl font-bold text-gray-900 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
      {showDelta && DeltaIcon && (
        <div className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${deltaColor}`}>
          <DeltaIcon className="w-3 h-3" />
          <span className="tabular-nums">
            {delta > 0 ? '+' : ''}{Math.abs(delta).toFixed(deltaUnit === '%' ? 1 : 0)}{deltaUnit}
          </span>
          {deltaLabel && <span className="text-gray-500 font-normal ml-1">{deltaLabel}</span>}
        </div>
      )}
      {!showDelta && isNegative === false && deltaLabel && (
        <p className="mt-1.5 text-[11px] text-gray-500">{deltaLabel}</p>
      )}
    </div>
  );
}
