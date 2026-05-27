import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Heart, Calendar, ArrowRight, X, Sparkles, ChevronRight, Search, Eye, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { addToWishlist, removeFromWishlist as removeFromWishlistDb } from '@/lib/customerWishlist';
import { getOrCreateVisitorId } from '@/lib/viewTracking';
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
  // Engagement state derived from lead_interests (badge on card)
  engagement?: {
    status: string;          // interested / viewing_scheduled / negotiating / reserved / won
    interest_level: string;  // low/medium = passive bookmark; high = active "ฉันสนใจ"
    viewing_date: string | null;
  };
  tenant_id?: string;
  project_id?: string;
}

const CustomerDashboard = () => {
  const navigate = useNavigate();
  const [, setProfile] = useState<CustomerProfile | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [isAnon, setIsAnon] = useState<boolean>(false);
  const [interests, setInterests] = useState<InterestRow[]>([]);
  const [wishlist, setWishlist] = useState<WishlistUnit[]>([]);
  // Anon-only: featured projects + recently-viewed units (from property_views tracking).
  const [featuredProperties, setFeaturedProperties] = useState<Array<{ id: string; name: string; thumbnail_url: string | null; base_price: number | null }>>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Array<{ id: string; unit_number: string; price: number | null; thumbnail_url: string | null; property_name: string }>>([]);
  const [loading, setLoading] = useState(true);

  // Loads the unified "saved units" list — pulls from BOTH localStorage AND lead_interests (DB).
  // Dedupes by unit_id. If a unit is in localStorage but missing in DB → silently syncs it (one-time migration).
  const loadWishlist = async (customerId?: string) => {
    try {
      const localIds: string[] = JSON.parse(localStorage.getItem('customer_wishlist') || '[]');

      // Load all "active" lead_interests for this customer (DB source of truth)
      const dbInterestMap = new Map<string, { status: string; interest_level: string; viewing_date: string | null; tenant_id: string; project_id: string }>();
      // Track ALL unit_ids the customer has interest rows on (including dropped/lost) so
      // we can detect "Sales dropped this — customer's localStorage is stale" and clean
      // it up. Without this, dropped units kept reappearing in "บันทึกไว้ดูทีหลัง"
      // because allIds = localIds ∪ activeIds; the dropped row was invisible to the merge.
      const droppedUnitIds = new Set<string>();
      // Also load active bookings so the engagement badge reflects payment progress —
      // booking.status is the only signal that deposit was actually paid (lead_interest stays at 'reserved' even after).
      const bookingByUnit = new Map<string, { status: string }>();
      if (customerId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leads } = await (supabase.from('leads') as any).select('id').eq('customer_id', customerId);
        const leadIds = ((leads as any[]) || []).map((l: any) => l.id);
        if (leadIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: dbInterests } = await (supabase.from('lead_interests') as any)
            .select('unit_id, status, interest_level, viewing_date, tenant_id, property_id')
            .in('lead_id', leadIds);
          ((dbInterests as any[]) || []).forEach((i: any) => {
            if (i.status === 'dropped' || i.status === 'lost') {
              droppedUnitIds.add(i.unit_id);
              return;
            }
            dbInterestMap.set(i.unit_id, {
              status: i.status, interest_level: i.interest_level || 'low', viewing_date: i.viewing_date,
              tenant_id: i.tenant_id, project_id: i.property_id,
            });
          });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: dbBookings } = await (supabase.from('bookings') as any)
          .select('status, notes')
          .eq('customer_id', customerId)
          .neq('status', 'cancelled');
        ((dbBookings as any[]) || []).forEach((b: any) => {
          const uid = b.notes?.unit_id;
          if (uid) bookingByUnit.set(uid, { status: b.status });
        });
      }

      // If Sales dropped any of the customer's localStorage entries, strip them out and
      // persist the cleaned list back. This fixes the desync where Sales removes a
      // customer's interest from the Lead Detail page but the customer keeps seeing
      // it in "บันทึกไว้ดูทีหลัง" indefinitely.
      if (droppedUnitIds.size > 0) {
        const cleaned = localIds.filter((id) => !droppedUnitIds.has(id));
        if (cleaned.length !== localIds.length) {
          localStorage.setItem('customer_wishlist', JSON.stringify(cleaned));
          // Mutate localIds in place so the union below uses the cleaned list.
          localIds.length = 0;
          localIds.push(...cleaned);
          window.dispatchEvent(new Event('wishlist:changed'));
        }
      }

      // Union of unit ids from BOTH sources — DB-active entries always take precedence,
      // localStorage entries that aren't dropped are merged in.
      const allIds = Array.from(new Set([...localIds, ...dbInterestMap.keys()]));
      if (allIds.length === 0) { setWishlist([]); return; }

      // Fetch units (no auto-join because units.project_id FK points to legacy 'projects' table, not 'properties')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: units, error: unitErr } = await (supabase.from('units') as any)
        .select('id, unit_number, price, promo_price, status, thumbnail_url, area_sqm, bedrooms, project_id, tenant_id')
        .in('id', allIds);
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
      const merged: WishlistUnit[] = unitList.map((u: any) => {
        const interest = dbInterestMap.get(u.id);
        const booking = bookingByUnit.get(u.id);
        // booking.status takes priority over lead_interest.status once a booking exists,
        // so the customer sees "✓ ชำระแล้ว" the moment Sales clicks "ยืนยันรับเงิน"
        // (lead_interest stays at 'reserved' indefinitely — it doesn't track payment state).
        const synthesizedStatus =
          booking?.status === 'checked_in' || booking?.status === 'checked_out' ? 'won' :
          booking?.status === 'confirmed' ? 'deposit_paid' :  // synthetic — displayed as "✓ ชำระแล้ว"
          booking?.status === 'pending'   ? 'reserved'      :
          interest?.status                ?? undefined;
        return {
          ...u,
          property: propsMap.get(u.project_id) || null,
          engagement: synthesizedStatus ? { status: synthesizedStatus, interest_level: interest?.interest_level ?? 'low', viewing_date: interest?.viewing_date ?? null } : undefined,
        };
      });
      // Stable order: most engaged first (won → reserved → negotiating → viewing_scheduled → interested → none)
      const rank = (e?: { status: string }) => {
        if (!e) return 99;
        const order = ['won', 'deposit_paid', 'reserved', 'negotiating', 'viewed', 'viewing_scheduled', 'interested'];
        const i = order.indexOf(e.status);
        return i === -1 ? 50 : i;
      };
      merged.sort((a, b) => rank(a.engagement) - rank(b.engagement));
      setWishlist(merged);

      // Background: sync any localStorage-only entries into DB (one-time migration)
      const missingInDb = localIds.filter((id) => !dbInterestMap.has(id));
      if (missingInDb.length > 0 && customerId) {
        const unitMap = new Map(unitList.map((u: any) => [u.id, u]));
        for (const unitId of missingInDb) {
          const u = unitMap.get(unitId);
          if (u) {
            // Fire-and-forget — don't block UI
            addToWishlist({ id: u.id, tenant_id: u.tenant_id, project_id: u.project_id }).catch(() => {});
          }
        }
      }
    } catch (e) { console.error('loadWishlist error:', e); }
  };

  const removeFromWishlist = async (e: React.MouseEvent, unitId: string) => {
    e.stopPropagation();
    try {
      await removeFromWishlistDb(unitId);
      setWishlist((prev) => prev.filter((u) => u.id !== unitId));
    } catch { /* ignore */ }
  };

  // Re-load wishlist when user returns to this page (back button, tab focus, or wishlist change in another component)
  useEffect(() => {
    if (!customerId) return;
    const refresh = () => { loadWishlist(customerId); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener('wishlist:changed', refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener('wishlist:changed', refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [customerId]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          // Anonymous visitor — render public landing instead of redirecting.
          // Featured projects = is_active + is_featured (fallback: most-recent active).
          // Recently viewed = property_views joined by current localStorage visitor_id.
          setIsAnon(true);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const featRes = await (supabase.from('properties') as any)
            .select('id, name, thumbnail_url, base_price, is_active, is_featured')
            .eq('is_active', true)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(4);
          setFeaturedProperties(((featRes.data as any[]) || []).map((p: any) => ({
            id: p.id, name: p.name, thumbnail_url: p.thumbnail_url, base_price: p.base_price,
          })));

          // Recently-viewed: last 5 unique units from this visitor's property_views.
          // Skipped silently if no visitor_id (first ever load).
          const vid = getOrCreateVisitorId();
          if (vid) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: viewRows } = await (supabase.from('property_views') as any)
              .select('unit_id, visited_at')
              .eq('visitor_id', vid)
              .not('unit_id', 'is', null)
              .order('visited_at', { ascending: false })
              .limit(20);
            const seenUnits = new Set<string>();
            const uniqueUnitIds: string[] = [];
            for (const v of (viewRows || []) as any[]) {
              if (!seenUnits.has(v.unit_id)) {
                seenUnits.add(v.unit_id);
                uniqueUnitIds.push(v.unit_id);
                if (uniqueUnitIds.length >= 5) break;
              }
            }
            if (uniqueUnitIds.length > 0) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: unitRows } = await (supabase.from('units') as any)
                .select('id, unit_number, price, thumbnail_url, project_id')
                .in('id', uniqueUnitIds);
              const propIds = Array.from(new Set(((unitRows as any[]) || []).map((u: any) => u.project_id)));
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: propRows } = await (supabase.from('properties') as any)
                .select('id, name').in('id', propIds);
              const propMap = new Map<string, string>(((propRows as any[]) || []).map((p: any) => [p.id, p.name]));
              // Preserve the ordering by visited_at (most recent first) — Map lookups instead of re-sort
              const byId = new Map<string, any>(((unitRows as any[]) || []).map((u: any) => [u.id, u]));
              setRecentlyViewed(uniqueUnitIds
                .map((uid) => byId.get(uid))
                .filter(Boolean)
                .map((u: any) => ({
                  id: u.id, unit_number: u.unit_number, price: u.price, thumbnail_url: u.thumbnail_url,
                  property_name: propMap.get(u.project_id) || '',
                })));
            }
          }

          // Wishlist still works for anon — it pulls from localStorage (the function
          // handles missing customer_id gracefully — only the DB-merge branch is skipped).
          await loadWishlist(undefined);
          return;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: customer } = await (supabase.from('customers') as any)
          .select('id, full_name, email, phone').eq('auth_user_id', user.id).maybeSingle();
        if (!customer) {
          // User is authed but no customer row — this is the rare invite-flow drift bug.
          // Sign them out so they retry, but DON'T redirect to login (we now render anon mode
          // gracefully here instead of bouncing).
          toast.error('ไม่พบข้อมูลลูกค้า');
          await supabase.auth.signOut();
          setIsAnon(true);
          return;
        }
        setProfile(customer as CustomerProfile);
        setCustomerId((customer as any).id);

        // Keep interests state populated for "next visit" hero, but display is now unified via wishlist section
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leads } = await (supabase.from('leads') as any).select('id').eq('customer_id', (customer as any).id);
        const leadIds = ((leads || []) as any[]).map((l: any) => l.id);
        if (leadIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: intRows } = await (supabase.from('lead_interests') as any)
            .select('id, unit_id, property_id, status, interest_level, viewing_date, property:properties(id, name), unit:units(id, unit_number, price, status, thumbnail_url)')
            .in('lead_id', leadIds)
            .not('status', 'in', '("dropped","lost")')
            .order('created_at', { ascending: false });
          setInterests((intRows || []) as any);
        }

        // Unified wishlist load (merges localStorage + lead_interests)
        await loadWishlist((customer as any).id);
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

  // Labels aligned with industry-standard real estate journey (Sansiri Plus / AP Connect):
  // สนใจ → นัดดูแล้ว → กำลังเจรจา → รอชำระมัดจำ (reserved) → ปิดดีลแล้ว (won)
  // Each status has a distinct color family so the customer can tell active stages apart at a glance:
  //   blue  = viewing_scheduled  (calm — just a future appointment)
  //   amber = negotiating         (warming up — Sales is talking with the customer)
  //   orange= reserved            (urgent — money is due)
  //   green = won                 (done — closed deal)
  const statusBadge = (s?: string) => {
    if (s === 'interested') return { label: 'บันทึก', color: 'text-rose-700 bg-rose-100' };
    if (s === 'viewing_scheduled') return { label: ' นัดดูแล้ว', color: 'text-blue-700 bg-blue-100' };
    if (s === 'viewed') return { label: '✓ ดูแล้ว', color: 'text-blue-700 bg-blue-50' };
    if (s === 'negotiating') return { label: 'กำลังเจรจา', color: 'text-amber-800 bg-amber-100' };
    if (s === 'reserved') return { label: 'รอชำระมัดจำ', color: 'text-orange-800 bg-orange-100' };
    if (s === 'deposit_paid') return { label: '✓ ชำระมัดจำแล้ว', color: 'text-emerald-700 bg-emerald-50' };
    if (s === 'won') return { label: '✓ ปิดดีลแล้ว', color: 'text-green-800 bg-green-100' };
    return { label: s || '—', color: 'text-gray-600 bg-gray-100' };
  };

  // Next visit = most urgent thing to show
  const nextVisit = upcomingVisits[0] || null;
  const nextVisitDate = nextVisit?.viewing_date ? new Date(nextVisit.viewing_date) : null;
  const visitDiffDays = nextVisitDate ? Math.ceil((nextVisitDate.getTime() - Date.now()) / 86400000) : 0;
  const visitIsToday = nextVisitDate?.toDateString() === new Date().toDateString();

  // Anonymous landing — public-friendly version of the dashboard. Same shell, same
  // CustomerLayout, no personal data. Mirrors the section rhythm of the authed view
  // so the page feels coherent when the same visitor logs in later.
  if (!loading && isAnon) {
    return (
      <CustomerLayout>
        <>
          {/* 1. Welcome hero — no name, focus on the action (browse) */}
          <section className="bg-gradient-to-br from-rose-50/40 to-white border border-gray-100 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-chateau/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-chateau" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">ยินดีต้อนรับสู่ Chateau</p>
                <p className="text-xs text-gray-600 mt-0.5">ค้นหาบ้านในฝัน · ดูยูนิตจริง · บันทึกเก็บไว้ดูทีหลัง</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/customer/properties')}
              className="w-full mt-4 h-11 bg-chateau hover:bg-chateau-700 text-white"
            >
              <Search className="w-4 h-4 mr-2" /> ดูทุกโครงการ
            </Button>
          </section>

          {/* 2. Featured projects — 2-up grid, large enough to feel like a marketing piece */}
          {featuredProperties.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-chateau" /> โครงการแนะนำ
                </h2>
                <button
                  onClick={() => navigate('/customer/properties')}
                  className="text-xs text-chateau hover:underline font-medium flex items-center gap-1"
                >
                  ดูทั้งหมด <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {featuredProperties.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => navigate(`/customer/properties/${p.id}`)}
                    className="group text-left bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 ease-out flex flex-col"
                  >
                    <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                      {p.thumbnail_url ? (
                        <img src={p.thumbnail_url} alt={p.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-8 h-8 text-gray-300" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                      {p.base_price ? (
                        <div className="absolute bottom-2 left-2 text-white">
                          <p className="text-[9px] font-medium leading-none mb-0.5 text-white/90">เริ่มต้น</p>
                          <p className="text-sm font-bold drop-shadow">{fmt(p.base_price)}</p>
                        </div>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-chateau transition-colors">{p.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* 3. Recently viewed — pulled from property_views.visitor_id (anonymous tracking).
              Powerful re-engagement: "you looked at this 2 days ago, still interested?" */}
          {recentlyViewed.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="w-4 h-4 text-chateau" /> เพิ่งดู
                </h2>
              </div>
              <div className="space-y-2.5">
                {recentlyViewed.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/customer/units/${u.id}`)}
                    className="group w-full flex items-center gap-3 bg-white rounded-2xl p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)] hover:-translate-y-0.5 transition-all duration-300 ease-out text-left"
                  >
                    <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                      {u.thumbnail_url ? (
                        <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-6 h-6 text-gray-300" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-chateau transition-colors">ยูนิต {u.unit_number}</p>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{u.property_name}</p>
                      {u.price ? (
                        <p className="text-sm font-bold text-chateau tabular-nums mt-1">{fmt(u.price)}</p>
                      ) : null}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0 group-hover:text-chateau group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Wishlist is intentionally not shown on the anon dashboard. Anonymous traffic
              comes here to browse projects, not to manage a personal collection — and
              surfacing leftover localStorage from a prior logged-in session is confusing
              ("how do I have saved items when I'm not logged in?"). Wishlist becomes
              visible after login; the ♡ control on unit detail will move behind a login
              gate in a separate task. */}

          {/* Login surfaced via the header "เข้าสู่ระบบ" button (CustomerLayout) — no
              bottom CTA needed. Anon page stays focused on browsing. */}
        </>
      </CustomerLayout>
    );
  }

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
                      {visitIsToday ? ' นัดดูวันนี้' : visitDiffDays === 1 ? ' นัดดูพรุ่งนี้' : ` อีก ${visitDiffDays} วัน`}
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

          {/* === 2. STATS: 3 cards — counters mirror the section split below so the
              icon visually matches its bucket. Lumping all 3 into one "❤️ ทั้งหมด"
              counter was misleading: heart suggested wishlist, but the count included
              high-intent "รอ Sales" units that the customer never hearted. === */}
          {(() => {
            const ACTIVE_STATUSES = ['viewing_scheduled', 'viewed', 'negotiating', 'reserved', 'deposit_paid', 'won'];
            const waitingCount = wishlist.filter((u) =>
              u.engagement && u.engagement.status === 'interested' && u.engagement.interest_level === 'high'
            ).length;
            const savedCount = wishlist.filter((u) =>
              !u.engagement
              || (!ACTIVE_STATUSES.includes(u.engagement.status) && u.engagement.interest_level !== 'high')
            ).length;
            return (
              <section className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard
                  icon={Clock}
                  label="รอ Sales ติดต่อ"
                  value={waitingCount}
                  iconColor="text-gray-700"
                  bgColor="bg-gray-100"
                  subtitle={waitingCount === 0 ? 'ยังไม่มีรายการ' : 'รอการติดต่อกลับ'}
                />
                <StatCard
                  icon={Heart}
                  label="บันทึกไว้พิจารณา"
                  value={savedCount}
                  iconColor="text-chateau"
                  bgColor="bg-rose-50"
                  subtitle={savedCount === 0 ? 'กดหัวใจบนยูนิต' : 'รายการที่บันทึกไว้'}
                />
                <StatCard
                  icon={Calendar}
                  label="นัดดูยูนิต"
                  value={upcomingVisits.length}
                  iconColor="text-amber-700"
                  bgColor="bg-amber-50"
                  subtitle={upcomingVisits.length === 0 ? 'ยังไม่มีนัด' : 'กำลังจะถึง'}
                />
              </section>
            );
          })()}

          {/* Saved units — split into 3 sub-sections matching customer's mental model:
              1. "กำลังดำเนินการ"     — Sales picked up (viewing scheduled / negotiating / reserved / won)
              2. "รอ Sales ติดต่อ"   — customer clicked "ฉันสนใจ" (interest_level='high') but no Sales action yet
              3. "บันทึกไว้ดูทีหลัง"  — customer just tapped heart (interest_level='low'/'medium'); passive bookmark
          */}
          {wishlist.length > 0 && (() => {
            const ACTIVE_STATUSES = ['viewing_scheduled', 'viewed', 'negotiating', 'reserved', 'deposit_paid', 'won'];
            const activeUnits = wishlist.filter((u) => u.engagement && ACTIVE_STATUSES.includes(u.engagement.status));
            const waitingUnits = wishlist.filter((u) =>
              u.engagement && u.engagement.status === 'interested' && u.engagement.interest_level === 'high'
            );
            const savedUnits = wishlist.filter((u) =>
              !u.engagement
              || (!ACTIVE_STATUSES.includes(u.engagement.status) && u.engagement.interest_level !== 'high')
            );

            // Per-status visual style for the active section (border + glow + section icon)
            // Subtle, professional look — thin border + neutral background.
            // Status is communicated by the badge, not by loud card chrome.
            const activeStyle = (_status?: string) => ({ border: 'border-gray-200', accent: 'bg-white' });

            return (
              <>
                {/* === Active engagement (top — highest priority for the eye) === */}
                {activeUnits.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <span className="text-base"></span> กำลังดำเนินการ
                      </h2>
                      <span className="text-xs text-orange-600 font-semibold">{activeUnits.length} รายการ · ต้องติดตาม</span>
                    </div>
                    <div className="space-y-2.5">
                      {activeUnits.map((u) => {
                        const isPromo = u.promo_price && u.price && u.promo_price < u.price;
                        const badge = u.engagement ? statusBadge(u.engagement.status) : null;
                        const style = activeStyle(u.engagement?.status);
                        return (
                          <div
                            key={u.id}
                            onClick={() => navigate(`/customer/units/${u.id}`)}
                            className={`relative bg-white border-2 ${style.border} rounded-2xl overflow-hidden hover:shadow-md transition-all cursor-pointer active:scale-[0.99] flex`}
                          >
                            <div className="w-28 h-28 bg-gray-100 flex-shrink-0">
                              {u.thumbnail_url ? (
                                <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Building2 className="w-7 h-7 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 p-3">
                              {badge && (
                                <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full ${badge.color} mb-1.5`}>
                                  {badge.label}
                                </span>
                              )}
                              <p className="text-sm font-semibold text-gray-900 truncate">ยูนิต {u.unit_number}</p>
                              <p className="text-[11px] text-gray-500 truncate">{u.property?.name}</p>
                              <p className="text-sm font-bold text-chateau mt-1">
                                {fmt((isPromo ? u.promo_price : u.price) || undefined)}
                              </p>
                              {u.engagement?.viewing_date && (
                                <p className="text-[10px] text-amber-700 mt-1 font-medium">
                                   {new Date(u.engagement.viewing_date).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 self-center mr-3 flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* === Waiting for Sales (middle — active intent but no Sales response yet) === */}
                {waitingUnits.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" /> รอ Sales ติดต่อ
                      </h2>
                      <span className="text-xs text-gray-500 font-medium">{waitingUnits.length} รายการ</span>
                    </div>
                    <div className="space-y-2.5">
                      {waitingUnits.map((u) => {
                        const isPromo = u.promo_price && u.price && u.promo_price < u.price;
                        return (
                          <div
                            key={u.id}
                            onClick={() => navigate(`/customer/units/${u.id}`)}
                            className="relative bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-sm hover:border-gray-300 transition-all cursor-pointer active:scale-[0.99] flex"
                          >
                            <div className="w-28 h-28 bg-gray-100 flex-shrink-0">
                              {u.thumbnail_url ? (
                                <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Building2 className="w-7 h-7 text-gray-300" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 p-3">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 mb-1.5">
                                <Clock className="w-3 h-3" /> รอ Sales ติดต่อ
                              </span>
                              <p className="text-sm font-semibold text-gray-900 truncate">ยูนิต {u.unit_number}</p>
                              <p className="text-[11px] text-gray-500 truncate">{u.property?.name}</p>
                              <p className="text-sm font-bold text-chateau mt-1">
                                {fmt((isPromo ? u.promo_price : u.price) || undefined)}
                              </p>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-300 self-center mr-3 flex-shrink-0" />
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* === Saved-for-later (bottom — passive bookmarks) === */}
                {savedUnits.length > 0 && (
                  <section>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                        <Heart className="w-4 h-4 fill-current text-chateau" /> บันทึกไว้ดูทีหลัง
                      </h2>
                      <span className="text-xs text-gray-400">{savedUnits.length} รายการ</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {savedUnits.map((u) => {
                        const isPromo = u.promo_price && u.price && u.promo_price < u.price;
                        return (
                          <div
                            key={u.id}
                            onClick={() => navigate(`/customer/units/${u.id}`)}
                            className="relative bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer active:scale-[0.99]"
                          >
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
              </>
            );
          })()}

          {/* Empty state — if absolutely no engagement (encourages first visit) */}
          {wishlist.length === 0 && (
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
