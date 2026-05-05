import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// import { ScrollArea } from '@/ui/scroll-area'; // ไม่ใช้แล้ว
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Clock,
  User,
  Bot,
  FileText,
  DollarSign,
  AlertTriangle,
  FileX
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  tenant?: {
    name: string;
  };
}

interface StatusLog {
  id: string;
  invoice_id: string;
  tenant_id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
  change_type: string;
  reason: string | null;
  notes: string | null;
  payment_info: any;
  metadata: any;
  created_at: string;
}

interface StatusLogModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  refreshTrigger?: number; // เพิ่มตัวกระตุ้นการรีเฟรช
}

const StatusLogModal = ({ invoice, isOpen, onClose, refreshTrigger }: StatusLogModalProps) => {
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && invoice?.id) {
      fetchStatusLogs();
    }
  }, [isOpen, invoice?.id, refreshTrigger]); // เพิ่ม refreshTrigger เป็น dependency

  const fetchStatusLogs = async () => {
    if (!invoice?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoice_status_logs')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching status logs:', error);
      toast.error('ไม่สามารถโหลดประวัติการเปลี่ยนสถานะได้');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      paid: { label: 'ชำระเรียบร้อย', className: 'bg-green-100 text-green-800' },
      pending: { label: 'รอดำเนินการ', className: 'bg-red-100 text-red-800' },
      overdue: { label: 'เกินกำหนดชำระ', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'ยกเลิกใบแจ้งหนี้', className: 'bg-gray-100 text-gray-800' }
    };
    const badge = badges[status] || badges.pending;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const getChangeTypeIcon = (changeType: string) => {
    switch (changeType) {
      case 'auto_overdue':
      case 'auto_trigger':
        return <Bot className="w-4 h-4 text-blue-600" />;
      case 'manual':
      case 'payment':
        return <User className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getChangeTypeLabel = (changeType: string) => {
    const labels: Record<string, string> = {
      manual: 'เปลี่ยนด้วยมือ',
      auto_overdue: 'ระบบเปลี่ยนอัตโนมัติ',
      auto_trigger: 'Database Trigger',
      payment: 'การชำระเงิน',
      system: 'ระบบ',
    };
    return labels[changeType] || changeType;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <DollarSign className="w-4 h-4 text-green-600" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'cancelled':
        return <FileX className="w-4 h-4 text-gray-600" />;
      case 'pending':
      default:
        return <FileText className="w-4 h-4 text-chateau" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            ประวัติการเปลี่ยนสถานะ
          </DialogTitle>
          <DialogDescription>
            ใบแจ้งหนี้ {invoice.invoice_number} - {formatCurrency(invoice.amount)}
            <br />
            บริษัท: {invoice.tenant?.name}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[500px] overflow-y-auto border rounded-lg">
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
            </div>
          ) : logs.length > 0 ? (
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-[130px]">วันที่/เวลา</TableHead>
                  <TableHead className="w-[120px]">จาก → ไป</TableHead>
                  <TableHead className="w-[120px]">ประเภท</TableHead>
                  <TableHead className="w-[120px]">ผู้เปลี่ยน</TableHead>
                  <TableHead>เหตุผล/หมายเหตุ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm font-mono">
                      {formatDateTime(log.created_at)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          {getStatusIcon(log.old_status)}
                          {getStatusBadge(log.old_status)}
                        </div>
                        <div className="text-gray-400">→</div>
                        <div className="flex items-center gap-1">
                          {getStatusIcon(log.new_status)}
                          {getStatusBadge(log.new_status)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getChangeTypeIcon(log.change_type)}
                        <span className="text-sm font-medium">
                          {getChangeTypeLabel(log.change_type)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {log.changed_by === 'SYSTEM' ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Bot className="w-3 h-3" />
                            ระบบ
                          </div>
                        ) : log.changed_by === 'TRIGGER' ? (
                          <div className="flex items-center gap-1 text-purple-600">
                            <Bot className="w-3 h-3" />
                            Database
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-green-600">
                            <User className="w-3 h-3" />
                            {log.changed_by}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {log.reason && (
                          <div className="text-sm font-medium">{log.reason}</div>
                        )}
                        {log.notes && (
                          <div className="text-xs text-gray-500">{log.notes}</div>
                        )}
                        {log.payment_info && (
                          <div className="text-xs text-blue-600">
                            ชำระ: {log.payment_info.method}
                            {log.payment_info.reference && ` (${log.payment_info.reference})`}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8">
              <Clock className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-500">ยังไม่มีประวัติการเปลี่ยนสถานะ</p>
            </div>
          )}
        </div>

        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-500">
            แสดง {logs.length} รายการ
          </div>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StatusLogModal;