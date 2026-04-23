import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Download,
  MoreHorizontal,
  FileText,
  Calendar,
  DollarSign,
  RefreshCw,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { InvoiceDetailModal } from './InvoiceDetailModal';
import { generateSimpleThaiPDF } from '@/lib/invoice-pdf-simple';
import { generateReceiptPDF } from '@/lib/receipt-pdf';
import StatusChangeModal from './StatusChangeModal';
import StatusLogModal from './StatusLogModal';
import { useAutoOverdue } from '@/hooks/useAutoOverdue';

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
    billing_address?: string;
    billing_email?: string;
    billing_phone?: string;
    tax_id?: string;
  };
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subscription_plan: string;
}

const InvoiceManagement = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);

  // Auto overdue detection (จะ setup หลัง fetchInvoices ถูก define)
  const { checkAndUpdateOverdue } = useAutoOverdue();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [logRefreshTrigger, setLogRefreshTrigger] = useState(0); // สำหรับกระตุ้น refresh logs

  const [invoiceForm, setInvoiceForm] = useState({
    tenant_id: '',
    amount: '',
    subscription_plan: 'starter',
    due_date: '',
    description: ''
  });

  useEffect(() => {
    fetchInvoices();
    fetchTenants();
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants (
            name,
            slug,
            billing_address,
            billing_email,
            billing_phone,
            tax_id
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedInvoices = (data || []).map((invoice: any) => ({
        ...invoice,
        tenant: Array.isArray(invoice.tenants) ? invoice.tenants[0] : invoice.tenants
      }));

      setInvoices(formattedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
      toast.error('ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ได้');
    } finally {
      setLoading(false);
    }
  }, []);

  // Manual overdue check function
  const handleManualOverdueCheck = async () => {
    try {
      await checkAndUpdateOverdue();
      // Refresh invoices after auto-check
      fetchInvoices();
      toast.success('เช็คสถานะเกินกำหนดเสร็จแล้ว');
    } catch (error) {
      toast.error('เกิดข้อผิดพลาดในการเช็คสถานะ');
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, subscription_plan')
        .order('name');

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const generateInvoiceNumber = () => {
    const year = new Date().getFullYear();
    const randomNum = Math.floor(Math.random() * 9999) + 1;
    return `INV-${year}-${randomNum.toString().padStart(4, '0')}`;
  };

  const resetForm = () => {
    setInvoiceForm({
      tenant_id: '',
      amount: '',
      subscription_plan: 'starter',
      due_date: '',
      description: ''
    });
  };

  const handleCreateInvoice = async () => {
    try {
      const selectedTenant = tenants.find(t => t.id === invoiceForm.tenant_id);
      if (!selectedTenant) {
        toast.error('กรุณาเลือกบริษัท');
        return;
      }

      const invoiceNumber = generateInvoiceNumber();

      const { error } = await supabase.from('invoices').insert({
        tenant_id: invoiceForm.tenant_id,
        invoice_number: invoiceNumber,
        amount: parseFloat(invoiceForm.amount),
        subscription_plan: invoiceForm.subscription_plan,
        due_date: invoiceForm.due_date,
        description: invoiceForm.description || `Monthly subscription - ${invoiceForm.subscription_plan}`,
        status: 'pending',
        currency: 'THB'
      });

      if (error) throw error;

      toast.success('สร้างใบแจ้งหนี้สำเร็จ');
      setShowCreateDialog(false);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast.error('ไม่สามารถสร้างใบแจ้งหนี้ได้');
    }
  };

  const handleUpdateInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          amount: parseFloat(invoiceForm.amount),
          subscription_plan: invoiceForm.subscription_plan,
          due_date: invoiceForm.due_date,
          description: invoiceForm.description,
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast.success('อัพเดทใบแจ้งหนี้สำเร็จ');
      setShowEditDialog(false);
      setSelectedInvoice(null);
      resetForm();
      fetchInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
      toast.error('ไม่สามารถอัพเดทใบแจ้งหนี้ได้');
    }
  };

  const handleDeleteInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      toast.success('ลบใบแจ้งหนี้สำเร็จ');
      setShowDeleteDialog(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('ไม่สามารถลบใบแจ้งหนี้ได้');
    }
  };

  const openStatusModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowStatusModal(true);
  };

  const openLogModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowLogModal(true);
  };

  const handleStatusConfirm = async (data: any) => {
    if (!selectedInvoice) return;

    try {
      const updateData: any = {
        status: data.newStatus,
        updated_at: new Date().toISOString()
      };

      if (data.newStatus === 'paid') {
        updateData.paid_at = data.paymentDate || new Date().toISOString();
      }

      const { error } = await supabase
        .from('invoices')
        .update(updateData)
        .eq('id', selectedInvoice.id);

      if (error) throw error;

      // เพิ่ม delay เล็กน้อยเพื่อให้ database commit ข้อมูล
      await new Promise(resolve => setTimeout(resolve, 100));

      // รีเฟรชข้อมูลใบแจ้งหนี้ทันทีหลังบันทึกสำเร็จ
      await fetchInvoices();

      // อัพเดทข้อมูลใบแจ้งหนี้ที่เลือกไว้ใน Modal
      const { data: updatedInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants (
            name,
            slug
          )
        `)
        .eq('id', selectedInvoice.id)
        .single();

      if (!fetchError && updatedInvoice) {
        const formattedInvoice: Invoice = {
          ...updatedInvoice,
          tenant: (updatedInvoice as any).tenants
        };
        setSelectedInvoice(formattedInvoice);

        // กระตุ้นการรีเฟรช StatusLogModal หลังจากอัพเดท selectedInvoice
        setLogRefreshTrigger(prev => prev + 1);
      }

      toast.success(`เปลี่ยนสถานะเป็น ${getStatusLabel(data.newStatus)} สำเร็จ`);
      setShowStatusModal(false);
      setSelectedInvoice(null);
      fetchInvoices();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('ไม่สามารถเปลี่ยนสถานะได้');
      throw error;
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      paid: {
        label: 'ชำระเรียบร้อย',
        className: 'bg-green-100 text-green-800 border-green-200 hover:bg-green-200',
        icon: () => <div className="w-3 h-3 bg-green-500 rounded-full"></div>
      },
      pending: {
        label: 'รอดำเนินการ',
        className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200',
        icon: Clock
      },
      overdue: {
        label: 'เกินกำหนดชำระ',
        className: 'bg-red-100 text-red-800 border-red-200 hover:bg-red-200 animate-pulse',
        icon: () => <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      },
      cancelled: {
        label: 'ยกเลิกใบแจ้งหนี้',
        className: 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200',
        icon: () => <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
      }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <Badge className={`flex items-center gap-1 font-medium ${badge.className}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </Badge>
    );
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      paid: 'ชำระเรียบร้อย',
      pending: 'รอดำเนินการ',
      overdue: 'เกินกำหนดชำระ',
      cancelled: 'ยกเลิกใบแจ้งหนี้'
    };
    return labels[status] || status;
  };

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise'
    };
    return labels[plan] || plan;
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

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch =
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.tenant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const openEditDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setInvoiceForm({
      tenant_id: invoice.tenant_id,
      amount: invoice.amount.toString(),
      subscription_plan: invoice.subscription_plan,
      due_date: invoice.due_date.split('T')[0],
      description: invoice.description || ''
    });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDeleteDialog(true);
  };

  const openDetailDialog = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowDetailDialog(true);
  };

  const handleGeneratePDF = async (invoice: Invoice) => {
    try {
      await generateSimpleThaiPDF(invoice);
      toast.success(`ส่งออกใบแจ้งหนี้ PDF สำเร็จ: ${invoice.invoice_number}`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('ไม่สามารถสร้าง PDF ได้ กรุณาลองใหม่');
    }
  };

  const handleGenerateReceiptPDF = async (invoice: Invoice) => {
    try {
      if (invoice.status !== 'paid') {
        toast.error('สามารถออกใบเสร็จได้เฉพาะใบแจ้งหนี้ที่ชำระแล้วเท่านั้น');
        return;
      }

      await generateReceiptPDF(invoice);
      toast.success(`ส่งออกใบเสร็จ PDF สำเร็จ: ${invoice.invoice_number}`);
    } catch (error) {
      console.error('Error generating receipt PDF:', error);
      toast.error('ไม่สามารถสร้างใบเสร็จ PDF ได้ กรุณาลองใหม่');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">จัดการใบแจ้งหนี้</h2>
          <p className="text-gray-600">สร้าง แก้ไข และจัดการใบแจ้งหนี้ของบริษัททั้งหมด</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleManualOverdueCheck}>
            <RefreshCw className="w-4 h-4 mr-2" />
            เช็คเกินกำหนด
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="w-4 h-4 mr-2" />
            สร้างใบแจ้งหนี้ใหม่
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="ค้นหาเลขที่บิล, บริษัท หรือคำอธิบาย..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="สถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="pending">รอดำเนินการ</SelectItem>
                <SelectItem value="paid">ชำระเรียบร้อย</SelectItem>
                <SelectItem value="overdue">เกินกำหนดชำระ</SelectItem>
                <SelectItem value="cancelled">ยกเลิกใบแจ้งหนี้</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>เลขที่บิล</TableHead>
                <TableHead>บริษัท</TableHead>
                <TableHead>แพ็คเกจ</TableHead>
                <TableHead>จำนวนเงิน</TableHead>
                <TableHead>สถานะ</TableHead>
                <TableHead>วันครบกำหนด</TableHead>
                <TableHead>วันที่สร้าง</TableHead>
                <TableHead className="w-20">การจัดการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.length > 0 ? (
                filteredInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{invoice.tenant?.name}</div>
                        <div className="text-sm text-gray-500">/{invoice.tenant?.slug}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getPlanLabel(invoice.subscription_plan)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(invoice.amount)}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(invoice.status)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {formatDate(invoice.due_date)}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-500">
                      {formatDate(invoice.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetailDialog(invoice)}>
                            <Eye className="w-4 h-4 mr-2" />
                            ดูรายละเอียด
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openLogModal(invoice)}>
                            <Clock className="w-4 h-4 mr-2" />
                            ประวัติการเปลี่ยนสถานะ
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleGeneratePDF(invoice)}>
                            <Download className="w-4 h-4 mr-2" />
                            ส่งออก PDF ใบแจ้งหนี้
                          </DropdownMenuItem>
                          {invoice.status === 'paid' && (
                            <DropdownMenuItem onClick={() => handleGenerateReceiptPDF(invoice)}>
                              <Download className="w-4 h-4 mr-2 text-green-600" />
                              <span className="text-green-600">ส่งออก PDF ใบเสร็จ</span>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => openEditDialog(invoice)}>
                            <Edit className="w-4 h-4 mr-2" />
                            แก้ไข
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openStatusModal(invoice)}>
                            <Edit className="w-4 h-4 mr-2" />
                            เปลี่ยนสถานะ
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => openDeleteDialog(invoice)}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            ลบ
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p className="text-gray-500">ไม่พบใบแจ้งหนี้</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>สร้างใบแจ้งหนี้ใหม่</DialogTitle>
            <DialogDescription>
              สร้างใบแจ้งหนี้สำหรับบริษัท
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tenant">บริษัท *</Label>
              <Select value={invoiceForm.tenant_id} onValueChange={(value) => setInvoiceForm({...invoiceForm, tenant_id: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="เลือกบริษัท" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((tenant) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.name} (/{tenant.slug})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">จำนวนเงิน (บาท) *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plan">แพ็คเกจ</Label>
                <Select value={invoiceForm.subscription_plan} onValueChange={(value) => setInvoiceForm({...invoiceForm, subscription_plan: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="due_date">วันครบกำหนด *</Label>
              <Input
                id="due_date"
                type="date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">คำอธิบาย</Label>
              <Textarea
                id="description"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})}
                placeholder="รายละเอียดใบแจ้งหนี้..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleCreateInvoice}>
              สร้างใบแจ้งหนี้
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Invoice Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>แก้ไขใบแจ้งหนี้</DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลใบแจ้งหนี้ {selectedInvoice?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">จำนวนเงิน (บาท) *</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  step="0.01"
                  value={invoiceForm.amount}
                  onChange={(e) => setInvoiceForm({...invoiceForm, amount: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-plan">แพ็คเกจ</Label>
                <Select value={invoiceForm.subscription_plan} onValueChange={(value) => setInvoiceForm({...invoiceForm, subscription_plan: value})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-due_date">วันครบกำหนด *</Label>
              <Input
                id="edit-due_date"
                type="date"
                value={invoiceForm.due_date}
                onChange={(e) => setInvoiceForm({...invoiceForm, due_date: e.target.value})}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">คำอธิบาย</Label>
              <Textarea
                id="edit-description"
                value={invoiceForm.description}
                onChange={(e) => setInvoiceForm({...invoiceForm, description: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleUpdateInvoice}>
              บันทึกการเปลี่ยนแปลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยืนยันการลบใบแจ้งหนี้</AlertDialogTitle>
            <AlertDialogDescription>
              คุณต้องการลบใบแจ้งหนี้ "{selectedInvoice?.invoice_number}" ใช่หรือไม่?
              การกระทำนี้ไม่สามารถยกเลิกได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvoice}
              className="bg-red-600 hover:bg-red-700"
            >
              ลบใบแจ้งหนี้
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Detail Modal */}
      <InvoiceDetailModal
        open={showDetailDialog}
        onOpenChange={setShowDetailDialog}
        invoice={selectedInvoice}
        onGeneratePDF={handleGeneratePDF}
        onGenerateReceipt={handleGenerateReceiptPDF}
      />

      {/* Status Change Modal */}
      <StatusChangeModal
        invoice={selectedInvoice}
        isOpen={showStatusModal}
        onClose={() => {
          setShowStatusModal(false);
          setSelectedInvoice(null);
        }}
        onConfirm={handleStatusConfirm}
        refreshTrigger={logRefreshTrigger}
      />

      {/* Status Log Modal */}
      <StatusLogModal
        invoice={selectedInvoice}
        isOpen={showLogModal}
        onClose={() => {
          setShowLogModal(false);
          setSelectedInvoice(null);
        }}
        refreshTrigger={logRefreshTrigger}
      />
    </div>
  );
};

export default InvoiceManagement;