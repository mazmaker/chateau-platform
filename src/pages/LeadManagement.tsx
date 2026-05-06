import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { SalesGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import AddLeadModal from '@/components/leads/AddLeadModal';
import EditLeadModal from '@/components/leads/EditLeadModal';
import PaymentModal from '@/components/leads/PaymentModal';
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
  AlertTriangle,
  Target,
  CreditCard
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

const LeadManagement = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole, userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [interestCounts, setInterestCounts] = useState<Record<string, number>>({});
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
  const [selectedLeadInterests, setSelectedLeadInterests] = useState<LeadInterestWithDetails[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLeadForPayment, setSelectedLeadForPayment] = useState<Lead | null>(null);

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
      fetchInterestCounts();
    }
  }, [currentTenant, activeTab]);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          customer:customers(id, full_name, email, phone, preferences),
          property:properties(id, name),
          unit:units(id, unit_number, price)
        `)
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
        updated_at: item.updated_at,
        // Include scoring fields
        potential_score: item.potential_score,
        max_loan_amount: item.max_loan_amount,
        financial_score: item.financial_score,
        engagement_score: item.engagement_score,
        urgency_score: item.urgency_score,
        fit_score: item.fit_score,
        conversion_probability: item.conversion_probability,
        // Include joined data
        customer: item.customer,
        property: item.property,
        unit: item.unit
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

  const fetchInterestCounts = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_interests')
        .select('lead_id')
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      // Count interests per lead
      const counts: Record<string, number> = {};
      (data || []).forEach((item: { lead_id: string }) => {
        counts[item.lead_id] = (counts[item.lead_id] || 0) + 1;
      });
      setInterestCounts(counts);
    } catch (error) {
      console.error('Error fetching interest counts:', error);
    }
  };

  // Fetch lead interests with property and unit details for detail modal
  const fetchLeadInterests = async (leadId: string) => {
    setLoadingInterests(true);
    try {
      const { data: interestsData, error } = await supabase
        .from('lead_interests')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (interestsData && interestsData.length > 0) {
        // Fetch all properties and units for the interests
        const propertyIds = [...new Set(interestsData.map(i => i.property_id))];
        const unitIds = [...new Set(interestsData.map(i => i.unit_id))];

        const [{ data: propertiesData }, { data: unitsData }] = await Promise.all([
          supabase.from('properties').select('id, name, type').in('id', propertyIds),
          supabase.from('units').select('id, unit_number, price, status').in('id', unitIds)
        ]);

        const propertiesMap = new Map((propertiesData || []).map(p => [p.id, p]));
        const unitsMap = new Map((unitsData || []).map(u => [u.id, u]));

        const enrichedInterests: LeadInterestWithDetails[] = interestsData.map(interest => ({
          ...interest,
          property: propertiesMap.get(interest.property_id),
          unit: unitsMap.get(interest.unit_id)
        }));

        setSelectedLeadInterests(enrichedInterests);
      } else {
        setSelectedLeadInterests([]);
      }
    } catch (error) {
      console.error('Error fetching lead interests:', error);
      setSelectedLeadInterests([]);
    } finally {
      setLoadingInterests(false);
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

      // Log activity for status update
      try {
        const customerName = getCustomerName(lead);
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: userProfile?.id,
          p_activity_type: 'lead_status_updated',
          p_description: `อัปเดตสถานะ Lead: ${customerName} (${lead.status} → ${newStatus})`,
          p_metadata: {
            lead_id: lead.id,
            customer_id: lead.customer_id,
            customer_name: customerName,
            old_status: lead.status,
            new_status: newStatus
          }
        });
      } catch {
        // Ignore log_activity errors
      }

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

      // Log activity for lead deletion
      try {
        const customerName = getCustomerName(leadToDelete);
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: userProfile?.id,
          p_activity_type: 'lead_deleted',
          p_description: `ลบ Lead: ${customerName}`,
          p_metadata: {
            lead_id: leadToDelete.id,
            customer_id: leadToDelete.customer_id,
            customer_name: customerName
          }
        });
      } catch {
        // Ignore log_activity errors
      }

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

      // Log activity for lead update
      try {
        const customerName = getCustomerName(editingLead);
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: userProfile?.id,
          p_activity_type: 'lead_updated',
          p_description: `แก้ไข Lead: ${customerName}`,
          p_metadata: {
            lead_id: editingLead.id,
            customer_id: editingLead.customer_id,
            customer_name: customerName,
            status: editingLead.status,
            notes: editingLead.notes
          }
        });
      } catch {
        // Ignore log_activity errors
      }

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

  const getCustomerName = (lead: Lead) => {
    // Try to get from joined data first
    if ((lead as any).customer?.full_name) {
      return (lead as any).customer.full_name;
    }
    // Fallback to customers state
    const customer = customers.find(c => c.id === lead.customer_id);
    return customer?.name || '-';
  };

  const getPropertyName = (lead: Lead) => {
    // Try to get from joined data first
    if ((lead as any).property?.name) {
      return (lead as any).property.name;
    }
    // Fallback to properties state
    const property = properties.find(p => p.id === lead.property_id);
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
    const customerName = getCustomerName(lead).toLowerCase();
    const propertyName = getPropertyName(lead).toLowerCase();
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
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                        <Users className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">ระบบติดตามลูกค้า (Leads)</h1>
                        <p className="text-gray-600 mt-1">
                          จัดการลูกค้าและติดตามสถานะการขายอสังหาริมทรัพย์
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        resetLeadForm();
                        setShowLeadDialog(true);
                      }}
                      className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      เพิ่ม Lead ใหม่
                    </Button>
                  </div>
                </CardContent>
              </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card className="border-l-4 border-l-cyan-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-cyan-100 text-cyan-600 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalLeads}</p>
                  <p className="text-xs text-muted-foreground">Lead ทั้งหมด</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                  <Target className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{newLeads}</p>
                  <p className="text-xs text-muted-foreground">Lead ใหม่</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-orange-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{qualifiedLeads}</p>
                  <p className="text-xs text-muted-foreground">กำลังดำเนินการ</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{closedLeads}</p>
                  <p className="text-xs text-muted-foreground">ปิดการขาย ({conversionRate}%)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-red-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{lostLeads}</p>
                  <p className="text-xs text-muted-foreground">สูญเสีย</p>
                </div>
              </div>
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
                  <TableHead>ยูนิตสนใจ</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>Potential Score</TableHead>
                  <TableHead>วงเงินกู้ (฿)</TableHead>
                  <TableHead>แหล่งที่มา</TableHead>
                  <TableHead>วันที่สร้าง</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
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
                        fetchLeadInterests(lead.id);
                        setShowDetailDialog(true);
                      }}
                    >
                      <TableCell className="font-medium">
                        {getCustomerName(lead)}
                      </TableCell>
                      <TableCell>{getPropertyName(lead)}</TableCell>
                      <TableCell>
                        {interestCounts[lead.id] ? (
                          <Badge variant="secondary" className="font-medium">
                            {interestCounts[lead.id]} ยูนิต
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
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
                        {/* Real Potential Score from database */}
                        {(() => {
                          const score = (lead as any).potential_score;
                          if (score == null) {
                            return <span className="text-gray-400 text-sm">-</span>;
                          }
                          const colorClass = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
                          return (
                            <span className={`font-semibold ${colorClass}`}>
                              {score}%
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {/* Real Max Loan Amount from database */}
                        {(() => {
                          const loanAmount = (lead as any).max_loan_amount;
                          if (loanAmount == null) {
                            return <span className="text-gray-400 text-sm">-</span>;
                          }
                          return (
                            <span className="text-sm font-medium text-blue-600">
                              {formatCurrency(loanAmount)}
                            </span>
                          );
                        })()}
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
                            <DropdownMenuItem onClick={() => navigate(`/leads/${lead.id}/cdp`)}>
                              <Target className="w-4 h-4 mr-2 text-chateau" />
                              CDP
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedLeadForPayment(lead);
                              setShowPaymentModal(true);
                            }}>
                              <CreditCard className="w-4 h-4 mr-2 text-green-600" />
                              การโอนเงิน
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setSelectedLead(lead);
                              fetchLeadInterests(lead.id);
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
                <div className="space-y-4">
                  {/* Header — white card with subtle red accent ring */}
                  <div className="flex gap-5 p-5 bg-white border border-gray-100 rounded-xl">
                    {/* Profile Image */}
                    <div className="flex-shrink-0">
                      {prefs.profile_image ? (
                        <img
                          src={prefs.profile_image}
                          alt="รูปโปรไฟล์"
                          className="w-20 h-20 rounded-full object-cover ring-2 ring-offset-2"
                          style={{ '--tw-ring-color': '#fecdd3' } as React.CSSProperties}
                        />
                      ) : (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center ring-2 ring-offset-2"
                          style={{ backgroundColor: '#fff1f2', '--tw-ring-color': '#fecdd3' } as React.CSSProperties}>
                          <Users className="w-8 h-8" style={{ color: '#e60023' }} />
                        </div>
                      )}
                    </div>
                    {/* Basic Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h2 className="text-xl font-bold text-gray-900 truncate">
                            {prefs.first_name || ''} {prefs.last_name || customer?.name || '-'}
                          </h2>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Phone className="w-3.5 h-3.5" style={{ color: '#e60023' }} />
                              <span>{customer?.phone || '-'}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="w-3.5 h-3.5" style={{ color: '#e60023' }} />
                              <span className="truncate">{customer?.email || '-'}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {getStatusBadge(selectedLead.status)}
                          <p className="text-[11px] text-gray-400 mt-2">
                            สร้างเมื่อ {new Date(selectedLead.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Project Interest Section */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-500" />
                      ยูนิตที่สนใจ
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        ({loadingInterests ? '...' : selectedLeadInterests.length > 0 ? selectedLeadInterests.length : 1} รายการ)
                      </span>
                    </h3>

                    {loadingInterests ? (
                      <div className="flex items-center justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#3b82f6' }}></div>
                      </div>
                    ) : selectedLeadInterests.length > 0 ? (
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {selectedLeadInterests.map((interest) => {
                          const statusOption = INTEREST_STATUS_OPTIONS.find(o => o.value === interest.status);
                          const levelOption = INTEREST_LEVEL_OPTIONS.find(o => o.value === interest.interest_level);
                          return (
                            <div key={interest.id} className="p-3 border border-gray-100 rounded-lg bg-gray-50/40 hover:bg-gray-50 transition-colors">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                                  <Building2 className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1 gap-2">
                                    <p className="text-sm font-semibold text-gray-900 truncate">
                                      {interest.property?.name || 'โครงการ'}
                                    </p>
                                    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-gray-200 text-gray-700 flex-shrink-0">
                                      {statusOption?.label || interest.status}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-gray-600">
                                    <span>ยูนิต <span className="font-semibold text-gray-800">{interest.unit?.unit_number || '-'}</span></span>
                                    {interest.unit?.price && (
                                      <span className="font-bold text-gray-900 tabular-nums">
                                        {new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(interest.unit.price)}
                                      </span>
                                    )}
                                    {levelOption && <span className="text-gray-500">· {levelOption.label}</span>}
                                  </div>
                                  {interest.viewing_date && (
                                    <p className="text-[11px] text-gray-500 mt-1">
                                      นัดดู {new Date(interest.viewing_date).toLocaleString('th-TH')}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-3 border border-gray-100 rounded-lg bg-gray-50/40">
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                            <Building2 className="w-4 h-4 text-gray-500" />
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-gray-900">{getPropertyName(selectedLead)}</p>
                            <p className="text-xs text-gray-600 mt-0.5">ยูนิต {getUnitNumber(selectedLead.unit_id)}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lead Info - source, purpose, follow-up */}
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">แหล่งที่มา</p>
                        <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-700">
                          {getSourceLabel(selectedLead.source)}
                        </span>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">จุดประสงค์การซื้อ</p>
                        <p className="text-sm font-semibold text-gray-800">{getPurchasePurposeLabel(prefs.purchase_purpose || '')}</p>
                      </div>
                      {selectedLead.next_follow_up && (
                        <div>
                          <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">นัดติดตามครั้งต่อไป</p>
                          <p className="text-sm font-semibold text-gray-800">
                            {new Date(selectedLead.next_follow_up).toLocaleDateString('th-TH')}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* === Computed Segments — คำนวณจากข้อมูลจริงของ Lead === */}
                  {(() => {
                    // Color theme per category — pastel แต่มีสี
                    type SegCategory = 'demographic' | 'family' | 'buyer' | 'lifecycle' | 'budget' | 'property' | 'critical';
                    const CATEGORY_STYLES: Record<SegCategory, { dot: string }> = {
                      demographic: { dot: '#7c3aed' }, // purple
                      family:      { dot: '#10b981' }, // green
                      buyer:       { dot: '#3b82f6' }, // blue
                      lifecycle:   { dot: '#06b6d4' }, // cyan
                      budget:      { dot: '#f59e0b' }, // amber
                      property:    { dot: '#a21caf' }, // fuchsia
                      critical:    { dot: '#e60023' }, // brand red
                    };
                    const segs: Array<{ icon: string; label: string; reason: string; cat: SegCategory }> = [];

                    // Demographic — อายุ
                    const age = prefs.age ? Number(prefs.age) : null;
                    if (age !== null) {
                      if (age >= 18 && age <= 30) segs.push({ icon: '🎓', label: 'กลุ่มอายุน้อย', reason: `${age} ปี`, cat: 'demographic' });
                      else if (age >= 31 && age <= 50) segs.push({ icon: '👨‍💼', label: 'วัยกลางคน', reason: `${age} ปี`, cat: 'demographic' });
                      else if (age >= 51) segs.push({ icon: '👴', label: 'ผู้สูงอายุ', reason: `${age} ปี`, cat: 'demographic' });
                    }

                    // Demographic — รายได้
                    const income = prefs.monthly_income ? Number(prefs.monthly_income) : null;
                    if (income !== null) {
                      if (income >= 100000) segs.push({ icon: '💰', label: 'รายได้สูง', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                      else if (income >= 30000) segs.push({ icon: '💵', label: 'รายได้ปานกลาง', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                      else segs.push({ icon: '💴', label: 'รายได้น้อย', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                    }

                    // Family
                    const familySize = prefs.family_members ? Number(prefs.family_members) : null;
                    if (familySize !== null) {
                      if (familySize >= 2) segs.push({ icon: '👨‍👩‍👧', label: 'ครอบครัว', reason: `${familySize} คน`, cat: 'family' });
                      else if (familySize === 1 || prefs.marital_status === 'single') segs.push({ icon: '🧑', label: 'โสด', reason: 'อยู่คนเดียว', cat: 'family' });
                    }

                    // Buyer Type
                    const purpose = prefs.purchase_purpose || '';
                    if (purpose === 'first_home' || purpose.includes('อยู่อาศัย')) segs.push({ icon: '🏠', label: 'บ้านหลังแรก', reason: 'อยู่อาศัย', cat: 'buyer' });
                    else if (purpose === 'investment' || purpose.includes('ลงทุน') || purpose.includes('เก็งกำไร')) segs.push({ icon: '📈', label: 'ลงทุน', reason: 'เก็งกำไร', cat: 'buyer' });
                    else if (purpose === 'rental' || purpose.includes('เช่า')) segs.push({ icon: '🏘️', label: 'ปล่อยเช่า', reason: 'rental', cat: 'buyer' });

                    // Lead Lifecycle
                    const createdDays = Math.floor((Date.now() - new Date(selectedLead.created_at).getTime()) / (1000 * 60 * 60 * 24));
                    const lastContactDays = selectedLead.last_contact_date
                      ? Math.floor((Date.now() - new Date(selectedLead.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    if (createdDays <= 7) segs.push({ icon: '🌱', label: 'Lead ใหม่ 7 วัน', reason: `${createdDays} วันที่แล้ว`, cat: 'lifecycle' });

                    if ((selectedLead.status === 'qualified' || selectedLead.status === 'negotiating') && selectedLead.priority === 'high') {
                      segs.push({ icon: '🔥', label: 'Hot Lead', reason: 'priority สูง', cat: 'critical' });
                    }
                    if (lastContactDays !== null && lastContactDays >= 30 && selectedLead.status !== 'lost' && selectedLead.status !== 'won') {
                      segs.push({ icon: '🥶', label: 'Cold Lead 30 วัน', reason: `เงียบ ${lastContactDays} วัน`, cat: 'critical' });
                    }
                    if (selectedLead.status === 'lost') segs.push({ icon: '💀', label: 'Lost Lead', reason: 'lost', cat: 'lifecycle' });
                    if (selectedLead.status === 'won') segs.push({ icon: '🏆', label: 'Won Customer', reason: 'ปิดดีลแล้ว', cat: 'critical' });

                    // Budget
                    const budget = selectedLead.estimated_value ? Number(selectedLead.estimated_value) : null;
                    if (budget !== null && budget > 0) {
                      if (budget >= 10000000) segs.push({ icon: '💎', label: 'งบ Premium 10M+', reason: `฿${budget.toLocaleString()}`, cat: 'critical' });
                      else if (budget >= 3000000) segs.push({ icon: '💵', label: 'งบ 3-10M', reason: `฿${budget.toLocaleString()}`, cat: 'budget' });
                      else if (budget >= 1000000) segs.push({ icon: '💴', label: 'งบ 1-3M', reason: `฿${budget.toLocaleString()}`, cat: 'budget' });
                    }

                    // Property type interest
                    if (selectedLeadInterests.length > 0) {
                      const types = new Set(selectedLeadInterests.map(i => i.property?.type).filter(Boolean));
                      if (types.has('condo')) segs.push({ icon: '🏢', label: 'สนใจคอนโด', reason: 'condo', cat: 'property' });
                      if (types.has('house')) segs.push({ icon: '🏡', label: 'สนใจบ้านเดี่ยว', reason: 'house', cat: 'property' });
                      if (types.has('villa')) segs.push({ icon: '🏖️', label: 'สนใจ Villa', reason: 'villa', cat: 'property' });
                    }

                    if (segs.length === 0) {
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-5">
                          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <span className="text-sm">🏷️</span>
                            Segments
                          </h3>
                          <p className="text-sm text-gray-400 italic">ยังไม่สามารถจัดกลุ่มได้ — กรอกข้อมูล (อายุ/รายได้/ครอบครัว) เพิ่มเติม</p>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-white border border-gray-100 rounded-xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                            <span className="text-sm">🏷️</span>
                            Segments ที่อยู่
                            <span className="text-xs font-normal text-gray-400 ml-1">({segs.length} กลุ่ม)</span>
                          </h3>
                          <span className="text-[11px] text-gray-400">คำนวณจาก lead จริง</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {segs.map((seg, i) => {
                            const style = CATEGORY_STYLES[seg.cat];
                            return (
                              <div
                                key={i}
                                title={seg.reason}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs text-gray-700 transition-all hover:shadow-soft"
                              >
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: style.dot }} />
                                <span className="text-[13px]">{seg.icon}</span>
                                <span className="font-semibold text-gray-900">{seg.label}</span>
                                <span className="text-[10px] text-gray-400 font-normal">· {seg.reason}</span>
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
                          💡 Lead นี้จะได้รับ campaign ที่ผูกกับ {segs.length} segments นี้
                        </p>
                      </div>
                    );
                  })()}

                  {/* Personal Info Section */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-500" />
                      ข้อมูลส่วนตัว
                    </h3>
                    <div className="grid grid-cols-3 gap-y-3 gap-x-4">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">เพศ</p>
                        <p className="text-sm font-semibold text-gray-800">{getGenderLabel(prefs.gender || '')}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">อายุ</p>
                        <p className="text-sm font-semibold text-gray-800">{prefs.age ? `${prefs.age} ปี` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">สถานภาพ</p>
                        <p className="text-sm font-semibold text-gray-800">{getMaritalStatusLabel(prefs.marital_status || '')}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">การศึกษา</p>
                        <p className="text-sm font-semibold text-gray-800">{getEducationLabel(prefs.education || '')}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">จำนวนสมาชิกในครอบครัว</p>
                        <p className="text-sm font-semibold text-gray-800">{prefs.family_members ? `${prefs.family_members} คน` : '-'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Info Section */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      ข้อมูลทางการเงิน
                    </h3>
                    <div className="grid grid-cols-3 gap-x-4">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">อาชีพ</p>
                        <p className="text-sm font-semibold text-gray-800">{getOccupationLabel(prefs.occupation || '') || '-'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">
                          รายได้ต่อเดือน
                        </p>
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {prefs.monthly_income ? formatCurrency(prefs.monthly_income) : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">
                          ภาระหนี้ต่อเดือน
                        </p>
                        <p className="text-sm font-bold text-gray-900 tabular-nums">
                          {prefs.monthly_debt ? formatCurrency(prefs.monthly_debt) : '-'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Work Address Section */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
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
            fetchInterestCounts();
          }}
          lead={editingLead}
        />

        {/* Payment Modal */}
        {selectedLeadForPayment && (
          <PaymentModal
            isOpen={showPaymentModal}
            onClose={() => {
              setShowPaymentModal(false);
              setSelectedLeadForPayment(null);
            }}
            leadId={selectedLeadForPayment.id}
            leadName={getCustomerName(selectedLeadForPayment)}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="p-0 overflow-hidden max-w-md">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    ยืนยันการลบ Lead
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Lead Info Card */}
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="p-1.5 bg-chateau rounded-lg">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">ข้อมูล Lead ที่จะลบ</h3>
                      <p className="text-xs text-gray-500">ตรวจสอบข้อมูลก่อนดำเนินการ</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Customer Name */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Users className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">ชื่อลูกค้า</p>
                        <p className="font-medium text-gray-900">{leadToDelete ? getCustomerName(leadToDelete) : '-'}</p>
                      </div>
                    </div>
                    {/* Phone */}
                    {leadToDelete && (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Phone className="w-4 h-4 text-gray-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">เบอร์โทร</p>
                          <p className="font-medium text-gray-900">
                            {customers.find(c => c.id === leadToDelete.customer_id)?.phone || '-'}
                          </p>
                        </div>
                      </div>
                    )}
                    {/* Status */}
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <Target className="w-4 h-4 text-gray-600" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">สถานะ</p>
                        <p className="font-medium text-gray-900">
                          {leadToDelete?.status === 'new' ? 'ใหม่' :
                           leadToDelete?.status === 'contacted' ? 'ติดต่อแล้ว' :
                           leadToDelete?.status === 'qualified' ? 'มีคุณสมบัติ' :
                           leadToDelete?.status === 'proposal' ? 'เสนอขาย' :
                           leadToDelete?.status === 'negotiation' ? 'เจรจา' :
                           leadToDelete?.status === 'closed' ? 'ปิดการขาย' :
                           leadToDelete?.status === 'lost' ? 'สูญเสีย' : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Warning Box */}
              <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800">คำเตือน</p>
                    <p className="text-sm text-red-700 mt-1">
                      การลบ Lead จะทำให้ข้อมูลลูกค้าและประวัติการติดตามหายไปทั้งหมด
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <DialogFooter className="px-6 py-4 border-t bg-gray-50">
              <div className="flex gap-3 w-full">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={deleteLoading}
                  className="flex-1 border-gray-300 hover:bg-gray-100"
                >
                  ยกเลิก
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDeleteLead}
                  disabled={deleteLoading}
                  className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                >
                  {deleteLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      กำลังลบ...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Trash2 className="w-4 h-4 mr-2" />
                      ลบ Lead
                    </div>
                  )}
                </Button>
              </div>
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
