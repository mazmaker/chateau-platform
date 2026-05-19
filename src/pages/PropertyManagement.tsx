import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { ViewPropertiesGuard, ManagePropertiesGuard } from '@/components/auth/PermissionGuard';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Bed,
  Bath,
  Square,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  Filter,
  Home,
  Layers,
  User,
  Users,
  ImagePlus,
  X,
  Upload,
  UserPlus,
  DollarSign,
  ImageIcon,
  Ruler,
  FileText,
  Settings,
  Save,
  AlertTriangle,
  LayoutGrid,
  List,
  Check
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import CreateProjectModal from '@/components/properties/CreateProjectModal';
import AddLeadModal from '@/components/leads/AddLeadModal';
import MasterPlanSVG from '@/components/properties/MasterPlanSVG';

interface Property {
  id: string;
  tenant_id: string;
  name: string;
  type: 'apartment' | 'house' | 'single_house' | 'twin_house' | 'townhome' | 'villa' | 'condo' | 'commercial';
  description: string;
  address: Record<string, any>;
  base_price: number;
  currency: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  images: string[];
  thumbnail_url?: string;
  total_units?: number;
  floor_count?: number;
  has_facilities?: boolean;
  developer?: string;
  is_active: boolean;
  is_featured?: boolean;
  created_at: string;
  master_plan_url?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  nearby?: { name: string; type: string; distance_km: number }[] | null;
}

interface Unit {
  id: string;
  project_id: string;
  unit_number: string;
  unit_type?: string;
  floor_number: number;
  building?: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  price_per_sqm?: number;
  layout_description?: string;
  facing_direction?: string;
  balcony?: boolean;
  garden?: boolean;
  pool?: boolean;
  parking_spaces?: number;
  images: string[];
  thumbnail_url?: string | null;
  status: 'available' | 'reserved' | 'sold' | 'unavailable';
  locked_by?: string | null;
  locked_until?: string | null;
  locked_by_name?: string | null;
  reserved_customer_name?: string | null;
  reserved_customer_phone?: string | null;
  reserved_customer_lead_id?: string | null;
  deposit_amount?: number | null;
  reservation_date?: string | null;
  reservation_notes?: string | null;
  promo_price?: number | null;
  plot_number?: string | null;
  view?: string | null;
  floor_plan_url?: string | null;
  tour_3d_url?: string | null;
  furnishing?: 'fully' | 'partial' | 'unfurnished' | null;
  land_area_sqw?: number | null;
  floor_count?: number | null;
  created_at?: string | null;
}

const PropertyManagement = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentTenant, userRole, user } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitSalesMap, setUnitSalesMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [unitSearchQuery, setUnitSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [bedroomsFilter, setBedroomsFilter] = useState<string>('all');
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [unitSortBy, setUnitSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'unit_number'>('newest');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [unitViewMode, setUnitViewMode] = useState<'grid' | 'list'>('grid');
  const [mySalesUnitIds, setMySalesUnitIds] = useState<Set<string>>(new Set());
  const [mySalesProjectIds, setMySalesProjectIds] = useState<Set<string>>(new Set());
  const [myAgentUnitIds, setMyAgentUnitIds] = useState<Set<string>>(new Set());
  const [masterPlanImgError, setMasterPlanImgError] = useState(false);
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [savingReserve, setSavingReserve] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    lead_id: '',
    deposit_amount: '',
    expiry_days: 14,
    notes: '',
  });
  const [allTenantLeads, setAllTenantLeads] = useState<any[]>([]);
  const [pendingEditUnitId, setPendingEditUnitId] = useState<string | null>(null);
  const [scrollProjectFormTo, setScrollProjectFormTo] = useState<'location' | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Tick every 30s so countdowns update without spamming render
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Returns { text, urgent, expired } for a locked_until ISO string
  const formatCountdown = (lockedUntil?: string | null) => {
    if (!lockedUntil) return null;
    const diff = new Date(lockedUntil).getTime() - now;
    if (diff <= 0) return { text: 'หมดอายุแล้ว', urgent: true, expired: true };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const urgent = diff < 86400000; // under 1 day
    if (days > 0) return { text: `${days} วัน ${hours} ชม.`, urgent, expired: false };
    if (hours > 0) return { text: `${hours} ชม. ${mins} นาที`, urgent, expired: false };
    return { text: `${mins} นาที`, urgent, expired: false };
  };

  // Map raw lead status (English) → Thai display label
  const leadStatusLabel = (status?: string | null): string => {
    if (!status) return '-';
    const map: Record<string, string> = {
      new: 'ใหม่',
      contacted: 'ติดต่อแล้ว',
      qualified: 'มีคุณสมบัติ',
      negotiating: 'กำลังเจรจา',
      negotiation: 'กำลังเจรจา',
      proposal: 'เสนอขาย',
      won: 'ปิดดีล',
      closed: 'ปิดการขาย',
      lost: 'สูญเสีย',
    };
    return map[status] || status;
  };

  const fetchAllTenantLeads = async () => {
    if (!currentTenant?.id) return;
    const { data, error } = await supabase
      .from('leads')
      .select('id, status, customer:customers(full_name, phone, email)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    if (!error) setAllTenantLeads(data || []);
  };

  const openReserveDialog = async () => {
    setBookingForm({
      lead_id: '',
      deposit_amount: '',
      expiry_days: 14,
      notes: '',
    });
    await fetchAllTenantLeads();
    setShowReserveDialog(true);
  };

  const handleReserveUnit = async () => {
    if (!viewingUnit || !user) return;

    if (!bookingForm.lead_id) {
      toast.error('กรุณาเลือก Lead');
      return;
    }
    const lead = allTenantLeads.find((l: any) => l.id === bookingForm.lead_id);
    if (!lead) {
      toast.error('ไม่พบ Lead ที่เลือก');
      return;
    }
    const customerName = lead.customer?.full_name || '';
    const customerPhone = lead.customer?.phone || '';
    const linkedLeadId: string = lead.id;

    if (!bookingForm.deposit_amount || parseFloat(bookingForm.deposit_amount) <= 0) {
      toast.error('กรุณากรอกจำนวนเงินจอง');
      return;
    }

    setSavingReserve(true);
    try {
      const nowDate = new Date();
      const lockedUntil = new Date(nowDate.getTime() + bookingForm.expiry_days * 86400000).toISOString();
      const updateData = {
        status: 'reserved',
        locked_by: user.id,
        locked_until: lockedUntil,
        reservation_date: nowDate.toISOString(),
        reserved_customer_name: customerName,
        reserved_customer_phone: customerPhone || null,
        reserved_customer_lead_id: linkedLeadId,
        deposit_amount: parseFloat(bookingForm.deposit_amount),
        reservation_notes: bookingForm.notes.trim() || null,
      };
      const { data, error } = await supabase
        .from('units')
        .update(updateData)
        .eq('id', viewingUnit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์บันทึกการจอง');

      // If linked to a lead → auto-update lead.status to 'won'
      // AND auto-create lead_interests row if this lead wasn't already linked to this unit
      if (linkedLeadId) {
        await supabase
          .from('leads')
          .update({ status: 'won' })
          .eq('id', linkedLeadId);

        const alreadyInterested = unitLeads.some((li: any) => li.leads?.id === linkedLeadId);
        if (!alreadyInterested) {
          await supabase
            .from('lead_interests')
            .insert({
              lead_id: linkedLeadId,
              unit_id: viewingUnit.id,
              property_id: viewingUnit.project_id,
              tenant_id: currentTenant?.id,
              interest_level: 'high',
              status: 'interested',
            });
        }
      }

      toast.success(`บันทึกการจองยูนิต ${viewingUnit.unit_number} สำหรับ ${customerName}`);
      setShowReserveDialog(false);
      if (selectedProperty) await fetchUnits(selectedProperty.id);
      await fetchUnitLeads(viewingUnit.id);
      setViewingUnit(prev => prev ? {
        ...prev,
        status: 'reserved',
        locked_by: user.id,
        locked_until: lockedUntil,
        locked_by_name: prev.locked_by_name || user.email || null,
        reservation_date: updateData.reservation_date,
        reserved_customer_name: updateData.reserved_customer_name,
        reserved_customer_phone: updateData.reserved_customer_phone,
        deposit_amount: updateData.deposit_amount,
        reservation_notes: updateData.reservation_notes,
      } : null);
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingReserve(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!viewingUnit) return;
    if (!confirm(`ปิดการขายยูนิต ${viewingUnit.unit_number}? (สถานะจะเปลี่ยนเป็น "ขายแล้ว" — เก็บข้อมูลผู้ซื้อไว้)`)) return;
    try {
      const { data, error } = await supabase
        .from('units')
        .update({
          status: 'sold',
          locked_until: null, // remove timer
        })
        .eq('id', viewingUnit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ปิดการขาย');

      // Sync linked lead → won (if not already)
      if (viewingUnit.reserved_customer_lead_id) {
        await supabase
          .from('leads')
          .update({ status: 'won' })
          .eq('id', viewingUnit.reserved_customer_lead_id);
      }

      toast.success(`ปิดการขายยูนิต ${viewingUnit.unit_number} สำเร็จ`);
      if (selectedProperty) await fetchUnits(selectedProperty.id);
      setViewingUnit(prev => prev ? { ...prev, status: 'sold', locked_until: null } : null);
    } catch (err: any) {
      toast.error(err.message || 'ปิดการขายไม่สำเร็จ');
    }
  };

  const handleCancelReservation = async () => {
    if (!viewingUnit) return;
    if (!confirm('ยกเลิกการจองยูนิตนี้? (ข้อมูลผู้จอง + เงินจองจะถูกลบ)')) return;
    try {
      const { data, error } = await supabase
        .from('units')
        .update({
          status: 'available',
          locked_by: null,
          locked_until: null,
          reservation_date: null,
          reserved_customer_name: null,
          reserved_customer_phone: null,
          reserved_customer_lead_id: null,
          deposit_amount: null,
          reservation_notes: null,
        })
        .eq('id', viewingUnit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ยกเลิก');
      toast.success(`ยกเลิกจองยูนิต ${viewingUnit.unit_number}`);
      if (selectedProperty) await fetchUnits(selectedProperty.id);
      setViewingUnit(prev => prev ? {
        ...prev,
        status: 'available',
        locked_by: null,
        locked_until: null,
        locked_by_name: null,
        reservation_date: null,
        reserved_customer_name: null,
        reserved_customer_phone: null,
        deposit_amount: null,
        reservation_notes: null,
      } : null);
    } catch (err: any) {
      toast.error(err.message || 'ยกเลิกไม่สำเร็จ');
    }
  };

  // Dialog states
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showUnitDetailDialog, setShowUnitDetailDialog] = useState(false);
  const [showDeleteUnitDialog, setShowDeleteUnitDialog] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [selectedUnitForLead, setSelectedUnitForLead] = useState<{ propertyId: string; propertyName: string; unitId: string; unitNumber: string } | null>(null);
  const [unitLeads, setUnitLeads] = useState<any[]>([]);
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});
  const [projectAggregates, setProjectAggregates] = useState<{
    totalUnits: number;
    availableUnits: number;
    soldUnits: number;
    reservedUnits: number;
    totalValue: number;
  }>({ totalUnits: 0, availableUnits: 0, soldUnits: 0, reservedUnits: 0, totalValue: 0 });

  // Form states
  // Note: propertyForm state removed — CreateProjectModal manages its own form state
  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '',
    size_sqm: '',
    land_area_sqw: '',
    bedrooms: '',
    bathrooms: '',
    floor_count: '',
    price: '',
    thumbnail: null as File | null,
    thumbnail_preview: '',
    image_items: [] as { url: string; file?: File }[],
    description: '',
    status: 'available' as Unit['status'],
    promo_price: '',
    plot_number: '',
    view: '',
    furnishing: '' as '' | 'fully' | 'partial' | 'unfurnished',
    floor_plan_url: '',
    tour_3d_url: '',
    parking_spaces: '',
    facing_direction: '',
    building: '',
    pool: false,
    garden: false,
    balcony: false
  });

  useEffect(() => {
    if (currentTenant) {
      fetchProperties();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (selectedProperty) {
      fetchUnits(selectedProperty.id);
    }
  }, [selectedProperty]);

  // Fetch min prices when properties are loaded
  useEffect(() => {
    if (properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      fetchMinPrices(propertyIds);
    }
  }, [properties]);

  // Auto-select project from URL ?project=<id> (used when returning from Unit Detail)
  // Also handles ?editProject=1 (open project edit) and ?editUnit=<id> (open unit edit)
  useEffect(() => {
    const projectId = searchParams.get('project');
    const editProject = searchParams.get('editProject');
    const editUnitId = searchParams.get('editUnit');
    if (!projectId || properties.length === 0) return;

    const target = properties.find((p) => p.id === projectId);
    if (!target) return;

    setSelectedProperty(target);
    if (editProject === '1') {
      setEditingProperty(target);
      setShowPropertyDialog(true);
      setScrollProjectFormTo('location');
    }
    if (editUnitId) {
      setPendingEditUnitId(editUnitId);
    }

    // Strip handled params (editUnit stripped after consumed below)
    searchParams.delete('project');
    if (editProject) searchParams.delete('editProject');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, properties]);

  // Consume pending editUnit once units are loaded
  useEffect(() => {
    if (!pendingEditUnitId || units.length === 0) return;
    const unitToEdit = units.find((u) => u.id === pendingEditUnitId);
    if (unitToEdit) {
      handleEditUnit(unitToEdit);
      setPendingEditUnitId(null);
      searchParams.delete('editUnit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [pendingEditUnitId, units]);

  // Reset master plan image error when switching unit/project
  useEffect(() => {
    setMasterPlanImgError(false);
  }, [viewingUnit?.id, selectedProperty?.master_plan_url]);

  // Sales: fetch own designated units + projects so we can gate edit/delete actions
  useEffect(() => {
    if (userRole !== 'sales' || !user?.id) {
      setMySalesUnitIds(new Set());
      setMySalesProjectIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const [unitRes, projRes] = await Promise.all([
        supabase.from('sales_unit_assignments')
          .select('unit_id')
          .eq('sales_user_id', user.id)
          .is('revoked_at', null),
        supabase.from('sales_project_assignments')
          .select('project_id')
          .eq('sales_user_id', user.id)
          .is('revoked_at', null),
      ]);
      if (cancelled) return;
      if (!unitRes.error && unitRes.data) {
        setMySalesUnitIds(new Set(unitRes.data.map((r: any) => r.unit_id)));
      }
      if (!projRes.error && projRes.data) {
        setMySalesProjectIds(new Set(projRes.data.map((r: any) => r.project_id)));
      }
    })();
    return () => { cancelled = true; };
  }, [userRole, user?.id]);

  // Agent: fetch own assigned units
  useEffect(() => {
    if (userRole !== 'agent' || !user?.id) {
      setMyAgentUnitIds(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('agent_unit_assignments')
        .select('unit_id')
        .eq('agent_user_id', user.id)
        .is('revoked_at', null);
      if (!cancelled && !error && data) {
        setMyAgentUnitIds(new Set(data.map((r: any) => r.unit_id)));
      }
    })();
    return () => { cancelled = true; };
  }, [userRole, user?.id]);

  const canManageUnit = (unitId: string, projectId?: string): boolean => {
    if (userRole === 'owner' || userRole === 'admin') return true;
    if (userRole === 'sales') {
      if (mySalesUnitIds.has(unitId)) return true;
      if (projectId && mySalesProjectIds.has(projectId)) return true;
      return false;
    }
    if (userRole === 'agent') return myAgentUnitIds.has(unitId);
    return false;
  };

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Fetch from properties table
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
      }

      // Also fetch from projects table (for THE FORESTIAS and similar)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
      }

      // Map projects to Property interface
      const mappedProjects: Property[] = (projectsData || []).map((project: any) => ({
        id: project.id,
        tenant_id: project.tenant_id,
        name: project.name,
        type: 'condo' as const,
        description: project.description || '',
        address: project.address || {},
        base_price: project.price_min || 0,
        currency: 'THB',
        max_guests: 0,
        bedrooms: 0,
        bathrooms: 0,
        size_sqft: 0,
        images: project.images || [],
        thumbnail_url: project.thumbnail_url,
        total_units: project.total_units,
        floor_count: project.floor_count,
        has_facilities: project.has_facilities,
        developer: project.developer,
        is_active: project.is_active ?? true,
        is_featured: project.is_featured,
        created_at: project.created_at
      }));

      // Dedupe by id: same project may exist in both tables with same UUID.
      // Prefer projects entry (has richer fields like total_units, developer, FK to units).
      const propertiesMap = new Map<string, Property>();
      for (const p of (propertiesData || [])) {
        propertiesMap.set(p.id, p);
      }
      for (const p of mappedProjects) {
        propertiesMap.set(p.id, p);
      }
      setProperties(Array.from(propertiesMap.values()));
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('project_id', projectId)
        .order('unit_number', { ascending: true });

      // Fetch reservation user names separately (no FK so can't embed via PostgREST)
      const reservedByIds = Array.from(
        new Set((data || []).map((u: any) => u.locked_by).filter(Boolean))
      );
      const reservedByMap: Record<string, string> = {};
      if (reservedByIds.length > 0) {
        const { data: usersData } = await supabase
          .from('users')
          .select('id, full_name, email')
          .in('id', reservedByIds);
        (usersData || []).forEach((u: any) => {
          reservedByMap[u.id] = u.full_name || u.email;
        });
      }

      if (error) {
        console.error('Error fetching units:', error);
        setUnits([]);
        return;
      }

      // Map database response to Unit interface
      const mappedUnits: Unit[] = (data || []).map((unit: any) => ({
        id: unit.id,
        project_id: unit.project_id,
        unit_number: unit.unit_number,
        unit_type: unit.unit_type,
        floor_number: unit.floor_number || 0,
        building: unit.building,
        area_sqm: unit.area_sqm || 0,
        bedrooms: unit.bedrooms || 0,
        bathrooms: unit.bathrooms || 0,
        price: unit.price || 0,
        price_per_sqm: unit.price_per_sqm,
        layout_description: unit.layout_description,
        facing_direction: unit.facing_direction,
        balcony: unit.balcony || false,
        garden: unit.garden || false,
        pool: unit.pool || false,
        parking_spaces: unit.parking_spaces || 0,
        images: unit.images || [],
        thumbnail_url: unit.thumbnail_url,
        status: unit.status || 'available',
        locked_by: unit.locked_by,
        locked_until: unit.locked_until,
        locked_by_name: unit.locked_by ? (reservedByMap[unit.locked_by] || null) : null,
        reserved_customer_name: unit.reserved_customer_name,
        reserved_customer_phone: unit.reserved_customer_phone,
        reserved_customer_lead_id: unit.reserved_customer_lead_id,
        deposit_amount: unit.deposit_amount,
        reservation_date: unit.reservation_date,
        reservation_notes: unit.reservation_notes,
        promo_price: unit.promo_price,
        plot_number: unit.plot_number,
        view: unit.view,
        floor_plan_url: unit.floor_plan_url,
        tour_3d_url: unit.tour_3d_url,
        furnishing: unit.furnishing,
        land_area_sqw: unit.land_area_sqw,
        floor_count: unit.floor_count,
      }));

      setUnits(mappedUnits);

      // Fetch sales assignments for these units (for Admin/Owner to see who's responsible)
      if (mappedUnits.length > 0 && (userRole === 'owner' || userRole === 'admin')) {
        const unitIds = mappedUnits.map((u: Unit) => u.id);
        const { data: assignments } = await supabase
          .from('sales_unit_assignments')
          .select('unit_id, sales_user_id')
          .in('unit_id', unitIds)
          .is('revoked_at', null);
        const salesIds = Array.from(new Set((assignments || []).map((a: any) => a.sales_user_id).filter(Boolean)));
        let nameById: Record<string, string> = {};
        if (salesIds.length > 0) {
          const { data: salesUsers } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', salesIds);
          (salesUsers || []).forEach((u: any) => {
            nameById[u.id] = u.full_name || u.email || '(ไม่มีชื่อ)';
          });
        }
        const map: Record<string, string[]> = {};
        (assignments || []).forEach((a: any) => {
          const name = nameById[a.sales_user_id];
          if (!name) return;
          if (!map[a.unit_id]) map[a.unit_id] = [];
          map[a.unit_id].push(name);
        });
        setUnitSalesMap(map);
      } else {
        setUnitSalesMap({});
      }
    } catch (error) {
      console.error('Error fetching units:', error);
      setUnits([]);
    }
  };

  // Fetch unit aggregates (min price per project + global counts/value) for all properties
  const fetchMinPrices = async (propertyIds: string[]) => {
    if (!currentTenant || propertyIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('units')
        .select('project_id, price, status')
        .eq('tenant_id', currentTenant.id)
        .in('project_id', propertyIds);

      if (error) {
        console.error('Error fetching unit aggregates:', error);
        return;
      }

      // Min price per project (positive prices only)
      const priceMap: Record<string, number> = {};
      let totalUnits = 0;
      let availableUnits = 0;
      let soldUnits = 0;
      let reservedUnits = 0;
      let totalValue = 0;
      (data || []).forEach((unit: { project_id: string; price: number; status: string }) => {
        totalUnits += 1;
        if (unit.status === 'available') availableUnits += 1;
        else if (unit.status === 'sold') soldUnits += 1;
        else if (unit.status === 'reserved') reservedUnits += 1;
        totalValue += Number(unit.price) || 0;
        if (unit.price && unit.price > 0) {
          if (!priceMap[unit.project_id] || unit.price < priceMap[unit.project_id]) {
            priceMap[unit.project_id] = unit.price;
          }
        }
      });

      setMinPrices(priceMap);
      setProjectAggregates({ totalUnits, availableUnits, soldUnits, reservedUnits, totalValue });
    } catch (error) {
      console.error('Error fetching min prices:', error);
    }
  };

  // Format price as abbreviated Thai Baht (e.g., 2.5 ล้านบาท)
  const formatPriceShort = (amount?: number) => {
    if (!amount) return "-";
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      return `${millions.toFixed(1)} ล้านบาท`;
    } else if (amount >= 1000) {
      const thousands = amount / 1000;
      return `${thousands.toFixed(0)} พันบาท`;
    }
    return `${amount.toFixed(0)} บาท`;
  };

  // Note: handleSaveProperty was removed — CreateProjectModal handles its own save logic
  const [savingUnit, setSavingUnit] = useState(false);

  const handleSaveUnit = async () => {
    if (!selectedProperty || !currentTenant) return;

    setSavingUnit(true);
    try {
      // Upload thumbnail if exists
      let thumbnailUrl: string | null = null;
      if (unitForm.thumbnail) {
        thumbnailUrl = await uploadUnitImage(unitForm.thumbnail, 'thumbnails');
      }

      // Build final gallery image URLs — keep existing URLs in order, upload new files,
      // and respect any removals the user made in the form.
      const finalImageUrls: string[] = [];
      for (const item of unitForm.image_items) {
        if (item.file) {
          const url = await uploadUnitImage(item.file, 'gallery');
          if (url) finalImageUrls.push(url);
        } else if (item.url) {
          finalImageUrls.push(item.url);
        }
      }

      const unitData: Record<string, any> = {
        tenant_id: currentTenant.id,
        project_id: selectedProperty.id,
        unit_number: unitForm.unit_number,
        floor_number: unitForm.floor ? parseInt(unitForm.floor) : null,
        area_sqm: unitForm.size_sqm ? parseFloat(unitForm.size_sqm) : null,
        land_area_sqw: unitForm.land_area_sqw ? parseFloat(unitForm.land_area_sqw) : null,
        bedrooms: unitForm.bedrooms ? parseInt(unitForm.bedrooms) : 0,
        bathrooms: unitForm.bathrooms ? parseInt(unitForm.bathrooms) : 0,
        floor_count: unitForm.floor_count ? parseInt(unitForm.floor_count) : 1,
        price: parseFloat(unitForm.price),
        layout_description: unitForm.description || null,
        status: unitForm.status,
        promo_price: unitForm.promo_price ? parseFloat(unitForm.promo_price) : null,
        plot_number: unitForm.plot_number || null,
        view: unitForm.view || null,
        furnishing: unitForm.furnishing || null,
        floor_plan_url: unitForm.floor_plan_url || null,
        tour_3d_url: unitForm.tour_3d_url || null,
        parking_spaces: unitForm.parking_spaces ? parseInt(unitForm.parking_spaces) : 0,
        facing_direction: unitForm.facing_direction || null,
        building: unitForm.building || null,
        pool: unitForm.pool,
        garden: unitForm.garden,
        balcony: unitForm.balcony
      };

      // Only write thumbnail_url if a new file was uploaded; otherwise preserve existing.
      // On insert (no editingUnit), always set so new rows get the URL (or null).
      if (thumbnailUrl) {
        unitData.thumbnail_url = thumbnailUrl;
      } else if (!editingUnit) {
        unitData.thumbnail_url = null;
      }

      // Always write the final images array — reflects user's add/remove choices.
      // (Pre-existing kept items are included alongside newly uploaded ones.)
      unitData.images = finalImageUrls;

      let unitId: string | undefined;

      if (editingUnit) {
        const { data, error } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', editingUnit.id)
          .select('id');

        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('คุณไม่มีสิทธิ์แก้ไขยูนิตนี้ — ติดต่อแอดมินเพื่อมอบหมายสิทธิ์');
        }
        unitId = editingUnit.id;

        // Log activity for unit update
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant.id,
            p_user_id: null,
            p_activity_type: 'unit_updated',
            p_description: `แก้ไขยูนิต: ${unitForm.unit_number} (${selectedProperty.name})`,
            p_metadata: {
              unit_id: editingUnit.id,
              project_id: selectedProperty.id,
              project_name: selectedProperty.name,
              unit_number: unitForm.unit_number,
              status: unitForm.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      } else {
        console.log('Inserting unit data:', unitData);
        const { data, error } = await supabase
          .from('units')
          .insert(unitData)
          .select();

        console.log('Insert result:', { data, error });
        if (error) throw error;
        unitId = data?.[0]?.id;

        // Log activity for unit creation
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant.id,
            p_user_id: null,
            p_activity_type: 'unit_created',
            p_description: `สร้างยูนิตใหม่: ${unitForm.unit_number} (${selectedProperty.name})`,
            p_metadata: {
              unit_id: unitId,
              project_id: selectedProperty.id,
              project_name: selectedProperty.name,
              unit_number: unitForm.unit_number,
              status: unitForm.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      }

      setShowUnitDialog(false);
      setEditingUnit(null);
      resetUnitForm();
      fetchUnits(selectedProperty.id);
      toast.success(editingUnit ? `แก้ไขยูนิต ${unitForm.unit_number} สำเร็จ` : `เพิ่มยูนิต ${unitForm.unit_number} สำเร็จ`);
    } catch (error: any) {
      console.error('Error saving unit:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการบันทึกยูนิต');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    try {
      const { error } = await supabase.from('properties').delete().eq('id', selectedProperty.id);
      if (error) throw error;

      // Log activity for property deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: null,
          p_activity_type: 'property_deleted',
          p_description: `ลบโครงการ: ${selectedProperty.name}`,
          p_metadata: {
            property_id: selectedProperty.id,
            property_name: selectedProperty.name,
            type: selectedProperty.type
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      const deletedName = selectedProperty.name;
      setShowDeleteDialog(false);
      setSelectedProperty(null);
      fetchProperties();
      toast.success(`ลบโครงการ "${deletedName}" สำเร็จ`);
    } catch (error: any) {
      console.error('Error deleting property:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบโครงการ');
    }
  };

  const resetUnitForm = () => {
    // Revoke blob URLs (created from File) to prevent memory leaks. Skip remote URLs.
    if (unitForm.thumbnail_preview?.startsWith('blob:')) {
      URL.revokeObjectURL(unitForm.thumbnail_preview);
    }
    unitForm.image_items.forEach(item => {
      if (item.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    });

    setUnitForm({
      unit_number: '',
      floor: '',
      size_sqm: '',
      land_area_sqw: '',
      bedrooms: '',
      bathrooms: '',
      floor_count: '',
      price: '',
      thumbnail: null,
      thumbnail_preview: '',
      image_items: [],
      description: '',
      status: 'available',
      promo_price: '',
      plot_number: '',
      view: '',
      furnishing: '',
      floor_plan_url: '',
      tour_3d_url: '',
      parking_spaces: '',
      facing_direction: '',
      building: '',
      pool: false,
      garden: false,
      balcony: false
    });
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous URL
      if (unitForm.thumbnail_preview) {
        URL.revokeObjectURL(unitForm.thumbnail_preview);
      }
      const previewUrl = URL.createObjectURL(file);
      setUnitForm(prev => ({
        ...prev,
        thumbnail: file,
        thumbnail_preview: previewUrl
      }));
    }
  };

  const removeThumbnail = () => {
    if (unitForm.thumbnail_preview) {
      URL.revokeObjectURL(unitForm.thumbnail_preview);
    }
    setUnitForm(prev => ({
      ...prev,
      thumbnail: null,
      thumbnail_preview: ''
    }));
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newItems = files.map(file => ({ url: URL.createObjectURL(file), file }));
      setUnitForm(prev => ({
        ...prev,
        image_items: [...prev.image_items, ...newItems]
      }));
    }
  };

  const removeImage = (index: number) => {
    const item = unitForm.image_items[index];
    if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setUnitForm(prev => ({
      ...prev,
      image_items: prev.image_items.filter((_, i) => i !== index)
    }));
  };

  // Handle edit unit - populate form with unit data
  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitForm({
      unit_number: unit.unit_number,
      floor: unit.floor_number?.toString() || '',
      size_sqm: unit.area_sqm?.toString() || '',
      land_area_sqw: unit.land_area_sqw?.toString() || '',
      bedrooms: unit.bedrooms?.toString() || '',
      bathrooms: unit.bathrooms?.toString() || '',
      floor_count: unit.floor_count?.toString() || '',
      price: unit.price?.toString() || '',
      thumbnail: null,
      thumbnail_preview: unit.thumbnail_url || '',
      image_items: (unit.images || []).map(url => ({ url })),
      description: unit.layout_description || '',
      status: unit.status,
      promo_price: unit.promo_price?.toString() || '',
      plot_number: unit.plot_number || '',
      view: unit.view || '',
      furnishing: (unit.furnishing as any) || '',
      floor_plan_url: unit.floor_plan_url || '',
      tour_3d_url: unit.tour_3d_url || '',
      parking_spaces: unit.parking_spaces?.toString() || '',
      facing_direction: unit.facing_direction || '',
      building: unit.building || '',
      pool: !!unit.pool,
      garden: !!unit.garden,
      balcony: !!unit.balcony
    });
    setShowUnitDialog(true);
  };

  // Fetch leads interested in a specific unit
  const fetchUnitLeads = async (unitId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_interests')
        .select(`
          *,
          leads:lead_id (
            id,
            status,
            source,
            notes,
            created_at,
            customers:customer_id (
              id,
              full_name,
              email,
              phone
            ),
            users:assigned_to (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('unit_id', unitId)
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUnitLeads(data || []);
    } catch (err) {
      console.error('Error fetching unit leads:', err);
      setUnitLeads([]);
    }
  };

  // Handle view unit details
  const handleViewUnit = (unit: Unit) => {
    // Navigate to dedicated unit detail page (full-page view)
    navigate(`/units/${unit.id}`);
  };

  // Handle add lead from unit
  const handleAddLeadFromUnit = (unit: Unit) => {
    if (!selectedProperty) return;

    setSelectedUnitForLead({
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.name,
      unitId: unit.id,
      unitNumber: unit.unit_number
    });
    setShowAddLeadModal(true);
  };

  // Handle lead created — refresh unit leads if viewing a unit, else navigate
  const handleLeadCreated = async () => {
    setShowAddLeadModal(false);
    setSelectedUnitForLead(null);
    if (viewingUnit) {
      await fetchUnitLeads(viewingUnit.id);
      toast.success('เพิ่ม Lead สำเร็จ — เลือกได้ใน "บันทึกการจอง"');
    } else {
      navigate('/leads');
    }
  };

  // Handle delete unit confirmation
  const handleDeleteUnitClick = (unit: Unit) => {
    setDeletingUnit(unit);
    setShowDeleteUnitDialog(true);
  };

  // Handle delete unit
  const handleDeleteUnit = async () => {
    if (!deletingUnit || !selectedProperty) return;

    try {
      const { data, error } = await supabase
        .from('units')
        .delete()
        .eq('id', deletingUnit.id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('คุณไม่มีสิทธิ์ลบยูนิตนี้ — เฉพาะ Owner เท่านั้น');
      }

      // Log activity for unit deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant!.id,
          p_user_id: null,
          p_activity_type: 'unit_deleted',
          p_description: `ลบยูนิต: ${deletingUnit.unit_number} (${selectedProperty.name})`,
          p_metadata: {
            unit_id: deletingUnit.id,
            project_id: selectedProperty.id,
            project_name: selectedProperty.name,
            unit_number: deletingUnit.unit_number
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      const deletedUnitNumber = deletingUnit.unit_number;
      setShowDeleteUnitDialog(false);
      setDeletingUnit(null);
      fetchUnits(selectedProperty.id);
      toast.success(`ลบยูนิต ${deletedUnitNumber} สำเร็จ`);
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      toast.error(error.message || 'เกิดข้อผิดพลาดในการลบยูนิต');
    }
  };

  // Upload image to Supabase Storage
  const uploadUnitImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant?.id}/${selectedProperty?.id}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('units')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('units')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: 'อพาร์ตเมนท์',
      house: 'บ้านเดี่ยว',
      single_house: 'บ้านเดี่ยว',
      twin_house: 'บ้านแฝด',
      townhome: 'ทาวน์โฮม',
      villa: 'วิลล่า',
      condo: 'คอนโด',
      commercial: 'อาคารพาณิชย์'
    };
    return labels[type] || type;
  };

  const getUnitStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      available: { label: 'ว่าง', variant: 'default' },
      reserved: { label: 'จอง', variant: 'secondary' },
      sold: { label: 'ขายแล้ว', variant: 'destructive' },
      unavailable: { label: 'ไม่ว่าง', variant: 'outline' }
    };
    const badge = badges[status] || badges.available;
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredUnits = units.filter(unit => {
    // Search by unit number
    const matchesSearch = unitSearchQuery === '' ||
      unit.unit_number.toLowerCase().includes(unitSearchQuery.toLowerCase());
    // Status
    const matchesStatus = statusFilter === 'all' || unit.status === statusFilter;
    // Price buckets
    const priceMillion = (unit.promo_price || unit.price) / 1_000_000;
    const matchesPrice =
      priceFilter === 'all' ||
      (priceFilter === 'under-3m' && priceMillion < 3) ||
      (priceFilter === '3m-5m' && priceMillion >= 3 && priceMillion < 5) ||
      (priceFilter === '5m-10m' && priceMillion >= 5 && priceMillion <= 10) ||
      (priceFilter === '10m-20m' && priceMillion > 10 && priceMillion <= 20) ||
      (priceFilter === 'over-20m' && priceMillion > 20);
    // Bedrooms
    const bed = unit.bedrooms || 0;
    const matchesBedrooms =
      bedroomsFilter === 'all' ||
      (bedroomsFilter === '1' && bed === 1) ||
      (bedroomsFilter === '2' && bed === 2) ||
      (bedroomsFilter === '3' && bed === 3) ||
      (bedroomsFilter === '4+' && bed >= 4);
    // Sales filter (Admin/Owner view only)
    const salesList = unitSalesMap[unit.id] || [];
    const matchesSales =
      salesFilter === 'all' ||
      (salesFilter === 'none' && salesList.length === 0) ||
      (salesFilter !== 'all' && salesFilter !== 'none' && salesList.includes(salesFilter));
    return matchesSearch && matchesStatus && matchesPrice && matchesBedrooms && matchesSales;
  });

  // Apply sort to filtered units
  const sortedUnits = [...filteredUnits].sort((a, b) => {
    const priceA = a.promo_price || a.price || 0;
    const priceB = b.promo_price || b.price || 0;
    switch (unitSortBy) {
      case 'price_asc':
        return priceA - priceB;
      case 'price_desc':
        return priceB - priceA;
      case 'unit_number':
        return (a.unit_number || '').localeCompare(b.unit_number || '', 'th', { numeric: true });
      case 'newest':
      default:
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    }
  });

  // Count active advanced filters (for the toggle badge)
  const activeAdvancedCount = [
    priceFilter !== 'all',
    bedroomsFilter !== 'all',
    salesFilter !== 'all',
  ].filter(Boolean).length;

  // Distinct sales names in this project (for Sales filter)
  const salesNameOptions = Array.from(
    new Set(Object.values(unitSalesMap).flat())
  ).sort();

  const clearAdvancedFilters = () => {
    setPriceFilter('all');
    setBedroomsFilter('all');
    setSalesFilter('all');
  };

  // Calculate stats for selected property's units
  const totalUnits = units.length;
  const availableUnits = units.filter(u => u.status === 'available').length;
  const soldUnits = units.filter(u => u.status === 'sold').length;
  const totalValue = units.reduce((sum, u) => sum + u.price, 0);

  // Calculate stats for all projects (project list view) — based on actual units in DB
  const projectStats = {
    totalUnits: projectAggregates.totalUnits,
    availableUnits: projectAggregates.availableUnits,
    soldUnits: projectAggregates.soldUnits,
    reservedUnits: projectAggregates.reservedUnits,
    totalValue: projectAggregates.totalValue,
  };

  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>กรุณาเลือกบริษัทก่อน</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6">
          <ViewPropertiesGuard>
            <div className="space-y-6">
              {/* Header */}
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">โครงการ</h1>
                        <p className="text-gray-600 mt-1">
                          จัดการโครงการอสังหาและยูนิตทั้งหมดของบริษัท
                        </p>
                      </div>
                    </div>
                    <ManagePropertiesGuard fallback={null} showMessage={false}>
                      <Button
                        onClick={() => {
                          setEditingProperty(null);
                          setShowPropertyDialog(true);
                        }}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มโครงการใหม่
                      </Button>
                    </ManagePropertiesGuard>
                  </div>
                </CardContent>
              </Card>

        {/* Property List or Units */}
        {!selectedProperty ? (
          // Properties List
          <>
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    โครงการทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{properties.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {projectStats.totalUnits.toLocaleString()} ยูนิต
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ยูนิตทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {projectStats.totalUnits.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    จาก {properties.length} โครงการ
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    โครงการที่เปิดขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {properties.filter(p => p.is_active).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {properties.length > 0
                      ? Math.round((properties.filter(p => p.is_active).length / properties.length) * 100)
                      : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    มูลค่ารวม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(projectStats.totalValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    รวมราคายูนิตทุกหลังในระบบ
                  </p>
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
                      placeholder="ค้นหาโครงการ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      <SelectItem value="condo">คอนโด</SelectItem>
                      <SelectItem value="single_house">บ้านเดี่ยว</SelectItem>
                      <SelectItem value="twin_house">บ้านแฝด</SelectItem>
                      <SelectItem value="townhome">ทาวน์โฮม</SelectItem>
                      <SelectItem value="villa">วิลล่า</SelectItem>
                      <SelectItem value="apartment">อพาร์ตเมนท์</SelectItem>
                      <SelectItem value="commercial">อาคารพาณิชย์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Properties Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>ไม่พบโครงการ</p>
                </div>
              ) : (
                filteredProperties.map((property) => (
                  <Card
                    key={property.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => setSelectedProperty(property)}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative h-48 bg-gray-100">
                      {property.thumbnail_url ? (
                        <img
                          src={property.thumbnail_url}
                          alt={property.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-16 h-16 text-gray-300" />
                        </div>
                      )}
                      {property.is_featured && (
                        <Badge className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600">
                          แนะนำ
                        </Badge>
                      )}
                      <Badge variant="outline" className="absolute top-2 right-2 bg-white/90">
                        {getPropertyTypeLabel(property.type)}
                      </Badge>
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">{property.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {property.address?.district || '-'} {property.address?.province ? `, ${property.address.province}` : ''}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {property.total_units ? (
                            <div className="flex items-center gap-1">
                              <Home className="w-4 h-4" />
                              {property.total_units} ยูนิต
                            </div>
                          ) : null}
                          {property.floor_count ? (
                            <div className="flex items-center gap-1">
                              <Layers className="w-4 h-4" />
                              {property.floor_count} ชั้น
                            </div>
                          ) : null}
                          {property.developer && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {property.developer}
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">ราคาเริ่มต้น</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatPriceShort(minPrices[property.id] || property.base_price)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          // Units View
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="outline" onClick={() => setSelectedProperty(null)}>
              ← กลับไปรายการโครงการ
            </Button>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedProperty.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {selectedProperty.address?.district || '-'} {selectedProperty.address?.province ? `, ${selectedProperty.address.province}` : ''}
                    </CardDescription>
                  </div>
                  <ManagePropertiesGuard fallback={null} showMessage={false}>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${selectedProperty.id}/plans`)}>
                        <MapPin className="w-4 h-4 mr-2" />
                        ผังโครงการ
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => navigate(`/properties/${selectedProperty.id}/edit`)}>
                        <Edit className="w-4 h-4 mr-2" />
                        แก้ไข
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                        <Trash2 className="w-4 h-4 mr-2" />
                        ลบ
                      </Button>
                    </div>
                  </ManagePropertiesGuard>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{selectedProperty.description || '-'}</p>
              </CardContent>
            </Card>

            {/* Units Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ยูนิตทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUnits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ว่างขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{availableUnits}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ขายแล้ว
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{soldUnits}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUnits > 0 ? Math.round((soldUnits / totalUnits) * 100) : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    มูลค่ารวม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(totalValue)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Units Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาเลขที่ยูนิต..."
                    value={unitSearchQuery}
                    onChange={(e) => setUnitSearchQuery(e.target.value)}
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="available">ว่าง</SelectItem>
                    <SelectItem value="reserved">จอง</SelectItem>
                    <SelectItem value="sold">ขายแล้ว</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={unitSortBy} onValueChange={(v) => setUnitSortBy(v as typeof unitSortBy)}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="เรียงลำดับ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">ล่าสุดก่อน</SelectItem>
                    <SelectItem value="price_asc">ราคาน้อย → มาก</SelectItem>
                    <SelectItem value="price_desc">ราคามาก → น้อย</SelectItem>
                    <SelectItem value="unit_number">เลขยูนิต (ก-ฮ / 0-9)</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant={showAdvancedFilter || activeAdvancedCount > 0 ? "default" : "outline"}
                  onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
                  className={cn("relative", (showAdvancedFilter || activeAdvancedCount > 0) && "bg-chateau hover:bg-chateau/90 text-white")}
                >
                  <Filter className="w-4 h-4 mr-1" />
                  ตัวกรอง
                  {activeAdvancedCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white text-chateau text-xs font-bold">
                      {activeAdvancedCount}
                    </span>
                  )}
                </Button>
                <div className="inline-flex rounded-md border border-gray-200 bg-white p-0.5 ml-auto">
                  <button
                    type="button"
                    onClick={() => setUnitViewMode('grid')}
                    aria-pressed={unitViewMode === 'grid'}
                    title="แสดงแบบกริด"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                      unitViewMode === 'grid'
                        ? 'bg-chateau text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    Grid
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitViewMode('list')}
                    aria-pressed={unitViewMode === 'list'}
                    title="แสดงแบบรายการ"
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded transition-colors ${
                      unitViewMode === 'list'
                        ? 'bg-chateau text-white shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <List className="w-3.5 h-3.5" />
                    List
                  </button>
                </div>
              </div>
              <ManagePropertiesGuard fallback={null} showMessage={false}>
                <Button onClick={() => {
                  resetUnitForm();
                  setShowUnitDialog(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มยูนิตใหม่
                </Button>
              </ManagePropertiesGuard>
            </div>

            {/* Advanced Filter Row — expandable */}
            {showAdvancedFilter && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Filter className="w-4 h-4 text-chateau" />
                    ตัวกรองขั้นสูง
                    {activeAdvancedCount > 0 && (
                      <span className="px-2 py-0.5 bg-chateau/10 text-chateau text-xs font-semibold rounded-full">
                        ใช้ {activeAdvancedCount} ตัวกรอง
                      </span>
                    )}
                  </div>
                  {activeAdvancedCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearAdvancedFilters}
                      className="text-xs text-gray-600 hover:text-red-600 h-7"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      ล้างตัวกรอง
                    </Button>
                  )}
                </div>
                <div className={cn(
                  "grid gap-3",
                  (userRole === 'owner' || userRole === 'admin')
                    ? "grid-cols-1 sm:grid-cols-3"
                    : "grid-cols-1 sm:grid-cols-2"
                )}>
                  {/* Price Range */}
                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">ช่วงราคา</Label>
                    <Select value={priceFilter} onValueChange={setPriceFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="ทุกช่วงราคา" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกช่วงราคา</SelectItem>
                        <SelectItem value="under-3m">น้อยกว่า 3 ล้าน</SelectItem>
                        <SelectItem value="3m-5m">3 - 5 ล้าน</SelectItem>
                        <SelectItem value="5m-10m">5 - 10 ล้าน</SelectItem>
                        <SelectItem value="10m-20m">10 - 20 ล้าน</SelectItem>
                        <SelectItem value="over-20m">มากกว่า 20 ล้าน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bedrooms */}
                  <div>
                    <Label className="text-xs text-gray-600 mb-1.5 block">จำนวนห้องนอน</Label>
                    <Select value={bedroomsFilter} onValueChange={setBedroomsFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="ทุกแบบ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทุกแบบ</SelectItem>
                        <SelectItem value="1">1 ห้องนอน</SelectItem>
                        <SelectItem value="2">2 ห้องนอน</SelectItem>
                        <SelectItem value="3">3 ห้องนอน</SelectItem>
                        <SelectItem value="4+">4 ห้องนอนขึ้นไป</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sales Responsible — Admin/Owner only */}
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <div>
                      <Label className="text-xs text-gray-600 mb-1.5 block">Sales รับผิดชอบ</Label>
                      <Select value={salesFilter} onValueChange={setSalesFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="ทั้งหมด" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">ทั้งหมด</SelectItem>
                          <SelectItem value="none">ยังไม่มอบหมาย</SelectItem>
                          {salesNameOptions.map((name) => (
                            <SelectItem key={name} value={name}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Units Card Grid / List (PROPERTY HUB style) */}
            {filteredUnits.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-muted-foreground">ไม่พบยูนิต</p>
                </CardContent>
              </Card>
            ) : unitViewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sortedUnits.map((unit) => {
                  const firstImage = unit.thumbnail_url || ((unit.images && unit.images.length > 0) ? unit.images[0] : null);
                  const cd = unit.status === 'reserved' ? formatCountdown(unit.locked_until) : null;
                  const reservedLabel = cd && !cd.expired ? `จอง · ${cd.text}` : 'จอง';
                  const statusConfig =
                    unit.status === 'available'
                      ? { label: 'ว่าง', dotClass: 'bg-green-500', wrapClass: 'bg-white/95 text-green-700' }
                      : unit.status === 'reserved'
                      ? { label: reservedLabel, dotClass: 'bg-amber-500', wrapClass: cd?.urgent ? 'bg-white/95 text-red-700' : 'bg-white/95 text-amber-700' }
                      : unit.status === 'sold'
                      ? { label: 'ขาย', dotClass: 'bg-red-500', wrapClass: 'bg-white/95 text-red-700' }
                      : { label: 'ไม่พร้อมขาย', dotClass: 'bg-gray-400', wrapClass: 'bg-white/95 text-gray-600' };
                  return (
                    <Card
                      key={unit.id}
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => handleViewUnit(unit)}
                    >
                      {/* Image area */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-gray-100 to-gray-200">
                        {firstImage ? (
                          <img
                            src={firstImage}
                            alt={unit.unit_number}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                            <ImageIcon className="w-12 h-12" />
                          </div>
                        )}

                        {/* Unit code — top-left */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                          <div className="px-2.5 py-1 bg-white/95 backdrop-blur rounded-md text-xs font-semibold text-gray-800 shadow-sm">
                            {unit.unit_number}
                          </div>
                          {((userRole === 'sales' && mySalesUnitIds.has(unit.id)) || (userRole === 'agent' && myAgentUnitIds.has(unit.id))) && (
                            <div className="px-2 py-1 bg-chateau text-white rounded-md text-[11px] font-medium shadow-sm">
                              ของคุณ
                            </div>
                          )}
                        </div>

                        {/* Status badge — top-right */}
                        <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shadow-sm backdrop-blur ${statusConfig.wrapClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                          {statusConfig.label}
                        </div>
                      </div>

                      {/* Content */}
                      <CardContent className="p-4 space-y-3">
                        {/* Top row: floor + actions */}
                        <div className="flex items-start justify-between">
                          <div className="text-xs text-gray-500">
                            {unit.floor_number ? `ชั้น ${unit.floor_number}` : 'ยูนิต'}
                            {unit.area_sqm ? ` · ${unit.area_sqm.toLocaleString()} ตร.ม.` : ''}
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 -mr-1 -mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem onClick={() => handleViewUnit(unit)}>
                                <Eye className="w-4 h-4 mr-2" />
                                ดูรายละเอียด
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleAddLeadFromUnit(unit)}>
                                <UserPlus className="w-4 h-4 mr-2" />
                                เพิ่ม Lead ใหม่
                              </DropdownMenuItem>
                              <ManagePropertiesGuard fallback={null} showMessage={false}>
                                {(userRole === 'owner' || userRole === 'admin') && (
                                  <DropdownMenuItem onClick={() => navigate(`/units/${unit.id}/edit`)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    แก้ไข
                                  </DropdownMenuItem>
                                )}
                                {userRole === 'owner' && (
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUnitClick(unit)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    ลบ
                                  </DropdownMenuItem>
                                )}
                              </ManagePropertiesGuard>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Price */}
                        <div>
                          <div className="text-2xl font-bold text-gray-900">
                            {unit.price >= 1_000_000
                              ? `${(unit.price / 1_000_000).toFixed(2)} ล้าน`
                              : formatCurrency(unit.price)}
                          </div>
                        </div>

                        {/* Specs icons row */}
                        <div className="flex items-center gap-3 text-sm text-gray-600 pt-1 border-t border-gray-100">
                          <span className="flex items-center gap-1" title="ห้องนอน">
                            <Bed className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{unit.bedrooms || 0}</span>
                          </span>
                          <span className="flex items-center gap-1" title="ห้องน้ำ">
                            <Bath className="w-4 h-4 text-gray-400" />
                            <span className="font-medium">{unit.bathrooms || 0}</span>
                          </span>
                          {(unit.parking_spaces ?? 0) > 0 && (
                            <span className="flex items-center gap-1" title="ที่จอดรถ">
                              <Square className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{unit.parking_spaces}</span>
                            </span>
                          )}
                          {unit.area_sqm > 0 && (
                            <span className="flex items-center gap-1 ml-auto text-xs text-gray-500" title="พื้นที่">
                              <Ruler className="w-3.5 h-3.5" />
                              {unit.area_sqm.toLocaleString()} ตร.ม.
                            </span>
                          )}
                        </div>
                        {/* Sales รับผิดชอบ (Admin/Owner view only) */}
                        {(userRole === 'owner' || userRole === 'admin') && (
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-gray-100 text-xs">
                            <User className="w-3 h-3 text-gray-400" />
                            {unitSalesMap[unit.id]?.length ? (
                              <span className="text-gray-700 truncate" title={unitSalesMap[unit.id].join(', ')}>
                                {unitSalesMap[unit.id].join(', ')}
                              </span>
                            ) : (
                              <span className="text-gray-400 italic">ยังไม่มี Sales</span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {sortedUnits.map((unit) => {
                  const firstImage = unit.thumbnail_url || ((unit.images && unit.images.length > 0) ? unit.images[0] : null);
                  const cd = unit.status === 'reserved' ? formatCountdown(unit.locked_until) : null;
                  const reservedLabel = cd && !cd.expired ? `จอง · ${cd.text}` : 'จอง';
                  const statusConfig =
                    unit.status === 'available'
                      ? { label: 'ว่าง', dotClass: 'bg-green-500', textClass: 'text-green-700', bgClass: 'bg-green-50' }
                      : unit.status === 'reserved'
                      ? { label: reservedLabel, dotClass: 'bg-amber-500', textClass: cd?.urgent ? 'text-red-700' : 'text-amber-700', bgClass: cd?.urgent ? 'bg-red-50' : 'bg-amber-50' }
                      : unit.status === 'sold'
                      ? { label: 'ขาย', dotClass: 'bg-red-500', textClass: 'text-red-700', bgClass: 'bg-red-50' }
                      : { label: 'ไม่พร้อมขาย', dotClass: 'bg-gray-400', textClass: 'text-gray-600', bgClass: 'bg-gray-50' };
                  return (
                    <Card
                      key={unit.id}
                      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => handleViewUnit(unit)}
                    >
                      <div className="flex items-stretch">
                        {/* Thumbnail */}
                        <div className="relative w-32 sm:w-40 flex-shrink-0 bg-gradient-to-br from-gray-100 to-gray-200">
                          {firstImage ? (
                            <img
                              src={firstImage}
                              alt={unit.unit_number}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                          )}
                        </div>

                        {/* Body */}
                        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3 p-4 min-w-0">
                          {/* Left: code + meta + specs */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-semibold text-gray-800">
                                {unit.unit_number}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusConfig.bgClass} ${statusConfig.textClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                                {statusConfig.label}
                              </span>
                              {((userRole === 'sales' && mySalesUnitIds.has(unit.id)) || (userRole === 'agent' && myAgentUnitIds.has(unit.id))) && (
                                <span className="px-2 py-0.5 bg-chateau text-white rounded-md text-[11px] font-medium">
                                  ของคุณ
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {unit.floor_number ? `ชั้น ${unit.floor_number}` : 'ยูนิต'}
                              {unit.area_sqm ? ` · ${unit.area_sqm.toLocaleString()} ตร.ม.` : ''}
                              {unit.unit_type ? ` · ${unit.unit_type}` : ''}
                              {(userRole === 'owner' || userRole === 'admin') && (
                                <>
                                  {' · '}
                                  <User className="w-3 h-3 inline text-gray-400 mr-0.5" />
                                  {unitSalesMap[unit.id]?.length ? (
                                    <span className="text-gray-700">{unitSalesMap[unit.id].join(', ')}</span>
                                  ) : (
                                    <span className="text-gray-400 italic">ยังไม่มี Sales</span>
                                  )}
                                </>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-600">
                              <span className="flex items-center gap-1" title="ห้องนอน">
                                <Bed className="w-3.5 h-3.5 text-gray-400" />
                                <span className="font-medium">{unit.bedrooms || 0}</span>
                              </span>
                              <span className="flex items-center gap-1" title="ห้องน้ำ">
                                <Bath className="w-3.5 h-3.5 text-gray-400" />
                                <span className="font-medium">{unit.bathrooms || 0}</span>
                              </span>
                              {(unit.parking_spaces ?? 0) > 0 && (
                                <span className="flex items-center gap-1" title="ที่จอดรถ">
                                  <Square className="w-3.5 h-3.5 text-gray-400" />
                                  <span className="font-medium">{unit.parking_spaces}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: price + actions */}
                          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1 sm:min-w-[140px]">
                            <div className="text-lg sm:text-xl font-bold text-gray-900 whitespace-nowrap">
                              {unit.price >= 1_000_000
                                ? `${(unit.price / 1_000_000).toFixed(2)} ล้าน`
                                : formatCurrency(unit.price)}
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => handleViewUnit(unit)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  ดูรายละเอียด
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddLeadFromUnit(unit)}>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  เพิ่ม Lead ใหม่
                                </DropdownMenuItem>
                                <ManagePropertiesGuard fallback={null} showMessage={false}>
                                  <DropdownMenuItem onClick={() => navigate(`/units/${unit.id}/edit`)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    แก้ไข
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUnitClick(unit)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    ลบ
                                  </DropdownMenuItem>
                                </ManagePropertiesGuard>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Create/Edit Project Modal */}
        <CreateProjectModal
          isOpen={showPropertyDialog}
          onClose={() => {
            setShowPropertyDialog(false);
            setEditingProperty(null);
            setScrollProjectFormTo(null);
          }}
          onProjectCreated={() => {
            fetchProperties();
            setShowPropertyDialog(false);
            setEditingProperty(null);
            setSelectedProperty(null);
            setScrollProjectFormTo(null);
          }}
          editingProject={editingProperty}
          scrollToSection={scrollProjectFormTo}
        />

        {/* Unit Dialog */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden p-0 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl shadow-md">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingUnit ? 'แก้ไขยูนิต' : 'เพิ่มยูนิตใหม่'}
                  </h2>
                  <p className="text-xs text-gray-500">{selectedProperty?.name}</p>
                </div>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Section 1: ข้อมูลพื้นฐาน */}
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="p-1.5 bg-blue-500 rounded-lg">
                      <Home className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">ข้อมูลพื้นฐาน</h3>
                      <p className="text-xs text-gray-500">เลขที่ยูนิต ชั้น และราคา</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="unit_number" className="text-sm font-medium">เลขที่ยูนิต <span className="text-red-500">*</span></Label>
                        <Input
                          id="unit_number"
                          value={unitForm.unit_number}
                          onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                          placeholder="เช่น A101"
                          required
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor" className="text-sm font-medium">เลขที่ชั้น</Label>
                        <Input
                          id="floor"
                          type="number"
                          value={unitForm.floor}
                          onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                          placeholder="เช่น 15"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_price" className="text-sm font-medium">ราคา (฿) <span className="text-red-500">*</span></Label>
                        <Input
                          id="unit_price"
                          type="number"
                          value={unitForm.price}
                          onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                          placeholder="เช่น 2,500,000"
                          required
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: รูปภาพ */}
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <ImageIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">รูปภาพยูนิต</h3>
                      <p className="text-xs text-gray-500">รูป Thumbnail และ Gallery</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Thumbnail */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">รูป Thumbnail (รูปหลัก)</Label>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-3 bg-purple-50/30 hover:bg-purple-50/50 transition-colors">
                        {unitForm.thumbnail_preview ? (
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img
                                src={unitForm.thumbnail_preview}
                                alt="Thumbnail preview"
                                className="w-32 h-24 object-cover rounded-lg shadow-md"
                              />
                              <button
                                type="button"
                                onClick={removeThumbnail}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-sm text-gray-600">
                              <p className="font-medium text-green-600">อัปโหลดสำเร็จ</p>
                              <p className="text-xs text-gray-500">คลิกที่ปุ่ม X เพื่อลบ</p>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center cursor-pointer py-4">
                            <div className="p-2 bg-purple-100 rounded-full mb-2">
                              <Upload className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-purple-700">คลิกเพื่ออัปโหลดรูป Thumbnail</span>
                            <span className="text-xs text-gray-500 mt-1">PNG, JPG ขนาดแนะนำ 800x600 px</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleThumbnailChange}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Gallery */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">รูป Gallery (รูปเพิ่มเติม)</Label>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-3 bg-purple-50/30">
                        <div className="grid grid-cols-5 gap-2">
                          {unitForm.image_items.map((item, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={item.url}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-20 object-cover rounded-lg shadow-sm"
                              />
                              {!item.file && (
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-blue-500/90 text-white text-[10px] rounded font-medium">
                                  เดิม
                                </span>
                              )}
                              {item.file && (
                                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-green-500/90 text-white text-[10px] rounded font-medium">
                                  ใหม่
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-purple-300 rounded-lg h-20 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                            <Plus className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-purple-500 mt-0.5">เพิ่มรูป</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              onChange={handleImagesChange}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: พื้นที่ */}
              <Card className="border-2 border-green-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-green-100/50 border-b border-green-100">
                    <div className="p-1.5 bg-green-500 rounded-lg">
                      <Ruler className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-900 text-sm">ขนาดพื้นที่</h3>
                      <p className="text-xs text-green-600">พื้นที่ใช้สอยและพื้นที่ดิน</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="size_sqm" className="text-sm font-medium">พื้นที่ใช้สอย (ตร.ม.)</Label>
                        <Input
                          id="size_sqm"
                          type="number"
                          step="0.01"
                          value={unitForm.size_sqm}
                          onChange={(e) => setUnitForm({ ...unitForm, size_sqm: e.target.value })}
                          placeholder="เช่น 45.5"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="land_area_sqw" className="text-sm font-medium">พื้นที่ดิน (ตร.ว.)</Label>
                        <Input
                          id="land_area_sqw"
                          type="number"
                          step="0.01"
                          value={unitForm.land_area_sqw}
                          onChange={(e) => setUnitForm({ ...unitForm, land_area_sqw: e.target.value })}
                          placeholder="เช่น 50"
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: ห้อง */}
              <Card className="border-2 border-orange-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <Bed className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-900 text-sm">ห้องและที่จอด</h3>
                      <p className="text-xs text-orange-600">ห้องนอน ห้องน้ำ ที่จอดรถ ชั้น ทิศ อาคาร</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="unit_bedrooms" className="text-sm font-medium flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5 text-orange-500" />
                          ห้องนอน
                        </Label>
                        <Input
                          id="unit_bedrooms"
                          type="number"
                          min="0"
                          value={unitForm.bedrooms}
                          onChange={(e) => setUnitForm({ ...unitForm, bedrooms: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_bathrooms" className="text-sm font-medium flex items-center gap-1.5">
                          <Bath className="w-3.5 h-3.5 text-orange-500" />
                          ห้องน้ำ
                        </Label>
                        <Input
                          id="unit_bathrooms"
                          type="number"
                          min="0"
                          value={unitForm.bathrooms}
                          onChange={(e) => setUnitForm({ ...unitForm, bathrooms: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="parking_spaces" className="text-sm font-medium flex items-center gap-1.5">
                          <Square className="w-3.5 h-3.5 text-orange-500" />
                          ที่จอดรถ
                        </Label>
                        <Input
                          id="parking_spaces"
                          type="number"
                          min="0"
                          value={unitForm.parking_spaces}
                          onChange={(e) => setUnitForm({ ...unitForm, parking_spaces: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor_count" className="text-sm font-medium flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-orange-500" />
                          จำนวนชั้น
                        </Label>
                        <Input
                          id="floor_count"
                          type="number"
                          min="1"
                          value={unitForm.floor_count}
                          onChange={(e) => setUnitForm({ ...unitForm, floor_count: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="facing_direction" className="text-sm font-medium flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-orange-500" />
                          ทิศ
                        </Label>
                        <Select
                          value={unitForm.facing_direction}
                          onValueChange={(value) => setUnitForm({ ...unitForm, facing_direction: value })}
                        >
                          <SelectTrigger id="facing_direction" className="mt-1.5">
                            <SelectValue placeholder="เลือกทิศ" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="N">เหนือ (N)</SelectItem>
                            <SelectItem value="S">ใต้ (S)</SelectItem>
                            <SelectItem value="E">ตะวันออก (E)</SelectItem>
                            <SelectItem value="W">ตะวันตก (W)</SelectItem>
                            <SelectItem value="NE">ตะวันออกเฉียงเหนือ (NE)</SelectItem>
                            <SelectItem value="NW">ตะวันตกเฉียงเหนือ (NW)</SelectItem>
                            <SelectItem value="SE">ตะวันออกเฉียงใต้ (SE)</SelectItem>
                            <SelectItem value="SW">ตะวันตกเฉียงใต้ (SW)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="building" className="text-sm font-medium flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-orange-500" />
                          อาคาร / Block
                        </Label>
                        <Input
                          id="building"
                          type="text"
                          value={unitForm.building}
                          onChange={(e) => setUnitForm({ ...unitForm, building: e.target.value })}
                          placeholder="A, B, Tower 1"
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: รายละเอียดและสถานะ */}
              <Card className="border-2 border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                    <div className="p-1.5 bg-gray-600 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">รายละเอียดและสถานะ</h3>
                      <p className="text-xs text-gray-600">ข้อมูลเพิ่มเติมและสถานะยูนิต</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <Label htmlFor="description" className="text-sm font-medium">ข้อมูลเพิ่มเติม</Label>
                      <Textarea
                        id="description"
                        value={unitForm.description}
                        onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                        placeholder="เล่าจุดเด่นเฉพาะที่ไม่มีในช่องอื่น เช่น เพิ่งรีโนเวตปี 2024, รับลม 2 ทิศ, ครัว Open Concept, เจ้าของก่อนเป็นสถาปนิก ฯลฯ"
                        rows={2}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit_status" className="text-sm font-medium">สถานะยูนิต</Label>
                      <Select
                        value={unitForm.status}
                        onValueChange={(value: any) => setUnitForm({ ...unitForm, status: value })}
                      >
                        <SelectTrigger id="unit_status" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              ว่าง
                            </span>
                          </SelectItem>
                          <SelectItem value="reserved">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                              จอง
                            </span>
                          </SelectItem>
                          <SelectItem value="sold">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              ขายแล้ว
                            </span>
                          </SelectItem>
                          <SelectItem value="unavailable">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                              ไม่ว่าง
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 6: PROPERTY HUB-style fields */}
              <Card className="border-2 border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                    <div className="p-1.5 bg-amber-600 rounded-lg">
                      <Layers className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">รายละเอียดเสริม</h3>
                      <p className="text-xs text-gray-600">โปรโมชั่น, แปลง, วิว, ตกแต่ง, แผนผัง, 3D Tour</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Feature checkboxes */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">คุณสมบัติพิเศษ</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={unitForm.pool}
                            onChange={(e) => setUnitForm({ ...unitForm, pool: e.target.checked })}
                            className="w-4 h-4 accent-chateau"
                          />
                          <span className="text-sm">🏊 มีสระว่ายน้ำ</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={unitForm.garden}
                            onChange={(e) => setUnitForm({ ...unitForm, garden: e.target.checked })}
                            className="w-4 h-4 accent-chateau"
                          />
                          <span className="text-sm">🌿 มีสวน</span>
                        </label>
                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={unitForm.balcony}
                            onChange={(e) => setUnitForm({ ...unitForm, balcony: e.target.checked })}
                            className="w-4 h-4 accent-chateau"
                          />
                          <span className="text-sm">🪟 มีระเบียง</span>
                        </label>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="promo_price" className="text-sm font-medium">ราคาโปรโมชั่น (บาท)</Label>
                      <Input
                        id="promo_price"
                        type="number"
                        value={unitForm.promo_price}
                        onChange={(e) => setUnitForm({ ...unitForm, promo_price: e.target.value })}
                        placeholder="เช่น 6490000 (เว้นว่างถ้าไม่มีโปร)"
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="plot_number" className="text-sm font-medium">เลขแปลง</Label>
                      <Input
                        id="plot_number"
                        type="text"
                        value={unitForm.plot_number}
                        onChange={(e) => setUnitForm({ ...unitForm, plot_number: e.target.value })}
                        placeholder="เช่น C-012, A-001"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="view" className="text-sm font-medium">วิว</Label>
                      <Input
                        id="view"
                        type="text"
                        value={unitForm.view}
                        onChange={(e) => setUnitForm({ ...unitForm, view: e.target.value })}
                        placeholder="เช่น วิวสระว่ายน้ำ, วิวสวน, วิวเมือง, วิวทะเล 270°"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="furnishing" className="text-sm font-medium">สถานะตกแต่ง</Label>
                      <Select
                        value={unitForm.furnishing}
                        onValueChange={(value: any) => setUnitForm({ ...unitForm, furnishing: value })}
                      >
                        <SelectTrigger id="furnishing" className="mt-1.5">
                          <SelectValue placeholder="เลือกระดับการตกแต่ง" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fully">ตกแต่งครบ พร้อมอยู่ (Fully Furnished)</SelectItem>
                          <SelectItem value="partial">ตกแต่งบางส่วน (Partially Furnished)</SelectItem>
                          <SelectItem value="unfurnished">ไม่ตกแต่ง (Unfurnished)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="floor_plan_url" className="text-sm font-medium">Floor Plan URL</Label>
                      <Input
                        id="floor_plan_url"
                        type="url"
                        value={unitForm.floor_plan_url}
                        onChange={(e) => setUnitForm({ ...unitForm, floor_plan_url: e.target.value })}
                        placeholder="https://... (รูป/PDF แปลนห้อง)"
                        className="mt-1.5"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <Label htmlFor="tour_3d_url" className="text-sm font-medium">3D / VR Tour URL</Label>
                      <Input
                        id="tour_3d_url"
                        type="url"
                        value={unitForm.tour_3d_url}
                        onChange={(e) => setUnitForm({ ...unitForm, tour_3d_url: e.target.value })}
                        placeholder="https://my.matterport.com/show/?m=..."
                        className="mt-1.5"
                      />
                    </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowUnitDialog(false)}
                disabled={savingUnit}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSaveUnit}
                disabled={!unitForm.unit_number || !unitForm.price || savingUnit}
                className="flex-1 bg-gradient-to-r from-[#e60023] to-[#8B5CF6] hover:opacity-90"
              >
                {savingUnit ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังบันทึก...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Save className="w-4 h-4 mr-2" />
                    {editingUnit ? 'บันทึกการแก้ไข' : 'เพิ่มยูนิต'}
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    ยืนยันการลบโครงการ
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
                    <div className="p-1.5 bg-chateau rounded-lg">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">โครงการที่จะลบ</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-medium text-gray-800">
                      {selectedProperty?.name}
                    </p>
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                          การลบโครงการนี้จะลบข้อมูลยูนิตและข้อมูลที่เกี่ยวข้องทั้งหมด
                          <strong> ไม่สามารถกู้คืนได้</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProperty}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบโครงการ
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Unit Detail Dialog */}
        <Dialog open={showUnitDetailDialog} onOpenChange={setShowUnitDetailDialog}>
          <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold gradient-primary-text">
                    ยูนิต {viewingUnit?.unit_number}
                  </DialogTitle>
                  <DialogDescription className="text-base mt-1">
                    {selectedProperty?.name}
                  </DialogDescription>
                </div>
                {viewingUnit && getUnitStatusBadge(viewingUnit.status)}
              </div>
            </DialogHeader>
            {viewingUnit && (
              <div className="space-y-5 py-2">
                {/* Images — hero + thumbnails (combines thumbnail_url and images[]) */}
                {(() => {
                  const allImages = Array.from(
                    new Set([
                      ...(viewingUnit.thumbnail_url ? [viewingUnit.thumbnail_url] : []),
                      ...(viewingUnit.images || []),
                    ])
                  ).filter(Boolean);
                  if (allImages.length === 0) return null;
                  return (
                    <Card className="overflow-hidden border border-gray-200">
                      <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                        <CardTitle className="text-base font-semibold text-gray-900">
                          รูปภาพยูนิต
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {/* Hero image */}
                        <a
                          href={allImages[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block"
                        >
                          <img
                            src={allImages[0]}
                            alt={`${viewingUnit.unit_number} hero`}
                            className="w-full h-72 object-cover rounded-lg border border-gray-200 hover:border-[#e60023] transition-all cursor-pointer shadow-sm"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </a>
                        {/* Thumbnails row */}
                        {allImages.length > 1 && (
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                            {allImages.slice(1).map((img, index) => (
                              <a
                                key={index}
                                href={img}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <img
                                  src={img}
                                  alt={`Unit image ${index + 2}`}
                                  className="w-full h-20 object-cover rounded-lg border border-gray-100 hover:border-[#e60023] transition-all cursor-pointer shadow-sm"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              </a>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Reservation / Booking — PROPERTY HUB style (post-deposit) */}
                {(() => {
                  const isReserved = viewingUnit.status === 'reserved' && !!viewingUnit.reserved_customer_name;
                  const isSold = viewingUnit.status === 'sold' && !!viewingUnit.reserved_customer_name;
                  const canManage = canManageUnit(viewingUnit.id, viewingUnit.project_id) || userRole === 'owner' || userRole === 'admin';
                  const expiry = viewingUnit.locked_until ? new Date(viewingUnit.locked_until) : null;
                  const expired = expiry ? expiry.getTime() < now : false;

                  if (isSold) {
                    return (
                      <Card className="border-2 border-green-200 bg-green-50/30">
                        <CardHeader className="bg-green-50 border-b border-green-200 pb-3">
                          <CardTitle className="text-base font-semibold text-green-900 flex items-center gap-2">
                            <Check className="w-5 h-5" />
                            ปิดการขายแล้ว
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">ลูกค้า</p>
                              <p className="text-base font-semibold text-gray-900">{viewingUnit.reserved_customer_name}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">เบอร์โทร</p>
                              <p className="text-base font-medium text-gray-900">{viewingUnit.reserved_customer_phone || '-'}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">เงินจอง</p>
                              <p className="text-base font-medium text-gray-900">
                                {viewingUnit.deposit_amount
                                  ? `฿${Number(viewingUnit.deposit_amount).toLocaleString()}`
                                  : '-'}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">Sales รับผิดชอบ</p>
                              <p className="text-base font-medium text-gray-900">{viewingUnit.locked_by_name || '-'}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }

                  if (isReserved) {
                    return (
                      <Card className="border-2 border-amber-200 bg-amber-50/30">
                        <CardHeader className="bg-amber-50 border-b border-amber-200 pb-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
                              <Calendar className="w-5 h-5" />
                              ข้อมูลผู้จอง
                              {expired && (
                                <Badge className="bg-red-100 text-red-700 border-red-200">
                                  หมดอายุแล้ว
                                </Badge>
                              )}
                            </CardTitle>
                            {canManage && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={handleMarkAsSold}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  ปิดการขาย
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleCancelReservation}
                                  className="text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  ยกเลิกการจอง
                                </Button>
                              </div>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">ชื่อลูกค้า</p>
                              <p className="text-base font-semibold text-gray-900">{viewingUnit.reserved_customer_name}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">เบอร์โทร</p>
                              <p className="text-base font-medium text-gray-900">{viewingUnit.reserved_customer_phone || '-'}</p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">เงินจอง</p>
                              <p className="text-base font-bold text-green-700">
                                {viewingUnit.deposit_amount
                                  ? `฿${Number(viewingUnit.deposit_amount).toLocaleString()}`
                                  : '-'}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">วันที่จอง</p>
                              <p className="text-sm text-gray-900">
                                {viewingUnit.reservation_date
                                  ? new Date(viewingUnit.reservation_date).toLocaleDateString('th-TH', { dateStyle: 'medium' })
                                  : '-'}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">หมดอายุ</p>
                              <p className={cn(
                                "text-sm font-medium",
                                expired ? "text-red-700" : "text-gray-900"
                              )}>
                                {expiry
                                  ? expiry.toLocaleDateString('th-TH', { dateStyle: 'medium' })
                                  : '-'}
                                {expiry && !expired && (
                                  <span className="text-xs text-gray-500 ml-2">
                                    ({Math.ceil((expiry.getTime() - now) / 86400000)} วันถัดไป)
                                  </span>
                                )}
                              </p>
                            </div>
                            <div className="p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-0.5">Sales รับผิดชอบ</p>
                              <p className="text-sm font-medium text-gray-900">
                                {viewingUnit.locked_by_name || '-'}
                              </p>
                            </div>
                          </div>
                          {viewingUnit.reservation_notes && (
                            <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                              <p className="text-xs font-medium text-gray-500 mb-1">หมายเหตุ</p>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{viewingUnit.reservation_notes}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }

                  // status='available' + canManage → show booking record button + add lead
                  if (viewingUnit.status === 'available' && canManage) {
                    return (
                      <Card className="border border-dashed border-gray-300">
                        <CardContent className="pt-5">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-3">
                              <Calendar className="w-5 h-5 text-gray-400" />
                              <div>
                                <p className="text-sm font-semibold text-gray-700">ยูนิตยังว่าง</p>
                                <p className="text-xs text-gray-500">
                                  {unitLeads.length > 0
                                    ? `มี ${unitLeads.length} Lead สนใจอยู่ — บันทึกการจองได้`
                                    : 'ยังไม่มี Lead สนใจ — เพิ่ม Lead ก่อนถ้าลูกค้าจะจอง'}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                onClick={() => handleAddLeadFromUnit(viewingUnit)}
                              >
                                <UserPlus className="w-4 h-4 mr-1" />
                                เพิ่ม Lead ใหม่
                              </Button>
                              <Button
                                onClick={openReserveDialog}
                                className="bg-amber-500 hover:bg-amber-600 text-white"
                              >
                                <Calendar className="w-4 h-4 mr-1" />
                                บันทึกการจอง
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  }
                  return null;
                })()}

                {/* Pricing — PROPERTY HUB style with promo */}
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-chateau" />
                      ราคา
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="flex flex-wrap items-baseline gap-3">
                      {viewingUnit.promo_price && viewingUnit.promo_price < viewingUnit.price ? (
                        <>
                          <span className="text-3xl font-bold text-chateau">
                            {(viewingUnit.promo_price / 1_000_000).toFixed(2)} ล้าน
                          </span>
                          <span className="text-lg text-gray-400 line-through">
                            {(viewingUnit.price / 1_000_000).toFixed(2)} ล้าน
                          </span>
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                            ลด {(((viewingUnit.price - viewingUnit.promo_price) / viewingUnit.price) * 100).toFixed(0)}%
                          </Badge>
                        </>
                      ) : (
                        <span className="text-3xl font-bold text-gray-900">
                          {(viewingUnit.price / 1_000_000).toFixed(2)} ล้าน
                        </span>
                      )}
                    </div>
                    {viewingUnit.price_per_sqm && (
                      <p className="text-sm text-gray-500 mt-2">
                        {formatCurrency(viewingUnit.price_per_sqm)} / ตร.ม.
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* Specifications — comprehensive grid */}
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-chateau" />
                      ข้อมูลยูนิต
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-1">เลขที่ยูนิต</p>
                        <p className="text-base font-bold text-gray-900">{viewingUnit.unit_number}</p>
                      </div>
                      {viewingUnit.plot_number && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">เลขแปลง</p>
                          <p className="text-base font-bold text-gray-900">{viewingUnit.plot_number}</p>
                        </div>
                      )}
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          {viewingUnit.floor_count && viewingUnit.floor_count > 1 ? 'จำนวนชั้น' : 'ชั้น'}
                        </p>
                        <p className="text-base font-bold text-gray-900">
                          {viewingUnit.floor_count && viewingUnit.floor_count > 1
                            ? `${viewingUnit.floor_count} ชั้น`
                            : viewingUnit.floor_number || '-'}
                        </p>
                      </div>
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-1">พื้นที่ใช้สอย</p>
                        <p className="text-base font-bold text-gray-900">{viewingUnit.area_sqm ? `${viewingUnit.area_sqm} ตร.ม.` : '-'}</p>
                      </div>
                      {viewingUnit.land_area_sqw && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">ที่ดิน</p>
                          <p className="text-base font-bold text-gray-900">{viewingUnit.land_area_sqw} ตร.วา</p>
                        </div>
                      )}
                      {viewingUnit.facing_direction && (
                        <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <p className="text-xs font-medium text-gray-500 mb-1">ทิศ</p>
                          <p className="text-base font-bold text-gray-900">{viewingUnit.facing_direction}</p>
                        </div>
                      )}
                    </div>

                    {/* Bed/Bath/Parking icon row */}
                    <div className="grid grid-cols-3 gap-3 mt-3">
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Bed className="w-5 h-5 text-chateau" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">ห้องนอน</p>
                          <p className="text-lg font-bold text-gray-900">{viewingUnit.bedrooms}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Bath className="w-5 h-5 text-chateau" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">ห้องน้ำ</p>
                          <p className="text-lg font-bold text-gray-900">{viewingUnit.bathrooms}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <Square className="w-5 h-5 text-chateau" />
                        <div>
                          <p className="text-xs font-medium text-gray-500">ที่จอดรถ</p>
                          <p className="text-lg font-bold text-gray-900">{viewingUnit.parking_spaces || 0}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Features & Highlights */}
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                      <Home className="w-5 h-5 text-chateau" />
                      จุดเด่นยูนิต
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 space-y-4">
                    {/* View */}
                    {viewingUnit.view && (
                      <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-900 mb-1">🌅 วิว</p>
                        <p className="text-sm font-medium text-amber-900">{viewingUnit.view}</p>
                      </div>
                    )}

                    {/* Furnishing */}
                    {viewingUnit.furnishing && (
                      <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-900 mb-1">🛋 สถานะตกแต่ง</p>
                        <p className="text-sm font-medium text-purple-900">
                          {viewingUnit.furnishing === 'fully' && 'ตกแต่งครบ พร้อมอยู่ (Fully Furnished)'}
                          {viewingUnit.furnishing === 'partial' && 'ตกแต่งบางส่วน (Partially Furnished)'}
                          {viewingUnit.furnishing === 'unfurnished' && 'ไม่ตกแต่ง (Unfurnished)'}
                        </p>
                      </div>
                    )}


                    {/* Layout description */}
                    {viewingUnit.layout_description && (
                      <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-2">รายละเอียด</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{viewingUnit.layout_description}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Floor Plan + 3D Tour */}
                {(viewingUnit.floor_plan_url || viewingUnit.tour_3d_url) && (
                  <Card className="border border-gray-200">
                    <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                      <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Layers className="w-5 h-5 text-chateau" />
                        แผนผัง & 3D Tour
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4 space-y-3">
                      {viewingUnit.floor_plan_url && (
                        <div>
                          <p className="text-xs font-semibold text-slate-700 mb-2">📐 ผังห้อง</p>
                          <img
                            src={viewingUnit.floor_plan_url}
                            alt="Floor plan"
                            className="w-full max-h-96 object-contain rounded-lg border border-gray-200 bg-white"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        </div>
                      )}
                      {viewingUnit.tour_3d_url && (
                        <a
                          href={viewingUnit.tour_3d_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium text-sm transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          เปิด 3D Virtual Tour
                        </a>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Project Site Plan — uploaded image OR generated SVG */}
                {(() => {
                  const hasUploadedPlan =
                    !!selectedProperty?.master_plan_url &&
                    !selectedProperty.master_plan_url.includes('placehold.co') &&
                    !masterPlanImgError;
                  return (
                    <Card className="border border-gray-200">
                      <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                        <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                          <Layers className="w-5 h-5 text-chateau" />
                          ผังโครงการ
                          {viewingUnit.plot_number && (
                            <Badge variant="outline" className="ml-2 border-chateau text-chateau">
                              แปลง {viewingUnit.plot_number}
                            </Badge>
                          )}
                          {!hasUploadedPlan && (
                            <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 bg-amber-50">
                              ผังจำลอง
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-4">
                        {hasUploadedPlan ? (
                          <>
                            <a
                              href={selectedProperty!.master_plan_url!}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-lg overflow-hidden border border-gray-200 hover:border-chateau transition-colors"
                            >
                              <img
                                src={selectedProperty!.master_plan_url!}
                                alt={`Master plan ${selectedProperty!.name}`}
                                className="w-full max-h-96 object-cover"
                                onError={() => setMasterPlanImgError(true)}
                              />
                            </a>
                            <p className="text-xs text-gray-500 mt-2">คลิกเพื่อดูภาพขนาดเต็ม</p>
                          </>
                        ) : (
                          <>
                            <MasterPlanSVG
                              units={units}
                              highlightedUnitId={viewingUnit.id}
                              projectName={selectedProperty?.name || 'โครงการ'}
                            />
                            <p className="text-xs text-amber-700 mt-2">
                              {masterPlanImgError
                                ? '⚠ URL ที่ใส่ไม่ใช่รูปภาพโดยตรง — ต้อง paste URL ที่ลงท้าย .jpg / .png / .webp (คลิกขวาที่รูปจริง → "คัดลอกที่อยู่รูปภาพ")'
                                : '💡 ผังนี้สร้างจากข้อมูลยูนิตจริง — admin upload ผังจริงในฟอร์มแก้ไขโครงการได้'}
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  );
                })()}

                {/* Map — project location */}
                {selectedProperty?.location_lat && selectedProperty?.location_lng && (
                  <Card className="border border-gray-200">
                    <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                      <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <MapPin className="w-5 h-5 text-chateau" />
                        ตำแหน่งโครงการ
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                        <iframe
                          title={`Map of ${selectedProperty.name}`}
                          src={`https://www.google.com/maps?q=${selectedProperty.location_lat},${selectedProperty.location_lng}&hl=th&z=15&output=embed`}
                          width="100%"
                          height="280"
                          style={{ border: 0 }}
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2">
                        📍 {selectedProperty.address?.street || `${selectedProperty.address?.district || ''}, ${selectedProperty.address?.province || ''}`}
                        <span className="ml-2 text-gray-400">
                          ({selectedProperty.location_lat}, {selectedProperty.location_lng})
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                )}


                {/* Leads Interested in This Unit */}
                <Card className="border border-gray-200">
                  <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Users className="w-5 h-5 text-chateau" />
                        Leads ที่สนใจยูนิตนี้
                      </CardTitle>
                      <Badge variant="secondary" className="bg-chateau-50 text-chateau border border-chateau-100">
                        {unitLeads.length} รายการ
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {unitLeads.length > 0 ? (
                      <div className="border-2 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6] hover:from-[#e60023] hover:to-[#8B5CF6]">
                              <TableHead className="text-white font-semibold">ชื่อลูกค้า</TableHead>
                              <TableHead className="text-white font-semibold">เบอร์โทร</TableHead>
                              <TableHead className="text-white font-semibold">สถานะ</TableHead>
                              <TableHead className="text-white font-semibold">ระดับความสนใจ</TableHead>
                              <TableHead className="text-white font-semibold">พนักงานขาย</TableHead>
                              <TableHead className="text-white font-semibold text-center">ดูข้อมูล</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unitLeads.map((leadInterest: any) => {
                              const lead = leadInterest.leads;
                              const customer = lead?.customers;
                              const assignedUser = lead?.users;

                              return (
                                <TableRow key={leadInterest.id} className="hover:bg-purple-50/50">
                                  <TableCell className="font-medium">
                                    <div>
                                      <p className="font-semibold text-foreground">{customer?.full_name || '-'}</p>
                                      {customer?.email && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{customer.email}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {customer?.phone || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        leadInterest.status === 'interested' ? 'default' :
                                        leadInterest.status === 'contacted' ? 'secondary' :
                                        leadInterest.status === 'viewing_scheduled' ? 'outline' :
                                        leadInterest.status === 'negotiating' ? 'outline' :
                                        leadInterest.status === 'reserved' ? 'default' :
                                        leadInterest.status === 'purchased' ? 'default' :
                                        'secondary'
                                      }
                                      className={
                                        leadInterest.status === 'interested' ? 'bg-blue-100 text-blue-800' :
                                        leadInterest.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                                        leadInterest.status === 'viewing_scheduled' ? 'bg-yellow-100 text-yellow-800' :
                                        leadInterest.status === 'negotiating' ? 'bg-orange-100 text-orange-800' :
                                        leadInterest.status === 'reserved' ? 'bg-chateau-100 text-chateau-700' :
                                        leadInterest.status === 'purchased' ? 'bg-green-100 text-green-800' :
                                        ''
                                      }
                                    >
                                      {leadInterest.status === 'interested' && 'สนใจ'}
                                      {leadInterest.status === 'contacted' && 'ติดต่อแล้ว'}
                                      {leadInterest.status === 'viewing_scheduled' && 'นัดชม'}
                                      {leadInterest.status === 'negotiating' && 'เจรจา'}
                                      {leadInterest.status === 'reserved' && 'จอง'}
                                      {leadInterest.status === 'purchased' && 'ซื้อแล้ว'}
                                      {leadInterest.status === 'lost' && 'เสียโอกาส'}
                                      {!['interested', 'contacted', 'viewing_scheduled', 'negotiating', 'reserved', 'purchased', 'lost'].includes(leadInterest.status) && leadInterest.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        leadInterest.interest_level === 'high' ? 'bg-red-50 text-red-700 border-red-300 font-semibold' :
                                        leadInterest.interest_level === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-300 font-semibold' :
                                        leadInterest.interest_level === 'low' ? 'bg-gray-50 text-gray-700 border-gray-300' :
                                        ''
                                      }
                                    >
                                      {leadInterest.interest_level === 'high' && '⭐ สูง'}
                                      {leadInterest.interest_level === 'medium' && '⭐ กลาง'}
                                      {leadInterest.interest_level === 'low' && '⭐ ต่ำ'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm font-medium text-foreground">
                                      {assignedUser?.full_name || assignedUser?.email || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex justify-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-[#e60023] hover:text-[#8B5CF6] hover:bg-purple-50"
                                        onClick={() => {
                                          navigate(`/leads/${lead?.id}/cdp`);
                                        }}
                                        title="ดูข้อมูล CDP"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border-2 border-dashed border-gray-300">
                        <User className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium text-muted-foreground">ยังไม่มี Lead ที่สนใจยูนิตนี้</p>
                        <p className="text-xs text-muted-foreground mt-1">เมื่อมีผู้สนใจจะแสดงที่นี่</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnitDetailDialog(false)}>
                ปิด
              </Button>
              {viewingUnit && canManageUnit(viewingUnit.id, viewingUnit.project_id) && (
                <Button onClick={() => {
                  setShowUnitDetailDialog(false);
                  if (viewingUnit) handleEditUnit(viewingUnit);
                }}>
                  <Edit className="w-4 h-4 mr-2" />
                  แก้ไข
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Booking Record Dialog — PROPERTY HUB style */}
        <Dialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                บันทึกการจอง — ยูนิต {viewingUnit?.unit_number}
              </DialogTitle>
              <DialogDescription>
                บันทึกข้อมูลลูกค้าที่จ่ายเงินจองและล็อคยูนิตจนกว่าจะทำสัญญา
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              {/* Lead picker — grouped: interested in this unit first, then others */}
              <div>
                <Label className="text-sm font-medium">เลือก Lead ที่จะจอง <span className="text-red-500">*</span></Label>
                {allTenantLeads.length === 0 ? (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-900 font-medium mb-1">⚠️ ยังไม่มี Lead ในระบบ</p>
                    <p className="text-xs text-amber-800">
                      กดปิดและใช้ปุ่ม "+ เพิ่ม Lead ใหม่" ก่อน
                    </p>
                  </div>
                ) : (() => {
                  // Filter out won/lost — those leads shouldn't be re-booked
                  const activeLeads = allTenantLeads.filter(
                    (l: any) => l.status !== 'won' && l.status !== 'lost' && l.status !== 'closed'
                  );
                  const interestedIds = new Set(unitLeads.map((li: any) => li.leads?.id).filter(Boolean));
                  const interestedLeads = activeLeads.filter((l: any) => interestedIds.has(l.id));
                  const otherLeads = activeLeads.filter((l: any) => !interestedIds.has(l.id));

                  if (activeLeads.length === 0) {
                    return (
                      <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-900 font-medium">⚠️ ไม่มี Lead ที่ active</p>
                        <p className="text-xs text-amber-800">
                          Lead ทุกคนปิดดีล/สูญเสียไปแล้ว — กด "+ เพิ่ม Lead ใหม่"
                        </p>
                      </div>
                    );
                  }

                  return (
                    <Select
                      value={bookingForm.lead_id}
                      onValueChange={(value) => setBookingForm({ ...bookingForm, lead_id: value })}
                    >
                      <SelectTrigger className="mt-1.5">
                        <SelectValue placeholder={`-- เลือก Lead (${activeLeads.length} คน) --`} />
                      </SelectTrigger>
                      <SelectContent>
                        {interestedLeads.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 sticky top-0">
                              🔥 สนใจยูนิตนี้แล้ว ({interestedLeads.length})
                            </div>
                            {interestedLeads.map((lead: any) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                <span className="font-medium">{lead.customer?.full_name || '(ไม่มีชื่อ)'}</span>
                                {lead.customer?.phone && (
                                  <span className="text-xs text-gray-500 ml-2">{lead.customer.phone}</span>
                                )}
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {otherLeads.length > 0 && (
                          <>
                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 sticky top-0">
                              👥 Lead อื่นใน tenant ({otherLeads.length})
                            </div>
                            {otherLeads.map((lead: any) => (
                              <SelectItem key={lead.id} value={lead.id}>
                                {lead.customer?.full_name || '(ไม่มีชื่อ)'}
                                {lead.customer?.phone && (
                                  <span className="text-xs text-gray-500 ml-2">{lead.customer.phone}</span>
                                )}
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  );
                })()}
                {bookingForm.lead_id && (() => {
                  const selectedIsInterested = unitLeads.some((li: any) => li.leads?.id === bookingForm.lead_id);
                  if (!selectedIsInterested) {
                    return (
                      <p className="text-xs text-blue-700 mt-1.5">
                        💡 Lead นี้ยังไม่ได้บันทึกความสนใจในยูนิตนี้ — ระบบจะเพิ่มให้อัตโนมัติเมื่อบันทึกการจอง
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>
              <div>
                <Label htmlFor="booking_deposit" className="text-sm font-medium">
                  จำนวนเงินจอง (บาท) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="booking_deposit"
                  type="number"
                  min="0"
                  value={bookingForm.deposit_amount}
                  onChange={(e) => setBookingForm({ ...bookingForm, deposit_amount: e.target.value })}
                  placeholder="100000"
                  className="mt-1.5"
                />
                <p className="text-xs text-gray-500 mt-1">นิยม 50,000-200,000 บาท ขึ้นกับราคายูนิต</p>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2 block">ระยะเวลาทำสัญญา (วัน)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 30].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setBookingForm({ ...bookingForm, expiry_days: days })}
                      className={cn(
                        "p-3 rounded-lg border-2 text-center transition-all",
                        bookingForm.expiry_days === days
                          ? "border-amber-500 bg-amber-50 text-amber-900"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      )}
                    >
                      <p className="text-lg font-bold">{days}</p>
                      <p className="text-xs">วัน</p>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  จะหมดอายุ: <span className="font-medium">
                    {new Date(Date.now() + bookingForm.expiry_days * 86400000).toLocaleDateString('th-TH', { dateStyle: 'medium' })}
                  </span>
                </p>
              </div>
              <div>
                <Label htmlFor="booking_notes" className="text-sm font-medium">หมายเหตุ (ไม่บังคับ)</Label>
                <Textarea
                  id="booking_notes"
                  value={bookingForm.notes}
                  onChange={(e) => setBookingForm({ ...bookingForm, notes: e.target.value })}
                  placeholder="ลูกค้าจะกลับมาเซ็นสัญญา 25 พ.ย. / ขอสินเชื่อกับธนาคาร X / ฯลฯ"
                  rows={2}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowReserveDialog(false)} disabled={savingReserve}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleReserveUnit}
                disabled={savingReserve || !bookingForm.lead_id || !bookingForm.deposit_amount}
                className="bg-amber-500 hover:bg-amber-600 text-white"
              >
                {savingReserve ? 'กำลังบันทึก...' : 'บันทึกการจอง'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Unit Confirmation Dialog */}
        <Dialog open={showDeleteUnitDialog} onOpenChange={setShowDeleteUnitDialog}>
          <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    ยืนยันการลบยูนิต
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <Card className="border-2 border-purple-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-blue-50 border-b border-purple-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <Home className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900 text-sm">ยูนิตที่จะลบ</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-medium text-gray-800">
                      ยูนิต {deletingUnit?.unit_number}
                    </p>
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                          การลบยูนิตนี้จะลบข้อมูลที่เกี่ยวข้องทั้งหมด
                          <strong> ไม่สามารถกู้คืนได้</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowDeleteUnitDialog(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUnit}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบยูนิต
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Lead Modal */}
        <AddLeadModal
          isOpen={showAddLeadModal}
          onClose={() => {
            setShowAddLeadModal(false);
            setSelectedUnitForLead(null);
          }}
          onLeadCreated={handleLeadCreated}
          initialPropertyId={selectedUnitForLead?.propertyId}
          initialUnitId={selectedUnitForLead?.unitId}
        />
            </div>
          </ViewPropertiesGuard>
        </main>
      </div>
    </div>
  );
};

export default PropertyManagement;
