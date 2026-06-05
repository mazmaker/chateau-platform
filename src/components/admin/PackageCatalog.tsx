import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Package, Building2, Users, Check, Pencil } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

// ──────────────────────────────────────────────────────────────────────────
// Plan catalog editor — DB-backed (the `plans` table = single source of truth
// for subscription price / limits / features). Rendered as the "จัดการแพ็กเกจ"
// tab inside Tenant Management (kept there, not a separate top-level menu, per
// the Owner console IA). Owner-only RLS already gates writes.
// ──────────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number | null;
  max_properties: number;
  max_admins: number;
  max_sales: number;
  features: string[];
  sort_order: number;
  is_active: boolean;
}

const KK = {
  red: '#ef4444', blue: '#1e3a5f', slate: '#475569', green: '#16a34a',
};

const fmtBaht = (n: number) => new Intl.NumberFormat('th-TH').format(n || 0);

const planColor = (id: string) =>
  id === 'enterprise' ? KK.red : id === 'professional' ? KK.blue : id === 'starter' ? KK.green : KK.slate;

const PackageCatalog = () => {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchPlans(); }, []);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any).from('plans').select('*').order('sort_order');
    if (error) {
      console.error('fetch plans error:', error);
      toast.error('โหลดแพ็กเกจไม่สำเร็จ');
    } else {
      setPlans((data || []).map((p: any) => ({ ...p, features: Array.isArray(p.features) ? p.features : [] })));
    }
    setLoading(false);
  };

  const savePlan = async () => {
    if (!editing) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('plans')
      .update({
        name: editing.name,
        price_monthly: editing.price_monthly,
        price_yearly: editing.price_yearly,
        max_properties: editing.max_properties,
        max_admins: editing.max_admins,
        max_sales: editing.max_sales,
        features: editing.features,
        is_active: editing.is_active,
      })
      .eq('id', editing.id);
    setSaving(false);
    if (error) {
      console.error('save plan error:', error);
      toast.error('บันทึกไม่สำเร็จ: ' + error.message);
      return;
    }
    toast.success(`บันทึกแพ็กเกจ "${editing.name}" แล้ว`);
    setEditing(null);
    fetchPlans();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-bold text-gray-900">จัดการแพ็กเกจ</h2>
        <p className="text-xs text-gray-500 mt-0.5">กำหนดราคา · ลิมิต · ฟีเจอร์ของแต่ละแพ็กเกจ · เป็น source กลางที่ทั้งระบบใช้</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        {plans.map((p) => {
          const color = planColor(p.id);
          return (
            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color }} />
                    <h3 className="text-base font-bold text-gray-900">{p.name}</h3>
                  </div>
                  {!p.is_active && <Badge variant="outline" className="mt-2 text-gray-400">ปิดการขาย</Badge>}
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditing({ ...p })}>
                  <Pencil className="w-4 h-4 text-gray-400" />
                </Button>
              </div>

              <div className="mb-4">
                <span className="text-[28px] font-bold text-gray-900 tabular-nums leading-none">฿{fmtBaht(p.price_monthly)}</span>
                <span className="text-sm text-gray-400"> /เดือน</span>
                {p.price_yearly ? <p className="text-xs text-gray-400 mt-1">฿{fmtBaht(p.price_yearly)} /ปี</p> : null}
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400" />
                  {p.max_properties === -1 ? 'โครงการไม่จำกัด' : `${p.max_properties} โครงการ`}
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-gray-400" />
                  Admin {p.max_admins} · Sales {p.max_sales}
                </div>
              </div>

              <ul className="space-y-1.5 flex-1">
                {p.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                    <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color }} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-400">
        หมายเหตุ: ลิมิตผู้ใช้ = Admin + Sales ต่อบริษัท · ลิมิตจำนวนโครงการตั้ง override รายบริษัทได้ที่แท็บรายการบริษัท
      </p>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>แก้ไขแพ็กเกจ {editing?.name}</DialogTitle>
            <DialogDescription>การเปลี่ยนแปลงจะมีผลกับทั้งระบบทันที</DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-2">
              <div>
                <Label>ชื่อแพ็กเกจ</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="mt-1.5" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>ราคา/เดือน (บาท)</Label>
                  <Input type="number" value={editing.price_monthly} onChange={(e) => setEditing({ ...editing, price_monthly: Number(e.target.value) })} className="mt-1.5" />
                </div>
                <div>
                  <Label>ราคา/ปี (บาท)</Label>
                  <Input type="number" value={editing.price_yearly ?? ''} onChange={(e) => setEditing({ ...editing, price_yearly: e.target.value === '' ? null : Number(e.target.value) })} className="mt-1.5" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>โครงการ</Label>
                  <Input type="number" value={editing.max_properties} onChange={(e) => setEditing({ ...editing, max_properties: Number(e.target.value) })} className="mt-1.5" />
                  <p className="text-[11px] text-gray-400 mt-1">-1 = ไม่จำกัด</p>
                </div>
                <div>
                  <Label>Admin</Label>
                  <Input type="number" value={editing.max_admins} onChange={(e) => setEditing({ ...editing, max_admins: Number(e.target.value) })} className="mt-1.5" />
                </div>
                <div>
                  <Label>Sales</Label>
                  <Input type="number" value={editing.max_sales} onChange={(e) => setEditing({ ...editing, max_sales: Number(e.target.value) })} className="mt-1.5" />
                </div>
              </div>
              <div>
                <Label>ฟีเจอร์ (บรรทัดละ 1 รายการ)</Label>
                <Textarea
                  value={editing.features.join('\n')}
                  onChange={(e) => setEditing({ ...editing, features: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                  rows={5}
                  className="mt-1.5"
                />
              </div>
              <div className="flex items-center justify-between">
                <Label className="cursor-pointer">เปิดขายแพ็กเกจนี้</Label>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>ยกเลิก</Button>
            <Button onClick={savePlan} disabled={saving} className="bg-gray-900 hover:bg-black text-white">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PackageCatalog;
