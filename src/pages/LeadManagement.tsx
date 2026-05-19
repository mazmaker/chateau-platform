import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { SalesGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import AddLeadModal from '@/components/leads/AddLeadModal';
import EditLeadModal from '@/components/leads/EditLeadModal';
import { LeadSourceEditor } from '@/components/leads/LeadSourceEditor';
import { LeadPriorityEditor } from '@/components/leads/LeadPriorityEditor';
import { getPurchasePurposeLabel as sharedGetPurchasePurposeLabel } from '@/lib/purchasePurpose';
import PaymentModal from '@/components/leads/PaymentModal';
import HandoffLeadDialog from '@/components/leads/HandoffLeadDialog';
import QuickReserveDialog from '@/components/leads/QuickReserveDialog';
import { toast } from 'sonner';
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
  CreditCard,
  Send,
  ChevronRight
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

// Lead Status — keep legacy values + add modern DB values (negotiating/won) for compatibility
type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'negotiating' | 'closed' | 'won' | 'lost';

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
  last_contact_date?: string | null;
  priority?: string | null;
  estimated_value?: number | null;
  created_at: string;
  updated_at: string;
  // Catch-all for additional DB columns
  [key: string]: any;
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
  // Priority filter — read from URL ?priority=high so MyDashboard's "ลูกค้าด่วน" card can deep-link in
  const [searchParams] = useSearchParams();
  const priorityFilter = searchParams.get('priority') || 'all';
  const [activeTab, setActiveTab] = useState<'all' | 'my' | 'team'>(() =>
    ['sales', 'agent'].includes(userRole || '') ? 'my' : 'all'
  );

  // Dialog states
  const [showLeadDialog, setShowLeadDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const { id: routeLeadId } = useParams<{ id?: string }>();

  // Auto-open Lead Detail panel when arriving via a deep-link like /leads/:id
  // (e.g. clicking a notification "มีคนสนใจยูนิตใหม่" should land directly on the lead, not the list)
  useEffect(() => {
    if (!routeLeadId || leads.length === 0) return;
    const target = leads.find((l) => l.id === routeLeadId);
    if (target) {
      setSelectedLead(target);
      fetchLeadInterests(target.id);
      fetchLeadActivities(target.id);
      setShowDetailDialog(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLeadId, leads]);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeadInterests, setSelectedLeadInterests] = useState<LeadInterestWithDetails[]>([]);
  const [loadingInterests, setLoadingInterests] = useState(false);
  const [leadActivities, setLeadActivities] = useState<Array<{ id: string; activity_type: string; description: string; created_at: string; user_name?: string }>>([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadToDelete, setLeadToDelete] = useState<Lead | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedLeadForPayment, setSelectedLeadForPayment] = useState<Lead | null>(null);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [leadForHandoff, setLeadForHandoff] = useState<Lead | null>(null);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [visitDateDraft, setVisitDateDraft] = useState<string>('');
  const [savingVisit, setSavingVisit] = useState(false);
  // Quick Reserve — close-deal-from-lead flow (matches Sansiri/AP "on-the-spot" pattern)
  const [reserveInterest, setReserveInterest] = useState<LeadInterestWithDetails | null>(null);
  const [showReserveDialog, setShowReserveDialog] = useState(false);

  const toLocalInputValue = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  };

  // Explicit cancel — clears viewing_date and reverts status if it was viewing_scheduled
  const cancelVisitDate = async (interestId: string) => {
    if (!confirm('ยกเลิกการนัดดูยูนิตนี้?')) return;
    setSavingVisit(true);
    try {
      const current = selectedLeadInterests.find((i) => i.id === interestId);
      const updates: Record<string, any> = {
        viewing_date: null,
        updated_at: new Date().toISOString(),
      };
      if (current?.status === 'viewing_scheduled') {
        updates.status = 'interested';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update(updates).eq('id', interestId);
      if (error) throw error;
      setSelectedLeadInterests((prev) =>
        prev.map((i) =>
          i.id === interestId
            ? { ...i, viewing_date: undefined, status: (updates.status ?? i.status) as typeof i.status }
            : i
        )
      );
    } catch (e: any) {
      console.error('Cancel visit failed:', e);
      alert('ยกเลิกไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

  const saveVisitDate = async (interestId: string) => {
    setSavingVisit(true);
    try {
      const isoValue = visitDateDraft ? new Date(visitDateDraft).toISOString() : null;
      // Find current status so we know whether to bump it
      const current = selectedLeadInterests.find((i) => i.id === interestId);
      const currentStatus = current?.status;

      // Status transition rules — keep edits non-destructive:
      //   - Setting a date when status is 'interested' → upgrade to 'viewing_scheduled'
      //   - Clearing a date when status is 'viewing_scheduled' → revert to 'interested'
      //   - All other statuses (viewed/negotiating/reserved/won/lost/dropped) stay as-is
      const updates: Record<string, any> = {
        viewing_date: isoValue,
        updated_at: new Date().toISOString(),
      };
      if (isoValue && currentStatus === 'interested') {
        updates.status = 'viewing_scheduled';
      } else if (!isoValue && currentStatus === 'viewing_scheduled') {
        updates.status = 'interested';
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update(updates)
        .eq('id', interestId);
      if (error) throw error;

      setSelectedLeadInterests((prev) =>
        prev.map((i) =>
          i.id === interestId
            ? { ...i, viewing_date: isoValue || undefined, status: (updates.status ?? i.status) as typeof i.status }
            : i
        )
      );
      setEditingVisitId(null);
      setVisitDateDraft('');
    } catch (e: any) {
      console.error('Save viewing date failed:', e);
      alert('บันทึกวันนัดไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

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
          unit:units!leads_unit_id_fkey(id, unit_number, price)
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
        priority: item.priority,
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

  const fetchLeadActivities = async (leadId: string) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('activity_logs') as any)
        .select('id, activity_type, description, created_at, user_id')
        .filter('metadata->>lead_id', 'eq', leadId)
        .order('created_at', { ascending: false })
        .limit(20);
      const rows = ((data as any[]) || []) as any[];
      // Enrich user names
      const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const userMap = new Map<string, string>();
      if (userIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: users } = await (supabase.from('users') as any)
          .select('id, full_name, email').in('id', userIds);
        ((users as any[]) || []).forEach((u: any) => userMap.set(u.id, u.full_name || u.email || 'ผู้ใช้'));
      }
      setLeadActivities(rows.map((r) => ({
        id: r.id, activity_type: r.activity_type, description: r.description, created_at: r.created_at,
        user_name: r.user_id ? userMap.get(r.user_id) : 'ระบบ',
      })));
    } catch (e) {
      console.error('Load lead activities error:', e);
      setLeadActivities([]);
    }
  };

  const markLeadContacted = async (lead: Lead) => {
    setUpdatingStatus(true);
    try {
      const nowIso = new Date().toISOString();
      // Status only auto-bumps from "new" to "contacted" on the first call so we don't
      // overwrite later stages (negotiating/reserved/won). Every subsequent click just
      // refreshes last_contact_date — this is the "I just called again" semantics that
      // keeps Hot Leads' "ติดต่อล่าสุด" accurate.
      const updates: Record<string, any> = { last_contact_date: nowIso };
      if (lead.status === 'new') updates.status = 'contacted';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('leads') as any)
        .update(updates).eq('id', lead.id);
      if (error) throw error;
      // Log activity
      const customerName = getCustomerName(lead);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_logs') as any).insert({
        tenant_id: currentTenant?.id,
        user_id: userProfile?.id,
        activity_type: 'lead_contacted',
        description: `ติดต่อลูกค้า ${customerName}`,
        metadata: { lead_id: lead.id, customer_id: lead.customer_id },
      });
      setSelectedLead({ ...lead, ...updates } as any);
      await fetchLeads();
      await fetchLeadActivities(lead.id);
    } catch (err: any) {
      console.error('markLeadContacted error:', err);
    } finally {
      setUpdatingStatus(false);
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

  // Status visual config — used by both badge (cards/list) and inline (dropdown trigger)
  const STATUS_CONFIG: Record<string, { label: string; shortLabel?: string; icon: any; dot: string; badge: string }> = {
    new:         { label: 'ใหม่',            icon: FileText,    dot: '#3b82f6', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
    contacted:   { label: 'ติดต่อแล้ว',      icon: Phone,       dot: '#06b6d4', badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
    qualified:   { label: 'มีคุณสมบัติ',      icon: CheckCircle, dot: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    negotiating: { label: 'กำลังเจรจา',       icon: TrendingUp,  dot: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    negotiation: { label: 'เจรจา',           icon: TrendingUp,  dot: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    proposal:    { label: 'เสนอขาย',         icon: FileText,    dot: '#8b5cf6', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
    won:         { label: 'ปิดการขายสำเร็จ', shortLabel: 'ปิดดีล',  icon: CheckCircle, dot: '#16a34a', badge: 'bg-green-100 text-green-800 border border-green-300' },
    closed:      { label: 'ปิดการขาย',       icon: CheckCircle, dot: '#16a34a', badge: 'bg-green-100 text-green-800 border border-green-300' },
    lost:        { label: 'สูญเสีย',          icon: XCircle,     dot: '#ef4444', badge: 'bg-red-50 text-red-700 border border-red-200' },
  };

  // Full pill badge (used in cards/list cells)
  const getStatusBadge = (status: LeadStatus) => {
    const cfg = STATUS_CONFIG[status] || { label: status || 'ไม่ระบุ', icon: FileText, dot: '#6b7280', badge: 'bg-gray-50 text-gray-700 border border-gray-200' };
    const Icon = cfg.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${cfg.badge}`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </span>
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
    const shared = sharedGetPurchasePurposeLabel(purpose);
    if (shared !== '-' && !shared.endsWith(purpose)) return shared;
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
    // URL-driven priority filter (from MyDashboard "ลูกค้าด่วน" deep-link).
    // For "high" we also hide closed/lost so the result matches the dashboard count.
    const openSet = new Set(['new','contacted','qualified','negotiating']);
    const matchesPriority = priorityFilter === 'all'
      || (lead.priority === priorityFilter && (priorityFilter !== 'high' || openSet.has(lead.status || '')));
    return matchesSearch && matchesStatus && matchesSource && matchesPriority;
  });

  // Calculate stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified' || l.status === 'negotiating').length;
  const closedLeads = leads.filter(l => l.status === 'won').length;
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
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <TabsTrigger value="all">Leads ทั้งหมด</TabsTrigger>
                  )}
                  {['admin', 'sales', 'agent'].includes(userRole || '') && (
                    <TabsTrigger value="my">Leads ของฉัน</TabsTrigger>
                  )}
                  {userRole === 'admin' && (
                    <TabsTrigger value="team">Leads ทีม</TabsTrigger>
                  )}
                </TabsList>
              </Tabs>

              {priorityFilter !== 'all' && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <p className="text-sm text-rose-900">
                    🔥 กำลังแสดงเฉพาะ <span className="font-semibold">ลูกค้าด่วน (priority: {priorityFilter})</span>
                  </p>
                  <button
                    onClick={() => navigate('/leads')}
                    className="text-xs font-medium text-rose-700 hover:text-rose-900 hover:underline"
                  >
                    ล้างตัวกรอง
                  </button>
                </div>
              )}

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
                    <SelectItem value="negotiating">กำลังเจรจา</SelectItem>
                    <SelectItem value="won">ปิดการขายสำเร็จ</SelectItem>
                    <SelectItem value="lost">สูญเสีย</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="แหล่งที่มา" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกแหล่ง</SelectItem>
                    <SelectItem value="online_facebook">Facebook</SelectItem>
                    <SelectItem value="online_google">Google</SelectItem>
                    <SelectItem value="offline">Walk-in / Offline</SelectItem>
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
                        fetchLeadActivities(lead.id);
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
                      <TableCell>
                        {getStatusBadge(lead.status)}
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
                              fetchLeadActivities(lead.id);
                              setShowDetailDialog(true);
                            }}>
                              <Eye className="w-4 h-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(lead)}>
                              <Edit className="w-4 h-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            {userRole === 'agent' && lead.assigned_to === userProfile?.id && (
                              <DropdownMenuItem onClick={() => {
                                setLeadForHandoff(lead);
                                setShowHandoffDialog(true);
                              }}>
                                <Send className="w-4 h-4 mr-2 text-chateau" />
                                ส่งต่อให้ Sales
                              </DropdownMenuItem>
                            )}
                            {userRole !== 'agent' && (
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(lead)}
                                className="text-red-600 focus:text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                ลบ
                              </DropdownMenuItem>
                            )}
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
                          {/* Inline status dropdown — click to change */}
                          <Select
                            value={selectedLead.status}
                            onValueChange={async (v) => {
                              if (v === selectedLead.status) return;
                              await handleUpdateStatus(selectedLead, v as LeadStatus);
                              setSelectedLead({ ...selectedLead, status: v as LeadStatus });
                              await fetchLeadActivities(selectedLead.id);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(['new','contacted','qualified','negotiating','proposal','won','lost'] as LeadStatus[]).map((s) => {
                                const cfg = STATUS_CONFIG[s];
                                return (
                                  <SelectItem key={s} value={s}>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
                                      {cfg.label}
                                    </span>
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          <p className="text-[11px] text-gray-400 mt-2">
                            สร้างเมื่อ {new Date(selectedLead.created_at).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* === Quick Action Bar === */}
                  <div className="bg-gradient-to-br from-rose-50/30 to-white border border-gray-100 rounded-xl p-3">
                    <div className="flex flex-wrap gap-2">
                      {customer?.phone && (
                        <a
                          href={`tel:${customer.phone}`}
                          onClick={() => {
                            // Auto-log contact when Sales clicks the call button. Fire-and-forget
                            // so we don't block the tel: navigation that takes the user to their
                            // dialer. The handler also bumps status to 'contacted' on first call.
                            // Caveat: we register a click attempt, not a successful conversation —
                            // Phase 2 (Twilio/Aircall integration) will capture real call duration.
                            void markLeadContacted(selectedLead);
                          }}
                          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 h-10 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs transition-colors"
                        >
                          <Phone className="w-3.5 h-3.5" /> โทร
                        </a>
                      )}
                      <button
                        onClick={() => toast?.info?.('LINE Integration เร็วๆ นี้')}
                        className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 h-10 rounded-lg bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20 font-semibold text-xs transition-colors"
                      >
                        <span className="font-bold">L</span> LINE
                      </button>
                      {customer?.email && (
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 h-10 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors"
                        >
                          <Mail className="w-3.5 h-3.5" /> อีเมล
                        </a>
                      )}
                      {/* Repeatable contact-log button. Always visible regardless of lead status —
                          Sales clicks it after every phone call / LINE chat to refresh
                          last_contact_date. On the first click for a "new" lead, the markLeadContacted
                          handler also bumps status to "contacted". */}
                      <button
                        onClick={() => markLeadContacted(selectedLead)}
                        disabled={updatingStatus}
                        className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 h-10 rounded-lg bg-chateau text-white hover:bg-chateau-700 font-semibold text-xs transition-colors disabled:opacity-50"
                        title="บันทึกว่าเพิ่งติดต่อลูกค้ารายนี้ — กดได้ทุกครั้งที่โทร/แชท"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        {updatingStatus ? 'กำลังบันทึก...' : 'บันทึกการติดต่อ'}
                      </button>
                    </div>
                  </div>

                  {/* Project Interest Section */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    {(() => {
                      // Split active vs dropped/lost — Sales only cares about active in main list,
                      // but history is kept in a collapsible footer for traceability.
                      const activeInterests = selectedLeadInterests.filter(
                        (i) => i.status !== 'dropped' && i.status !== 'lost'
                      );
                      const droppedInterests = selectedLeadInterests.filter(
                        (i) => i.status === 'dropped' || i.status === 'lost'
                      );

                      const renderCard = (interest: typeof selectedLeadInterests[0], dim = false) => {
                        const statusOption = INTEREST_STATUS_OPTIONS.find(o => o.value === interest.status);
                        const levelOption = INTEREST_LEVEL_OPTIONS.find(o => o.value === interest.interest_level);
                        return (
                          <div
                            key={interest.id}
                            onClick={() => navigate(`/units/${interest.unit_id}`)}
                            className={`p-3 border border-gray-100 rounded-lg ${dim ? 'bg-gray-50/60 opacity-75' : 'bg-gray-50/40 hover:bg-gray-50 hover:border-chateau/30'} transition-all cursor-pointer active:scale-[0.99]`}
                            title="กดเพื่อดูรายละเอียดยูนิต"
                          >
                            <div className="flex items-start gap-3">
                              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                                <Building2 className="w-4 h-4 text-gray-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1 gap-2">
                                  <p className="text-sm font-semibold text-gray-900 truncate">
                                    {interest.property?.name || 'โครงการ'}
                                  </p>
                                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${dim ? 'bg-gray-200 text-gray-600' : 'bg-white border border-gray-200 text-gray-700'}`}>
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
                                {!dim && editingVisitId === interest.id ? (
                                  <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                                    <Input
                                      type="datetime-local"
                                      value={visitDateDraft}
                                      onChange={(e) => setVisitDateDraft(e.target.value)}
                                      className="h-8 text-xs flex-1"
                                      disabled={savingVisit}
                                    />
                                    <Button
                                      size="sm"
                                      onClick={() => saveVisitDate(interest.id)}
                                      disabled={savingVisit}
                                      className="h-8 text-xs"
                                    >
                                      บันทึก
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => { setEditingVisitId(null); setVisitDateDraft(''); }}
                                      disabled={savingVisit}
                                      className="h-8 text-xs"
                                    >
                                      ยกเลิก
                                    </Button>
                                  </div>
                                ) : !dim ? (
                                  // Two-row layout: status line on top, primary action + overflow menu below.
                                  // Keeps "บันทึกการจอง" (primary) prominent on the right while secondary
                                  // visit-scheduling actions live inside the ⋯ menu — reduces visual noise
                                  // for the most common case where Agent only needs to record a reservation.
                                  <div className="mt-1 space-y-1">
                                    <div className="text-[11px]">
                                      {interest.viewing_date ? (
                                        <span className="text-amber-700 font-medium">
                                          📅 นัดดู {new Date(interest.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      ) : ['viewed', 'negotiating', 'reserved', 'won'].includes(interest.status as string) ? (
                                        <span className="text-green-700 font-medium">✓ ลูกค้าดูแล้ว</span>
                                      ) : (
                                        <span className="text-gray-400">ยังไม่มีนัด</span>
                                      )}
                                    </div>
                                    {(userRole === 'agent' || userRole === 'sales' || userRole === 'admin' || userRole === 'owner') && (
                                      <div className="flex items-center gap-2">
                                        {/* Primary action: Quick Reserve. Hidden when interest is reserved/won/lost/dropped
                                            OR when the unit is no longer 'available'. Atomic check on the backend is the
                                            authoritative guard; this is UX to avoid offering a doomed click. */}
                                        {!['reserved', 'won', 'lost', 'dropped'].includes(interest.status as string)
                                          && interest.unit?.status === 'available' && (
                                          <button
                                            onClick={(e) => { e.stopPropagation(); setReserveInterest(interest); setShowReserveDialog(true); }}
                                            className="text-[11px] text-green-700 hover:underline font-semibold"
                                            title="ล็อกยูนิตและรับเงินมัดจำให้ลูกค้ารายนี้"
                                          >
                                            บันทึกการจอง
                                          </button>
                                        )}
                                        {!['reserved', 'won', 'lost', 'dropped'].includes(interest.status as string)
                                          && interest.unit?.status && interest.unit.status !== 'available' && (
                                          <span className="text-[11px] text-gray-400 italic" title={`สถานะยูนิต: ${interest.unit.status}`}>
                                            ยูนิตไม่ว่าง
                                          </span>
                                        )}

                                        {/* Overflow menu: nat-scheduling actions. Cancel is destructive so it stays
                                            visually distinct (red) inside the menu rather than next to the primary. */}
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <button
                                              onClick={(e) => e.stopPropagation()}
                                              className="ml-auto p-1 rounded hover:bg-gray-200 text-gray-500"
                                              aria-label="ตัวเลือกเพิ่มเติม"
                                            >
                                              <MoreHorizontal className="w-3.5 h-3.5" />
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingVisitId(interest.id); setVisitDateDraft(toLocalInputValue(interest.viewing_date)); }}>
                                              <Calendar className="w-3.5 h-3.5 mr-2" />
                                              {interest.viewing_date ? 'แก้นัดดู' : 'นัดดู'}
                                            </DropdownMenuItem>
                                            {interest.viewing_date && (
                                              <DropdownMenuItem
                                                onClick={(e) => { e.stopPropagation(); cancelVisitDate(interest.id); }}
                                                disabled={savingVisit}
                                                className="text-red-600 focus:text-red-700"
                                              >
                                                <Trash2 className="w-3.5 h-3.5 mr-2" /> ยกเลิกนัด
                                              </DropdownMenuItem>
                                            )}
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <>
                          <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            ยูนิตที่สนใจ
                            <span className="text-xs font-normal text-gray-400 ml-1">
                              ({loadingInterests ? '...' : activeInterests.length} รายการ)
                            </span>
                          </h3>

                          {loadingInterests ? (
                            <div className="flex items-center justify-center py-6">
                              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#3b82f6' }}></div>
                            </div>
                          ) : activeInterests.length > 0 ? (
                            <div className="space-y-2 max-h-[300px] overflow-y-auto">
                              {activeInterests.map((interest) => renderCard(interest))}
                            </div>
                          ) : (
                            <div className="p-3 border border-gray-100 rounded-lg bg-gray-50/40">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                                  <Building2 className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-500">ยังไม่มียูนิตที่สนใจ</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Dropped / lost interests — kept as collapsible history (Sales can still see them but they don't clutter the main list) */}
                          {droppedInterests.length > 0 && (
                            <details className="mt-3 group">
                              <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 select-none">
                                <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                ยกเลิกความสนใจแล้ว ({droppedInterests.length})
                              </summary>
                              <div className="space-y-2 mt-2 max-h-[200px] overflow-y-auto">
                                {droppedInterests.map((interest) => renderCard(interest, true))}
                              </div>
                            </details>
                          )}
                        </>
                      );
                    })()}

                    {/* Lead Info - priority, source, purpose, follow-up */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">ความสำคัญ</p>
                        <LeadPriorityEditor
                          leadId={selectedLead.id}
                          currentPriority={selectedLead.priority}
                          onUpdated={(newPriority) => {
                            setSelectedLead((prev: any) => prev ? { ...prev, priority: newPriority } : prev);
                            // Also update the row in the list so the dashboard count stays in sync
                            setLeads((prev: any[]) => prev.map((l) => l.id === selectedLead.id ? { ...l, priority: newPriority } : l));
                          }}
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">แหล่งที่มา</p>
                        <LeadSourceEditor
                          leadId={selectedLead.id}
                          currentSource={selectedLead.source}
                          onUpdated={(newSource) => {
                            setSelectedLead((prev: any) => prev ? { ...prev, source: newSource } : prev);
                          }}
                        />
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

                    if (createdDays <= 7) segs.push({ icon: '🌱', label: 'ลูกค้าใหม่ภายใน 7 วัน', reason: `${createdDays} วันที่แล้ว`, cat: 'lifecycle' });

                    if (selectedLead.priority === 'high') {
                      segs.push({ icon: '🔥', label: 'ลูกค้าด่วน', reason: 'ความสำคัญสูง', cat: 'critical' });
                    }
                    if (lastContactDays !== null && lastContactDays >= 30 && selectedLead.status !== 'lost' && selectedLead.status !== 'won') {
                      segs.push({ icon: '🥶', label: 'ลูกค้าเงียบหายเกิน 30 วัน', reason: `เงียบ ${lastContactDays} วัน`, cat: 'critical' });
                    }
                    if (selectedLead.status === 'lost') segs.push({ icon: '💀', label: 'สูญเสียลูกค้า', reason: 'สูญเสีย', cat: 'lifecycle' });
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

                  {/* === Activity Log Timeline === */}
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-500" />
                      ประวัติการติดต่อ
                      <span className="text-xs font-normal text-gray-400 ml-1">({leadActivities.length} รายการ)</span>
                    </h3>
                    {leadActivities.length === 0 ? (
                      <div className="text-center py-6 text-sm text-gray-400">ยังไม่มีกิจกรรม</div>
                    ) : (
                      <div className="relative space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {leadActivities.map((a, i) => {
                          const time = new Date(a.created_at);
                          const diff = Date.now() - time.getTime();
                          const mins = Math.floor(diff / 60000);
                          const hrs = Math.floor(mins / 60);
                          const days = Math.floor(hrs / 24);
                          const timeAgo = mins < 1 ? 'เมื่อสักครู่' : mins < 60 ? `${mins} นาทีก่อน` : hrs < 24 ? `${hrs} ชม.ก่อน` : days < 7 ? `${days} วันก่อน` : time.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
                          const typeIcons: Record<string, { icon: any; color: string; bg: string }> = {
                            lead_created:      { icon: FileText,     color: 'text-blue-700', bg: 'bg-blue-50' },
                            lead_contacted:    { icon: Phone,        color: 'text-cyan-700', bg: 'bg-cyan-50' },
                            lead_status_updated:{ icon: TrendingUp,   color: 'text-amber-700', bg: 'bg-amber-50' },
                            interest_added:    { icon: Building2,    color: 'text-rose-700', bg: 'bg-rose-50' },
                            viewing_scheduled: { icon: Calendar,     color: 'text-amber-700', bg: 'bg-amber-50' },
                            handoff_to_sales:  { icon: Users,        color: 'text-purple-700', bg: 'bg-purple-50' },
                            payment_received:  { icon: CreditCard,   color: 'text-green-700', bg: 'bg-green-50' },
                          };
                          const cfg = typeIcons[a.activity_type] || { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-50' };
                          const Icon = cfg.icon;
                          return (
                            <div key={a.id} className="flex items-start gap-3 relative">
                              {i < leadActivities.length - 1 && (
                                <div className="absolute left-[15px] top-8 w-0.5 h-[calc(100%-1rem)] bg-gray-100" />
                              )}
                              <div className={`relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${cfg.bg}`}>
                                <Icon className={`w-4 h-4 ${cfg.color}`} />
                              </div>
                              <div className="flex-1 min-w-0 pb-1">
                                <p className="text-sm text-gray-900">{a.description}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">
                                  {timeAgo} {a.user_name && `· โดย ${a.user_name}`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

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

        {/* Quick Reserve Dialog — close-deal-from-lead (matches Sansiri/AP on-the-spot reservation pattern) */}
        <QuickReserveDialog
          open={showReserveDialog}
          onOpenChange={(open) => {
            setShowReserveDialog(open);
            if (!open) setReserveInterest(null);
          }}
          lead={selectedLead ? { id: selectedLead.id, customer_id: selectedLead.customer_id, tenant_id: selectedLead.tenant_id } : null}
          interest={reserveInterest}
          customerName={selectedLead ? getCustomerName(selectedLead) : ''}
          customerPhone={selectedLead ? (customers.find(c => c.id === selectedLead.customer_id)?.phone) : undefined}
          userId={userProfile?.id || ''}
          isAgent={userRole === 'agent'}
          onSuccess={() => {
            if (selectedLead) {
              fetchLeadInterests(selectedLead.id);
              fetchLeadActivities(selectedLead.id);
            }
            fetchLeads();
            fetchInterestCounts();
          }}
        />

        {/* Handoff Dialog (Agent → Sales) */}
        <HandoffLeadDialog
          open={showHandoffDialog}
          onOpenChange={(open) => {
            setShowHandoffDialog(open);
            if (!open) setLeadForHandoff(null);
          }}
          leadId={leadForHandoff?.id || null}
          customerName={leadForHandoff ? getCustomerName(leadForHandoff) : undefined}
          unitId={leadForHandoff?.unit_id}
          projectId={leadForHandoff?.property_id}
          onSuccess={() => {
            fetchLeads();
          }}
        />

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
                           leadToDelete?.status === 'negotiating' ? 'กำลังเจรจา' :
                           leadToDelete?.status === 'won' ? 'ปิดการขายสำเร็จ' :
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
