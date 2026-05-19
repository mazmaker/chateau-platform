import { useEffect, useState } from 'react';
import { Wallet, Clock, CheckCircle2, TrendingUp, Building2 } from 'lucide-react';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { supabase } from '@/lib/supabase';

interface CommissionRow {
  id: string;
  unit_id: string | null;
  property_id: string | null;
  sale_price: number;
  rate_pct: number;
  amount: number;
  status: 'pending' | 'approved' | 'paid' | 'cancelled';
  created_at: string;
  approved_at: string | null;
  paid_at: string | null;
  notes?: string | null;
  property?: { name: string } | null;
  unit?: { unit_number: string } | null;
}

const formatTHB = (n: number) =>
  new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
  }).format(n);

const STATUS_LABEL: Record<CommissionRow['status'], { label: string; cls: string }> = {
  pending:   { label: 'รอจ่าย',   cls: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved:  { label: 'อนุมัติแล้ว', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
  paid:      { label: 'จ่ายแล้ว',  cls: 'bg-green-100 text-green-800 border-green-200' },
  cancelled: { label: 'ยกเลิก',   cls: 'bg-gray-100 text-gray-700 border-gray-200' },
};

export default function MyCommissions() {
  const { userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [rows, setRows] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!userProfile?.id) return;
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.from('agent_commissions') as any)
          .select('id, unit_id, property_id, sale_price, rate_pct, amount, status, created_at, approved_at, paid_at, notes')
          .eq('agent_user_id', userProfile.id)
          .order('created_at', { ascending: false });
        if (error) throw error;
        const base = (data || []) as CommissionRow[];
        // Enrich with property/unit names in one round-trip each
        const propIds = Array.from(new Set(base.map(r => r.property_id).filter(Boolean))) as string[];
        const unitIds = Array.from(new Set(base.map(r => r.unit_id).filter(Boolean))) as string[];
        const [{ data: props }, { data: units }] = await Promise.all([
          propIds.length
            ? supabase.from('properties').select('id, name').in('id', propIds)
            : Promise.resolve({ data: [] as { id: string; name: string }[] }),
          unitIds.length
            ? supabase.from('units').select('id, unit_number').in('id', unitIds)
            : Promise.resolve({ data: [] as { id: string; unit_number: string }[] }),
        ]);
        const propMap = new Map<string, { id: string; name: string }>((props || []).map((p: any) => [p.id, p]));
        const unitMap = new Map<string, { id: string; unit_number: string }>((units || []).map((u: any) => [u.id, u]));
        setRows(base.map(r => ({
          ...r,
          property: r.property_id ? (propMap.get(r.property_id) ?? null) : null,
          unit: r.unit_id ? (unitMap.get(r.unit_id) ?? null) : null,
        })));
      } catch (e) {
        console.error('Load commissions failed:', e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [userProfile?.id]);

  const sumPending  = rows.filter(r => r.status === 'pending' || r.status === 'approved').reduce((s, r) => s + Number(r.amount), 0);
  const sumPaid     = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.amount), 0);
  const sumTotal    = sumPending + sumPaid;

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
                    <Wallet className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">ค่าคอมมิชชั่น</h1>
                    <p className="text-gray-600 mt-1">
                      สรุปยอดและประวัติค่าคอมมิชชั่นจากการปิดดีล
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
                      <p className="text-xs text-amber-800/80 font-medium">รอจ่าย / รออนุมัติ</p>
                      <p className="text-2xl font-bold text-amber-900 tabular-nums">{formatTHB(sumPending)}</p>
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
              <Card className="border-chateau/20 bg-chateau/5">
                <CardContent className="pt-5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-chateau/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-chateau" />
                    </div>
                    <div>
                      <p className="text-xs text-chateau font-medium">รวมทั้งหมด</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatTHB(sumTotal)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>โครงการ / ยูนิต</TableHead>
                      <TableHead>ราคาขาย</TableHead>
                      <TableHead>อัตรา</TableHead>
                      <TableHead>เงินคอม</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>วันที่</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={6} className="text-center py-8">กำลังโหลด…</TableCell></TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          ยังไม่มีรายการเงินคอม
                          <p className="text-xs mt-1">เงินคอมจะเข้ามาเมื่อ Sales ปิดการขายจาก Lead ที่คุณดูแล</p>
                        </TableCell>
                      </TableRow>
                    ) : rows.map((r) => {
                      const meta = STATUS_LABEL[r.status];
                      const displayDate = r.paid_at || r.approved_at || r.created_at;
                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div className="flex items-start gap-2">
                              <Building2 className="w-4 h-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{r.property?.name || '-'}</p>
                                <p className="text-xs text-gray-500">ยูนิต {r.unit?.unit_number || '-'}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="tabular-nums text-sm text-gray-700">
                            {formatTHB(Number(r.sale_price))}
                          </TableCell>
                          <TableCell className="text-sm">{Number(r.rate_pct).toFixed(2)}%</TableCell>
                          <TableCell className="tabular-nums font-bold text-gray-900">
                            {formatTHB(Number(r.amount))}
                          </TableCell>
                          <TableCell>
                            <Badge className={`${meta.cls} border`}>{meta.label}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-500">
                            {new Date(displayDate).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
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
