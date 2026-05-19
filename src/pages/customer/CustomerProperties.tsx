import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Search, MapPin, Square, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import CustomerLayout from './CustomerLayout';

interface PropertyRow {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string | null;
  address?: any;
  base_price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  total_units?: number;
  developer?: string;
  is_featured?: boolean;
  type?: string;
}

type TypeKey = 'all' | 'condo' | 'single_house' | 'townhome' | 'twin_house';
type BudgetKey = 'all' | 'u3' | '3to5' | '5to10' | '10to20' | 'over20';
type BedKey = 'all' | '1' | '2' | '3' | '4plus';
type SortKey = 'recommended' | 'price_asc' | 'price_desc' | 'newest';

const TYPE_LABEL: Record<string, string> = {
  condo: 'คอนโด',
  single_house: 'บ้านเดี่ยว',
  townhome: 'ทาวน์โฮม',
  twin_house: 'บ้านแฝด',
};

const BUDGET_RANGES: Record<BudgetKey, { label: string; min: number; max: number }> = {
  all:     { label: 'ทั้งหมด',      min: 0,         max: Infinity },
  u3:      { label: 'ไม่เกิน 3 ล้าน', min: 0,         max: 3_000_000 },
  '3to5':  { label: '3-5 ล้าน',     min: 3_000_000, max: 5_000_000 },
  '5to10': { label: '5-10 ล้าน',    min: 5_000_000, max: 10_000_000 },
  '10to20':{ label: '10-20 ล้าน',   min: 10_000_000, max: 20_000_000 },
  over20:  { label: 'มากกว่า 20 ล้าน', min: 20_000_000, max: Infinity },
};

interface UnitMini {
  id: string;
  project_id: string;
  price: number;
  bedrooms: number | null;
  status: string;
}

const CustomerProperties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [units, setUnits] = useState<UnitMini[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeKey>('all');
  const [budgetFilter, setBudgetFilter] = useState<BudgetKey>('all');
  const [bedFilter, setBedFilter] = useState<BedKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recommended');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        // Lazy auto-revert: clean up any expired reservations before showing inventory.
        // Fire-and-forget — never block the page on this.
        try { await (supabase as any).rpc('revert_expired_unit_reservations'); } catch { /* ignore */ }

        const [propsRes, unitsRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name, description, thumbnail_url, address, base_price, bedrooms, bathrooms, total_units, developer, is_featured, type, created_at')
            .eq('is_active', true)
            .order('is_featured', { ascending: false })
            .order('created_at', { ascending: false }),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('units') as any)
            .select('id, project_id, price, bedrooms, status')
            .eq('status', 'available'),
        ]);
        if (propsRes.error) throw propsRes.error;
        setProperties((propsRes.data || []) as PropertyRow[]);
        setUnits((unitsRes.data || []) as UnitMini[]);
      } catch (err) {
        console.error('Load properties error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Group available units by project_id for filter lookup
  const unitsByProject = useMemo(() => {
    const m = new Map<string, UnitMini[]>();
    units.forEach((u) => {
      if (!m.has(u.project_id)) m.set(u.project_id, []);
      m.get(u.project_id)!.push(u);
    });
    return m;
  }, [units]);

  // Apply budget+bedroom filter to a project's units; returns matching list
  const matchUnits = (projectId: string): UnitMini[] => {
    const list = unitsByProject.get(projectId) || [];
    return list.filter((u) => {
      if (budgetFilter !== 'all') {
        const r = BUDGET_RANGES[budgetFilter];
        if (u.price < r.min || u.price > r.max) return false;
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
  };

  const activeFilterCount =
    (typeFilter !== 'all' ? 1 : 0) +
    (budgetFilter !== 'all' ? 1 : 0) +
    (bedFilter !== 'all' ? 1 : 0);

  const clearAllFilters = () => {
    setTypeFilter('all');
    setBudgetFilter('all');
    setBedFilter('all');
    setSortBy('recommended');
  };

  // Filtered list — each item carries the matching units count + min/max price for that project
  const filtered = useMemo(() => {
    const unitFilterActive = budgetFilter !== 'all' || bedFilter !== 'all';
    let arr = properties
      .map((p) => {
        const all = unitsByProject.get(p.id) || [];
        const matches = matchUnits(p.id);
        return { p, allUnits: all, matchedUnits: matches };
      })
      .filter(({ p, matchedUnits }) => {
        if (search) {
          const q = search.toLowerCase();
          if (!p.name.toLowerCase().includes(q) && !p.developer?.toLowerCase().includes(q)) return false;
        }
        if (typeFilter !== 'all' && p.type !== typeFilter) return false;
        // Budget/bedroom filter → project must have at least 1 matching available unit
        if (unitFilterActive && matchedUnits.length === 0) return false;
        return true;
      });

    // Sort — when unit filter active, sort by matching unit's min price; else by project base_price
    const priceOf = (item: { p: PropertyRow; matchedUnits: UnitMini[]; allUnits: UnitMini[] }) => {
      const pool = unitFilterActive ? item.matchedUnits : item.allUnits;
      if (pool.length > 0) return Math.min(...pool.map((u) => u.price));
      return item.p.base_price ?? 0;
    };

    if (sortBy === 'price_asc') arr = [...arr].sort((a, b) => priceOf(a) - priceOf(b));
    else if (sortBy === 'price_desc') arr = [...arr].sort((a, b) => priceOf(b) - priceOf(a));
    else if (sortBy === 'newest') arr = [...arr].sort((a, b) => ((b.p as any).created_at || '').localeCompare((a.p as any).created_at || ''));
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties, units, search, typeFilter, budgetFilter, bedFilter, sortBy]);

  const fmtPrice = (n?: number | null) => (n ? `${(n / 1_000_000).toFixed(1)} ล้าน` : '-');
  const addr = (a?: any) => {
    if (!a) return '';
    return [a.district, a.province].filter(Boolean).join(', ');
  };

  return (
    <CustomerLayout title="โครงการทั้งหมด" subtitle={`${filtered.length} โครงการ`} showBack backTo="/customer">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="ค้นหาโครงการ / นักพัฒนา..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 h-11 bg-gray-50 border-gray-100 focus:bg-white"
        />
      </div>

      {/* Filter toggle + sort */}
      <div className="flex items-center gap-2">
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
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortKey)}
          className="px-3 py-1.5 rounded-full text-xs font-medium border border-gray-200 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="recommended">แนะนำ</option>
          <option value="price_asc">ราคา ต่ำ → สูง</option>
          <option value="price_desc">ราคา สูง → ต่ำ</option>
          <option value="newest">ใหม่ล่าสุด</option>
        </select>
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <X className="w-3 h-3" /> ล้าง
          </button>
        )}
      </div>

      {/* Filter panel (collapsible) */}
      {showFilters && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-4">
          {/* Type */}
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">ประเภท</p>
            <div className="flex flex-wrap gap-2">
              <FilterPill active={typeFilter === 'all'} onClick={() => setTypeFilter('all')}>ทั้งหมด</FilterPill>
              <FilterPill active={typeFilter === 'condo'} onClick={() => setTypeFilter('condo')}>คอนโด</FilterPill>
              <FilterPill active={typeFilter === 'single_house'} onClick={() => setTypeFilter('single_house')}>บ้านเดี่ยว</FilterPill>
              <FilterPill active={typeFilter === 'townhome'} onClick={() => setTypeFilter('townhome')}>ทาวน์โฮม</FilterPill>
              <FilterPill active={typeFilter === 'twin_house'} onClick={() => setTypeFilter('twin_house')}>บ้านแฝด</FilterPill>
            </div>
          </div>
          {/* Budget */}
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
          {/* Bedrooms */}
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

      {/* Project list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">กำลังโหลด...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-dashed border-gray-200 rounded-2xl py-12 text-center">
          <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500 mb-3">ไม่พบโครงการตามเงื่อนไข</p>
          {(activeFilterCount > 0 || search) && (
            <button onClick={() => { clearAllFilters(); setSearch(''); }} className="text-xs text-chateau font-medium hover:underline">
              ล้างตัวกรอง →
            </button>
          )}
        </div>
      ) : (
        // Grid layout matches the units grid pattern (CustomerPropertyDetail) so the
        // customer's eye doesn't have to readjust between project list and unit list.
        // 1-column on mobile (cards stay legible), 2-column from sm: breakpoint up.
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(({ p, allUnits, matchedUnits }) => {
            const unitFilterActive = budgetFilter !== 'all' || bedFilter !== 'all';
            const displayUnits = unitFilterActive ? matchedUnits : allUnits;
            const prices = displayUnits.map((u) => u.price);
            const minP = prices.length > 0 ? Math.min(...prices) : null;
            const maxP = prices.length > 0 ? Math.max(...prices) : null;
            return (
              <button
                key={p.id}
                onClick={() => {
                  const qs = new URLSearchParams();
                  if (budgetFilter !== 'all') qs.set('budget', budgetFilter);
                  if (bedFilter !== 'all') qs.set('beds', bedFilter);
                  const search = qs.toString();
                  navigate(`/customer/properties/${p.id}${search ? `?${search}` : ''}`);
                }}
                className="group bg-white rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.12)] hover:-translate-y-1 transition-all duration-300 ease-out text-left flex flex-col"
              >
                {/* Image with subtle zoom-on-hover (overflow-hidden clips the scaled child).
                    Gradient overlay improves badge contrast on bright photos. */}
                <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
                  {p.thumbnail_url ? (
                    <img
                      src={p.thumbnail_url}
                      alt={p.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="w-12 h-12 text-gray-300" />
                    </div>
                  )}
                  {/* Subtle gradient bottom so the price chip we'll overlay later (or unit count)
                      reads against bright photos. Also gives the card a more "magazine" feel. */}
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />

                  {p.is_featured && (
                    <span className="absolute top-2.5 left-2.5 bg-amber-400 text-amber-900 text-[10px] font-bold px-2.5 py-1 rounded-full shadow-md backdrop-blur-sm">
                      ⭐ แนะนำ
                    </span>
                  )}
                  {p.type && TYPE_LABEL[p.type] && (
                    <span className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur text-gray-800 text-[10px] font-semibold px-2.5 py-1 rounded-full shadow-md">
                      {TYPE_LABEL[p.type]}
                    </span>
                  )}
                  {/* Price tag overlaid on image (bottom-left) — far more eye-catching than buried in a row below. */}
                  {minP != null && (
                    <div className="absolute bottom-2.5 left-2.5 text-white">
                      <p className="text-[10px] font-medium leading-none mb-0.5 text-white/90">
                        {minP === maxP ? 'ราคา' : 'เริ่มต้น'}
                      </p>
                      <p className="text-base font-bold leading-tight drop-shadow">
                        {fmtPrice(minP)}
                      </p>
                    </div>
                  )}
                  {/* Unit count chip bottom-right of image */}
                  <span className="absolute bottom-2.5 right-2.5 bg-white/95 backdrop-blur text-gray-800 text-[10px] font-semibold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
                    <Square className="w-2.5 h-2.5" /> {allUnits.length} ยูนิต
                  </span>
                </div>

                {/* Info — leaner now that price+unit-count moved onto the image. */}
                <div className="p-3.5 flex-1 flex flex-col">
                  <h3 className="text-sm font-bold text-gray-900 truncate group-hover:text-chateau transition-colors">{p.name}</h3>
                  {p.developer && <p className="text-[11px] text-gray-500 truncate mt-0.5">โดย {p.developer}</p>}

                  {addr(p.address) && (
                    <p className="text-[11px] text-gray-600 flex items-center gap-1 mt-2 truncate">
                      <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="truncate">{addr(p.address)}</span>
                    </p>
                  )}

                  {unitFilterActive && (
                    <div className="mt-2">
                      <span className="bg-chateau/10 text-chateau text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        {matchedUnits.length} ยูนิตตรงเงื่อนไข
                      </span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </CustomerLayout>
  );
};

const FilterPill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors ${
      active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
  >
    {children}
  </button>
);

export default CustomerProperties;
