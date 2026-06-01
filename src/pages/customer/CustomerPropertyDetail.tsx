import { useEffect, useState, useMemo } from 'react';
import { startViewTracking } from '@/lib/viewTracking';
import SitePlanViewer from '@/components/properties/SitePlanViewer';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, MapPin, Bed, Bath, Square, Loader2, ChevronRight, LayoutGrid, List as ListIcon, Heart, SlidersHorizontal, X, FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { getReferralUnitScope } from '@/lib/referralScope';
import { incrementLeadCounter } from '@/lib/leadTracking';
import CustomerLayout from './CustomerLayout';

type BudgetKey = 'all' | 'u3' | '3to5' | '5to10' | '10to20' | 'over20';
type BedKey = 'all' | '1' | '2' | '3' | '4plus';

const BUDGET_RANGES: Record<BudgetKey, { label: string; min: number; max: number }> = {
  all:     { label: 'ทั้งหมด',      min: 0,         max: Infinity },
  u3:      { label: 'ไม่เกิน 3 ล้าน', min: 0,         max: 3_000_000 },
  '3to5':  { label: '3-5 ล้าน',     min: 3_000_000, max: 5_000_000 },
  '5to10': { label: '5-10 ล้าน',    min: 5_000_000, max: 10_000_000 },
  '10to20':{ label: '10-20 ล้าน',   min: 10_000_000, max: 20_000_000 },
  over20:  { label: 'มากกว่า 20 ล้าน', min: 20_000_000, max: Infinity },
};

interface Property {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string | null;
  address?: any;
  base_price?: number | null;
  developer?: string;
  brochure_url?: string | null;
  // Admin form saves the primary doc URL under information_links.sale_kit — read it
  // as a fallback so legacy projects without brochure_url still expose a download.
  information_links?: { sale_kit?: string | null; documents?: Array<{ label: string; url: string }> } | null;
  tenant_id?: string;
}

interface Unit {
  id: string;
  unit_number: string;
  area_sqm?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  price?: number | null;
  promo_price?: number | null;
  status?: string;
  thumbnail_url?: string | null;
  tenant_id?: string;
  project_id?: string;
}

const CustomerPropertyDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'available' | 'reserved' | 'sold'>('available');

  // Carry filter state from URL params (handed off from project listing page)
  const initialBudget = (searchParams.get('budget') as BudgetKey) || 'all';
  const initialBed = (searchParams.get('beds') as BedKey) || 'all';
  const [budgetFilter, setBudgetFilter] = useState<BudgetKey>(
    initialBudget in BUDGET_RANGES ? initialBudget : 'all'
  );
  const [bedFilter, setBedFilter] = useState<BedKey>(
    ['all', '1', '2', '3', '4plus'].includes(initialBed) ? initialBed : 'all'
  );
  // Open the filter panel by default if user arrived with active filters
  const [showFilters, setShowFilters] = useState(initialBudget !== 'all' || initialBed !== 'all');

  // Persist filter state back to URL when user changes it (so refresh keeps state)
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (budgetFilter === 'all') next.delete('budget'); else next.set('budget', budgetFilter);
    if (bedFilter === 'all') next.delete('beds'); else next.set('beds', bedFilter);
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetFilter, bedFilter]);

  const activeFilterCount = (budgetFilter !== 'all' ? 1 : 0) + (bedFilter !== 'all' ? 1 : 0);
  const clearUnitFilters = () => { setBudgetFilter('all'); setBedFilter('all'); };
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    try { return (localStorage.getItem('customer_unit_view') as 'list' | 'grid') || 'list'; } catch { return 'list'; }
  });
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('customer_wishlist') || '[]')); } catch { return new Set(); }
  });

  const changeView = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    try { localStorage.setItem('customer_unit_view', mode); } catch { /* ignore */ }
  };

  const toggleWish = async (e: React.MouseEvent, unit: Unit) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      const { toggleWishlist } = await import('@/lib/customerWishlist');
      const nowSaved = await toggleWishlist({
        id: unit.id,
        tenant_id: unit.tenant_id || '',
        project_id: unit.project_id,
      });
      setWishlistIds((prev) => {
        const next = new Set(prev);
        if (nowSaved) next.add(unit.id); else next.delete(unit.id);
        return next;
      });
      toast.success(nowSaved ? 'บันทึกในรายการที่ชอบแล้ว' : 'นำออกจากรายการแล้ว');
    } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const [propRes, unitRes] = await Promise.all([
          (supabase.from('properties') as any).select('*').eq('id', id).single(),
          (supabase.from('units') as any)
            .select('id, unit_number, area_sqm, bedrooms, bathrooms, price, promo_price, status, thumbnail_url, tenant_id, project_id')
            .eq('project_id', id)
            .order('unit_number'),
        ]);
        if (propRes.data) setProperty(propRes.data as Property);
        // Agent referral scope: only show units that the referring agent services.
        let unitList = (unitRes.data || []) as Unit[];
        const scope = await getReferralUnitScope();
        if (scope) unitList = unitList.filter((u) => scope.has(u.id));
        setUnits(unitList);
      } catch (err) {
        console.error('Load property detail error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Funnel-layer-1 tracking for property-level browse. Records once the property
  // has loaded so we have tenant_id. Same anonymous visitor_id is reused across
  // property → unit transitions, so we can chain "viewed project then drilled into A-101".
  useEffect(() => {
    if (!id || !property) return;
    const tracker = startViewTracking({
      tenantId: (property as any).tenant_id,
      propertyId: id,
      unitId: null,
      pagePath: window.location.pathname,
    });
    return () => tracker.flush();
  }, [id, property?.id]);

  // Apply: (1) status pill, (2) budget filter, (3) bedroom filter
  // Must be declared BEFORE any conditional early returns to satisfy Rules of Hooks.
  const visible = useMemo(() => {
    const arr = filter === 'all' ? units : units.filter((u) => u.status === filter);
    return arr.filter((u) => {
      if (budgetFilter !== 'all') {
        const r = BUDGET_RANGES[budgetFilter];
        const price = u.promo_price ?? u.price ?? 0;
        if (price < r.min || price > r.max) return false;
      }
      if (bedFilter !== 'all') {
        const beds = u.bedrooms ?? 0;
        if (bedFilter === '4plus') {
          if (beds < 4) return false;
        } else {
          if (beds !== parseInt(bedFilter, 10)) return false;
        }
      }
      return true;
    });
  }, [units, filter, budgetFilter, bedFilter]);

  if (loading) {
    return (
      <CustomerLayout title="กำลังโหลด..." showBack backTo="/customer/properties">
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      </CustomerLayout>
    );
  }
  if (!property) {
    return (
      <CustomerLayout title="ไม่พบโครงการ" showBack backTo="/customer/properties">
        <div className="bg-white border border-gray-100 rounded-2xl py-12 text-center text-gray-500">ไม่พบข้อมูลโครงการ</div>
      </CustomerLayout>
    );
  }

  const fmt = (n?: number | null) => (n ? `${(n / 1_000_000).toFixed(2)} ล้าน` : '-');
  const addr = (a?: any) => {
    if (!a) return '';
    return [a.street, a.district, a.province].filter(Boolean).join(', ');
  };
  const counts = {
    available: units.filter((u) => u.status === 'available').length,
    reserved: units.filter((u) => u.status === 'reserved').length,
    sold: units.filter((u) => u.status === 'sold').length,
    total: units.length,
  };

  const statusDot = (s?: string) => {
    if (s === 'available') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700"><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> ว่าง</span>;
    if (s === 'reserved') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> จอง</span>;
    if (s === 'sold') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> ขายแล้ว</span>;
    return null;
  };

  return (
    <CustomerLayout title={property.name} subtitle={property.developer} showBack backTo="/customer/properties">
      {/* Hero */}
      <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
        <div className="relative h-56 bg-gray-100">
          {property.thumbnail_url ? (
            <img src={property.thumbnail_url} alt={property.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
              <Building2 className="w-16 h-16 text-gray-300" />
            </div>
          )}
          {/* Floating brochure download — top-right corner overlay.
              Hide entirely when no file is available — better than misleading the
              customer with a "ส่งทางอีเมลภายใน 5 นาที" toast for an email we never send. */}
          {(() => {
            const brochureUrl = property.brochure_url || property.information_links?.sale_kit || null;
            if (!brochureUrl) return null;
            return (
              <button
                type="button"
                onClick={async () => {
                  await incrementLeadCounter({ field: 'brochure_downloads', propertyId: property.id });
                  try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (supabase.from('activity_logs') as any).insert({
                      tenant_id: property.tenant_id,
                      activity_type: 'brochure_downloaded',
                      description: `ลูกค้าดาวน์โหลดเอกสารโครงการ ${property.name}`,
                      metadata: { property_id: property.id, source: 'customer_portal' },
                    });
                  } catch { /* non-blocking */ }
                  window.open(brochureUrl, '_blank', 'noopener');
                  toast.success('กำลังเปิดเอกสาร...');
                }}
                title="ดาวน์โหลดเอกสารโครงการ"
                className="absolute top-3 right-3 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-chateau text-white text-sm font-semibold shadow-lg ring-2 ring-white/50 hover:bg-chateau-600 hover:scale-105 transition-all"
              >
                <FileDown className="w-4 h-4" />
                ดาวน์โหลดเอกสาร
              </button>
            );
          })()}
        </div>
        <div className="p-5">
          <h1 className="text-xl font-bold text-gray-900 mb-1">{property.name}</h1>
          {property.developer && <p className="text-sm text-gray-500 mb-3">โดย {property.developer}</p>}
          {addr(property.address) && (
            <p className="text-sm text-gray-600 flex items-start gap-1.5 mb-3">
              <MapPin className="w-4 h-4 mt-0.5 text-gray-400 flex-shrink-0" /> <span>{addr(property.address)}</span>
            </p>
          )}
          {property.description && (
            <p className="text-sm text-gray-700 leading-relaxed">{property.description}</p>
          )}
          {(property.base_price ?? 0) > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-0.5">ราคาเริ่มต้น</p>
              <p className="text-2xl font-bold text-chateau">{fmt(property.base_price!)}</p>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <StatBlock value={counts.total} label="ทั้งหมด" />
        <StatBlock value={counts.available} label="ว่าง" tone="green" />
        <StatBlock value={counts.reserved} label="จอง" tone="amber" />
        <StatBlock value={counts.sold} label="ขายแล้ว" tone="gray" />
      </div>

      {/* Site Plan — multi-plan tabbed viewer with clickable hotspots. Component
          self-hides when the project has no plans, so this is safe to always render.
          Clicking a pin navigates to /customer/units/:id (handled inside the viewer). */}
      {id && <SitePlanViewer propertyId={id} />}

      {/* Unit Filter + View Toggle */}
      <div id="unit-list">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-gray-900">ยูนิต</h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{visible.length} ยูนิต</span>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => changeView('list')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="แบบรายการ"
              >
                <ListIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => changeView('grid')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                title="แบบกริด"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          <FilterPill active={filter === 'available'} onClick={() => setFilter('available')}>● ว่าง</FilterPill>
          <FilterPill active={filter === 'reserved'} onClick={() => setFilter('reserved')}>● จอง</FilterPill>
          <FilterPill active={filter === 'sold'} onClick={() => setFilter('sold')}>● ขาย</FilterPill>
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>ทั้งหมด</FilterPill>
        </div>

        {/* Advanced filters — budget + bedrooms */}
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => setShowFilters((s) => !s)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition ${
              showFilters || activeFilterCount > 0
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            ตัวกรอง
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-white text-gray-900 rounded-full w-5 h-5 inline-flex items-center justify-center text-[10px] font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
          {activeFilterCount > 0 && (
            <button
              onClick={clearUnitFilters}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
            >
              <X className="w-3 h-3" /> ล้าง
            </button>
          )}
        </div>
        {showFilters && (
          <div className="bg-white border border-gray-100 rounded-2xl p-4 mt-3 space-y-4">
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">งบประมาณ</p>
              <div className="flex flex-wrap gap-2">
                {(Object.entries(BUDGET_RANGES) as [BudgetKey, { label: string }][]).map(([key, r]) => (
                  <FilterPill key={key} active={budgetFilter === key} onClick={() => setBudgetFilter(key)}>
                    {r.label}
                  </FilterPill>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">ห้องนอน</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill active={bedFilter === 'all'} onClick={() => setBedFilter('all')}>ทั้งหมด</FilterPill>
                <FilterPill active={bedFilter === '1'} onClick={() => setBedFilter('1')}>1 ห้อง</FilterPill>
                <FilterPill active={bedFilter === '2'} onClick={() => setBedFilter('2')}>2 ห้อง</FilterPill>
                <FilterPill active={bedFilter === '3'} onClick={() => setBedFilter('3')}>3 ห้อง</FilterPill>
                <FilterPill active={bedFilter === '4plus'} onClick={() => setBedFilter('4plus')}>4+ ห้อง</FilterPill>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Unit list/grid */}
      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <p className="text-sm text-gray-500 mb-3">ไม่มียูนิตตามเงื่อนไข</p>
          {activeFilterCount > 0 && (
            <button onClick={clearUnitFilters} className="text-xs text-chateau font-medium hover:underline">
              ล้างตัวกรอง →
            </button>
          )}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2.5">
          {visible.map((u) => {
            const isWished = wishlistIds.has(u.id);
            return (
            <div
              key={u.id}
              onClick={() => navigate(`/customer/units/${u.id}`)}
              className="w-full bg-white border border-gray-100 rounded-2xl p-3 hover:border-gray-200 hover:shadow-sm transition-all text-left flex items-center gap-3 active:scale-[0.99] cursor-pointer"
            >
              <div className="relative w-16 h-16 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                {u.thumbnail_url ? (
                  <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-sm font-semibold text-gray-900">ยูนิต {u.unit_number}</p>
                  {statusDot(u.status)}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500 mb-1">
                  {u.bedrooms != null && <span><Bed className="w-3 h-3 inline mr-0.5" />{u.bedrooms}</span>}
                  {u.bathrooms != null && <span><Bath className="w-3 h-3 inline mr-0.5" />{u.bathrooms}</span>}
                  {u.area_sqm && <span><Square className="w-3 h-3 inline mr-0.5" />{u.area_sqm} ตร.ม.</span>}
                </div>
                <p className="text-sm font-semibold text-gray-900">
                  {u.promo_price && u.price && u.promo_price < u.price ? (
                    <>
                      <span className="text-chateau">{fmt(u.promo_price)}</span>
                      <span className="text-xs text-gray-400 line-through ml-2 font-normal">{fmt(u.price)}</span>
                    </>
                  ) : (
                    fmt(u.price)
                  )}
                </p>
              </div>
              <button
                onClick={(e) => toggleWish(e, u)}
                className={`p-2 rounded-full hover:bg-gray-100 transition-all flex-shrink-0 ${isWished ? 'text-chateau' : 'text-gray-300 hover:text-gray-500'}`}
                title={isWished ? 'นำออกจากที่ชอบ' : 'บันทึกในที่ชอบ'}
              >
                <Heart className={`w-5 h-5 ${isWished ? 'fill-current' : ''}`} />
              </button>
              <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
            </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {visible.map((u) => {
            const hasPromo = u.promo_price && u.price && u.promo_price < u.price;
            const discountPct = hasPromo ? Math.round(((u.price! - u.promo_price!) / u.price!) * 100) : 0;
            const isWished = wishlistIds.has(u.id);
            return (
              <div
                key={u.id}
                onClick={() => navigate(`/customer/units/${u.id}`)}
                className="bg-white border border-gray-100 rounded-2xl overflow-hidden hover:border-gray-200 hover:shadow-sm transition-all text-left active:scale-[0.99] flex flex-col cursor-pointer"
              >
                {/* Image with overlays */}
                <div className="relative aspect-[4/3] bg-gray-100">
                  {u.thumbnail_url ? (
                    <img src={u.thumbnail_url} alt={u.unit_number} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-10 h-10 text-gray-300" />
                    </div>
                  )}
                  {/* Status badge top-right */}
                  <div className="absolute top-2 right-2">
                    {statusDot(u.status)}
                  </div>
                  {/* Promo badge top-left */}
                  {hasPromo && (
                    <span className="absolute top-2 left-2 bg-chateau text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                      ลด {discountPct}%
                    </span>
                  )}
                  {/* Wishlist heart bottom-right */}
                  <button
                    onClick={(e) => toggleWish(e, u)}
                    className={`absolute bottom-2 right-2 w-8 h-8 rounded-full backdrop-blur bg-white/90 flex items-center justify-center transition-all hover:scale-110 ${isWished ? 'text-chateau' : 'text-gray-500'}`}
                  >
                    <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
                  </button>
                </div>
                {/* Info */}
                <div className="p-3 flex-1 flex flex-col">
                  <p className="text-sm font-semibold text-gray-900 mb-1">ยูนิต {u.unit_number}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-500 mb-2">
                    {u.bedrooms != null && <span><Bed className="w-3 h-3 inline mr-0.5" />{u.bedrooms}</span>}
                    {u.bathrooms != null && <span><Bath className="w-3 h-3 inline mr-0.5" />{u.bathrooms}</span>}
                    {u.area_sqm && <span>{u.area_sqm} ตร.ม.</span>}
                  </div>
                  <div className="mt-auto">
                    {hasPromo ? (
                      <>
                        <p className="text-base font-bold text-chateau leading-tight">{fmt(u.promo_price)}</p>
                        <p className="text-[10px] text-gray-400 line-through">{fmt(u.price)}</p>
                      </>
                    ) : (
                      <p className="text-base font-bold text-gray-900 leading-tight">{fmt(u.price)}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
};

const StatBlock = ({ value, label, tone }: { value: number; label: string; tone?: 'green' | 'amber' | 'gray' }) => {
  const colors = tone === 'green' ? 'text-green-600' : tone === 'amber' ? 'text-amber-600' : tone === 'gray' ? 'text-gray-500' : 'text-gray-900';
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-3 text-center">
      <p className={`text-lg font-bold ${colors}`}>{value}</p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
};

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

export default CustomerPropertyDetail;
