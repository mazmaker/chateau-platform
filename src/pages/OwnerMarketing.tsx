import { useState, useEffect, useMemo } from 'react';
import PeriodFilter, { type PeriodKey, periodToRange, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Megaphone, Send, Target, Percent } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { ResponsiveContainer } from '@/components/charts/SmoothResponsiveContainer';

// ──────────────────────────────────────────────────────────────────────────
// Marketing & Campaign Overview — the real "Marketing" (เฮีย: ส่งมอบคุณค่า,
// ไม่ใช่ยอดขาย). Which campaign TYPE reaches most, which segment responds best.
// Data: REAL `campaigns` across all customer tenants (Owner RLS) — campaign_type,
// recipients/impressions/clicks, segments[]. Period filter scopes by start_date.
// No fake channels (schema has no channel) — campaign_type is the real dimension.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};
const TYPE_COLORS = [KK.green, KK.blue, KK.amber, KK.red, KK.gray, '#7c3aed', '#0891b2'];

// campaign_type / segment enums → Thai (fall back to raw value if unmapped).
const TYPE_TH: Record<string, string> = {
  newsletter: 'จดหมายข่าว', event: 'อีเวนต์', open_house: 'เปิดบ้าน/ดูโครงการ',
  sales: 'โปรโมชัน', launch: 'เปิดโครงการใหม่', construction_update: 'อัปเดตก่อสร้าง', news: 'ข่าวสาร',
};
const SEG_TH: Record<string, string> = {
  family: 'ครอบครัว', first_home: 'บ้านหลังแรก', income_high: 'รายได้สูง', income_medium: 'รายได้ปานกลาง',
  income_low: 'รายได้น้อย', investment: 'นักลงทุน', age_young: 'วัยเริ่มทำงาน', age_middle: 'วัยกลางคน',
};

interface CampaignRow {
  id: string; tenant_id: string; campaign_name: string | null; campaign_type: string | null;
  status: string | null; start_date: string | null;
  recipients_count: number | null; impressions_count: number | null; clicks_count: number | null;
  segments: string[] | null;
}

const OwnerMarketing = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>('all');
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id').eq('is_platform' as any, false);
      const ids = ((tenants || []) as { id: string }[]).map((t) => t.id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from('campaigns')
          .select('id, tenant_id, campaign_name, campaign_type, status, start_date, recipients_count, impressions_count, clicks_count, segments')
          .in('tenant_id', ids);
        setCampaigns((data || []) as CampaignRow[]);
      }
    } catch (e) {
      console.error('OwnerMarketing fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Scope by period (start_date within range; 'all' = every campaign).
  const scoped = useMemo(() => {
    if (period === 'all') return campaigns;
    const { from, to } = periodToRange(period);
    return campaigns.filter((c) => {
      if (!c.start_date) return false;
      const d = new Date(c.start_date);
      if (from && d < from) return false;
      if (d > to) return false;
      return true;
    });
  }, [campaigns, period]);

  const m = useMemo(() => {
    const totalCampaigns = scoped.length;
    const tenants = new Set(scoped.map((c) => c.tenant_id)).size;
    const recipients = scoped.reduce((s, c) => s + (Number(c.recipients_count) || 0), 0);
    const impressions = scoped.reduce((s, c) => s + (Number(c.impressions_count) || 0), 0);
    const clicks = scoped.reduce((s, c) => s + (Number(c.clicks_count) || 0), 0);
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

    const typeMap = new Map<string, number>();
    scoped.forEach((c) => { const t = c.campaign_type || 'other'; typeMap.set(t, (typeMap.get(t) || 0) + 1); });
    const typeData = Array.from(typeMap.entries())
      .map(([k, v], i) => ({ name: TYPE_TH[k] || k, value: v, color: TYPE_COLORS[i % TYPE_COLORS.length] }))
      .sort((a, b) => b.value - a.value);

    const top = [...scoped]
      .sort((a, b) => (Number(b.recipients_count) || 0) - (Number(a.recipients_count) || 0))
      .slice(0, 6)
      .map((c) => ({ name: c.campaign_name || '(ไม่ระบุชื่อ)', reach: Number(c.recipients_count) || 0, clicks: Number(c.clicks_count) || 0 }));

    const segMap = new Map<string, { reach: number; clicks: number }>();
    scoped.forEach((c) => {
      (c.segments || []).forEach((s) => {
        const cur = segMap.get(s) || { reach: 0, clicks: 0 };
        cur.reach += Number(c.recipients_count) || 0;
        cur.clicks += Number(c.clicks_count) || 0;
        segMap.set(s, cur);
      });
    });
    const segData = Array.from(segMap.entries())
      .map(([k, v]) => ({ name: SEG_TH[k] || k, reach: v.reach, clicks: v.clicks }))
      .sort((a, b) => b.reach - a.reach);

    return { totalCampaigns, tenants, recipients, impressions, clicks, ctr, typeData, top, segData, topSeg: segData[0] };
  }, [scoped]);

  const reachMax = Math.max(1, ...m.top.map((c) => c.reach));

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string; }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums tracking-tight truncate">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

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

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Intelligence
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Marketing &amp; Campaign</h1>
                <p className="text-sm text-gray-500 mt-1.5">ภาพรวมแคมเปญของบริษัทที่ใช้ระบบ · ประเภทไหน/segment ไหนได้ผลดีสุด · ช่วง <span className="font-semibold text-gray-700">{periodRangeLabel(period)}</span></p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="operational" className="self-start sm:self-auto" />
            </div>

            {campaigns.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีแคมเปญในระบบ</p>
              </div>
            ) : m.totalCampaigns === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Megaphone className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ไม่มีแคมเปญในช่วงเวลานี้ — ลองเลือกช่วงอื่น</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="แคมเปญทั้งหมด" value={m.totalCampaigns.toLocaleString()} sub={`จาก ${m.tenants} บริษัทที่ใช้ระบบ`} icon={Megaphone} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="ส่งถึงผู้รับ" value={m.recipients.toLocaleString()} sub="รวมทุกแคมเปญ" icon={Send} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="คลิกรวม" value={m.clicks.toLocaleString()} sub={`${m.impressions.toLocaleString()} อิมเพรสชัน`} icon={Target} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="CTR เฉลี่ย" value={`${m.ctr.toFixed(1)}%`} sub="คลิก / อิมเพรสชัน" icon={Percent} color={KK.amber} bg={KK.amberLight} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Campaign-type donut */}
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <h2 className="text-base font-bold text-gray-900">แคมเปญตามประเภท</h2>
                    <p className="text-xs text-gray-500 mb-2 mt-0.5">สัดส่วนประเภทแคมเปญที่ใช้</p>
                    <div className="relative" style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={m.typeData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                            {m.typeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                          </Pie>
                          <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} แคมเปญ`, n]) as any} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                      {m.typeData.map((d, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                          <span className="text-gray-600 flex-1 truncate">{d.name}</span>
                          <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Top campaigns by reach */}
                  <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                    <h2 className="text-base font-bold text-gray-900">แคมเปญที่เข้าถึงมากสุด</h2>
                    <p className="text-xs text-gray-500 mb-4 mt-0.5">ส่งถึงผู้รับ · จำนวนคลิกที่ได้</p>
                    <div className="flex-1 flex flex-col justify-between gap-3">
                      {m.top.map((c) => (
                        <div key={c.name}>
                          <div className="flex justify-between text-sm mb-1 gap-2">
                            <span className="text-gray-700 font-medium truncate">{c.name}</span>
                            <span className="tabular-nums text-gray-500 flex-shrink-0">{c.reach.toLocaleString()} ส่งถึง · <span className="text-gray-700 font-semibold">{c.clicks.toLocaleString()} คลิก</span></span>
                          </div>
                          <div className="h-3 rounded-lg bg-gray-100 overflow-hidden"><div className="h-full rounded-lg" style={{ width: `${Math.max((c.reach / reachMax) * 100, 3)}%`, background: `linear-gradient(90deg, ${KK.red} 0%, #f87171 100%)` }} /></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Segment reach */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-base font-bold text-gray-900">กลุ่มเป้าหมายที่เข้าถึงมากสุด</h2>
                      <p className="text-xs text-gray-500 mb-4 mt-0.5">ผู้รับตาม segment · คลิกที่ได้</p>
                    </div>
                    {m.topSeg && <span className="text-xs font-semibold px-2.5 py-1 rounded-md flex-shrink-0" style={{ color: KK.green, backgroundColor: KK.greenLight }}>เด่นสุด: {m.topSeg.name}</span>}
                  </div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={m.segData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} interval={0} />
                      <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={((v: any, _n: any, p: any) => [`${Number(v).toLocaleString()} ผู้รับ · ${(p?.payload?.clicks ?? 0).toLocaleString()} คลิก`, 'ผลตอบรับ']) as any} />
                      <Bar dataKey="reach" radius={[6, 6, 0, 0]} maxBarSize={64}>{m.segData.map((_, i) => <Cell key={i} fill={i === 0 ? KK.green : '#86efac'} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerMarketing;
