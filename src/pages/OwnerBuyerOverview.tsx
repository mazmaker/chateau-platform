import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import {
  Users,
  UserPlus as UserPlusIcon,
  Percent,
  Banknote,
  PieChart as PieChartIcon,
  Filter,
  Megaphone,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// ภาพรวมผู้ซื้อ (Buyer Overview) — Owner group-overview page (overview-first).
// Sibling of OwnerMarketOverview: summarises the whole buyer / lead-intelligence
// menu group across ALL tenants, then drills into each detail page.
// Read-only / live Owner RLS (no migration). AGGREGATE ONLY — no per-person PII.
//   • KPI strip (ผู้สนใจซื้อ · ลีดทั้งหมด · Conversion · มูลค่าดีล อสังหา)
//   • กลุ่มผู้ซื้อ (top occupation + purpose distribution) → /owner-customers
//   • Funnel สรุป (stage bars + conversion) → /owner-funnel
//   • การตลาด teaser (campaign / reach summary) → /owner-marketing
// Aggregation mirrors OwnerCustomers / OwnerFunnel / OwnerMarketing.
// ──────────────────────────────────────────────────────────────────────────

// Palette + compact-money — identical tokens to OwnerMarketOverview / OwnerDashboard.
const KK = {
  red: '#ef4444', redLight: '#fef2f2', redBorder: '#fecaca',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  purple: '#475569', purpleLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  orange: '#d97706', orangeLight: '#fef3c7',
  amber: '#d97706', amberLight: '#fefce8',
  slate: '#475569', slateLight: '#f1f5f9',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};

// Compact THB — Thai real-estate convention "X ล้าน" / "K" (NOT M/B). Canonical formatter
// copied from OwnerMarketOverview / OwnerDashboard / Index.tsx.
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

// preference enums → Thai (mirrors OwnerCustomers).
const OCC_TH: Record<string, string> = {
  private_company: 'พนักงานบริษัท', government: 'ข้าราชการ', state_enterprise: 'รัฐวิสาหกิจ',
  business_owner: 'เจ้าของธุรกิจ', freelance: 'อาชีพอิสระ', professional: 'วิชาชีพเฉพาะ',
  employee: 'พนักงาน', retired: 'เกษียณ', student: 'นักศึกษา', other: 'อื่น ๆ',
};
const PURPOSE_TH: Record<string, string> = {
  investment: 'ลงทุน', residence: 'อยู่อาศัยเอง', rental: 'ปล่อยเช่า',
  family: 'ซื้อให้ครอบครัว', vacation: 'บ้านพักตากอากาศ', other: 'อื่น ๆ',
};
const DONUT_COLORS = [KK.blue, KK.red, KK.green, KK.amber, KK.slate, '#7c3aed', '#0891b2', '#db2777'];

// Funnel stages (mirrors OwnerFunnel — cumulative; 'lost' excluded).
const STAGE_ORDER = ['new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiating', 'reserved', 'won'];
const STAGE_LABEL: Record<string, string> = {
  new: 'ลีดใหม่', contacted: 'ติดต่อแล้ว', qualified: 'ผ่านคุณสมบัติ',
  viewing_scheduled: 'นัด/ดูโครงการ', negotiating: 'กำลังเจรจา', reserved: 'จองแล้ว', won: 'ปิดการขาย',
};
const FUNNEL_STAGES = ['new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiating', 'won'];

// Marketing teaser — sample data (UI-first; mirrors OwnerMarketing's wChannel/wTopCampaign).
const MK_CHANNEL = [{ name: 'LINE OA', v: 14 }, { name: 'Facebook', v: 9 }, { name: 'Email', v: 6 }, { name: 'SMS', v: 3 }];
const MK_TOP_CAMPAIGN = [
  { name: 'โปรบ้านหลังแรก', reach: 12400 },
  { name: 'ดอกเบี้ยพิเศษ Q2', reach: 9800 },
  { name: 'Open House หัวหิน', reach: 7200 },
];

// AGGREGATE-ONLY rows — NO full_name / per-person PII (overview = ภาพรวม).
interface CustomerRow { tenant_id: string; preferences: any; }
interface LeadRow { tenant_id: string; status: string | null; estimated_value: number | null; }
interface TenantRow { id: string; }

const OwnerBuyerOverview = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Cross-tenant read — Owner RLS permits it. Exclude our own platform tenant.
      const { data: tenants } = await supabase.from('tenants').select('id').eq('is_platform' as any, false);
      const ids = ((tenants || []) as TenantRow[]).map((t) => t.id);
      if (ids.length > 0) {
        // AGGREGATE ONLY — select preferences for distribution, NOT full_name (no PII).
        const [cRes, lRes] = await Promise.all([
          supabase.from('customers').select('tenant_id, preferences').in('tenant_id', ids),
          supabase.from('leads').select('tenant_id, status, estimated_value').in('tenant_id', ids),
        ]);
        setCustomers((cRes.data || []) as CustomerRow[]);
        setLeads((lRes.data || []) as LeadRow[]);
      }
    } catch (e) {
      console.error('OwnerBuyerOverview fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // ── KPIs ───────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalBuyers = customers.length;
    const totalLeads = leads.length;
    const won = leads.filter((l) => l.status === 'won').length;
    const conversion = totalLeads ? Math.round((won / totalLeads) * 100) : 0;
    const pipeline = leads
      .filter((l) => l.status !== 'won' && l.status !== 'lost')
      .reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    return { totalBuyers, totalLeads, conversion, pipeline };
  }, [customers, leads]);

  // ── Demographic distributions (top occupations + purpose) — aggregate ────
  const occData = useMemo(() => {
    const m = new Map<string, number>();
    customers.forEach((c) => {
      const occ = (c.preferences || {}).occupation || 'other';
      m.set(occ, (m.get(occ) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: OCC_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customers]);

  const purposeData = useMemo(() => {
    const m = new Map<string, number>();
    customers.forEach((c) => {
      const p = (c.preferences || {}).purchase_purpose;
      if (p && p !== 'other') m.set(p, (m.get(p) || 0) + 1);
    });
    return Array.from(m.entries())
      .map(([k, v], i) => ({ name: PURPOSE_TH[k] || k, value: v, color: DONUT_COLORS[i % DONUT_COLORS.length] }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [customers]);

  // ── Funnel summary (cumulative stage counts) — mirrors OwnerFunnel ────────
  const funnel = useMemo(() => {
    const idxOf = (s: string | null) => { const i = STAGE_ORDER.indexOf(s || ''); return i < 0 ? 0 : i; };
    const active = leads.filter((l) => l.status !== 'lost');
    return FUNNEL_STAGES.map((stage) => {
      const si = STAGE_ORDER.indexOf(stage);
      const count = active.filter((l) => idxOf(l.status) >= si).length;
      return { stage, label: STAGE_LABEL[stage] || stage, count };
    });
  }, [leads]);

  // ── Marketing teaser (sample data) ────────────────────────────────────────
  const marketing = useMemo(() => {
    const totalCampaigns = MK_CHANNEL.reduce((s, c) => s + c.v, 0);
    const totalReach = MK_TOP_CAMPAIGN.reduce((s, c) => s + c.reach, 0);
    const reachMax = Math.max(...MK_TOP_CAMPAIGN.map((c) => c.reach), 1);
    return { totalCampaigns, totalReach, reachMax };
  }, []);

  // Compact KPI card — same shape as OwnerMarketOverview.renderKpiCard.
  const renderKpiCard = (k: any, i: number) => (
    <div key={i} onClick={() => navigate(k.href)} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5 pr-1 flex-1">{k.label}</p>
        <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} strokeWidth={2} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">{k.value}</p>
      {k.sub ? <p className="text-sm text-gray-400 mt-3.5 leading-snug line-clamp-2">{k.sub}</p> : null}
    </div>
  );

  // Compact donut block — mirrors OwnerCustomers.Donut (legend max 6).
  const renderDonut = (data: { name: string; value: number; color: string }[]) => {
    const sum = data.reduce((s, x) => s + x.value, 0) || 1;
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="h-[190px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="white" strokeWidth={2}>
                {data.map((d, i) => <Cell key={i} fill={d.color} />)}
              </Pie>
              <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} คน`, n]) as any} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="space-y-1.5">
          {data.map((d, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-gray-600 flex-1 truncate">{d.name}</span>
              <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
              <span className="text-gray-400 tabular-nums w-9 text-right">{Math.round((d.value / sum) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <OwnerGuard>
        <div className="min-h-screen bg-gray-50">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="lg:ml-[260px] min-h-screen">
            <Header onMenuClick={() => setSidebarOpen(true)} />
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          </div>
        </div>
      </OwnerGuard>
    );
  }

  const funnelMax = funnel[0]?.count || 1;

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-6">
            {/* PAGE TITLE */}
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-2 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Analytics</span>
              <h1 className="text-2xl font-bold text-gray-900">ภาพรวมผู้ซื้อ</h1>
              <p className="text-sm text-gray-500 mt-1.5">ภาพรวมฐานผู้ซื้อ ช่องทาง และการแปลงผู้สนใจ ข้ามทุกบริษัท — กดดูรายละเอียด</p>
            </div>

            {/* KPI strip — 4 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'ผู้สนใจซื้อทั้งหมด', value: kpis.totalBuyers.toLocaleString(), icon: Users, color: KK.blue, href: '/owner-customers', sub: 'ข้ามทุกบริษัท (CDP)' },
                { label: 'ผู้สนใจ (ลีดทั้งหมด)', value: kpis.totalLeads.toLocaleString(), icon: UserPlusIcon, color: KK.green, href: '/owner-funnel', sub: 'สะสมทุกขั้นของกรวย' },
                { label: 'อัตราแปลง (Conversion)', value: `${kpis.conversion}%`, icon: Percent, color: KK.red, href: '/owner-funnel', sub: 'ปิดได้ / ลีดทั้งหมด' },
                { label: 'มูลค่าดีล (อสังหา)', value: fmtCompact(kpis.pipeline), icon: Banknote, color: KK.amber, href: '/owner-funnel', sub: 'ลีดที่ยังเปิดอยู่' },
              ].map(renderKpiCard)}
            </div>

            {/* Demographic summary (occupation + purpose donuts) */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
                  <div>
                    <h2 className="text-base font-bold text-gray-900">กลุ่มผู้ซื้อ</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Top segments · อาชีพและวัตถุประสงค์การซื้อ</p>
                  </div>
                </div>
                <button onClick={() => navigate('/owner-customers')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                  ดูฐานข้อมูลผู้ซื้อ <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              {customers.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลผู้ซื้อ</p>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">อาชีพผู้ซื้อ</h3>
                    {occData.length === 0 ? (
                      <p className="text-sm text-gray-400 py-12 text-center">ยังไม่มีข้อมูล</p>
                    ) : renderDonut(occData)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-1">วัตถุประสงค์การซื้อ</h3>
                    {purposeData.length === 0 ? (
                      <p className="text-sm text-gray-400 py-12 text-center">ยังไม่มีข้อมูล</p>
                    ) : renderDonut(purposeData)}
                  </div>
                </div>
              )}
            </div>

            {/* Funnel summary (left) + Marketing teaser (right) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Funnel summary */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">กรวยการขาย (Funnel)</h2>
                      <p className="text-xs text-gray-500 mt-0.5">จำนวนลีดแต่ละขั้น · % เทียบลีดใหม่</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-funnel')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดู Funnel <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {leads.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลลีด</p>
                ) : (
                  <div className="space-y-3">
                    {funnel.map((s, i) => {
                      const pct = funnelMax ? Math.round((s.count / funnelMax) * 100) : 0;
                      return (
                        <div key={s.stage}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-gray-700 font-medium">{i + 1}. {s.label}</span>
                            <span className="tabular-nums text-gray-500">{s.count.toLocaleString()} <span className="text-gray-400">· {pct}%</span></span>
                          </div>
                          <div className="h-6 rounded-lg bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-lg transition-all duration-700"
                              style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${KK.red} 0%, #f87171 100%)` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Marketing teaser */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 flex-shrink-0" style={{ color: KK.amber }} />
                    <div>
                      <h2 className="text-base font-bold text-gray-900">การตลาด</h2>
                      <p className="text-xs text-gray-500 mt-0.5">แคมเปญและการเข้าถึง · ทุกบริษัท</p>
                    </div>
                  </div>
                  <button onClick={() => navigate('/owner-marketing')} className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={{ color: KK.red }}>
                    ดู Marketing <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: KK.red }}>{marketing.totalCampaigns.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1.5">แคมเปญทั้งหมด</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-bold tabular-nums leading-none" style={{ color: KK.blue }}>{(marketing.totalReach / 1000).toFixed(1)}K</p>
                    <p className="text-xs text-gray-500 mt-1.5">เข้าถึง (Reach)</p>
                  </div>
                </div>
                {/* Top campaigns by reach */}
                <p className="text-sm font-semibold text-gray-700 mb-2">แคมเปญเข้าถึงมากสุด</p>
                <div className="space-y-3">
                  {MK_TOP_CAMPAIGN.map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium truncate pr-2">{c.name}</span>
                        <span className="tabular-nums text-gray-500 flex-shrink-0">{c.reach.toLocaleString()} reach</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.max((c.reach / marketing.reachMax) * 100, 3)}%`, background: `linear-gradient(90deg, ${KK.amber} 0%, #fbbf24 100%)` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-4">ข้อมูลตัวอย่างเพื่อสาธิต · เชื่อมต่อแคมเปญจริงภายหลัง</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerBuyerOverview;
