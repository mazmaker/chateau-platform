import { useEffect, useState } from 'react';
import { Receipt, Clock, CheckCircle2, TrendingUp, Building2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';

type Status = 'pending' | 'approved' | 'paid' | 'cancelled';

interface CommissionRow {
  id: string;
  tenant_id: string;
  agent_user_id: string;
  unit_id: string | null;
  property_id: string | null;
  sale_price: number;
  rate_pct: number;
  amount: number;
  status: Status;
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  notes?: string | null;
  agent?: { full_name?: string; email?: string } | null;
  property?: { name: string } | null;
  unit?: { unit_number: string } | null;
}

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(n);

const STATUS_LABEL: Record<Status, { label: string; cls: string }> = {
  pending:   { label: 'รออนุมัติ',  cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved:  { label: 'อนุมัติแล้ว', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  paid:      { label: 'จ่ายแล้ว',   cls: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'ยกเลิก',    cls: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export default function CommissionApproval() {
  const { userProfile, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Status | 'all'>('pending');
  const [acting, setActing] = useState<string | null>(null);

  // Block customers + agents — sidebar route already guards but defense in depth
  const allowed = userRole === 'admin' || userRole === 'owner';

  const load = async () => {
    if (!allowed) return;
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('agent_commissions') as any)
        .select('id, tenant_id, agent_user_id, unit_id, property_id, sale_price, rate_pct, amount, status, created_at, approved_at, paid_at, notes')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const base = (data || []) as CommissionRow[];

      const agentIds = Array.from(new Set(base.map(r => r.agent_user_id).filter(Boolean)));
      const propIds  = Array.from(new Set(base.map(r => r.property_id).filter(Boolean))) as string[];
      const unitIds  = Array.from(new Set(base.map(r => r.unit_id).filter(Boolean))) as string[];

      const [{ data: agents }, { data: props }, { data: units }] = await Promise.all([
        agentIds.length
          ? (supabase.from('users') as any).select('id, full_name, email').in('id', agentIds)
          : Promise.resolve({ data: [] }),
        propIds.length
          ? supabase.from('properties').select('id, name').in('id', propIds)
          : Promise.resolve({ data: [] as { id: string; name: string }[] }),
        unitIds.length
          ? supabase.from('units').select('id, unit_number').in('id', unitIds)
          : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
      ]);
      const agentMap = new Map<string, { id: string; full_name?: string; email?: string }>(((agents as any[]) || []).map((a) => [a.id, a]));
      const propMap  = new Map<string, { id: string; name: string }>((props || []).map((p: any) => [p.id, p]));
      const unitMap  = new Map<string, { id: string; unit_number: string }>((units || []).map((u: any) => [u.id, u]));

      setRows(base.map(r => ({
        ...r,
        agent: agentMap.get(r.agent_user_id) ?? null,
        property: r.property_id ? (propMap.get(r.property_id) ?? null) : null,
        unit: r.unit_id ? (unitMap.get(r.unit_id) ?? null) : null,
      })));
    } catch (e: any) {
      console.error('Load commissions failed:', e);
      toast.error(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userProfile?.id, allowed]);  // eslint-disable-line react-hooks/exhaustive-deps

  const approve = async (row: CommissionRow) => {
    if (!confirm(`อนุมัติเงินคอม ${formatTHB(Number(row.amount))} ให้ ${row.agent?.full_name || '-'}?`)) return;
    setActing(row.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('agent_commissions') as any)
        .update({ status: 'approved', approved_by: userProfile?.id, approved_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      toast.success('อนุมัติแล้ว');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'อนุมัติไม่สำเร็จ');
    } finally {
      setActing(null);
    }
  };

  const markPaid = async (row: CommissionRow) => {
    if (!confirm(`ยืนยันได้จ่ายเงินคอม ${formatTHB(Number(row.amount))} ให้ ${row.agent?.full_name || '-'} แล้ว?`)) return;
    setActing(row.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('agent_commissions') as any)
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      toast.success('บันทึกการจ่ายแล้ว');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setActing(null);
    }
  };

  const filtered = filter === 'all' ? rows : rows.filter(r => r.status === filter);
  const sumPending = rows.filter(r => r.status === 'pending').reduce((s, r) => s + Number(r.amount), 0);
  const sumApproved = rows.filter(r => r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0);
  const sumPaid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        หน้านี้สำหรับ Admin/Owner เท่านั้น
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6">
          <div className="space-y-6">
            {/* Page header */}
            <Card className="bg-white border-gray-200 shadow-lg">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                    <Receipt className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">การอนุมัติค่าคอมมิชชั่น</h1>
                    <p className="text-gray-600 mt-1">
                      พิจารณาและบันทึกการจ่ายค่าคอมมิชชั่นให้ตัวแทนขายภายนอก
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* KPI widgets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="border-amber-200 bg-amber-50/50">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-700" />
                    </div>
                    <div>
                      <p className="text-xs text-amber-800/80 font-medium">รออนุมัติ</p>
                      <p className="text-2xl font-bold text-amber-900 tabular-nums">{formatTHB(sumPending)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50/50">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-blue-700" />
                    </div>
                    <div>
                      <p className="text-xs text-blue-800/80 font-medium">อนุมัติแล้ว · รอจ่าย</p>
                      <p className="text-2xl font-bold text-blue-900 tabular-nums">{formatTHB(sumApproved)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-green-200 bg-green-50/50">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-700" />
                    </div>
                    <div>
                      <p className="text-xs text-green-800/80 font-medium">จ่ายแล้ว</p>
                      <p className="text-2xl font-bold text-green-900 tabular-nums">{formatTHB(sumPaid)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filter tabs */}
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList>
                <TabsTrigger value="pending">รออนุมัติ</TabsTrigger>
                <TabsTrigger value="approved">อนุมัติแล้ว</TabsTrigger>
                <TabsTrigger value="paid">จ่ายแล้ว</TabsTrigger>
                <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Agent</TableHead>
                      <TableHead>โครงการ / ยูนิต</TableHead>
                      <TableHead>ราคาขาย</TableHead>
                      <TableHead>อัตรา</TableHead>
                      <TableHead>เงินคอม</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8">กำลังโหลด…</TableCell></TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Receipt className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          ไม่มีรายการในสถานะนี้
                        </TableCell>
                      </TableRow>
                    ) : filtered.map((r) => {
                      const meta = STATUS_LABEL[r.status];
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <p className="text-sm font-semibold text-gray-900">{r.agent?.full_name || '-'}</p>
                            <p className="text-xs text-gray-500">{r.agent?.email || ''}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{r.property?.name || '-'}</p>
                                <p className="text-xs text-gray-500">ยูนิต {r.unit?.unit_number || '-'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-sm text-gray-700">{formatTHB(Number(r.sale_price))}</TableCell>
                          <TableCell className="text-sm">{Number(r.rate_pct).toFixed(2)}%</TableCell>
                          <TableCell className="tabular-nums font-bold text-gray-900">{formatTHB(Number(r.amount))}</TableCell>
                          <TableCell><Badge className={`${meta.cls} border`}>{meta.label}</Badge></TableCell>
                          <TableCell className="text-right">
                            {r.status === 'pending' && (
                              <Button size="sm" onClick={() => approve(r)} disabled={acting === r.id} className="bg-blue-600 hover:bg-blue-700 text-white">
                                <Check className="w-3.5 h-3.5 mr-1" /> อนุมัติ
                              </Button>
                            )}
                            {r.status === 'approved' && (
                              <Button size="sm" onClick={() => markPaid(r)} disabled={acting === r.id} className="bg-green-600 hover:bg-green-700 text-white">
                                <Check className="w-3.5 h-3.5 mr-1" /> บันทึกจ่ายแล้ว
                              </Button>
                            )}
                            {(r.status === 'paid' || r.status === 'cancelled') && (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
