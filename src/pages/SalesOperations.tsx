import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Briefcase,
  Flame,
  Megaphone,
  TrendingUp,
  Trophy,
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
  blue:       '#64748b',
  blueLight:  '#f1f5f9',
  gray:       '#94a3b8',
  grayLight:  '#fafafa',
  border:     '#e5e7eb',
};

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

const formatTHB = (n: number) => {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
};

const timeAgo = (iso: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days >= 30) return `${Math.floor(days / 30)} เดือนที่แล้ว`;
  if (days >= 1) return `${days} วันที่แล้ว`;
  const hours = Math.floor(diff / 3600000);
  if (hours >= 1) return `${hours} ชั่วโมงที่แล้ว`;
  const mins = Math.floor(diff / 60000);
  return `${mins} นาทีที่แล้ว`;
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
  created_at: string;
  property_id: string | null;
  unit_id: string | null;
}

interface InterestRow {
  id: string;
  property_id: string | null;
  unit_id: string | null;
  lead_id: string | null;
  status: string | null;
  created_at: string;
}

interface UnitRow {
  id: string;
  unit_number: string;
  property_id: string;
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

const SalesOperations = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole, authChecked } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Redirect Sales/Agent away — this page is Admin/Owner only
  useEffect(() => {
    if (authChecked && userRole && !['owner', 'admin'].includes(userRole)) {
      navigate(userRole === 'sales' || userRole === 'agent' ? '/my-dashboard' : '/', { replace: true });
    }
  }, [authChecked, userRole, navigate]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activeCampaigns, setActiveCampaigns] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tenantId = currentTenant?.id;
        if (!tenantId) {
          setLoading(false);
          return;
        }

        const [leadsRes, interestsRes, unitsRes, propsRes, usersRes, campRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, customer_id, status, priority, source, estimated_value, assigned_to, last_contact_date, created_at, property_id, unit_id, customers(full_name, phone)')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('lead_interests') as any)
            .select('id, property_id, unit_id, lead_id, status, created_at')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('units') as any)
            .select('id, unit_number, project_id, status, thumbnail_url')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('users') as any)
            .select('id, full_name, email, role')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('campaigns') as any)
            .select('id', { count: 'exact', head: true })
            .eq('tenant_id', tenantId)
            .eq('status', 'active'),
        ]);

        setLeads((leadsRes.data || []) as LeadRow[]);
        setInterests((interestsRes.data || []) as InterestRow[]);
        // Map project_id to property_id for consistency in this view
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setUnits(((unitsRes.data || []) as any[]).map((u) => ({ ...u, property_id: u.project_id })) as UnitRow[]);
        setProperties((propsRes.data || []) as PropertyRow[]);
        setUsers((usersRes.data || []) as UserRow[]);
        setActiveCampaigns(campRes.count || 0);
      } catch (e) {
        console.error('Sales Operations load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTenant]);

  // ─── Derived data ─────────────────────────────────────────────
  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Lead Trend (30 days)
  const leadTrend = (() => {
    const days: { date: string; key: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      days.push({ date: label, key, count: 0 });
    }
    leads.forEach((l) => {
      const k = (l.created_at || '').slice(0, 10);
      const d = days.find((x) => x.key === k);
      if (d) d.count++;
    });
    return days.map(({ date, count }) => ({ date, count }));
  })();

  const leadsThisMonth = leads.filter((l) => new Date(l.created_at) >= thirtyDaysAgo).length;

  // Lead Sources
  const sourceMap = new Map<string, number>();
  leads.forEach((l) => {
    const src = (l.source || 'ไม่ระบุ').toLowerCase();
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });
  const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
    facebook:        { label: 'Facebook',     color: '#1877f2' },
    online_facebook: { label: 'Facebook',     color: '#1877f2' },
    google:          { label: 'Google',       color: C.amber },
    online_google:   { label: 'Google',       color: C.amber },
    website:         { label: 'Website',      color: C.charcoal },
    walk_in:         { label: 'Walk-in',      color: C.green },
    walkin:          { label: 'Walk-in',      color: C.green },
    offline:         { label: 'Walk-in',      color: C.green },
    referral:        { label: 'Referral',     color: C.red },
    line:            { label: 'LINE',         color: '#06c755' },
  };
  const totalLeadsCount = leads.length;
  const leadSources = Array.from(sourceMap.entries())
    .map(([key, count]) => ({
      key,
      label: SOURCE_LABELS[key]?.label || key,
      color: SOURCE_LABELS[key]?.color || C.slate,
      count,
      pct: totalLeadsCount > 0 ? (count / totalLeadsCount) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Hot Leads (priority=high + open status)
  const openStatuses = new Set(['new', 'contacted', 'qualified', 'negotiating']);

  const statusLabel = (s?: string | null): string => {
    const map: Record<string, string> = {
      new: 'ใหม่',
      contacted: 'ติดต่อแล้ว',
      qualified: 'มีคุณสมบัติ',
      proposal: 'เสนอราคา',
      negotiating: 'กำลังเจรจา',
      negotiation: 'กำลังเจรจา',
      won: 'ปิดดีลแล้ว',
      closed: 'ปิดดีลแล้ว',
      lost: 'สูญเสีย',
    };
    return s ? (map[s] || s) : '—';
  };
  const userById = new Map(users.map((u) => [u.id, u.full_name || u.email]));
  const propById = new Map(properties.map((p) => [p.id, p.name]));
  const unitById = new Map(units.map((u) => [u.id, u]));
  const hotLeads = leads
    .filter((l) => l.priority === 'high' && openStatuses.has(l.status || ''))
    .map((l) => ({
      ...l,
      assignedName: l.assigned_to ? userById.get(l.assigned_to) || null : null,
      propName: l.property_id ? propById.get(l.property_id) || null : null,
      unitNumber: l.unit_id ? unitById.get(l.unit_id)?.unit_number || null : null,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  // Inactive Leads (>30 days no contact, still open)
  const inactiveLeads = leads
    .filter((l) => openStatuses.has(l.status || '') && l.last_contact_date && new Date(l.last_contact_date) < thirtyDaysAgo)
    .map((l) => ({
      ...l,
      assignedName: l.assigned_to ? userById.get(l.assigned_to) || null : null,
      propName: l.property_id ? propById.get(l.property_id) || null : null,
      daysInactive: l.last_contact_date ? Math.floor((Date.now() - new Date(l.last_contact_date).getTime()) / 86400000) : 0,
    }))
    .sort((a, b) => b.daysInactive - a.daysInactive)
    .slice(0, 8);

  // Hot Listings (units with most lead_interests)
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
        propName: propById.get(unit.property_id) || '(ไม่ระบุโครงการ)',
        inquiries: count,
        uniqueLeads: leadIds.size,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.inquiries - a.inquiries)
    .slice(0, 6);

  // Sales Leaderboard
  const salesPerf = new Map<string, { name: string; deals: number; value: number; openLeads: number }>();
  leads.forEach((l) => {
    if (!l.assigned_to) return;
    const name = userById.get(l.assigned_to) || 'ไม่ทราบ';
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 lg:p-10 space-y-7">
          {/* Title */}
          <div>
            <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: C.red, backgroundColor: C.redLight }}>
              Sales Operations
            </span>
            <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">ศูนย์ปฏิบัติการขาย</h1>
            <p className="text-[15px] text-gray-500 mt-1.5">
              Leads · Hot Listings · ทีมขาย · {currentTenant?.name || ''}
            </p>
          </div>

          {loading ? (
            <div className="space-y-7">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {[...Array(3)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-[280px] animate-pulse" />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-[380px] animate-pulse" />)}
              </div>
            </div>
          ) : (
            <>
              {/* Row 1: Lead Acquisition Trend + Sources + Campaigns */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Lead Trend */}
                <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" style={{ color: C.red }} />
                        <h2 className="text-base font-bold text-gray-900">Lead Acquisition Trend</h2>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">30 วันล่าสุด · {leadsThisMonth} leads เข้าใหม่</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                      30 วัน
                    </span>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={leadTrend} margin={{ top: 5, right: 8, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="leadGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%"  stopColor={C.red} stopOpacity={0.3} />
                          <stop offset="100%" stopColor={C.red} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={2} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${Number(v)} leads`, '']} />
                      <Area type="monotone" dataKey="count" stroke={C.red} strokeWidth={2.5} fill="url(#leadGrad)" dot={false} activeDot={{ r: 4, fill: C.red, stroke: '#fff', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Lead Sources */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Megaphone className="w-4 h-4" style={{ color: C.amber }} />
                    <h2 className="text-base font-bold text-gray-900">Lead Sources</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ช่องทาง marketing ที่ทำงาน</p>
                  {leadSources.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มี source data</div>
                  ) : (
                    <div className="space-y-3">
                      {leadSources.map((s) => (
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
                      <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between text-xs">
                        <span className="text-gray-500">💼 Active campaigns</span>
                        <span className="font-semibold tabular-nums">{activeCampaigns}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Row 2: Hot Leads + Inactive Leads */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Hot Leads */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4" style={{ color: C.red }} />
                      <h2 className="text-base font-bold text-gray-900">ลูกค้าด่วน</h2>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.red, backgroundColor: C.redLight }}>
                      {hotLeads.length} ต้องตามด่วน
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ความสำคัญสูง · ยังไม่ปิดดีล</p>
                  {hotLeads.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ยังไม่มีลูกค้าด่วน</div>
                  ) : (
                    <div className="space-y-2.5">
                      {hotLeads.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => navigate(`/leads/${l.id}`)}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.customers?.full_name || '(ไม่ระบุชื่อ)'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {l.propName || '—'}
                              {l.unitNumber && ` · ${l.unitNumber}`}
                              {l.assignedName && ` · ดูแลโดย ${l.assignedName}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold tabular-nums" style={{ color: C.red }}>
                              {statusLabel(l.status)}
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(l.created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inactive Leads */}
                <div className="bg-white border rounded-2xl shadow-soft p-6" style={{ borderColor: C.amberLight }}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" style={{ color: C.amber }} />
                      <h2 className="text-base font-bold text-gray-900">ลูกค้าที่เงียบหาย</h2>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: C.amber, backgroundColor: C.amberLight }}>
                      {inactiveLeads.length} เสี่ยงหลุด
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ไม่ติดต่อเกิน 30 วัน · ยังไม่ปิดดีล</p>
                  {inactiveLeads.length === 0 ? (
                    <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">ไม่มีลูกค้าที่เงียบนาน 🎉</div>
                  ) : (
                    <div className="space-y-2.5">
                      {inactiveLeads.map((l) => (
                        <button
                          key={l.id}
                          onClick={() => navigate(`/leads/${l.id}`)}
                          className="w-full flex items-start justify-between gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{l.customers?.full_name || '(ไม่ระบุชื่อ)'}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {l.propName || '—'}
                              {l.assignedName && ` · ${l.assignedName}`}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-xs font-semibold tabular-nums" style={{ color: l.daysInactive >= 60 ? C.red : C.amber }}>
                              {l.daysInactive} วัน
                            </span>
                            <p className="text-[11px] text-gray-400 mt-0.5">{statusLabel(l.status)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Row 3: Hot Listings */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase className="w-4 h-4" style={{ color: C.red }} />
                  <h2 className="text-base font-bold text-gray-900">Hot Listings</h2>
                </div>
                <p className="text-xs text-gray-500 mb-5">ยูนิตที่มีคนสนใจมากที่สุด · top 6</p>

                {hotListings.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
                    ยังไม่มี lead inquiry บนยูนิตใด
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {hotListings.map((u, i) => {
                      const statusBadge =
                        u.status === 'sold'     ? { label: 'ขายแล้ว', color: C.red, bg: C.redLight } :
                        u.status === 'reserved' ? { label: 'จองอยู่',  color: C.amber, bg: C.amberLight } :
                                                  { label: 'พร้อมขาย', color: C.green, bg: C.greenLight };
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
                            <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ backgroundColor: C.red, color: 'white' }}>
                              #{i + 1}
                            </div>
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs font-bold text-gray-900 truncate">{u.unitNumber}</p>
                            <p className="text-[11px] text-gray-500 truncate">{u.propName}</p>
                            <p className="text-[11px] mt-1 tabular-nums" style={{ color: C.red }}>
                              🔥 {u.inquiries} inquiries · {u.uniqueLeads} leads
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Row 4: Sales Leaderboard */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4" style={{ color: C.amber }} />
                  <h2 className="text-base font-bold text-gray-900">Sales Leaderboard</h2>
                </div>
                <p className="text-xs text-gray-500 mb-5">ผลงานทีมขาย — ตามมูลค่าดีลที่ปิดได้</p>

                {leaderboard.length === 0 ? (
                  <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
                    ยังไม่มี sales rep ที่มี deals
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b border-gray-100">
                          <th className="text-left py-2 px-3 font-medium">อันดับ</th>
                          <th className="text-left py-2 px-3 font-medium">Sales Rep</th>
                          <th className="text-right py-2 px-3 font-medium">ดีลปิดได้</th>
                          <th className="text-right py-2 px-3 font-medium">มูลค่ารวม</th>
                          <th className="text-right py-2 px-3 font-medium">Leads ที่ดูแลอยู่</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.map((s, i) => (
                          <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                            <td className="py-3 px-3">
                              {i === 0 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ backgroundColor: C.amberLight, color: C.amber }}>
                                  🏆
                                </span>
                              ) : (
                                <span className="text-gray-500 font-semibold">#{i + 1}</span>
                              )}
                            </td>
                            <td className="py-3 px-3 font-medium text-gray-900">{s.name}</td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: s.deals > 0 ? C.green : '#9ca3af' }}>
                              {s.deals}
                            </td>
                            <td className="py-3 px-3 text-right tabular-nums font-semibold" style={{ color: C.charcoal }}>
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
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SalesOperations;
