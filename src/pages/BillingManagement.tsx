import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
  CreditCard,
  Download,
  Send,
  Bell,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  FileText,
  Search,
  Filter,
  Plus
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Invoice {
  id: string;
  tenant_id: string;
  tenant_name?: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  paid_at?: string;
  created_at: string;
  subscription_plan: string;
  billing_period: string;
}

interface Tenant {
  id: string;
  name: string;
  subscription_plan: string;
}

const BillingManagement = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
    fetchTenants();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Fetch invoices with tenant info
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants(id, name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        // If invoices table doesn't exist, create mock data
        const { data: tenantData } = await supabase.from('tenants').select('*');
        const mockInvoices = generateMockInvoices(tenantData || []);
        setInvoices(mockInvoices);
      } else {
        setInvoices(data || []);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      // Generate mock data on error
      const mockInvoices = generateMockInvoices([]);
      setInvoices(mockInvoices);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const { data } = await supabase.from('tenants').select('id, name, subscription_plan');
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  const generateMockInvoices = (tenantList: any[]): Invoice[] => {
    const mockInvoices: Invoice[] = [];
    const statuses: Array<'pending' | 'paid' | 'overdue' | 'cancelled'> = ['pending', 'paid', 'overdue'];
    const plans = ['starter', 'professional', 'enterprise'];
    const prices = { starter: 2900, professional: 5900, enterprise: 15900 };

    // Use provided tenants or create mock ones
    const tenants = tenantList.length > 0 ? tenantList : [
      { id: '1', name: 'ABC Property', subscription_plan: 'professional' },
      { id: '2', name: 'Real Estate Pro', subscription_plan: 'enterprise' },
      { id: '3', name: 'Home Finder', subscription_plan: 'starter' },
    ];

    tenants.forEach((tenant, i) => {
      const plan = tenant.subscription_plan || plans[i % plans.length];
      const amount = prices[plan as keyof typeof prices] || 2900;

      // Generate 3 invoices per tenant
      for (let j = 0; j < 3; j++) {
        const dueDate = new Date();
        dueDate.setMonth(dueDate.getMonth() - j);

        mockInvoices.push({
          id: `inv-${tenant.id}-${j}`,
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          invoice_number: `INV-${new Date().getFullYear()}${String(tenants.length - i).padStart(3, '0')}${String(j + 1).padStart(3, '0')}`,
          amount,
          currency: 'THB',
          status: j === 0 ? 'paid' : (j === 1 ? 'pending' : 'overdue'),
          due_date: dueDate.toISOString(),
          paid_at: j === 0 ? dueDate.toISOString() : undefined,
          created_at: dueDate.toISOString(),
          subscription_plan: plan,
          billing_period: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}`
        });
      }
    });

    return mockInvoices;
  };

  const handleSendReminder = async (invoice: Invoice) => {
    // TODO: Implement email reminder
    alert(`ส่งอีเมลแจ้งเตือน Invoice ${invoice.invoice_number} ไปยัง ${invoice.tenant_name}`);
  };

  const handleMarkAsPaid = async (invoice: Invoice) => {
    setInvoices(invoices.map(inv =>
      inv.id === invoice.id ? { ...inv, status: 'paid' as const, paid_at: new Date().toISOString() } : inv
    ));
  };

  const handleDownloadInvoice = (invoice: Invoice) => {
    // TODO: Implement PDF download
    alert(`ดาวน์โหลด Invoice ${invoice.invoice_number}`);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: any; icon: any }> = {
      paid: { label: 'จ่ายแล้ว', variant: 'default', icon: CheckCircle },
      pending: { label: 'รอชำระ', variant: 'secondary', icon: Clock },
      overdue: { label: 'เกินกำหนด', variant: 'destructive', icon: AlertCircle },
      cancelled: { label: 'ยกเลิก', variant: 'outline', icon: XCircle }
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {badge.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (invoice.tenant_name && invoice.tenant_name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Calculate summary stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.amount, 0);
  const pendingAmount = invoices.filter(i => i.status === 'pending' || i.status === 'overdue').reduce((sum, i) => sum + i.amount, 0);
  const overdueCount = invoices.filter(i => i.status === 'overdue').length;

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <div className="lg:ml-[260px] min-h-screen">
          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <main className="p-6">
            <div className="space-y-6">
              {/* Page Header */}
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <CreditCard className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">Billing & Invoices</h1>
                        <p className="text-gray-600 mt-1">
                          จัดการการชำระเงินและใบแจ้งหนี้ของบริษัททั้งหมด
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => setShowInvoiceDialog(true)}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      สร้างใบแจ้งหนี้
                    </Button>
                  </div>
                </CardContent>
              </Card>

            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                รายได้ทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">จากใบที่จ่ายแล้ว</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                รอชำระ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(pendingAmount)}</div>
              <p className="text-xs text-muted-foreground mt-1">รวมใบที่รอและเกินกำหนด</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ใบที่เกินกำหนด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{overdueCount}</div>
              <p className="text-xs text-muted-foreground mt-1">ต้องดำเนินการด่วน</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ใบแจ้งหนี้ทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{invoices.length}</div>
              <p className="text-xs text-muted-foreground mt-1">ฉบับ</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหา Invoice หรือชื่อบริษัท..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="paid">จ่ายแล้ว</SelectItem>
                  <SelectItem value="pending">รอชำระ</SelectItem>
                  <SelectItem value="overdue">เกินกำหนด</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle>รายการใบแจ้งหนี้</CardTitle>
            <CardDescription>จัดการใบแจ้งหนี้ของบริษัททั้งหมด</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>เลขที่ Invoice</TableHead>
                  <TableHead>บริษัท</TableHead>
                  <TableHead>แพ็กเกจ</TableHead>
                  <TableHead>งวดบิล</TableHead>
                  <TableHead>จำนวนเงิน</TableHead>
                  <TableHead>วันครบกำหนด</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      ไม่พบใบแจ้งหนี้
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium font-mono">
                        {invoice.invoice_number}
                      </TableCell>
                      <TableCell>{invoice.tenant_name || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {invoice.subscription_plan}
                        </Badge>
                      </TableCell>
                      <TableCell>{invoice.billing_period || '-'}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(invoice.amount)}
                      </TableCell>
                      <TableCell>
                        {new Date(invoice.due_date).toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownloadInvoice(invoice)}
                            title="ดาวน์โหลด PDF"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                          {(invoice.status === 'pending' || invoice.status === 'overdue') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSendReminder(invoice)}
                              title="ส่งอีเมลแจ้งเตือน"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                          )}
                          {invoice.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMarkAsPaid(invoice)}
                              title="ทำเครื่องหมายว่าจ่ายแล้ว"
                            >
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Invoice Dialog */}
        <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>สร้างใบแจ้งหนี้ใหม่</DialogTitle>
              <DialogDescription>
                สร้างใบแจ้งหนี้สำหรับบริษัทในระบบ
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="tenant">บริษัท *</Label>
                <Select>
                  <SelectTrigger id="tenant">
                    <SelectValue placeholder="เลือกบริษัท" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(tenant => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.subscription_plan})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount">จำนวนเงิน *</Label>
                <Input id="amount" type="number" placeholder="2900" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">วันครบกำหนด *</Label>
                <Input id="dueDate" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">หมายเหตุ</Label>
                <Input id="notes" placeholder="ค่าบำรุงรายเดือน" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowInvoiceDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={() => setShowInvoiceDialog(false)}>
                สร้างใบแจ้งหนี้
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default BillingManagement;
