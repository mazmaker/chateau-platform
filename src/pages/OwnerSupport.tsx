import { useState, useEffect } from 'react';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD } from '@/components/dashboard/PeriodFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { MessageSquare, Clock, CheckCircle2, AlertTriangle, RefreshCw, User } from 'lucide-react';

interface Ticket {
  id: string;
  tenant_id: string;
  subject: string;
  description: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved';
  context: Record<string, any>;
  created_at: string;
  resolved_at?: string;
  tenant?: { name: string };
  reporter?: { full_name: string; email: string; role: string };
}

const PRIORITY_BADGE: Record<string, { label: string; className: string }> = {
  low:    { label: 'ต่ำ',     className: 'bg-gray-100 text-gray-600 border-gray-200' },
  normal: { label: 'ปกติ',   className: 'bg-blue-50 text-blue-700 border-blue-200' },
  high:   { label: 'สูง',    className: 'bg-amber-50 text-amber-700 border-amber-200' },
  urgent: { label: 'เร่งด่วน', className: 'bg-red-50 text-chateau border-chateau-200' },
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:        { label: 'รอดำเนินการ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'กำลังแก้ไข', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved:    { label: 'แก้ไขแล้ว',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const ROLE_LABEL: Record<string, string> = {
  admin: 'ผู้ดูแลบริษัท', sales: 'พนักงานขาย', agent: 'นายหน้า', customer: 'ลูกค้า',
};

const OwnerSupport = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.operational);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'open' | 'in_progress' | 'resolved'>('open');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from('support_tickets')
        .select(`
          *,
          tenant:tenants(name),
          reporter:users(full_name, email, role)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch {
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const updateStatus = async (id: string, status: Ticket['status']) => {
    const { error } = await (supabase as any)
      .from('support_tickets')
      .update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })
      .eq('id', id);
    if (error) { toast.error('อัปเดตไม่สำเร็จ'); return; }
    toast.success('อัปเดตสถานะแล้ว');
    fetchTickets();
  };

  const filtered = tickets.filter(t => filter === 'all' || t.status === filter);
  const counts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
  };

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8">

            {/* Page header */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Support</h1>
                      <p className="text-sm text-gray-500">ติดตามและจัดการปัญหาที่ผู้เช่าแจ้งเข้ามา</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <PeriodFilter value={period} onChange={setPeriod} tier="operational" />
                    <Button variant="outline" size="sm" onClick={fetchTickets}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      รีเฟรช
                    </Button>
                  </div>
                </div>

                {/* KPI strip */}
                <div className="grid grid-cols-4 gap-4 mt-6">
                  {([
                    { key: 'all',         label: 'ทั้งหมด',      icon: MessageSquare,     color: 'text-gray-600' },
                    { key: 'open',        label: 'รอดำเนินการ',  icon: Clock,        color: 'text-amber-600' },
                    { key: 'in_progress', label: 'กำลังแก้ไข',  icon: AlertTriangle, color: 'text-blue-600' },
                    { key: 'resolved',    label: 'แก้ไขแล้ว',   icon: CheckCircle2, color: 'text-emerald-600' },
                  ] as const).map(({ key, label, icon: Icon, color }) => (
                    <button
                      key={key}
                      onClick={() => setFilter(key)}
                      className={`text-left p-3 rounded-xl border transition-all ${filter === key ? 'border-chateau bg-red-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                    >
                      <Icon className={`w-4 h-4 mb-1 ${color}`} />
                      <p className="text-2xl font-bold text-gray-900">{counts[key]}</p>
                      <p className="text-xs text-gray-500">{label}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Ticket list */}
            <div className="space-y-3">
              {loading ? (
                <Card><CardContent className="py-10 text-center text-gray-400">กำลังโหลด...</CardContent></Card>
              ) : filtered.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">ไม่มีเรื่องแจ้งปัญหา</p>
                  </CardContent>
                </Card>
              ) : filtered.map((t) => {
                const pBadge = PRIORITY_BADGE[t.priority];
                const sBadge = STATUS_BADGE[t.status];
                const isOpen = expanded === t.id;
                return (
                  <Card key={t.id} className="overflow-hidden">
                    <button
                      className="w-full text-left p-5 hover:bg-gray-50 transition-colors"
                      onClick={() => setExpanded(isOpen ? null : t.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-semibold text-gray-900 truncate">{t.subject}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${pBadge.className}`}>{pBadge.label}</span>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded border ${sBadge.className}`}>{sBadge.label}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                            <span className="text-sm text-gray-500 font-medium">{(t.tenant as any)?.name || t.tenant_id}</span>
                            <span className="text-gray-300">·</span>
                            <User className="w-3 h-3 text-gray-400" />
                            <span className="text-sm text-gray-500">{(t.reporter as any)?.full_name || 'ไม่ระบุ'}</span>
                            {(t.reporter as any)?.role && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                                {ROLE_LABEL[(t.reporter as any).role] || (t.reporter as any).role}
                              </span>
                            )}
                            <span className="text-gray-300">·</span>
                            <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-400 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-gray-400 uppercase mb-1">รายละเอียด</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.description}</p>
                        </div>
                        {t.context?.page && (
                          <p className="text-xs text-gray-400">หน้าที่แจ้ง: <span className="font-mono">{t.context.page}</span></p>
                        )}
                        <div className="flex gap-2 pt-1 flex-wrap">
                          {t.status !== 'in_progress' && t.status !== 'resolved' && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, 'in_progress')}>
                              กำลังแก้ไข
                            </Button>
                          )}
                          {t.status !== 'resolved' && (
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateStatus(t.id, 'resolved')}>
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              แก้ไขแล้ว
                            </Button>
                          )}
                          {t.status === 'resolved' && (
                            <Button size="sm" variant="outline" onClick={() => updateStatus(t.id, 'open')}>
                              เปิดใหม่
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerSupport;
