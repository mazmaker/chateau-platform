import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Trophy, TrendingUp, Percent, Users } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';

// ──────────────────────────────────────────────────────────────────────────
// ประสิทธิภาพทีมขาย — Owner cross-tenant ranking of sales staff + agents.
// Performance is measured from LEADS (assigned + won), the richest signal in the
// data: leads.assigned_to (owner), status='won' (closed deal), estimated_value
// (deal size), referred_by_agent_id (referrals). Stops at performance level —
// NO per-customer PII surfaced here (PDPA). Read-only via Owner RLS.
// See documents/owner-hq-dashboard-plan.md.
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

const ROLE_TH: Record<string, string> = { sales: 'พนักงานขาย', agent: 'นายหน้า', admin: 'ผู้ดูแลบริษัท', owner: 'แพลตฟอร์ม' };
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
};
// Donut slice palette — distinct hues per salesperson.
const PIE_COLORS = ['#1e3a5f', '#ef4444', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569'];

interface UserRow { id: string; full_name: string | null; role: string | null; tenant_id: string | null; }
interface LeadRow { assigned_to: string | null; status: string | null; estimated_value: number | null; referred_by_agent_id: string | null; }
interface PerfRow {
  id: string; name: string; role: string; company: string;
  assigned: number; won: number; wonValue: number; referrals: number; conversion: number;
}

const OwnerAgents = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PerfRow[]>([]);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    fetchAll();
  }, [isOwner, navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, name').eq('is_platform' as any, false);
      const tlist = (tenants || []) as { id: string; name: string }[];
      const ids = tlist.map((t) => t.id);
      const tenantName = new Map(tlist.map((t) => [t.id, t.name]));
      if (ids.length > 0) {
        const [uRes, lRes] = await Promise.all([
          supabase.from('users').select('id, full_name, role, tenant_id').in('tenant_id', ids),
          supabase.from('leads').select('assigned_to, status, estimated_value, referred_by_agent_id').in('tenant_id', ids),
        ]);
        const users = (uRes.data || []) as UserRow[];
        const leads = (lRes.data || []) as LeadRow[];

        const perf = new Map<string, { assigned: number; won: number; wonValue: number; referrals: number }>();
        const ensure = (id: string) => {
          let r = perf.get(id);
          if (!r) { r = { assigned: 0, won: 0, wonValue: 0, referrals: 0 }; perf.set(id, r); }
          return r;
        };
        leads.forEach((l) => {
          if (l.assigned_to) {
            const r = ensure(l.assigned_to);
            r.assigned += 1;
            if (l.status === 'won') { r.won += 1; r.wonValue += Number(l.estimated_value) || 0; }
          }
          if (l.referred_by_agent_id) ensure(l.referred_by_agent_id).referrals += 1;
        });

        const out: PerfRow[] = users
          .map((u) => {
            const p = perf.get(u.id);
            if (!p) return null;
            return {
              id: u.id,
              name: u.full_name || 'ไม่ระบุชื่อ',
              role: u.role || 'unknown',
              company: tenantName.get(u.tenant_id || '') || '–',
              assigned: p.assigned, won: p.won, wonValue: p.wonValue, referrals: p.referrals,
              conversion: p.assigned > 0 ? Math.round((p.won / p.assigned) * 100) : 0,
            } as PerfRow;
          })
          .filter((r): r is PerfRow => r !== null && (r.assigned > 0 || r.referrals > 0))
          .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won);

        setRows(out);
      }
    } catch (e) {
      console.error('OwnerAgents fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const won = rows.reduce((s, r) => s + r.won, 0);
    const assigned = rows.reduce((s, r) => s + r.assigned, 0);
    const wonValue = rows.reduce((s, r) => s + r.wonValue, 0);
    return { people: rows.length, won, wonValue, conversion: assigned > 0 ? Math.round((won / assigned) * 100) : 0 };
  }, [rows]);

  // Donut: share of closed-deal value by salesperson. Top 8 explicit, rest pooled into "อื่น ๆ".
  const pieData = useMemo(() => {
    const withVal = rows.filter((r) => r.wonValue > 0);
    const grand = withVal.reduce((s, r) => s + r.wonValue, 0) || 1;
    const TOP = 8;
    const head = withVal.slice(0, TOP);
    const restVal = withVal.slice(TOP).reduce((s, r) => s + r.wonValue, 0);
    const items = head.map((r, i) => ({
      name: r.name, value: r.wonValue, color: PIE_COLORS[i % PIE_COLORS.length],
      pct: Math.round((r.wonValue / grand) * 100),
    }));
    if (restVal > 0) items.push({ name: 'อื่น ๆ', value: restVal, color: KK.gray, pct: Math.round((restVal / grand) * 100) });
    return items;
  }, [rows]);

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
      <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-[13px] text-gray-400 mt-3.5 truncate">{sub}</p>}
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

  const top = rows[0];

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                Analytics
              </span>
              <h1 className="text-2xl font-bold text-gray-900">Sales Performance</h1>
              <p className="text-[15px] text-gray-500 mt-1.5">อันดับพนักงานขายและนายหน้าทั้งแพลตฟอร์ม · วัดจาก Lead ที่ดูแลและปิดได้</p>
            </div>

            {rows.length === 0 ? (
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
                <Users className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีข้อมูลผลงานทีมขาย</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <KpiCard title="ผู้ขายทั้งหมด" value={totals.people.toLocaleString()} sub="มี Lead ดูแล" icon={Users} color={KK.blue} bg={KK.blueLight} />
                  <KpiCard title="ดีลปิดรวม (won)" value={totals.won.toLocaleString()} sub="ทั้งแพลตฟอร์ม" icon={Trophy} color={KK.green} bg={KK.greenLight} />
                  <KpiCard title="มูลค่าดีล (ประเมิน)" value={fmtCompact(totals.wonValue)} sub="ประเมินจาก Lead" icon={TrendingUp} color={KK.red} bg={KK.redLight} />
                  <KpiCard title="Conversion เฉลี่ย" value={`${totals.conversion}%`} sub="ปิดได้ / ดูแลทั้งหมด" icon={Percent} color={KK.amber} bg={KK.amberLight} />
                </div>

                {/* Overview donut: share of closed-deal value by salesperson (เฮีย: ภาพรวมเป็นวงกลม) */}
                {pieData.length > 0 && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                    <div className="mb-4">
                      <h2 className="text-base font-bold text-gray-900">สัดส่วนมูลค่าดีลที่ปิดได้ตามผู้ขาย</h2>
                      <p className="text-xs text-gray-500 mt-0.5">ก้อนใหญ่สุด = ผู้ขายที่ปิดดีลได้มูลค่ามากสุด · ชี้ที่กราฟเพื่อดูมูลค่า</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                      <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={62} outerRadius={100} paddingAngle={2} stroke="white" strokeWidth={2}>
                              {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [fmtCompact(Number(v)), n]) as any} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {pieData.map((d, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="truncate text-gray-700">{d.name}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                              <span className="text-gray-900 font-semibold">{fmtCompact(d.value)}</span>
                              <span className="text-gray-400 w-10 text-right">{d.pct}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Top performer */}
                {top && (
                  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: KK.amberLight }}>
                      <Trophy className="w-6 h-6" style={{ color: KK.amber }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-gray-500">ผู้ขายเก่งที่สุด</p>
                      <p className="text-base font-bold text-gray-900 truncate">{top.name} <span className="text-gray-400 font-normal">· {top.company}</span></p>
                      <p className="text-sm text-gray-500 tabular-nums">ปิด {top.won} ดีล · {fmtCompact(top.wonValue)} · conversion {top.conversion}%</p>
                    </div>
                  </div>
                )}

                {/* Ranking table */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                  <div className="mb-4">
                    <h2 className="text-base font-bold text-gray-900">อันดับผู้ขาย</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามมูลค่าดีลที่ปิดได้</p>
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>ผู้ขาย</TableHead>
                          <TableHead>บริษัท</TableHead>
                          <TableHead className="text-right">Lead ดูแล</TableHead>
                          <TableHead className="text-right">ปิดได้</TableHead>
                          <TableHead className="text-right">Conversion</TableHead>
                          <TableHead className="text-right">มูลค่าดีล</TableHead>
                          <TableHead className="text-right">แนะนำ</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((r, i) => (
                          <TableRow key={r.id}>
                            <TableCell className="text-gray-400 tabular-nums">{i + 1}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{r.name}</span>
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ROLE_TH[r.role] || r.role}</Badge>
                              </div>
                            </TableCell>
                            <TableCell className="text-gray-600">{r.company}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.assigned}</TableCell>
                            <TableCell className="text-right tabular-nums font-semibold" style={{ color: KK.green }}>{r.won}</TableCell>
                            <TableCell className="text-right tabular-nums">{r.conversion}%</TableCell>
                            <TableCell className="text-right tabular-nums">{fmtCompact(r.wonValue)}</TableCell>
                            <TableCell className="text-right tabular-nums text-gray-500">{r.referrals || '–'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            )}
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerAgents;
