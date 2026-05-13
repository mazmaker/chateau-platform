import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
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
  Flame,
  AlertTriangle,
  Users,
  Briefcase,
  Trophy,
} from 'lucide-react';

const KK = {
  red: '#e60023', redLight: '#fff1f2',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
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

const STATUS_ORDER = ['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost'] as const;
const STATUS_LABEL: Record<string, string> = {
  new: 'ลีดใหม่',
  contacted: 'ติดต่อแล้ว',
  qualified: 'คัดกรองแล้ว',
  negotiating: 'กำลังเจรจา',
  won: 'ปิดดีลสำเร็จ',
  lost: 'เสียดีล',
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
  online_facebook: 'Facebook',
  online_google: 'Google',
  online_line: 'LINE',
  agent_referral: 'นายหน้าแนะนำ',
  offline: 'Walk-in / Offline',
};

const sourceShort = (raw: string | null) => {
  if (!raw) return 'ไม่ระบุ';
  if (SOURCE_LABEL[raw]) return SOURCE_LABEL[raw];
  if (raw.startsWith('other_')) return raw.replace('other_other:', 'อื่นๆ:').replace('other_', '');
  return raw;
};

const formatTHB = (n: number) => {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
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
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const load = async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    try {
      setLoading(true);
      const tid = currentTenant.id;
      const [leadsRes, actsRes, intRes, unitsRes, propsRes, usersRes] = await Promise.all([
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
      ]);
      setLeads((leadsRes.data || []) as LeadRow[]);
      setActivities((actsRes.data || []) as ActivityRow[]);
      setInterests((intRes.data || []) as InterestRow[]);
      setUnits((unitsRes.data || []) as UnitRow[]);
      setProperties((propsRes.data || []) as PropertyRow[]);
      setUsers((usersRes.data || []) as UserRow[]);
    } catch (e) {
      console.error('Analytics load failed:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [currentTenant?.id]);

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
  const conversionRate = totalClosed > 0 ? (totalWon / totalClosed) * 100 : 0;

  // ─── Funnel ──
  const funnelCounts: Record<string, number> = {};
  STATUS_ORDER.forEach((s) => { funnelCounts[s] = 0; });
  leads.forEach((l) => {
    const s = l.status || 'new';
    if (s in funnelCounts) funnelCounts[s]++;
  });
  const funnelData = STATUS_ORDER.map((s) => ({
    stage: STATUS_LABEL[s],
    key: s,
    count: funnelCounts[s] || 0,
    color: STATUS_COLOR[s],
    textColor: STATUS_COLOR_TEXT[s],
  }));
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
  const hotLeads = leads
    .filter((l) => {
      if (l.status === 'won' || l.status === 'lost') return false;
      const high = l.urgency_level === 'high' || l.priority === 'high';
      const score = (l.potential_score || 0) >= 70;
      return high || score;
    })
    .map((l) => ({
      ...l,
      assignedName: l.assigned_to ? userById.get(l.assigned_to)?.full_name || null : null,
      propName: l.property_id ? propById.get(l.property_id)?.name || null : null,
      unitNumber: l.unit_id ? unitById.get(l.unit_id)?.unit_number || null : null,
    }))
    .sort((a, b) => (b.potential_score || 0) - (a.potential_score || 0))
    .slice(0, 8);

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
    .sort((a, b) => b.daysCount - a.daysCount)
    .slice(0, 8);

  // ─── Hot Listings ──
  const unitInquiryMap = new Map<string, { count: number; leadIds: Set<string> }>();
  interests.forEach((i) => {
    if (!i.unit_id) return;
    const existing = unitInquiryMap.get(i.unit_id) || { count: 0, leadIds: new Set<string>() };
    existing.count++;
    if (i.lead_id) existing.leadIds.add(i.lead_id);
    unitInquiryMap.set(i.unit_id, existing);
  });
  const hotListings = Array.from(unitInquiryMap.entries())
    .map(([unitId, { count, leadIds }]) => {
      const unit = unitById.get(unitId);
      if (!unit) return null;
      return {
        unitId,
        unitNumber: unit.unit_number,
        thumbnail: unit.thumbnail_url,
        status: unit.status,
        propName: propById.get(unit.project_id)?.name || '(ไม่ระบุโครงการ)',
        inquiries: count,
        uniqueLeads: leadIds.size,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.inquiries - a.inquiries)
    .slice(0, 6);

  // ─── Sales Leaderboard ──
  const openStatuses = new Set(['new', 'contacted', 'qualified', 'negotiating']);
  const salesPerf = new Map<string, { name: string; deals: number; value: number; openLeads: number }>();
  leads.forEach((l) => {
    if (!l.assigned_to) return;
    const u = userById.get(l.assigned_to);
    const name = u?.full_name || u?.email || 'ไม่ทราบ';
    const existing = salesPerf.get(l.assigned_to) || { name, deals: 0, value: 0, openLeads: 0 };
    if (l.status === 'won') {
      existing.deals++;
      existing.value += Number(l.estimated_value || 0);
    }
    if (openStatuses.has(l.status || '')) {
      existing.openLeads++;
    }
    salesPerf.set(l.assigned_to, existing);
  });
  const leaderboard = Array.from(salesPerf.values())
    .filter((s) => s.deals > 0 || s.openLeads > 0)
    .sort((a, b) => b.value - a.value || b.deals - a.deals);

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
      title: 'Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      sub: `ปิดได้ ${totalWon}/${totalClosed} ดีล`,
      icon: Target,
      color: KK.green,
      bg: KK.greenLight,
    },
  ];

  return (
    <SubscriptionGuard feature="analytics" showUpgradePrompt={true}>
      <div className="p-6 lg:p-10 space-y-7">
        {/* Title */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
              Lead Analytics
            </span>
            <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">วิเคราะห์ลีด</h1>
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
        <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
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

        {/* ═══ INSIGHT — ภาพรวมตัวเลข ═══ */}
        <div className={`space-y-2 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">📊 INSIGHT — ภาพรวมตัวเลข</h2>
        </div>

        {/* Row 1: Funnel + Source */}
        <div className={`grid grid-cols-1 xl:grid-cols-3 gap-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-gray-900">Lead Funnel</h3>
                <p className="text-xs text-gray-500 mt-0.5">กรวยปิดดีล · ลีดทั้งหมด {leads.length} คน</p>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 sm:gap-4 h-56 px-2 pt-6">
              {funnelData.map((f, i) => {
                const heightPct = (f.count / maxFunnel) * 100;
                const prev = i > 0 ? funnelData[i - 1].count : 0;
                const drop = prev > 0 && f.count < prev ? ((prev - f.count) / prev) * 100 : 0;
                const totalPct = leads.length > 0 ? (f.count / leads.length) * 100 : 0;
                return (
                  <div key={f.key} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    {/* Count on top */}
                    <div className="flex flex-col items-center mb-1.5">
                      <span className="text-sm font-bold text-gray-900 tabular-nums leading-none">{f.count}</span>
                      <span className="text-[10px] text-gray-600 tabular-nums mt-0.5">{totalPct.toFixed(0)}%</span>
                    </div>
                    {/* Bar */}
                    <div className="w-full max-w-[64px] rounded-t-md transition-all"
                      style={{
                        height: `${Math.max(heightPct, 3)}%`,
                        backgroundColor: '#f87171',
                        minHeight: f.count > 0 ? '6px' : '2px',
                        opacity: f.count > 0 ? 1 : 0.3,
                      }}
                    />
                    {/* Label below */}
                    <div className="mt-2 flex flex-col items-center min-h-[34px]">
                      <span className="text-[11px] font-semibold text-gray-800 text-center leading-tight">{f.stage}</span>
                      {drop > 0 && (
                        <span className="text-[9px] font-semibold text-rose-600 mt-0.5">↓ ตก {drop.toFixed(0)}%</span>
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
                  const tones = [KK.red, KK.blue, KK.purple, KK.green, KK.orange, KK.amber, KK.gray];
                  const color = tones[i % tones.length];
                  return (
                    <div key={s.name}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-xs font-medium text-gray-700">{s.name}</span>
                        <span className="text-xs font-bold tabular-nums" style={{ color }}>{s.value}</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, backgroundColor: color }} />
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
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">🎯 ACTION — ลงมือเลย</h2>
        </div>

        {/* Row 3: Hot Leads + Silent Leads */}
        <div className={`grid grid-cols-1 lg:grid-cols-2 gap-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4" style={{ color: KK.red }} />
                <h3 className="text-base font-bold text-gray-900">ลีดร้อน (Hot Leads)</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                {hotLeads.length} ต้องตามด่วน
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">score ≥ 70 หรือ urgency = high · กดเพื่อเปิด lead</p>
            {hotLeads.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดร้อนตอนนี้ 🎉</div>
            ) : (
              <div className="space-y-2">
                {hotLeads.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => navigate(`/leads?lead=${l.id}`)}
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
                      <p className="text-sm font-bold tabular-nums" style={{ color: KK.red }}>{l.potential_score || 0}</p>
                      <p className="text-[10px] text-gray-400">score</p>
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
                <h3 className="text-base font-bold text-gray-900">ลีดเงียบ ต้องตามด่วน</h3>
              </div>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: KK.orange, backgroundColor: KK.orangeLight }}>
                {silentList.length} เสี่ยงหลุด
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">ไม่ติดต่อมากกว่า 7 วัน · เรียงเก่าสุด · กดเพื่อเปิด lead</p>
            {silentList.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลีดเงียบ — ทีมขายทำดีมาก 🎉</div>
            ) : (
              <div className="space-y-2">
                {silentList.map((l) => {
                  const sev = l.daysCount >= 30 ? KK.red : l.daysCount >= 14 ? KK.orange : KK.amber;
                  return (
                    <button
                      key={l.id}
                      onClick={() => navigate(`/leads?lead=${l.id}`)}
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
          <p className="text-xs text-gray-500 mb-5">ยูนิตที่มีคนสนใจมากสุด · top 6</p>
          {hotListings.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">ยังไม่มี inquiry บนยูนิตใด</div>
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
                      <p className="text-[11px] mt-1 tabular-nums" style={{ color: KK.red }}>
                        🔥 {u.inquiries} inquiries · {u.uniqueLeads} leads
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Row 5: Sales Leaderboard */}
        <div className={`bg-white border border-gray-100 rounded-2xl shadow-soft p-6 ${loading ? 'opacity-30 pointer-events-none' : ''}`}>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4" style={{ color: KK.amber }} />
            <h3 className="text-base font-bold text-gray-900">Sales Leaderboard</h3>
          </div>
          <p className="text-xs text-gray-500 mb-5">ผลงานทีมขาย — ตามมูลค่าดีลที่ปิดได้</p>
          {leaderboard.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">ยังไม่มี sales rep ที่มี deals</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-medium">อันดับ</th>
                    <th className="text-left py-2 px-3 font-medium">Sales Rep</th>
                    <th className="text-right py-2 px-3 font-medium">ดีลปิดได้</th>
                    <th className="text-right py-2 px-3 font-medium">มูลค่ารวม</th>
                    <th className="text-right py-2 px-3 font-medium">Leads ดูแลอยู่</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((s, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-3">
                        {i === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ backgroundColor: KK.amberLight, color: KK.amber }}>
                            🏆
                          </span>
                        ) : (
                          <span className="text-gray-500 font-semibold">#{i + 1}</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium text-gray-900">{s.name}</td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: s.deals > 0 ? KK.green : '#9ca3af' }}>
                        {s.deals}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums font-semibold text-gray-700">
                        {formatTHB(s.value)}
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums text-gray-700">
                        {s.openLeads}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </SubscriptionGuard>
  );
};

export default Analytics;
