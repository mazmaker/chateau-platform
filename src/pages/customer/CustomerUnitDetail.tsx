import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Bed, Bath, Square, Layers, MapPin, Heart, Loader2, Sun, ParkingCircle, Check,
  ChevronLeft, ChevronRight, Calendar, Calculator, Share2,
  ChevronDown, View, Sparkles, FileDown, Timer, Clock,
} from 'lucide-react';
import { incrementLeadCounter } from '@/lib/leadTracking';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import CustomerLayout from './CustomerLayout';
import { getStoredReferralCode, clearStoredReferralCode } from '@/lib/referralCode';
import { startViewTracking } from '@/lib/viewTracking';
import SitePlanViewer from '@/components/properties/SitePlanViewer';

interface Unit {
  id: string;
  unit_number: string;
  unit_type?: string;
  building?: string;
  floor_number?: number | null;
  area_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  parking_spaces?: number | null;
  layout_description?: string | null;
  facing_direction?: string | null;
  view?: string | null;
  balcony?: boolean;
  garden?: boolean;
  pool?: boolean;
  furnishing?: string | null;
  price?: number | null;
  promo_price?: number | null;
  price_per_sqm?: number | null;
  status?: string;
  thumbnail_url?: string | null;
  images?: any;
  floor_plan_url?: string | null;
  tour_3d_url?: string | null;
  project_id: string;
  tenant_id: string;
  reserved_customer_lead_id?: string | null;
}

interface Property {
  id: string;
  name: string;
  developer?: string;
  address?: any;
  location_lat?: number | null;
  location_lng?: number | null;
  nearby?: any;
  master_plan_url?: string | null;
}

interface Sales {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
}

const CustomerUnitDetail = () => {
  const { id } = useParams<{ id: string }>();
  // When the customer arrived via a per-unit referral link, suppress catalog-style
  // recommendations (similar units, etc.) so they stay focused on the one unit the
  // agent shared.
  const isLockedToThisUnit = (() => {
    try { return sessionStorage.getItem('chateau_locked_unit_id') === id; } catch { return false; }
  })();
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [myInterest, setMyInterest] = useState<{ id: string; status: string; interest_level: string | null; viewing_date: string | null; created_at: string | null; updated_at: string | null } | null>(null);
  const [myBooking, setMyBooking] = useState<{ id: string; status: string; total_amount: number; booking_fee: number | null; deposit_amount: number | null } | null>(null);
  const [myLead, setMyLead] = useState<{ id: string; status: string | null; last_contact_date: string | null; assigned_to: string | null; referred_by_agent_id: string | null } | null>(null);
  const [similarUnits, setSimilarUnits] = useState<Unit[]>([]);
  const [assignedSales, setAssignedSales] = useState<Sales | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Gallery
  const [imgIndex, setImgIndex] = useState(0);

  // Loan calculator state
  const [loanOpen, setLoanOpen] = useState(false);
  const [downPct, setDownPct] = useState(20);
  const [termYears, setTermYears] = useState(25);
  const [interestRate, setInterestRate] = useState(6.5);
  const [activePreset, setActivePreset] = useState<'long' | 'recommended' | 'short' | 'custom'>('recommended');

  const LOAN_PRESETS = {
    long:        { down: 10, term: 30, rate: 5.5, label: 'ผ่อนนาน ดอกเบาๆ',  desc: 'ทุนน้อย เริ่มต้นเบา' },
    recommended: { down: 20, term: 25, rate: 6.5, label: 'แนะนำ',              desc: 'สำหรับคนทั่วไป' },
    short:       { down: 30, term: 15, rate: 7.0, label: 'ผ่อนสั้น จบเร็ว',     desc: 'เงินสำรองมาก' },
  };

  const applyPreset = (key: 'long' | 'recommended' | 'short') => {
    const p = LOAN_PRESETS[key];
    setDownPct(p.down);
    setTermYears(p.term);
    setInterestRate(p.rate);
    setActivePreset(key);
  };

  // Wishlist
  const [isWishlisted, setIsWishlisted] = useState(false);

  // Dialogs
  const [showInterestConfirm, setShowInterestConfirm] = useState(false);
  // Drives the anonymous-visitor hint under the CTA (soft-gate UX).
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const loadAll = async () => {
    if (!id) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unitData } = await (supabase.from('units') as any).select('*').eq('id', id).single();
      if (!unitData) { toast.error('ไม่พบยูนิต'); navigate('/customer/properties'); return; }
      setUnit(unitData as Unit);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: propData } = await (supabase.from('properties') as any)
        .select('id, name, developer, address, location_lat, location_lng, nearby, master_plan_url')
        .eq('id', (unitData as Unit).project_id).single();
      setProperty(propData as Property);

      // Similar units (same project, available, not this one)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: sims } = await (supabase.from('units') as any)
        .select('id, unit_number, area_sqm, bedrooms, bathrooms, price, promo_price, status, thumbnail_url, project_id, tenant_id, floor_plan_url')
        .eq('project_id', (unitData as Unit).project_id)
        .neq('id', id)
        .eq('status', 'available')
        .limit(4);
      setSimilarUnits((sims || []) as Unit[]);

      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id').eq('auth_user_id', user.id).maybeSingle();
        if (customer) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leads } = await (supabase.from('leads') as any)
            .select('id, assigned_to, status, last_contact_date, referred_by_agent_id').eq('customer_id', (customer as any).id);
          const leadList = (leads || []) as any[];
          const leadIds = leadList.map((l: any) => l.id);

          // Check existing interest + lead. Hoist `existingInterest` to outer scope
          // because the booking query below needs its lead_id for filtering.
          let existingInterest: any = null;
          if (leadIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existing } = await (supabase.from('lead_interests') as any)
              .select('id, status, interest_level, viewing_date, lead_id, created_at, updated_at')
              .eq('unit_id', id)
              .in('lead_id', leadIds)
              .not('status', 'in', '("dropped","lost")')
              .maybeSingle();
            if (existing) {
              existingInterest = existing;
              setMyInterest(existing as any);
              const matchingLead = leadList.find((l: any) => l.id === (existing as any).lead_id);
              if (matchingLead) setMyLead({ id: matchingLead.id, status: matchingLead.status, last_contact_date: matchingLead.last_contact_date, assigned_to: matchingLead.assigned_to ?? null, referred_by_agent_id: matchingLead.referred_by_agent_id ?? null });
            }
          }

          // Booking row for THIS unit + customer — drives step 6 (ชำระมัดจำ) state.
          // CRITICAL: filter by the CURRENT active interest's lead_id, otherwise an
          // old "confirmed" booking from a previously-dropped interest leaks into the
          // timeline as "ชำระมัดจำ ✓ ชำระแล้ว" even when the new interest hasn't
          // progressed past "ส่งคำขอ". The cancelled-status filter alone isn't enough:
          // bookings stay 'confirmed' when Sales soft-deletes an interest via trash.
          const currentInterestLeadId = existingInterest?.lead_id ?? null;
          if (currentInterestLeadId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: bookings } = await (supabase.from('bookings') as any)
              .select('id, status, total_amount, notes')
              .eq('customer_id', (customer as any).id)
              .neq('status', 'cancelled')
              .order('created_at', { ascending: false });
            const matchingBooking = ((bookings || []) as any[]).find((b) =>
              b.notes?.unit_id === id && b.notes?.lead_id === currentInterestLeadId,
            );
            setMyBooking(matchingBooking
              ? {
                  id: matchingBooking.id,
                  status: matchingBooking.status,
                  total_amount: Number(matchingBooking.total_amount || 0),
                  booking_fee: matchingBooking.notes?.booking_fee != null ? Number(matchingBooking.notes.booking_fee) : null,
                  deposit_amount: matchingBooking.notes?.deposit_amount != null ? Number(matchingBooking.notes.deposit_amount) : null,
                }
              : null);
          } else {
            // No active interest → no booking to consider for this view.
            setMyBooking(null);
          }

          // Find assigned sales
          const assignedId = leadList.find((l: any) => l.assigned_to)?.assigned_to;
          if (assignedId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: salesUser } = await (supabase.from('users') as any)
              .select('id, full_name, email, phone').eq('id', assignedId).maybeSingle();
            if (salesUser) setAssignedSales(salesUser as Sales);
          }
        }
      }

      // Load wishlist from localStorage
      try {
        const wl: string[] = JSON.parse(localStorage.getItem('customer_wishlist') || '[]');
        setIsWishlisted(wl.includes(id));
      } catch { /* ignore */ }
    } catch (err) {
      console.error('Load unit error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
    setImgIndex(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Funnel-layer-1 tracking. Records the view + duration + scroll depth in
  // property_views when the visitor leaves this page or navigates away. Anonymous
  // visitors get a stable visitor_id in localStorage so return-visit metrics work.
  // We start tracking AFTER the unit has loaded so we know tenant/property/unit ids.
  useEffect(() => {
    if (!unit) return;
    const tracker = startViewTracking({
      tenantId: (unit as any).tenant_id,
      propertyId: unit.project_id,
      unitId: unit.id,
      pagePath: window.location.pathname,
    });
    return () => tracker.flush();
  }, [unit?.id]);

  const toggleWishlist = async () => {
    if (!unit) return;
    try {
      const { toggleWishlist: toggle } = await import('@/lib/customerWishlist');
      const nowSaved = await toggle({
        id: unit.id,
        tenant_id: (unit as any).tenant_id,
        project_id: (unit as any).project_id,
      });
      setIsWishlisted(nowSaved);
      toast.success(nowSaved ? 'บันทึกในรายการที่ชอบแล้ว' : 'นำออกจากรายการแล้ว');
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!unit) return;
    const url = `${window.location.origin}/customer/units/${unit.id}`;
    const text = ` ${property?.name || ''} — ยูนิต ${unit.unit_number}\n ${fmt(unit.promo_price || unit.price)}\nดูรายละเอียด: ${url}`;
    if ((navigator as any).share) {
      try { await (navigator as any).share({ title: property?.name, text, url }); } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(text);
      toast.success('คัดลอกลิงก์แล้ว — แชร์ใน LINE / Facebook ได้เลย');
    }
  };

  const handleExpressInterest = async () => {
    if (!unit) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // Anonymous visitor — bounce to login with a return URL so they come back
        // to this exact unit after auth. Bookmarks/share-back stay intact because
        // captureReferralFromUrl() ran on the public mount and stripped ?ref already.
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        navigate(`/customer/login?return=${returnTo}`);
        return;
      }
      // Pull preferences too so we can seed leads.monthly_income/debt at creation
      // time. Without this, recomputeLeadScore sees leads.monthly_income=0 and skips
      // the loan estimate, so Sales sees "รอประเมินวงเงิน" until someone re-edits
      // the Lead. Copying at creation eliminates that drift state entirely.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customer } = await (supabase.from('customers') as any)
        .select('id, full_name, preferences, tenant_id').eq('auth_user_id', user.id).maybeSingle();
      if (!customer) { toast.error('ไม่พบข้อมูลลูกค้า'); return; }

      // First-touch tenant assignment. Customers sign up tenant-less via phone login
      // (they haven't picked a company yet); they "join" a tenant the moment they
      // engage with one of its units. First unit wins — never reassign afterwards.
      if (!(customer as any).tenant_id) {
        await (supabase.from('customers') as any)
          .update({ tenant_id: unit.tenant_id }).eq('id', (customer as any).id);
      }

      //  Find Sales — Admin pre-assignment + workload balance.
      //  Pool/race-to-claim model was retired (see project_lead_routing_model memory).
      //
      // Priority order:
      //  (1) Sales explicitly assigned to THIS unit (sales_unit_assignments) — highest priority,
      //      override balancing because the unit was specifically pre-allocated to that Sales.
      //  (2) Among Sales managing the project (sales_project_assignments), pick the one with
      //      the FEWEST active open leads (excluding won/lost). Balances workload fairly.
      //      Tie-breaker: oldest last-assignment time → round-robin behaviour for equal load.
      //  (3) No Sales pre-assigned → assigned_to = null → Admin will assign manually
      //      (Admin gets noti for every new Lead, so they will see it).
      let salesUserId: string | null = null;
      let routingReason: string = 'admin_queue';

      // (1) Unit-level explicit assignment
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unitAssign } = await (supabase.from('sales_unit_assignments') as any)
        .select('sales_user_id').eq('unit_id', unit.id).is('revoked_at', null).limit(1).maybeSingle();
      if (unitAssign?.sales_user_id) {
        salesUserId = unitAssign.sales_user_id;
        routingReason = 'unit_assigned';
      } else {
        // (2) Project-level — pick least-loaded Sales
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: projAssigns } = await (supabase.from('sales_project_assignments') as any)
          .select('sales_user_id, assigned_at')
          .eq('project_id', unit.project_id)
          .is('revoked_at', null);
        const candidates = ((projAssigns || []) as any[]).filter((r) => r.sales_user_id);
        if (candidates.length > 0) {
          // Count active leads per candidate (status not 'won'/'lost')
          const candidateIds = candidates.map((c) => c.sales_user_id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: activeLeadRows } = await (supabase.from('leads') as any)
            .select('assigned_to, status')
            .eq('tenant_id', unit.tenant_id)
            .in('assigned_to', candidateIds)
            .not('status', 'in', '("won","lost")');
          const loadByUser = new Map<string, number>();
          candidateIds.forEach((id) => loadByUser.set(id, 0));
          ((activeLeadRows || []) as any[]).forEach((r) => {
            loadByUser.set(r.assigned_to, (loadByUser.get(r.assigned_to) || 0) + 1);
          });
          // Sort: lowest load first, oldest assigned_at as tie-breaker
          const ranked = candidates
            .map((c) => ({
              id: c.sales_user_id,
              load: loadByUser.get(c.sales_user_id) || 0,
              assignedAt: c.assigned_at ? new Date(c.assigned_at).getTime() : 0,
            }))
            .sort((a, b) => a.load - b.load || a.assignedAt - b.assignedAt);
          salesUserId = ranked[0].id;
          routingReason = candidates.length === 1
            ? 'project_sole_sales'
            : `project_balanced (load ${ranked[0].load}, ${candidates.length} candidates)`;
        }
      }

      // Silent agent attribution — if customer arrived via ?ref=AG-2026-NNN, the code
      // was captured into sessionStorage on first page load. Resolve it to an Agent
      // user.id now and stamp the new lead, before clearing the session token. We do
      // this ONLY when creating a brand-new lead — never overwriting an existing one.
      let referredByAgentId: string | null = null;
      const storedRef = getStoredReferralCode();
      if (storedRef) {
        // Resolve via SECURITY DEFINER RPC — customers can't read public.users directly
        // (RLS), so a direct query always returned null. The function returns the agent's
        // id only when the code matches an agent in THIS unit's tenant (no cross-tenant leak).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: agentId } = await (supabase as any).rpc('resolve_referral_agent', {
          p_code: storedRef,
          p_tenant_id: unit.tenant_id,
        });
        if (agentId) referredByAgentId = agentId as string;
      }

      // Per-unit routing for agent-referred leads. The agent only owns the lead when
      // they actually service this specific unit (agent_unit_assignments). If the
      // customer is attributed to an agent but picks a unit outside that agent's
      // allotment, the lead's primary handler must be Sales (the agent can't book or
      // close that unit). The agent keeps referred_by attribution and gets a
      // courtesy notification so they can still track the lead.
      const isReferral = !!referredByAgentId;
      let agentServesThisUnit = false;
      if (isReferral && referredByAgentId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: serves } = await (supabase as any).rpc('agent_serves_unit', {
          p_agent_id: referredByAgentId,
          p_unit_id: unit.id,
        });
        agentServesThisUnit = !!serves;
      }
      const outOfScopeReferral = isReferral && !agentServesThisUnit;
      const assigneeId = (isReferral && agentServesThisUnit) ? referredByAgentId : salesUserId;
      if (isReferral) routingReason = agentServesThisUnit ? 'agent_referral' : 'agent_referral_out_of_scope';

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: lead } = await (supabase.from('leads') as any)
        .select('id, assigned_to, referred_by_agent_id').eq('customer_id', (customer as any).id).eq('tenant_id', unit.tenant_id).maybeSingle();
      const leadAlreadyExisted = !!lead;
      if (!lead) {
        // Seed financial fields from the customer profile so recomputeLeadScore can
        // immediately produce a loan estimate. Without this, leads.monthly_income
        // starts at 0 and the lead lives in "รอประเมินวงเงิน" limbo until someone
        // manually edits it.
        const prefs = (customer as any).preferences || {};
        const seedIncome = Number(prefs.monthly_income) || null;
        const seedDebt = prefs.monthly_debt != null ? Number(prefs.monthly_debt) : null;
        const seedAge = prefs.age != null ? Number(prefs.age) : null;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newLead, error: leadErr } = await (supabase.from('leads') as any)
          .insert({
            tenant_id: unit.tenant_id,
            customer_id: (customer as any).id,
            property_id: unit.project_id,
            unit_id: unit.id,
            status: 'new', source: referredByAgentId ? 'agent_referral' : 'customer_self', priority: 'medium',
            assigned_to: assigneeId, // Agent (if referred) else auto-assigned Sales
            referred_by_agent_id: referredByAgentId,
            monthly_income: seedIncome,
            monthly_debt: seedDebt,
            age: seedAge,
            notes: referredByAgentId
              ? 'ลูกค้ากดสนใจจาก Customer Portal (referral)'
              : 'ลูกค้ากดสนใจจาก Customer Portal',
          }).select('id, assigned_to, referred_by_agent_id').single();
        if (leadErr) throw leadErr;
        lead = newLead;
        // Consume the session token once the attribution is locked in DB, so a
        // subsequent visit doesn't double-attribute or surprise the customer.
        if (referredByAgentId) clearStoredReferralCode();
        // Fire-and-forget loan/score compute — if income was seeded, this fills in
        // max_loan_amount immediately so Sales sees the figure in their bell + table.
        if (seedIncome && seedIncome > 0) {
          import('@/lib/recomputeLeadScore')
            .then((m) => m.recomputeLeadScore((newLead as any).id))
            .catch(() => { /* best-effort */ });
        }
      } else if (!(lead as any).assigned_to && assigneeId) {
        // Existing lead without an owner — assign now (agent if referral, else Sales).
        // Does NOT touch referred_by_agent_id (immutability trigger would reject it anyway).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any).update({ assigned_to: assigneeId }).eq('id', (lead as any).id);
      }

      // Reuse a previously cancelled interest row if it exists (preserve audit trail / created_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: previousInterest } = await (supabase.from('lead_interests') as any)
        .select('id, status')
        .eq('lead_id', (lead as any).id)
        .eq('unit_id', unit.id)
        .maybeSingle();
      if (previousInterest) {
        // Bump updated_at explicitly — the customer timeline uses it as the baseline
        // for "has Sales contacted me about THIS unit since I expressed interest?".
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: reErr } = await (supabase.from('lead_interests') as any)
          .update({ status: 'interested', interest_level: 'high', notes: 'ลูกค้ากดสนใจอีกครั้งจาก Customer Portal', updated_at: new Date().toISOString() })
          .eq('id', (previousInterest as any).id);
        if (reErr) throw reErr;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: intErr } = await (supabase.from('lead_interests') as any).insert({
          tenant_id: unit.tenant_id, lead_id: (lead as any).id, property_id: unit.project_id, unit_id: unit.id,
          status: 'interested', interest_level: 'high', notes: 'บันทึกจาก Customer Portal',
        });
        if (intErr) throw intErr;
      }

      // Re-evaluate scope using the LEAD's persisted referred_by. The earlier check used
      // the session ref, which is null for returning customers (the ref code was consumed
      // on their first visit). Without this, a returning customer who picks an
      // out-of-scope unit would get the wrong notification title ("Lead ของคุณ...") and
      // the agent wouldn't get the "นอกขอบเขต" cue.
      const effectiveAgentId: string | null = (lead as any)?.referred_by_agent_id ?? referredByAgentId ?? null;
      let effectiveAgentServesUnit = false;
      if (effectiveAgentId) {
        if (effectiveAgentId === referredByAgentId) {
          effectiveAgentServesUnit = agentServesThisUnit;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: serves } = await (supabase as any).rpc('agent_serves_unit', {
            p_agent_id: effectiveAgentId,
            p_unit_id: unit.id,
          });
          effectiveAgentServesUnit = !!serves;
        }
      }
      const effectiveOutOfScope = !!effectiveAgentId && !effectiveAgentServesUnit;

      // Insert activity_log so Sales bell picks it up (+ audit trail for routing decision)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_logs') as any).insert({
        tenant_id: unit.tenant_id,
        user_id: assigneeId, // attribute to the owner (agent if referred, else Sales; null if pool)
        activity_type: 'interest_added',
        description: `ลูกค้า${(customer as any).full_name || ''} สนใจยูนิต ${unit.unit_number}`,
        metadata: {
          lead_id: (lead as any).id,
          unit_id: unit.id,
          unit_number: unit.unit_number,
          customer_name: (customer as any).full_name,
          source: 'customer_portal',
          routing_reason: routingReason,
          assigned_to: assigneeId,
        },
      });

      // In-app notification routing — Admin-controlled model (no pool broadcast):
      //   • Admin/Owner   → notified for EVERY new "ฉันสนใจ" event (full visibility)
      //   • Sales         → notified ONLY if Admin pre-assigned this unit/project to them
      //                     (sales_unit_assignments / sales_project_assignments).
      //   • Pool broadcast was removed in favour of this model — no more "first Sales to
      //     click wins" races, which the team raised as a commission-dispute risk.
      try {
        const customerName = (customer as any).full_name || 'ลูกค้า';
        const { createNotification, getTenantAdminUserIds } = await import('@/lib/notifications');

        const newLeadTitle = 'Lead ใหม่เข้ามา';
        const existingLeadTitle = 'ลูกค้าเดิมสนใจยูนิตใหม่';
        const activityType = leadAlreadyExisted ? 'lead_interest_added' : 'lead_created';
        const message = `${customerName} สนใจยูนิต ${unit.unit_number}`;
        const data = { unit_id: unit.id, unit_number: unit.unit_number, source: 'customer_portal' };

        // Resolve the lead's CURRENT owner — read from the lead itself rather than the
        // session ref. Subsequent interests by the same customer must still notify the
        // owning agent even when the ref code was already consumed on the first visit.
        // assigneeId is the fallback for brand-new leads (the lead JS object's assigned_to
        // was just set via insert but isn't reflected in the in-memory `lead` variable).
        const ownerId = (lead as any).assigned_to ?? assigneeId ?? null;
        const leadAgentId = (lead as any).referred_by_agent_id ?? referredByAgentId ?? null;
        const ownerIsReferringAgent = !!(ownerId && leadAgentId && ownerId === leadAgentId);

        // 1) Admin/Owner — always notified, regardless of who was assigned.
        const adminTitleSuffix = ownerId ? '' : ' — โปรด assign Sales';
        const adminIds = await getTenantAdminUserIds(unit.tenant_id);
        for (const adminId of adminIds) {
          await createNotification({
            tenantId: unit.tenant_id,
            userId: adminId,
            activityType,
            title: (leadAlreadyExisted ? existingLeadTitle : newLeadTitle) + adminTitleSuffix,
            message,
            severity: 'info',
            relatedEntityType: 'lead',
            relatedEntityId: (lead as any).id,
            data,
          });
        }

        // 2) Notify the lead's CURRENT owner so they know their Lead just came in.
        //    Title branches on whether that owner is still the referring agent (pre-handoff)
        //    or Sales (direct customer, or the agent has already handed off to Sales).
        if (ownerId) {
          // Title branches:
          //   • Referring agent + serves the unit  → normal "Lead ใหม่/ลูกค้าจากลิงก์...สนใจ"
          //   • Referring agent + does NOT serve  → "นอกขอบเขต" so the agent immediately
          //     sees this isn't theirs to action (Sales will handle).
          //   • Sales / direct customer             → existing Sales-side title.
          const agentOwnerOutOfScope = ownerIsReferringAgent && effectiveOutOfScope;
          await createNotification({
            tenantId: unit.tenant_id,
            userId: ownerId,
            activityType,
            title: agentOwnerOutOfScope
              ? 'ลูกค้าของคุณสนใจยูนิตนอกขอบเขต'
              : ownerIsReferringAgent
                ? (leadAlreadyExisted ? 'ลูกค้าจากลิงก์แนะนำของคุณสนใจยูนิตใหม่' : 'Lead ใหม่จากลิงก์แนะนำของคุณ')
                : (leadAlreadyExisted ? 'ลูกค้าของคุณสนใจยูนิตใหม่' : newLeadTitle),
            message: agentOwnerOutOfScope
              ? `${customerName} สนใจยูนิต ${unit.unit_number} — ทีมขายดูแลให้`
              : message,
            severity: 'info',
            relatedEntityType: 'lead',
            relatedEntityId: (lead as any).id,
            data,
          });
        }

        // 3) Out-of-scope referral — when the referring agent isn't the lead's owner
        //    (e.g. handed off to Sales, or the new lead routed straight to Sales), still
        //    notify the agent so their referral pipeline shows the activity.
        if (effectiveOutOfScope && effectiveAgentId && effectiveAgentId !== ownerId) {
          await createNotification({
            tenantId: unit.tenant_id,
            userId: effectiveAgentId,
            activityType,
            title: 'ลูกค้าของคุณสนใจยูนิตนอกขอบเขต',
            message: `${customerName} สนใจยูนิต ${unit.unit_number} — ทีมขายดูแลให้`,
            severity: 'info',
            relatedEntityType: 'lead',
            relatedEntityId: (lead as any).id,
            data,
          });
        }
      } catch (notifErr) {
        console.warn('[notifications] lead creation notify failed:', notifErr);
      }

      await loadAll();
      setShowInterestConfirm(true);
      // Lock served its purpose — attribution is now persisted on the lead.
      // Releasing it lets the customer browse the rest of the portal naturally.
      try {
        const m = await import('@/lib/lockedUnitMode');
        m.clearLockedUnit();
      } catch { /* ignore */ }
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  // handleCancelInterest removed — Customer no longer has a self-cancel button.
  // Cancellation is handled by Sales via the trash icon + reason dialog on the
  // staff Unit Detail page (UnitDetail.tsx → submitDeleteInterest), which
  // maintains audit trail, recomputes lead score, and prevents accidental /
  // troll clicks from corrupting the pipeline.

  if (loading) {
    return (
      <CustomerLayout title="กำลังโหลด..." showBack>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      </CustomerLayout>
    );
  }
  if (!unit) return null;

  // Agent-referred leads are handled by the referring agent (not auto-assigned Sales),
  // so the customer-facing "who will contact you" copy is kept neutral ("พนักงาน")
  // instead of promising Sales — without revealing the agent (silent attribution).
  const isAgentReferred = !!myLead?.referred_by_agent_id;

  // Build gallery images: thumbnail_url first, then unit.images[]
  const galleryImages: string[] = [];
  if (unit.thumbnail_url) galleryImages.push(unit.thumbnail_url);
  if (Array.isArray(unit.images)) {
    unit.images.forEach((img: any) => {
      const url = typeof img === 'string' ? img : img?.url;
      if (url && !galleryImages.includes(url)) galleryImages.push(url);
    });
  }

  const isPromo = unit.promo_price && unit.price && unit.promo_price < unit.price;
  const finalPrice = isPromo ? unit.promo_price! : (unit.price || 0);

  // Loan calculation
  const downPayment = finalPrice * (downPct / 100);
  const loanAmount = finalPrice - downPayment;
  const monthlyRate = interestRate / 100 / 12;
  const totalMonths = termYears * 12;
  const monthlyPayment = monthlyRate > 0
    ? loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1)
    : loanAmount / totalMonths;


  return (
    <CustomerLayout title={`ยูนิต ${unit.unit_number}`} subtitle={property?.name} showBack backTo={property ? `/customer/properties/${property.id}` : '/customer/properties'}>
      {/* === Hero Gallery === */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="relative aspect-[4/3] bg-gray-100 group">
          {galleryImages.length > 0 ? (
            <img src={galleryImages[imgIndex]} alt={`${unit.unit_number} ${imgIndex + 1}`} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Building2 className="w-16 h-16 text-gray-300" />
            </div>
          )}

          {/* Wishlist heart top-right — with label */}
          <button
            onClick={toggleWishlist}
            className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 h-10 rounded-full backdrop-blur-md transition-all hover:scale-105 shadow-md ${
              isWishlisted
                ? 'bg-chateau text-white'
                : 'bg-white/95 text-gray-700 hover:text-chateau'
            }`}
          >
            <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-current' : ''}`} />
            <span className="text-xs font-semibold">{isWishlisted ? 'บันทึกแล้ว' : 'บันทึก'}</span>
          </button>

          {/* Share top-left */}
          <button
            onClick={handleShare}
            className="absolute top-3 left-3 w-10 h-10 rounded-full backdrop-blur-md bg-white/90 flex items-center justify-center text-gray-600 transition-all hover:scale-110 shadow-md"
            title="แชร์"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* Gallery nav */}
          {galleryImages.length > 1 && (
            <>
              <button
                onClick={() => setImgIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setImgIndex((i) => (i + 1) % galleryImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-gray-700 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              {/* Counter */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 text-white text-xs font-semibold">
                {imgIndex + 1} / {galleryImages.length}
              </div>
              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {galleryImages.slice(0, 8).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setImgIndex(i)}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${i === imgIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* 3D Tour badge */}
          {unit.tour_3d_url && (
            <a
              href={unit.tour_3d_url}
              target="_blank" rel="noopener noreferrer"
              className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur rounded-full text-xs font-semibold text-gray-900 hover:bg-white transition-colors"
            >
              <View className="w-3.5 h-3.5" /> 3D Tour
            </a>
          )}
        </div>

        {/* Title + Price */}
        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">ยูนิต {unit.unit_number}</h1>
              {unit.unit_type && <p className="text-sm text-gray-500 mt-0.5">{unit.unit_type}</p>}
              {/* Interest badge — differentiate a passive heart-save from a real
                  "ฉันสนใจ" request. A heart-save (interest_level='low') is just a
                  bookmark; claiming "Sales รับเรื่อง" for it is misleading. */}
              {myInterest && (myInterest.interest_level === 'high'
                || ['contacted', 'qualified', 'negotiating', 'reserved', 'won'].includes((myInterest.status || '').toLowerCase())) ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-chateau bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full mt-1.5">
                  <Heart className="w-3 h-3 fill-current" /> ส่งคำขอแล้ว · รอติดต่อกลับ
                </span>
              ) : myInterest ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full mt-1.5">
                  <Heart className="w-3 h-3 fill-current text-chateau" /> บันทึกไว้ดูทีหลัง
                </span>
              ) : null}
            </div>
            {unit.status === 'available' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> ว่าง พร้อมจอง
              </span>
            ) : unit.status === 'reserved' ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> มีคนจอง
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> ขายแล้ว
              </span>
            )}
          </div>

          <div className="flex items-baseline gap-3 mb-1">
            <p className="text-3xl font-bold text-chateau">{fmt(finalPrice)}</p>
            {isPromo && (
              <>
                <p className="text-base text-gray-400 line-through">{fmt(unit.price)}</p>
                <span className="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                  ลด {Math.round(((unit.price! - unit.promo_price!) / unit.price!) * 100)}%
                </span>
              </>
            )}
          </div>
          {unit.price_per_sqm && (
            <p className="text-xs text-gray-500">฿{Number(unit.price_per_sqm).toLocaleString()} / ตร.ม.</p>
          )}
        </div>
      </div>

      {/* === Modern compact horizontal stepper (2024+ PropTech pattern).
           Replaces the legacy vertical timeline — matches Sansiri Plus 2.0 / AP Live's
           current pattern: a single horizontal progress strip with 5 dots at the top,
           and detail cards (booking, viewing, payment) shown separately below. === */}
      {myInterest && (() => {
        const unitReservedForMyLead = !!(myLead?.id && unit.reserved_customer_lead_id === myLead.id);
        const hasReserved = myInterest.status === 'reserved' || (unitReservedForMyLead && unit.status === 'reserved');
        const hasWon = myInterest.status === 'won' || (unitReservedForMyLead && unit.status === 'sold');

        // The booking-status timeline is ONLY for real engagement — when the customer
        // clicked "ฉันสนใจ" (interest_level='high'), or the deal progressed (status past
        // 'interested'), or there's a booking. A passive heart-save (interest_level='low')
        // is just a bookmark — showing "สถานะการจอง" with a half-done timeline for it is
        // misleading (the customer never started the sales process). Hide it entirely.
        const isRealEngagement =
          myInterest.interest_level === 'high'
          || ['contacted', 'qualified', 'negotiating', 'reserved', 'won'].includes((myInterest.status || '').toLowerCase())
          || unitReservedForMyLead
          || !!myBooking;
        if (!isRealEngagement) return null;

        const advancedInterestStates = ['contacted', 'qualified', 'negotiating', 'reserved', 'won'];
        const interestProgressed = advancedInterestStates.includes((myInterest?.status || '').toLowerCase());
        // Compare last_contact_date against the interest's updated_at (the moment the
        // customer last (re)expressed interest in THIS unit), NOT created_at. Otherwise
        // a lead-level contact about a DIFFERENT unit leaks in: e.g. customer hearted
        // C0201 long ago, Sales later called about A2818 → last_contact_date > C0201's
        // created_at → C0201 falsely shows "ติดต่อกลับ ✓". handleExpressInterest bumps
        // updated_at on every fresh "ฉันสนใจ", so contact only counts if it happened
        // AFTER the customer's latest expression on this specific unit.
        const interestBaseline = myInterest?.updated_at || myInterest?.created_at;
        const contactAfterInterest = !!(
          myLead?.last_contact_date &&
          interestBaseline &&
          new Date(myLead.last_contact_date) > new Date(interestBaseline)
        );
        const salesContacted = interestProgressed || contactAfterInterest || unitReservedForMyLead;

        const bookingStatus = myBooking?.status || null;
        const bookingExists = bookingStatus === 'pending' || bookingStatus === 'confirmed' || bookingStatus === 'checked_in' || bookingStatus === 'checked_out';
        const hasBooking = bookingExists || hasReserved || hasWon;
        const depositPaid = bookingStatus === 'confirmed' || bookingStatus === 'checked_in' || bookingStatus === 'checked_out';
        const titleTransferred = bookingStatus === 'checked_in' || bookingStatus === 'checked_out' || hasWon || (unitReservedForMyLead && unit.status === 'sold');

        const steps = [
          { key: 'submit', label: 'ส่งคำขอ', done: true },
          { key: 'contacted', label: 'ติดต่อกลับ', done: salesContacted },
          // "ค่าจอง" — booking fee paid (5K-10K) locks the unit. In our schema this
          // maps to bookings.status='pending' (Sales has created the booking row and
          // collected the booking fee from the customer).
          { key: 'booked', label: 'จอง', done: hasBooking },
          // "ค่ามัดจำ" — the 10-15% down payment + contract signing. Maps to
          // bookings.status='confirmed'.
          { key: 'deposit', label: 'ทำสัญญา', done: depositPaid },
          // "โอนกรรมสิทธิ์" — final title transfer at Land Office, after mortgage
          // approval. Maps to bookings.status='checked_in'/'checked_out'.
          { key: 'transfer', label: 'โอนกรรมสิทธิ์', done: titleTransferred },
        ];
        const activeIdx = steps.findIndex((s) => !s.done);
        const currentIdx = activeIdx === -1 ? steps.length - 1 : activeIdx;

        return (
          <div className="bg-white border border-gray-100 rounded-2xl p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">ความคืบหน้า</h2>
            <div className="flex items-start">
              {steps.map((s, i) => {
                const isCurrent = i === currentIdx && !s.done;
                const isDone = s.done;
                const nextDone = i < steps.length - 1 && steps[i + 1].done;
                return (
                  <div key={s.key} className="flex-1 flex flex-col items-center relative">
                    {/* Connector to next step — sits behind the dot via z-index */}
                    {i < steps.length - 1 && (
                      <div className={`absolute top-3.5 left-1/2 right-0 h-0.5 w-full ${nextDone || isDone ? 'bg-chateau' : 'bg-gray-200'}`} />
                    )}
                    {/* Dot */}
                    <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isDone ? 'bg-chateau text-white' :
                      isCurrent ? 'bg-white border-2 border-chateau' :
                      'bg-white border-2 border-gray-200'
                    }`}>
                      {isDone ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={3} />
                      ) : isCurrent ? (
                        <div className="w-2 h-2 rounded-full bg-chateau animate-pulse" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      )}
                    </div>
                    {/* Label */}
                    <p className={`text-[10px] mt-1.5 text-center leading-tight ${
                      isDone ? 'text-gray-700 font-medium' :
                      isCurrent ? 'text-chateau font-semibold' :
                      'text-gray-400'
                    }`}>
                      {s.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {/* Currently-active step's tagline shown below the strip — keeps the stepper
                tidy while still telling the customer what they're waiting on. */}
            {(() => {
              const currentStep = steps[currentIdx];
              if (currentStep.done) return null;
              const taglines: Record<string, string> = {
                contacted: myLead?.assigned_to ? (isAgentReferred ? 'รอพนักงานติดต่อกลับ' : 'รอ Sales โทรกลับ') : 'รอจัดสรรพนักงาน',
                booked: 'รอชำระค่าจองเพื่อล็อกยูนิต',
                deposit: 'รอชำระค่ามัดจำ + เซ็นสัญญา',
                transfer: 'รอกู้สำเร็จ + โอนกรรมสิทธิ์',
              };
              const text = taglines[currentStep.key];
              return text ? (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs text-chateau font-medium flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    {text}
                  </p>
                </div>
              ) : null;
            })()}
          </div>
        );
      })()}

      {/* === นัดเยี่ยมชม (separate card — only when scheduled or visit happened).
           Decoupled from the main timeline because viewing is optional in the
           real-world workflow (Sansiri/AP customers often commit without visiting
           first). Embedding it in a linear timeline caused false ✓ checkmarks on
           the "จองก่อนดู" path. === */}
      {myInterest && (myInterest.viewing_date || ['viewed', 'negotiating', 'reserved', 'won'].includes(myInterest.status)) && (
        <div className="bg-white border border-amber-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-600" /> นัดเยี่ยมชมโครงการ
          </h2>
          {(() => {
            const visited = ['viewed', 'negotiating', 'reserved', 'won'].includes(myInterest.status);
            const scheduled = !!myInterest.viewing_date && !visited;
            return (
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  visited ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {visited ? <Check className="w-5 h-5" strokeWidth={2.5} /> : <Clock className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  {visited ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">เยี่ยมชมเรียบร้อย</p>
                      {myInterest.viewing_date && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          เมื่อ {new Date(myInterest.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </>
                  ) : scheduled ? (
                    <>
                      <p className="text-sm font-semibold text-gray-900">
                        นัดวันที่ {new Date(myInterest.viewing_date!).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                      {property?.name && (
                        <p className="text-xs text-gray-500 mt-0.5">ที่ {property.name}</p>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* === การชำระเงิน (only once a booking exists) — shows the two-payment
           breakdown (ค่าจอง + ค่ามัดจำ) + remaining balance so the customer
           understands exactly what they've paid and what's left. === */}
      {myBooking && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-chateau" /> การชำระเงิน
          </h2>
          {(() => {
            const fee = myBooking.booking_fee || 0;
            const deposit = myBooking.deposit_amount || 0;
            const total = myBooking.total_amount || 0;
            const remaining = Math.max(0, total - fee - deposit);
            const row = (label: string, amount: number, paid: boolean, hint?: string) => (
              <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${paid ? 'bg-chateau text-white' : 'bg-gray-100 text-gray-400'}`}>
                    {paid ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <Clock className="w-3 h-3" />}
                  </div>
                  <div>
                    <p className="text-sm text-gray-800">{label}</p>
                    {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
                  </div>
                </div>
                <span className={`text-sm font-semibold tabular-nums ${paid ? 'text-gray-900' : 'text-gray-400'}`}>
                  {amount > 0 ? `฿${amount.toLocaleString('th-TH')}` : (paid ? '✓' : 'รอชำระ')}
                </span>
              </div>
            );
            return (
              <div>
                {row('ค่าจอง', fee, fee > 0, 'ล็อกยูนิต')}
                {row('ค่ามัดจำ', deposit, deposit > 0, 'เงินดาวน์ + เซ็นสัญญา')}
                <div className="flex items-center justify-between pt-3 mt-1">
                  <p className="text-sm font-semibold text-gray-900">คงเหลือ (ยื่นกู้ธนาคาร)</p>
                  <span className="text-sm font-bold text-chateau tabular-nums">
                    ฿{remaining.toLocaleString('th-TH')}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* === Specs === */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">รายละเอียดยูนิต</h2>
        <div className="grid grid-cols-2 gap-y-4 gap-x-3">
          {unit.bedrooms != null && <SpecItem icon={Bed} label="ห้องนอน" value={`${unit.bedrooms} ห้อง`} />}
          {unit.bathrooms != null && <SpecItem icon={Bath} label="ห้องน้ำ" value={`${unit.bathrooms} ห้อง`} />}
          {unit.area_sqm && <SpecItem icon={Square} label="พื้นที่ใช้สอย" value={`${unit.area_sqm} ตร.ม.`} />}
          {unit.floor_number != null && <SpecItem icon={Layers} label="ชั้น" value={`${unit.floor_number}`} />}
          {unit.facing_direction && <SpecItem icon={Sun} label="ทิศหน้าบ้าน" value={unit.facing_direction} />}
          {unit.parking_spaces != null && unit.parking_spaces > 0 && (
            <SpecItem icon={ParkingCircle} label="ที่จอดรถ" value={`${unit.parking_spaces} คัน`} />
          )}
          {unit.view && <SpecItem icon={MapPin} label="วิว" value={unit.view} />}
          {unit.furnishing && <SpecItem icon={Building2} label="เฟอร์นิเจอร์" value={unit.furnishing} />}
        </div>

        {(unit.balcony || unit.garden || unit.pool) && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">สิ่งอำนวยความสะดวก</p>
            <div className="flex flex-wrap gap-2">
              {unit.balcony && <Tag> ระเบียง</Tag>}
              {unit.garden && <Tag> สวน</Tag>}
              {unit.pool && <Tag> สระน้ำ</Tag>}
            </div>
          </div>
        )}

        {unit.layout_description && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">คำอธิบายการจัดวาง</p>
            <p className="text-sm text-gray-700 leading-relaxed">{unit.layout_description}</p>
          </div>
        )}

        {/* Floor Plan download — unit-level fact sheet (PDF of room layout) */}
        <button
          type="button"
          onClick={async () => {
            await incrementLeadCounter({ field: 'brochure_downloads', propertyId: unit.project_id });
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('activity_logs') as any).insert({
                tenant_id: unit.tenant_id,
                activity_type: 'floor_plan_downloaded',
                description: `ลูกค้าดาวน์โหลด Floor Plan ยูนิต ${unit.unit_number}`,
                metadata: { unit_id: unit.id, property_id: unit.project_id, source: 'customer_portal' },
              });
            } catch { /* non-blocking */ }
            if (unit.floor_plan_url) {
              window.open(unit.floor_plan_url, '_blank', 'noopener');
              toast.success('กำลังเปิด Floor Plan...');
            } else {
              toast.info('Floor Plan จะถูกส่งไปทางอีเมลภายใน 5 นาที');
            }
          }}
          className="mt-5 w-full bg-gradient-to-r from-rose-50 to-white border border-rose-100 rounded-xl p-3.5 hover:border-chateau/40 hover:shadow-soft transition-all text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-chateau/10 flex items-center justify-center flex-shrink-0 group-hover:bg-chateau/20 transition-colors">
              <FileDown className="w-5 h-5 text-chateau" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-gray-900">ดาวน์โหลด Floor Plan</p>
              <p className="text-xs text-gray-500 mt-0.5">แปลนห้อง · มิติ · ทิศหน้าบ้าน ฯลฯ</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-chateau transition-colors flex-shrink-0" />
          </div>
        </button>
      </div>

      {/* === Loan Calculator === */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <button
          onClick={() => setLoanOpen((v) => !v)}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-chateau flex items-center justify-center">
              <Calculator className="w-5 h-5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-gray-900">คำนวณค่างวด</p>
              <p className="text-xs text-gray-500">ผ่อนเดือนละ ~{Math.round(monthlyPayment).toLocaleString()} บาท</p>
            </div>
          </div>
          <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${loanOpen ? 'rotate-180' : ''}`} />
        </button>

        {loanOpen && (
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
            {/* Preset buttons */}
            <div>
              <Label className="text-xs text-gray-500 mb-2 block">เลือกแบบที่เหมาะกับคุณ</Label>
              <div className="grid grid-cols-3 gap-2">
                {(['long', 'recommended', 'short'] as const).map((key) => {
                  const p = LOAN_PRESETS[key];
                  const isActive = activePreset === key;
                  const isRecommended = key === 'recommended';
                  return (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`relative p-2.5 rounded-xl border-2 text-center transition-all ${
                        isActive
                          ? 'border-chateau bg-rose-50 text-chateau ring-2 ring-rose-200'
                          : 'border-gray-200 hover:border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {isRecommended && (
                        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-chateau text-white px-1.5 py-0.5 rounded-full whitespace-nowrap">
                           แนะนำ
                        </span>
                      )}
                      <p className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-chateau' : 'text-gray-900'}`}>
                        {p.label}
                      </p>
                      <p className="text-[9px] text-gray-500 mt-0.5">{p.down}% · {p.term} ปี</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Manual sliders */}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-400 mb-3">หรือปรับเอง</p>

              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-gray-500">เงินดาวน์</Label>
                  <span className="text-xs font-semibold text-gray-900">{downPct}% · ฿{Math.round(downPayment).toLocaleString()}</span>
                </div>
                <input
                  type="range" min="5" max="50" step="5" value={downPct}
                  onChange={(e) => { setDownPct(Number(e.target.value)); setActivePreset('custom'); }}
                  className="w-full accent-chateau"
                />
              </div>
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-gray-500">ระยะเวลาผ่อน</Label>
                  <span className="text-xs font-semibold text-gray-900">{termYears} ปี</span>
                </div>
                <input
                  type="range" min="10" max="30" step="5" value={termYears}
                  onChange={(e) => { setTermYears(Number(e.target.value)); setActivePreset('custom'); }}
                  className="w-full accent-chateau"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <Label className="text-xs text-gray-500">ดอกเบี้ย (โดยประมาณ)</Label>
                  <span className="text-xs font-semibold text-gray-900">{interestRate}% ต่อปี</span>
                </div>
                <input
                  type="range" min="3" max="9" step="0.25" value={interestRate}
                  onChange={(e) => { setInterestRate(Number(e.target.value)); setActivePreset('custom'); }}
                  className="w-full accent-chateau"
                />
                <p className="text-[10px] text-gray-400 mt-1">ดอกเบี้ยบ้านไทยทั่วไป 5.5-7% (ขึ้นกับธนาคาร)</p>
              </div>
            </div>

            {/* Result */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-500">ยอดผ่อน/เดือน</p>
                  <p className="text-lg font-bold text-chateau">฿{Math.round(monthlyPayment).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500">ยอดกู้รวม</p>
                  <p className="text-base font-semibold text-gray-900">{fmt(loanAmount)}</p>
                </div>
              </div>
              <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
                * ตัวเลขโดยประมาณ — อัตราจริงขึ้นกับธนาคารและคุณสมบัติผู้กู้
              </p>
            </div>

            {/* Info — sales will confirm real numbers */}
            <p className="text-xs text-gray-500 text-center pt-1">
               พนักงานจะคำนวณตัวเลขจริงให้เมื่อนัดดูยูนิต
            </p>
          </div>
        )}
      </div>

      {/* === Site Plan === Replaces the old static master_plan_url <img>.
          Same component used on the property page — multi-plan tabbed viewer with
          clickable hotspots. The current unit is highlighted (pulsing pin) so the
          customer can spot where THIS unit sits within the project. */}
      {property?.id && (
        <SitePlanViewer
          propertyId={property.id}
          highlightUnitId={unit.id}
        />
      )}

      {/* === Unit Plan (แบบห้องของฉัน) + 3D Tour === */}
      {(unit.floor_plan_url || unit.tour_3d_url) && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-600" /> แบบห้องของคุณ Unit Plan
            </h2>
            {unit.tour_3d_url && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                <View className="w-3 h-3" /> รองรับ 3D
              </span>
            )}
          </div>

          {unit.floor_plan_url && (
            <div className="relative rounded-xl overflow-hidden border border-gray-100 group">
              <img src={unit.floor_plan_url} alt="floor plan" className="w-full block" />
              {unit.tour_3d_url && (
                <a
                  href={unit.tour_3d_url}
                  target="_blank" rel="noopener noreferrer"
                  className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent flex items-end justify-center pb-4 opacity-0 group-hover:opacity-100 transition-all"
                  aria-label="ดู 3D Tour"
                />
              )}
            </div>
          )}

          {/* 3D Tour CTA — restyled in Chateau brand red (less loud than the previous
              purple gradient) and shrunk one size step. Brand consistency over flashy. */}
          {unit.tour_3d_url && (
            <a
              href={unit.tour_3d_url}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex items-center justify-center gap-2 px-4 h-10 rounded-lg bg-rose-500 text-white font-semibold text-xs hover:bg-rose-600 transition-colors"
            >
              <View className="w-4 h-4" />
              เปิดดู 3D Tour
              <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded">แท็บใหม่</span>
            </a>
          )}

          {unit.tour_3d_url && (
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
               <strong>3D Tour</strong> ให้คุณ "เดิน" สำรวจบ้านเสมือนจริง 360° — ลากเมาส์หรือไถบนมือถือเพื่อหมุนมุมมอง
            </p>
          )}
        </div>
      )}

      {/* === Location === Map only — nearby-places list removed per UX request */}
      {property?.location_lat && property?.location_lng && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-600" /> ทำเลโครงการ
          </h2>
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <iframe
              title="map"
              width="100%" height="220" loading="lazy"
              src={`https://maps.google.com/maps?q=${property.location_lat},${property.location_lng}&z=15&output=embed`}
              style={{ border: 0 }}
            />
          </div>
        </div>
      )}

      {/* === Similar units === */}
      {similarUnits.length > 0 && !isLockedToThisUnit && (
        <div>
          <h2 className="text-sm font-semibold text-gray-900 mb-3">ยูนิตที่คล้ายกัน</h2>
          <div className="grid grid-cols-2 gap-3">
            {similarUnits.map((u) => {
              const sPromo = u.promo_price && u.price && u.promo_price < u.price;
              return (
                <button
                  key={u.id}
                  onClick={() => navigate(`/customer/units/${u.id}`)}
                  className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all text-left active:scale-[0.99] flex flex-col"
                >
                  <div className="aspect-[4/3] bg-gray-100">
                    {u.thumbnail_url ? (
                      <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Building2 className="w-8 h-8 text-gray-300" /></div>
                    )}
                  </div>
                  <div className="p-3 flex-1">
                    <p className="text-sm font-semibold text-gray-900 mb-0.5">ยูนิต {u.unit_number}</p>
                    <p className="text-[10px] text-gray-500 mb-1">
                      {u.bedrooms != null && `${u.bedrooms} นอน · `}
                      {u.area_sqm && `${u.area_sqm} ตร.ม.`}
                    </p>
                    <p className="text-sm font-bold text-chateau">{fmt(sPromo ? u.promo_price : u.price)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* === Sticky CTA — "ฉันสนใจ — ให้ Sales ติดต่อกลับ".
           Shows when the unit is available AND the customer hasn't already made a
           real request. A passive heart-save (interest_level='low') still gets the
           CTA so they can escalate the bookmark into an actual Sales contact request.
           Hidden only once they've requested (interest_level='high') / progressed. === */}
      {(() => {
        const alreadyRequested = !!myInterest && (
          myInterest.interest_level === 'high'
          || ['contacted', 'qualified', 'negotiating', 'reserved', 'won'].includes((myInterest.status || '').toLowerCase())
        );
        if (alreadyRequested || unit.status !== 'available') return null;
        return (
          <div className="sticky bottom-20 z-10 -mx-5 px-5 pt-3 bg-gradient-to-t from-white via-white">
            <Button
              onClick={handleExpressInterest}
              disabled={submitting}
              className="w-full h-12 text-sm font-semibold bg-chateau hover:bg-chateau-700 text-white shadow-md shadow-chateau/20"
            >
              {submitting ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</>
              ) : (
                <><Heart className="w-4 h-4 mr-2" /> สนใจยูนิตนี้ — ให้พนักงานติดต่อกลับ</>
              )}
            </Button>
            {!isLoggedIn && !submitting && (
              <p className="text-center text-xs text-gray-500 mt-2">
                เข้าสู่ระบบก่อน เพื่อให้พนักงานติดต่อคุณได้
              </p>
            )}
          </div>
        );
      })()}

      {/* === Interest Confirmation Modal === */}
      <Dialog open={showInterestConfirm} onOpenChange={setShowInterestConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                <Check className="w-5 h-5" strokeWidth={3} />
              </div>
              <span>เราได้รับเรื่องของคุณแล้ว</span>
            </DialogTitle>
            <DialogDescription className="pt-2">
              {isAgentReferred
                ? 'พนักงานจะติดต่อกลับเพื่อให้ข้อมูลเพิ่มเติมและช่วยเหลือคุณในขั้นตอนต่อไป'
                : 'ทีม Sales จะติดต่อกลับเพื่อให้ข้อมูลเพิ่มเติมและช่วยเหลือคุณในขั้นตอนต่อไป'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* SLA timer — passive, no clickable contact (Sales reaches out) */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Timer className="w-5 h-5 text-rose-500" strokeWidth={2.25} />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-gray-500 mb-0.5">{isAgentReferred ? 'พนักงานจะติดต่อกลับภายใน' : 'Sales จะติดต่อกลับภายใน'}</p>
                  <p className="text-lg font-bold text-chateau">24 ชั่วโมง</p>
                </div>
              </div>
            </div>

            {/* Next steps hint */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                 <strong>ขั้นตอนต่อไป:</strong> {isAgentReferred ? 'พนักงานจะโทร / LINE เพื่อนัดวันเวลาดูยูนิตจริง' : 'Sales จะโทร / LINE เพื่อนัดวันเวลาดูยูนิตจริง — ระบบหา Sales ที่ว่างให้คุณอัตโนมัติ'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setShowInterestConfirm(false)}
              className="w-full bg-chateau hover:bg-chateau-700 text-white"
            >
              ตกลง
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </CustomerLayout>
  );
};

// ─── helpers ───
const fmt = (n?: number | null) => (n ? `${(n / 1_000_000).toFixed(2)} ล้าน` : '-');

const SpecItem = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <div className="flex items-start gap-3">
    <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center text-gray-600 flex-shrink-0">
      <Icon className="w-4 h-4" />
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900 truncate">{value}</p>
    </div>
  </div>
);

const Tag = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs bg-gray-50 text-gray-700 border border-gray-100 px-3 py-1 rounded-full">{children}</span>
);

export default CustomerUnitDetail;
