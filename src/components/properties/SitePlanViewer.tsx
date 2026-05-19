import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Loader2, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';

// Read-only viewer for property_plans + plan_hotspots.
//
// Renders a tabbed plan switcher and an image with clickable hotspot pins.
// Hotspots are stored as percentages so they stay correctly positioned at any
// viewport size — we just absolutely-position them with `left: x_pct%`.
//
// Pin color follows unit.status (green/amber/red/gray) so a customer can see
// availability at a glance and click straight through to the unit detail page.

interface Plan {
  id: string;
  label: string;
  image_url: string;
  plan_type: string;
  sort_order: number;
}

interface Hotspot {
  id: string;
  plan_id: string;
  unit_id: string;
  x_pct: number;
  y_pct: number;
  label: string | null;
  // resolved at fetch time
  unit_number?: string;
  unit_status?: string;
}

interface SitePlanViewerProps {
  propertyId: string;
  /** When provided, that hotspot is highlighted (pulse + ring) — useful when
   *  viewing from a unit detail page so the customer can spot "I am here". */
  highlightUnitId?: string;
  /** Base path for hotspot navigation. Customer pages → "/customer/units",
   *  staff pages → "/units". Defaults to auto-detect via current URL. */
  linkPrefix?: string;
  /** Optional click handler override — bypasses linkPrefix entirely. */
  onHotspotClick?: (unitId: string) => void;
  /** Hide the section entirely (return null) when no plans exist. Default true. */
  hideWhenEmpty?: boolean;
}

const STATUS_COLOR: Record<string, { bg: string; ring: string; label: string }> = {
  available: { bg: 'bg-green-500',  ring: 'ring-green-200',  label: 'ว่าง' },
  reserved:  { bg: 'bg-amber-500',  ring: 'ring-amber-200',  label: 'จอง' },
  sold:      { bg: 'bg-rose-500',   ring: 'ring-rose-200',   label: 'ขาย' },
  unknown:   { bg: 'bg-gray-400',   ring: 'ring-gray-200',   label: '-' },
};

const colorFor = (status?: string) => STATUS_COLOR[status || 'unknown'] || STATUS_COLOR.unknown;

export default function SitePlanViewer({
  propertyId,
  highlightUnitId,
  linkPrefix,
  onHotspotClick,
  hideWhenEmpty = true,
}: SitePlanViewerProps) {
  const navigate = useNavigate();
  // Auto-detect the link space if the caller didn't specify one. This way the
  // same viewer dropped in either context routes correctly without the caller
  // having to remember the prefix.
  const effectivePrefix = linkPrefix ?? (
    typeof window !== 'undefined' && window.location.pathname.startsWith('/customer/')
      ? '/customer/units'
      : '/units'
  );
  const [plans, setPlans] = useState<Plan[]>([]);
  const [hotspotsByPlan, setHotspotsByPlan] = useState<Map<string, Hotspot[]>>(new Map());
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Zoom/pan state — image-only (the tabs stay fixed at the top).
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  useEffect(() => {
    const load = async () => {
      if (!propertyId) return;
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: planRows } = await (supabase.from('property_plans') as any)
          .select('id, label, image_url, plan_type, sort_order')
          .eq('property_id', propertyId)
          .order('sort_order', { ascending: true });
        const planList = (planRows || []) as Plan[];
        setPlans(planList);

        if (planList.length === 0) {
          setHotspotsByPlan(new Map());
          setActivePlanId(null);
          return;
        }
        setActivePlanId(planList[0].id);

        const planIds = planList.map(p => p.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: spotRows } = await (supabase.from('plan_hotspots') as any)
          .select('id, plan_id, unit_id, x_pct, y_pct, label')
          .in('plan_id', planIds);
        const spots = (spotRows || []) as Hotspot[];

        // Resolve unit number + status in one round-trip
        const unitIds = Array.from(new Set(spots.map(s => s.unit_id)));
        const unitMap = new Map<string, { unit_number: string; status: string }>();
        if (unitIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: units } = await (supabase.from('units') as any)
            .select('id, unit_number, status')
            .in('id', unitIds);
          ((units || []) as any[]).forEach((u: any) => unitMap.set(u.id, { unit_number: u.unit_number, status: u.status }));
        }

        const grouped = new Map<string, Hotspot[]>();
        for (const s of spots) {
          const u = unitMap.get(s.unit_id);
          const enriched: Hotspot = {
            ...s,
            unit_number: u?.unit_number,
            unit_status: u?.status,
          };
          const arr = grouped.get(s.plan_id) || [];
          arr.push(enriched);
          grouped.set(s.plan_id, arr);
        }
        setHotspotsByPlan(grouped);
      } catch (err) {
        console.error('SitePlanViewer load error:', err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [propertyId]);

  // Reset zoom/pan when switching plans — disorienting to keep zoom across a different image.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [activePlanId]);

  const handleHotspotClick = useCallback((unitId: string) => {
    // If we just finished a pan gesture, the click that triggered ended also fires here.
    // We don't suppress that here because pointer events distinguish drag from click well
    // enough at our scale; if it becomes a problem, gate with a "wasDragging" flag.
    if (onHotspotClick) onHotspotClick(unitId);
    else navigate(`${effectivePrefix}/${unitId}`);
  }, [navigate, onHotspotClick, effectivePrefix]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return; // only allow pan when zoomed in
    isPanningRef.current = true;
    panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isPanningRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    setPan({ x: panStartRef.current.panX + dx, y: panStartRef.current.panY + dy });
  };
  const stopPanning = () => { isPanningRef.current = false; };

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-gray-300" />
      </div>
    );
  }

  if (plans.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-5 text-center text-sm text-gray-400">
        ยังไม่มีผังโครงการ
      </div>
    );
  }

  const activePlan = plans.find(p => p.id === activePlanId) || plans[0];
  const activeHotspots = (activePlanId && hotspotsByPlan.get(activePlanId)) || [];

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-600" /> ผังโครงการ
          {activeHotspots.length > 0 && (
            <span className="text-[10px] text-gray-400 font-normal">· คลิกที่หมุดเพื่อดูยูนิต</span>
          )}
        </h2>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />ว่าง</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />จอง</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />ขาย</span>
        </div>
      </div>

      {/* Plan tabs — only show if there's more than one plan. Single-plan projects
          skip the visual clutter. */}
      {plans.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto mb-3 pb-1">
          {plans.map(p => (
            <button
              key={p.id}
              onClick={() => setActivePlanId(p.id)}
              className={`px-3 h-8 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                p.id === activePlanId
                  ? 'bg-chateau text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {/* Plan image + hotspots — relative container so absolutely-positioned pins
          align to the image bounds, not the page. overflow-hidden clips zoom-pan. */}
      <div
        className="relative rounded-xl overflow-hidden border border-gray-100 bg-gray-50 select-none"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopPanning}
        onMouseLeave={stopPanning}
        style={{ cursor: zoom > 1 ? (isPanningRef.current ? 'grabbing' : 'grab') : 'default' }}
      >
        <div
          className="relative w-full"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isPanningRef.current ? 'none' : 'transform 0.2s ease-out',
          }}
        >
          <img
            src={activePlan.image_url}
            alt={activePlan.label}
            className="w-full block pointer-events-none"
            draggable={false}
          />
          {activeHotspots.map(h => {
            const c = colorFor(h.unit_status);
            const highlighted = highlightUnitId === h.unit_id;
            return (
              <button
                key={h.id}
                onClick={(e) => { e.stopPropagation(); handleHotspotClick(h.unit_id); }}
                className={`absolute -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110 ${
                  highlighted ? 'z-10' : 'z-0'
                }`}
                style={{ left: `${h.x_pct}%`, top: `${h.y_pct}%` }}
                title={h.label || h.unit_number || ''}
              >
                <span
                  className={`flex items-center justify-center px-2 h-7 min-w-[2rem] rounded-full text-white text-[10px] font-bold shadow-md ring-4 ${c.bg} ${c.ring} ${
                    highlighted ? 'animate-pulse ring-8' : ''
                  }`}
                >
                  {h.label || h.unit_number || '·'}
                </span>
              </button>
            );
          })}
        </div>

        {/* Zoom controls — bottom-right, subtle. Useful for crowded plans with many pins close together. */}
        <div className="absolute bottom-3 right-3 flex flex-col gap-1 z-20">
          <button
            onClick={() => setZoom(z => Math.min(3, +(z + 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-md text-gray-700 hover:bg-white flex items-center justify-center"
            title="ขยาย"
            aria-label="ขยาย"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
            className="w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-md text-gray-700 hover:bg-white flex items-center justify-center"
            title="ย่อ"
            aria-label="ย่อ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          {(zoom !== 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="w-8 h-8 rounded-full bg-white/95 backdrop-blur shadow-md text-gray-700 hover:bg-white flex items-center justify-center"
              title="รีเซ็ต"
              aria-label="รีเซ็ตการขยาย"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {activeHotspots.length === 0 && (
        <p className="text-[11px] text-gray-400 mt-3 text-center">
          ผังนี้ยังไม่มีการระบุตำแหน่งยูนิต
        </p>
      )}
    </div>
  );
}
