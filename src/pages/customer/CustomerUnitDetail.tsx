import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Bed, Bath, Square, Layers, MapPin, Heart, Loader2, Sun, ParkingCircle, Check,
  ChevronLeft, ChevronRight, Calendar, Calculator, Share2,
  ChevronDown, View, Sparkles, XCircle, FileDown,
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
  const navigate = useNavigate();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [myInterest, setMyInterest] = useState<{ id: string; status: string; viewing_date: string | null; created_at: string | null } | null>(null);
  const [myBooking, setMyBooking] = useState<{ id: string; status: string; total_amount: number; deposit_amount: number | null } | null>(null);
  const [myLead, setMyLead] = useState<{ id: string; status: string | null; last_contact_date: string | null } | null>(null);
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
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id').eq('auth_user_id', user.id).maybeSingle();
        if (customer) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: leads } = await (supabase.from('leads') as any)
            .select('id, assigned_to, status, last_contact_date').eq('customer_id', (customer as any).id);
          const leadList = (leads || []) as any[];
          const leadIds = leadList.map((l: any) => l.id);

          // Check existing interest + lead
          if (leadIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: existing } = await (supabase.from('lead_interests') as any)
              .select('id, status, viewing_date, lead_id, created_at')
              .eq('unit_id', id)
              .in('lead_id', leadIds)
              .not('status', 'in', '("dropped","lost")')
              .maybeSingle();
            if (existing) {
              setMyInterest(existing as any);
              const matchingLead = leadList.find((l: any) => l.id === (existing as any).lead_id);
              if (matchingLead) setMyLead({ id: matchingLead.id, status: matchingLead.status, last_contact_date: matchingLead.last_contact_date });
            }
          }

          // Booking row for THIS unit + customer — drives step 6 (จองยูนิต) state
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: bookings } = await (supabase.from('bookings') as any)
            .select('id, status, total_amount, notes')
            .eq('customer_id', (customer as any).id)
            .neq('status', 'cancelled')
            .order('created_at', { ascending: false });
          const matchingBooking = ((bookings || []) as any[]).find((b) => (b.notes?.unit_id) === id);
          setMyBooking(matchingBooking
            ? {
                id: matchingBooking.id,
                status: matchingBooking.status,
                total_amount: Number(matchingBooking.total_amount || 0),
                deposit_amount: matchingBooking.notes?.deposit_amount != null ? Number(matchingBooking.notes.deposit_amount) : null,
              }
            : null);

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customer } = await (supabase.from('customers') as any)
        .select('id, full_name').eq('auth_user_id', user.id).maybeSingle();
      if (!customer) { toast.error('ไม่พบข้อมูลลูกค้า'); return; }

      //  Find Sales — Workload-balanced routing (industry-standard for Thai real estate)
      //
      // Priority order:
      //  (1) Sales explicitly assigned to THIS unit (sales_unit_assignments) — highest priority,
      //      override balancing because the unit was specifically pre-allocated to that Sales.
      //  (2) Among Sales managing the project (sales_project_assignments), pick the one with
      //      the FEWEST active open leads. This balances workload fairly across the team.
      //      Tie-breaker: oldest last-assignment time → round-robin behaviour for equal load.
      //  (3) No Sales at all → assigned_to = null → goes to "pool" for Admin to assign manually.
      let salesUserId: string | null = null;
      let routingReason: string = 'pool';

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: agentRow } = await (supabase.from('users') as any)
          .select('id, role, tenant_id')
          .eq('referral_code', storedRef)
          .eq('role', 'agent')
          .maybeSingle();
        // Only attribute when the agent belongs to the same tenant as the unit —
        // prevents cross-tenant credit leakage.
        if (agentRow && (agentRow as any).tenant_id === unit.tenant_id) {
          referredByAgentId = (agentRow as any).id;
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: lead } = await (supabase.from('leads') as any)
        .select('id, assigned_to, referred_by_agent_id').eq('customer_id', (customer as any).id).eq('tenant_id', unit.tenant_id).maybeSingle();
      if (!lead) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newLead, error: leadErr } = await (supabase.from('leads') as any)
          .insert({
            tenant_id: unit.tenant_id,
            customer_id: (customer as any).id,
            property_id: unit.project_id,
            unit_id: unit.id,
            status: 'new', source: referredByAgentId ? 'agent_referral' : 'customer_self', priority: 'medium',
            assigned_to: salesUserId, // Auto-assign if Sales found
            referred_by_agent_id: referredByAgentId,
            notes: referredByAgentId
              ? 'ลูกค้ากดสนใจจาก Customer Portal (referral)'
              : 'ลูกค้ากดสนใจจาก Customer Portal',
          }).select('id, assigned_to, referred_by_agent_id').single();
        if (leadErr) throw leadErr;
        lead = newLead;
        // Consume the session token once the attribution is locked in DB, so a
        // subsequent visit doesn't double-attribute or surprise the customer.
        if (referredByAgentId) clearStoredReferralCode();
      } else if (!(lead as any).assigned_to && salesUserId) {
        // Existing lead without Sales — auto-assign now (does NOT touch referred_by_agent_id;
        // immutability trigger would reject it anyway).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any).update({ assigned_to: salesUserId }).eq('id', (lead as any).id);
      }

      // Reuse a previously cancelled interest row if it exists (preserve audit trail / created_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: previousInterest } = await (supabase.from('lead_interests') as any)
        .select('id, status')
        .eq('lead_id', (lead as any).id)
        .eq('unit_id', unit.id)
        .maybeSingle();
      if (previousInterest) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: reErr } = await (supabase.from('lead_interests') as any)
          .update({ status: 'interested', interest_level: 'high', notes: 'ลูกค้ากดสนใจอีกครั้งจาก Customer Portal' })
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

      // Insert activity_log so Sales bell picks it up (+ audit trail for routing decision)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('activity_logs') as any).insert({
        tenant_id: unit.tenant_id,
        user_id: salesUserId, // attribute to the assigned Sales (or null if pool)
        activity_type: 'interest_added',
        description: `ลูกค้า${(customer as any).full_name || ''} สนใจยูนิต ${unit.unit_number}`,
        metadata: {
          lead_id: (lead as any).id,
          unit_id: unit.id,
          unit_number: unit.unit_number,
          customer_name: (customer as any).full_name,
          source: 'customer_portal',
          routing_reason: routingReason,
          assigned_to: salesUserId,
        },
      });

      await loadAll();
      setShowInterestConfirm(true);
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelInterest = async () => {
    if (!unit || !myInterest) return;
    if (!confirm('ยืนยันยกเลิกความสนใจในยูนิตนี้?\nคุณจะสามารถกด "ฉันสนใจ" ใหม่ได้ทุกเมื่อ')) return;
    setSubmitting(true);
    try {
      // 'dropped' is the closest enum value for "customer cancelled" (lead_interests_status_check)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('lead_interests') as any)
        .update({ status: 'dropped', notes: 'ลูกค้ายกเลิกจาก Customer Portal' })
        .eq('id', myInterest.id);
      if (error) throw error;

      // Notify Sales via activity_log
      try {
        const { data: { user } } = await supabase.auth.getUser();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id, full_name').eq('auth_user_id', user?.id).maybeSingle();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('activity_logs') as any).insert({
          tenant_id: unit.tenant_id,
          user_id: assignedSales?.id || null,
          activity_type: 'interest_cancelled',
          description: `ลูกค้า${(customer as any)?.full_name || ''} ยกเลิกความสนใจยูนิต ${unit.unit_number}`,
          metadata: {
            lead_id: myLead?.id,
            unit_id: unit.id,
            unit_number: unit.unit_number,
            customer_name: (customer as any)?.full_name,
            source: 'customer_portal',
          },
        });
      } catch { /* non-blocking */ }

      toast.success('ยกเลิกความสนใจเรียบร้อย');
      setMyInterest(null);
    } catch (err: any) {
      toast.error(err.message || 'ยกเลิกไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <CustomerLayout title="กำลังโหลด..." showBack>
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      </CustomerLayout>
    );
  }
  if (!unit) return null;

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
              {/* Show interest badge if customer has expressed interest */}
              {myInterest && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-chateau bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full mt-1.5">
                  <Heart className="w-3 h-3 fill-current" /> บันทึกสนใจแล้ว · Sales รับเรื่อง
                </span>
              )}
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

      {/* === Status Timeline (when interest exists — placed FIRST for context) === */}
      {myInterest && (
        <div className="bg-gradient-to-br from-rose-50/40 to-white border border-rose-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-chateau" /> สถานะคำขอของคุณ
          </h2>
          {(() => {
            // Step "นัดดูยูนิต" = customer has either booked a date OR already progressed past it.
            // Lead funnel goes: viewing_scheduled → viewed → negotiating → reserved → won.
            // Reaching any of viewed+ means the visit already happened, even if no explicit date row exists
            // (e.g. walk-in customer that Sales moved straight to negotiating).
            const advancedPastVisit = ['viewed', 'negotiating', 'reserved', 'won'].includes(myInterest.status);
            const hasVisit = !!myInterest.viewing_date || advancedPastVisit;
            // Treat unit-level reservation/sale for this customer's lead as a positive signal
            const unitReservedForMyLead = !!(myLead?.id && unit.reserved_customer_lead_id === myLead.id);
            const hasReserved = myInterest.status === 'reserved' || (unitReservedForMyLead && unit.status === 'reserved');
            const hasNegotiating = myInterest.status === 'negotiating';
            const hasWon = myInterest.status === 'won' || (unitReservedForMyLead && unit.status === 'sold');

            // "Sales ติดต่อกลับ" — true only when Sales actually contacted ABOUT THIS UNIT (not just any prior unit).
            // A single lead is shared across many lead_interests, so lead.last_contact_date alone is ambiguous.
            // Real signals that Sales engaged with THIS interest:
            //  1. This interest's status has advanced beyond the initial "interested"
            //  2. lead.last_contact_date was set AFTER this interest was created
            //  3. Sales has reserved/sold this exact unit for this lead
            const advancedInterestStates = ['contacted', 'qualified', 'negotiating', 'reserved', 'won'];
            const interestProgressed = advancedInterestStates.includes((myInterest?.status || '').toLowerCase());
            const contactAfterInterest = !!(
              myLead?.last_contact_date &&
              myInterest?.created_at &&
              new Date(myLead.last_contact_date) > new Date(myInterest.created_at)
            );
            const salesContacted = interestProgressed || contactAfterInterest || unitReservedForMyLead;

            // Booking-driven states (the timeline's source of truth for steps 6+7):
            // pending  → Sales locked unit, customer hasn't paid deposit yet (active step "จองยูนิต")
            // confirmed → customer paid deposit (step "จองยูนิต" done, "ทำสัญญา / โอน" active)
            // checked_in/out → contract signed + transfer done (step "ทำสัญญา / โอน" done)
            const bookingStatus = myBooking?.status || null;
            const depositPaid = bookingStatus === 'confirmed' || bookingStatus === 'checked_in' || bookingStatus === 'checked_out';
            const titleTransferred = bookingStatus === 'checked_in' || bookingStatus === 'checked_out' || hasWon || (unitReservedForMyLead && unit.status === 'sold');

            const steps = [
              { key: 'submit', label: 'ส่งคำขอ', sub: 'ระบบบันทึกเรียบร้อย', done: true },
              {
                key: 'assigned',
                label: 'ระบบมอบหมาย Sales',
                sub: !assignedSales ? 'รอจัดสรร Sales' : `${assignedSales.full_name || 'Sales'} ได้รับงาน`,
                done: !!assignedSales,
              },
              {
                key: 'contacted',
                label: 'Sales ติดต่อกลับ',
                sub: salesContacted
                  ? (contactAfterInterest && myLead?.last_contact_date
                      ? `ติดต่อแล้วเมื่อ ${new Date(myLead.last_contact_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                      : 'Sales ติดต่อแล้ว')
                  : assignedSales
                    ? `รอ ${assignedSales.full_name || 'Sales'} โทรกลับ (ภายใน 2 ชม.)`
                    : 'รอ Sales รับงาน',
                done: salesContacted,
              },
              {
                key: 'visit',
                label: 'นัดดูยูนิต',
                sub: myInterest.viewing_date
                  ? new Date(myInterest.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                  : advancedPastVisit ? 'ดูเรียบร้อย' : 'ยังไม่นัด',
                done: hasVisit,
              },
              {
                key: 'negotiate',
                label: 'เจรจา',
                sub: hasReserved || hasWon ? 'เจรจาเรียบร้อย' : hasNegotiating ? 'กำลังเจรจา' : 'ขั้นต่อไป',
                done: hasReserved || hasWon || hasNegotiating,
              },
              {
                key: 'deposit',
                label: 'ชำระมัดจำ',
                sub: depositPaid
                  ? '✓ ชำระแล้ว'
                  : bookingStatus === 'pending'
                    ? ` รอชำระมัดจำ${myBooking?.deposit_amount ? ` ${(myBooking.deposit_amount / 1_000).toLocaleString('th-TH')}K` : ''}`
                    : 'ขั้นต่อไป',
                done: depositPaid,
              },
              {
                key: 'transfer',
                label: 'ทำสัญญา / โอนกรรมสิทธิ์',
                sub: titleTransferred ? 'โอนเรียบร้อย' : depositPaid ? 'รอทำสัญญา' : 'ขั้นต่อไป',
                done: titleTransferred,
              },
            ];
            const activeIdx = steps.findIndex((s) => !s.done);
            const currentActive = activeIdx === -1 ? steps.length - 1 : activeIdx;

            return (
              <div className="space-y-3">
                {steps.map((s, i) => {
                  const isCurrent = i === currentActive && !s.done;
                  const isDone = s.done;
                  return (
                    <div key={s.key} className="flex items-start gap-3 relative">
                      {i < steps.length - 1 && (
                        <div className={`absolute left-[15px] top-8 w-0.5 h-[calc(100%+0.25rem)] ${isDone ? 'bg-chateau' : 'bg-gray-200'}`} />
                      )}
                      <div className={`relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
                        isDone ? 'bg-chateau text-white' :
                        isCurrent ? 'bg-white border-2 border-chateau text-chateau animate-pulse' :
                        'bg-gray-100 text-gray-400'
                      }`}>
                        {isDone ? (
                          <Check className="w-4 h-4" strokeWidth={3} />
                        ) : isCurrent ? (
                          <div className="w-2 h-2 rounded-full bg-chateau" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-gray-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 pb-3">
                        <p className={`text-sm font-semibold ${isDone || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                          {s.label}
                        </p>
                        <p className={`text-xs mt-0.5 ${isCurrent ? 'text-chateau font-medium' : isDone ? 'text-gray-600' : 'text-gray-400'}`}>
                          {s.sub}
                          {isCurrent && ' · กำลังดำเนินการ'}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {!assignedSales && (
                  <div className="mt-2 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 leading-relaxed">
                      <strong>SLA:</strong> Sales จะติดต่อกลับภายใน 2 ชั่วโมงทำการ — ใช้ปุ่มด้านล่างเพื่อคุย Sales ตอนนี้
                    </p>
                  </div>
                )}
                {/* Cancel interest — only allowed before reservation/sale */}
                {!hasReserved && !hasWon && (
                  <div className="mt-4 pt-4 border-t border-rose-100/60 flex justify-center">
                    <button
                      onClick={handleCancelInterest}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-rose-700 bg-white border border-rose-300 rounded-full hover:bg-rose-50 hover:border-rose-400 active:scale-[0.98] transition-all disabled:opacity-40"
                    >
                      <XCircle className="w-4 h-4" />
                      ยกเลิกความสนใจในยูนิตนี้
                    </button>
                  </div>
                )}
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
               Sales จะคำนวณตัวเลขจริงให้เมื่อนัดดูยูนิต
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
      {similarUnits.length > 0 && (
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

      {/* === FAQ === */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" /> คำถามที่พบบ่อย
        </h2>
        <div className="space-y-1">
          <FAQ q="ค่าส่วนกลางเดือนละเท่าไหร่?" a="ค่าส่วนกลางอยู่ที่ประมาณ 30-50 บาท/ตร.ม./เดือน ขึ้นกับขนาดยูนิต — Sales จะแจ้งราคาแน่นอนเมื่อจอง" />
          <FAQ q="นำสัตว์เลี้ยงมาได้ไหม?" a="ขึ้นกับนโยบายโครงการ บางโครงการอนุญาตสุนัข/แมวขนาดเล็ก — ติดต่อ Sales เพื่อสอบถามเฉพาะโครงการ" />
          <FAQ q="WiFi / Fiber Internet?" a="พร้อมรองรับ Fiber Internet ทุกผู้ให้บริการ (AIS / TRUE / 3BB) — สมัครได้ที่นิติบุคคล" />
          <FAQ q="ระบบรักษาความปลอดภัย?" a="CCTV 24 ชม. · รปภ. ตลอด 24 ชม. · Key card / Tag entry · Smart Lock (เฉพาะบางยูนิต)" />
          <FAQ q="ใช้บ้านเป็นออฟฟิศได้ไหม?" a="ขึ้นกับนโยบายโครงการและกฎหมาย — สามารถใช้เป็น Home Office ขนาดเล็กได้ในกรณีไม่กระทบผู้พักอาศัยอื่น" />
        </div>
      </div>

      {/* === Sticky CTA — show only when actionable === */}
      {!myInterest && unit.status === 'available' && (
        <div className="sticky bottom-20 z-10 -mx-5 px-5 pt-3 bg-gradient-to-t from-white via-white">
          <Button
            onClick={handleExpressInterest}
            disabled={submitting}
            className="w-full h-12 text-sm font-semibold bg-chateau hover:bg-chateau-700 text-white shadow-md shadow-chateau/20"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Heart className="w-4 h-4 mr-2" /> สนใจยูนิตนี้ — ให้ Sales ติดต่อกลับ</>
            )}
          </Button>
        </div>
      )}

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
              ทีม Sales จะติดต่อกลับเพื่อให้ข้อมูลเพิ่มเติมและช่วยเหลือคุณในขั้นตอนต่อไป
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {/* SLA timer — passive, no clickable contact (Sales reaches out) */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm text-2xl">
                  ⏱️
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-gray-500 mb-0.5">Sales จะติดต่อกลับภายใน</p>
                  <p className="text-lg font-bold text-chateau">24 ชั่วโมง</p>
                </div>
              </div>
            </div>

            {/* Next steps hint */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                 <strong>ขั้นตอนต่อไป:</strong> Sales จะโทร / LINE เพื่อนัดวันเวลาดูยูนิตจริง — ระบบหา Sales ที่ว่างให้คุณอัตโนมัติ
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

const FAQ = ({ q, a }: { q: string; a: string }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full py-3 flex items-start justify-between gap-3 text-left hover:bg-gray-50/50 rounded-lg px-2 -mx-2 transition-colors">
        <span className="text-sm font-medium text-gray-900">{q}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <p className="text-xs text-gray-600 leading-relaxed pb-3 px-2">{a}</p>}
    </div>
  );
};

export default CustomerUnitDetail;
