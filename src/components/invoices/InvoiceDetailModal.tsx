import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Download,
  Calendar,
  Building2,
  CreditCard,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Receipt,
  User,
  Bot
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

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

interface PaymentLog {
  id: string;
  old_status: string;
  new_status: string;
  changed_by: string;
  change_type: string;
  reason: string | null;
  payment_info: any;
  created_at: string;
}

interface InvoiceDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Invoice | null;
  onGeneratePDF: (invoice: Invoice) => Promise<void>;
  onGenerateReceipt?: (invoice: Invoice) => Promise<void>;
}

export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({
  open,
  onOpenChange,
  invoice,
  onGeneratePDF,
  onGenerateReceipt
}) => {
  const [paymentLogs, setPaymentLogs] = useState<PaymentLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch payment logs when modal opens and invoice is paid
  useEffect(() => {
    if (open && invoice?.id && invoice.status === 'paid') {
      fetchPaymentLogs();
    }
  }, [open, invoice?.id, invoice?.status]);

  const fetchPaymentLogs = async () => {
    if (!invoice?.id) return;

    setLoadingLogs(true);
    try {
      const { data, error } = await supabase
        .from('invoice_status_logs')
        .select('*')
        .eq('invoice_id', invoice.id)
        .eq('new_status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPaymentLogs(data || []);
    } catch (error) {
      console.error('Error fetching payment logs:', error);
      setPaymentLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!invoice) return null;

  const getStatusConfig = (status: string) => {
    const configs = {
      paid: {
        label: 'ชำระแล้ว',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle2
      },
      pending: {
        label: 'รอชำระ',
        className: 'bg-chateau-100 text-chateau-700',
        icon: Clock
      },
      overdue: {
        label: 'เกินกำหนด',
        className: 'bg-red-100 text-red-800',
        icon: AlertCircle
      },
      cancelled: {
        label: 'ยกเลิก',
        className: 'bg-gray-100 text-gray-800',
        icon: XCircle
      }
    };
    return configs[status as keyof typeof configs] || configs.pending;
  };

  const getPlanName = (plan: string) => {
    const plans: Record<string, string> = {
      starter: 'Starter Plan',
      professional: 'Professional Plan',
      enterprise: 'Enterprise Plan'
    };
    return plans[plan] || plan;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const statusConfig = getStatusConfig(invoice.status);
  const StatusIcon = statusConfig.icon;

  const daysUntilDue = Math.ceil(
    (new Date(invoice.due_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="p-2 bg-white shadow-sm rounded-lg">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">รายละเอียดใบแจ้งหนี้</h3>
              <p className="text-sm text-gray-500 font-normal">{invoice.invoice_number}</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and Actions */}
          <div className="flex items-center justify-between">
            <Badge className={`${statusConfig.className} px-3 py-1 flex items-center gap-2`}>
              <StatusIcon className="w-4 h-4" />
              {statusConfig.label}
            </Badge>

            <div className="flex gap-2">
              <Button
                onClick={() => onGeneratePDF(invoice)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                ใบแจ้งหนี้ PDF
              </Button>

              {invoice.status === 'paid' && onGenerateReceipt && (
                <Button
                  onClick={() => onGenerateReceipt(invoice)}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  <Receipt className="w-4 h-4" />
                  ใบเสร็จ PDF
                </Button>
              )}
            </div>
          </div>

          {/* Invoice Overview */}
          <div className="bg-white border border-gray-200 shadow-sm p-6 rounded-lg border">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-gray-600 mb-1">จำนวนเงิน</div>
                <div className="text-3xl font-bold text-blue-600">
                  {formatCurrency(invoice.amount)}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {getPlanName(invoice.subscription_plan)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">กำหนดชำระ</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatDate(invoice.due_date)}
                </div>
                <div className={`text-sm mt-1 ${
                  daysUntilDue < 0
                    ? 'text-red-600'
                    : daysUntilDue <= 3
                    ? 'text-chateau'
                    : 'text-green-600'
                }`}>
                  {daysUntilDue < 0
                    ? `เกินกำหนด ${Math.abs(daysUntilDue)} วัน`
                    : daysUntilDue === 0
                    ? 'ครบกำหนดวันนี้'
                    : `เหลืออีก ${daysUntilDue} วัน`
                  }
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              ข้อมูลลูกค้า
            </h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">ชื่อบริษัท</div>
                  <div className="font-medium">{invoice.tenant?.name || 'ไม่ระบุ'}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Slug</div>
                  <div className="font-medium font-mono text-gray-700">
                    {invoice.tenant?.slug || 'ไม่ระบุ'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Invoice Details */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-gray-600" />
              รายละเอียดใบแจ้งหนี้
            </h4>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">หมายเลขใบแจ้งหนี้</div>
                  <div className="font-mono text-lg font-semibold">
                    {invoice.invoice_number}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">แผนการใช้งาน</div>
                  <div className="font-medium">{getPlanName(invoice.subscription_plan)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-600">วันที่ออกใบแจ้งหนี้</div>
                  <div className="font-medium">{formatDate(invoice.created_at)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">สกุลเงิน</div>
                  <div className="font-medium">{invoice.currency}</div>
                </div>
              </div>

              {invoice.paid_at && (
                <div>
                  <div className="text-sm text-gray-600">วันที่ชำระเงิน</div>
                  <div className="font-medium text-green-600">
                    {formatDate(invoice.paid_at)}
                  </div>
                </div>
              )}

              {invoice.description && (
                <div>
                  <div className="text-sm text-gray-600">รายละเอียดเพิ่มเติม</div>
                  <div className="font-medium bg-white p-3 rounded border">
                    {invoice.description}
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Payment Summary */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              สรุปการชำระเงิน
            </h4>
            <div className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-600">ยอดรวม</span>
                <span className="text-xl font-bold text-gray-900">
                  {formatCurrency(invoice.amount)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-500">รวม VAT 7%</span>
                <span className="text-gray-500">
                  (VAT: {formatCurrency(invoice.amount * 0.07 / 1.07)})
                </span>
              </div>
            </div>

            {/* Payment Details for Paid Invoices */}
            {invoice.status === 'paid' && (
              <div className="mt-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h5 className="font-semibold text-green-800">ข้อมูลการชำระเงิน</h5>
                  </div>

                  {loadingLogs ? (
                    <div className="text-center py-4">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600 mx-auto"></div>
                      <div className="text-sm text-gray-500 mt-2">กำลังโหลดข้อมูลการชำระ...</div>
                    </div>
                  ) : paymentLogs.length > 0 ? (
                    <div className="space-y-3">
                      {paymentLogs.map((log) => (
                        <div key={log.id} className="bg-white border border-green-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              {log.change_type === 'manual' ? (
                                <User className="w-4 h-4 text-green-600" />
                              ) : (
                                <Bot className="w-4 h-4 text-blue-600" />
                              )}
                              <span className="text-sm font-medium">
                                {log.change_type === 'manual' ? 'ชำระด้วยตนเอง' : 'ชำระอัตโนมัติ'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(log.created_at).toLocaleString('th-TH')}
                            </span>
                          </div>

                          {log.payment_info && (
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {log.payment_info.method && (
                                <div>
                                  <span className="text-gray-500">วิธีการชำระ: </span>
                                  <span className="font-medium">
                                    {log.payment_info.method === 'bank_transfer' ? 'โอนเงิน' :
                                     log.payment_info.method === 'credit_card' ? 'เครดิตการ์ด' :
                                     log.payment_info.method === 'cash' ? 'เงินสด' :
                                     log.payment_info.method}
                                  </span>
                                </div>
                              )}
                              {log.payment_info.reference && (
                                <div>
                                  <span className="text-gray-500">หมายเลขอ้างอิง: </span>
                                  <span className="font-mono text-xs">{log.payment_info.reference}</span>
                                </div>
                              )}
                              {log.payment_info.amount && (
                                <div>
                                  <span className="text-gray-500">จำนวนที่ชำระ: </span>
                                  <span className="font-medium text-green-600">
                                    {formatCurrency(log.payment_info.amount)}
                                  </span>
                                </div>
                              )}
                              {log.payment_info.date && (
                                <div>
                                  <span className="text-gray-500">วันที่ชำระ: </span>
                                  <span className="font-medium">{formatDate(log.payment_info.date)}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-600 mt-2">
                            <span>ชำระโดย: </span>
                            <span className="font-medium">{log.changed_by}</span>
                            {log.reason && (
                              <>
                                <span className="mx-2">•</span>
                                <span>{log.reason}</span>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">
                      ไม่พบข้อมูลการชำระเงิน
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};