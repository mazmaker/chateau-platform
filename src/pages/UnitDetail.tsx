import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Building2, Bed, Bath, Square, MapPin, Layers, DollarSign, Eye,
  Calendar, Check, AlertTriangle, ArrowLeft, UserPlus, ImageIcon, Loader2, Edit, Share2, Heart, Send,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import MasterPlanSVG from '@/components/properties/MasterPlanSVG';
import AddLeadModal from '@/components/leads/AddLeadModal';
import HandoffLeadDialog from '@/components/leads/HandoffLeadDialog';

interface Unit {
  id: string;
  project_id: string;
  unit_number: string;
  unit_type?: string | null;
  floor_number?: number | null;
  floor_count?: number | null;
  building?: string | null;
  area_sqm?: number | null;
  land_area_sqw?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  facing_direction?: string | null;
  balcony?: boolean | null;
  garden?: boolean | null;
  pool?: boolean | null;
  price: number;
  price_per_sqm?: number | null;
  promo_price?: number | null;
  plot_number?: string | null;
  view?: string | null;
  furnishing?: string | null;
  floor_plan_url?: string | null;
  tour_3d_url?: string | null;
  layout_description?: string | null;
  status: 'available' | 'reserved' | 'sold' | 'unavailable';
  images?: string[] | null;
  thumbnail_url?: string | null;
  locked_by?: string | null;
  locked_until?: string | null;
  locked_by_name?: string | null;
  reserved_customer_name?: string | null;
  reserved_customer_phone?: string | null;
  reserved_customer_lead_id?: string | null;
  deposit_amount?: number | null;
  reservation_date?: string | null;
  reservation_notes?: string | null;
}

interface Property {
  id: string;
  name: string;
  address?: any;
  master_plan_url?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  nearby?: { name: string; type: string; distance_km: number }[] | null;
}

const UnitDetail = () => {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { user, userProfile, currentTenant, userRole } = useSimpleAuth();
  const myUserId = userProfile?.id || user?.id;

  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [siblingUnits, setSiblingUnits] = useState<{ id: string; unit_number: string; status?: string }[]>([]);
  const [unitLeads, setUnitLeads] = useState<any[]>([]);
  const [responsibleSales, setResponsibleSales] = useState<{ id: string; name: string }[]>([]);
  const [allTenantLeads, setAllTenantLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Reservation
  const [showReserveDialog, setShowReserveDialog] = useState(false);
  const [savingReserve, setSavingReserve] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    lead_id: '',
    deposit_amount: '',
    expiry_days: 14,
    notes: '',
  });

  // Real-time clock for countdown
  const [now, setNow] = useState<number>(Date.now());

  // Add Lead
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);

  // Master plan image error fallback
  const [masterPlanImgError, setMasterPlanImgError] = useState(false);

  // Sales designated units
  const [mySalesUnitIds, setMySalesUnitIds] = useState<Set<string>>(new Set());
  const [mySalesProjectIds, setMySalesProjectIds] = useState<Set<string>>(new Set());
  const [myAgentUnitIds, setMyAgentUnitIds] = useState<Set<string>>(new Set());
  const [showQuickInterestDialog, setShowQuickInterestDialog] = useState(false);
  const [quickInterestLeadId, setQuickInterestLeadId] = useState('');
  const [quickInterestLevel, setQuickInterestLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [savingQuickInterest, setSavingQuickInterest] = useState(false);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [handoffLeadId, setHandoffLeadId] = useState<string | null>(null);
  const [handoffCustomerName, setHandoffCustomerName] = useState<string | undefined>();
  const [showHandoffPicker, setShowHandoffPicker] = useState(false);

  /* ─── tick countdown every 30s ─── */
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  /* ─── fetch unit + property + leads ─── */
  useEffect(() => {
    if (!unitId) return;
    loadAll();
  }, [unitId]);

  const loadAll = async () => {
    if (!unitId) return;
    setLoading(true);
    setMasterPlanImgError(false);
    try {
      const { data: unitData, error: unitErr } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single();
      if (unitErr || !unitData) {
        toast.error('ไม่พบยูนิต');
        navigate('/properties');
        return;
      }

      const [{ data: propData }, { data: sibs }, { data: leadsData }] = await Promise.all([
        supabase.from('properties').select('*').eq('id', unitData.project_id).single(),
        supabase.from('units').select('id, unit_number, status').eq('project_id', unitData.project_id),
        supabase
          .from('lead_interests')
          .select('*, leads:lead_id(id, status, assigned_to, customers:customer_id(id, full_name, email, phone))')
          .eq('unit_id', unitId),
      ]);

      let lockedByName: string | null = null;
      if (unitData.locked_by) {
        const { data: u } = await supabase
          .from('users')
          .select('full_name, email')
          .eq('id', unitData.locked_by)
          .single();
        lockedByName = u?.full_name || u?.email || null;
      }

      setUnit({ ...unitData, locked_by_name: lockedByName });
      setProperty(propData || null);
      setSiblingUnits(sibs || []);
      setUnitLeads(leadsData || []);

      // Fetch responsible sales (for Admin/Owner)
      if (userRole === 'owner' || userRole === 'admin') {
        const { data: assignments } = await supabase
          .from('sales_unit_assignments')
          .select('sales_user_id')
          .eq('unit_id', unitId)
          .is('revoked_at', null);
        const ids = (assignments || []).map((a: any) => a.sales_user_id).filter(Boolean);
        if (ids.length > 0) {
          const { data: salesUsers } = await supabase
            .from('users')
            .select('id, full_name, email')
            .in('id', ids);
          setResponsibleSales(
            (salesUsers || []).map((u: any) => ({ id: u.id, name: u.full_name || u.email || '(ไม่มีชื่อ)' }))
          );
        } else {
          setResponsibleSales([]);
        }
      } else {
        setResponsibleSales([]);
      }
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  /* ─── sales/agent designated unit set (for canManage) ─── */
  useEffect(() => {
    if (!user?.id) {
      setMySalesUnitIds(new Set());
      setMySalesProjectIds(new Set());
      setMyAgentUnitIds(new Set());
      return;
    }
    if (userRole === 'sales') {
      (async () => {
        const [unitRes, projRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('sales_unit_assignments') as any)
            .select('unit_id')
            .eq('sales_user_id', user.id)
            .is('revoked_at', null),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('sales_project_assignments') as any)
            .select('project_id')
            .eq('sales_user_id', user.id)
            .is('revoked_at', null),
        ]);
        setMySalesUnitIds(new Set((unitRes.data || []).map((r: any) => r.unit_id)));
        setMySalesProjectIds(new Set((projRes.data || []).map((r: any) => r.project_id)));
      })();
    } else if (userRole === 'agent') {
      (async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (supabase.from('agent_unit_assignments') as any)
          .select('unit_id')
          .eq('agent_user_id', user.id)
          .is('revoked_at', null);
        setMyAgentUnitIds(new Set((data || []).map((r: any) => r.unit_id)));
      })();
    }
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

  const isAgentUser = userRole === 'agent';

  // My active leads on this unit (for Handoff button)
  const myLeadsOnUnit = unitLeads
    .map((li: any) => li.leads)
    .filter((l: any) => l && l.assigned_to === myUserId && l.status !== 'won' && l.status !== 'lost' && l.status !== 'closed');

  const openHandoffFlow = () => {
    if (myLeadsOnUnit.length === 0) {
      toast.error('ยังไม่มี Lead ของคุณบนยูนิตนี้ — สร้าง Lead ก่อน');
      return;
    }
    if (myLeadsOnUnit.length === 1) {
      const l = myLeadsOnUnit[0];
      setHandoffLeadId(l.id);
      setHandoffCustomerName(l.customers?.full_name);
      setShowHandoffDialog(true);
    } else {
      setShowHandoffPicker(true);
    }
  };

  /* ─── helpers ─── */
  const leadStatusLabel = (status?: string | null): string => {
    if (!status) return '-';
    const map: Record<string, string> = {
      new: 'ใหม่', contacted: 'ติดต่อแล้ว', qualified: 'มีคุณสมบัติ',
      negotiating: 'กำลังเจรจา', negotiation: 'กำลังเจรจา', proposal: 'เสนอขาย',
      won: 'ปิดดีล', closed: 'ปิดการขาย', lost: 'สูญเสีย',
    };
    return map[status] || status;
  };

  const fetchAllTenantLeads = async () => {
    if (!currentTenant?.id) return;
    const { data } = await supabase
      .from('leads')
      .select('id, status, assigned_to, customer_id, customer:customers(id, full_name, phone, email)')
      .eq('tenant_id', currentTenant.id)
      .order('created_at', { ascending: false });
    setAllTenantLeads(data || []);
  };

  const openReserveDialog = async () => {
    setBookingForm({ lead_id: '', deposit_amount: '', expiry_days: 14, notes: '' });
    await fetchAllTenantLeads();
    setShowReserveDialog(true);
  };

  /* ─── reserve / cancel / sold handlers ─── */
  const handleReserveUnit = async () => {
    if (!unit || !user) return;
    if (!bookingForm.lead_id) { toast.error('กรุณาเลือก Lead'); return; }
    const lead = allTenantLeads.find((l: any) => l.id === bookingForm.lead_id);
    if (!lead) { toast.error('ไม่พบ Lead ที่เลือก'); return; }
    const customerName = lead.customer?.full_name || '';
    const customerPhone = lead.customer?.phone || '';
    if (!bookingForm.deposit_amount || parseFloat(bookingForm.deposit_amount) <= 0) {
      toast.error('กรุณากรอกจำนวนเงินจอง'); return;
    }
    setSavingReserve(true);
    try {
      const nowDate = new Date();
      const lockedUntil = new Date(nowDate.getTime() + bookingForm.expiry_days * 86400000).toISOString();
      const { data, error } = await supabase
        .from('units')
        .update({
          status: 'reserved',
          locked_by: user.id,
          locked_until: lockedUntil,
          reservation_date: nowDate.toISOString(),
          reserved_customer_name: customerName,
          reserved_customer_phone: customerPhone || null,
          reserved_customer_lead_id: lead.id,
          deposit_amount: parseFloat(bookingForm.deposit_amount),
          reservation_notes: bookingForm.notes.trim() || null,
        })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์บันทึกการจอง');

      await supabase.from('leads').update({ status: 'won' }).eq('id', lead.id);

      const alreadyInterested = unitLeads.some((li: any) => li.leads?.id === lead.id);
      if (!alreadyInterested) {
        await supabase.from('lead_interests').insert({
          lead_id: lead.id, unit_id: unit.id, property_id: unit.project_id,
          tenant_id: currentTenant?.id, interest_level: 'high', status: 'reserved',
        });
      } else {
        // Sync existing interest to 'reserved' so customer timeline reflects the new stage
        await (supabase.from('lead_interests') as any)
          .update({ status: 'reserved' })
          .eq('lead_id', lead.id)
          .eq('unit_id', unit.id);
      }

      // Create customer-facing booking record so the customer portal sees it
      const customerId = lead.customer_id || lead.customer?.id || null;
      if (customerId) {
        const depositAmt = parseFloat(bookingForm.deposit_amount);
        const unitPrice = Number(unit.price || 0);
        const depositPct = unitPrice > 0 ? depositAmt / unitPrice : 0;
        const reservationDay = nowDate.toISOString().slice(0, 10);
        const transferEstimate = new Date(nowDate.getTime() + 90 * 86400000).toISOString().slice(0, 10);
        await (supabase.from('bookings') as any).insert({
          tenant_id: currentTenant?.id,
          property_id: unit.project_id,
          customer_id: customerId,
          check_in_date: reservationDay,
          check_out_date: transferEstimate,
          total_amount: unitPrice,
          currency: 'THB',
          status: 'pending',
          notes: {
            unit_id: unit.id,
            unit_number: unit.unit_number,
            lead_id: lead.id,
            deposit_amount: depositAmt,
            deposit_pct: depositPct,
            remaining_amount: Math.max(0, unitPrice - depositAmt),
          },
          created_by: user.id,
        });
      }

      toast.success(`บันทึกการจองยูนิต ${unit.unit_number} สำหรับ ${customerName}`);
      setShowReserveDialog(false);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingReserve(false);
    }
  };

  const handleQuickInterest = async () => {
    if (!unit) return;
    if (!quickInterestLeadId) { toast.error('กรุณาเลือก Lead'); return; }
    setSavingQuickInterest(true);
    try {
      const existing = unitLeads.some((li: any) => li.leads?.id === quickInterestLeadId);
      if (existing) {
        toast.info('Lead นี้บันทึกความสนใจในยูนิตนี้แล้ว');
        setShowQuickInterestDialog(false);
        return;
      }
      const { error } = await (supabase as any).from('lead_interests').insert({
        lead_id: quickInterestLeadId,
        unit_id: unit.id,
        property_id: unit.project_id,
        tenant_id: currentTenant?.id,
        interest_level: quickInterestLevel,
        status: 'interested',
        notes: 'บันทึกโดย Agent ที่หน้างาน',
      });
      if (error) throw error;
      toast.success(`บันทึกความสนใจยูนิต ${unit.unit_number} สำเร็จ`);
      setShowQuickInterestDialog(false);
      setQuickInterestLeadId('');
      setQuickInterestLevel('high');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingQuickInterest(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!unit) return;
    if (!confirm(`ปิดการขายยูนิต ${unit.unit_number}? (สถานะจะเปลี่ยนเป็น "ขายแล้ว")`)) return;
    try {
      const { data, error } = await supabase
        .from('units')
        .update({ status: 'sold', locked_until: null, sold_at: new Date().toISOString() })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ปิดการขาย');
      if (unit.reserved_customer_lead_id) {
        await supabase.from('leads').update({ status: 'won' }).eq('id', unit.reserved_customer_lead_id);
        // Sync the matching lead_interest → 'won' so customer timeline reflects the close
        await (supabase.from('lead_interests') as any)
          .update({ status: 'won' })
          .eq('lead_id', unit.reserved_customer_lead_id)
          .eq('unit_id', unit.id);
      }
      // Promote pending booking → confirmed (customer sees: ชำระแล้ว · ทำสัญญา)
      await (supabase.from('bookings') as any)
        .update({ status: 'confirmed' })
        .eq('tenant_id', currentTenant?.id)
        .filter('notes->>unit_id', 'eq', unit.id)
        .in('status', ['pending']);
      toast.success(`ปิดการขายยูนิต ${unit.unit_number} สำเร็จ`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'ปิดการขายไม่สำเร็จ');
    }
  };

  const handleCancelReservation = async () => {
    if (!unit) return;
    if (!confirm('ยกเลิกการจองยูนิตนี้? (ข้อมูลผู้จอง + เงินจองจะถูกลบ)')) return;
    try {
      const { data, error } = await supabase
        .from('units')
        .update({
          status: 'available', locked_by: null, locked_until: null,
          reservation_date: null, reserved_customer_name: null, reserved_customer_phone: null,
          reserved_customer_lead_id: null, deposit_amount: null, reservation_notes: null,
        })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ยกเลิก');
      // Cancel any open bookings tied to this unit so customer sees "ยกเลิก"
      await (supabase.from('bookings') as any)
        .update({ status: 'cancelled' })
        .eq('tenant_id', currentTenant?.id)
        .filter('notes->>unit_id', 'eq', unit.id)
        .in('status', ['pending', 'confirmed']);
      // Revert any 'reserved'/'won' interest for this unit so customer timeline reflects the rollback
      if (unit.reserved_customer_lead_id) {
        await (supabase.from('lead_interests') as any)
          .update({ status: 'interested' })
          .eq('lead_id', unit.reserved_customer_lead_id)
          .eq('unit_id', unit.id)
          .in('status', ['reserved', 'won']);
      }
      toast.success(`ยกเลิกจองยูนิต ${unit.unit_number}`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'ยกเลิกไม่สำเร็จ');
    }
  };

  const handleLeadCreated = async () => {
    setShowAddLeadModal(false);
    await loadAll();
    toast.success('เพิ่ม Lead สำเร็จ — เลือกได้ใน "บันทึกการจอง"');
  };

  /* ─── LINE share ─── */
  const buildShareMessage = (): string => {
    if (!unit || !property) return '';
    const priceM = (unit.promo_price && unit.promo_price < unit.price)
      ? `${(unit.promo_price / 1_000_000).toFixed(2)} ล้าน (จากเดิม ${(unit.price / 1_000_000).toFixed(2)} ล้าน)`
      : `${(unit.price / 1_000_000).toFixed(2)} ล้าน`;
    const address = property.address?.street
      || `${property.address?.district || ''} ${property.address?.province || ''}`.trim();
    const specs: string[] = [];
    if (unit.bedrooms) specs.push(`🛏 ${unit.bedrooms} ห้องนอน`);
    if (unit.bathrooms) specs.push(`🛁 ${unit.bathrooms} ห้องน้ำ`);
    if (unit.area_sqm) specs.push(`📐 ${unit.area_sqm} ตร.ม.`);
    const lines = [
      `🏠 ${property.name} — ยูนิต ${unit.unit_number}`,
      address ? `📍 ${address}` : null,
      `💰 ${priceM}`,
      specs.join(' · '),
      unit.view ? `🌅 ${unit.view}` : null,
      '',
      `ดูรายละเอียดเพิ่ม: ${window.location.origin}/units/${unit.id}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleShareLine = () => {
    const text = buildShareMessage();
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/units/${unit?.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success('คัดลอกลิงก์เรียบร้อย');
    } catch {
      toast.error('คัดลอกไม่สำเร็จ');
    }
  };

  /* ─── derived ─── */
  const allImages = useMemo(() => {
    if (!unit) return [];
    return Array.from(new Set([
      ...(unit.thumbnail_url ? [unit.thumbnail_url] : []),
      ...(unit.images || []),
    ])).filter(Boolean);
  }, [unit]);

  const statusConfig = useMemo(() => {
    if (!unit) return { label: '-', dotClass: 'bg-gray-400', wrapClass: 'bg-gray-50 text-gray-600' };
    switch (unit.status) {
      case 'available': return { label: 'ว่าง', dotClass: 'bg-green-500', wrapClass: 'bg-green-50 text-green-700 border-green-200' };
      case 'reserved': return { label: 'จอง', dotClass: 'bg-amber-500', wrapClass: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'sold': return { label: 'ขายแล้ว', dotClass: 'bg-red-500', wrapClass: 'bg-red-50 text-red-700 border-red-200' };
      default: return { label: 'ไม่พร้อมขาย', dotClass: 'bg-gray-400', wrapClass: 'bg-gray-50 text-gray-600 border-gray-200' };
    }
  }, [unit]);

  /* ─── loading / not found ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-chateau" />
        </div>
      </div>
    );
  }
  if (!unit || !property) return null;

  const expiry = unit.locked_until ? new Date(unit.locked_until) : null;
  const expired = expiry ? expiry.getTime() < now : false;
  const isReservedActive = unit.status === 'reserved' && !!unit.reserved_customer_name;
  const isSold = unit.status === 'sold' && !!unit.reserved_customer_name;
  const canManage = canManageUnit(unit.id, unit.project_id) || userRole === 'owner' || userRole === 'admin';

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 max-w-6xl mx-auto space-y-5">
          {/* Back + Header */}
          <Button
            variant="outline"
            onClick={() => navigate(`/properties?project=${unit.project_id}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            กลับไปยูนิตในโครงการ
          </Button>

          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold gradient-primary-text">ยูนิต {unit.unit_number}</h1>
              <p className="text-base text-gray-600 mt-1">
                <MapPin className="w-4 h-4 inline-block mr-1" />
                {property.name}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium',
                statusConfig.wrapClass
              )}>
                <span className={cn('w-2 h-2 rounded-full', statusConfig.dotClass)} />
                {statusConfig.label}
              </div>
              <Button
                variant="outline"
                onClick={handleShareLine}
                className="border-green-300 text-green-700 hover:bg-green-50"
                title="แชร์ลิงก์ + รายละเอียดยูนิตไปยังลูกค้าผ่าน LINE"
              >
                <Share2 className="w-4 h-4 mr-1" /> แชร์ LINE
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyLink}
                title="คัดลอกลิงก์หน้านี้"
              >
                คัดลอกลิงก์
              </Button>
              {(userRole === 'owner' || userRole === 'admin') && (
                <Button
                  variant="outline"
                  onClick={() => navigate(`/units/${unit.id}/edit`)}
                >
                  <Edit className="w-4 h-4 mr-1" /> แก้ไขยูนิต
                </Button>
              )}
            </div>
          </div>

          {/* Gallery */}
          {allImages.length > 0 && (
            <Card className="overflow-hidden border border-gray-200">
              <CardContent className="p-4">
                <a href={allImages[0]} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={allImages[0]}
                    alt={unit.unit_number}
                    className="w-full h-[420px] object-cover rounded-lg border border-gray-200 hover:border-chateau transition-colors"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </a>
                {allImages.length > 1 && (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mt-3">
                    {allImages.slice(1).map((img, idx) => (
                      <a key={idx} href={img} target="_blank" rel="noopener noreferrer">
                        <img
                          src={img}
                          alt={`Unit image ${idx + 2}`}
                          className="w-full h-24 object-cover rounded-lg border border-gray-100 hover:border-chateau transition-colors"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reservation card */}
          {isSold && (
            <Card className="border-2 border-green-200 bg-green-50/30">
              <CardHeader className="bg-green-50 border-b border-green-200 pb-3">
                <CardTitle className="text-base font-semibold text-green-900 flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  ปิดการขายแล้ว
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoCell label="ลูกค้า" value={unit.reserved_customer_name} bold />
                  <InfoCell label="เบอร์โทร" value={unit.reserved_customer_phone || '-'} />
                  <InfoCell label="เงินจอง" value={unit.deposit_amount ? `฿${Number(unit.deposit_amount).toLocaleString()}` : '-'} />
                  <InfoCell label="Sales รับผิดชอบ" value={unit.locked_by_name || '-'} />
                </div>
              </CardContent>
            </Card>
          )}

          {isReservedActive && (
            <Card className="border-2 border-amber-200 bg-amber-50/30">
              <CardHeader className="bg-amber-50 border-b border-amber-200 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    ข้อมูลผู้จอง
                    {expired && <Badge className="bg-red-100 text-red-700 border-red-200">หมดอายุแล้ว</Badge>}
                  </CardTitle>
                  {canManage && (
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleMarkAsSold} className="bg-green-600 hover:bg-green-700 text-white">
                        <Check className="w-4 h-4 mr-1" /> ปิดการขาย
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleCancelReservation} className="text-red-600 border-red-200 hover:bg-red-50">
                        ยกเลิกการจอง
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <InfoCell label="ชื่อลูกค้า" value={unit.reserved_customer_name} bold />
                  <InfoCell label="เบอร์โทร" value={unit.reserved_customer_phone || '-'} />
                  <InfoCell label="เงินจอง" value={unit.deposit_amount ? `฿${Number(unit.deposit_amount).toLocaleString()}` : '-'} valueClass="text-green-700 font-bold" />
                  <InfoCell label="วันที่จอง" value={unit.reservation_date ? new Date(unit.reservation_date).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : '-'} />
                  <InfoCell
                    label="หมดอายุ"
                    value={
                      expiry
                        ? `${expiry.toLocaleDateString('th-TH', { dateStyle: 'medium' })}${!expired ? ` (อีก ${Math.ceil((expiry.getTime() - now) / 86400000)} วัน)` : ''}`
                        : '-'
                    }
                    valueClass={expired ? 'text-red-700 font-medium' : ''}
                  />
                  <InfoCell label="Sales รับผิดชอบ" value={unit.locked_by_name || '-'} />
                </div>
                {unit.reservation_notes && (
                  <div className="mt-3 p-3 bg-white rounded-lg border border-gray-200">
                    <p className="text-xs font-medium text-gray-500 mb-1">หมายเหตุ</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{unit.reservation_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {unit.status === 'available' && canManage && (
            <Card className="border border-dashed border-gray-300">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div>
                      <p className="text-sm font-semibold text-gray-700">ยูนิตยังว่าง</p>
                      <p className="text-xs text-gray-500">
                        {isAgentUser
                          ? unitLeads.length > 0
                            ? `มี ${unitLeads.length} Lead สนใจอยู่ — ส่งต่อให้ Sales จองให้`
                            : 'ลูกค้าสนใจ? บันทึกความสนใจ + Lead แล้วส่งต่อ Sales'
                          : unitLeads.length > 0
                            ? `มี ${unitLeads.length} Lead สนใจอยู่ — บันทึกการจองได้`
                            : 'ยังไม่มี Lead สนใจ — เพิ่ม Lead ก่อนถ้าลูกค้าจะจอง'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {isAgentUser ? (
                      <>
                        <Button variant="outline" onClick={async () => { await fetchAllTenantLeads(); setShowQuickInterestDialog(true); }} className="border-rose-200 text-rose-700 hover:bg-rose-50">
                          <Heart className="w-4 h-4 mr-1" /> ลูกค้าสนใจ
                        </Button>
                        <Button variant="outline" onClick={() => setShowAddLeadModal(true)}>
                          <UserPlus className="w-4 h-4 mr-1" /> เพิ่ม Lead ใหม่
                        </Button>
                        {myLeadsOnUnit.length > 0 && (
                          <Button onClick={openHandoffFlow} className="bg-chateau hover:bg-chateau-600 text-white">
                            <Send className="w-4 h-4 mr-1" /> ส่งต่อให้ Sales{myLeadsOnUnit.length > 1 ? ` (${myLeadsOnUnit.length})` : ''}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setShowAddLeadModal(true)}>
                          <UserPlus className="w-4 h-4 mr-1" /> เพิ่ม Lead ใหม่
                        </Button>
                        <Button onClick={openReserveDialog} className="bg-amber-500 hover:bg-amber-600 text-white">
                          <Calendar className="w-4 h-4 mr-1" /> บันทึกการจอง
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sales responsibility (Admin/Owner view) */}
          {(userRole === 'owner' || userRole === 'admin') && (
            <Card className="border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-chateau" /> Sales รับผิดชอบ
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/permissions')}
                  >
                    มอบหมาย Sales
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {responsibleSales.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500 italic">
                    ⚠ ยังไม่มี Sales ที่ดูแลยูนิตนี้
                    <p className="text-xs text-gray-400 mt-1">
                      กด "มอบหมาย Sales" เพื่อกำหนด — ไปที่หน้าสิทธิ์ผู้ใช้งาน → Tab "สิทธิ์ Sales ดูแลยูนิต"
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {responsibleSales.map((s) => (
                      <div key={s.id} className="flex items-center gap-2 px-3 py-2 bg-chateau-50 border border-chateau-100 rounded-full">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-chateau to-purple-600 text-white flex items-center justify-center text-xs font-semibold">
                          {s.name.slice(0, 1).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-chateau">{s.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Pricing */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-chateau" /> ราคา
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-wrap items-baseline gap-3">
                {unit.promo_price && unit.promo_price < unit.price ? (
                  <>
                    <span className="text-3xl font-bold text-chateau">{(unit.promo_price / 1_000_000).toFixed(2)} ล้าน</span>
                    <span className="text-lg text-gray-400 line-through">{(unit.price / 1_000_000).toFixed(2)} ล้าน</span>
                    <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                      ลด {(((unit.price - unit.promo_price) / unit.price) * 100).toFixed(0)}%
                    </Badge>
                  </>
                ) : (
                  <span className="text-3xl font-bold text-gray-900">{(unit.price / 1_000_000).toFixed(2)} ล้าน</span>
                )}
              </div>
              {unit.price_per_sqm && (
                <p className="text-sm text-gray-500 mt-2">฿{Number(unit.price_per_sqm).toLocaleString()} / ตร.ม.</p>
              )}
            </CardContent>
          </Card>

          {/* Specs */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="w-5 h-5 text-chateau" /> ข้อมูลยูนิต
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoCell label="เลขที่ยูนิต" value={unit.unit_number} bold />
                {unit.plot_number && <InfoCell label="เลขแปลง" value={unit.plot_number} bold />}
                <InfoCell
                  label={unit.floor_count && unit.floor_count > 1 ? 'จำนวนชั้น' : 'ชั้น'}
                  value={unit.floor_count && unit.floor_count > 1 ? `${unit.floor_count} ชั้น` : (unit.floor_number?.toString() || '-')}
                  bold
                />
                <InfoCell label="พื้นที่ใช้สอย" value={unit.area_sqm ? `${unit.area_sqm} ตร.ม.` : '-'} bold />
                {unit.land_area_sqw && <InfoCell label="ที่ดิน" value={`${unit.land_area_sqw} ตร.วา`} bold />}
                {unit.facing_direction && <InfoCell label="ทิศ" value={unit.facing_direction} bold />}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                <IconCell icon={<Bed className="w-5 h-5 text-chateau" />} label="ห้องนอน" value={unit.bedrooms || 0} />
                <IconCell icon={<Bath className="w-5 h-5 text-chateau" />} label="ห้องน้ำ" value={unit.bathrooms || 0} />
                <IconCell icon={<Square className="w-5 h-5 text-chateau" />} label="ที่จอดรถ" value={unit.parking_spaces || 0} />
              </div>
            </CardContent>
          </Card>

          {/* Highlights */}
          {(unit.view || unit.furnishing || unit.pool || unit.garden || unit.balcony || unit.building || unit.layout_description) && (
            <Card className="border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold">จุดเด่นยูนิต</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {unit.view && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600 mb-1">🌅 วิว</p>
                    <p className="text-sm font-medium text-gray-900">{unit.view}</p>
                  </div>
                )}
                {unit.furnishing && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600 mb-1">🛋 สถานะตกแต่ง</p>
                    <p className="text-sm font-medium text-gray-900">
                      {unit.furnishing === 'fully' && 'ตกแต่งครบ พร้อมอยู่'}
                      {unit.furnishing === 'partial' && 'ตกแต่งบางส่วน'}
                      {unit.furnishing === 'unfurnished' && 'ไม่ตกแต่ง'}
                    </p>
                  </div>
                )}
                {(unit.pool || unit.garden || unit.balcony || unit.building) && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">คุณสมบัติ</p>
                    <div className="flex flex-wrap gap-2">
                      {unit.pool && <Badge className="bg-cyan-100 text-cyan-800 hover:bg-cyan-200">🏊 มีสระว่ายน้ำ</Badge>}
                      {unit.garden && <Badge className="bg-green-100 text-green-800 hover:bg-green-200">🌿 มีสวน</Badge>}
                      {unit.balcony && <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">🪟 มีระเบียง</Badge>}
                      {unit.building && <Badge variant="outline" className="border-orange-300 text-orange-700">🏢 อาคาร {unit.building}</Badge>}
                    </div>
                  </div>
                )}
                {unit.layout_description && (
                  <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-xs font-semibold text-slate-700 mb-2">รายละเอียด</p>
                    <p className="text-sm text-slate-600 leading-relaxed">{unit.layout_description}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Floor Plan + 3D Tour */}
          {(unit.floor_plan_url || unit.tour_3d_url) && (
            <Card className="border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Layers className="w-5 h-5 text-chateau" /> แผนผัง & 3D Tour
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                {unit.floor_plan_url && (
                  <div>
                    <p className="text-xs font-semibold text-slate-700 mb-2">📐 ผังห้อง</p>
                    <img
                      src={unit.floor_plan_url}
                      alt="Floor plan"
                      className="w-full max-h-[480px] object-contain rounded-lg border border-gray-200 bg-white"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
                {unit.tour_3d_url && (
                  <a
                    href={unit.tour_3d_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium text-sm shadow-sm hover:shadow-md transition-shadow"
                  >
                    <Eye className="w-4 h-4" /> เปิด 3D Virtual Tour
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Project Site Plan */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="w-5 h-5 text-chateau" />
                ผังโครงการ
                {unit.plot_number && (
                  <Badge variant="outline" className="ml-2 border-chateau text-chateau">
                    แปลง {unit.plot_number}
                  </Badge>
                )}
                {(!property.master_plan_url || property.master_plan_url.includes('placehold.co') || masterPlanImgError) && (
                  <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 bg-amber-50">
                    ผังจำลอง
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {property.master_plan_url && !property.master_plan_url.includes('placehold.co') && !masterPlanImgError ? (
                <>
                  <a href={property.master_plan_url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-gray-200 hover:border-chateau">
                    <img
                      src={property.master_plan_url}
                      alt={`Master plan ${property.name}`}
                      className="w-full max-h-[520px] object-cover"
                      onError={() => setMasterPlanImgError(true)}
                    />
                  </a>
                  <p className="text-xs text-gray-500 mt-2">คลิกเพื่อดูภาพขนาดเต็ม</p>
                </>
              ) : (
                <>
                  <MasterPlanSVG units={siblingUnits} highlightedUnitId={unit.id} projectName={property.name} />
                  <p className="text-xs text-amber-700 mt-2">
                    {masterPlanImgError
                      ? '⚠ URL ที่ใส่ไม่ใช่รูปภาพโดยตรง — ผังจำลองสร้างจากข้อมูลยูนิต'
                      : '💡 ผังนี้สร้างจากข้อมูลยูนิตจริง — admin upload ผังจริงผ่านฟอร์มแก้ไขโครงการได้'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Map */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-chateau" /> ตำแหน่งโครงการ
                </CardTitle>
                {canManage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/properties/${unit.project_id}/edit?section=location`)}
                  >
                    <Edit className="w-3.5 h-3.5 mr-1" /> แก้ไขข้อมูลโครงการ
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {property.location_lat && property.location_lng ? (
                <>
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    <iframe
                      title={`Map of ${property.name}`}
                      src={`https://www.google.com/maps?q=${property.location_lat},${property.location_lng}&hl=th&z=15&output=embed`}
                      width="100%"
                      height="320"
                      style={{ border: 0 }}
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    📍 {property.address?.street || `${property.address?.district || ''}, ${property.address?.province || ''}`}
                  </p>
                </>
              ) : (
                <div className="py-10 text-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่ได้ตั้งค่าตำแหน่งโครงการ</p>
                  {canManage && (
                    <p className="text-xs text-gray-400 mt-1">กด "แก้ไขข้อมูลโครงการ" ด้านบนเพื่อใส่ lat/lng</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Nearby */}
          {property.nearby && property.nearby.length > 0 && (
            <Card className="border border-gray-200">
              <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-chateau" /> ทำเลใกล้เคียง
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {property.nearby.map((place, idx) => {
                    const icon =
                      place.type === 'shopping' ? '🏬' : place.type === 'transit' ? '🚇' :
                      place.type === 'hospital' ? '🏥' : place.type === 'school' ? '🏫' :
                      place.type === 'airport' ? '✈️' : place.type === 'beach' ? '🏖' :
                      place.type === 'market' ? '🍜' : place.type === 'landmark' ? '🛕' :
                      place.type === 'leisure' ? '⛳' : '📍';
                    return (
                      <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="text-xl flex-shrink-0">{icon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{place.name}</p>
                          <p className="text-xs text-gray-500">{place.distance_km} กม.</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Leads interested */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gray-50 border-b border-gray-100 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 justify-between">
                <span>Leads ที่สนใจยูนิตนี้</span>
                <Badge variant="secondary" className="bg-chateau-50 text-chateau border border-chateau-100">
                  {unitLeads.length} รายการ
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {unitLeads.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">ยังไม่มี Lead ที่สนใจยูนิตนี้</div>
              ) : (
                <div className="space-y-2">
                  {unitLeads.map((li: any) => {
                    const lead = li.leads;
                    if (!lead) return null;
                    return (
                      <div key={li.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{lead.customers?.full_name || '-'}</p>
                          <p className="text-xs text-gray-500">{lead.customers?.phone || ''}</p>
                        </div>
                        <Badge className="bg-amber-100 text-amber-800">{leadStatusLabel(lead.status)}</Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Reserve dialog */}
      <Dialog open={showReserveDialog} onOpenChange={setShowReserveDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" /> บันทึกการจอง — ยูนิต {unit.unit_number}
            </DialogTitle>
            <DialogDescription>
              บันทึกข้อมูลลูกค้าที่จ่ายเงินจองและล็อคยูนิตจนกว่าจะทำสัญญา
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">เลือก Lead ที่จะจอง <span className="text-red-500">*</span></Label>
              {allTenantLeads.length === 0 ? (
                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-900 font-medium mb-1">⚠️ ยังไม่มี Lead ในระบบ</p>
                  <p className="text-xs text-amber-800">กดปิดและใช้ปุ่ม "+ เพิ่ม Lead ใหม่"</p>
                </div>
              ) : (() => {
                const activeLeads = allTenantLeads.filter(
                  (l: any) => l.status !== 'won' && l.status !== 'lost' && l.status !== 'closed'
                );
                const interestedIds = new Set(unitLeads.map((li: any) => li.leads?.id).filter(Boolean));
                const interested = activeLeads.filter((l: any) => interestedIds.has(l.id));
                const others = activeLeads.filter((l: any) => !interestedIds.has(l.id));
                if (activeLeads.length === 0) {
                  return (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-900 font-medium">⚠️ ไม่มี Lead ที่ active</p>
                      <p className="text-xs text-amber-800">Lead ทุกคนปิดดีล/สูญเสียไปแล้ว — กด "+ เพิ่ม Lead ใหม่"</p>
                    </div>
                  );
                }
                return (
                  <Select value={bookingForm.lead_id} onValueChange={(v) => setBookingForm({ ...bookingForm, lead_id: v })}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={`-- เลือก Lead (${activeLeads.length} คน) --`} />
                    </SelectTrigger>
                    <SelectContent>
                      {interested.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 sticky top-0">
                            🔥 สนใจยูนิตนี้แล้ว ({interested.length})
                          </div>
                          {interested.map((lead: any) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              <span className="font-medium">{lead.customer?.full_name || '(ไม่มีชื่อ)'}</span>
                              {lead.customer?.phone && <span className="text-xs text-gray-500 ml-2">{lead.customer.phone}</span>}
                            </SelectItem>
                          ))}
                        </>
                      )}
                      {others.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-600 bg-gray-50 sticky top-0">
                            👥 Lead อื่นใน tenant ({others.length})
                          </div>
                          {others.map((lead: any) => (
                            <SelectItem key={lead.id} value={lead.id}>
                              {lead.customer?.full_name || '(ไม่มีชื่อ)'}
                              {lead.customer?.phone && <span className="text-xs text-gray-500 ml-2">{lead.customer.phone}</span>}
                            </SelectItem>
                          ))}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                );
              })()}
              {bookingForm.lead_id && !unitLeads.some((li: any) => li.leads?.id === bookingForm.lead_id) && (
                <p className="text-xs text-blue-700 mt-1.5">
                  💡 Lead นี้ยังไม่ได้บันทึกความสนใจในยูนิตนี้ — ระบบจะเพิ่มให้อัตโนมัติ
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="booking_deposit" className="text-sm font-medium">จำนวนเงินจอง (บาท) <span className="text-red-500">*</span></Label>
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
                      'p-3 rounded-lg border-2 text-center transition-all',
                      bookingForm.expiry_days === days
                        ? 'border-amber-500 bg-amber-50 text-amber-900'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
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
                placeholder="ลูกค้าจะกลับมาเซ็นสัญญา 25 พ.ค. / ขอสินเชื่อกับธนาคาร X / ฯลฯ"
                rows={2}
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReserveDialog(false)} disabled={savingReserve}>ยกเลิก</Button>
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

      {/* Quick Mark Interest dialog (Agent — fastest action) */}
      <Dialog open={showQuickInterestDialog} onOpenChange={setShowQuickInterestDialog}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-600" /> บันทึก "ลูกค้าสนใจ" — ยูนิต {unit.unit_number}
            </DialogTitle>
            <DialogDescription>
              บันทึกความสนใจเร็วๆ ที่หน้างาน — ไม่ล็อคยูนิต, ใช้ติดตามต่อในระบบ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm font-medium">เลือก Lead ลูกค้า <span className="text-red-500">*</span></Label>
              {(() => {
                const myLeads = allTenantLeads.filter((l: any) =>
                  l.assigned_to === myUserId && l.status !== 'won' && l.status !== 'lost' && l.status !== 'closed'
                );
                if (myLeads.length === 0) {
                  return (
                    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <p className="text-sm text-gray-800">ยังไม่มี Lead ของคุณ — กดปิดและใช้ปุ่ม "+ เพิ่ม Lead ใหม่"</p>
                    </div>
                  );
                }
                return (
                  <Select value={quickInterestLeadId} onValueChange={setQuickInterestLeadId}>
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder={`-- เลือก Lead ของคุณ (${myLeads.length} คน) --`} />
                    </SelectTrigger>
                    <SelectContent>
                      {myLeads.map((lead: any) => (
                        <SelectItem key={lead.id} value={lead.id}>
                          <span className="font-medium">{lead.customer?.full_name || '(ไม่มีชื่อ)'}</span>
                          {lead.customer?.phone && <span className="text-xs text-gray-500 ml-2">{lead.customer.phone}</span>}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">ระดับความสนใจ</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { v: 'high',   label: '🔥 สนใจมาก', selectedCls: 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200' },
                  { v: 'medium', label: '👀 สนใจ',      selectedCls: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200' },
                  { v: 'low',    label: '💭 ดูเฉยๆ',    selectedCls: 'border-gray-500 bg-gray-100 text-gray-900 ring-2 ring-gray-200' },
                ] as const).map((opt) => (
                  <button
                    key={opt.v}
                    type="button"
                    onClick={() => setQuickInterestLevel(opt.v)}
                    className={cn(
                      'p-2.5 rounded-lg border-2 text-center text-sm font-medium transition-all',
                      quickInterestLevel === opt.v
                        ? opt.selectedCls
                        : 'border-gray-200 hover:border-gray-300 text-gray-600 bg-white'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowQuickInterestDialog(false)} disabled={savingQuickInterest}>ยกเลิก</Button>
            <Button
              onClick={handleQuickInterest}
              disabled={savingQuickInterest || !quickInterestLeadId}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {savingQuickInterest ? 'กำลังบันทึก...' : 'บันทึกความสนใจ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onLeadCreated={handleLeadCreated}
        initialPropertyId={property.id}
        initialUnitId={unit.id}
      />

      {/* Handoff Lead Dialog (Agent → Sales) */}
      <HandoffLeadDialog
        open={showHandoffDialog}
        onOpenChange={(open) => {
          setShowHandoffDialog(open);
          if (!open) { setHandoffLeadId(null); setHandoffCustomerName(undefined); }
        }}
        leadId={handoffLeadId}
        customerName={handoffCustomerName}
        unitId={unit.id}
        projectId={unit.project_id}
        onSuccess={() => { loadAll(); }}
      />

      {/* Handoff Picker — when multiple Leads of mine on this unit */}
      <Dialog open={showHandoffPicker} onOpenChange={setShowHandoffPicker}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-chateau" /> เลือก Lead ที่จะส่งต่อ
            </DialogTitle>
            <DialogDescription>
              ยูนิต {unit.unit_number} มี {myLeadsOnUnit.length} Lead ของคุณ — เลือกคนที่จะส่งต่อให้ Sales
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {myLeadsOnUnit.map((l: any) => (
              <button
                key={l.id}
                onClick={() => {
                  setHandoffLeadId(l.id);
                  setHandoffCustomerName(l.customers?.full_name);
                  setShowHandoffPicker(false);
                  setShowHandoffDialog(true);
                }}
                className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-chateau hover:bg-chateau-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{l.customers?.full_name || '(ไม่มีชื่อ)'}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {l.customers?.phone || ''} · สถานะ {leadStatusLabel(l.status)}
                </p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHandoffPicker(false)}>ยกเลิก</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ─── small helpers ─── */
const InfoCell = ({ label, value, bold, valueClass }: { label: string; value: any; bold?: boolean; valueClass?: string }) => (
  <div className="p-3 bg-white rounded-lg border border-gray-200">
    <p className="text-xs font-medium text-gray-500 mb-0.5">{label}</p>
    <p className={cn('text-sm text-gray-900', bold && 'font-semibold text-base', valueClass)}>{value}</p>
  </div>
);

const IconCell = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) => (
  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
    {icon}
    <div>
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  </div>
);

export default UnitDetail;
