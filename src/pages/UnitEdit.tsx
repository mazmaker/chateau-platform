import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft, Save, Loader2, Plus, X, Bed, Bath, Square, Layers,
  FileText, Building2, MapPin, DollarSign, Home, ImagePlus,
} from 'lucide-react';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';

type UnitStatus = 'available' | 'reserved' | 'sold' | 'unavailable';
type Furnishing = '' | 'fully' | 'partial' | 'unfurnished';

const UnitEdit = () => {
  const { unitId } = useParams<{ unitId: string }>();
  const navigate = useNavigate();
  const { currentTenant, userRole } = useSimpleAuth();

  // Sales/Agent/Customer cannot edit unit master data — redirect to detail
  useEffect(() => {
    if (userRole && userRole !== 'owner' && userRole !== 'admin') {
      toast.error('ไม่มีสิทธิ์แก้ไขยูนิต — เฉพาะ Admin/Owner เท่านั้น');
      navigate(`/units/${unitId}`);
    }
  }, [userRole, unitId, navigate]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [projectId, setProjectId] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');

  const [form, setForm] = useState({
    unit_number: '',
    floor: '',
    size_sqm: '',
    land_area_sqw: '',
    bedrooms: '',
    bathrooms: '',
    floor_count: '',
    price: '',
    thumbnail: null as File | null,
    thumbnail_preview: '',
    image_items: [] as { url: string; file?: File }[],
    description: '',
    status: 'available' as UnitStatus,
    promo_price: '',
    plot_number: '',
    view: '',
    furnishing: '' as Furnishing,
    floor_plan_url: '',
    tour_3d_url: '',
    parking_spaces: '',
    facing_direction: '',
    building: '',
    pool: false,
    garden: false,
    balcony: false,
  });

  /* ─── Load unit ─── */
  useEffect(() => {
    if (!unitId) return;
    load();
  }, [unitId]);

  const load = async () => {
    if (!unitId) return;
    setLoading(true);
    try {
      const { data: unit, error } = await supabase
        .from('units')
        .select('*')
        .eq('id', unitId)
        .single();
      if (error || !unit) {
        toast.error('ไม่พบยูนิต');
        navigate('/properties');
        return;
      }
      setProjectId(unit.project_id);
      const { data: proj } = await supabase
        .from('properties')
        .select('name')
        .eq('id', unit.project_id)
        .single();
      setProjectName(proj?.name || '');

      setForm({
        unit_number: unit.unit_number || '',
        floor: unit.floor_number?.toString() || '',
        size_sqm: unit.area_sqm?.toString() || '',
        land_area_sqw: unit.land_area_sqw?.toString() || '',
        bedrooms: unit.bedrooms?.toString() || '',
        bathrooms: unit.bathrooms?.toString() || '',
        floor_count: unit.floor_count?.toString() || '',
        price: unit.price?.toString() || '',
        thumbnail: null,
        thumbnail_preview: unit.thumbnail_url || '',
        image_items: (unit.images || []).map((url: string) => ({ url })),
        description: unit.layout_description || '',
        status: (unit.status as UnitStatus) || 'available',
        promo_price: unit.promo_price?.toString() || '',
        plot_number: unit.plot_number || '',
        view: unit.view || '',
        furnishing: (unit.furnishing as Furnishing) || '',
        floor_plan_url: unit.floor_plan_url || '',
        tour_3d_url: unit.tour_3d_url || '',
        parking_spaces: unit.parking_spaces?.toString() || '',
        facing_direction: unit.facing_direction || '',
        building: unit.building || '',
        pool: !!unit.pool,
        garden: !!unit.garden,
        balcony: !!unit.balcony,
      });
    } catch (err) {
      console.error(err);
      toast.error('โหลดข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Upload helpers ─── */
  const uploadImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const ext = file.name.split('.').pop();
      const path = `${currentTenant?.id}/${projectId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;
      const { data, error } = await supabase.storage
        .from('units')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) { console.error(error); return null; }
      const { data: url } = supabase.storage.from('units').getPublicUrl(data.path);
      return url.publicUrl;
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  /* ─── Image handlers ─── */
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (form.thumbnail_preview?.startsWith('blob:')) URL.revokeObjectURL(form.thumbnail_preview);
    setForm((p) => ({ ...p, thumbnail: file, thumbnail_preview: URL.createObjectURL(file) }));
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newItems = files.map((file) => ({ url: URL.createObjectURL(file), file }));
    setForm((p) => ({ ...p, image_items: [...p.image_items, ...newItems] }));
  };

  const removeImage = (idx: number) => {
    const item = form.image_items[idx];
    if (item?.url.startsWith('blob:')) URL.revokeObjectURL(item.url);
    setForm((p) => ({ ...p, image_items: p.image_items.filter((_, i) => i !== idx) }));
  };

  /* ─── Save ─── */
  const handleSave = async () => {
    if (!unitId || !currentTenant) return;
    if (!form.unit_number) { toast.error('กรุณากรอกเลขที่ยูนิต'); return; }
    if (!form.price) { toast.error('กรุณากรอกราคา'); return; }
    setSaving(true);
    try {
      let thumbnailUrl: string | null = null;
      if (form.thumbnail) thumbnailUrl = await uploadImage(form.thumbnail, 'thumbnails');

      const finalImages: string[] = [];
      for (const item of form.image_items) {
        if (item.file) {
          const u = await uploadImage(item.file, 'gallery');
          if (u) finalImages.push(u);
        } else if (item.url) {
          finalImages.push(item.url);
        }
      }

      const payload: Record<string, any> = {
        tenant_id: currentTenant.id,
        project_id: projectId,
        unit_number: form.unit_number,
        floor_number: form.floor ? parseInt(form.floor) : null,
        area_sqm: form.size_sqm ? parseFloat(form.size_sqm) : null,
        land_area_sqw: form.land_area_sqw ? parseFloat(form.land_area_sqw) : null,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : 0,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : 0,
        floor_count: form.floor_count ? parseInt(form.floor_count) : 1,
        price: parseFloat(form.price),
        layout_description: form.description || null,
        status: form.status,
        promo_price: form.promo_price ? parseFloat(form.promo_price) : null,
        plot_number: form.plot_number || null,
        view: form.view || null,
        furnishing: form.furnishing || null,
        floor_plan_url: form.floor_plan_url || null,
        tour_3d_url: form.tour_3d_url || null,
        parking_spaces: form.parking_spaces ? parseInt(form.parking_spaces) : 0,
        facing_direction: form.facing_direction || null,
        building: form.building || null,
        pool: form.pool,
        garden: form.garden,
        balcony: form.balcony,
        images: finalImages,
      };
      if (thumbnailUrl) payload.thumbnail_url = thumbnailUrl;

      const { data, error } = await supabase
        .from('units')
        .update(payload)
        .eq('id', unitId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('คุณไม่มีสิทธิ์แก้ไขยูนิตนี้');

      toast.success(`บันทึกยูนิต ${form.unit_number} สำเร็จ`);
      navigate(`/units/${unitId}`);
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-chateau" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6 max-w-5xl mx-auto space-y-5 pb-32">
          {/* Back */}
          <Button variant="outline" onClick={() => navigate(`/units/${unitId}`)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> กลับไปหน้ารายละเอียด {form.unit_number}
          </Button>

          {/* Header */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">EDIT</p>
            <h1 className="text-3xl font-bold text-gray-900">แก้ไขยูนิต {form.unit_number}</h1>
            <p className="text-sm text-gray-600 mt-1">{projectName}</p>
          </div>

          {/* Section 1: ข้อมูลพื้นฐาน */}
          <Section
            iconBg="bg-blue-600"
            iconColor="border-blue-100"
            icon={<Home className="w-3.5 h-3.5 text-white" />}
            title="ข้อมูลพื้นฐาน"
            subtitle="เลขยูนิต ราคา ชั้น และสถานะ"
            tone="blue"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="เลขที่ยูนิต" required>
                <Input
                  value={form.unit_number}
                  onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                  placeholder="เช่น 12/143"
                />
              </Field>
              <Field label="ชั้น">
                <Input
                  type="number"
                  value={form.floor}
                  onChange={(e) => setForm({ ...form, floor: e.target.value })}
                  placeholder="เช่น 2"
                />
              </Field>
              <Field label="ราคา (บาท)" required>
                <Input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  placeholder="เช่น 5500000"
                />
              </Field>
            </div>
          </Section>

          {/* Section 2: รูปภาพ */}
          <Section
            iconBg="bg-pink-500"
            icon={<ImagePlus className="w-3.5 h-3.5 text-white" />}
            title="รูปภาพยูนิต"
            subtitle="รูปหลัก + รูปแกลเลอรี"
            tone="pink"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Thumbnail */}
              <div>
                <Label className="text-sm font-medium mb-2 block">รูปหลัก (Thumbnail)</Label>
                <label className="block">
                  {form.thumbnail_preview ? (
                    <div className="relative group cursor-pointer">
                      <img src={form.thumbnail_preview} alt="thumb" className="w-full h-44 object-cover rounded-lg border border-gray-200" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center transition-opacity">
                        <span className="text-white text-sm font-medium">คลิกเพื่อเปลี่ยน</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-44 border-2 border-dashed border-pink-200 rounded-lg bg-pink-50/40 cursor-pointer hover:bg-pink-50">
                      <ImagePlus className="w-7 h-7 text-pink-400 mb-1" />
                      <span className="text-sm text-pink-600">คลิกอัปโหลด</span>
                    </div>
                  )}
                  <input type="file" accept="image/*" onChange={handleThumbnailChange} className="hidden" />
                </label>
              </div>

              {/* Gallery */}
              <div>
                <Label className="text-sm font-medium mb-2 block">รูปแกลเลอรี ({form.image_items.length})</Label>
                <div className="grid grid-cols-3 gap-2 p-3 border-2 border-dashed border-purple-200 rounded-lg bg-purple-50/30">
                  {form.image_items.map((item, idx) => (
                    <div key={idx} className="relative group">
                      <img src={item.url} alt={`Gallery ${idx + 1}`} className="w-full h-20 object-cover rounded-lg" />
                      <span className={cn(
                        'absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] rounded font-medium text-white',
                        item.file ? 'bg-green-500/90' : 'bg-blue-500/90'
                      )}>
                        {item.file ? 'ใหม่' : 'เดิม'}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(idx)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-purple-300 rounded-lg h-20 hover:bg-purple-50">
                    <Plus className="w-4 h-4 text-purple-400" />
                    <span className="text-xs text-purple-500 mt-0.5">เพิ่มรูป</span>
                    <input type="file" accept="image/*" multiple onChange={handleImagesChange} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
          </Section>

          {/* Section 3: ขนาดและพื้นที่ */}
          <Section
            iconBg="bg-green-600"
            icon={<Square className="w-3.5 h-3.5 text-white" />}
            title="ขนาดพื้นที่"
            subtitle="พื้นที่ใช้สอย + ที่ดิน"
            tone="green"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="พื้นที่ใช้สอย (ตร.ม.)">
                <Input
                  type="number"
                  value={form.size_sqm}
                  onChange={(e) => setForm({ ...form, size_sqm: e.target.value })}
                  placeholder="เช่น 96.83"
                />
              </Field>
              <Field label="พื้นที่ดิน (ตร.วา)">
                <Input
                  type="number"
                  value={form.land_area_sqw}
                  onChange={(e) => setForm({ ...form, land_area_sqw: e.target.value })}
                  placeholder="เช่น 52"
                />
              </Field>
            </div>
          </Section>

          {/* Section 4: ห้องและที่จอด */}
          <Section
            iconBg="bg-orange-500"
            icon={<Bed className="w-3.5 h-3.5 text-white" />}
            title="ห้องและที่จอด"
            subtitle="ห้องนอน ห้องน้ำ ที่จอด ทิศ อาคาร"
            tone="orange"
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label={<span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5 text-orange-500"/> ห้องนอน</span>}>
                <Input type="number" min="0" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} placeholder="2" />
              </Field>
              <Field label={<span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5 text-orange-500"/> ห้องน้ำ</span>}>
                <Input type="number" min="0" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} placeholder="2" />
              </Field>
              <Field label={<span className="flex items-center gap-1"><Square className="w-3.5 h-3.5 text-orange-500"/> ที่จอดรถ</span>}>
                <Input type="number" min="0" value={form.parking_spaces} onChange={(e) => setForm({ ...form, parking_spaces: e.target.value })} placeholder="2" />
              </Field>
              <Field label={<span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5 text-orange-500"/> จำนวนชั้น</span>}>
                <Input type="number" min="1" value={form.floor_count} onChange={(e) => setForm({ ...form, floor_count: e.target.value })} placeholder="2" />
              </Field>
              <Field label={<span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-orange-500"/> ทิศ</span>}>
                <Select value={form.facing_direction} onValueChange={(v) => setForm({ ...form, facing_direction: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกทิศ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="N">เหนือ (N)</SelectItem>
                    <SelectItem value="S">ใต้ (S)</SelectItem>
                    <SelectItem value="E">ตะวันออก (E)</SelectItem>
                    <SelectItem value="W">ตะวันตก (W)</SelectItem>
                    <SelectItem value="NE">ตะวันออกเฉียงเหนือ (NE)</SelectItem>
                    <SelectItem value="NW">ตะวันตกเฉียงเหนือ (NW)</SelectItem>
                    <SelectItem value="SE">ตะวันออกเฉียงใต้ (SE)</SelectItem>
                    <SelectItem value="SW">ตะวันตกเฉียงใต้ (SW)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={<span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-orange-500"/> อาคาร / Block</span>}>
                <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="A, B, Tower 1" />
              </Field>
            </div>
          </Section>

          {/* Section 5: รายละเอียดและสถานะ */}
          <Section
            iconBg="bg-gray-600"
            icon={<FileText className="w-3.5 h-3.5 text-white" />}
            title="รายละเอียดและสถานะ"
            subtitle="คำอธิบายเพิ่ม + สถานะยูนิต"
            tone="gray"
          >
            <Field label="ข้อมูลเพิ่มเติม">
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="เล่าจุดเด่นเฉพาะที่ไม่มีในช่องอื่น"
                rows={3}
              />
            </Field>
            <Field label="สถานะยูนิต">
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"/>ว่าง</span></SelectItem>
                  <SelectItem value="reserved"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-500"/>จอง</span></SelectItem>
                  <SelectItem value="sold"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500"/>ขายแล้ว</span></SelectItem>
                  <SelectItem value="unavailable"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-400"/>ไม่ว่าง</span></SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>

          {/* Section 6: รายละเอียดเสริม */}
          <Section
            iconBg="bg-amber-600"
            icon={<Layers className="w-3.5 h-3.5 text-white" />}
            title="รายละเอียดเสริม"
            subtitle="โปรโมชั่น แปลง วิว ตกแต่ง แผนผัง 3D"
            tone="amber"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={<span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5 text-amber-500"/> ราคาโปรโมชั่น (บาท)</span>}>
                <Input
                  type="number"
                  value={form.promo_price}
                  onChange={(e) => setForm({ ...form, promo_price: e.target.value })}
                  placeholder="เช่น 5490000 (เว้นว่างถ้าไม่มีโปร)"
                />
              </Field>
              <Field label="เลขแปลง">
                <Input
                  value={form.plot_number}
                  onChange={(e) => setForm({ ...form, plot_number: e.target.value })}
                  placeholder="เช่น C-012"
                />
              </Field>
              <Field label="วิว" colSpan={2}>
                <Input
                  value={form.view}
                  onChange={(e) => setForm({ ...form, view: e.target.value })}
                  placeholder="เช่น วิวสระว่ายน้ำ, วิวสวน, วิวเมือง"
                />
              </Field>
              <Field label="สถานะตกแต่ง" colSpan={2}>
                <Select value={form.furnishing} onValueChange={(v: any) => setForm({ ...form, furnishing: v })}>
                  <SelectTrigger><SelectValue placeholder="เลือกระดับการตกแต่ง" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fully">ตกแต่งครบ พร้อมอยู่</SelectItem>
                    <SelectItem value="partial">ตกแต่งบางส่วน</SelectItem>
                    <SelectItem value="unfurnished">ไม่ตกแต่ง</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Floor Plan URL" colSpan={2}>
                <Input
                  type="url"
                  value={form.floor_plan_url}
                  onChange={(e) => setForm({ ...form, floor_plan_url: e.target.value })}
                  placeholder="https://... (รูป/PDF แปลนห้อง)"
                />
              </Field>
              <Field label="3D / VR Tour URL" colSpan={2}>
                <Input
                  type="url"
                  value={form.tour_3d_url}
                  onChange={(e) => setForm({ ...form, tour_3d_url: e.target.value })}
                  placeholder="https://my.matterport.com/show/?m=..."
                />
              </Field>
            </div>
          </Section>
        </main>

        {/* Sticky footer */}
        <div className="fixed bottom-0 left-0 lg:left-[260px] right-0 bg-white border-t border-gray-200 px-6 py-3 flex justify-end gap-3 z-30">
          <Button
            variant="outline"
            onClick={() => navigate(`/units/${unitId}`)}
            disabled={saving}
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !form.unit_number || !form.price}
            className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6] hover:opacity-90"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> กำลังบันทึก...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> บันทึกการแก้ไข</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ─── Small layout helpers ─── */
const Section = ({
  icon, iconBg, title, subtitle, tone, children,
}: {
  icon: React.ReactNode; iconBg: string; iconColor?: string;
  title: string; subtitle: string;
  tone: 'blue' | 'pink' | 'green' | 'orange' | 'gray' | 'amber';
  children: React.ReactNode;
}) => {
  const toneClass: Record<string, { card: string; header: string }> = {
    blue: { card: 'border-blue-200', header: 'from-blue-50 to-blue-100/50 border-blue-100' },
    pink: { card: 'border-pink-200', header: 'from-pink-50 to-pink-100/50 border-pink-100' },
    green: { card: 'border-green-200', header: 'from-green-50 to-green-100/50 border-green-100' },
    orange: { card: 'border-orange-200', header: 'from-orange-50 to-orange-100/50 border-orange-100' },
    gray: { card: 'border-gray-200', header: 'from-gray-50 to-gray-100/50 border-gray-200' },
    amber: { card: 'border-amber-200', header: 'from-amber-50 to-orange-50 border-amber-200' },
  };
  const t = toneClass[tone];
  return (
    <Card className={cn('border-2 shadow-sm', t.card)}>
      <CardContent className="p-0">
        <div className={cn('flex items-center gap-3 px-5 py-3 border-b bg-gradient-to-r', t.header)}>
          <div className={cn('p-1.5 rounded-lg', iconBg)}>{icon}</div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">{title}</h3>
            <p className="text-xs text-gray-600">{subtitle}</p>
          </div>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </CardContent>
    </Card>
  );
};

const Field = ({ label, required, colSpan, children }: { label: React.ReactNode; required?: boolean; colSpan?: number; children: React.ReactNode }) => (
  <div className={colSpan === 2 ? 'sm:col-span-2' : ''}>
    <Label className="text-sm font-medium mb-1.5 flex items-center gap-1">
      {label}
      {required && <span className="text-red-500">*</span>}
    </Label>
    {children}
  </div>
);

export default UnitEdit;
