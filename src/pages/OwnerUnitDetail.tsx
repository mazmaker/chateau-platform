import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Home,
  ArrowLeft,
  ArrowUpRight,
  MapPin,
  ChevronRight,
  Loader2,
  BedDouble,
  Bath,
  Car,
  Compass,
  Layers,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

// ──────────────────────────────────────────────────────────────────────────
// Owner "รายละเอียดยูนิต" (L3) — full read-only inventory page.
// Mirrors the Admin UnitDetail spec sheet (gallery / specs / highlights /
// floor-plan & 3D / map) but as a CONTROL-PLANE view: no leads, no sales
// assignment, no booking / share / edit actions, and — critically — NO
// customer PII columns are even selected from the DB (data minimisation, PDPA).
// Owner reaches this via the L2 unit card in OwnerProjects.
// ──────────────────────────────────────────────────────────────────────────

// Soft luxury palette — identical tokens to OwnerProjects/OwnerDashboard.
const KK = {
  red: '#ef4444', redLight: '#fef2f2', redBorder: '#fecaca',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  slate: '#475569', slateLight: '#f1f5f9',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};

// Compact currency — Thai real-estate convention "X ล้าน" / "K" (NOT M/B).
// Copied verbatim from Index.tsx / OwnerProjects (the canonical formatter).
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 1000) return `${sign}฿${Math.round(m).toLocaleString('en-US')} ล้าน`;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${abs.toFixed(0)}`;
};

// Unit status → Thai label + KK color (same palette/convention as OwnerProjects).
const UNIT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  sold:      { label: 'ขายแล้ว', color: KK.red,   bg: KK.redLight },
  reserved:  { label: 'จองอยู่',  color: KK.amber, bg: KK.amberLight },
  available: { label: 'ว่าง',     color: KK.green, bg: KK.greenLight },
};
const unitStatusMeta = (s: string | null) => UNIT_STATUS[s || 'available'] || UNIT_STATUS.available;

// Furnishing enum → Thai label (mirrors Admin UnitDetail highlights).
const furnishingLabel = (f: string | null): string | null => {
  if (!f) return null;
  if (f === 'fully') return 'ตกแต่งครบ พร้อมอยู่';
  if (f === 'partial') return 'ตกแต่งบางส่วน';
  if (f === 'unfurnished') return 'ไม่ตกแต่ง';
  return f;
};

// Inventory-only unit shape — deliberately excludes every PII / operational
// field (reserved customer name/phone/lead id, deposit, reservation notes,
// internal notes, locked_by). Those columns are never even selected.
interface UnitInventory {
  unit_number: string | null;
  unit_type: string | null;
  building: string | null;
  floor_number: number | null;
  floor_count: number | null;
  plot_number: string | null;
  area_sqm: number | null;
  land_area_sqw: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spaces: number | null;
  facing_direction: string | null;
  view: string | null;
  furnishing: string | null;
  layout_description: string | null;
  balcony: boolean | null;
  garden: boolean | null;
  pool: boolean | null;
  price: number | null;
  price_per_sqm: number | null;
  discount_amount: number | null;
  promo_price: number | null;
  status: string | null;
  availability_date: string | null;
  sold_at: string | null;
  reserved_at: string | null;
  updated_at: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  floor_plan_url: string | null;
  tour_3d_url: string | null;
  project_id: string;
}

interface PropertyLite {
  name: string;
  developer: string | null;
  address: { street?: string; province?: string; district?: string } | null;
  location_lat: number | null;
  location_lng: number | null;
}

const UNIT_SELECT =
  'unit_number, unit_type, building, floor_number, floor_count, plot_number, area_sqm, land_area_sqw, bedrooms, bathrooms, parking_spaces, facing_direction, view, furnishing, layout_description, balcony, garden, pool, price, price_per_sqm, discount_amount, promo_price, status, availability_date, sold_at, reserved_at, updated_at, thumbnail_url, images, floor_plan_url, tour_3d_url, project_id';

// Read-only label/value pair (same style as OwnerProjects DetailField).
// Renders nothing when the value is empty so we only surface filled fields.
const InfoCell = ({ label, value }: { label: string; value: React.ReactNode }) => {
  if (value === null || value === undefined || value === '' || value === '–') return null;
  return (
    <div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-gray-900 break-words">{value}</p>
    </div>
  );
};

// Icon stat cell for room counts (mirrors Admin IconCell, read-only).
const IconStat = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) => (
  <div className="flex flex-col items-center justify-center text-center py-3 rounded-xl bg-gray-50 border border-gray-100">
    <Icon className="w-5 h-5 mb-1" style={{ color: KK.slate }} />
    <p className="text-base font-bold text-gray-900 tabular-nums leading-none">{value}</p>
    <p className="text-xs text-gray-400 mt-1">{label}</p>
  </div>
);

const OwnerUnitDetail = () => {
  const navigate = useNavigate();
  const { tenantId, projectId, unitId } = useParams();
  const { isOwner } = usePermissions();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [unit, setUnit] = useState<UnitInventory | null>(null);
  const [property, setProperty] = useState<PropertyLite | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    if (!unitId) { setNotFound(true); setLoading(false); return; }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setNotFound(false);
      setUnit(null);
      setProperty(null);
      setActiveImage(0);
      try {
        // 1) Unit — inventory columns only (no PII selected).
        const { data: u, error: uErr } = await supabase
          .from('units')
          .select(UNIT_SELECT)
          .eq('id', unitId)
          .single();
        if (cancelled) return;
        if (uErr || !u) { setNotFound(true); return; }
        const unitRow = u as unknown as UnitInventory;
        setUnit(unitRow);

        // 2) Property of this unit (for header location + map).
        const pid = unitRow.project_id || projectId;
        const [pRes, tRes] = await Promise.all([
          pid
            ? supabase.from('properties').select('name, developer, address, location_lat, location_lng').eq('id', pid).single()
            : Promise.resolve({ data: null }),
          tenantId
            ? supabase.from('tenants').select('name').eq('id', tenantId).single()
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        if (pRes.data) setProperty(pRes.data as unknown as PropertyLite);
        if (tRes.data) setTenantName((tRes.data as { name: string }).name || '');
      } catch (e) {
        if (!cancelled) {
          console.error('OwnerUnitDetail fetch error:', e);
          setNotFound(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [isOwner, unitId, projectId, tenantId, navigate]);

  const shell = (children: React.ReactNode) => (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7 max-w-5xl mx-auto">{children}</main>
        </div>
      </div>
    </OwnerGuard>
  );

  const backToUnits = () => navigate(`/owner-projects/${tenantId}/${projectId}`);

  if (loading) {
    return shell(
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-300 mb-3" />
        <p className="text-sm text-gray-500">กำลังโหลดรายละเอียดยูนิต...</p>
      </div>
    );
  }

  if (notFound || !unit) {
    return shell(
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
        <Home className="w-12 h-12 text-gray-300 mb-3" />
        <p className="text-base font-bold text-gray-900">ไม่พบยูนิตนี้</p>
        <p className="text-sm text-gray-500 mt-1 mb-5">ยูนิตอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง</p>
        <button onClick={backToUnits} className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับไปยูนิตในโครงการ
        </button>
      </div>
    );
  }

  const meta = unitStatusMeta(unit.status);
  // Gallery = thumbnail first, then images[] — dedupe, keep only truthy.
  const gallery = Array.from(
    new Set([unit.thumbnail_url, ...(unit.images || [])].filter(Boolean) as string[])
  );
  const heroSrc = gallery[Math.min(activeImage, Math.max(0, gallery.length - 1))];

  // Amenity chips — only the ones actually flagged true.
  const amenities = [
    unit.balcony ? 'ระเบียง' : null,
    unit.garden ? 'สวน' : null,
    unit.pool ? 'สระว่ายน้ำ' : null,
  ].filter(Boolean) as string[];

  const hasPromo = unit.promo_price != null && unit.price != null && unit.promo_price < unit.price;
  const discountPct = hasPromo
    ? Math.round(((Number(unit.price) - Number(unit.promo_price)) / Number(unit.price)) * 100)
    : 0;

  const fLabel = furnishingLabel(unit.furnishing);
  const hasHighlights = !!(unit.view || fLabel || amenities.length > 0 || unit.layout_description);

  // Floor label — prefer "X ชั้น" for multi-storey houses, else single floor number.
  const floorValue =
    unit.floor_count && unit.floor_count > 1
      ? `${unit.floor_count} ชั้น`
      : unit.floor_number != null
      ? `ชั้น ${unit.floor_number}`
      : null;

  const provinceLine = [property?.address?.district, property?.address?.province].filter(Boolean).join(' · ');
  const fullAddress =
    property?.address?.street ||
    [property?.address?.district, property?.address?.province].filter(Boolean).join(', ') ||
    '';

  return shell(
    <>
      {/* Back + Breadcrumb */}
      <div>
        <button onClick={backToUnits} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" /> กลับไปยูนิตในโครงการ
        </button>
        <nav className="flex items-center gap-1.5 text-sm text-gray-500 mb-3 flex-wrap">
          <button onClick={() => navigate('/owner-projects')} className="hover:text-gray-900 transition-colors">ทุกบริษัท</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <button onClick={() => navigate(`/owner-projects/${tenantId}`)} className="hover:text-gray-900 transition-colors">{tenantName || 'บริษัท'}</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <button onClick={backToUnits} className="hover:text-gray-900 transition-colors">{property?.name || 'โครงการ'}</button>
          <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
          <span className="text-gray-900 font-medium">ยูนิต {unit.unit_number || '–'}</span>
        </nav>
        <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
          รายละเอียดยูนิต
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">ยูนิต {unit.unit_number || '–'}</h1>
          <Badge style={{ backgroundColor: meta.bg, color: meta.color, border: 'none' }}>{meta.label}</Badge>
        </div>
        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-2 flex-wrap">
          {property?.name && <span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {property.name}</span>}
          {property?.name && provinceLine && <span className="text-gray-300">·</span>}
          {provinceLine && (
            <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {provinceLine}</span>
          )}
        </p>
      </div>

      {/* Gallery — hero + thumbnail strip (click to swap) */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
        {gallery.length > 0 ? (
          <>
            <div className="rounded-xl overflow-hidden bg-gray-100 aspect-video">
              <img
                src={heroSrc}
                alt={unit.unit_number || 'unit'}
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            {gallery.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {gallery.map((src, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`w-24 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-colors ${i === activeImage ? 'border-rose-400' : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl bg-gray-50 aspect-video flex flex-col items-center justify-center text-gray-300">
            <Home className="w-12 h-12 mb-2" />
            <span className="text-sm text-gray-400">ไม่มีรูปภาพยูนิต</span>
          </div>
        )}
      </div>

      {/* ราคา */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
        <h2 className="text-base font-bold text-gray-900 mb-3">ราคา</h2>
        <div className="flex flex-wrap items-baseline gap-3">
          {hasPromo ? (
            <>
              <span className="text-3xl font-bold tabular-nums" style={{ color: KK.red }}>{fmtCompact(Number(unit.promo_price))}</span>
              <span className="text-lg text-gray-400 line-through tabular-nums">{fmtCompact(Number(unit.price))}</span>
              {discountPct > 0 && (
                <Badge style={{ backgroundColor: KK.redLight, color: KK.red, border: 'none' }}>ลด {discountPct}%</Badge>
              )}
            </>
          ) : (
            <span className="text-3xl font-bold text-gray-900 tabular-nums">{unit.price != null ? fmtCompact(Number(unit.price)) : '–'}</span>
          )}
        </div>
        {unit.price_per_sqm != null && (
          <p className="text-sm text-gray-500 mt-2 tabular-nums">{fmtCompact(Number(unit.price_per_sqm))} / ตร.ม.</p>
        )}
      </div>

      {/* ข้อมูลยูนิต */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4">ข้อมูลยูนิต</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
          <InfoCell label="เลขที่ยูนิต" value={unit.unit_number} />
          <InfoCell label="ประเภท" value={unit.unit_type} />
          <InfoCell label="อาคาร" value={unit.building} />
          <InfoCell label="เลขแปลง" value={unit.plot_number} />
          <InfoCell label={unit.floor_count && unit.floor_count > 1 ? 'จำนวนชั้น' : 'ชั้น'} value={floorValue} />
          <InfoCell label="พื้นที่ใช้สอย" value={unit.area_sqm != null ? `${Number(unit.area_sqm).toLocaleString()} ตร.ม.` : null} />
          <InfoCell label="ที่ดิน" value={unit.land_area_sqw != null ? `${Number(unit.land_area_sqw).toLocaleString()} ตร.ว.` : null} />
          <InfoCell
            label="ทิศ"
            value={unit.facing_direction ? <span className="inline-flex items-center gap-1"><Compass className="w-3.5 h-3.5 text-gray-400" />{unit.facing_direction}</span> : null}
          />
        </div>
        {(unit.bedrooms != null || unit.bathrooms != null || unit.parking_spaces != null) && (
          <div className="grid grid-cols-3 gap-3 mt-4">
            {unit.bedrooms != null && <IconStat icon={BedDouble} label="ห้องนอน" value={unit.bedrooms} />}
            {unit.bathrooms != null && <IconStat icon={Bath} label="ห้องน้ำ" value={unit.bathrooms} />}
            {unit.parking_spaces != null && <IconStat icon={Car} label="ที่จอดรถ" value={unit.parking_spaces} />}
          </div>
        )}
      </div>

      {/* จุดเด่นยูนิต — only when at least one value exists */}
      {hasHighlights && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4">จุดเด่นยูนิต</h2>
          <div className="space-y-3">
            {(unit.view || fLabel) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                <InfoCell label="วิว" value={unit.view} />
                <InfoCell label="สถานะตกแต่ง" value={fLabel} />
              </div>
            )}
            {amenities.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 mb-1.5">สิ่งอำนวยความสะดวก</p>
                <div className="flex flex-wrap gap-2">
                  {amenities.map((a) => (
                    <span key={a} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium" style={{ color: KK.blue, backgroundColor: KK.blueLight }}>{a}</span>
                  ))}
                </div>
              </div>
            )}
            {unit.layout_description && (
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-xs text-gray-400 mb-1.5">รายละเอียดผัง</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">{unit.layout_description}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* แผนผัง & 3D — only when at least one asset exists */}
      {(unit.floor_plan_url || unit.tour_3d_url) && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
          <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Layers className="w-4 h-4" style={{ color: KK.slate }} /> แผนผัง &amp; 3D
          </h2>
          {unit.floor_plan_url && (
            <div className="mb-4">
              <p className="text-xs text-gray-400 mb-2">ผังห้อง</p>
              <img
                src={unit.floor_plan_url}
                alt="ผังห้อง"
                className="w-full max-h-[480px] object-contain rounded-xl border border-gray-100 bg-white"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
          )}
          {unit.tour_3d_url && (
            <a
              href={unit.tour_3d_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors"
              style={{ backgroundColor: KK.red }}
            >
              เปิด 3D Virtual Tour <ArrowUpRight className="w-4 h-4" />
            </a>
          )}
        </div>
      )}

      {/* แผนที่ตำแหน่งโครงการ */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
        <h2 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4" style={{ color: KK.slate }} /> แผนที่ตำแหน่งโครงการ
        </h2>
        {property?.location_lat && property?.location_lng ? (
          <>
            <div className="rounded-xl overflow-hidden border border-gray-100">
              <iframe
                title={`แผนที่ ${property.name}`}
                src={`https://www.google.com/maps?q=${property.location_lat},${property.location_lng}&hl=th&z=15&output=embed`}
                width="100%"
                height="320"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            {fullAddress && <p className="text-sm text-gray-500 mt-2">{fullAddress}</p>}
          </>
        ) : (
          <div className="py-10 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
            <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">ยังไม่ได้ตั้งค่าตำแหน่งโครงการ</p>
          </div>
        )}
      </div>
    </>
  );
};

export default OwnerUnitDetail;
