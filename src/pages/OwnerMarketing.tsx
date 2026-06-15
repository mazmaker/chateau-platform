import { useState } from 'react';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Megaphone, Send, Users, Target } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// Marketing & Campaign Overview — the real "Marketing" (เฮีย: ส่งมอบคุณค่า,
// ไม่ใช่ยอดขาย). Which campaigns reach most, which segment responds best,
// across all tenants. UI-first; sample data (wire to campaigns + segments later).
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
const DONUT = [KK.green, KK.blue, KK.amber, KK.red, KK.gray];

// Sample data (UI-first).
const wChannel = [{ name: 'LINE OA', v: 14, c: KK.green }, { name: 'Facebook', v: 9, c: KK.blue }, { name: 'Email', v: 6, c: KK.amber }, { name: 'SMS', v: 3, c: KK.gray }];
const wTopCampaign = [
  { name: 'โปรบ้านหลังแรก', reach: 12400, leads: 340 },
  { name: 'ดอกเบี้ยพิเศษ Q2', reach: 9800, leads: 280 },
  { name: 'Open House หัวหิน', reach: 7200, leads: 190 },
  { name: 'ผ่อน 0% 24 เดือน', reach: 5600, leads: 150 },
  { name: 'คอนโดติดรถไฟฟ้า', reach: 4100, leads: 95 },
];
const wSegment = [
  { name: 'นักลงทุน', leads: 420, conv: 18 },
  { name: 'ครอบครัวเริ่มต้น', leads: 360, conv: 22 },
  { name: 'Gen Y first jobber', leads: 310, conv: 12 },
  { name: 'เกษียณ/พักผ่อน', leads: 180, conv: 26 },
  { name: 'ซื้อปล่อยเช่า', leads: 140, conv: 15 },
];

const OwnerMarketing = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.operational);
  if (!isOwner) { navigate('/'); return null; }

  const totalCampaigns = wChannel.reduce((s, c) => s + c.v, 0);
  const totalReach = wTopCampaign.reduce((s, c) => s + c.reach, 0);
  const topSeg = [...wSegment].sort((a, b) => b.leads - a.leads)[0];
  const reachMax = Math.max(...wTopCampaign.map((c) => c.reach));
  const segMax = Math.max(...wSegment.map((s) => s.leads));

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string; }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[13px] text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

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
                <p className="text-[15px] text-gray-500 mt-1.5">ภาพรวมแคมเปญข้ามทุกบริษัท · ช่องทางไหน/segment ไหนได้ผลดีสุด · ข้อมูลช่วง <span className="font-semibold text-gray-700">{periodRangeLabel(period)}</span></p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="operational" className="self-start sm:self-auto" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="แคมเปญทั้งหมด" value={totalCampaigns.toLocaleString()} sub="ทุกบริษัท" icon={Megaphone} color={KK.red} bg={KK.redLight} />
              <KpiCard title="เข้าถึง (Reach)" value={`${(totalReach / 1000).toFixed(1)}K`} sub="รวมทุกแคมเปญ" icon={Send} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="ลีดจากแคมเปญ" value={wTopCampaign.reduce((s, c) => s + c.leads, 0).toLocaleString()} sub="ที่ปิดได้/กำลังตาม" icon={Users} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="Segment เด่น" value={topSeg.name} sub={`${topSeg.leads} ลีด`} icon={Target} color={KK.amber} bg={KK.amberLight} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Channel donut */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <h2 className="text-base font-bold text-gray-900">แคมเปญตามช่องทาง</h2>
                <p className="text-xs text-gray-500 mb-2 mt-0.5">สัดส่วนช่องทางที่ใช้</p>
                <div className="relative" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={wChannel} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {wChannel.map((d, i) => <Cell key={i} fill={d.c} />)}
                      </Pie>
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} แคมเปญ`, n]) as any} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {wChannel.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.c }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">{d.v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top campaigns by reach */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <h2 className="text-base font-bold text-gray-900">แคมเปญที่เข้าถึงมากสุด</h2>
                <p className="text-xs text-gray-500 mb-4 mt-0.5">Reach · จำนวนลีดที่ได้</p>
                <div className="space-y-3">
                  {wTopCampaign.map((c) => (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{c.name}</span>
                        <span className="tabular-nums text-gray-500">{c.reach.toLocaleString()} reach · <span className="text-gray-700 font-semibold">{c.leads} ลีด</span></span>
                      </div>
                      <div className="h-3 rounded-lg bg-gray-100 overflow-hidden"><div className="h-full rounded-lg" style={{ width: `${Math.max((c.reach / reachMax) * 100, 3)}%`, background: `linear-gradient(90deg, ${KK.red} 0%, #f87171 100%)` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Segment performance */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <h2 className="text-base font-bold text-gray-900">Segment ที่ตอบสนองดีสุด</h2>
              <p className="text-xs text-gray-500 mb-4 mt-0.5">จำนวนลีด · % conversion ต่อ segment</p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={wSegment} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={kkTooltipStyle} cursor={{ fill: 'rgba(0,0,0,0.03)' }} formatter={((v: any, _n: any, p: any) => [`${v} ลีด · conv ${p?.payload?.conv}%`, 'ผลตอบรับ']) as any} />
                  <Bar dataKey="leads" radius={[6, 6, 0, 0]} maxBarSize={64}>{wSegment.map((_, i) => <Cell key={i} fill={i === 0 ? KK.green : '#86efac'} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerMarketing;
