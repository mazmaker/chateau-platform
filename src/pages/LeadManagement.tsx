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
import { LEAD_STATUS_LABELS, leadStatusLabel } from '@/lib/leadStatus';
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
  ChevronRight,
  Bell,
  Heart,
  Check
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
  // URL drives the initial filter values so deep-links can land pre-filtered:
  //   ?status=new   → Lead Analytics "ลีดเกิน SLA" card drops in on untouched new leads
  //   ?priority=high → MyDashboard "ลูกค้าด่วน" card. The popover then lets the user override.
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.get('status') || 'all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilterState] = useState<string>(searchParams.get('priority') || 'all');
  const setPriorityFilter = (v: string) => {
    setPriorityFilterState(v);
    // Keep the URL in sync so the deep-link state survives a page refresh.
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('priority');
    else next.set('priority', v);
    setSearchParams(next, { replace: true });
  };
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

  // For agents only: their active assigned unit IDs. Used to flag interests on
  // out-of-scope units (lead is theirs by referral, but Sales handles the unit
  // because the agent isn't allotted it) — render a "Sales ดูแล" badge and hide
  // the action menu so the agent can still track the lead without dead actions.
  const [myAgentUnitIds, setMyAgentUnitIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (userRole !== 'agent' || !userProfile?.id) { setMyAgentUnitIds(new Set()); return; }
    let cancelled = false;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('agent_unit_assignments') as any)
        .select('unit_id')
        .eq('agent_user_id', userProfile.id)
        .is('revoked_at', null);
      if (!cancelled) setMyAgentUnitIds(new Set(((data as any[]) || []).map((r) => r.unit_id)));
    })();
    return () => { cancelled = true; };
  }, [userRole, userProfile?.id]);

  const toLocalInputValue = (iso?: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  };

  // Explicit cancel — clears viewing_date and reverts status if it was viewing_scheduled
  // Hard-delete a dropped/lost interest row. Only exposed to Admin/Owner — Sales
  // shouldn't be able to erase audit history. Soft-deleted ('dropped') rows pile
  // up over time and clutter the "ยกเลิกความสนใจแล้ว" section; this gives the
  // tenant admin a way to clean them out permanently after they're sure the
  // history is no longer needed.
  const permanentlyDeleteInterest = async (interestId: string, unitNumber?: string) => {
    if (!confirm(`ลบรายการ ${unitNumber ? `ยูนิต ${unitNumber} ` : ''}อย่างถาวร?\nหลังจากลบจะไม่สามารถกู้คืนได้`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .delete().eq('id', interestId);
      if (error) throw error;
      setSelectedLeadInterests((prev) => prev.filter((i) => i.id !== interestId));
      toast.success('ลบรายการเรียบร้อย');
    } catch (e: any) {
      console.error('Hard-delete interest failed:', e);
      toast.error('ลบไม่สำเร็จ: ' + (e?.message || 'unknown'));
    }
  };

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

      // Status transition rules — keep state and viewing_date in sync:
      //   - Setting a date when status is 'interested' or 'viewed' → 'viewing_scheduled'
      //     (rescheduling after a visit means there's a NEW future visit, so we're
      //     back in the "scheduled" state until it happens)
      //   - Clearing a date when status is 'viewing_scheduled' → revert to 'interested'
      //   - Advanced statuses (negotiating/reserved/won/lost/dropped) stay as-is —
      //     we don't want a viewing reschedule to undo a closed deal.
      const updates: Record<string, any> = {
        viewing_date: isoValue,
        updated_at: new Date().toISOString(),
      };
      if (isoValue && (currentStatus === 'interested' || currentStatus === 'viewed')) {
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

  // Sales presses "ยืนยันมาแล้ว" after the appointment. Promotes interest to 'viewed'
  // AND flips leads.site_visit_attended so ML scoring picks up the engagement signal
  // without Sales having to tick a second box.
  const confirmVisitAttended = async (interestId: string, leadId: string) => {
    setSavingVisit(true);
    try {
      const nowIso = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: iErr } = await (supabase.from('lead_interests') as any)
        .update({ status: 'viewed', updated_at: nowIso })
        .eq('id', interestId);
      if (iErr) throw iErr;
      // Sync lead-level state — promote 'new' → 'contacted' since a customer who
      // physically came to view can't still be in the "untouched" bucket.
      const currentLead = leads.find((l) => l.id === leadId);
      const leadUpdates: Record<string, any> = { site_visit_attended: true };
      if (currentLead?.status === 'new') leadUpdates.status = 'contacted';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: lErr } = await (supabase.from('leads') as any)
        .update(leadUpdates)
        .eq('id', leadId);
      if (lErr) throw lErr;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('activity_logs') as any).insert({
          tenant_id: currentTenant?.id,
          user_id: userProfile?.id,
          activity_type: 'site_visit_confirmed',
          description: 'ยืนยันลูกค้ามาเยี่ยมชมโครงการแล้ว',
          metadata: { lead_id: leadId, interest_id: interestId },
        });
      } catch { /* non-blocking */ }
      setSelectedLeadInterests((prev) =>
        prev.map((i) => (i.id === interestId ? { ...i, status: 'viewed' as typeof i.status } : i))
      );
      if (selectedLead?.id === leadId) {
        setSelectedLead({ ...selectedLead, ...leadUpdates } as any);
      }
      // Sync local list so other UI pieces (status column) reflect the bump.
      if (leadUpdates.status) {
        setLeads((prev: any[]) => prev.map((l) => l.id === leadId ? { ...l, ...leadUpdates } : l));
      }
    } catch (e: any) {
      console.error('Confirm visit failed:', e);
      alert('บันทึกไม่สำเร็จ: ' + (e?.message || 'unknown'));
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
          unit:units!leads_unit_id_fkey(id, unit_number, price),
          assigned_user:users!leads_assigned_to_fkey(id, full_name, role)
        `)
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      // Filter by assigned user if viewing "my" leads
      if (activeTab === 'my' && userProfile) {
        query = query.eq('assigned_to', userProfile.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Pass through ALL DB fields so EditLeadModal can read financial/demographic
      // data (monthly_income, loan_is_manual, gender, etc.). The old hand-picked
      // mapping silently dropped those fields, leaving the Edit form blank even
      // though the data was sitting in the row.
      const mappedLeads = (data || []).map((item: any) => ({
        ...item,
        // Apply UI-facing defaults / coercions on top
        status: item.status || 'new',
        source: item.source || 'website',
        notes: item.notes || '',
        preferred_location: undefined,
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
      // Exclude soft-deleted interests so the count badge matches what UnitDetail +
      // LeadInterestsList actually display (both filter dropped/lost).
      const { data, error } = await supabase
        .from('lead_interests')
        .select('lead_id')
        .eq('tenant_id', currentTenant?.id)
        .not('status', 'in', '("dropped","lost")');

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
        // Self-heal: an interest at 'viewing_scheduled' with no viewing_date is an
        // invalid combination (legacy bug). Demote to 'interested' on load so the
        // UI never displays "นัดดู" without a date.
        const invalidIds = interestsData
          .filter((i: any) => i.status === 'viewing_scheduled' && !i.viewing_date)
          .map((i: any) => i.id);
        if (invalidIds.length > 0) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('lead_interests') as any)
              .update({ status: 'interested' })
              .in('id', invalidIds);
            interestsData.forEach((i: any) => {
              if (invalidIds.includes(i.id)) i.status = 'interested';
            });
          } catch { /* non-blocking */ }
        }

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
      // Every call click counts as 1 interaction — Sales used to have to hit a separate "+1"
      // button on the CDP page, which got skipped in practice. Folding it in here keeps the
      // ML engagement signal honest without the extra step.
      const updates: Record<string, any> = {
        last_contact_date: nowIso,
        interaction_count: (Number(lead.interaction_count) || 0) + 1,
      };
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

      // Notify Lead owner if it's someone else doing the contact (e.g., Admin
      // logged a call on a Sales' lead). Skip self-notify — the contacter
      // doesn't need a bell ping for their own action.
      try {
        if ((lead as any).assigned_to && (lead as any).assigned_to !== userProfile?.id && currentTenant?.id) {
          const { createNotification } = await import('@/lib/notifications');
          await createNotification({
            tenantId: currentTenant.id,
            userId: (lead as any).assigned_to,
            activityType: 'lead_contacted',
            title: 'มีการติดต่อ Lead ของคุณ',
            message: `${customerName} ถูกติดต่อ`,
            severity: 'info',
            relatedEntityType: 'lead',
            relatedEntityId: lead.id,
          });
        }
      } catch { /* non-blocking */ }

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
      // A manual status change is an explicit Sales touch on the lead, so refresh
      // last_contact_date too. Without this, a lead moved via the status dropdown
      // (instead of the "บันทึกการติดต่อ" button) keeps last_contact_date = null and
      // falsely resurfaces in the "ลีดเงียบ"/silent lists, which fall back to created_at.
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, last_contact_date: nowIso })
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
        l.id === lead.id ? { ...l, status: newStatus, last_contact_date: nowIso } : l
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
      preferred_location: '',
      notes: '',
      next_follow_up: ''
    });
  };

  // Status visual config — used by both badge (cards/list) and inline (dropdown trigger)
  const STATUS_CONFIG: Record<string, { label: string; shortLabel?: string; icon: any; dot: string; badge: string }> = {
    new:         { label: LEAD_STATUS_LABELS.new,         icon: FileText,    dot: '#3b82f6', badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
    contacted:   { label: LEAD_STATUS_LABELS.contacted,   icon: Phone,       dot: '#06b6d4', badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
    qualified:   { label: LEAD_STATUS_LABELS.qualified,   icon: CheckCircle, dot: '#10b981', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
    negotiating: { label: LEAD_STATUS_LABELS.negotiating, icon: TrendingUp,  dot: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    negotiation: { label: 'เจรจา',           icon: TrendingUp,  dot: '#f59e0b', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
    proposal:    { label: 'เสนอขาย',         icon: FileText,    dot: '#8b5cf6', badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
    won:         { label: LEAD_STATUS_LABELS.won, icon: CheckCircle, dot: '#16a34a', badge: 'bg-green-100 text-green-800 border border-green-300' },
    closed:      { label: 'ปิดการขาย',       icon: CheckCircle, dot: '#16a34a', badge: 'bg-green-100 text-green-800 border border-green-300' },
    lost:        { label: LEAD_STATUS_LABELS.lost,        icon: XCircle,     dot: '#ef4444', badge: 'bg-red-50 text-red-700 border border-red-200' },
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
    const sourceMap: Record<string, string> = {
      'website': 'Website',
      'facebook': 'Facebook',
      'instagram': 'Instagram',
      'tiktok': 'TikTok',
      'youtube': 'YouTube',
      'twitter': 'X (Twitter)',
      'line': 'LINE',
      'line_oa': 'LINE OA',
      'google': 'Google',
      'referral': 'แนะนำ',
      'agent_referral': 'นายหน้าแนะนำ',
      'walk_in': 'Walk-in',
      'advertising': 'โฆษณา',
      'online': 'ออนไลน์',
      'offline': 'ออฟไลน์',
      'online_google': 'Google',
      'online_facebook': 'Facebook',
      'online_instagram': 'Instagram',
      'online_line': 'LINE OA',
      'online_tiktok': 'TikTok',
      'online_youtube': 'YouTube',
      'billboard': 'ป้ายโฆษณา',
      'brochure': 'แผ่นพับ/โบรชัวร์',
      'event': 'งานอีเว้นท์',
      'friend': 'เพื่อน/ญาติแนะนำ',
      'other': 'อื่นๆ',
    };
    // Normalize: strip "other:" / "other_" prefix and lowercase. The legacy data
    // entry layer wrapped known platforms in "other: facebook" — we shouldn't
    // show that to Sales. If the inner value matches a known platform → use it.
    const normalized = source
      .replace(/^other[:_]\s*/i, '')
      .trim()
      .toLowerCase();
    if (sourceMap[normalized]) return sourceMap[normalized];
    // Exact match on original
    if (sourceMap[source]) return sourceMap[source];
    // Partial / prefix match
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

  // Compact Thai currency format — matches Dashboard/Analytics/PropertyManagement.
  // Use for table cells and headline numbers; keep formatCurrency for detail views
  // where precision matters (income/debt fields, invoice line items).
  const formatTHB = (n: number) => {
    if (n === 0) return '฿0';
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    if (abs >= 1_000_000) {
      const m = abs / 1_000_000;
      if (m >= 1000) return `${sign}฿${Math.round(m).toLocaleString('en-US')} ล้าน`;
      if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
      if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
      return `${sign}฿${m.toFixed(2)} ล้าน`;
    }
    if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
    return `${sign}฿${abs.toFixed(0)}`;
  };

  const [sortByScore, setSortByScore] = useState(false);
  // Pagination — CRM standard is 10-25 rows/page (Salesforce/Dynamics/HubSpot).
  // Default 10 keeps the list scannable; user can bump to 25/50.
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // URL-driven SLA filter (from Lead Analytics "ลีดเกิน SLA" deep-link, ?sla=1).
  // Must match Analytics' slaBreach definition EXACTLY so the count and this list agree:
  //   status='new' · created > 2h ago · never contacted (last_contact_date is null).
  const slaActive = searchParams.get('sla') === '1';
  const slaCutoff = Date.now() - 2 * 60 * 60 * 1000;

  const filteredLeads = leads.filter(lead => {
    const customerName = getCustomerName(lead).toLowerCase();
    const propertyName = getPropertyName(lead).toLowerCase();
    const matchesSearch = customerName.includes(searchQuery.toLowerCase()) ||
                         propertyName.includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesProperty = propertyFilter === 'all' || lead.property_id === propertyFilter;
    // URL-driven priority filter (from MyDashboard "ลูกค้าด่วน" deep-link).
    // For "high" we also hide closed/lost so the result matches the dashboard count.
    const openSet = new Set(['new','contacted','qualified','negotiating']);
    const matchesPriority = priorityFilter === 'all'
      || (lead.priority === priorityFilter && (priorityFilter !== 'high' || openSet.has(lead.status || '')));
    const matchesSla = !slaActive
      || (lead.status === 'new' && !lead.last_contact_date && new Date(lead.created_at).getTime() < slaCutoff);
    return matchesSearch && matchesStatus && matchesSource && matchesProperty && matchesPriority && matchesSla;
  }).sort((a, b) => {
    if (!sortByScore) return 0;
    const scoreA = (a as any).potential_score ?? -1;
    const scoreB = (b as any).potential_score ?? -1;
    return scoreB - scoreA;
  });

  // Pagination math — slice the filtered list to the current page.
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedLeads = filteredLeads.slice(pageStart, pageStart + pageSize);

  // Reset to page 1 whenever filters/search/sort change so the user isn't stranded
  // on an out-of-range page.
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sourceFilter, propertyFilter, priorityFilter, sortByScore, pageSize]);

  // Calculate stats
  const totalLeads = leads.length;
  const newLeads = leads.filter(l => l.status === 'new').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified' || l.status === 'negotiating').length;
  const closedLeads = leads.filter(l => l.status === 'won').length;
  const lostLeads = leads.filter(l => l.status === 'lost').length;
  const conversionRate = totalLeads > 0 ? Math.round((closedLeads / totalLeads) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="lg:ml-[260px] min-h-screen">
        {/* Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Lead Management Content — extra bottom padding so the pagination bar
            clears the fixed floating widget at the bottom-right corner. */}
        <main className="p-6 lg:p-8 pb-28">
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
                        <h1 className="text-2xl font-bold text-gray-900">ระบบจัดการผู้สนใจ</h1>
                        <p className="text-gray-600 mt-1">
                          จัดการผู้สนใจซื้ออสังหาฯ และติดตามสถานะการขาย
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
                      เพิ่มผู้สนใจใหม่
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
                  <p className="text-xs text-muted-foreground">ผู้สนใจทั้งหมด</p>
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
                  <p className="text-xs text-muted-foreground">ผู้สนใจใหม่</p>
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
                  <p className="text-xs text-muted-foreground">{leadStatusLabel('lost')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Tab UI removed — every role already sees the right scope by default
                  (admin → all, sales/agent → their own via RLS). activeTab still drives
                  the fetch but no longer needs a visible switcher. */}
              {priorityFilter !== 'all' && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-rose-50 border border-rose-100 rounded-lg">
                  <p className="text-sm text-rose-900">
                    กำลังแสดงเฉพาะ <span className="font-semibold">ลูกค้าด่วน (priority: {priorityFilter})</span>
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
                {(() => {
                  // Single consolidated filter — opens a panel with all filter sections.
                  // Active-count badge on the button helps Sales see at a glance which
                  // filters are currently narrowing the list.
                  const activeCount =
                    (statusFilter !== 'all' ? 1 : 0) +
                    (sourceFilter !== 'all' ? 1 : 0) +
                    (propertyFilter !== 'all' ? 1 : 0) +
                    (priorityFilter !== 'all' ? 1 : 0);
                  const clearAll = () => {
                    setStatusFilter('all');
                    setSourceFilter('all');
                    setPropertyFilter('all');
                    setPriorityFilter('all');
                  };
                  return (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="gap-2 min-w-[140px]">
                          <Filter className="w-4 h-4" />
                          ตัวกรอง
                          {activeCount > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-semibold bg-chateau text-white tabular-nums">
                              {activeCount}
                            </span>
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[300px] p-4 space-y-4" onCloseAutoFocus={(e) => e.preventDefault()}>
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-gray-900">ตัวกรอง</p>
                          {activeCount > 0 && (
                            <button
                              type="button"
                              onClick={clearAll}
                              className="text-xs text-chateau hover:underline"
                            >
                              ล้างทั้งหมด
                            </button>
                          )}
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-700 mb-1.5 block">สถานะ</Label>
                          <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              <SelectItem value="new">{leadStatusLabel('new')}</SelectItem>
                              <SelectItem value="contacted">{leadStatusLabel('contacted')}</SelectItem>
                              <SelectItem value="qualified">{leadStatusLabel('qualified')}</SelectItem>
                              <SelectItem value="negotiating">{leadStatusLabel('negotiating')}</SelectItem>
                              <SelectItem value="won">{leadStatusLabel('won')}</SelectItem>
                              <SelectItem value="lost">{leadStatusLabel('lost')}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-700 mb-1.5 block">โครงการ</Label>
                          <Select value={propertyFilter} onValueChange={setPropertyFilter}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-[260px]">
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              {properties.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-700 mb-1.5 block">ลูกค้าด่วน (Priority)</Label>
                          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              <SelectItem value="high">สูง (ด่วน)</SelectItem>
                              <SelectItem value="medium">ปานกลาง</SelectItem>
                              <SelectItem value="low">ต่ำ</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-medium text-gray-700 mb-1.5 block">แหล่งที่มา</Label>
                          <Select value={sourceFilter} onValueChange={setSourceFilter}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">ทั้งหมด</SelectItem>
                              <SelectItem value="online_facebook">Facebook</SelectItem>
                              <SelectItem value="online_google">Google</SelectItem>
                              <SelectItem value="offline">Walk-in / Offline</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  );
                })()}
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
                  <TableHead>สถานะ</TableHead>
                  <TableHead
                    className="cursor-pointer select-none hover:text-chateau"
                    onClick={() => setSortByScore(v => !v)}
                  >
                    Potential Score {sortByScore ? '▼' : '○'}
                  </TableHead>
                  <TableHead>วงเงินกู้</TableHead>
                  <TableHead>แหล่งที่มา</TableHead>
                  <TableHead>ผู้รับผิดชอบ</TableHead>
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
                  paginatedLeads.map((lead) => (
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
                        {/* Loan amount has 4 distinct presentations so Sales can take
                            the right action at a glance:
                              • Sales-verified  → bold dark number (no tag)
                              • Auto-estimated  → muted number + "ประเมิน" chip
                              • DTI too high    → "ผ่อนไม่ไหว (DTI สูง)" warning (amber)
                              • No income data  → "ขอข้อมูลรายได้" hint (gray italic)
                            Lumping the last two as a generic "ยังไม่ระบุ" hides a real
                            risk signal — DTI=100% leads should be flagged, not blanked. */}
                        {(() => {
                          const loanAmount = Number((lead as any).max_loan_amount);
                          const isManual = (lead as any).loan_is_manual === true;
                          // Income/debt live in TWO places — leads.* and customers.preferences.* —
                          // and they're NOT always in sync (older AddLeadModal flows wrote only to
                          // preferences, leaving leads.monthly_income at 0). Read both, prefer
                          // whichever is non-zero so the column doesn't lie about missing data.
                          const prefs = (lead as any).customer?.preferences || {};
                          const monthlyIncome = Number((lead as any).monthly_income) || Number(prefs.monthly_income) || 0;
                          const monthlyDebt = Number((lead as any).monthly_debt) || Number(prefs.monthly_debt) || 0;

                          if (loanAmount > 0) {
                            if (isManual) {
                              return (
                                <span className="text-sm font-semibold text-gray-900">
                                  {formatTHB(loanAmount)}
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1.5">
                                <span className="text-sm text-gray-600">{formatTHB(loanAmount)}</span>
                                <span className="text-[10px] font-medium text-chateau">
                                  ประเมิน
                                </span>
                              </span>
                            );
                          }
                          // No stored loan amount, but income data exists → either DTI too high
                          // OR the estimate hasn't been computed yet (legacy data drift).
                          // Decide by DTI: >= 40% is the Thai bank cap → can't loan.
                          if (monthlyIncome > 0) {
                            const dti = monthlyDebt / monthlyIncome;
                            if (dti >= 0.4) {
                              return (
                                <span className="text-sm font-medium text-amber-700">
                                  ผ่อนไม่ไหว <span className="text-[10px] text-amber-600">(DTI สูง)</span>
                                </span>
                              );
                            }
                            // Has income, DTI is fine, but no stored estimate — needs recompute.
                            return (
                              <span className="text-sm font-medium text-blue-600 italic">
                                รอประเมินวงเงิน
                              </span>
                            );
                          }
                          return <span className="text-gray-400 text-sm italic">ขอข้อมูลรายได้</span>;
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getSourceLabel(lead.source)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {(() => {
                          const assigned = (lead as any).assigned_user;
                          if (!assigned?.full_name) {
                            return <span className="text-amber-700 italic">ยังไม่มอบหมาย</span>;
                          }
                          return (
                            <span className="text-gray-900 font-medium">
                              {assigned.full_name}
                            </span>
                          );
                        })()}
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

            {/* Pagination bar — only when there's more than one page worth of data */}
            {!loading && filteredLeads.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span>
                    แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, filteredLeads.length)} จาก {filteredLeads.length} รายการ
                  </span>
                  <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10 / หน้า</SelectItem>
                      <SelectItem value="25">25 / หน้า</SelectItem>
                      <SelectItem value="50">50 / หน้า</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    disabled={safePage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronRight className="w-4 h-4 rotate-180" />
                  </Button>
                  {(() => {
                    // Compact page-number window: show up to 5 pages around the current one.
                    const pages: number[] = [];
                    const from = Math.max(1, safePage - 2);
                    const to = Math.min(totalPages, from + 4);
                    for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                    return pages.map((p) => (
                      <Button
                        key={p}
                        variant={p === safePage ? 'default' : 'outline'}
                        size="sm"
                        className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`}
                        onClick={() => setCurrentPage(p)}
                      >
                        {p}
                      </Button>
                    ));
                  })()}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2"
                    disabled={safePage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
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
              <DialogTitle className="text-xl">รายละเอียดผู้สนใจ</DialogTitle>
              <DialogDescription>
                ข้อมูลผู้สนใจและรายละเอียดที่เกี่ยวข้อง
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
                                  <div className="flex items-center gap-1.5 flex-shrink-0">
                                    <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md ${dim ? 'bg-gray-200 text-gray-600' : 'bg-white border border-gray-200 text-gray-700'}`}>
                                      {statusOption?.label || interest.status}
                                    </span>
                                    {/* Hard-delete for dropped/lost rows — Admin/Owner only.
                                        Lets them prune dead history once they're sure it's no
                                        longer needed. Soft-delete (status='dropped') is already
                                        the default on the active list; this is the final step. */}
                                    {dim && (userRole === 'admin' || userRole === 'owner') && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); permanentlyDeleteInterest(interest.id, interest.unit?.unit_number); }}
                                        className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                                        title="ลบรายการนี้อย่างถาวร"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
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
                                  // Single row: status text on the left, all actions consolidated into
                                  // the ⋯ overflow menu. Inline action links (บันทึกการจอง / ยืนยันมาแล้ว)
                                  // were moved into the menu so the card stays compact — Sales reported
                                  // the inline buttons cluttered the list view.
                                  <div className="mt-1 flex items-center justify-between gap-2">
                                    <div className="text-[11px]">
                                      {interest.viewing_date ? (
                                        <span className="text-amber-700 font-medium">
                                          นัดดู {new Date(interest.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      ) : ['viewed', 'negotiating', 'reserved', 'won'].includes(interest.status as string) ? (
                                        <span className="text-green-700 font-medium">ลูกค้าดูแล้ว</span>
                                      ) : (
                                        <span className="text-gray-400">ยังไม่มีนัด</span>
                                      )}
                                      {!['reserved', 'won', 'lost', 'dropped'].includes(interest.status as string)
                                        && interest.unit?.status && interest.unit.status !== 'available' && (
                                        <span className="ml-2 text-gray-400 italic" title={`สถานะยูนิต: ${interest.unit.status}`}>
                                          · ยูนิตไม่ว่าง
                                        </span>
                                      )}
                                    </div>
                                    {userRole === 'agent' && !myAgentUnitIds.has(interest.unit_id) ? (
                                      // Lead is the agent's by referral, but this specific unit is outside
                                      // their allotment — Sales handles it. Show a badge instead of action
                                      // menu so the agent can track the lead without dead actions.
                                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                                        Sales ดูแลยูนิตนี้
                                      </span>
                                    ) : (userRole === 'agent' || userRole === 'sales' || userRole === 'admin' || userRole === 'owner') && (
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            onClick={(e) => e.stopPropagation()}
                                            className="p-1 rounded hover:bg-gray-200 text-gray-500"
                                            aria-label="ตัวเลือกเพิ่มเติม"
                                          >
                                            <MoreHorizontal className="w-3.5 h-3.5" />
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                          {/* Primary action — keep at top so it's the easiest to reach.
                                              Hidden when interest is past 'reserved' or unit is unavailable. */}
                                          {!['reserved', 'won', 'lost', 'dropped'].includes(interest.status as string)
                                            && interest.unit?.status === 'available' && (
                                            <DropdownMenuItem
                                              onClick={(e) => { e.stopPropagation(); setReserveInterest(interest); setShowReserveDialog(true); }}
                                              className="text-green-700 focus:text-green-800 font-semibold"
                                            >
                                              <Check className="w-3.5 h-3.5 mr-2" /> {userRole === 'agent' ? 'จองชั่วคราว' : 'บันทึกการจอง'}
                                            </DropdownMenuItem>
                                          )}
                                          {/* Confirm visit — only when there's a scheduled visit not yet attended. */}
                                          {interest.status === 'viewing_scheduled' && interest.viewing_date && selectedLead && (
                                            <DropdownMenuItem
                                              onClick={(e) => { e.stopPropagation(); confirmVisitAttended(interest.id, selectedLead.id); }}
                                              disabled={savingVisit}
                                              className="text-cyan-700 focus:text-cyan-800"
                                            >
                                              <CheckCircle className="w-3.5 h-3.5 mr-2" /> ยืนยันลูกค้ามาแล้ว
                                            </DropdownMenuItem>
                                          )}
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
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        );
                      };

                      // Split active interests into 2 buckets matching customer intent:
                      //   • ขอติดต่อ   = interest_level='high' (customer clicked "ฉันสนใจ")
                      //   • บันทึกไว้ = interest_level='low'/'medium' (customer just hearted) or active engagement
                      // This mirrors the customer-dashboard 3-section split so Sales sees the
                      // same mental model. Color-coding alone wasn't enough — testers couldn't
                      // distinguish "สนใจมาก/น้อย" labels at a glance.
                      const ACTIVE_FOLLOWUP_STATUSES = ['viewing_scheduled', 'viewed', 'negotiating', 'reserved', 'deposit_paid', 'won'];
                      const priorityInterests = activeInterests.filter(
                        (i) => i.interest_level === 'high' || ACTIVE_FOLLOWUP_STATUSES.includes(i.status)
                      );
                      const bookmarkInterests = activeInterests.filter(
                        (i) => i.interest_level !== 'high' && !ACTIVE_FOLLOWUP_STATUSES.includes(i.status)
                      );

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
                            <div className="space-y-4 max-h-[400px] overflow-y-auto">
                              {/* === ขอติดต่อ === */}
                              {priorityInterests.length > 0 && (
                                <div>
                                  <div className="flex items-center justify-between mb-2 px-1">
                                    <h4 className="text-xs font-bold text-chateau flex items-center gap-1.5">
                                      <Bell className="w-3.5 h-3.5" />
                                      ลูกค้าแสดงความสนใจ — โปรดติดต่อกลับ
                                    </h4>
                                    <span className="text-[10px] font-semibold text-chateau">{priorityInterests.length} รายการ</span>
                                  </div>
                                  <div className="space-y-2">
                                    {priorityInterests.map((interest) => renderCard(interest))}
                                  </div>
                                </div>
                              )}

                              {/* === บันทึกไว้พิจารณา — collapsed by default ===
                                  Sales doesn't usually act on these (low-intent bookmarks); keep
                                  them out of the main eye-line and let them expand on demand. */}
                              {bookmarkInterests.length > 0 && (
                                <details className="group">
                                  <summary className="cursor-pointer list-none flex items-center justify-between mb-2 px-1 select-none">
                                    <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1.5">
                                      <ChevronRight className="w-3 h-3 transition-transform group-open:rotate-90" />
                                      <Heart className="w-3.5 h-3.5" />
                                      รายการที่ลูกค้าบันทึกไว้ดูทีหลัง
                                    </h4>
                                    <span className="text-[10px] font-medium text-gray-400">{bookmarkInterests.length} รายการ</span>
                                  </summary>
                                  <div className="space-y-2 mt-2">
                                    {bookmarkInterests.map((interest) => renderCard(interest))}
                                  </div>
                                </details>
                              )}
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
                                รายการที่ยกเลิกแล้ว ({droppedInterests.length})
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
                      if (age >= 18 && age <= 30) segs.push({ icon: '', label: 'กลุ่มอายุน้อย', reason: `${age} ปี`, cat: 'demographic' });
                      else if (age >= 31 && age <= 50) segs.push({ icon: '', label: 'วัยกลางคน', reason: `${age} ปี`, cat: 'demographic' });
                      else if (age >= 51) segs.push({ icon: '', label: 'ผู้สูงอายุ', reason: `${age} ปี`, cat: 'demographic' });
                    }

                    // Demographic — รายได้
                    const income = prefs.monthly_income ? Number(prefs.monthly_income) : null;
                    if (income !== null) {
                      if (income >= 100000) segs.push({ icon: '', label: 'รายได้สูง', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                      else if (income >= 30000) segs.push({ icon: '', label: 'รายได้ปานกลาง', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                      else segs.push({ icon: '', label: 'รายได้น้อย', reason: `฿${income.toLocaleString()}/เดือน`, cat: 'budget' });
                    }

                    // Family
                    const familySize = prefs.family_members ? Number(prefs.family_members) : null;
                    if (familySize !== null) {
                      if (familySize >= 2) segs.push({ icon: '', label: 'ครอบครัว', reason: `${familySize} คน`, cat: 'family' });
                      else if (familySize === 1 || prefs.marital_status === 'single') segs.push({ icon: '', label: 'โสด', reason: 'อยู่คนเดียว', cat: 'family' });
                    }

                    // Buyer Type
                    const purpose = prefs.purchase_purpose || '';
                    if (purpose === 'first_home' || purpose.includes('อยู่อาศัย')) segs.push({ icon: '', label: 'บ้านหลังแรก', reason: 'อยู่อาศัย', cat: 'buyer' });
                    else if (purpose === 'investment' || purpose.includes('ลงทุน') || purpose.includes('เก็งกำไร')) segs.push({ icon: '', label: 'ลงทุน', reason: 'เก็งกำไร', cat: 'buyer' });
                    else if (purpose === 'rental' || purpose.includes('เช่า')) segs.push({ icon: '', label: 'ปล่อยเช่า', reason: 'rental', cat: 'buyer' });

                    // Lead Lifecycle
                    const createdDays = Math.floor((Date.now() - new Date(selectedLead.created_at).getTime()) / (1000 * 60 * 60 * 24));
                    const lastContactDays = selectedLead.last_contact_date
                      ? Math.floor((Date.now() - new Date(selectedLead.last_contact_date).getTime()) / (1000 * 60 * 60 * 24))
                      : null;

                    if (createdDays <= 7) segs.push({ icon: '', label: 'ลูกค้าใหม่ภายใน 7 วัน', reason: `${createdDays} วันที่แล้ว`, cat: 'lifecycle' });

                    if (selectedLead.priority === 'high') {
                      segs.push({ icon: '', label: 'ลูกค้าด่วน', reason: 'ความสำคัญสูง', cat: 'critical' });
                    }
                    if (lastContactDays !== null && lastContactDays >= 30 && selectedLead.status !== 'lost' && selectedLead.status !== 'won') {
                      segs.push({ icon: '', label: 'ลูกค้าเงียบหายเกิน 30 วัน', reason: `เงียบ ${lastContactDays} วัน`, cat: 'critical' });
                    }
                    if (selectedLead.status === 'lost') segs.push({ icon: '', label: leadStatusLabel('lost'), reason: leadStatusLabel('lost'), cat: 'lifecycle' });
                    if (selectedLead.status === 'won') segs.push({ icon: '', label: 'Won Customer', reason: leadStatusLabel('won'), cat: 'critical' });

                    // Budget
                    const budget = selectedLead.estimated_value ? Number(selectedLead.estimated_value) : null;
                    if (budget !== null && budget > 0) {
                      if (budget >= 10000000) segs.push({ icon: '', label: 'งบ Premium 10M+', reason: `฿${budget.toLocaleString()}`, cat: 'critical' });
                      else if (budget >= 3000000) segs.push({ icon: '', label: 'งบ 3-10M', reason: `฿${budget.toLocaleString()}`, cat: 'budget' });
                      else if (budget >= 1000000) segs.push({ icon: '', label: 'งบ 1-3M', reason: `฿${budget.toLocaleString()}`, cat: 'budget' });
                    }

                    // Property type interest
                    if (selectedLeadInterests.length > 0) {
                      const types = new Set(selectedLeadInterests.map(i => i.property?.type).filter(Boolean));
                      if (types.has('condo')) segs.push({ icon: '', label: 'สนใจคอนโด', reason: 'condo', cat: 'property' });
                      if (types.has('house')) segs.push({ icon: '', label: 'สนใจบ้านเดี่ยว', reason: 'house', cat: 'property' });
                      if (types.has('villa')) segs.push({ icon: '', label: 'สนใจ Villa', reason: 'villa', cat: 'property' });
                    }

                    if (segs.length === 0) {
                      return (
                        <div className="bg-white border border-gray-100 rounded-xl p-5">
                          <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
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
                           Lead นี้จะได้รับ campaign ที่ผูกกับ {segs.length} segments นี้
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
          leadIds={leadForHandoff ? [leadForHandoff.id] : []}
          customerNames={leadForHandoff ? [getCustomerName(leadForHandoff)] : []}
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
                          {leadStatusLabel(leadToDelete?.status)}
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
