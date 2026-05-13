import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Building2, Bed, Bath, Square, Layers, MapPin, Heart, Loader2, Sun, ParkingCircle, Check,
  ChevronLeft, ChevronRight, Phone, MessageCircle, Calendar, Calculator, Share2,
  ChevronDown, View, Sparkles, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import CustomerLayout from './CustomerLayout';

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
  const [myInterest, setMyInterest] = useState<{ id: string; status: string; viewing_date: string | null } | null>(null);
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
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [showVisitDialog, setShowVisitDialog] = useState(false);
  const [visitDate, setVisitDate] = useState('');
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
        .select('id, unit_number, area_sqm, bedrooms, bathrooms, price, promo_price, status, thumbnail_url, project_id, tenant_id')
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
              .select('id, status, viewing_date, lead_id').eq('unit_id', id).in('lead_id', leadIds).maybeSingle();
            if (existing) {
              setMyInterest(existing as any);
              const matchingLead = leadList.find((l: any) => l.id === (existing as any).lead_id);
              if (matchingLead) setMyLead({ id: matchingLead.id, status: matchingLead.status, last_contact_date: matchingLead.last_contact_date });
            }
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

  const toggleWishlist = () => {
    if (!unit) return;
    try {
      const wl: string[] = JSON.parse(localStorage.getItem('customer_wishlist') || '[]');
      const next = wl.includes(unit.id) ? wl.filter((x) => x !== unit.id) : [...wl, unit.id];
      localStorage.setItem('customer_wishlist', JSON.stringify(next));
      setIsWishlisted(next.includes(unit.id));
      window.dispatchEvent(new Event('wishlist:changed'));
      toast.success(next.includes(unit.id) ? 'บันทึกในรายการที่ชอบแล้ว' : 'นำออกจากรายการแล้ว');
    } catch { /* ignore */ }
  };

  const handleShare = async () => {
    if (!unit) return;
    const url = `${window.location.origin}/customer/units/${unit.id}`;
    const text = `🏠 ${property?.name || ''} — ยูนิต ${unit.unit_number}\n💰 ${fmt(unit.promo_price || unit.price)}\nดูรายละเอียด: ${url}`;
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
      if (!user) { navigate('/customer/login'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customer } = await (supabase.from('customers') as any)
        .select('id, full_name').eq('auth_user_id', user.id).maybeSingle();
      if (!customer) { toast.error('ไม่พบข้อมูลลูกค้า'); return; }

      // 🔍 Find Sales who handles this unit (unit-level first, then project-level)
      let salesUserId: string | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: unitAssign } = await (supabase.from('sales_unit_assignments') as any)
        .select('sales_user_id').eq('unit_id', unit.id).is('revoked_at', null).limit(1).maybeSingle();
      if (unitAssign?.sales_user_id) {
        salesUserId = unitAssign.sales_user_id;
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: projAssign } = await (supabase.from('sales_project_assignments') as any)
          .select('sales_user_id').eq('project_id', unit.project_id).is('revoked_at', null).limit(1).maybeSingle();
        if (projAssign?.sales_user_id) salesUserId = projAssign.sales_user_id;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: lead } = await (supabase.from('leads') as any)
        .select('id, assigned_to').eq('customer_id', (customer as any).id).eq('tenant_id', unit.tenant_id).maybeSingle();
      if (!lead) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newLead, error: leadErr } = await (supabase.from('leads') as any)
          .insert({
            tenant_id: unit.tenant_id,
            customer_id: (customer as any).id,
            property_id: unit.project_id,
            unit_id: unit.id,
            status: 'new', source: 'customer_self', priority: 'medium',
            assigned_to: salesUserId, // 🆕 Auto-assign if Sales found
            notes: 'ลูกค้ากดสนใจจาก Customer Portal',
          }).select('id, assigned_to').single();
        if (leadErr) throw leadErr;
        lead = newLead;
      } else if (!(lead as any).assigned_to && salesUserId) {
        // Existing lead without Sales — auto-assign now
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('leads') as any).update({ assigned_to: salesUserId }).eq('id', (lead as any).id);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: intErr } = await (supabase.from('lead_interests') as any).insert({
        tenant_id: unit.tenant_id, lead_id: (lead as any).id, property_id: unit.project_id, unit_id: unit.id,
        status: 'interested', interest_level: 'high', notes: 'บันทึกจาก Customer Portal',
      });
      if (intErr) throw intErr;

      // 🔔 Insert activity_log so Sales bell picks it up
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

  const handleScheduleVisit = async () => {
    if (!unit || !visitDate) return;
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/customer/login'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: customer } = await (supabase.from('customers') as any)
        .select('id').eq('auth_user_id', user.id).maybeSingle();
      if (!customer) { toast.error('ไม่พบข้อมูลลูกค้า'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let { data: lead } = await (supabase.from('leads') as any)
        .select('id').eq('customer_id', (customer as any).id).eq('tenant_id', unit.tenant_id).maybeSingle();
      if (!lead) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newLead } = await (supabase.from('leads') as any)
          .insert({
            tenant_id: unit.tenant_id, customer_id: (customer as any).id,
            property_id: unit.project_id, unit_id: unit.id,
            status: 'new', source: 'customer_self', priority: 'high',
            notes: 'ลูกค้าขอนัดดูยูนิต',
          }).select('id').single();
        lead = newLead;
      }
      const isoDate = new Date(visitDate).toISOString();
      if (myInterest) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lead_interests') as any)
          .update({ viewing_date: isoDate, status: 'viewing_scheduled' })
          .eq('id', myInterest.id);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('lead_interests') as any).insert({
          tenant_id: unit.tenant_id, lead_id: (lead as any).id,
          property_id: unit.project_id, unit_id: unit.id,
          status: 'viewing_scheduled', interest_level: 'high', viewing_date: isoDate,
          notes: 'ลูกค้านัดดูยูนิตเอง',
        });
      }
      toast.success('นัดดูยูนิตเรียบร้อย — Sales จะติดต่อยืนยัน');
      setShowVisitDialog(false);
      setVisitDate('');
      await loadAll();
    } catch (err: any) {
      toast.error(err.message || 'นัดดูไม่สำเร็จ');
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

  // Total cost breakdown
  const transferFee = finalPrice * 0.02;
  const mortgageFee = finalPrice * 0.01;
  const miscFee = 10000;
  const totalCost = finalPrice + transferFee + mortgageFee + miscFee;

  const nearbyArr: any[] = Array.isArray(property?.nearby) ? property!.nearby : [];

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
            const hasVisit = !!myInterest.viewing_date;
            const hasReserved = myInterest.status === 'reserved';
            const hasNegotiating = myInterest.status === 'negotiating';
            const hasWon = myInterest.status === 'won';
            // "Sales ติดต่อกลับ" — done only when Sales has actually contacted, not just assigned
            const contactedStatuses = ['contacted', 'qualified', 'negotiating', 'won'];
            const salesContacted = !!myLead?.last_contact_date || contactedStatuses.includes((myLead?.status || '').toLowerCase());

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
                  ? (myLead?.last_contact_date
                      ? `ติดต่อแล้วเมื่อ ${new Date(myLead.last_contact_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}`
                      : 'Sales ติดต่อแล้ว')
                  : assignedSales
                    ? `รอ ${assignedSales.full_name || 'Sales'} โทรกลับ (ภายใน 2 ชม.)`
                    : 'รอ Sales รับงาน',
                done: salesContacted,
              },
              { key: 'visit', label: 'นัดดูยูนิต', sub: hasVisit ? new Date(myInterest.viewing_date!).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'ยังไม่นัด', done: hasVisit },
              { key: 'negotiate', label: 'เจรจา / ตกลง', sub: hasNegotiating ? 'กำลังเจรจา' : hasReserved || hasWon ? 'เรียบร้อย' : 'ขั้นต่อไป', done: hasReserved || hasWon || hasNegotiating },
              { key: 'book', label: 'จองยูนิต', sub: hasWon ? 'ปิดดีลแล้ว' : hasReserved ? 'จองเรียบร้อย' : 'ขั้นต่อไป', done: hasReserved || hasWon },
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
              </div>
            );
          })()}
        </div>
      )}

      {/* === Quick Actions === */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setShowContactDialog(true)}
          className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-chateau hover:bg-rose-50/30 transition-all text-left active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 text-chateau flex items-center justify-center mb-2">
            <MessageCircle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">คุยกับ Sales</p>
          <p className="text-[11px] text-gray-500 mt-0.5">โทร / LINE / Email</p>
        </button>
        <button
          onClick={() => setShowVisitDialog(true)}
          className="bg-white border border-gray-100 rounded-2xl p-4 hover:border-chateau hover:bg-rose-50/30 transition-all text-left active:scale-[0.99]"
        >
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center mb-2">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-gray-900">นัดดูยูนิต</p>
          <p className="text-[11px] text-gray-500 mt-0.5">เลือกวันเวลาที่สะดวก</p>
        </button>
      </div>

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
              {unit.balcony && <Tag>🌬 ระเบียง</Tag>}
              {unit.garden && <Tag>🌳 สวน</Tag>}
              {unit.pool && <Tag>🏊 สระน้ำ</Tag>}
            </div>
          </div>
        )}

        {unit.layout_description && (
          <div className="mt-5 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 mb-2">คำอธิบายการจัดวาง</p>
            <p className="text-sm text-gray-700 leading-relaxed">{unit.layout_description}</p>
          </div>
        )}
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
                          ⭐ แนะนำ
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

            {/* CTA — talk to sales */}
            <button
              onClick={() => setShowContactDialog(true)}
              className="w-full text-xs font-semibold text-chateau hover:underline text-center py-1"
            >
              💬 อยากได้ตัวเลขจริง? คุยกับ Sales เรา →
            </button>
          </div>
        )}
      </div>

      {/* === Total Cost === */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-gray-600" /> สรุปค่าใช้จ่ายโดยประมาณ
        </h2>
        <div className="space-y-2.5">
          <CostRow label="ราคายูนิต" value={finalPrice} />
          <CostRow label="ค่าโอนกรรมสิทธิ์ (2%)" value={transferFee} />
          <CostRow label="ค่าจดจำนอง (1%)" value={mortgageFee} />
          <CostRow label="ค่าธรรมเนียม / อากร" value={miscFee} />
          <div className="pt-3 mt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900">รวมเงินที่ต้องเตรียม</span>
            <span className="text-lg font-bold text-chateau">{fmt(totalCost)}</span>
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-3">* ค่าธรรมเนียมจริงอาจแตกต่างขึ้นกับกรมที่ดิน</p>
      </div>

      {/* === Master Plan (ผังโครงการทั้งหมด) === */}
      {property?.master_plan_url && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-600" /> ผังโครงการ Master Plan
            </h2>
            <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              ภาพรวมทั้งโครงการ
            </span>
          </div>
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <img src={property.master_plan_url} alt="master plan" className="w-full block" />
          </div>
          <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
            🗺️ ดูตำแหน่งของยูนิต {unit.unit_number} ในโครงการ · สิ่งอำนวยความสะดวก · พื้นที่สีเขียว · ทางเข้า-ออก
          </p>
        </div>
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

          {/* Prominent 3D Tour CTA */}
          {unit.tour_3d_url && (
            <a
              href={unit.tour_3d_url}
              target="_blank" rel="noopener noreferrer"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-purple-700 text-white font-semibold text-sm shadow-md shadow-purple-200 hover:shadow-lg hover:scale-[1.01] transition-all"
            >
              <View className="w-5 h-5" />
              เปิดดูแบบเสมือนจริง 3D Tour
              <span className="text-[11px] bg-white/20 px-1.5 py-0.5 rounded">เปิดในแท็บใหม่</span>
            </a>
          )}

          {unit.tour_3d_url && (
            <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
              💡 <strong>3D Tour</strong> ให้คุณ "เดิน" สำรวจบ้านเสมือนจริง 360° — ลากเมาส์หรือไถบนมือถือเพื่อหมุนมุมมอง
            </p>
          )}
        </div>
      )}

      {/* === Location === */}
      {(property?.location_lat && property?.location_lng) || nearbyArr.length > 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-gray-600" /> ทำเล + รอบบริเวณ
          </h2>
          {property?.location_lat && property?.location_lng && (
            <div className="rounded-xl overflow-hidden border border-gray-100 mb-3">
              <iframe
                title="map"
                width="100%" height="220" loading="lazy"
                src={`https://maps.google.com/maps?q=${property.location_lat},${property.location_lng}&z=15&output=embed`}
                style={{ border: 0 }}
              />
            </div>
          )}
          {nearbyArr.length > 0 && (
            <div className="space-y-2">
              {nearbyArr.slice(0, 6).map((n: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-700">{n.icon || '📍'} {n.name || n.label}</span>
                  <span className="text-xs text-gray-500">{n.distance || ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}

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

      {/* === Contact Sales Dialog === */}
      <Dialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-chateau" /> ติดต่อ Sales
            </DialogTitle>
            <DialogDescription>
              {assignedSales ? `Sales ของคุณ: ${assignedSales.full_name || '-'}` : 'ทีม Sales จะติดต่อกลับโดยเร็วที่สุด'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            {assignedSales?.phone && (
              <a href={`tel:${assignedSales.phone}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-chateau hover:bg-rose-50/30 transition-all">
                <div className="w-9 h-9 rounded-full bg-green-50 text-green-600 flex items-center justify-center"><Phone className="w-4 h-4" /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">โทรหา</p>
                  <p className="text-sm font-semibold text-gray-900">{assignedSales.phone}</p>
                </div>
              </a>
            )}
            <button
              onClick={() => { toast.info('LINE Integration เร็วๆ นี้'); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-chateau hover:bg-rose-50/30 transition-all"
            >
              <div className="w-9 h-9 rounded-full bg-[#06C755]/10 text-[#06C755] flex items-center justify-center font-bold">L</div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-gray-500">LINE Chat</p>
                <p className="text-sm font-semibold text-gray-900">เริ่มแชทกับ Sales</p>
              </div>
            </button>
            {assignedSales?.email && (
              <a href={`mailto:${assignedSales.email}`} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-chateau hover:bg-rose-50/30 transition-all">
                <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">@</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">ส่งอีเมล</p>
                  <p className="text-sm font-semibold text-gray-900 truncate">{assignedSales.email}</p>
                </div>
              </a>
            )}
            {!assignedSales && (
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-xs text-amber-900">ยังไม่ได้รับมอบหมาย Sales — กด "สนใจยูนิตนี้" เพื่อให้ระบบจัดสรร Sales ให้คุณ</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowContactDialog(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            {/* SLA timer */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50/50 border border-rose-100 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Phone className="w-5 h-5 text-chateau" />
                </div>
                <div className="flex-1">
                  <p className="text-[11px] text-gray-500 mb-0.5">Sales จะติดต่อกลับภายใน</p>
                  <p className="text-lg font-bold text-chateau">2 ชั่วโมงทำการ</p>
                </div>
              </div>
            </div>

            {/* Quick contact (if Sales already assigned) */}
            {assignedSales && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-500 mb-2 font-medium">หรือคุยกับ Sales ของคุณตอนนี้</p>
                <div className="flex gap-2">
                  {assignedSales.phone && (
                    <a href={`tel:${assignedSales.phone}`} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-green-50 text-green-700 hover:bg-green-100 font-semibold text-xs transition-colors">
                      <Phone className="w-4 h-4" /> โทร
                    </a>
                  )}
                  <button
                    onClick={() => toast.info('LINE Integration เร็วๆ นี้')}
                    className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20 font-semibold text-xs transition-colors"
                  >
                    <span className="font-bold">L</span> LINE
                  </button>
                  {assignedSales.email && (
                    <a href={`mailto:${assignedSales.email}`} className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold text-xs transition-colors">
                      <MessageCircle className="w-4 h-4" /> Email
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Next steps hint */}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] text-gray-600 leading-relaxed">
                💡 <strong>ขั้นตอนต่อไป:</strong> ลูกค้าสามารถนัดดูยูนิตเอง หรือรอ Sales ติดต่อกลับ — ดูสถานะคำขอได้จากบนหน้านี้
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowInterestConfirm(false)}
              className="flex-1"
            >
              ตกลง
            </Button>
            <Button
              onClick={() => { setShowInterestConfirm(false); setShowVisitDialog(true); }}
              className="flex-1 bg-chateau hover:bg-chateau-700 text-white"
            >
              <Calendar className="w-4 h-4 mr-1.5" /> นัดดูยูนิตเลย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === Schedule Visit Dialog === */}
      <Dialog open={showVisitDialog} onOpenChange={setShowVisitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-600" /> นัดดูยูนิต
            </DialogTitle>
            <DialogDescription>
              เลือกวันและเวลาที่สะดวก — Sales จะติดต่อกลับเพื่อยืนยัน
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5">วันและเวลาที่สะดวก</Label>
              <Input
                type="datetime-local"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <p className="text-xs text-blue-900">
                📍 {property?.name} · ยูนิต {unit.unit_number}<br />
                🕐 Sales จะติดต่อยืนยันภายใน 24 ชม.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVisitDialog(false)} disabled={submitting}>ยกเลิก</Button>
            <Button
              onClick={handleScheduleVisit}
              disabled={!visitDate || submitting}
              className="bg-chateau hover:bg-chateau-700 text-white"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              ยืนยันนัด
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

const CostRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-gray-600">{label}</span>
    <span className="font-semibold text-gray-900">฿{Math.round(value).toLocaleString()}</span>
  </div>
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
