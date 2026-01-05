import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  Save,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import type { PaymentTransaction, PaymentSummary, PaymentFormData } from "@/types/payment";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadName: string;
}

const PaymentModal = ({ isOpen, onClose, leadId, leadName }: PaymentModalProps) => {
  const { toast } = useToast();
  const { currentTenant } = useSimpleAuth();

  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingId, setViewingId] = useState<string | null>(null);

  const [formData, setFormData] = useState<PaymentFormData>({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    notes: "",
  });

  const [editFormData, setEditFormData] = useState<PaymentFormData>({
    payment_date: "",
    amount: "",
    notes: "",
  });

  // Load payment summary and transactions
  const loadPaymentData = async () => {
    if (!leadId || !currentTenant) return;

    setLoading(true);
    try {
      // Load summary
      const { data: summaryData, error: summaryError } = await supabase
        .rpc("get_lead_payment_summary", { p_lead_id: leadId });

      if (summaryError) throw summaryError;
      if (summaryData && summaryData.length > 0) {
        setSummary(summaryData[0]);
      }

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("payment_transactions")
        .select("*")
        .eq("lead_id", leadId)
        .eq("tenant_id", currentTenant.id)
        .order("payment_date", { ascending: false });

      if (transactionsError) throw transactionsError;
      setTransactions(transactionsData || []);
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถโหลดข้อมูลการชำระเงินได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && leadId) {
      loadPaymentData();
    }
  }, [isOpen, leadId]);

  // Reset form
  const resetForm = () => {
    setFormData({
      payment_date: new Date().toISOString().split("T")[0],
      amount: "",
      notes: "",
    });
  };

  // Add new payment
  const handleAddPayment = async () => {
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast({
        title: "กรุณากรอกจำนวนเงิน",
        description: "จำนวนเงินต้องมากกว่า 0",
        variant: "destructive",
      });
      return;
    }

    if (!currentTenant) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: "ไม่พบข้อมูลบริษัท",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("payment_transactions").insert({
        lead_id: leadId,
        tenant_id: currentTenant.id,
        payment_date: formData.payment_date,
        amount: parseFloat(formData.amount),
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "บันทึกสำเร็จ",
        description: "บันทึกข้อมูลการชำระเงินเรียบร้อยแล้ว",
      });

      resetForm();
      loadPaymentData();
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถบันทึกข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Update payment
  const handleUpdatePayment = async (id: string) => {
    if (!editFormData.amount || parseFloat(editFormData.amount) <= 0) {
      toast({
        title: "กรุณากรอกจำนวนเงิน",
        description: "จำนวนเงินต้องมากกว่า 0",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("payment_transactions")
        .update({
          payment_date: editFormData.payment_date,
          amount: parseFloat(editFormData.amount),
          notes: editFormData.notes || null,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "อัปเดตสำเร็จ",
        description: "อัปเดตข้อมูลการชำระเงินเรียบร้อยแล้ว",
      });

      setEditingId(null);
      loadPaymentData();
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถอัปเดตข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Delete payment
  const handleDeletePayment = async (id: string) => {
    if (!confirm("คุณต้องการลบรายการนี้ใช่หรือไม่?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("payment_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "ลบสำเร็จ",
        description: "ลบข้อมูลการชำระเงินเรียบร้อยแล้ว",
      });

      loadPaymentData();
    } catch (error: any) {
      toast({
        title: "เกิดข้อผิดพลาด",
        description: error.message || "ไม่สามารถลบข้อมูลได้",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Start editing
  const startEditing = (transaction: PaymentTransaction) => {
    setEditingId(transaction.id);
    setEditFormData({
      payment_date: transaction.payment_date,
      amount: transaction.amount.toString(),
      notes: transaction.notes || "",
    });
    setViewingId(null);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("th-TH", {
      style: "currency",
      currency: "THB",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("th-TH", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold gradient-primary-text">
            การโอนเงิน - {leadName}
          </DialogTitle>
          {summary?.property_name && summary?.unit_number && (
            <p className="text-sm text-muted-foreground">
              {summary.property_name} - ยูนิต {summary.unit_number}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-500 rounded-lg">
                    <DollarSign className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-blue-600 font-medium">ยอดขาย</p>
                    <p className="text-xl font-bold text-blue-900">
                      {formatCurrency(summary?.total_amount || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-500 rounded-lg">
                    <TrendingUp className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-green-600 font-medium">ยอดโอน</p>
                    <p className="text-xl font-bold text-green-900">
                      {formatCurrency(summary?.total_paid || 0)}
                    </p>
                    <p className="text-xs text-green-600">
                      {summary?.payment_count || 0} รายการ
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-500 rounded-lg">
                    <AlertCircle className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <p className="text-xs text-orange-600 font-medium">ยอดค้างชำระ</p>
                    <p className="text-xl font-bold text-orange-900">
                      {formatCurrency(summary?.total_outstanding || 0)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Add Payment Form */}
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5" />
                เพิ่มการชำระเงินใหม่
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="payment_date">วันที่ชำระเงิน</Label>
                  <Input
                    id="payment_date"
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) =>
                      setFormData({ ...formData, payment_date: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="amount">จำนวนเงิน (บาท)</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="notes">หมายเหตุ</Label>
                  <Input
                    id="notes"
                    placeholder="ระบุหมายเหตุ (ถ้ามี)"
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleAddPayment}
                  disabled={loading || !formData.amount}
                  className="bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:opacity-90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  บันทึกการชำระเงิน
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment History Table */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-4">ประวัติการโอนเงิน</h3>
              {loading && transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">กำลังโหลดข้อมูล...</p>
              ) : transactions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">ยังไม่มีรายการชำระเงิน</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-[#676AF1]/10 to-[#8B5CF6]/10">
                        <TableHead className="font-semibold">วันที่ชำระ</TableHead>
                        <TableHead className="font-semibold text-right">จำนวนเงิน</TableHead>
                        <TableHead className="font-semibold">หมายเหตุ</TableHead>
                        <TableHead className="font-semibold text-center">จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id} className="hover:bg-muted/50">
                          {editingId === transaction.id ? (
                            // Edit Mode
                            <>
                              <TableCell>
                                <Input
                                  type="date"
                                  value={editFormData.payment_date}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      payment_date: e.target.value,
                                    })
                                  }
                                  disabled={loading}
                                  className="w-40"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editFormData.amount}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      amount: e.target.value,
                                    })
                                  }
                                  disabled={loading}
                                  className="w-32 text-right"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={editFormData.notes}
                                  onChange={(e) =>
                                    setEditFormData({
                                      ...editFormData,
                                      notes: e.target.value,
                                    })
                                  }
                                  disabled={loading}
                                  placeholder="หมายเหตุ"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="default"
                                    onClick={() => handleUpdatePayment(transaction.id)}
                                    disabled={loading}
                                    className="bg-green-600 hover:bg-green-700"
                                  >
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingId(null)}
                                    disabled={loading}
                                  >
                                    <X className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          ) : (
                            // View Mode
                            <>
                              <TableCell className="font-medium">
                                {formatDate(transaction.payment_date)}
                              </TableCell>
                              <TableCell className="text-right font-semibold text-green-600">
                                {formatCurrency(transaction.amount)}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {viewingId === transaction.id ? (
                                  <div className="p-2 bg-muted rounded">
                                    {transaction.notes || "-"}
                                  </div>
                                ) : (
                                  <span className="line-clamp-1">
                                    {transaction.notes || "-"}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex justify-center gap-2">
                                  {transaction.notes && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() =>
                                        setViewingId(
                                          viewingId === transaction.id ? null : transaction.id
                                        )
                                      }
                                      title="ดูรายละเอียด"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditing(transaction)}
                                    disabled={loading}
                                    title="แก้ไข"
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeletePayment(transaction.id)}
                                    disabled={loading}
                                    title="ลบ"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentModal;
