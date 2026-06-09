import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

interface Props {
  open: boolean;
  onClose: () => void;
}

const SupportTicketModal = ({ open, onClose }: Props) => {
  const { user, currentTenant } = useSimpleAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');
  const [loading, setLoading] = useState(false);

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
      onClose();
    } catch (err) {
      toast.error('ไม่สามารถส่งได้ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>แจ้งปัญหา / ขอความช่วยเหลือ</DialogTitle>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
};

export default SupportTicketModal;
