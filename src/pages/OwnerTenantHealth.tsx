import { useState } from 'react';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HeartPulse, ShieldCheck, AlertTriangle, Moon, ChevronRight } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// Tenant Health — Owner customer-success lens: which paying companies are
// healthy vs going quiet (churn risk). The #1 thing a SaaS owner must see.
// UI-first; sample data (wire to tenants + activity_logs recency later).
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

type Status = 'healthy' | 'at_risk' | 'dormant';
const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  healthy: { label: 'แข็งแรง', color: KK.green, bg: KK.greenLight },
  at_risk: { label: 'เสี่ยงเลิกใช้', color: KK.amber, bg: KK.amberLight },
  dormant: { label: 'เงียบ/ไม่ใช้งาน', color: KK.red, bg: KK.redLight },
};

interface Row { name: string; plan: string; lastDays: number; health: number; status: Status; users: number; projects: number; }

// Sample tenant-health data (UI-first).
const ROWS: Row[] = [
  { name: 'บริษัท ใหม่ จำกัด', plan: 'professional', lastDays: 0, health: 94, status: 'healthy', users: 31, projects: 21 },
  { name: 'ชาญอิสระ', plan: 'professional', lastDays: 1, health: 90, status: 'healthy', users: 24, projects: 12 },
  { name: 'กรีนวิว ดีเวลลอปเมนท์', plan: 'professional', lastDays: 2, health: 82, status: 'healthy', users: 14, projects: 6 },
  { name: 'เอเอส เวนเจอร์ แคปปิตอล', plan: 'starter', lastDays: 4, health: 71, status: 'healthy', users: 6, projects: 2 },
  { name: 'เมืองทอง เอสเทท', plan: 'professional', lastDays: 9, health: 56, status: 'at_risk', users: 9, projects: 4 },
  { name: 'ดีลเลอร์ รุ่งเรือง', plan: 'professional', lastDays: 13, health: 48, status: 'at_risk', users: 5, projects: 3 },
  { name: 'Test Company', plan: 'professional', lastDays: 18, health: 34, status: 'at_risk', users: 3, projects: 1 },
  { name: 'บ้านสุขชัย พร็อพเพอร์ตี้', plan: 'starter', lastDays: 27, health: 22, status: 'dormant', users: 2, projects: 0 },
];

const PLAN_TH: Record<string, string> = { professional: 'Professional', starter: 'Starter', enterprise: 'Enterprise', free: 'Free' };

const OwnerTenantHealth = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  if (!isOwner) { navigate('/'); return null; }

  const healthy = ROWS.filter((r) => r.status === 'healthy').length;
  const atRisk = ROWS.filter((r) => r.status === 'at_risk').length;
  const dormant = ROWS.filter((r) => r.status === 'dormant').length;

  const donut = ([
    { name: STATUS_META.healthy.label, value: healthy, color: KK.green },
    { name: STATUS_META.at_risk.label, value: atRisk, color: KK.amber },
    { name: STATUS_META.dormant.label, value: dormant, color: KK.red },
  ]).filter((d) => d.value > 0);

  const filtered = ROWS.filter((r) => statusFilter === 'all' || r.status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = filtered.slice(pageStart, pageStart + pageSize);

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
                  Tenants
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Tenant Health</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">สุขภาพการใช้งานของบริษัทที่เช่าระบบ · ใครแข็งแรง vs ใครกำลังจะหนี (churn risk) · ข้อมูลช่วง <span className="font-semibold text-gray-700">{periodRangeLabel(period)}</span></p>
              </div>
              <PeriodFilter value={period} onChange={setPeriod} tier="strategic" className="self-start sm:self-auto" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard title="บริษัททั้งหมด" value={ROWS.length.toLocaleString()} sub="ที่เช่าระบบ" icon={HeartPulse} color={KK.blue} bg={KK.blueLight} />
              <KpiCard title="แข็งแรง" value={healthy.toLocaleString()} sub="ใช้งานสม่ำเสมอ" icon={ShieldCheck} color={KK.green} bg={KK.greenLight} />
              <KpiCard title="เสี่ยงเลิกใช้" value={atRisk.toLocaleString()} sub="เริ่มใช้งานน้อยลง" icon={AlertTriangle} color={KK.amber} bg={KK.amberLight} />
              <KpiCard title="เงียบ/ไม่ใช้งาน" value={dormant.toLocaleString()} sub="ต้องรีบเข้าไปดูแล" icon={Moon} color={KK.red} bg={KK.redLight} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Health donut */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <h2 className="text-base font-bold text-gray-900">สัดส่วนสุขภาพบริษัท</h2>
                <p className="text-xs text-gray-500 mb-2 mt-0.5">แข็งแรง / เสี่ยง / เงียบ</p>
                <div className="relative" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} บริษัท`, n]) as any} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{ROWS.length}</div>
                    <div className="text-[11px] text-gray-500">บริษัท</div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {donut.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* At-risk table */}
              <div className="lg:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">รายบริษัท</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามคะแนนสุขภาพ (ต่ำ = เสี่ยงสุด)</p>
                  </div>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9 w-[160px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="healthy">แข็งแรง</SelectItem>
                      <SelectItem value="at_risk">เสี่ยงเลิกใช้</SelectItem>
                      <SelectItem value="dormant">เงียบ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>บริษัท</TableHead>
                        <TableHead className="text-center">แพ็กเกจ</TableHead>
                        <TableHead className="text-right">ใช้งานล่าสุด</TableHead>
                        <TableHead className="w-[120px]">สุขภาพ</TableHead>
                        <TableHead className="text-center">สถานะ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((r) => {
                        const m = STATUS_META[r.status];
                        return (
                          <TableRow key={r.name} className="cursor-pointer hover:bg-gray-50" onClick={() => navigate('/tenants')}>
                            <TableCell className="font-semibold text-gray-900">{r.name}<span className="block text-[11px] text-gray-400 font-normal">{r.users} ผู้ใช้ · {r.projects} โครงการ</span></TableCell>
                            <TableCell className="text-center"><Badge variant="outline" className="text-[10px]">{PLAN_TH[r.plan] || r.plan}</Badge></TableCell>
                            <TableCell className="text-right tabular-nums text-gray-600">{r.lastDays === 0 ? 'วันนี้' : `${r.lastDays} วันก่อน`}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden"><div className="h-full rounded" style={{ width: `${r.health}%`, background: m.color }} /></div>
                                <span className="text-xs tabular-nums text-gray-500 w-6">{r.health}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-md whitespace-nowrap" style={{ color: m.color, backgroundColor: m.bg }}>{m.label}</span></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                {filtered.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-500">แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filtered.length)} จาก {filtered.length} บริษัท</span>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}><ChevronRight className="w-4 h-4 rotate-180" /></Button>
                      {(() => { const pages: number[] = []; const from = Math.max(1, safePage - 2); const to = Math.min(totalPages, from + 4); for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i); return pages.map((p) => (<Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setCurrentPage(p)}>{p}</Button>)); })()}
                      <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerTenantHealth;
