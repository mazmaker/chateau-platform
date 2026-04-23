import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, DollarSign, FileX, Clock, Edit } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  subscription_plan: string;
  due_date: string;
  paid_at?: string;
  description?: string;
  created_at: string;
  updated_at: string;
  tenant?: {
    name: string;
    slug: string;
  };
}

interface StatusChangeModalProps {
  invoice: Invoice | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: StatusChangeData) => void;
  refreshTrigger?: number; // เพิ่มตัวกระตุ้นการรีเฟรช
}

interface StatusChangeData {
  newStatus: string;
  paymentDate?: string;
  paymentMethod?: string;
  referenceNumber?: string;
  reason?: string;
  notes?: string;
  actualAmount?: number;
  lateFeeAction?: 'charge' | 'waive' | 'reduce';
  reducedLateFee?: number;
  restoreService?: boolean;
}

const StatusChangeModal = ({
  invoice,
  isOpen,
  onClose,
  onConfirm,
  refreshTrigger
}: StatusChangeModalProps) => {
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(invoice); // สำหรับแสดงข้อมูลปัจจุบัน
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'paid' | 'overdue' | 'cancelled'>('paid');
  const [formData, setFormData] = useState<StatusChangeData>({
    newStatus: selectedStatus,
    paymentDate: new Date().toISOString().split('T')[0],
    paymentMethod: '',
    referenceNumber: '',
    reason: '',
    notes: '',
    actualAmount: invoice?.amount || 0,
    lateFeeAction: 'charge',
    reducedLateFee: 0,
    restoreService: true
  });
  const [isLoading, setIsLoading] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Update currentInvoice when invoice prop changes
  useEffect(() => {
    if (invoice) {
      setCurrentInvoice(invoice);
      // อัพเดท actualAmount ให้ตรงกับใบแจ้งหนี้ปัจจุบัน
      setFormData(prev => ({
        ...prev,
        actualAmount: invoice.amount
      }));
    }
  }, [invoice]);

  // Update formData when selectedStatus changes
  useEffect(() => {
    if (selectedStatus) {
      setFormData(prev => ({
        ...prev,
        newStatus: selectedStatus
      }));
    }
  }, [selectedStatus]);

  // เก็บ invoice ID เพื่อไม่ให้รีเซ็ตฟอร์มเมื่อเปิด-ปิด Modal ใบแจ้งหนี้เดิม
  const [lastInvoiceId, setLastInvoiceId] = useState<string | null>(null);

  // Initialize form เฉพาะเมื่อเปิดใบแจ้งหนี้ใหม่
  useEffect(() => {
    if (isOpen && currentInvoice?.id && currentInvoice.id !== lastInvoiceId) {
      setSelectedStatus('paid');
      setFormData({
        newStatus: 'paid',
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        referenceNumber: '',
        reason: '',
        notes: '',
        actualAmount: currentInvoice.amount,
        lateFeeAction: 'charge',
        reducedLateFee: 0,
        restoreService: true
      });
      setConfirmText('');
      setLastInvoiceId(currentInvoice.id);
    }
  }, [isOpen, currentInvoice?.id, lastInvoiceId]);

  if (!currentInvoice) return null;

  // Get available status transitions
  const getAvailableStatuses = (currentStatus: string) => {
    const transitions: Record<string, Array<{value: string, label: string, disabled?: boolean}>> = {
      pending: [
        { value: 'paid', label: 'ชำระเรียบร้อย' },
        { value: 'overdue', label: 'เกินกำหนดชำระ' },
        { value: 'cancelled', label: 'ยกเลิกใบแจ้งหนี้' }
      ],
      paid: [
        { value: 'pending', label: 'รอดำเนินการ' },
        { value: 'cancelled', label: 'ยกเลิกใบแจ้งหนี้' }
      ],
      overdue: [
        { value: 'paid', label: 'ชำระเรียบร้อย' },
        { value: 'pending', label: 'รอดำเนินการ' },
        { value: 'cancelled', label: 'ยกเลิกใบแจ้งหนี้' }
      ],
      cancelled: [
        { value: 'cancelled', label: 'ยกเลิกใบแจ้งหนี้', disabled: true }
      ]
    };
    return transitions[currentStatus] || [];
  };

  // Calculate overdue details
  const isOverdue = new Date(currentInvoice.due_date) < new Date();
  const overdueDays = isOverdue ?
    Math.ceil((new Date().getTime() - new Date(currentInvoice.due_date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
  const lateFee = overdueDays > 0 ? currentInvoice.amount * 0.1 : 0;
  const totalAmount = currentInvoice.amount + lateFee;

  // Status configurations
  const statusConfig = {
    paid: {
      title: 'ยืนยันการชำระเงิน',
      icon: <CheckCircle className="w-5 h-5 text-green-600" />,
      badgeClass: 'bg-green-100 text-green-800',
      alertType: 'success',
      alertMessage: 'การชำระเงินจะอัพเดทสถานะและบันทึกประวัติการชำระ'
    },
    overdue: {
      title: 'ตั้งค่าสถานะเกินกำหนด',
      icon: <AlertTriangle className="w-5 h-5 text-red-600" />,
      badgeClass: 'bg-red-100 text-red-800',
      alertType: 'destructive',
      alertMessage: 'การเปลี่ยนสถานะเป็น "เกินกำหนดชำระ" จะส่งการแจ้งเตือนไปยังลูกค้าโดยอัตโนมัติ'
    },
    cancelled: {
      title: 'ยกเลิกใบแจ้งหนี้',
      icon: <FileX className="w-5 h-5 text-gray-600" />,
      badgeClass: 'bg-gray-100 text-gray-800',
      alertType: 'destructive',
      alertMessage: 'การยกเลิกใบแจ้งหนี้จะมีผลถาวรและไม่สามารถเปลี่ยนแปลงได้'
    },
    pending: {
      title: 'เปลี่ยนเป็นรอดำเนินการ',
      icon: <Clock className="w-5 h-5 text-amber-600" />,
      badgeClass: 'bg-amber-100 text-amber-800',
      alertType: 'default',
      alertMessage: 'สถานะจะเปลี่ยนกลับเป็นรอดำเนินการ'
    }
  };

  const currentConfig = statusConfig[selectedStatus];

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const validateForm = () => {
    if (selectedStatus === 'paid') {
      if (!formData.paymentDate || !formData.paymentMethod) {
        return false;
      }
    }
    if (selectedStatus === 'overdue' || selectedStatus === 'cancelled') {
      if (!formData.reason) {
        return false;
      }
    }
    if (selectedStatus === 'cancelled') {
      if (confirmText.toLowerCase() !== 'cancel') {
        return false;
      }
    }
    return true;
  };

  // logStatusChange function ถูกลบออกแล้ว - ใช้ database trigger แทน

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setIsLoading(true);
    try {
      // ลบการบันทึก manual log - ให้ database trigger จัดการเอง
      // await logStatusChange(currentInvoice?.status || '', selectedStatus);

      await onConfirm(formData);

      toast.success('เปลี่ยนสถานะสำเร็จ');

      // เก็บข้อมูลฟอร์มไว้ - ไม่รีเซ็ต

    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            เปลี่ยนสถานะใบแจ้งหนี้
          </DialogTitle>
          <DialogDescription>
            เลือกสถานะใหม่สำหรับใบแจ้งหนี้ {currentInvoice.invoice_number} - กรุณาเลือกสถานะใหม่และกรอกข้อมูลที่เกี่ยวข้อง
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Information */}
          <div className="p-4 bg-gray-50 rounded-lg border">
            <h3 className="font-medium mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              ข้อมูลใบแจ้งหนี้
            </h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-600">เลขที่บิล:</span>
                <div className="font-medium">{currentInvoice.invoice_number}</div>
              </div>
              <div>
                <span className="text-gray-600">บริษัท:</span>
                <div className="font-medium">{currentInvoice.tenant?.name} (/{currentInvoice.tenant?.slug})</div>
              </div>
              <div>
                <span className="text-gray-600">จำนวนเงิน:</span>
                <div className="font-semibold text-lg">{formatCurrency(currentInvoice.amount)}</div>
              </div>
              <div>
                <span className="text-gray-600">แพ็คเกจ:</span>
                <div className="font-medium">{currentInvoice.subscription_plan}</div>
              </div>
              <div>
                <span className="text-gray-600">วันครบกำหนด:</span>
                <div className={`font-medium ${isOverdue ? 'text-red-600' : ''}`}>
                  {formatDate(currentInvoice.due_date)}
                  {isOverdue && ` (เกิน ${overdueDays} วัน)`}
                </div>
              </div>
              <div>
                <span className="text-gray-600">สถานะปัจจุบัน:</span>
                <div>{getStatusBadge(currentInvoice.status)}</div>
              </div>
            </div>

            {/* Overdue Summary */}
            {(currentInvoice.status === 'overdue' && selectedStatus === 'paid') && (
              <div className="mt-4 pt-3 border-t">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">ค่าปรับล่าช้า (10%):</span>
                    <div className="font-semibold text-red-600">{formatCurrency(lateFee)}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">ยอดรวมที่ต้องชำระ:</span>
                    <div className="font-bold text-green-600 text-lg">{formatCurrency(totalAmount)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Status Selection */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-status">เลือกสถานะใหม่ *</Label>
              <Select value={selectedStatus} onValueChange={(value: any) => setSelectedStatus(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกสถานะใหม่" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailableStatuses(currentInvoice.status).map((status) => (
                    <SelectItem
                      key={status.value}
                      value={status.value}
                      disabled={status.disabled}
                    >
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Transition Visualization */}
            <div className="flex items-center justify-center p-4 bg-white shadow-sm rounded-lg">
              <div className="flex items-center gap-4">
                {getStatusBadge(currentInvoice.status)}
                <div className="text-2xl text-gray-400">→</div>
                {getStatusBadge(selectedStatus)}
              </div>
            </div>
          </div>

          {/* Alert Message */}
          <Alert>
            <AlertDescription>
              {currentConfig.alertMessage}
            </AlertDescription>
          </Alert>

          {/* Form Fields */}
          <div className="space-y-4">
            {/* Payment Fields */}
            {selectedStatus === 'paid' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="payment-date">วันที่ชำระ *</Label>
                    <Input
                      id="payment-date"
                      type="date"
                      value={formData.paymentDate}
                      onChange={(e) => setFormData({...formData, paymentDate: e.target.value})}
                      max={new Date().toISOString().split('T')[0]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="payment-method">วิธีการชำระ *</Label>
                    <Select value={formData.paymentMethod} onValueChange={(value) => setFormData({...formData, paymentMethod: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกวิธีการชำระ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="bank_transfer">โอนเงิน</SelectItem>
                        <SelectItem value="credit_card">เครดิตการ์ด</SelectItem>
                        <SelectItem value="cash">เงินสด</SelectItem>
                        <SelectItem value="cheque">เช็ค</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {currentInvoice.status === 'overdue' && (
                  <div className="space-y-3">
                    <Label>จำนวนที่ชำระจริง *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.actualAmount}
                      onChange={(e) => setFormData({...formData, actualAmount: parseFloat(e.target.value)})}
                      placeholder="จำนวนเงินที่ชำระจริง"
                    />

                    <Label>การจัดการค่าปรับล่าช้า *</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="charge-normal"
                          value="charge"
                          checked={formData.lateFeeAction === 'charge'}
                          onChange={(e) => setFormData({...formData, lateFeeAction: e.target.value as any})}
                        />
                        <label htmlFor="charge-normal" className="text-sm">เรียกเก็บตามปกติ ({formatCurrency(lateFee)})</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="waive-fee"
                          value="waive"
                          checked={formData.lateFeeAction === 'waive'}
                          onChange={(e) => setFormData({...formData, lateFeeAction: e.target.value as any})}
                        />
                        <label htmlFor="waive-fee" className="text-sm">ยกเว้นค่าปรับ</label>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="restore-service"
                        checked={formData.restoreService}
                        onChange={(e) => setFormData({...formData, restoreService: e.target.checked})}
                      />
                      <label htmlFor="restore-service" className="text-sm">เปิดใช้บริการทันทีหลังยืนยันการชำระ</label>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="reference">หมายเลขอ้างอิง</Label>
                  <Input
                    id="reference"
                    value={formData.referenceNumber}
                    onChange={(e) => setFormData({...formData, referenceNumber: e.target.value})}
                    placeholder="TX123456789 หรือ เลขที่เอกสาร"
                  />
                </div>
              </>
            )}

            {/* Overdue Fields */}
            {selectedStatus === 'overdue' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="overdue-reason">เหตุผลการเกินกำหนด *</Label>
                  <Select value={formData.reason} onValueChange={(value) => setFormData({...formData, reason: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเหตุผล" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no_contact">ไม่มีการติดต่อจากลูกค้า</SelectItem>
                      <SelectItem value="extension_request">ลูกค้าร้องขอขยายเวลา</SelectItem>
                      <SelectItem value="financial_issues">ปัญหาทางการเงินของลูกค้า</SelectItem>
                      <SelectItem value="other">อื่นๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {/* Cancellation Fields */}
            {selectedStatus === 'cancelled' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="cancel-reason">เหตุผลการยกเลิก *</Label>
                  <Select value={formData.reason} onValueChange={(value) => setFormData({...formData, reason: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="เลือกเหตุผลการยกเลิก" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="customer_cancellation">ลูกค้าขอยกเลิกบริการ</SelectItem>
                      <SelectItem value="invoice_error">ใบแจ้งหนี้ผิดพลาด</SelectItem>
                      <SelectItem value="no_response">ลูกค้าไม่ตอบสนอง</SelectItem>
                      <SelectItem value="plan_change">เปลี่ยนแผนราคา</SelectItem>
                      <SelectItem value="other">อื่นๆ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <Label htmlFor="confirm-text">ยืนยันการยกเลิก *</Label>
                  <p className="text-sm text-red-600 mb-2">กรุณาพิมพ์ "CANCEL" เพื่อยืนยัน:</p>
                  <Input
                    id="confirm-text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="CANCEL"
                    className="bg-white"
                  />
                </div>
              </>
            )}

            {/* Notes Field */}
            <div className="space-y-2">
              <Label htmlFor="notes">หมายเหตุ{selectedStatus === 'cancelled' ? ' *' : ''}</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder={
                  selectedStatus === 'paid' ? 'รายละเอียดเพิ่มเติมเกี่ยวกับการชำระเงิน...' :
                  selectedStatus === 'cancelled' ? 'กรุณาระบุเหตุผลและรายละเอียดการยกเลิก...' :
                  'รายละเอียดเพิ่มเติม...'
                }
                rows={3}
                required={selectedStatus === 'cancelled'}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!validateForm() || isLoading}
            className={
              selectedStatus === 'paid' ? 'bg-green-600 hover:bg-green-700' :
              selectedStatus === 'cancelled' ? 'bg-red-600 hover:bg-red-700' :
              ''
            }
          >
            {isLoading ? 'กำลังบันทึก...' :
             selectedStatus === 'paid' ? 'ยืนยันการชำระ' :
             selectedStatus === 'cancelled' ? 'ยืนยันการยกเลิก' :
             'ยืนยันการเปลี่ยนสถานะ'
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StatusChangeModal;