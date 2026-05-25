import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ArrowLeft, Plus, Trash2, Upload, MapPin, ChevronUp, ChevronDown, Loader2,
  ImageIcon, X,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

// Staff-side editor for property_plans + plan_hotspots.
//
// Authoring flow:
//   1. Pick or upload a plan image (label + type).
//   2. Click anywhere on the image → opens a unit selector → saves a hotspot with
//      x_pct/y_pct = clicked-pixel / image-bbox * 100.
//   3. Drag any existing hotspot to reposition (mouse drag → live x_pct/y_pct).
//   4. Click the pin's × to delete.
//
// Coords are normalized to 0..100 so the same hotspot stays placed regardless of
// the underlying image's actual pixel size (and even if it's re-uploaded later).

interface Plan {
  id: string;
  property_id: string;
  label: string;
  image_url: string;
  plan_type: 'site' | 'floor' | 'other';
  sort_order: number;
}

interface Hotspot {
  id: string;
  plan_id: string;
  unit_id: string;
  x_pct: number;
  y_pct: number;
  label: string | null;
  unit_number?: string;
  unit_status?: string;
}

interface UnitOption {
  id: string;
  unit_number: string;
  status?: string;
}

const PLAN_TYPE_LABEL: Record<Plan['plan_type'], string> = {
  site: 'ผังรวม',
  floor: 'ผังชั้น',
  other: 'อื่นๆ',
};

const STATUS_COLOR: Record<string, string> = {
  available: 'bg-green-500',
  reserved: 'bg-amber-500',
  sold: 'bg-rose-500',
};

export default function PropertyPlansEditor() {
  const { id: propertyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userRole } = useSimpleAuth();

  const allowed = userRole === 'owner' || userRole === 'admin';

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [propertyName, setPropertyName] = useState<string>('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [hotspotsByPlan, setHotspotsByPlan] = useState<Map<string, Hotspot[]>>(new Map());
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Add-plan modal state
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlanLabel, setNewPlanLabel] = useState('');
  const [newPlanType, setNewPlanType] = useState<Plan['plan_type']>('site');
  const [newPlanFile, setNewPlanFile] = useState<File | null>(null);
  const [newPlanPreview, setNewPlanPreview] = useState<string>('');
  const [savingPlan, setSavingPlan] = useState(false);

  // Click-to-add-hotspot flow
  const [pendingHotspot, setPendingHotspot] = useState<{ x_pct: number; y_pct: number } | null>(null);
  const [selectingUnitId, setSelectingUnitId] = useState<string>('');
  const [savingHotspot, setSavingHotspot] = useState(false);

  // Drag state — bare-minimum tracking, no extra library
  const dragRef = useRef<{ hotspotId: string; rect: DOMRect } | null>(null);
  const [dragLivePos, setDragLivePos] = useState<{ id: string; x: number; y: number } | null>(null);

  // Initial load
  useEffect(() => {
    if (!propertyId || !allowed) return;
    const load = async () => {
      setLoading(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: prop } = await (supabase.from('properties') as any)
          .select('id, name').eq('id', propertyId).maybeSingle();
        if (prop) setPropertyName((prop as any).name);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: planRows } = await (supabase.from('property_plans') as any)
          .select('*').eq('property_id', propertyId).order('sort_order', { ascending: true });
        const planList = (planRows || []) as Plan[];
        setPlans(planList);
        if (planList.length > 0 && !activePlanId) setActivePlanId(planList[0].id);

        if (planList.length > 0) {
          const ids = planList.map(p => p.id);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: spotRows } = await (supabase.from('plan_hotspots') as any)
            .select('id, plan_id, unit_id, x_pct, y_pct, label').in('plan_id', ids);
          const spots = (spotRows || []) as Hotspot[];
          const unitIds = Array.from(new Set(spots.map(s => s.unit_id)));
          const unitMap = new Map<string, { unit_number: string; status: string }>();
          if (unitIds.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: us } = await (supabase.from('units') as any)
              .select('id, unit_number, status').in('id', unitIds);
            ((us || []) as any[]).forEach((u: any) => unitMap.set(u.id, { unit_number: u.unit_number, status: u.status }));
          }
          const grouped = new Map<string, Hotspot[]>();
          for (const s of spots) {
            const u = unitMap.get(s.unit_id);
            const arr = grouped.get(s.plan_id) || [];
            arr.push({ ...s, unit_number: u?.unit_number, unit_status: u?.status });
            grouped.set(s.plan_id, arr);
          }
          setHotspotsByPlan(grouped);
        }

        // All units for this property — used by the unit selector dropdown
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allUnits } = await (supabase.from('units') as any)
          .select('id, unit_number, status').eq('project_id', propertyId).order('unit_number');
        setUnits((allUnits || []) as UnitOption[]);
      } catch (err: any) {
        toast.error(err?.message || 'โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    };
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, allowed]);

  const activePlan = plans.find(p => p.id === activePlanId) || null;
  const activeHotspots = (activePlanId && hotspotsByPlan.get(activePlanId)) || [];

  /* ────────── Plan CRUD ────────── */

  const handleSelectImage = (file: File) => {
    setNewPlanFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setNewPlanPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAddPlan = async () => {
    if (!propertyId || !newPlanFile || !newPlanLabel.trim()) {
      toast.error('กรุณาตั้งชื่อและเลือกไฟล์ภาพ');
      return;
    }
    setSavingPlan(true);
    try {
      // Upload to Supabase Storage. We reuse the existing 'projects' bucket
      // under a 'plans/' folder so it's auditable and bucket-policy consistent.
      const ext = newPlanFile.name.split('.').pop() || 'jpg';
      const path = `plans/${propertyId}/${crypto.randomUUID()}.${ext}`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: uploadErr } = await (supabase.storage as any)
        .from('projects')
        .upload(path, newPlanFile, { cacheControl: '3600', upsert: false });
      if (uploadErr) throw uploadErr;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: urlData } = (supabase.storage as any).from('projects').getPublicUrl(path);
      const imageUrl = urlData.publicUrl;

      const nextSort = plans.length > 0 ? Math.max(...plans.map(p => p.sort_order)) + 1 : 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error } = await (supabase.from('property_plans') as any)
        .insert({
          property_id: propertyId,
          label: newPlanLabel.trim(),
          image_url: imageUrl,
          plan_type: newPlanType,
          sort_order: nextSort,
        }).select().single();
      if (error) throw error;
      setPlans(prev => [...prev, row as Plan]);
      setActivePlanId((row as Plan).id);
      toast.success('เพิ่มผังสำเร็จ');
      setShowAddPlan(false);
      setNewPlanLabel(''); setNewPlanFile(null); setNewPlanPreview('');
    } catch (err: any) {
      toast.error(err?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('ลบผังนี้? (รวมหมุดทั้งหมดในผังด้วย)')) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('property_plans') as any).delete().eq('id', planId);
      if (error) throw error;
      const next = plans.filter(p => p.id !== planId);
      setPlans(next);
      if (activePlanId === planId) setActivePlanId(next[0]?.id || null);
      toast.success('ลบผังแล้ว');
    } catch (err: any) {
      toast.error(err?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleReorder = async (planId: string, direction: 'up' | 'down') => {
    const idx = plans.findIndex(p => p.id === planId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= plans.length) return;
    const a = plans[idx]; const b = plans[swapIdx];
    try {
      // Swap sort_order in DB
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('property_plans') as any).update({ sort_order: b.sort_order }).eq('id', a.id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('property_plans') as any).update({ sort_order: a.sort_order }).eq('id', b.id);
      const next = [...plans];
      next[idx] = { ...b, sort_order: a.sort_order };
      next[swapIdx] = { ...a, sort_order: b.sort_order };
      next.sort((x, y) => x.sort_order - y.sort_order);
      setPlans(next);
    } catch (err: any) {
      toast.error(err?.message || 'จัดเรียงไม่สำเร็จ');
    }
  };

  /* ────────── Hotspot authoring ────────── */

  // Convert click coordinates within the image element to percentages of the bbox.
  // We use the rendered image rect (not the natural size) so coordinates stay
  // consistent regardless of CSS sizing.
  const computePctFromEvent = (e: React.MouseEvent<HTMLImageElement>) => {
    const rect = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
    const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
    const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
    return {
      x_pct: Math.max(0, Math.min(100, +x_pct.toFixed(2))),
      y_pct: Math.max(0, Math.min(100, +y_pct.toFixed(2))),
    };
  };

  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!activePlanId) return;
    if (dragLivePos) return; // suppress click that ends a drag
    const { x_pct, y_pct } = computePctFromEvent(e);
    setPendingHotspot({ x_pct, y_pct });
    setSelectingUnitId('');
  };

  const handleSaveHotspot = async () => {
    if (!activePlanId || !pendingHotspot || !selectingUnitId) {
      toast.error('กรุณาเลือกยูนิต');
      return;
    }
    setSavingHotspot(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row, error } = await (supabase.from('plan_hotspots') as any)
        .insert({
          plan_id: activePlanId,
          unit_id: selectingUnitId,
          x_pct: pendingHotspot.x_pct,
          y_pct: pendingHotspot.y_pct,
        }).select().single();
      if (error) throw error;
      const unit = units.find(u => u.id === selectingUnitId);
      const enriched: Hotspot = {
        ...(row as Hotspot),
        unit_number: unit?.unit_number,
        unit_status: unit?.status,
      };
      setHotspotsByPlan(prev => {
        const next = new Map(prev);
        const arr = next.get(activePlanId) || [];
        next.set(activePlanId, [...arr, enriched]);
        return next;
      });
      setPendingHotspot(null);
      setSelectingUnitId('');
      toast.success(`เพิ่มหมุดยูนิต ${unit?.unit_number || ''} แล้ว`);
    } catch (err: any) {
      // unique constraint violation = unit already pinned on this plan
      if (err?.code === '23505') {
        toast.error('ยูนิตนี้มีหมุดบนผังนี้แล้ว — ลบของเดิมก่อนถ้าจะย้าย');
      } else {
        toast.error(err?.message || 'บันทึกไม่สำเร็จ');
      }
    } finally {
      setSavingHotspot(false);
    }
  };

  const handleDeleteHotspot = async (hotspotId: string) => {
    if (!activePlanId) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('plan_hotspots') as any).delete().eq('id', hotspotId);
      if (error) throw error;
      setHotspotsByPlan(prev => {
        const next = new Map(prev);
        const arr = (next.get(activePlanId) || []).filter(h => h.id !== hotspotId);
        next.set(activePlanId, arr);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message || 'ลบไม่สำเร็จ');
    }
  };

  // Drag handlers — works on the image container, not the pin button. The pin
  // sets dragRef on mousedown; the container tracks movement and ultimately
  // commits the new position on mouseup.
  const onPinMouseDown = (e: React.MouseEvent, h: Hotspot) => {
    e.stopPropagation();
    const imgEl = (e.currentTarget as HTMLElement).closest('[data-plan-image-container]') as HTMLElement | null;
    if (!imgEl) return;
    const rect = imgEl.getBoundingClientRect();
    dragRef.current = { hotspotId: h.id, rect };
    setDragLivePos({ id: h.id, x: h.x_pct, y: h.y_pct });
  };

  const onContainerMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current) return;
    const { rect, hotspotId } = dragRef.current;
    const x_pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y_pct = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setDragLivePos({ id: hotspotId, x: x_pct, y: y_pct });
  };

  const onContainerMouseUp = useCallback(async () => {
    if (!dragRef.current || !activePlanId || !dragLivePos) {
      dragRef.current = null;
      setDragLivePos(null);
      return;
    }
    const { hotspotId } = dragRef.current;
    const { x, y } = dragLivePos;
    dragRef.current = null;
    // Persist only if actually moved meaningfully
    const original = (hotspotsByPlan.get(activePlanId) || []).find(h => h.id === hotspotId);
    if (!original || (Math.abs(original.x_pct - x) < 0.1 && Math.abs(original.y_pct - y) < 0.1)) {
      setDragLivePos(null);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('plan_hotspots') as any)
        .update({ x_pct: +x.toFixed(2), y_pct: +y.toFixed(2) }).eq('id', hotspotId);
      if (error) throw error;
      setHotspotsByPlan(prev => {
        const next = new Map(prev);
        const arr = (next.get(activePlanId) || []).map(h =>
          h.id === hotspotId ? { ...h, x_pct: +x.toFixed(2), y_pct: +y.toFixed(2) } : h
        );
        next.set(activePlanId, arr);
        return next;
      });
    } catch (err: any) {
      toast.error(err?.message || 'บันทึกตำแหน่งไม่สำเร็จ');
    } finally {
      setDragLivePos(null);
    }
  }, [activePlanId, dragLivePos, hotspotsByPlan]);

  if (!allowed) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">หน้านี้สำหรับ Admin/Owner เท่านั้น</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6">
          <div className="space-y-5 max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <Button variant="outline" size="sm" onClick={() => navigate(`/properties`)} className="mb-2">
                  <ArrowLeft className="w-4 h-4 mr-1" /> กลับโครงการ
                </Button>
                <h1 className="text-2xl font-bold text-gray-900">จัดการผังโครงการ</h1>
                <p className="text-sm text-gray-500">{propertyName}</p>
              </div>
              <Button onClick={() => setShowAddPlan(true)}>
                <Plus className="w-4 h-4 mr-1" /> เพิ่มผัง
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-gray-300" />
              </div>
            ) : plans.length === 0 ? (
              <Card>
                <CardContent className="pt-10 pb-10 text-center">
                  <ImageIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 mb-4">ยังไม่มีผังโครงการ</p>
                  <Button onClick={() => setShowAddPlan(true)}>
                    <Plus className="w-4 h-4 mr-1" /> เพิ่มผังแรก
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
                {/* Plan list (left) */}
                <Card className="lg:col-span-1">
                  <CardContent className="p-3 space-y-2">
                    {plans.map((p, i) => (
                      <div
                        key={p.id}
                        onClick={() => setActivePlanId(p.id)}
                        className={`p-2 rounded-lg cursor-pointer transition-colors ${
                          activePlanId === p.id ? 'bg-chateau/10 border border-chateau/30' : 'hover:bg-gray-50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-12 h-9 bg-gray-100 rounded overflow-hidden flex-shrink-0">
                            <img src={p.image_url} alt={p.label} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate">{p.label}</p>
                            <p className="text-[10px] text-gray-500">{PLAN_TYPE_LABEL[p.plan_type]}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2 -mx-1">
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReorder(p.id, 'up'); }}
                              disabled={i === 0}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="เลื่อนขึ้น"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleReorder(p.id, 'down'); }}
                              disabled={i === plans.length - 1}
                              className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                              title="เลื่อนลง"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeletePlan(p.id); }}
                            className="p-1 text-red-500 hover:text-red-700"
                            title="ลบผัง"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Active plan canvas (right) */}
                <Card className="lg:col-span-3">
                  <CardContent className="p-4">
                    {activePlan && (
                      <>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">{activePlan.label}</p>
                            <p className="text-[11px] text-gray-500">
                              คลิกที่ภาพเพื่อเพิ่มหมุด · ลากหมุดเพื่อย้ายตำแหน่ง · {activeHotspots.length} หมุด
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />ว่าง</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />จอง</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />ขาย</span>
                          </div>
                        </div>

                        <div
                          data-plan-image-container
                          onMouseMove={onContainerMouseMove}
                          onMouseUp={onContainerMouseUp}
                          onMouseLeave={onContainerMouseUp}
                          className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-50 select-none"
                        >
                          <img
                            src={activePlan.image_url}
                            alt={activePlan.label}
                            onClick={onImageClick}
                            className="w-full block cursor-crosshair"
                            draggable={false}
                          />
                          {activeHotspots.map(h => {
                            const isDragging = dragLivePos?.id === h.id;
                            const x = isDragging ? dragLivePos!.x : h.x_pct;
                            const y = isDragging ? dragLivePos!.y : h.y_pct;
                            const color = STATUS_COLOR[h.unit_status || ''] || 'bg-gray-400';
                            return (
                              <div
                                key={h.id}
                                className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
                                style={{ left: `${x}%`, top: `${y}%` }}
                              >
                                <div className="relative group">
                                  <button
                                    onMouseDown={(e) => onPinMouseDown(e, h)}
                                    className={`flex items-center justify-center px-2 h-7 min-w-[2rem] rounded-full text-white text-[10px] font-bold shadow-md ring-2 ring-white cursor-move ${color}`}
                                    title={`ยูนิต ${h.unit_number} — ลากเพื่อย้าย`}
                                  >
                                    {h.unit_number || '·'}
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteHotspot(h.id); }}
                                    className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center shadow"
                                    title="ลบหมุด"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                          {pendingHotspot && (
                            <div
                              className="absolute -translate-x-1/2 -translate-y-1/2 z-20"
                              style={{ left: `${pendingHotspot.x_pct}%`, top: `${pendingHotspot.y_pct}%` }}
                            >
                              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-chateau text-white shadow-lg ring-4 ring-chateau/30 animate-pulse">
                                <MapPin className="w-3.5 h-3.5" />
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Pending hotspot — unit picker */}
                        {pendingHotspot && (
                          <div className="mt-3 p-3 border border-chateau/30 bg-chateau/5 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-chateau" />
                              <p className="text-sm font-semibold text-gray-900">ผูกหมุดกับยูนิต</p>
                              <span className="text-[11px] text-gray-500 ml-auto">
                                ตำแหน่ง: {pendingHotspot.x_pct}%, {pendingHotspot.y_pct}%
                              </span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Select value={selectingUnitId} onValueChange={setSelectingUnitId}>
                                <SelectTrigger className="flex-1 min-w-[200px]">
                                  <SelectValue placeholder="เลือกยูนิต..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {units.length === 0 ? (
                                    <div className="px-3 py-2 text-sm text-gray-400">ไม่มียูนิตในโครงการ</div>
                                  ) : units.map(u => (
                                    <SelectItem key={u.id} value={u.id}>
                                      ยูนิต {u.unit_number}
                                      <span className="text-gray-400 ml-2 text-xs">({u.status || '-'})</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button onClick={handleSaveHotspot} disabled={savingHotspot || !selectingUnitId}>
                                {savingHotspot ? 'กำลังบันทึก...' : 'บันทึกหมุด'}
                              </Button>
                              <Button variant="outline" onClick={() => { setPendingHotspot(null); setSelectingUnitId(''); }}>
                                ยกเลิก
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Add-plan modal */}
            {showAddPlan && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-gray-900">เพิ่มผังใหม่</h3>
                      <button onClick={() => setShowAddPlan(false)} className="text-gray-400 hover:text-gray-700">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    <div>
                      <Label className="text-sm">ชื่อผัง</Label>
                      <Input
                        value={newPlanLabel}
                        onChange={(e) => setNewPlanLabel(e.target.value)}
                        placeholder="เช่น ผังรวม / ชั้น 1 / ชั้น 2"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label className="text-sm">ประเภท</Label>
                      <Select value={newPlanType} onValueChange={(v) => setNewPlanType(v as Plan['plan_type'])}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="site">ผังรวม (Site Plan)</SelectItem>
                          <SelectItem value="floor">ผังชั้น (Floor Plan)</SelectItem>
                          <SelectItem value="other">อื่นๆ</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm">ภาพผัง</Label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => e.target.files && e.target.files[0] && handleSelectImage(e.target.files[0])}
                        className="mt-1 block w-full text-sm"
                      />
                      {newPlanPreview && (
                        <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                          <img src={newPlanPreview} alt="preview" className="w-full max-h-48 object-contain bg-gray-50" />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowAddPlan(false)} disabled={savingPlan}>ยกเลิก</Button>
                      <Button onClick={handleAddPlan} disabled={savingPlan || !newPlanFile || !newPlanLabel.trim()}>
                        {savingPlan ? (
                          <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> กำลังบันทึก</>
                        ) : (
                          <><Upload className="w-4 h-4 mr-1" /> เพิ่มผัง</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
