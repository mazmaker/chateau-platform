import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Heart, Calendar, ArrowRight, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import CustomerLayout from './CustomerLayout';

interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface InterestRow {
  id: string;
  unit_id: string;
  property_id: string;
  status: string;
  interest_level: string;
  viewing_date: string | null;
  property?: { id: string; name: string };
  unit?: { id: string; unit_number: string; price?: number; status?: string; thumbnail_url?: string | null };
}

interface WishlistUnit {
  id: string;
  unit_number: string;
  price?: number | null;
  promo_price?: number | null;
  status?: string;
  thumbnail_url?: string | null;
  area_sqm?: number | null;
  bedrooms?: number | null;
  property?: { id: string; name: string };
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [, setProfile] = useState<CustomerProfile | null>(null);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [wishlist, setWishlist] = useState<WishlistUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWishlist = async () => {
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('customer_wishlist') || '[]');
      if (ids.length === 0) { setWishlist([]); return; }

      // Fetch units (no auto-join because units.project_id FK points to legacy 'projects' table, not 'properties')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: units, error: unitErr } = await (supabase.from('units') as any)
        .select('id, unit_number, price, promo_price, status, thumbnail_url, area_sqm, bedrooms, project_id')
        .in('id', ids);
      if (unitErr) { console.error('loadWishlist units error:', unitErr); setWishlist([]); return; }
      const unitList = (units as any[]) || [];

      // Manually fetch + merge properties
      const projectIds = Array.from(new Set(unitList.map((u: any) => u.project_id).filter(Boolean)));
      const propsMap = new Map<string, { id: string; name: string }>();
      if (projectIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: props } = await (supabase.from('properties') as any)
          .select('id, name').in('id', projectIds);
        ((props as any[]) || []).forEach((p: any) => propsMap.set(p.id, { id: p.id, name: p.name }));
      }
      const merged = unitList.map((u: any) => ({ ...u, property: propsMap.get(u.project_id) || null }));
      setWishlist(merged as WishlistUnit[]);
    } catch (e) { console.error('loadWishlist error:', e); }
  };

  const removeFromWishlist = (e: React.MouseEvent, unitId: string) => {
    e.stopPropagation();
    try {
      const ids: string[] = JSON.parse(localStorage.getItem('customer_wishlist') || '[]');
      const next = ids.filter((x) => x !== unitId);
      localStorage.setItem('customer_wishlist', JSON.stringify(next));
      setWishlist((prev) => prev.filter((u) => u.id !== unitId));
      window.dispatchEvent(new Event('wishlist:changed'));
    } catch { /* ignore */ }
  };

  // Re-load wishlist when user returns to this page (back button, tab focus, or wishlist change in another component)
  useEffect(() => {
    const refresh = () => { loadWishlist(); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('wishlist:changed', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('wishlist:changed', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/customer/login', { replace: true });
          return;
        }
        const { data: customer } = await supabase
          .from('customers').select('id, full_name, email, phone').eq('auth_user_id', user.id).maybeSingle();
        if (!customer) {
          toast.error('ไม่พบข้อมูลลูกค้า');
          await supabase.auth.signOut();
          navigate('/customer/login', { replace: true });
          return;
        }
        setProfile(customer as CustomerProfile);

        const { data: leads } = await supabase.from('leads').select('id').eq('customer_id', customer.id);
        const leadIds = (leads || []).map((l: any) => l.id);
        if (leadIds.length > 0) {
          const { data: intRows } = await supabase
            .from('lead_interests')
            .select('id, unit_id, property_id, status, interest_level, viewing_date, property:properties(id, name), unit:units(id, unit_number, price, status, thumbnail_url)')
            .in('lead_id', leadIds)
            .not('status', 'in', '("dropped","lost")')
            .order('created_at', { ascending: false });
          setInterests((intRows || []) as any);
        }

        // Load wishlist (localStorage-based)
        await loadWishlist();
      } catch (err) {
        console.error('Customer dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const fmt = (n?: number) => (n ? `${(n / 1_000_000).toFixed(2)} ล้าน` : '-');
  const upcomingVisits = interests.filter((i) => i.viewing_date && new Date(i.viewing_date) > new Date());

  const statusBadge = (s?: string) => {
    if (s === 'interested') return { label: 'สนใจ', color: 'text-rose-600 bg-rose-50' };
    if (s === 'viewing_scheduled') return { label: 'นัดดูแล้ว', color: 'text-amber-700 bg-amber-50' };
    if (s === 'viewed') return { label: 'ดูแล้ว', color: 'text-blue-700 bg-blue-50' };
    if (s === 'negotiating') return { label: 'กำลังเจรจา', color: 'text-amber-700 bg-amber-50' };
    if (s === 'reserved') return { label: 'จองแล้ว', color: 'text-green-700 bg-green-50' };
    return { label: s || '—', color: 'text-gray-600 bg-gray-100' };
  };

  // Next visit = most urgent thing to show
  const nextVisit = upcomingVisits[0] || null;
  const nextVisitDate = nextVisit?.viewing_date ? new Date(nextVisit.viewing_date) : null;
  const visitDiffDays = nextVisitDate ? Math.ceil((nextVisitDate.getTime() - Date.now()) / 86400000) : 0;
  const visitIsToday = nextVisitDate?.toDateString() === new Date().toDateString();

  return (
    <CustomerLayout>
      {loading ? (
        <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
      ) : (
        <>
          {/* === 1. URGENT HERO: Next Visit (if exists) === */}
          {nextVisit && nextVisitDate ? (
            <section
              onClick={() => navigate(`/customer/units/${nextVisit.unit_id}`)}
              className="relative bg-gradient-to-br from-amber-50 via-orange-50/50 to-rose-50/30 border border-amber-200 rounded-2xl p-5 cursor-pointer hover:shadow-md hover:border-amber-300 transition-all overflow-hidden group"
            >
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-100/40 rounded-full blur-2xl" />
              <div className="relative flex items-start gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-200">
                  <Calendar className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      {visitIsToday ? '⏰ นัดดูวันนี้' : visitDiffDays === 1 ? '⏰ นัดดูพรุ่งนี้' : `📅 อีก ${visitDiffDays} วัน`}
                    </p>
                  </div>
                  <h2 className="text-base font-bold text-gray-900 truncate">
                    ยูนิต {nextVisit.unit?.unit_number || '—'} · {nextVisit.property?.name || ''}
                  </h2>
                  <p className="text-xs text-gray-700 mt-1 font-medium">
                    {nextVisitDate.toLocaleString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <ArrowRight className="w-5 h-5 text-amber-700 flex-shrink-0 mt-2 group-hover:translate-x-0.5 transition-transform" />
              </div>
              {upcomingVisits.length > 1 && (
                <p className="text-[11px] text-amber-700 mt-3 pl-15">+ อีก {upcomingVisits.length - 1} นัด</p>
              )}
            </section>
          ) : (
            // Welcome card (no upcoming visit) — concise, actionable
            <section className="bg-gradient-to-br from-rose-50/40 to-white border border-gray-100 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-rose-100 text-chateau flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-gray-900">เริ่มต้นค้นหาบ้านในฝัน</p>
                  <p className="text-xs text-gray-500 mt-1">บันทึกยูนิตที่ชอบ ฝากเบอร์ให้ Sales ติดต่อ</p>
                </div>
              </div>
            </section>
          )}

          {/* === 2. STATS: 2 cards (Wishlist + Interest) === */}
          <section className="grid grid-cols-2 gap-3">
            <StatCard
              icon={Heart}
              label="บันทึกไว้"
              value={wishlist.length}
              iconColor="text-chateau"
              bgColor="bg-rose-50"
              subtitle={wishlist.length === 0 ? 'กดหัวใจบนยูนิต' : 'ยูนิตที่ฉันชอบ'}
            />
            <StatCard
              icon={Sparkles}
              label="สนใจ"
              value={interests.length}
              iconColor="text-amber-700"
              bgColor="bg-amber-50"
              subtitle={interests.length === 0 ? 'ยังไม่มีรายการ' : `${upcomingVisits.length} นัดดู`}
            />
          </section>

          {/* My Wishlist (saved with heart button) */}
          {wishlist.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Heart className="w-4 h-4 fill-current text-chateau" /> ยูนิตที่บันทึกไว้
                </h2>
                <span className="text-xs text-gray-400">{wishlist.length} รายการ</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {wishlist.map((u) => {
                  const isPromo = u.promo_price && u.price && u.promo_price < u.price;
                  return (
                    <div
                      key={u.id}
                      onClick={() => navigate(`/customer/units/${u.id}`)}
                      className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                    >
                      {/* Remove button */}
                      <button
                        onClick={(e) => removeFromWishlist(e, u.id)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 backdrop-blur shadow-sm flex items-center justify-center text-gray-500 hover:text-chateau hover:scale-110 transition-all z-10"
                        title="นำออก"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="aspect-[4/3] bg-gray-100">
                        {u.thumbnail_url ? (
                          <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-semibold text-gray-900">ยูนิต {u.unit_number}</p>
                        <p className="text-[11px] text-gray-500 truncate">{u.property?.name}</p>
                        <p className="text-[10px] text-gray-500 mt-1">
                          {u.bedrooms != null && `${u.bedrooms} นอน · `}
                          {u.area_sqm && `${u.area_sqm} ตร.ม.`}
                        </p>
                        <p className="text-sm font-bold text-chateau mt-1">
                          {fmt((isPromo ? u.promo_price : u.price) || undefined)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* === 4. My Interests === */}
          {interests.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600" /> ยูนิตที่ฉันสนใจ
                </h2>
                <span className="text-xs text-gray-400">{interests.length} รายการ</span>
              </div>

              <div className="space-y-2.5">
                {interests.map((i) => {
                  const badge = statusBadge(i.status);
                  return (
                    <button
                      key={i.id}
                      onClick={() => navigate(`/customer/units/${i.unit_id}`)}
                      className="w-full bg-white border border-gray-100 rounded-2xl p-3 hover:border-gray-200 hover:shadow-sm transition-all text-left flex items-center gap-3 active:scale-[0.99]"
                    >
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                        {i.unit?.thumbnail_url ? (
                          <img src={i.unit.thumbnail_url} alt={i.unit.unit_number} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-0.5">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {i.unit?.unit_number || '—'}
                          </p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${badge.color}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate">{i.property?.name || '—'}</p>
                        <p className="text-sm font-semibold text-gray-900 mt-1">{fmt(i.unit?.price)}</p>
                        {i.viewing_date && (
                          <p className="text-[11px] text-amber-700 mt-0.5">
                            📅 {new Date(i.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state — if absolutely no engagement (encourages first visit) */}
          {interests.length === 0 && wishlist.length === 0 && (
            <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-10 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-700 font-medium mb-1">ยังไม่มีรายการที่ดูแล</p>
              <p className="text-xs text-gray-500 mb-4">เริ่มจากเข้าไปดูโครงการ — กดหัวใจหรือ "สนใจ" ได้เลย</p>
              <Button
                onClick={() => navigate('/customer/properties')}
                className="bg-chateau hover:bg-chateau-700 text-white"
                size="sm"
              >
                เริ่มต้น <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          )}
        </>
      )}
    </CustomerLayout>
  );
};

const StatCard = ({ icon: Icon, label, value, iconColor, bgColor, subtitle }: {
  icon: any; label: string; value: number; iconColor: string; bgColor: string; subtitle?: string;
}) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-4">
    <div className="flex items-center justify-between mb-2">
      <div className={`w-9 h-9 rounded-xl ${bgColor} ${iconColor} flex items-center justify-center`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
    <p className="text-sm font-semibold text-gray-900">{label}</p>
    {subtitle && <p className="text-[11px] text-gray-500 mt-0.5">{subtitle}</p>}
  </div>
);

export default CustomerDashboard;
