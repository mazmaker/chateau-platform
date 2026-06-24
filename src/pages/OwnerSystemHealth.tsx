import { useState } from 'react';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  Server, Activity, Database, Zap, AlertTriangle, CheckCircle2, Clock, Cpu, HardDrive, Wifi,
} from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// สถานะระบบ (System Health) — Owner infra/ops monitor. ALL MOCK for now: the
// real data (CPU/RAM/DB load, uptime, API latency, quota) is NOT in the app DB —
// it must be wired to Supabase project metrics or a monitoring tool (Grafana/
// Datadog) when we scale. Page is UX-first scaffolding so the IA is complete.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
};

// R/A/G by utilisation %: <70 green, 70-85 amber, >85 red (scale-before-it-crashes).
const usageColor = (v: number) => (v > 85 ? KK.red : v > 70 ? KK.amber : KK.green);
const usageBg = (v: number) => (v > 85 ? KK.redLight : v > 70 ? KK.amberLight : KK.greenLight);

const RESOURCES = [
  { label: 'CPU', icon: Cpu, v: 38 },
  { label: 'หน่วยความจำ (RAM)', icon: Server, v: 61 },
  { label: 'ฐานข้อมูล (Database)', icon: Database, v: 47 },
  { label: 'โควต้า API', icon: Zap, v: 23 },
  { label: 'พื้นที่จัดเก็บ (Storage)', icon: HardDrive, v: 54 },
];

// 24h latency sample (ms).
const LATENCY = [
  { t: '00:00', ms: 132 }, { t: '03:00', ms: 119 }, { t: '06:00', ms: 141 }, { t: '09:00', ms: 168 },
  { t: '12:00', ms: 184 }, { t: '15:00', ms: 156 }, { t: '18:00', ms: 173 }, { t: '21:00', ms: 138 },
];

const INCIDENTS = [
  { date: '14 มิ.ย. 69 · 02:10', event: 'Database CPU แตะ 88% ชั่วคราว', status: 'แก้แล้ว', ok: true },
  { date: '11 มิ.ย. 69 · 19:42', event: 'API latency สูงกว่าปกติ ~30 นาที', status: 'แก้แล้ว', ok: true },
  { date: '07 มิ.ย. 69 · 09:05', event: 'Deploy เวอร์ชันใหม่ (ไม่มี downtime)', status: 'ปกติ', ok: true },
];

const OwnerSystemHealth = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                  Settings
                </span>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold text-gray-900">สถานะระบบ (System Health)</h1>
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded" style={{ color: KK.amber, backgroundColor: KK.amberLight }}>ตัวอย่าง</span>
                </div>
                <p className="text-sm text-gray-500 mt-1.5">สุขภาพทางเทคนิคของแพลตฟอร์ม — เซิร์ฟเวอร์/ฐานข้อมูล/API · เตือนก่อนระบบล่ม</p>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full self-start sm:self-auto" style={{ color: KK.green, backgroundColor: KK.greenLight }}>
                <CheckCircle2 className="w-4 h-4" /> ระบบทำงานปกติ
              </div>
            </div>

            <div className="rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2" style={{ color: KK.amber, backgroundColor: KK.amberLight, borderColor: '#fde68a' }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              ข้อมูลในหน้านี้เป็น <span className="font-semibold">ตัวอย่าง</span> — รอต่อ Supabase project metrics / monitoring จริงเมื่อระบบ scale
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="Uptime (30 วัน)" value="99.95%" sub="เป้าหมาย ≥ 99.9%" icon={Activity} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="API ตอบสนองเฉลี่ย" value="142 ms" sub="เป้าหมาย < 200 ms" icon={Zap} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="อัตราข้อผิดพลาด" value="0.12%" sub="ของคำขอทั้งหมด" icon={AlertTriangle} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="คำขอ/นาที" value="1,240" sub="ช่วง 24 ชม." icon={Wifi} color={KK.blue} bg={KK.blueLight} />
            </div>

            {/* Resource utilisation */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="mb-4">
                <h2 className="text-base font-bold text-gray-900">การใช้ทรัพยากรระบบ</h2>
                <p className="text-xs text-gray-500 mt-0.5">เกิน 85% = ไฟแดง ควรขยายระบบก่อนเต็ม</p>
              </div>
              <div className="space-y-4">
                {RESOURCES.map((r) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: usageBg(r.v) }}>
                      <r.icon className="w-4 h-4" style={{ color: usageColor(r.v) }} />
                    </div>
                    <span className="text-sm text-gray-700 w-44 flex-shrink-0">{r.label}</span>
                    <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${r.v}%`, backgroundColor: usageColor(r.v) }} />
                    </div>
                    <span className="text-sm font-bold tabular-nums w-12 text-right flex-shrink-0" style={{ color: usageColor(r.v) }}>{r.v}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Latency trend + incidents */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                <div className="mb-4">
                  <h2 className="text-base font-bold text-gray-900">เวลาตอบสนอง API (24 ชม.)</h2>
                  <p className="text-xs text-gray-500 mt-0.5">มิลลิวินาที (ms) · ยิ่งต่ำยิ่งดี</p>
                </div>
                {/* Chart fills the card so it matches the (taller) incidents list beside it. */}
                <div className="flex-1 min-h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={LATENCY} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={KK.blue} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={KK.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [`${v} ms`, '']) as any} />
                    <Area type="monotone" dataKey="ms" stroke={KK.blue} strokeWidth={2.5} fill="url(#latGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4" style={{ color: KK.blue }} />
                  <h2 className="text-base font-bold text-gray-900">เหตุการณ์ล่าสุด</h2>
                </div>
                <div className="space-y-3">
                  {INCIDENTS.map((it, i) => (
                    <div key={i} className="flex items-start gap-2.5 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                      <span className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: it.ok ? KK.green : KK.red }} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 leading-snug">{it.event}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{it.date} · {it.status}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerSystemHealth;
