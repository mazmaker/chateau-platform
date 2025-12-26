import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { SalesGuard } from '@/components/auth/PermissionGuard';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Plus,
  Search,
  Edit,
  Eye,
  Phone,
  Mail,
  MapPin,
  Calendar,
  TrendingUp,
  DollarSign,
  Building2,
  MoreHorizontal,
  Filter,
  FileText,
  Clock,
  CheckCircle,
  XCircle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';

// Lead Status for Real Estate Sales
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed' | 'lost';

interface Lead {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  unit_id?: string;
  status: LeadStatus;
  source: string;
  budget_min?: number;
  budget_max?: number;
  preferred_location?: string;
  notes: string;
  assigned_to?: string;
  next_follow_up?: string;
  created_at: string;
  updated_at: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

interface Property {
  id: string;
  name: string;
  type: string;
}

const LeadManagement = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole, userProfile } = useSimpleAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'team'>('all');

  // Dialog states
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Form state
  const [leadForm, setLeadForm] = useState({
    customer_id: '',
    property_id: '',
    status: 'new' as LeadStatus,
    source: 'website',
    budget_min: '',
    budget_max: '',
    preferred_location: '',
    notes: '',
    next_follow_up: ''
  });

  useEffect(() => {
    if (currentTenant) {
      fetchLeads();
      fetchCustomers();
      fetchProperties();
    }
  }, [currentTenant, activeTab]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('bookings') // Using bookings table as leads temporarily
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      // Filter by assigned user if viewing "my" leads
      if (activeTab === 'my' && userProfile) {
        // query = query.eq('assigned_to', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform data to lead format
      const transformedLeads = (data || []).map((item: any) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        customer_id: item.customer_id,
        property_id: item.property_id,
        unit_id: undefined,
        status: mapStatusToLead(item.status),
        source: 'website',
        budget_min: undefined,
        budget_max: item.total_amount,
        preferred_location: undefined,
        notes: item.notes || '',
        assigned_to: item.created_by,
        next_follow_up: undefined,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      setLeads(transformedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      // Generate mock data
      setLeads(generateMockLeads());
    } finally {
      setLoading(false);
    }
  };

  const mapStatusToLead = (status: string): LeadStatus => {
    const mapping: Record<string, LeadStatus> = {
      pending: 'new',
      confirmed: 'proposal',
      checked_in: 'negotiation',
      checked_out: 'closed',
      cancelled: 'lost'
    };
    return mapping[status] || 'new';
  };

  const generateMockLeads = (): Lead[] => {
    const mockLeads: Lead[] = [];
    const statuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'closed', 'lost'];
    const sources = ['website', 'facebook', 'line', 'referral', 'walk_in', 'advertising'];

    for (let i = 1; i <= 15; i++) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      mockLeads.push({
        id: `lead-${i}`,
        tenant_id: currentTenant?.id || '',
        customer_id: `cust-${i}`,
        property_id: `prop-${(i % 3) + 1}`,
        status,
        source: sources[Math.floor(Math.random() * sources.length)],
        budget_min: 2000000 + Math.floor(Math.random() * 3000000),
        budget_max: 5000000 + Math.floor(Math.random() * 5000000),
        preferred_location: 'บางนา, ลาดพร้าว, วัฒนา',
        notes: `Lead หมายเลขที่ ${i}`,
        created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      });
    }

    return mockLeads;
  };

  const fetchCustomers = async () => {
    try {
      const { data } = await supabase
        .from('customers')
        .select('id, full_name, email, phone')
        .eq('tenant_id', currentTenant?.id);

      // Transform to customer format
      const transformed = (data || []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        email: c.email,
        phone: c.phone || '-'
      }));

      setCustomers(transformed);
    } catch (error) {
      console.error('Error fetching customers:', error);
      // Generate mock customers
      setCustomers(Array.from({ length: 10 }, (_, i) => ({
        id: `cust-${i + 1}`,
        name: `ลูกค้า ${i + 1}`,
        email: `customer${i + 1}@example.com`,
        phone: `08${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`
      })));
    }
  };

  const fetchProperties = async () => {
    try {
      const { data } = await supabase
        .from('properties')
        .select('id, name, type')
        .eq('tenant_id', currentTenant?.id);

      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const handleSaveLead = async () => {
    try {
      // TODO: Implement lead creation
      setShowLeadDialog(false);
      resetLeadForm();
      fetchLeads();
    } catch (error) {
      console.error('Error saving lead:', error);
    }
  };

  const handleUpdateStatus = async (lead: Lead, newStatus: LeadStatus) => {
    try {
      // TODO: Implement status update
      setLeads(leads.map(l =>
        l.id === lead.id ? { ...l, status: newStatus } : l
      ));
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const resetLeadForm = () => {
    setLeadForm({
      customer_id: '',
      property_id: '',
      status: 'new',
      source: 'website',
      budget_min: '',
      budget_max: '',
      preferred_location: '',
      notes: '',
      next_follow_up: ''
    });
  };

  const getStatusBadge = (status: LeadStatus) => {
    const badges: Record<LeadStatus, { label: string; variant: any; icon: any }> = {
      new: { label: 'ใหม่', variant: 'default', icon: FileText },
      contacted: { label: 'ติดต่อแล้ว', variant: 'secondary', icon: Phone },
      qualified: { label: 'มีคุณสมบัติ', variant: 'secondary', icon: CheckCircle },
      proposal: { label: 'เสนอขาย', variant: 'default', icon: FileText },
      negotiation: { label: 'เจรจา', variant: 'default', icon: TrendingUp },
      closed: { label: 'ปิดการขาย', variant: 'default', icon: CheckCircle },
      lost: { label: 'สูญเสีย', variant: 'destructive', icon: XCircle }
    };
    const badge = badges[status];
    const Icon = badge.icon;
    return (
      <Badge variant={badge.variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {badge.label}
      </Badge>
    );
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      website: 'Website',
      facebook: 'Facebook',
      line: 'LINE',
      referral: 'แนะนำ',
      walk_in: 'Walk-in',
      advertising: 'โฆษณา'
    };
    return labels[source] || source;
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '-';
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property?.name || '-';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredLeads = leads.filter(lead => {
    const customerName = getCustomerName(lead.customer_id).toLowerCase();
    const propertyName = getPropertyName(lead.property_id).toLowerCase();
    const matchesSearch = customerName.includes(searchQuery.toLowerCase()) ||
                         propertyName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Calculate stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified' || l.status === 'proposal' || l.status === 'negotiation').length;
  const closedLeads = leads.filter(l => l.status === 'closed').length;
  const lostLeads = leads.filter(l => l.status === 'lost').length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  return (
    <SalesGuard>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">ระบบติดตามลูกค้า (Leads)</h1>
            <p className="text-muted-foreground">
              จัดการลูกค้าและติดตามสถานะการขายอสังหาริมทรัพย์
            </p>
          </div>
          <Button onClick={() => {
            resetLeadForm();
            setShowLeadDialog(true);
          }}>
            <Plus className="w-4 h-4 mr-2" />
            เพิ่ม Lead ใหม่
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lead ทั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalLeads}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lead ใหม่
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{newLeads}</div>
              <p className="text-xs text-muted-foreground">ต้องติดต่อ</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                กำลังดำเนินการ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{qualifiedLeads}</div>
              <p className="text-xs text-muted-foreground">Qualified + Proposal + Negotiation</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ปิดการขาย
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{closedLeads}</div>
              <p className="text-xs text-muted-foreground">อัตราแปลง {conversionRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                สูญเสีย
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{lostLeads}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
                <TabsList>
                  <TabsTrigger value="all">Leads ทั้งหมด</TabsTrigger>
                  {userRole === 'admin' && (
                    <TabsTrigger value="my">Leads ของฉัน</TabsTrigger>
                  )}
                  {userRole === 'admin' && (
                    <TabsTrigger value="team">Leads ทีม</TabsTrigger>
                  )}
                </TabsList>
              </Tabs>

              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาชื่อลูกค้า หรือโครงการ..."
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
                    <SelectItem value="new">ใหม่</SelectItem>
                    <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
                    <SelectItem value="qualified">มีคุณสมบัติ</SelectItem>
                    <SelectItem value="proposal">เสนอขาย</SelectItem>
                    <SelectItem value="negotiation">เจรจา</SelectItem>
                    <SelectItem value="closed">ปิดการขาย</SelectItem>
                    <SelectItem value="lost">สูญเสีย</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="แหล่งที่มา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกแหล่ง</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="line">LINE</SelectItem>
                    <SelectItem value="referral">แนะนำ</SelectItem>
                    <SelectItem value="walk_in">Walk-in</SelectItem>
                    <SelectItem value="advertising">โฆษณา</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Leads Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อลูกค้า</TableHead>
                  <TableHead>โครงการที่สนใจ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>งบประมาณ</TableHead>
                  <TableHead>แหล่งที่มา</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      ไม่พบ Leads
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedLead(lead);
                        setShowDetailDialog(true);
                      }}
                    >
                      <TableCell className="font-medium">
                        {getCustomerName(lead.customer_id)}
                      </TableCell>
                      <TableCell>{getPropertyName(lead.property_id)}</TableCell>
                      <TableCell>{getStatusBadge(lead.status)}</TableCell>
                      <TableCell>
                        {lead.budget_min || lead.budget_max ? (
                          <div className="text-sm">
                            {lead.budget_min ? formatCurrency(lead.budget_min) : '-'}
                            {lead.budget_max && lead.budget_min && ' - '}
                            {lead.budget_max ? formatCurrency(lead.budget_max) : ''}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getSourceLabel(lead.source)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(lead.created_at).toLocaleDateString('th-TH')}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)}>
                              <Eye className="w-4 h-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="w-4 h-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Phone className="w-4 h-4 mr-2" />
                              ติดต่อลูกค้า
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Calendar className="w-4 h-4 mr-2" />
                              นัดหมาย
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Lead Dialog */}
        <Dialog open={showLeadDialog} onOpenChange={setShowLeadDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLead ? 'แก้ไข Lead' : 'เพิ่ม Lead ใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลลูกค้าและรายละเอียด
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer">ลูกค้า *</Label>
                  <Select>
                    <SelectTrigger id="customer">
                      <SelectValue placeholder="เลือกลูกค้า" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">โครงการที่สนใจ *</Label>
                  <Select>
                    <SelectTrigger id="property">
                      <SelectValue placeholder="เลือกโครงการ" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(property => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">สถานะ</Label>
                  <Select
                    value={leadForm.status}
                    onValueChange={(value: any) => setLeadForm({ ...leadForm, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">ใหม่</SelectItem>
                      <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
                      <SelectItem value="qualified">มีคุณสมบัติ</SelectItem>
                      <SelectItem value="proposal">เสนอขาย</SelectItem>
                      <SelectItem value="negotiation">เจรจา</SelectItem>
                      <SelectItem value="closed">ปิดการขาย</SelectItem>
                      <SelectItem value="lost">สูญเสีย</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">แหล่งที่มา</Label>
                  <Select
                    value={leadForm.source}
                    onValueChange={(value) => setLeadForm({ ...leadForm, source: value })}
                  >
                    <SelectTrigger id="source">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="line">LINE</SelectItem>
                      <SelectItem value="referral">แนะนำ</SelectItem>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                      <SelectItem value="advertising">โฆษณา</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="follow_up">วันนัดติดตาม</Label>
                  <Input id="follow_up" type="date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="budget_min">งบประมาณต่ำสุด</Label>
                  <Input
                    id="budget_min"
                    type="number"
                    value={leadForm.budget_min}
                    onChange={(e) => setLeadForm({ ...leadForm, budget_min: e.target.value })}
                    placeholder="2,000,000"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="budget_max">งบประมาณสูงสุด</Label>
                  <Input
                    id="budget_max"
                    type="number"
                    value={leadForm.budget_max}
                    onChange={(e) => setLeadForm({ ...leadForm, budget_max: e.target.value })}
                    placeholder="10,000,000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">พื้นที่ที่สนใจ</Label>
                <Input
                  id="location"
                  value={leadForm.preferred_location}
                  onChange={(e) => setLeadForm({ ...leadForm, preferred_location: e.target.value })}
                  placeholder="เช่น บางนา, ลาดพร้าว"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">บันทึก</Label>
                <Textarea
                  id="notes"
                  value={leadForm.notes}
                  onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
                  placeholder="ข้อมูลเพิ่มเติมเกี่ยวกับลูกค้า..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowLeadDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveLead}>
                {editingLead ? 'บันทึก' : 'สร้าง Lead'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Lead Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>รายละเอียด Lead</DialogTitle>
            </DialogHeader>
            {selectedLead && (
              <div className="space-y-6">
                {/* Customer Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">ข้อมูลลูกค้า</h3>
                    <div className="space-y-1">
                      <p className="font-medium">{getCustomerName(selectedLead.customer_id)}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3 h-3" />
                        {customers.find(c => c.id === selectedLead.customer_id)?.phone || '-'}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3 h-3" />
                        {customers.find(c => c.id === selectedLead.customer_id)?.email || '-'}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">สถานะ</h3>
                    {getStatusBadge(selectedLead.status)}
                  </div>
                </div>

                {/* Property Interest */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">โครงการที่สนใจ</h3>
                  <p className="font-medium">{getPropertyName(selectedLead.property_id)}</p>
                </div>

                {/* Budget */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">งบประมาณ</h3>
                  {selectedLead.budget_min || selectedLead.budget_max ? (
                    <p className="font-medium">
                      {selectedLead.budget_min ? formatCurrency(selectedLead.budget_min) : '-'}
                      {selectedLead.budget_max && selectedLead.budget_min && ' - '}
                      {selectedLead.budget_max ? formatCurrency(selectedLead.budget_max) : ''}
                    </p>
                  ) : '-'}
                </div>

                {/* Preferred Location */}
                {selectedLead.preferred_location && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">พื้นที่ที่สนใจ</h3>
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <p>{selectedLead.preferred_location}</p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedLead.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-2">บันทึก</h3>
                    <p className="text-sm bg-muted p-3 rounded-lg">{selectedLead.notes}</p>
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Timeline</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>สร้างเมื่อ {new Date(selectedLead.created_at).toLocaleDateString('th-TH')}</span>
                    </div>
                    {selectedLead.next_follow_up && (
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-orange-500" />
                        <span>ติดตามครั้งต่อไป {new Date(selectedLead.next_follow_up).toLocaleDateString('th-TH')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button className="flex-1">
                    <Phone className="w-4 h-4 mr-2" />
                    โทรติดต่อ
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Mail className="w-4 h-4 mr-2" />
                    ส่งอีเมล
                  </Button>
                  <Button variant="outline" className="flex-1">
                    <Edit className="w-4 h-4 mr-2" />
                    แก้ไขสถานะ
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </SalesGuard>
  );
};

export default LeadManagement;
