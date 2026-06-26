import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { MessageSquarePlus, Inbox } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface MyTicket {
  id: string;
  subject: string;
  description: string;
  priority: string;
  status: 'open' | 'in_progress' | 'resolved';
  context: Record<string, any> | null;
  created_at: string;
  resolved_at?: string | null;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  open:        { label: 'รอดำเนินการ', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  in_progress: { label: 'กำลังแก้ไข',  className: 'bg-blue-50 text-blue-700 border-blue-200' },
  resolved:    { label: 'แก้ไขแล้ว',   className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'ต่ำ', normal: 'ปกติ', high: 'สูง', urgent: 'เร่งด่วน',
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const SupportTicketModal = ({ open, onClose }: Props) => {
  const { user, currentTenant } = useSimpleAuth();
  const [tab, setTab] = useState<'new' | 'list'>('new');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);

  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  // ดึงเรื่องที่บริษัทตัวเองเคยแจ้ง — RLS อนุญาตให้ผู้ใช้อ่าน ticket ของ tenant ตัวเอง (รวมคำตอบใน context)
  const fetchMyTickets = async () => {
    if (!currentTenant?.id) return;
    setLoadingTickets(true);
    try {
      const { data, error } = await (supabase as any)
        .from('support_tickets')
        .select('id, subject, description, priority, status, context, created_at, resolved_at')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTickets(data || []);
    } catch {
      // เงียบไว้ ไม่รบกวน flow แจ้งปัญหา
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    if (open) fetchMyTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, currentTenant?.id]);

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      toast.error('กรุณากรอกหัวข้อและรายละเอียด');
      return;
    }
    if (!currentTenant?.id) {
      toast.error('ไม่พบข้อมูลบริษัท');
      return;
    }
    setLoading(true);
    try {
      const { error } = await (supabase as any).from('support_tickets').insert({
        tenant_id: currentTenant.id,
        reported_by: user?.id,
        subject: subject.trim(),
        description: description.trim(),
        priority,
        context: { page: window.location.pathname },
      });
      if (error) throw error;
      toast.success('ส่งเรื่องแจ้งปัญหาสำเร็จ', {
        description: 'ทีมงานจะติดต่อกลับโดยเร็ว',
      });
      setSubject('');
      setDescription('');
      setPriority('normal');
      // สลับไปแท็บ "เรื่องที่แจ้งไว้" + รีเฟรช เพื่อให้ผู้ใช้เห็นเรื่องที่เพิ่งแจ้ง และติดตามคำตอบได้
      await fetchMyTickets();
      setTab('list');
    } catch (err) {
      toast.error('ไม่สามารถส่งได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา / ขอความช่วยเหลือ</DialogTitle>
        </DialogHeader>

        {/* แท็บ: แจ้งใหม่ / เรื่องที่แจ้งไว้ */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          <button
            onClick={() => setTab('new')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md py-1.5 transition-colors ${tab === 'new' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <MessageSquarePlus className="w-4 h-4" />
            แจ้งปัญหาใหม่
          </button>
          <button
            onClick={() => setTab('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-md py-1.5 transition-colors ${tab === 'list' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Inbox className="w-4 h-4" />
            เรื่องที่แจ้งไว้{tickets.length ? ` (${tickets.length})` : ''}
          </button>
        </div>

        {tab === 'new' ? (
          <>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>หัวข้อ *</Label>
                <Input
                  placeholder="เช่น ระบบแสดงข้อมูลผิดพลาด"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <Label>ระดับความเร่งด่วน</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">ต่ำ — แจ้งไว้ก่อน ไม่เร่ง</SelectItem>
                    <SelectItem value="normal">ปกติ — กระทบการทำงานบางส่วน</SelectItem>
                    <SelectItem value="high">สูง — กระทบการทำงานหลัก</SelectItem>
                    <SelectItem value="urgent">เร่งด่วน — ระบบใช้ไม่ได้</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>รายละเอียด *</Label>
                <textarea
                  className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                  placeholder="อธิบายปัญหาที่พบ เช่น ทำอะไรอยู่ แล้วเกิดอะไรขึ้น..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <p className="text-xs text-gray-400">
                ระบบจะแนบข้อมูลหน้าปัจจุบัน ({window.location.pathname}) ไปด้วยอัตโนมัติ
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={onClose} disabled={loading}>ยกเลิก</Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-chateau hover:bg-chateau-600 text-white">
                {loading ? 'กำลังส่ง...' : 'ส่งเรื่อง'}
              </Button>
            </div>
          </>
        ) : (
          <div className="py-2 max-h-[60vh] overflow-y-auto space-y-3">
            {loadingTickets ? (
              <p className="text-center text-sm text-gray-400 py-8">กำลังโหลด...</p>
            ) : tickets.length === 0 ? (
              <div className="text-center py-10">
                <Inbox className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-500">ยังไม่มีเรื่องที่แจ้งไว้</p>
              </div>
            ) : (
              tickets.map((t) => {
                const sBadge = STATUS_BADGE[t.status] || STATUS_BADGE.open;
                const reply = t.context?.owner_response as string | undefined;
                return (
                  <div key={t.id} className="rounded-lg border border-gray-200 p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="font-semibold text-sm text-gray-900">{t.subject}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border flex-shrink-0 ${sBadge.className}`}>{sBadge.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-2">
                      <span>ความเร่งด่วน: {PRIORITY_LABEL[t.priority] || t.priority}</span>
                      <span className="text-gray-300">·</span>
                      <span>{fmtDate(t.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{t.description}</p>

                    {reply ? (
                      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-700 mb-1">การตอบกลับจากทีมงาน</p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{reply}</p>
                        {t.context?.responded_at && (
                          <p className="text-xs text-gray-400 mt-1">ตอบเมื่อ {fmtDate(t.context.responded_at)}</p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400">ทีมงานยังไม่ได้ตอบกลับ</p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SupportTicketModal;
