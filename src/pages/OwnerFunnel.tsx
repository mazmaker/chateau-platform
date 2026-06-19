import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, Users, Percent, Flame, Banknote } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// Lead Funnel & Scoring — Owner cross-tenant lead engine + the dual-score brain.
// Funnel (new→…→won) + Quality/Financial score distribution. Data: leads across
// all customer tenants. Read-only / Owner RLS. UI-first — data tuned later.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  slate: '#475569', slateLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 100) return `฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `฿${m.toFixed(1)} ล้าน`;
    return `฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `฿${(abs / 1_000).toFixed(0)}K`;
  return `฿${abs.toFixed(0)}`;
};

// Funnel stages (home-buyer journey). Cumulative: a lead at 'won' also counts in
// every earlier stage. 'lost' is excluded from the funnel.
const STAGE_ORDER = ['new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiating', 'reserved', 'won'];
const STAGE_LABEL: Record<string, string> = {
  new: 'ลีดใหม่', contacted: 'ติดต่อแล้ว', qualified: 'ผ่านคุณสมบัติ',
  viewing_scheduled: 'นัด/ดูโครงการ', negotiating: 'กำลังเจรจา', reserved: 'จองแล้ว', won: 'ปิดการขาย',
};
// Display funnel = these stages (collapse a couple for readability).
const FUNNEL_STAGES = ['new', 'contacted', 'qualified', 'viewing_scheduled', 'negotiating', 'won'];

interface LeadRow { tenant_id: string; status: string | null; financial_score: number | null; potential_score: number | null; estimated_value: number | null; }

const scoreBucket = (s: number) => (s >= 70 ? 'สูง' : s >= 40 ? 'กลาง' : 'ต่ำ');
const BUCKET_COLOR: Record<string, string> = { 'สูง': KK.green, 'กลาง': KK.amber, 'ต่ำ': KK.red };

const OwnerFunnel = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [tenantList, setTenantList] = useState<{ id: string; name: string }[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('all');

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const ids = (tenants || []).map((t: any) => t.id);
      setTenantList((tenants || []).map((t: any) => ({ id: t.id, name: t.name || t.id })).sort((a, b) => a.name.localeCompare(b.name, 'th')));
      if (ids.length > 0) {
        const { data } = await supabase.from('leads').select('tenant_id, status, financial_score, potential_score, estimated_value').in('tenant_id', ids);
        setLeads((data || []) as LeadRow[]);
      }
    } catch (e) {
      console.error('OwnerFunnel fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const idxOf = (s: string | null) => { const i = STAGE_ORDER.indexOf(s || ''); return i < 0 ? 0 : i; };

  // Scope raw leads to the selected company before any aggregate is computed.
  const scopedLeads = useMemo(
    () => (tenantFilter === 'all' ? leads : leads.filter((l) => l.tenant_id === tenantFilter)),
    [leads, tenantFilter],
  );

  const funnel = useMemo(() => {
    const active = scopedLeads.filter((l) => l.status !== 'lost');
    return FUNNEL_STAGES.map((stage) => {
      const si = STAGE_ORDER.indexOf(stage);
      const count = active.filter((l) => idxOf(l.status) >= si).length;
      return { stage, label: STAGE_LABEL[stage] || stage, count };
    });
  }, [scopedLeads]);

  const kpis = useMemo(() => {
    const total = scopedLeads.length;
    const won = scopedLeads.filter((l) => l.status === 'won').length;
    const hot = scopedLeads.filter((l) => (Number(l.potential_score) || 0) >= 70).length;
    const pipeline = scopedLeads.filter((l) => l.status !== 'won' && l.status !== 'lost').reduce((s, l) => s + (Number(l.estimated_value) || 0), 0);
    return { total, conversion: total ? Math.round((won / total) * 100) : 0, hot, pipeline };
  }, [scopedLeads]);

  const scoreDonut = (field: 'financial_score' | 'potential_score') => {
    const m = new Map<string, number>();
    scopedLeads.forEach((l) => { const v = Number(l[field]) || 0; if (v > 0) { const b = scoreBucket(v); m.set(b, (m.get(b) || 0) + 1); } });
    return ['สูง', 'กลาง', 'ต่ำ'].filter((b) => m.has(b)).map((b) => ({ name: b, value: m.get(b) || 0, color: BUCKET_COLOR[b] }));
  };
  const financialData = useMemo(() => scoreDonut('financial_score'), [scopedLeads]);
  const qualityData = useMemo(() => scoreDonut('potential_score'), [scopedLeads]);

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg }: {
    title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string;
  }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  const ScoreDonut = ({ title, sub, data }: { title: string; sub: string; data: { name: string; value: number; color: string }[] }) => {
    const sum = data.reduce((s, d) => s + d.value, 0) || 1;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
        <h2 className="text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500 mb-2 mt-0.5">{sub}</p>
        {data.length === 0 ? (
          <p className="text-sm text-gray-400 py-12 text-center">ยังไม่มีคะแนน</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
            <div className="h-[190px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2} stroke="white" strokeWidth={2}>
                    {data.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} ลีด`, n]) as any} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5">
              {data.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-gray-600 flex-1">{d.name}</span>
                  <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                  <span className="text-gray-400 tabular-nums w-9 text-right">{Math.round((d.value / sum) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
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

  const maxCount = funnel[0]?.count || 1;

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Intelligence
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Lead Funnel &amp; Scoring</h1>
                <p className="text-sm text-gray-500 mt-1.5">เส้นทางลีดข้ามทุกบริษัท + คะแนนคุณภาพ/การเงิน (สมองของแพลตฟอร์ม)</p>
              </div>
              <Select value={tenantFilter} onValueChange={setTenantFilter}>
                <SelectTrigger className="h-9 w-[200px] text-sm mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบริษัท</SelectItem>
                  {tenantList.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="ลีดทั้งหมด" value={kpis.total.toLocaleString()} sub="ข้ามทุกบริษัท" icon={Users} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="Conversion" value={`${kpis.conversion}%`} sub="ปิดได้ / ทั้งหมด" icon={Percent} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="ลีดคุณภาพสูง" value={kpis.hot.toLocaleString()} sub="Quality score ≥ 70" icon={Flame} color={KK.red} bg={KK.redLight} />
              <KpiCard title="มูลค่า Pipeline" value={fmtCompact(kpis.pipeline)} sub="ลีดที่ยังเปิดอยู่" icon={Banknote} color={KK.amber} bg={KK.amberLight} />
            </div>

            {/* Funnel */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-center gap-2 mb-1">
                <Filter className="w-4 h-4 text-gray-400" />
                <h2 className="text-base font-bold text-gray-900">กรวยการขาย (Funnel)</h2>
              </div>
              <p className="text-xs text-gray-500 mb-5">จำนวนลีดที่ผ่านแต่ละขั้น · % เทียบลีดทั้งหมด</p>
              <div className="space-y-3">
                {funnel.map((s, i) => {
                  const pct = maxCount ? Math.round((s.count / maxCount) * 100) : 0;
                  return (
                    <div key={s.stage}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{i + 1}. {s.label}</span>
                        <span className="tabular-nums text-gray-500">{s.count.toLocaleString()} <span className="text-gray-400">· {pct}%</span></span>
                      </div>
                      <div className="h-7 rounded-lg bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-700"
                          style={{ width: `${Math.max(pct, 2)}%`, background: `linear-gradient(90deg, ${KK.red} 0%, #f87171 100%)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dual score */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScoreDonut title="Quality Score (โอกาสซื้อ)" sub="กระจายตามระดับคะแนน · จากโมเดล AI" data={qualityData} />
              <ScoreDonut title="Financial Score (กำลังซื้อ)" sub="ความสามารถผ่อน/กู้ · ตลาดของธนาคาร" data={financialData} />
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerFunnel;
