import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  User,
  Plus,
  Search,
  Edit,
  Eye,
  Phone,
  Mail,
  Building,
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
  AlertTriangle,
  Target
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import {
  InterestStatus,
  InterestLevel,
  INTEREST_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
} from '@/types/lead-interest';

// Lead Interest with details for display
interface LeadInterestWithDetails {
  id: string;
  lead_id: string;
  property_id: string;
  unit_id: string;
  status: InterestStatus;
  interest_level: InterestLevel;
  notes?: string;
  viewing_date?: string;
  created_at: string;
  property?: {
    id: string;
    name: string;
    type: string;
  };
  unit?: {
    id: string;
    unit_number: string;
    price?: number;
    status?: string;
  };
}

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

interface LeadInterestCount {
  lead_id: string;
  count: number;
}

// Helper component for lead detail rendering
const LeadDetailView = ({
  selectedLead,
  customer,
  prefs,
  navigate,
  openEditDialog,
  openDeleteDialog,
  selectedLeadInterests,
  loadingInterests,
  getCustomerName,
  getStatusBadge,
  getSourceLabel,
  getMaritalStatusLabel,
  getEducationLabel,
  getOccupationLabel,
  formatCurrency
}: any) => {
  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="outline" onClick={() => navigate('/leads')}>
        ← กลับไปรายการ Leads
      </Button>

      {/* Lead Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <CardTitle className="text-3xl font-bold">{customer?.full_name || 'ไม่พบข้อมูลลูกค้า'}</CardTitle>
                {getStatusBadge(selectedLead.status)}
                <Badge variant="outline">{getSourceLabel(selectedLead.source)}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
};

const LeadManagement = () => {
  const navigate = useNavigate();
  const { id: leadId } = useParams();
  const { currentTenant, userRole, userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // Selected lead data
  const selectedLead = leads.find(lead => lead.id === leadId) || null;
  const customer = selectedLead ? getCustomerData(selectedLead.customer_id) : null;
  const prefs = customer?.preferences || {};

  // Helper functions
  const getCustomerData = (customerId: string) => {
    return customers.find(c => c.id === customerId);
  };

  const getCustomerName = (customerId: string) => {
    const customer = getCustomerData(customerId);
    return customer?.name || 'ไม่พบข้อมูลลูกค้า';
  };

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property?.name || 'ไม่พบข้อมูลโครงการ';
  };

  const getStatusBadge = (status: LeadStatus) => {
    const statusConfig = {
      new: { label: 'ใหม่', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      contacted: { label: 'ติดต่อแล้ว', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      qualified: { label: 'มีคุณสมบัติ', color: 'bg-green-100 text-green-800 border-green-200' },
      proposal: { label: 'เสนอราคา', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      negotiation: { label: 'เจรจา', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      closed: { label: 'ปิดการขาย', color: 'bg-green-100 text-green-800 border-green-200' },
      lost: { label: 'เสียลูกค้า', color: 'bg-red-100 text-red-800 border-red-200' }
    };

    const config = statusConfig[status] || statusConfig.new;
    return <Badge className={`${config.color} border`}>{config.label}</Badge>;
  };

  const getSourceLabel = (source: string) => {
    const sourceMap = {
      online: 'ออนไลน์',
      offline: 'ออฟไลน์',
      referral: 'แนะนำ',
      advertisement: 'โฆษณา',
      social_media: 'โซเชียลมีเดีย'
    };
    return sourceMap[source as keyof typeof sourceMap] || source;
  };

  // Fetch data functions
  const fetchLeads = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('tenant_id', currentTenant?.id || '')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('tenant_id', currentTenant?.id || '');

      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setCustomers([]);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, type')
        .eq('tenant_id', currentTenant?.id || '');

      if (error) throw error;
      setProperties(data || []);
    } catch (error) {
      console.error('Error fetching properties:', error);
      setProperties([]);
    }
  };

  // Effects
  useEffect(() => {
    if (currentTenant) {
      fetchLeads();
      fetchCustomers();
      fetchProperties();
    }
  }, [currentTenant]);

  // Filter leads
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = searchQuery === '' ||
      getCustomerName(lead.customer_id).toLowerCase().includes(searchQuery.toLowerCase()) ||
      getPropertyName(lead.property_id).toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 space-y-6 bg-background">
          <SalesGuard>
            {/* Page Header */}
            <Card className="bg-white border border-gray-200 hover:shadow-lg transition-shadow duration-300" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)', borderRadius: '12px' }}>
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-gray-800 to-gray-900 shadow-xl rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">ระบบติดตามลูกค้า (Leads)</h1>
                      <p className="text-gray-600 mt-1">จัดการลูกค้าและติดตามสถานะการขายอสังหาริมทรัพย์</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setShowLeadDialog(true)}
                    className="bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 text-white shadow-lg"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่ม Lead
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Filters */}
            <Card className="bg-white border border-gray-200" style={{ borderRadius: '12px' }}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      type="text"
                      placeholder="ค้นหาลูกค้า หรือ โครงการ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 h-12 bg-white border border-gray-300 rounded-xl focus:border-yellow-600 focus:ring-2 focus:ring-yellow-600/20"
                    />
                  </div>

                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-12 bg-white border border-gray-300 rounded-xl focus:border-yellow-600 focus:ring-2 focus:ring-yellow-600/20">
                      <SelectValue placeholder="กรองตามสถานะ" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200 rounded-xl shadow-xl">
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="new">ใหม่</SelectItem>
                      <SelectItem value="contacted">ติดต่อแล้ว</SelectItem>
                      <SelectItem value="qualified">มีคุณสมบัติ</SelectItem>
                      <SelectItem value="proposal">เสนอราคา</SelectItem>
                      <SelectItem value="negotiation">เจรจา</SelectItem>
                      <SelectItem value="closed">ปิดการขาย</SelectItem>
                      <SelectItem value="lost">เสียลูกค้า</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>รวม {filteredLeads.length} รายการ</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Leads Table */}
            <Card className="bg-white border border-gray-200" style={{ borderRadius: '12px' }}>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600"></div>
                    <span className="ml-2 text-gray-600">กำลังโหลดข้อมูล...</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ชื่อลูกค้า</TableHead>
                        <TableHead>โครงการที่สนใจ</TableHead>
                        <TableHead>สถานะ</TableHead>
                        <TableHead>แหล่งที่มา</TableHead>
                        <TableHead>วันที่สร้าง</TableHead>
                        <TableHead>จัดการ</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            ไม่พบข้อมูล Lead
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLeads.map((lead) => (
                          <TableRow key={lead.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center">
                                  <User className="w-4 h-4 text-gray-600" />
                                </div>
                                <span className="font-medium">{getCustomerName(lead.customer_id)}</span>
                              </div>
                            </TableCell>
                            <TableCell>{getPropertyName(lead.property_id)}</TableCell>
                            <TableCell>{getStatusBadge(lead.status)}</TableCell>
                            <TableCell>{getSourceLabel(lead.source)}</TableCell>
                            <TableCell>{new Date(lead.created_at).toLocaleDateString('th-TH')}</TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="w-8 h-8 p-0">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-white border border-gray-200 rounded-lg shadow-lg">
                                  <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}`)} className="hover:bg-gray-50">
                                    <Eye className="w-4 h-4 mr-2" />
                                    ดูรายละเอียด
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => setEditingLead(lead)} className="hover:bg-gray-50">
                                    <Edit className="w-4 h-4 mr-2" />
                                    แก้ไข
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </SalesGuard>
        </main>
      </div>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showLeadDialog}
        onClose={() => setShowLeadDialog(false)}
        onLeadCreated={() => {
          setShowLeadDialog(false);
          fetchLeads();
        }}
      />

      {/* Edit Lead Modal */}
      <EditLeadModal
        isOpen={editingLead !== null}
        onClose={() => setEditingLead(null)}
        onLeadUpdated={() => {
          setEditingLead(null);
          fetchLeads();
        }}
        lead={editingLead}
      />
    </div>
  );
};

export default LeadManagement;
