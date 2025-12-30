import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { SalesGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import AddLeadModal from '@/components/leads/AddLeadModal';
import EditLeadModal from '@/components/leads/EditLeadModal';
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
  XCircle,
  Trash2,
  AlertTriangle
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

interface CustomerPreferences {
  first_name?: string;
  last_name?: string;
  gender?: string;
  age?: number;
  profile_image?: string;
  occupation?: string;
  marital_status?: string;
  monthly_income?: number;
  monthly_debt?: number;
  family_members?: number;
  education?: string;
  workplace?: string;
  address?: {
    province?: string;
    district?: string;
    sub_district?: string;
    postal_code?: string;
  };
  news_source?: string;
  purchase_purpose?: string;
  consent_given?: boolean;
  signature?: string;
  consent_date?: string;
}

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  preferences?: CustomerPreferences;
}

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
}

const LeadManagement = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole, userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'team'>('all');

  // Dialog states
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      fetchUnits();
    }
  }, [currentTenant, activeTab]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      // Filter by assigned user if viewing "my" leads
      if (activeTab === 'my' && userProfile) {
        query = query.eq('assigned_to', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Map leads data to the expected format
      const mappedLeads = (data || []).map((item: any) => ({
        id: item.id,
        tenant_id: item.tenant_id,
        customer_id: item.customer_id,
        property_id: item.property_id,
        unit_id: item.unit_id,
        status: item.status || 'new',
        source: item.source || 'website',
        budget_min: item.estimated_value,
        budget_max: item.estimated_value,
        preferred_location: undefined,
        notes: item.notes || '',
        assigned_to: item.assigned_to,
        next_follow_up: item.next_follow_up,
        created_at: item.created_at,
        updated_at: item.updated_at
      }));

      setLeads(mappedLeads);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
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
        .select('id, full_name, email, phone, preferences')
        .eq('tenant_id', currentTenant?.id);

      // Transform to customer format
      const transformed = (data || []).map((c: any) => ({
        id: c.id,
        name: c.full_name,
        email: c.email,
        phone: c.phone || '-',
        preferences: c.preferences || {}
      }));

      setCustomers(transformed);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
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

  const fetchUnits = async () => {
    try {
      const { data } = await supabase
        .from('units')
        .select('id, unit_number, project_id')
        .order('unit_number');

      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
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
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus })
        .eq('id', lead.id);

      if (error) throw error;

      setLeads(leads.map(l =>
        l.id === lead.id ? { ...l, status: newStatus } : l
      ));
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  const handleDeleteLead = async () => {
    if (!leadToDelete) return;

    setDeleteLoading(true);
    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadToDelete.id);

      if (error) throw error;

      setLeads(leads.filter(l => l.id !== leadToDelete.id));
      setShowDeleteDialog(false);
      setLeadToDelete(null);
    } catch (error) {
      console.error('Error deleting lead:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleEditLead = async () => {
    if (!editingLead) return;

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          status: editingLead.status,
          notes: editingLead.notes,
          next_follow_up: editingLead.next_follow_up || null,
        })
        .eq('id', editingLead.id);

      if (error) throw error;

      setLeads(leads.map(l =>
        l.id === editingLead.id ? editingLead : l
      ));
      setShowEditDialog(false);
      setEditingLead(null);
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  const openEditDialog = (lead: Lead) => {
    setEditingLead({ ...lead });
    setShowEditDialog(true);
  };

  const openDeleteDialog = (lead: Lead) => {
    setLeadToDelete(lead);
    setShowDeleteDialog(true);
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
    if (!source) return '-';
    // Handle complex source strings like "online_google" or "online_facebook_other: xxx"
    const sourceMap: Record<string, string> = {
      'website': 'Website',
      'facebook': 'Facebook',
      'line': 'LINE',
      'referral': 'แนะนำ',
      'walk_in': 'Walk-in',
      'advertising': 'โฆษณา',
      'online': 'ออนไลน์',
      'online_google': 'Google',
      'online_facebook': 'Facebook',
      'online_line': 'LINE OA',
      'online_tiktok': 'TikTok',
      'online_youtube': 'YouTube',
      'billboard': 'ป้ายโฆษณา',
      'brochure': 'แผ่นพับ/โบรชัวร์',
      'event': 'งานอีเว้นท์',
      'friend': 'เพื่อน/ญาติแนะนำ',
    };
    // Check for exact match first
    if (sourceMap[source]) return sourceMap[source];
    // Check for partial matches
    for (const [key, label] of Object.entries(sourceMap)) {
      if (source.startsWith(key)) return label;
    }
    return source;
  };

  const getGenderLabel = (gender: string) => {
    const labels: Record<string, string> = {
      male: 'ชาย',
      female: 'หญิง',
      other: 'อื่นๆ'
    };
    return labels[gender] || gender || '-';
  };

  const getOccupationLabel = (occupation: string) => {
    const labels: Record<string, string> = {
      business_owner: 'ธุรกิจส่วนตัว',
      government: 'รับราชการ / พนักงานของรัฐ',
      state_enterprise: 'พนักงานรัฐวิสาหกิจ',
      private_company: 'พนักงานบริษัทเอกชน',
      farmer: 'เกษตรกร',
      employee: 'รับจ้าง',
      other: 'อื่นๆ'
    };
    return labels[occupation] || occupation || '-';
  };

  const getMaritalStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      single: 'โสด',
      married: 'สมรส',
      widowed: 'หม้าย',
      divorced: 'หย่า',
      separated: 'แยกกันอยู่'
    };
    return labels[status] || status || '-';
  };

  const getEducationLabel = (education: string) => {
    const labels: Record<string, string> = {
      primary: 'ระดับประถมศึกษา',
      junior_high: 'ระดับมัธยมศึกษาตอนต้น',
      senior_high: 'ระดับมัธยมศึกษาตอนปลาย',
      vocational: 'ระดับ ปวช./ปวส.',
      bachelor: 'ระดับปริญญาตรี',
      master: 'ระดับปริญญาโท',
      doctorate: 'ระดับปริญญาเอก',
      other: 'อื่นๆ'
    };
    return labels[education] || education || '-';
  };

  const getPurchasePurposeLabel = (purpose: string) => {
    if (!purpose) return '-';
    const labels: Record<string, string> = {
      residence: 'เพื่ออยู่อาศัย',
      speculation: 'เก็งกำไร',
      monthly_rent: 'ปล่อยเช่ารายเดือน',
      daily_rent: 'ปล่อยเช่ารายวัน',
      flip: 'ซ่อมแล้วขาย',
      investment: 'ลงทุน/ปล่อยเช่า',
      children: 'ซื้อให้บุตรหลาน',
      parents: 'ซื้อให้พ่อแม่'
    };
    if (labels[purpose]) return labels[purpose];
    if (purpose.startsWith('other:')) return purpose.replace('other:', 'อื่นๆ: ').trim();
    if (purpose.startsWith('other')) return 'อื่นๆ';
    return purpose;
  };

  const getCustomerData = (customerId: string) => {
    return customers.find(c => c.id === customerId);
  };

  const getCustomerName = (customerId: string) => {
    const customer = customers.find(c => c.id === customerId);
    return customer?.name || '-';
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property?.name || '-';
  };

  const getUnitNumber = (unitId: string | undefined) => {
    if (!unitId) return '-';
    const unit = units.find(u => u.id === unitId);
    return unit?.unit_number || '-';
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
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Lead Management Content */}
        <main className="p-6">
          <SalesGuard>
            <div className="space-y-6">
              {/* Page Header */}
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
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(value: LeadStatus) => handleUpdateStatus(lead, value)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue>
                              {getStatusBadge(lead.status)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3" />
                                <span>ใหม่</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="contacted">
                              <div className="flex items-center gap-2">
                                <Phone className="w-3 h-3" />
                                <span>ติดต่อแล้ว</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="qualified">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3" />
                                <span>มีคุณสมบัติ</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="proposal">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3 h-3" />
                                <span>เสนอขาย</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="negotiation">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="w-3 h-3" />
                                <span>เจรจา</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="closed">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="w-3 h-3 text-green-600" />
                                <span>ปิดการขาย</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="lost">
                              <div className="flex items-center gap-2">
                                <XCircle className="w-3 h-3 text-red-600" />
                                <span>สูญเสีย</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
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
                            <DropdownMenuItem onClick={() => {
                              setSelectedLead(lead);
                              setShowDetailDialog(true);
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                              <Edit className="w-4 h-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(lead)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              ลบ
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

        {/* Add Lead Modal */}
        <AddLeadModal
          isOpen={showLeadDialog}
          onClose={() => setShowLeadDialog(false)}
          onLeadCreated={() => {
            setShowLeadDialog(false);
            fetchLeads();
          }}
        />

        {/* Lead Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl">รายละเอียด Lead</DialogTitle>
              <DialogDescription>
                ข้อมูลลูกค้าและรายละเอียดที่เกี่ยวข้อง
              </DialogDescription>
            </DialogHeader>
            {selectedLead && (() => {
              const customer = getCustomerData(selectedLead.customer_id);
              const prefs = customer?.preferences || {};
              return (
                <div className="space-y-6">
                  {/* Header with Photo and Basic Info */}
                  <div className="flex gap-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl">
                    {/* Profile Image */}
                    <div className="flex-shrink-0">
                      {prefs.profile_image ? (
                        <img
                          src={prefs.profile_image}
                          alt="รูปโปรไฟล์"
                          className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center border-4 border-white shadow-lg">
                          <Users className="w-10 h-10 text-gray-400" />
                        </div>
                      )}
                    </div>
                    {/* Basic Info */}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-2xl font-bold text-gray-800">
                            {prefs.first_name || ''} {prefs.last_name || customer?.name || '-'}
                          </h2>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Phone className="w-4 h-4" />
                              <span>{customer?.phone || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                              <Mail className="w-4 h-4" />
                              <span>{customer?.email || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          {getStatusBadge(selectedLead.status)}
                          <p className="text-xs text-gray-500 mt-2">
                            สร้างเมื่อ {new Date(selectedLead.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Interest Section */}
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      ข้อมูลโครงการที่สนใจ
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">โครงการ</p>
                        <p className="font-medium">{getPropertyName(selectedLead.property_id)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ยูนิตที่สนใจ</p>
                        <p className="font-medium">{getUnitNumber(selectedLead.unit_id)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">แหล่งที่มา</p>
                        <Badge variant="outline">{getSourceLabel(selectedLead.source)}</Badge>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">จุดประสงค์การซื้อ</p>
                        <p className="font-medium">{getPurchasePurposeLabel(prefs.purchase_purpose || '')}</p>
                      </div>
                      {selectedLead.next_follow_up && (
                        <div>
                          <p className="text-sm text-gray-500">นัดติดตามครั้งต่อไป</p>
                          <p className="font-medium text-orange-600">
                            {new Date(selectedLead.next_follow_up).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Personal Info Section */}
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      ข้อมูลส่วนตัว
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">เพศ</p>
                        <p className="font-medium">{getGenderLabel(prefs.gender || '')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">อายุ</p>
                        <p className="font-medium">{prefs.age ? `${prefs.age} ปี` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">สถานภาพ</p>
                        <p className="font-medium">{getMaritalStatusLabel(prefs.marital_status || '')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">การศึกษา</p>
                        <p className="font-medium">{getEducationLabel(prefs.education || '')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">จำนวนสมาชิกในครอบครัว</p>
                        <p className="font-medium">{prefs.family_members ? `${prefs.family_members} คน` : '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Info Section */}
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-yellow-600" />
                      ข้อมูลทางการเงิน
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">อาชีพ</p>
                        <p className="font-medium">{getOccupationLabel(prefs.occupation || '')}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">รายได้ต่อเดือน</p>
                        <p className="font-medium text-green-600">
                          {prefs.monthly_income ? formatCurrency(prefs.monthly_income) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">ภาระหนี้ต่อเดือน</p>
                        <p className="font-medium text-red-600">
                          {prefs.monthly_debt ? formatCurrency(prefs.monthly_debt) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Work Address Section */}
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-red-600" />
                      ที่อยู่ที่ทำงาน
                    </h3>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-gray-500">สถานที่ทำงาน</p>
                        <p className="font-medium">{prefs.workplace || '-'}</p>
                      </div>
                      {prefs.address && (
                        <div>
                          <p className="text-sm text-gray-500">ที่อยู่</p>
                          <p className="font-medium">
                            {[
                              prefs.address.sub_district && `ต.${prefs.address.sub_district}`,
                              prefs.address.district && `อ.${prefs.address.district}`,
                              prefs.address.province && `จ.${prefs.address.province}`,
                              prefs.address.postal_code
                            ].filter(Boolean).join(' ') || '-'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes Section */}
                  {selectedLead.notes && (
                    <div className="bg-white border rounded-xl p-4">
                      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        บันทึก
                      </h3>
                      <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedLead.notes}</p>
                    </div>
                  )}

                  {/* Consent Section */}
                  <div className="bg-white border rounded-xl p-4">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-teal-600" />
                      การยินยอม
                    </h3>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {prefs.consent_given ? (
                          <Badge className="bg-green-100 text-green-800">ยินยอม</Badge>
                        ) : (
                          <Badge variant="secondary">ไม่ยินยอม</Badge>
                        )}
                      </div>
                      {prefs.consent_date && (
                        <p className="text-sm text-gray-500">
                          วันที่ยินยอม: {new Date(prefs.consent_date).toLocaleDateString('th-TH')}
                        </p>
                      )}
                    </div>
                    {prefs.signature && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-500 mb-2">ลายเซ็น</p>
                        <img
                          src={prefs.signature}
                          alt="ลายเซ็น"
                          className="h-16 border rounded bg-white p-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button variant="outline" className="flex-1" onClick={() => {
                      setShowDetailDialog(false);
                      if (selectedLead) openEditDialog(selectedLead);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      แก้ไข
                    </Button>
                    <Button variant="destructive" className="flex-1" onClick={() => {
                      setShowDetailDialog(false);
                      if (selectedLead) openDeleteDialog(selectedLead);
                    }}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      ลบ
                    </Button>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Edit Lead Modal */}
        <EditLeadModal
          isOpen={showEditDialog}
          onClose={() => {
            setShowEditDialog(false);
            setEditingLead(null);
          }}
          onLeadUpdated={() => {
            setShowEditDialog(false);
            setEditingLead(null);
            fetchLeads();
            fetchCustomers();
          }}
          lead={editingLead}
        />

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ยืนยันการลบ Lead</DialogTitle>
              <DialogDescription>
                คุณต้องการลบ Lead "{leadToDelete ? getCustomerName(leadToDelete.customer_id) : ''}" ใช่หรือไม่?
                <br /><br />
                <span className="text-red-600 font-medium">
                  การกระทำนี้ไม่สามารถกู้คืนได้
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={deleteLoading}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleDeleteLead} disabled={deleteLoading}>
                {deleteLoading ? 'กำลังลบ...' : 'ลบ Lead'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </SalesGuard>
        </main>
      </div>
    </div>
  );
};

export default LeadManagement;
