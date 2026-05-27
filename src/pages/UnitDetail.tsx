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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2, Bed, Bath, Square, MapPin, Layers, DollarSign, Eye,
  Calendar, Check, ArrowLeft, UserPlus, Loader2, Edit, Share2, Heart, Send, Users, MoreHorizontal, Trash2,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import MasterPlanSVG from '@/components/properties/MasterPlanSVG';
import AddLeadModal from '@/components/leads/AddLeadModal';
import HandoffLeadDialog from '@/components/leads/HandoffLeadDialog';
import SitePlanViewer from '@/components/properties/SitePlanViewer';

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
  // Assign-sales picker — Admin/Owner clicks "มอบหมาย Sales" to open this dialog,
  // tick the Sales people who should be responsible for this unit, and save.
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [teamSales, setTeamSales] = useState<{ id: string; name: string; email?: string }[]>([]);
  const [pickedSalesIds, setPickedSalesIds] = useState<Set<string>>(new Set());
  const [savingAssignments, setSavingAssignments] = useState(false);
  // Active booking for this unit (tracks deposit confirmation state)
  const [activeBooking, setActiveBooking] = useState<{ id: string; status: string; total_amount: number } | null>(null);
  // Revert-sale dialog state (Admin/Owner only — voids a sold unit back to reserved)
  const [showRevertSaleDialog, setShowRevertSaleDialog] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [reverting, setReverting] = useState(false);
  // Cancel-reservation dialog state — captures refund amount + reason so finance
  // can see how much of each cancelled deposit was returned vs forfeited.
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelRefundAmount, setCancelRefundAmount] = useState<string>('');
  const [cancelRefundReason, setCancelRefundReason] = useState<string>('');
  const [cancelling, setCancelling] = useState(false);
  // Delete-lead-interest dialog state — soft-delete via status='dropped' so the
  // interest disappears from this unit's list without nuking lead history. Captures
  // a reason that goes into both lead_interests.notes AND activity_logs.
  const [showDeleteInterestDialog, setShowDeleteInterestDialog] = useState(false);
  const [deleteInterestTarget, setDeleteInterestTarget] = useState<{
    interestId: string;
    leadId: string;
    customerName: string;
    status: string;
  } | null>(null);
  const [deleteInterestReason, setDeleteInterestReason] = useState<string>('');
  const [deletingInterest, setDeletingInterest] = useState(false);
  // Inline viewing-date editor state (Sales schedules a visit from the unit page)
  const [editingVisitInterestId, setEditingVisitInterestId] = useState<string | null>(null);
  const [visitDraft, setVisitDraft] = useState<string>('');
  const [savingVisit, setSavingVisit] = useState(false);
  const [allTenantLeads, setAllTenantLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Agent's own referral code — appended to share URLs so Quick Reserve attribution
  // travels with every shared link. null for non-agent roles or before fetch resolves.
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);

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


  // Sales designated units
  const [mySalesUnitIds, setMySalesUnitIds] = useState<Set<string>>(new Set());
  const [mySalesProjectIds, setMySalesProjectIds] = useState<Set<string>>(new Set());
  const [myAgentUnitIds, setMyAgentUnitIds] = useState<Set<string>>(new Set());
  const [showQuickInterestDialog, setShowQuickInterestDialog] = useState(false);
  const [quickInterestLeadId, setQuickInterestLeadId] = useState('');
  const [quickInterestLevel, setQuickInterestLevel] = useState<'high' | 'medium' | 'low'>('high');
  const [savingQuickInterest, setSavingQuickInterest] = useState(false);
  const [showHandoffDialog, setShowHandoffDialog] = useState(false);
  const [handoffLeadIds, setHandoffLeadIds] = useState<string[]>([]);
  const [showHandoffPicker, setShowHandoffPicker] = useState(false);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);

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
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unitData, error: unitErr } = await (supabase.from('units') as any)
        .select('*')
        .eq('id', unitId)
        .single();
      if (unitErr || !unitData) {
        toast.error('ไม่พบยูนิต');
        navigate('/properties');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const [{ data: propData }, { data: sibs }, { data: leadsData }] = await Promise.all([
        (supabase.from('properties') as any).select('*').eq('id', unitData.project_id).single(),
        (supabase.from('units') as any).select('id, unit_number, status').eq('project_id', unitData.project_id),
        (supabase.from('lead_interests') as any)
          .select('id, lead_id, status, interest_level, viewing_date, viewed_at, notes, leads:lead_id(id, status, assigned_to, customers:customer_id(id, full_name, email, phone))')
          .eq('unit_id', unitId)
          .not('status', 'in', '("dropped","lost")'),
      ]);

      let lockedByName: string | null = null;
      if (unitData.locked_by) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: u } = await (supabase.from('users') as any)
          .select('full_name, email')
          .eq('id', unitData.locked_by)
          .single();
        lockedByName = u?.full_name || u?.email || null;
      }

      setUnit({ ...unitData, locked_by_name: lockedByName });
      setProperty(propData || null);
      setSiblingUnits(sibs || []);

      // Self-heal invalid state #1: status='viewing_scheduled' with no viewing_date is
      // a contradiction (created by legacy data or by clearing a date via an old code
      // path that didn't revert status). Demote those interests back to 'interested'
      // so the UI never shows "นัดดู" without a date.
      //
      // Self-heal invalid state #2: interest.status='reserved'/'won' while the unit
      // is actually 'available' — happens when a cancellation rolled back the unit
      // but didn't sync the interest record (older code paths). The orphan interest
      // makes the "ลบ" button incorrectly show a "ต้องยกเลิกจองก่อน" tooltip even
      // though there's nothing to cancel. Demote to 'negotiating' so it reflects
      // reality (lead was in active discussion but no deposit held).
      const invalidInterests = (leadsData || []).filter(
        (li: any) => li.status === 'viewing_scheduled' && !li.viewing_date,
      );
      const orphanReservedInterests = (leadsData || []).filter(
        (li: any) => ['reserved', 'won'].includes(li.status) && unitData.status === 'available',
      );
      if (invalidInterests.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('lead_interests') as any)
            .update({ status: 'interested' })
            .in('id', invalidInterests.map((li: any) => li.id));
          // Mirror the fix in local state so UI shows the corrected status immediately
          (leadsData || []).forEach((li: any) => {
            if (li.status === 'viewing_scheduled' && !li.viewing_date) {
              li.status = 'interested';
            }
          });
        } catch { /* non-blocking — UI still renders, just may show the bad state until refresh */ }
      }
      if (orphanReservedInterests.length > 0) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('lead_interests') as any)
            .update({ status: 'negotiating' })
            .in('id', orphanReservedInterests.map((li: any) => li.id));
          (leadsData || []).forEach((li: any) => {
            if (['reserved', 'won'].includes(li.status) && unitData.status === 'available') {
              li.status = 'negotiating';
            }
          });
        } catch { /* non-blocking */ }
      }

      setUnitLeads(leadsData || []);

      // Load the active (non-cancelled) booking for this unit so we can show
      // the "ยืนยันรับเงิน" CTA only when there's a pending booking to confirm.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: activeBookings } = await (supabase.from('bookings') as any)
        .select('id, status, total_amount')
        .eq('tenant_id', unitData.tenant_id)
        .filter('notes->>unit_id', 'eq', unitId)
        .not('status', 'in', '("cancelled","checked_out")')
        .order('created_at', { ascending: false })
        .limit(1);
      setActiveBooking((activeBookings as any[])?.[0] || null);

      // Fetch responsible sales (for Admin/Owner)
      if (userRole === 'owner' || userRole === 'admin') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: assignments } = await (supabase.from('sales_unit_assignments') as any)
          .select('sales_user_id')
          .eq('unit_id', unitId)
          .is('revoked_at', null);
        const ids = (assignments || []).map((a: any) => a.sales_user_id).filter(Boolean);
        if (ids.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: salesUsers } = await (supabase.from('users') as any)
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
        // Also fetch this Agent's referral_code so we can append ?ref= to shared links.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: meRow } = await (supabase.from('users') as any)
          .select('referral_code')
          .eq('id', user.id)
          .maybeSingle();
        setMyReferralCode((meRow as any)?.referral_code || null);
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

  // Format ISO date as "YYYY-MM-DDTHH:mm" for <input type="datetime-local">
  const toLocalInputValue = (iso?: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Save / clear viewing_date for a lead_interest on this unit, with smart status promotion:
  //   - Setting date when status='interested' → upgrade to 'viewing_scheduled'
  //   - Clearing date when status='viewing_scheduled' → revert to 'interested'
  //   - Other statuses are left as-is (don't downgrade negotiating/reserved/won)
  // Explicit "ยกเลิกนัด" — clears viewing_date and reverts status to 'interested' (only when still in scheduled state).
  const cancelLeadVisit = async (interestId: string, currentStatus: string | undefined) => {
    if (!confirm('ยกเลิกการนัดดูยูนิตนี้?')) return;
    setSavingVisit(true);
    try {
      const updates: Record<string, any> = {
        viewing_date: null,
        updated_at: new Date().toISOString(),
      };
      if (currentStatus === 'viewing_scheduled') {
        updates.status = 'interested';
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update(updates).eq('id', interestId);
      if (error) throw error;
      setUnitLeads((prev) => prev.map((li: any) =>
        li.id === interestId
          ? { ...li, viewing_date: null, status: updates.status ?? li.status }
          : li
      ));
      toast.success('ยกเลิกนัดดูแล้ว');
    } catch (e: any) {
      console.error('Cancel viewing failed:', e);
      toast.error('ยกเลิกไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

  const saveLeadVisit = async (interestId: string, currentStatus: string | undefined) => {
    setSavingVisit(true);
    try {
      const isoValue = visitDraft ? new Date(visitDraft).toISOString() : null;
      const updates: Record<string, any> = {
        viewing_date: isoValue,
        updated_at: new Date().toISOString(),
      };
      // Rescheduling: setting a date from 'interested' OR 'viewed' should both move
      // the interest back into 'viewing_scheduled' — otherwise the UI shows a stale
      // "ดูแล้ว" badge next to a future viewing_date.
      if (isoValue && (currentStatus === 'interested' || currentStatus === 'viewed')) {
        updates.status = 'viewing_scheduled';
      } else if (!isoValue && currentStatus === 'viewing_scheduled') {
        updates.status = 'interested';
      }
      // Back-fill: when the interest is already past the viewing stage but viewed_at
      // is missing (legacy data / Sales bypassed the confirm flow), treat the
      // entered date as "when the customer actually came in" rather than a future
      // appointment — write viewed_at AND keep the status untouched.
      const advancedStatuses = new Set(['negotiating', 'reserved', 'won']);
      const interest = unitLeads.find((li: any) => li.id === interestId);
      const isBackfill = isoValue && advancedStatuses.has(currentStatus || '') && !interest?.viewed_at;
      if (isBackfill) {
        updates.viewed_at = isoValue;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update(updates).eq('id', interestId);
      if (error) throw error;
      setUnitLeads((prev) => prev.map((li: any) =>
        li.id === interestId
          ? {
              ...li,
              viewing_date: isoValue,
              status: updates.status ?? li.status,
              viewed_at: isBackfill ? isoValue : li.viewed_at,
            }
          : li
      ));
      setEditingVisitInterestId(null);
      setVisitDraft('');
      toast.success(
        isBackfill ? 'บันทึกวันที่ลูกค้ามาดูแล้ว'
        : isoValue ? 'บันทึกนัดดูเรียบร้อย'
        : 'ลบนัดดูแล้ว'
      );
    } catch (e: any) {
      console.error('Save viewing date failed:', e);
      toast.error('บันทึกไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

  // Sales confirms the customer physically viewed the unit. In Sales-led real
  // estate tours (Chateau's model), a visit IS the start of negotiation — the
  // customer meets Sales, walks through the unit, and discusses price/terms in
  // the same session. So we collapse the artificial "viewed → negotiating" gap
  // and jump straight to 'negotiating' here. The standalone "เริ่มเจรจา" button
  // is left in place for legacy records but won't appear in fresh workflows.
  // Also syncs lead.status (promote to 'negotiating' if behind) + ticks
  // leads.site_visit_attended so ML scoring sees the engagement.
  const markVisitConfirmed = async (interestId: string) => {
    setSavingVisit(true);
    try {
      const nowIso = new Date().toISOString();
      const interest = unitLeads.find((li: any) => li.id === interestId);
      const leadId = (interest as any)?.lead_id;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update({ status: 'negotiating', viewed_at: nowIso, updated_at: nowIso })
        .eq('id', interestId);
      if (error) throw error;

      // Sync lead-level state — promote anyone behind 'negotiating' up to it.
      if (leadId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leadRow } = await (supabase.from('leads') as any)
            .select('status').eq('id', leadId).maybeSingle();
          const leadUpdates: Record<string, any> = { site_visit_attended: true };
          if (['new', 'contacted', 'qualified'].includes(leadRow?.status)) {
            leadUpdates.status = 'negotiating';
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('leads') as any).update(leadUpdates).eq('id', leadId);
        } catch { /* non-blocking — interest update already succeeded */ }
      }

      // Optimistic update — also mirror the lead-level status into the joined `leads`
      // object so the badge on the card reflects the new state without waiting for a reload.
      setUnitLeads((prev) => prev.map((li: any) => {
        if (li.id !== interestId) return li;
        const next: any = { ...li, status: 'negotiating', viewed_at: nowIso };
        if (li.leads && ['new', 'contacted', 'qualified'].includes(li.leads.status)) {
          next.leads = { ...li.leads, status: 'negotiating' };
        }
        return next;
      }));

      // Notify Lead owner that their customer was just confirmed at the unit.
      // Non-blocking — interest update is the source of truth.
      try {
        const leadOwner = (interest as any)?.leads?.assigned_to;
        const customerName = (interest as any)?.leads?.customers?.full_name || 'ลูกค้า';
        if (leadOwner && currentTenant?.id) {
          const { createNotification } = await import('@/lib/notifications');
          await createNotification({
            tenantId: currentTenant.id,
            userId: leadOwner,
            activityType: 'viewing_completed',
            title: 'พาดูยูนิตเสร็จ — เริ่มเจรจา',
            message: `${customerName} มาดูยูนิต ${unit?.unit_number || ''} แล้ว`,
            severity: 'success',
            relatedEntityType: 'lead',
            relatedEntityId: leadId,
            data: { unit_id: unit?.id, unit_number: unit?.unit_number },
          });
        }
      } catch { /* non-blocking */ }

      toast.success('✓ ยืนยันลูกค้ามาดู + เริ่มเจรจาแล้ว');
    } catch (e: any) {
      console.error('Mark visit confirmed failed:', e);
      toast.error('บันทึกไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

  // Promote viewed → negotiating once Sales starts discussing price.
  const markStartNegotiating = async (interestId: string, leadId: string | undefined) => {
    setSavingVisit(true);
    try {
      const nowIso = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update({ status: 'negotiating', updated_at: nowIso })
        .eq('id', interestId);
      if (error) throw error;
      // Keep leads.status in lock-step so pipeline reports reflect the move.
      if (leadId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any)
          .update({ status: 'negotiating' })
          .eq('id', leadId)
          .in('status', ['new', 'contacted', 'qualified']);
      }
      setUnitLeads((prev) => prev.map((li: any) =>
        li.id === interestId ? { ...li, status: 'negotiating' } : li
      ));
      toast.success(' เริ่มเจรจาแล้ว');
    } catch (e: any) {
      console.error('Mark start negotiating failed:', e);
      toast.error('บันทึกไม่สำเร็จ: ' + (e?.message || 'unknown'));
    } finally {
      setSavingVisit(false);
    }
  };

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
      setHandoffLeadIds([myLeadsOnUnit[0].id]);
      setShowHandoffDialog(true);
    } else {
      setPickerSelected([]);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('leads') as any)
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('units') as any)
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

      // Reservation = customer agreed to buy + paid small holding deposit (not yet contracted).
      // 'won' is reserved for handleMarkAsSold (after contract + transfer). Setting it here
      // breaks pipeline conversion reports.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('leads') as any).update({ status: 'negotiating' }).eq('id', lead.id);

      const alreadyInterested = unitLeads.some((li: any) => li.leads?.id === lead.id);
      if (!alreadyInterested) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lead_interests') as any).insert({
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
      // Recompute estimated_value + scores now that interest changed
      try {
        const { recomputeLeadScore } = await import('@/lib/recomputeLeadScore');
        await recomputeLeadScore(lead.id);
      } catch { /* non-fatal */ }

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

      // Notify Lead owner + tenant Admin/Owner — booking is a major milestone.
      try {
        const { createNotification, getTenantAdminUserIds } = await import('@/lib/notifications');
        const adminIds = await getTenantAdminUserIds(currentTenant?.id || '');
        const leadOwner = lead.assigned_to;
        const recipients = Array.from(new Set([leadOwner, ...adminIds].filter(Boolean)));
        for (const uid of recipients) {
          await createNotification({
            tenantId: currentTenant?.id || '',
            userId: uid,
            activityType: 'booking_created',
            title: 'มีการจองยูนิตใหม่',
            message: `${customerName} จองยูนิต ${unit.unit_number} (เงินจอง ${parseFloat(bookingForm.deposit_amount).toLocaleString()} ฿)`,
            severity: 'success',
            relatedEntityType: 'lead',
            relatedEntityId: lead.id,
            data: { unit_id: unit.id, unit_number: unit.unit_number, deposit_amount: parseFloat(bookingForm.deposit_amount) },
          });
        }
      } catch { /* non-blocking */ }

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
      // Recompute estimated_value + scores now that interest changed
      try {
        const { recomputeLeadScore } = await import('@/lib/recomputeLeadScore');
        await recomputeLeadScore(quickInterestLeadId);
      } catch { /* non-fatal */ }
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

  // Confirm deposit received — booking pending → confirmed
  // (called from the Reserved-unit card when Sales has received the deposit but hasn't closed the sale yet)
  const handleConfirmPayment = async () => {
    if (!unit || !activeBooking) return;
    if (activeBooking.status !== 'pending') {
      toast.info('การจองนี้ยืนยันรับเงินแล้ว');
      return;
    }
    if (!confirm(`ยืนยันรับเงินมัดจำสำหรับยูนิต ${unit.unit_number}? (สถานะการจองจะเปลี่ยนเป็น "ชำระแล้ว")`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('bookings') as any)
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('id', activeBooking.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ยืนยัน');

      // Self-heal: force lead_interest → 'reserved' for this unit's reserved lead, in case
      // it drifted (e.g. legacy data, manual edits in Lead Management page, or earlier
      // bookings created before sync logic existed).
      if (unit.reserved_customer_lead_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lead_interests') as any)
          .update({ status: 'reserved' })
          .eq('lead_id', unit.reserved_customer_lead_id)
          .eq('unit_id', unit.id)
          .not('status', 'in', '("won","lost","dropped")');

        // Lead-level sync — a customer who paid a deposit is at minimum 'negotiating'.
        // Anything earlier (new/contacted/qualified) is stale and should bump up so
        // pipeline reports don't undercount active deals.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leadRow } = await (supabase.from('leads') as any)
            .select('status').eq('id', unit.reserved_customer_lead_id).maybeSingle();
          if (['new', 'contacted', 'qualified'].includes(leadRow?.status)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('leads') as any)
              .update({ status: 'negotiating' })
              .eq('id', unit.reserved_customer_lead_id);
          }
        } catch { /* non-blocking */ }
      }

      // Notify Lead owner + Admin — payment received is a finance milestone.
      try {
        if (unit.reserved_customer_lead_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ownerRow } = await (supabase.from('leads') as any)
            .select('assigned_to').eq('id', unit.reserved_customer_lead_id).maybeSingle();
          const { createNotification, getTenantAdminUserIds } = await import('@/lib/notifications');
          const adminIds = await getTenantAdminUserIds(currentTenant?.id || '');
          const recipients = Array.from(new Set([(ownerRow as any)?.assigned_to, ...adminIds].filter(Boolean)));
          for (const uid of recipients) {
            await createNotification({
              tenantId: currentTenant?.id || '',
              userId: uid,
              activityType: 'payment_received',
              title: 'รับเงินจองเรียบร้อย',
              message: `${unit.reserved_customer_name || 'ลูกค้า'} ชำระเงินจองยูนิต ${unit.unit_number}`,
              severity: 'success',
              relatedEntityType: 'lead',
              relatedEntityId: unit.reserved_customer_lead_id,
              data: { unit_id: unit.id, unit_number: unit.unit_number, amount: activeBooking?.total_amount },
            });
          }
        }
      } catch { /* non-blocking */ }

      toast.success(`✓ ยืนยันรับเงินมัดจำ ยูนิต ${unit.unit_number}`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'ยืนยันไม่สำเร็จ');
    }
  };

  // Open assign-sales dialog: load the full Sales/Admin/Owner team for this tenant
  // and prefill ticks for those already responsible for this unit.
  const openAssignDialog = async () => {
    if (!currentTenant?.id || !unit) return;
    setShowAssignDialog(true);
    setPickedSalesIds(new Set(responsibleSales.map((s) => s.id)));
    try {
      // Only role='sales' — admin/owner have all-units access by default and
      // shouldn't appear as "พนักงาน Sales รับผิดชอบ" for a specific unit.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.from('users') as any)
        .select('id, full_name, email, role')
        .eq('tenant_id', currentTenant.id)
        .eq('role', 'sales')
        .order('full_name');
      setTeamSales(
        (data || []).map((u: any) => ({
          id: u.id,
          name: u.full_name || u.email || '(ไม่มีชื่อ)',
          email: u.email,
        })),
      );
    } catch (err) {
      console.error('Load team failed:', err);
      toast.error('โหลดรายชื่อทีมไม่สำเร็จ');
    }
  };

  const toggleSalesPick = (id: string) => {
    setPickedSalesIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Diff current vs picked → INSERT new assignments + UPDATE revoked_at on removed
  // ones. Idempotent — re-clicking the same selection is a no-op.
  const saveAssignments = async () => {
    if (!unit || !currentTenant?.id) return;
    setSavingAssignments(true);
    try {
      const currentIds = new Set(responsibleSales.map((s) => s.id));
      const picked = pickedSalesIds;
      const toAdd = Array.from(picked).filter((id) => !currentIds.has(id));
      const toRemove = Array.from(currentIds).filter((id) => !picked.has(id));

      if (toAdd.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: insErr } = await (supabase.from('sales_unit_assignments') as any)
          .insert(
            toAdd.map((salesId) => ({
              tenant_id: currentTenant.id,
              unit_id: unit.id,
              sales_user_id: salesId,
              assigned_by: myUserId,
            })),
          );
        if (insErr) throw insErr;
      }
      if (toRemove.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updErr } = await (supabase.from('sales_unit_assignments') as any)
          .update({ revoked_at: new Date().toISOString(), revoked_by: myUserId })
          .eq('unit_id', unit.id)
          .in('sales_user_id', toRemove)
          .is('revoked_at', null);
        if (updErr) throw updErr;
      }

      // Update local list so UI reflects immediately
      const nextResponsible = teamSales
        .filter((s) => picked.has(s.id))
        .map((s) => ({ id: s.id, name: s.name }));
      setResponsibleSales(nextResponsible);
      setShowAssignDialog(false);
      toast.success('บันทึกรายชื่อ Sales เรียบร้อย');
    } catch (err: any) {
      console.error('Save assignments failed:', err);
      toast.error(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingAssignments(false);
    }
  };

  const handleMarkAsSold = async () => {
    if (!unit) return;
    if (!confirm(`บันทึกการขายสำเร็จยูนิต ${unit.unit_number}? (สถานะจะเปลี่ยนเป็น "ขายแล้ว")`)) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('units') as any)
        .update({ status: 'sold', locked_until: null, sold_at: new Date().toISOString() })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์บันทึกการขาย');
      let buyingCustomerId: string | null = null;
      if (unit.reserved_customer_lead_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leadRow } = await (supabase.from('leads') as any)
          .select('customer_id').eq('id', unit.reserved_customer_lead_id).maybeSingle();
        buyingCustomerId = leadRow?.customer_id ?? null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any).update({ status: 'won' }).eq('id', unit.reserved_customer_lead_id);
        // Sync the matching lead_interest → 'won' so customer timeline reflects the close
        await (supabase.from('lead_interests') as any)
          .update({ status: 'won' })
          .eq('lead_id', unit.reserved_customer_lead_id)
          .eq('unit_id', unit.id);
      }
      // Promote pending booking → confirmed (customer sees: ชำระแล้ว · ทำสัญญา).
      // Filter by customer_id when possible so a stale "waitlist" booking from a
      // DIFFERENT customer on the same unit doesn't get confirmed by accident.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let bookingsQuery = (supabase.from('bookings') as any)
        .update({ status: 'confirmed' })
        .eq('tenant_id', currentTenant?.id)
        .filter('notes->>unit_id', 'eq', unit.id)
        .in('status', ['pending']);
      if (buyingCustomerId) {
        bookingsQuery = bookingsQuery.eq('customer_id', buyingCustomerId);
      }
      await bookingsQuery;

      // Notify Lead owner + Admin/Owner — won deal is the biggest event in the funnel.
      try {
        if (unit.reserved_customer_lead_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ownerRow } = await (supabase.from('leads') as any)
            .select('assigned_to').eq('id', unit.reserved_customer_lead_id).maybeSingle();
          const { createNotification, getTenantAdminUserIds } = await import('@/lib/notifications');
          const adminIds = await getTenantAdminUserIds(currentTenant?.id || '');
          const recipients = Array.from(new Set([(ownerRow as any)?.assigned_to, ...adminIds].filter(Boolean)));
          for (const uid of recipients) {
            await createNotification({
              tenantId: currentTenant?.id || '',
              userId: uid,
              activityType: 'lead_won',
              title: 'ปิดดีลสำเร็จ',
              message: `ขายยูนิต ${unit.unit_number} ให้ ${unit.reserved_customer_name || 'ลูกค้า'} สำเร็จ`,
              severity: 'success',
              relatedEntityType: 'lead',
              relatedEntityId: unit.reserved_customer_lead_id,
              data: { unit_id: unit.id, unit_number: unit.unit_number, sold_price: unit.price },
            });
          }
        }
      } catch { /* non-blocking */ }

      toast.success(`บันทึกการขายยูนิต ${unit.unit_number} เรียบร้อย`);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'บันทึกการขายไม่สำเร็จ');
    }
  };

  // Revert a sold unit — Owner/Admin only.
  // Use cases: wrong unit recorded, contract voided, customer defaulted, deed registration failed.
  // Reason is required; logged to activity_logs for audit trail.
  const handleRevertSale = async () => {
    if (!unit) return;
    if (!revertReason.trim()) { toast.error('กรุณาระบุเหตุผล'); return; }
    setReverting(true);
    try {
      // 1) Unit: sold → reserved + clear sold_at
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('units') as any)
        .update({ status: 'reserved', sold_at: null, updated_at: new Date().toISOString() })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ยกเลิกการขาย (เฉพาะ Admin/Owner)');

      // 2) Lead: won → negotiating (deal reopens)
      if (unit.reserved_customer_lead_id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any)
          .update({ status: 'negotiating', updated_at: new Date().toISOString() })
          .eq('id', unit.reserved_customer_lead_id);
        // 3) Lead interest: won → reserved
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lead_interests') as any)
          .update({ status: 'reserved', updated_at: new Date().toISOString() })
          .eq('lead_id', unit.reserved_customer_lead_id)
          .eq('unit_id', unit.id);
      }

      // 4) Booking: checked_in → confirmed (deposit was paid, contract voided)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('bookings') as any)
        .update({ status: 'confirmed', updated_at: new Date().toISOString() })
        .eq('tenant_id', currentTenant?.id)
        .filter('notes->>unit_id', 'eq', unit.id)
        .in('status', ['checked_in']);

      // 5) Audit log — who reverted, why, what unit
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_logs') as any).insert({
        tenant_id: currentTenant?.id,
        user_id: user?.id,
        activity_type: 'sale_reverted',
        description: `ยกเลิกการขายยูนิต ${unit.unit_number} — ${revertReason.trim()}`,
        metadata: {
          unit_id: unit.id,
          unit_number: unit.unit_number,
          customer_name: unit.reserved_customer_name,
          lead_id: unit.reserved_customer_lead_id,
          reason: revertReason.trim(),
        },
      });

      toast.success(`ยกเลิกการขายยูนิต ${unit.unit_number} สำเร็จ — กลับสู่สถานะ "จอง"`);
      setShowRevertSaleDialog(false);
      setRevertReason('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'ยกเลิกการขายไม่สำเร็จ');
    } finally {
      setReverting(false);
    }
  };

  // Open the cancellation dialog — pre-fill refund amount with the full deposit
  // so the common "give the money back" case is one click.
  const openCancelDialog = () => {
    if (!unit) return;
    setCancelRefundAmount(unit.deposit_amount ? String(unit.deposit_amount) : '0');
    setCancelRefundReason('');
    setShowCancelDialog(true);
  };

  const submitCancelReservation = async () => {
    if (!unit) return;
    const refundAmt = parseFloat(cancelRefundAmount) || 0;
    setCancelling(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('units') as any)
        .update({
          status: 'available', locked_by: null, locked_until: null,
          reservation_date: null, reserved_customer_name: null, reserved_customer_phone: null,
          reserved_customer_lead_id: null, deposit_amount: null, reservation_notes: null,
        })
        .eq('id', unit.id)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ยกเลิก');
      // Cancel any open bookings tied to this unit + record refund details so
      // finance can reconcile "deposit collected vs. refunded vs. forfeited."
      await (supabase.from('bookings') as any)
        .update({
          status: 'cancelled',
          refund_amount: refundAmt,
          refunded_at: new Date().toISOString(),
          refund_reason: cancelRefundReason || null,
        })
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

        // Revert lead.status too — otherwise the lead stays at 'negotiating'/'won'
        // and creates a ghost deal in pipeline reports. Demote to 'qualified' so the
        // customer is still treated as warm (we know they showed real intent) but
        // not as an active deal.
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leadRow } = await (supabase.from('leads') as any)
            .select('status').eq('id', unit.reserved_customer_lead_id).maybeSingle();
          if (leadRow?.status === 'won' || leadRow?.status === 'negotiating') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('leads') as any)
              .update({ status: 'qualified' })
              .eq('id', unit.reserved_customer_lead_id);
          }
        } catch { /* non-blocking — unit/interest update already succeeded */ }
      }
      toast.success(`ยกเลิกจองยูนิต ${unit.unit_number}`);
      setShowCancelDialog(false);
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'ยกเลิกไม่สำเร็จ');
    } finally {
      setCancelling(false);
    }
  };

  const handleLeadCreated = async () => {
    setShowAddLeadModal(false);
    await loadAll();
    toast.success('เพิ่ม Lead สำเร็จ — เลือกได้ใน "บันทึกการจอง"');
  };

  // Permission check for removing a lead from this unit's interest list.
  // Blocks deletion only when there's a REAL active booking — i.e. interest is
  // reserved/won AND the unit itself is in 'reserved'/'sold' status. If the
  // interest status drifted out of sync with the unit (orphan record), allow
  // deletion so users can clean up the bad state.
  const canDeleteInterest = (li: any): boolean => {
    if (!li?.leads) return false;
    if (['reserved', 'won'].includes(li.status)) {
      const unitIsLocked = unit?.status === 'reserved' || unit?.status === 'sold';
      if (unitIsLocked) return false;
    }
    if (userRole === 'owner' || userRole === 'admin') return true;
    if (userRole === 'sales') {
      return canManageUnit(unit?.id || '', unit?.project_id);
    }
    if (userRole === 'agent') {
      // Agents can only remove their own leads from a unit — never touch
      // another agent's or in-house Sales' lead.
      return li.leads?.assigned_to === myUserId;
    }
    return false;
  };

  const openDeleteInterestDialog = (li: any) => {
    if (!li?.leads) return;
    setDeleteInterestTarget({
      interestId: li.id,
      leadId: li.leads.id,
      customerName: li.leads.customers?.full_name || '(ไม่ระบุชื่อ)',
      status: li.status,
    });
    setDeleteInterestReason('');
    setShowDeleteInterestDialog(true);
  };

  // Soft-delete the interest (status='dropped' — already filtered out by the
  // main query at loadAll). Recompute the lead's score afterwards because
  // estimated_value = max(unit price across interested units), so removing a
  // unit can change the lead's budget tier.
  const submitDeleteInterest = async () => {
    if (!deleteInterestTarget) return;
    if (!deleteInterestReason.trim()) {
      toast.error('กรุณาระบุเหตุผล');
      return;
    }
    setDeletingInterest(true);
    const target = deleteInterestTarget;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('lead_interests') as any)
        .update({
          status: 'dropped',
          notes: `[ลบจากยูนิต ${unit?.unit_number || ''}] ${deleteInterestReason.trim()}`,
          updated_at: new Date().toISOString(),
        })
        .eq('id', target.interestId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('ไม่มีสิทธิ์ลบ');

      // Cancel any active bookings tied to this lead+unit so they don't leak into the
      // customer's status timeline next time they re-express interest (Sales rebuilds
      // the lead → fresh interest is 'interested' but old 'confirmed' booking would
      // still flash "ชำระมัดจำ ✓" on the customer side without this cleanup).
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('bookings') as any)
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('tenant_id', currentTenant?.id)
          .filter('notes->>unit_id', 'eq', unit?.id || '')
          .filter('notes->>lead_id', 'eq', target.leadId)
          .in('status', ['pending', 'confirmed']);
      } catch { /* non-blocking — interest removal already succeeded */ }

      // Audit log — who removed, why, from which unit. Owner/Admin can review later.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('activity_logs') as any).insert({
          tenant_id: currentTenant?.id,
          user_id: user?.id,
          activity_type: 'lead_interest_removed',
          description: `ลบ Lead "${target.customerName}" ออกจากยูนิต ${unit?.unit_number} — ${deleteInterestReason.trim()}`,
          metadata: {
            unit_id: unit?.id,
            unit_number: unit?.unit_number,
            lead_id: target.leadId,
            interest_id: target.interestId,
            previous_status: target.status,
            reason: deleteInterestReason.trim(),
          },
        });
      } catch { /* non-blocking — soft-delete already succeeded */ }

      // Recompute lead's estimated_value + scores since their unit list shrank
      try {
        const { recomputeLeadScore } = await import('@/lib/recomputeLeadScore');
        await recomputeLeadScore(target.leadId);
      } catch { /* non-fatal */ }

      // Optimistic removal from local state
      setUnitLeads((prev) => prev.filter((li: any) => li.id !== target.interestId));
      toast.success(`ลบ "${target.customerName}" ออกจากยูนิตแล้ว`);
      setShowDeleteInterestDialog(false);
      setDeleteInterestTarget(null);
      setDeleteInterestReason('');
    } catch (err: any) {
      console.error('Delete lead interest failed:', err);
      toast.error(err?.message || 'ลบไม่สำเร็จ');
    } finally {
      setDeletingInterest(false);
    }
  };

  /* ─── LINE share ─── */
  // Build the customer-facing URL that the recipient should see. Always points to
  // /customer/units/:id (not the staff /units/:id route) so the link works for
  // anyone — and silently appends ?ref=AG-2026-NNN when the sharer is an Agent
  // so commission attribution is captured on the customer's first lead creation.
  const buildShareUrl = (): string => {
    if (!unit) return '';
    const base = `${window.location.origin}/customer/units/${unit.id}`;
    return myReferralCode ? `${base}?ref=${encodeURIComponent(myReferralCode)}` : base;
  };

  const buildShareMessage = (): string => {
    if (!unit || !property) return '';
    const priceM = (unit.promo_price && unit.promo_price < unit.price)
      ? `${(unit.promo_price / 1_000_000).toFixed(2)} ล้าน (จากเดิม ${(unit.price / 1_000_000).toFixed(2)} ล้าน)`
      : `${(unit.price / 1_000_000).toFixed(2)} ล้าน`;
    const address = property.address?.street
      || `${property.address?.district || ''} ${property.address?.province || ''}`.trim();
    const specs: string[] = [];
    if (unit.bedrooms) specs.push(` ${unit.bedrooms} ห้องนอน`);
    if (unit.bathrooms) specs.push(` ${unit.bathrooms} ห้องน้ำ`);
    if (unit.area_sqm) specs.push(` ${unit.area_sqm} ตร.ม.`);
    const lines = [
      ` ${property.name} — ยูนิต ${unit.unit_number}`,
      address ? ` ${address}` : null,
      ` ${priceM}`,
      specs.join(' · '),
      unit.view ? ` ${unit.view}` : null,
      '',
      `ดูรายละเอียดเพิ่ม: ${buildShareUrl()}`,
    ].filter(Boolean);
    return lines.join('\n');
  };

  const handleShareLine = () => {
    const text = buildShareMessage();
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCopyLink = async () => {
    const link = buildShareUrl();
    try {
      await navigator.clipboard.writeText(link);
      toast.success(myReferralCode
        ? 'คัดลอกลิงก์เรียบร้อย (ผูกรหัสนายหน้าของคุณแล้ว)'
        : 'คัดลอกลิงก์เรียบร้อย'
      );
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
      <div className="min-h-screen bg-gray-50">
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
  // Closing a sale = SPA signed + ownership transfer registered.
  // Global broker pattern (Sansiri/AP/Knight Frank): only in-house Sales/Admin/Owner can do this.
  // External Agents can reserve + confirm deposit, but must hand off to Sales for the actual sale close.
  const canCloseSale = canManage && userRole !== 'agent';

  return (
    <div className="min-h-screen bg-gray-50">
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
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-base font-semibold text-green-900 flex items-center gap-2">
                    <Check className="w-5 h-5" />
                    ปิดการขายแล้ว
                  </CardTitle>
                  {(userRole === 'owner' || userRole === 'admin') && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowRevertSaleDialog(true)}
                      className="text-red-700 border-red-200 hover:bg-red-50 text-xs"
                    >
                      ↩️ ยกเลิกการขาย
                    </Button>
                  )}
                </div>
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
                  <CardTitle className="text-base font-semibold text-amber-900 flex items-center gap-2 flex-wrap">
                    <Calendar className="w-5 h-5" />
                    ข้อมูลผู้จอง
                    {activeBooking?.status === 'pending' && (
                      <Badge className="bg-orange-100 text-orange-800 border-orange-200"> รอชำระมัดจำ</Badge>
                    )}
                    {activeBooking?.status === 'confirmed' && (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">✓ ชำระมัดจำแล้ว</Badge>
                    )}
                    {expired && <Badge className="bg-red-100 text-red-700 border-red-200">หมดอายุแล้ว</Badge>}
                  </CardTitle>
                  {canManage && (
                    <div className="flex gap-2 flex-wrap">
                      {/* Primary booking actions kept prominent. Destructive "ยกเลิกการจอง" is
                          intentionally buried in the overflow menu so it can't be clicked by
                          mistake while reaching for the confirm/close-sale buttons next to it. */}
                      {activeBooking?.status === 'pending' && (
                        <Button size="sm" onClick={handleConfirmPayment} className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> ยืนยันรับเงิน
                        </Button>
                      )}
                      {canCloseSale && (
                        <Button size="sm" onClick={handleMarkAsSold} className="bg-green-600 hover:bg-green-700 text-white">
                          <Check className="w-4 h-4 mr-1" /> บันทึกการขายสำเร็จ
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" aria-label="ตัวเลือกเพิ่มเติม">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={openCancelDialog} className="text-red-600 focus:text-red-700">
                            <Trash2 className="w-4 h-4 mr-2" /> ยกเลิกการจอง
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
                        {/* Merged Lead-entry control. Agents want either "this customer is new"
                            or "this customer already has a Lead, just record interest in this unit".
                            Previously these were two separate buttons — too noisy. The dropdown keeps
                            both reachable but presents a single primary CTA on the card. */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                              <UserPlus className="w-4 h-4 mr-1" /> เพิ่ม Lead
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowAddLeadModal(true)}>
                              <UserPlus className="w-4 h-4 mr-2" /> ลูกค้าใหม่
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={async () => { await fetchAllTenantLeads(); setShowQuickInterestDialog(true); }}>
                              <Heart className="w-4 h-4 mr-2 text-rose-600" /> ลูกค้าที่มีอยู่ (บันทึกความสนใจ)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {myLeadsOnUnit.length > 0 && (
                          <Button onClick={openHandoffFlow} className="bg-chateau hover:bg-chateau-600 text-white">
                            <Send className="w-4 h-4 mr-1" />
                            {myLeadsOnUnit.length > 1 ? `เลือก Lead ส่งต่อ (${myLeadsOnUnit.length})` : 'ส่งต่อให้ Sales'}
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="outline" onClick={() => setShowAddLeadModal(true)}>
                          <UserPlus className="w-4 h-4 mr-1" /> เพิ่ม Lead
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

          {/* Leads interested — placed prominently right after the unit status banner
              because Sales reaches for "who's coming to see this unit" daily, more often than spec details. */}
          <Card className="border border-gray-200">
            <CardHeader className="bg-gradient-to-r from-rose-50 to-rose-100/50 border-b border-rose-100 pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 justify-between">
                <span className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-chateau" />
                  Leads ที่สนใจยูนิตนี้
                </span>
                <Badge variant="secondary" className="bg-white text-chateau border border-chateau-100 font-bold">
                  {unitLeads.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {unitLeads.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">ยังไม่มี Lead ที่สนใจยูนิตนี้</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unitLeads.map((li: any) => {
                    const lead = li.leads;
                    if (!lead) return null;
                    const isEditing = editingVisitInterestId === li.id;
                    const canEdit = userRole === 'owner' || userRole === 'admin' || userRole === 'sales' || userRole === 'agent';
                    const hasVisit = !!li.viewing_date;
                    const visitDate = li.viewing_date ? new Date(li.viewing_date) : null;
                    const isPastVisit = !!visitDate && visitDate.getTime() < Date.now();
                    const isAdvanced = ['viewed', 'negotiating', 'reserved', 'won'].includes(li.status);
                    const viewedAtDate = li.viewed_at ? new Date(li.viewed_at) : null;
                    const visitFmt = (d: Date) => d.toLocaleString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' });
                    return (
                      <div key={li.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                        {/* Header — name + status + click-to-open lead + delete trash.
                            Outer must be <div> (not <button>) so the nested Trash button is valid HTML. */}
                        <div className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                          <button
                            onClick={() => navigate(`/leads/${lead.id}`)}
                            className="flex-1 min-w-0 text-left"
                            title="เปิด Lead Detail"
                          >
                            <p className="text-sm font-semibold text-gray-900 truncate">{lead.customers?.full_name || '-'}</p>
                            <p className="text-xs text-gray-500">{lead.customers?.phone || '-'}</p>
                          </button>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <Badge className="bg-amber-100 text-amber-800">{leadStatusLabel(lead.status)}</Badge>
                            {canDeleteInterest(li) ? (
                              <button
                                type="button"
                                onClick={() => openDeleteInterestDialog(li)}
                                className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                title={`ลบ ${lead.customers?.full_name || ''} ออกจากยูนิตนี้`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : ['reserved', 'won'].includes(li.status) && (unit.status === 'reserved' || unit.status === 'sold') && (userRole === 'owner' || userRole === 'admin' || (userRole === 'sales' && canManageUnit(unit.id, unit.project_id))) ? (
                              // Locked state: only when unit IS actually held (not an orphan record).
                              // Tell the user *why* they can't delete instead of hiding the icon.
                              <button
                                type="button"
                                disabled
                                className="p-1.5 rounded-md text-gray-300 cursor-not-allowed"
                                title="มีการจองอยู่ — ต้องกด &quot;ยกเลิกจอง&quot; ก่อน"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            ) : null}
                          </div>
                        </div>

                        {/* Visit-date section — 5 states:
                            (1) editing date input
                            (2) advanced status (viewed/negotiating/reserved/won) — green history strip + optional "เริ่มเจรจา"
                            (3) viewing_scheduled + past date — orange overdue strip + "✓ มาแล้ว" / "เลื่อน"
                            (4) viewing_scheduled + future date — amber active strip + "แก้นัด"
                            (5) no date — gray empty state + "บันทึกนัด" */}
                        {isEditing ? (
                          <div className="flex items-center gap-2 px-4 py-3 bg-amber-50/70 border-t border-amber-100">
                            <Calendar className="w-4 h-4 text-amber-700 flex-shrink-0" />
                            <Input
                              type="datetime-local"
                              value={visitDraft}
                              onChange={(e) => setVisitDraft(e.target.value)}
                              className="h-9 text-sm flex-1"
                              disabled={savingVisit}
                            />
                            <Button size="sm" onClick={() => saveLeadVisit(li.id, li.status)} disabled={savingVisit} className="h-9 bg-amber-600 hover:bg-amber-700 text-white">
                              บันทึก
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setEditingVisitInterestId(null); setVisitDraft(''); }} disabled={savingVisit} className="h-9">
                              ยกเลิก
                            </Button>
                          </div>
                        ) : isAdvanced ? (
                          /* Past visit — customer already viewed; show history + "เริ่มเจรจา" prompt if still at viewed.
                             When date is missing (legacy data or Sales bypassed the viewing-confirm flow),
                             surface a "ระบุวัน" backfill button so the timeline gap can be closed. */
                          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-green-50/70 border-t border-green-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
                                <Check className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold tracking-wide text-green-700">ลูกค้ามาดูแล้ว</p>
                                {viewedAtDate || visitDate ? (
                                  <p className="text-sm font-bold text-green-900">
                                    {viewedAtDate ? visitFmt(viewedAtDate) : visitFmt(visitDate!)}
                                  </p>
                                ) : (
                                  <p className="text-xs text-amber-700">
                                    ยังไม่บันทึกวัน
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => { setEditingVisitInterestId(li.id); setVisitDraft(toLocalInputValue(undefined)); }}
                                        className="ml-2 underline font-semibold hover:text-amber-900"
                                      >
                                        ระบุวัน
                                      </button>
                                    )}
                                  </p>
                                )}
                              </div>
                            </div>
                            {canEdit && li.status === 'viewed' && (
                              <Button
                                size="sm"
                                onClick={() => markStartNegotiating(li.id, lead.id)}
                                disabled={savingVisit}
                                className="h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white flex-shrink-0"
                              >
                                 เริ่มเจรจา
                              </Button>
                            )}
                          </div>
                        ) : hasVisit && isPastVisit ? (
                          /* Overdue appointment — needs Sales action */
                          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-orange-50/70 border-t border-orange-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold tracking-wide text-orange-700">นัดเลยกำหนด</p>
                                <p className="text-sm font-bold text-orange-900">{visitFmt(visitDate!)}</p>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => markVisitConfirmed(li.id)}
                                  disabled={savingVisit}
                                  className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                                >
                                  <Check className="w-3 h-3 mr-1" /> มาแล้ว
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingVisitInterestId(li.id); setVisitDraft(toLocalInputValue(li.viewing_date)); }}
                                  className="h-8 text-xs border-orange-300 text-orange-800 hover:bg-orange-100"
                                >
                                  <Edit className="w-3 h-3 mr-1" /> เลื่อน
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelLeadVisit(li.id, li.status)}
                                  disabled={savingVisit}
                                  className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  ยกเลิกนัด
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : hasVisit ? (
                          /* Future appointment — amber active strip */
                          <div className="flex items-center justify-between gap-2 px-4 py-3 bg-amber-50/70 border-t border-amber-100">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold tracking-wide text-amber-700">นัดดู</p>
                                <p className="text-sm font-bold text-amber-900">{visitFmt(visitDate!)}</p>
                              </div>
                            </div>
                            {canEdit && (
                              <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => { setEditingVisitInterestId(li.id); setVisitDraft(toLocalInputValue(li.viewing_date)); }}
                                  className="h-8 text-xs border-amber-300 text-amber-800 hover:bg-amber-100"
                                >
                                  <Edit className="w-3 h-3 mr-1" /> แก้นัด
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => cancelLeadVisit(li.id, li.status)}
                                  disabled={savingVisit}
                                  className="h-8 text-xs border-red-200 text-red-600 hover:bg-red-50"
                                >
                                  ยกเลิกนัด
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          /* No visit yet — muted empty state with action */
                          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50/60">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-white border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0">
                                <Calendar className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] uppercase font-bold tracking-wide text-gray-400">นัดดู</p>
                                <p className="text-sm font-medium text-gray-500">ยังไม่ได้นัด</p>
                              </div>
                            </div>
                            {canEdit && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => { setEditingVisitInterestId(li.id); setVisitDraft(toLocalInputValue(li.viewing_date)); }}
                                className="h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 flex-shrink-0"
                              >
                                <Calendar className="w-3 h-3 mr-1" /> บันทึกนัด
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

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
                    onClick={openAssignDialog}
                  >
                    มอบหมาย Sales
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                {responsibleSales.length === 0 ? (
                  <div className="py-4 text-center text-sm text-gray-500 italic">
                    ยังไม่มี Sales ที่ดูแลยูนิตนี้
                    <p className="text-xs text-gray-400 mt-1">
                      กด "มอบหมาย Sales" เพื่อเลือกพนักงานจากทีม
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
                    <p className="text-xs font-semibold text-gray-600 mb-1"> วิว</p>
                    <p className="text-sm font-medium text-gray-900">{unit.view}</p>
                  </div>
                )}
                {unit.furnishing && (
                  <div className="p-3 border border-gray-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600 mb-1">สถานะตกแต่ง</p>
                    <p className="text-sm font-medium text-gray-900">
                      {unit.furnishing === 'fully' && 'ตกแต่งครบ พร้อมอยู่'}
                      {unit.furnishing === 'partial' && 'ตกแต่งบางส่วน'}
                      {unit.furnishing === 'unfurnished' && 'ไม่ตกแต่ง'}
                    </p>
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
                    <p className="text-xs font-semibold text-slate-700 mb-2"> ผังห้อง</p>
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
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg font-medium text-sm transition-colors"
                  >
                    <Eye className="w-4 h-4" /> เปิด 3D Virtual Tour
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {/* Project Site Plan — uses the same SitePlanViewer as the customer side
              so hotspots placed in the Plans Editor show up here too. Falls back to
              the auto-generated MasterPlanSVG when the project has no real plan image
              (component returns null when empty + we render the SVG fallback alongside). */}
          <SitePlanViewer
            propertyId={unit.project_id}
            highlightUnitId={unit.id}
            hideWhenEmpty={true}
          />
          {/* Fallback synthetic site plan — shown only when the project has no real
              plan image at all. Cheap visual placeholder for projects that haven't
              been authored yet in the new editor. */}
          {!property.master_plan_url && (
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
                  <Badge variant="outline" className="ml-2 border-amber-300 text-amber-700 bg-amber-50">
                    ผังจำลอง
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <MasterPlanSVG units={siblingUnits} highlightedUnitId={unit.id} projectName={property.name} />
                <p className="text-xs text-amber-700 mt-2">
                   ผังนี้สร้างจากข้อมูลยูนิตจริง — upload ผังจริงผ่านปุ่ม "ผังโครงการ" ในหน้าโครงการ
                </p>
              </CardContent>
            </Card>
          )}

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
                     {property.address?.street || `${property.address?.district || ''}, ${property.address?.province || ''}`}
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
                  <p className="text-sm text-amber-900 font-medium mb-1">ยังไม่มี Lead ในระบบ</p>
                  <p className="text-xs text-amber-800">กดปิดและใช้ปุ่ม "+ เพิ่ม Lead ใหม่"</p>
                </div>
              ) : (() => {
                // Role-based scope: Sales/Agent see only their own leads.
                // Admin/Owner see all (supervisor view) — matches Sansiri / AP industry practice
                // where a Sales rep can only book for their own customers (commission stays correct).
                const isSupervisor = userRole === 'admin' || userRole === 'owner';
                const myUserId = user?.id;
                const scopedLeads = isSupervisor
                  ? allTenantLeads
                  : allTenantLeads.filter((l: any) => l.assigned_to === myUserId);
                const activeLeads = scopedLeads.filter(
                  (l: any) => l.status !== 'won' && l.status !== 'lost' && l.status !== 'closed'
                );
                const interestedIds = new Set(unitLeads.map((li: any) => li.leads?.id).filter(Boolean));
                const interested = activeLeads.filter((l: any) => interestedIds.has(l.id));
                const others = activeLeads.filter((l: any) => !interestedIds.has(l.id));
                if (activeLeads.length === 0) {
                  return (
                    <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-900 font-medium">ยังไม่มี Lead ของคุณที่ active</p>
                      <p className="text-xs text-amber-800">
                        {isSupervisor
                          ? 'Lead ทุกคนปิดดีล/สูญเสียไปแล้ว — กด "+ เพิ่ม Lead ใหม่"'
                          : 'ลูกค้าของคุณยังไม่มีหรือปิดดีลไปแล้ว — กด "+ เพิ่ม Lead ใหม่" ถ้าเป็น walk-in'}
                      </p>
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
                             สนใจยูนิตนี้แล้ว ({interested.length})
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
                            {isSupervisor ? ` Lead อื่นใน tenant (${others.length})` : ` Lead ของฉัน (${others.length})`}
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
                   Lead นี้ยังไม่ได้บันทึกความสนใจในยูนิตนี้ — ระบบจะเพิ่มให้อัตโนมัติ
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
                  { v: 'high',   label: ' สนใจมาก', selectedCls: 'border-rose-500 bg-rose-50 text-rose-900 ring-2 ring-rose-200' },
                  { v: 'medium', label: ' สนใจ',      selectedCls: 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-200' },
                  { v: 'low',    label: ' ดูเฉยๆ',    selectedCls: 'border-gray-500 bg-gray-100 text-gray-900 ring-2 ring-gray-200' },
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
          if (!open) setHandoffLeadIds([]);
        }}
        leadIds={handoffLeadIds}
        customerNames={handoffLeadIds.map((id) => {
          const l = myLeadsOnUnit.find((x: any) => x.id === id);
          return l?.customers?.full_name || '';
        }).filter(Boolean)}
        unitId={unit.id}
        projectId={unit.project_id}
        onSuccess={() => { loadAll(); }}
      />

      {/* Handoff Picker — when multiple Leads of mine on this unit */}
      <Dialog open={showHandoffPicker} onOpenChange={(o) => { setShowHandoffPicker(o); if (!o) setPickerSelected([]); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-chateau" /> เลือก Lead ที่จะส่งต่อ
            </DialogTitle>
            <DialogDescription>
              ยูนิต {unit.unit_number} มี {myLeadsOnUnit.length} Lead ของคุณ — เลือกได้หลายคน ส่งต่อพร้อมกันได้เลย
            </DialogDescription>
          </DialogHeader>

          {/* Select all toggle */}
          <div className="flex items-center justify-between px-1 pb-1 border-b border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-600 select-none">
              <Checkbox
                checked={pickerSelected.length === myLeadsOnUnit.length && myLeadsOnUnit.length > 0}
                onCheckedChange={(checked) =>
                  setPickerSelected(checked ? myLeadsOnUnit.map((l: any) => l.id) : [])
                }
              />
              เลือกทั้งหมด
            </label>
            <span className="text-xs text-gray-400">{pickerSelected.length} / {myLeadsOnUnit.length} คน</span>
          </div>

          <div className="space-y-1.5 py-1 max-h-64 overflow-y-auto">
            {myLeadsOnUnit.map((l: any) => {
              const isChecked = pickerSelected.includes(l.id);
              return (
                <label
                  key={l.id}
                  className={`flex items-start gap-3 w-full p-3 rounded-lg border cursor-pointer transition-colors select-none ${
                    isChecked ? 'border-chateau bg-chateau-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) =>
                      setPickerSelected((prev) =>
                        checked ? [...prev, l.id] : prev.filter((id) => id !== l.id)
                      )
                    }
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{l.customers?.full_name || '(ไม่มีชื่อ)'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {l.customers?.phone || ''}{l.customers?.phone ? ' · ' : ''}สถานะ {leadStatusLabel(l.status)}
                    </p>
                  </div>
                </label>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowHandoffPicker(false); setPickerSelected([]); }}>ยกเลิก</Button>
            <Button
              disabled={pickerSelected.length === 0}
              onClick={() => {
                setHandoffLeadIds(pickerSelected);
                setShowHandoffPicker(false);
                setShowHandoffDialog(true);
              }}
              className="bg-chateau hover:bg-chateau-600 text-white"
            >
              ถัดไป — ส่งต่อ {pickerSelected.length > 0 ? `${pickerSelected.length} Lead` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revert Sale Dialog — Admin/Owner only, voids a closed sale and reopens the deal */}
      <Dialog open={showRevertSaleDialog} onOpenChange={(o) => { if (!reverting) setShowRevertSaleDialog(o); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              ↩️ ยกเลิกการขายยูนิต {unit.unit_number}
            </DialogTitle>
            <DialogDescription>
              การยกเลิกจะทำให้ยูนิตกลับสู่สถานะ "จอง" และเปิดดีลใหม่ — ใช้เฉพาะกรณีจำเป็น เช่น บันทึกผิดยูนิต, สัญญาเป็นโมฆะ, ลูกค้าผิดสัญญา
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-red-50 border border-red-100 rounded-lg">
              <p className="text-xs text-red-900 font-semibold mb-1">ผลที่จะเกิดขึ้น:</p>
              <ul className="text-xs text-red-800 space-y-0.5 list-disc list-inside">
                <li>ยูนิต: ขายแล้ว → จอง (รอชำระ)</li>
                <li>Lead: ปิดดีล → กำลังเจรจา</li>
                <li>Booking: โอนแล้ว → ชำระมัดจำแล้ว</li>
                <li>บันทึก audit log ระบุผู้กระทำ + เหตุผล</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                เหตุผล <span className="text-red-500">*</span>
              </Label>
              <textarea
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={3}
                maxLength={300}
                placeholder="เช่น บันทึกผิดยูนิต / ลูกค้าผิดสัญญา / กรมที่ดินไม่อนุมัติโอน..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-100 focus:border-red-300 resize-none"
              />
              <p className="text-[10px] text-gray-400 mt-1 text-right">{revertReason.length}/300</p>
            </div>
          </div>
          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRevertSaleDialog(false)}
              disabled={reverting}
              className="flex-1"
            >
              ปิด
            </Button>
            <Button
              onClick={handleRevertSale}
              disabled={reverting || !revertReason.trim()}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {reverting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ยืนยันยกเลิกการขาย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Reservation Dialog — captures refund amount so finance can reconcile */}
      <Dialog open={showCancelDialog} onOpenChange={(o) => { if (!cancelling) setShowCancelDialog(o); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="text-red-700">
              ยกเลิกการจองยูนิต {unit.unit_number}
            </DialogTitle>
            <DialogDescription>
              ลูกค้าจะหายจาก unit + booking จะถูกตั้งเป็น "ยกเลิก" — ระบุจำนวนเงินที่คืนเพื่อให้ฝ่ายบัญชีตามได้
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {unit.deposit_amount ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
                ลูกค้าจ่ายเงินจองไว้ <span className="font-bold tabular-nums">฿{Number(unit.deposit_amount).toLocaleString()}</span>
              </div>
            ) : (
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600">
                ไม่มีข้อมูลเงินจองในยูนิตนี้
              </div>
            )}
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                จำนวนเงินที่คืนให้ลูกค้า (บาท)
              </Label>
              <Input
                type="number"
                min="0"
                value={cancelRefundAmount}
                onChange={(e) => setCancelRefundAmount(e.target.value)}
                placeholder="0 = ริบเงินจอง"
                disabled={cancelling}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                ใส่ 0 หากริบเงินจอง · ใส่ตัวเลขเต็มหากคืนทั้งหมด
              </p>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                เหตุผล <span className="text-gray-400">(ไม่บังคับ)</span>
              </Label>
              <textarea
                value={cancelRefundReason}
                onChange={(e) => setCancelRefundReason(e.target.value)}
                placeholder="เช่น ลูกค้าเปลี่ยนใจ / เลือกห้องอื่น / กู้ไม่ผ่าน"
                disabled={cancelling}
                rows={2}
                className="w-full text-sm border border-gray-200 rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-chateau/30 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={cancelling}>
              ปิด
            </Button>
            <Button variant="destructive" onClick={submitCancelReservation} disabled={cancelling}>
              {cancelling ? 'กำลังยกเลิก...' : 'ยืนยันยกเลิกการจอง'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-Lead-Interest Dialog — soft-deletes the lead↔unit link with required reason + audit log */}
      <Dialog open={showDeleteInterestDialog} onOpenChange={(o) => { if (!deletingInterest) setShowDeleteInterestDialog(o); }}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <Trash2 className="w-5 h-5" />
              ลบ Lead ออกจากยูนิตนี้
            </DialogTitle>
            <DialogDescription>
              ลบความเชื่อมโยงระหว่าง <strong className="text-gray-900">{deleteInterestTarget?.customerName}</strong> กับยูนิต {unit.unit_number} — Lead ยังอยู่ในระบบ ไม่ได้ถูกลบ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900">
              <p className="font-semibold mb-1">เกิดอะไรขึ้นหลังลบ?</p>
              <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                <li>Lead จะหายจากรายการ "Leads ที่สนใจยูนิตนี้"</li>
                <li>คะแนน Lead จะคำนวณใหม่ (เพราะรายการยูนิตที่สนใจเปลี่ยน)</li>
                <li>ระบบเก็บประวัติไว้ Admin ตรวจสอบย้อนหลังได้</li>
              </ul>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700 mb-1.5 block">
                เหตุผล <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={deleteInterestReason}
                onChange={(e) => setDeleteInterestReason(e.target.value)}
                placeholder="เช่น เลือกยูนิตผิด, ลูกค้าเปลี่ยนใจ, ติดต่อไม่ได้นาน, สนใจยูนิตอื่นแทน..."
                rows={3}
                disabled={deletingInterest}
                className="resize-none"
              />
              {!deleteInterestReason.trim() && (
                <p className="text-[11px] text-gray-400 mt-1">
                  ต้องระบุเหตุผลเพื่อยืนยันการลบ
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteInterestDialog(false)}
              disabled={deletingInterest}
            >
              ยกเลิก
            </Button>
            <Button
              variant="destructive"
              onClick={submitDeleteInterest}
              disabled={deletingInterest || !deleteInterestReason.trim()}
              className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {deletingInterest ? (
                <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> กำลังลบ...</>
              ) : (
                <><Trash2 className="w-4 h-4 mr-1" /> ยืนยันลบ</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Sales Dialog — Admin/Owner picks Sales people responsible for this unit */}
      <Dialog open={showAssignDialog} onOpenChange={(o) => { if (!savingAssignments) setShowAssignDialog(o); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-chateau" />
              มอบหมาย Sales · ยูนิต {unit.unit_number}
            </DialogTitle>
            <DialogDescription>
              เลือกพนักงาน Sales ที่จะดูแลยูนิตนี้ — กดบันทึกเมื่อเลือกครบ
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-[400px] overflow-y-auto">
            {teamSales.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-500">
                ไม่มีพนักงานในทีม — เพิ่มผู้ใช้งานในหน้า "ทีมงาน" ก่อน
              </div>
            ) : (
              teamSales.map((s) => {
                const checked = pickedSalesIds.has(s.id);
                return (
                  <label
                    key={s.id}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all',
                      checked
                        ? 'border-chateau-200 bg-chateau-50/50'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSalesPick(s.id)}
                      disabled={savingAssignments}
                      className="w-4 h-4 accent-chateau"
                    />
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-chateau to-purple-600 text-white flex items-center justify-center text-sm font-semibold flex-shrink-0">
                      {s.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                      {s.email && (
                        <p className="text-xs text-gray-500 truncate">{s.email}</p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignDialog(false)} disabled={savingAssignments}>
              ยกเลิก
            </Button>
            <Button onClick={saveAssignments} disabled={savingAssignments || teamSales.length === 0}>
              {savingAssignments ? 'กำลังบันทึก...' : `บันทึก (${pickedSalesIds.size} คน)`}
            </Button>
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
