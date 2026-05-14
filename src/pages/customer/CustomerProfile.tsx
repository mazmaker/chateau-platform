import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Phone, Mail, MapPin, Briefcase, Heart, Loader2, Save, Edit, MessageCircle, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import CustomerLayout from './CustomerLayout';

interface CustomerProfile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  date_of_birth?: string | null;
  preferences?: any;
}

interface SalesContact {
  id: string;
  full_name: string | null;
  email: string | null;
  phone?: string | null;
  role: string;
}

interface FormState {
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  occupation: string;
  workplace: string;
  monthly_income: string;
  province: string;
  district: string;
  sub_district: string;
  purchase_purpose: string;
}

const EMPTY_FORM: FormState = {
  full_name: '', email: '', phone: '', date_of_birth: '',
  occupation: '', workplace: '', monthly_income: '',
  province: '', district: '', sub_district: '',
  purchase_purpose: '',
};

const CustomerProfile = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [salesTeam, setSalesTeam] = useState<SalesContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const profileToForm = (cust: CustomerProfile): FormState => {
    const p = cust.preferences || {};
    const addr = p.address || {};
    return {
      full_name: cust.full_name || '',
      email: cust.email || '',
      phone: cust.phone || '',
      date_of_birth: cust.date_of_birth || '',
      occupation: p.occupation || '',
      workplace: p.workplace || '',
      monthly_income: p.monthly_income != null ? String(p.monthly_income) : '',
      province: addr.province || '',
      district: addr.district || '',
      sub_district: addr.sub_district || '',
      purchase_purpose: p.purchase_purpose || '',
    };
  };

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/customer/login', { replace: true });
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: cust } = await (supabase.from('customers') as any)
          .select('id, full_name, email, phone, date_of_birth, preferences')
          .eq('auth_user_id', user.id).maybeSingle();
        if (!cust) { toast.error('ไม่พบข้อมูล'); return; }
        setProfile(cust as CustomerProfile);
        setForm(profileToForm(cust as CustomerProfile));

        // Load sales/agent team from customer's leads
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: leads } = await (supabase.from('leads') as any)
          .select('assigned_to').eq('customer_id', (cust as any).id);
        const assignedIds = Array.from(new Set(((leads as any[]) || [])
          .map((l: any) => l.assigned_to).filter(Boolean)));
        if (assignedIds.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: salesUsers } = await (supabase.from('users') as any)
            .select('id, full_name, email, phone, role').in('id', assignedIds);
          setSalesTeam(((salesUsers as any[]) || []) as SalesContact[]);
        }
      } catch (err) {
        console.error('Load profile error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // Merge new preferences over existing ones — don't clobber Sales-entered fields we don't expose here
      const existingPrefs = profile.preferences || {};
      const existingAddr = existingPrefs.address || {};
      const newPrefs = {
        ...existingPrefs,
        occupation: form.occupation.trim() || undefined,
        workplace: form.workplace.trim() || undefined,
        monthly_income: form.monthly_income ? Number(form.monthly_income) : undefined,
        purchase_purpose: form.purchase_purpose || undefined,
        address: {
          ...existingAddr,
          province: form.province.trim() || undefined,
          district: form.district.trim() || undefined,
          sub_district: form.sub_district.trim() || undefined,
        },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('customers') as any)
        .update({
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone,
          date_of_birth: form.date_of_birth || null,
          preferences: newPrefs,
        })
        .eq('id', profile.id);
      if (error) throw error;
      toast.success('บันทึกข้อมูลเรียบร้อย');
      setProfile({
        ...profile,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone,
        date_of_birth: form.date_of_birth || null,
        preferences: newPrefs,
      });
      setEditing(false);
    } catch (err: any) {
      toast.error(err.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <CustomerLayout title="โปรไฟล์">
        <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      </CustomerLayout>
    );
  }
  if (!profile) return null;

  const prefs = profile.preferences || {};
  const initials = (profile.full_name || 'C').replace(/^คุณ\s*/, '').slice(0, 2).toUpperCase();

  return (
    <CustomerLayout>
      {/* Hero — avatar + name */}
      <div className="bg-white border border-gray-100 rounded-2xl p-6 text-center">
        <div className="w-20 h-20 mx-auto rounded-full bg-chateau text-white flex items-center justify-center font-bold text-2xl mb-3 shadow-md shadow-chateau/20">
          {initials}
        </div>
        <h1 className="text-xl font-bold text-gray-900">{profile.full_name || 'ลูกค้า'}</h1>
        {prefs.occupation && <p className="text-sm text-gray-500 mt-1">{prefs.occupation}</p>}
      </div>

      {/* Sales/Agent Team — who looks after you */}
      {salesTeam.length > 0 && (
        <div className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-chateau" /> ทีมที่ดูแลคุณ
          </h2>
          <p className="text-[11px] text-gray-500 mb-3">ติดต่อได้ตลอดสำหรับสอบถาม / นัดดูยูนิต / จอง</p>
          <div className="space-y-2.5">
            {salesTeam.map((s) => {
              const initials = (s.full_name || s.email || '?').slice(0, 2).toUpperCase();
              const roleLabel = s.role === 'agent' ? 'นายหน้า' : s.role === 'sales' ? 'พนักงานขาย' : s.role === 'admin' ? 'ผู้ดูแล' : s.role;
              const roleColor = s.role === 'agent' ? 'text-amber-700 bg-amber-50' : 'text-blue-700 bg-blue-50';
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-chateau hover:bg-rose-50/30 transition-all">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-chateau to-chateau-700 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name || s.email}</p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${roleColor}`}>{roleLabel}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {s.phone && <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{s.phone}</span>}
                      {s.email && <span className="truncate">{s.email}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    {s.phone && (
                      <a href={`tel:${s.phone}`} className="w-9 h-9 rounded-full bg-green-50 text-green-600 hover:bg-green-100 flex items-center justify-center transition-colors" title="โทร">
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => toast.info('LINE Integration เร็วๆ นี้')}
                      className="w-9 h-9 rounded-full bg-[#06C755]/10 text-[#06C755] hover:bg-[#06C755]/20 flex items-center justify-center font-bold text-sm transition-colors"
                      title="LINE Chat"
                    >
                      L
                    </button>
                    {s.email && (
                      <a href={`mailto:${s.email}`} className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center justify-center transition-colors" title="Email">
                        <MessageCircle className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Editable: Basic Info */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-gray-600" /> ข้อมูลพื้นฐาน
          </h2>
          {!editing ? (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 text-xs text-gray-600 hover:bg-gray-100">
              <Edit className="w-3.5 h-3.5 mr-1" /> แก้ไข
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="ghost" size="sm" disabled={saving}
                onClick={() => { setEditing(false); setForm(profileToForm(profile)); }}
                className="h-8 text-xs"
              >
                ยกเลิก
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving} className="h-8 text-xs bg-chateau hover:bg-chateau-700 text-white">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Save className="w-3 h-3 mr-1" /> บันทึก</>}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Field label="ชื่อ-นามสกุล" icon={User} value={profile.full_name} editing={editing}>
            <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} disabled={saving} />
          </Field>
          <Field label="เบอร์โทร" icon={Phone} value={profile.phone} editing={editing} mono>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} disabled={saving} />
          </Field>
          <Field label="อีเมล" icon={Mail} value={profile.email} editing={editing}>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} disabled={saving} />
          </Field>
          <Field label="วันเกิด" icon={User} value={profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('th-TH', { dateStyle: 'medium' }) : null} editing={editing}>
            <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} disabled={saving} />
          </Field>
        </div>
      </div>

      {/* Occupation + finance (editable) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-gray-600" /> ข้อมูลด้านอาชีพ
        </h2>
        <div className="space-y-4">
          <Field label="อาชีพ" icon={Briefcase} value={prefs.occupation || null} editing={editing}>
            <Input value={form.occupation} onChange={(e) => setForm({ ...form, occupation: e.target.value })} disabled={saving} placeholder="เช่น พนักงานบริษัท, ธุรกิจส่วนตัว" />
          </Field>
          <Field label="ที่ทำงาน" icon={Briefcase} value={prefs.workplace || null} editing={editing}>
            <Input value={form.workplace} onChange={(e) => setForm({ ...form, workplace: e.target.value })} disabled={saving} placeholder="ชื่อบริษัทหรือสถานที่ทำงาน" />
          </Field>
          <Field
            label="รายได้ต่อเดือน (บาท)"
            icon={Briefcase}
            value={prefs.monthly_income ? `${Number(prefs.monthly_income).toLocaleString()} บาท` : null}
            editing={editing}
            mono
          >
            <Input
              type="number"
              inputMode="numeric"
              value={form.monthly_income}
              onChange={(e) => setForm({ ...form, monthly_income: e.target.value })}
              disabled={saving}
              placeholder="เช่น 50000"
            />
          </Field>
        </div>
      </div>

      {/* Address (editable) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-600" /> ที่อยู่
        </h2>
        {editing ? (
          <div className="space-y-3">
            <div>
              <Label className="text-xs text-gray-500 mb-1.5">จังหวัด</Label>
              <Input value={form.province} onChange={(e) => setForm({ ...form, province: e.target.value })} disabled={saving} placeholder="เช่น กรุงเทพมหานคร" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5">เขต / อำเภอ</Label>
              <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} disabled={saving} placeholder="เช่น บางรัก" />
            </div>
            <div>
              <Label className="text-xs text-gray-500 mb-1.5">แขวง / ตำบล</Label>
              <Input value={form.sub_district} onChange={(e) => setForm({ ...form, sub_district: e.target.value })} disabled={saving} placeholder="เช่น สีลม" />
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-900">
            {[prefs.address?.sub_district, prefs.address?.district, prefs.address?.province].filter(Boolean).join(', ') || <span className="text-gray-400">—</span>}
          </p>
        )}
      </div>

      {/* Purchase purpose (editable) */}
      <div className="bg-white border border-gray-100 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Heart className="w-4 h-4 text-gray-600" /> จุดประสงค์การซื้อ
        </h2>
        {editing ? (
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'own_residence', label: '🏡 อยู่อาศัยเอง' },
              { value: 'investment', label: '💰 ลงทุน' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm({ ...form, purchase_purpose: form.purchase_purpose === opt.value ? '' : opt.value })}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition ${
                  form.purchase_purpose === opt.value
                    ? 'border-chateau bg-rose-50/50 text-chateau'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-900 font-medium">
            {prefs.purchase_purpose === 'own_residence' && '🏡 อยู่อาศัยเอง'}
            {prefs.purchase_purpose === 'investment' && '💰 ลงทุน'}
            {!prefs.purchase_purpose && <span className="text-gray-400">—</span>}
          </p>
        )}
      </div>
    </CustomerLayout>
  );
};

const Field = ({ label, icon: Icon, value, editing, mono, children }: {
  label: string; icon: any; value: string | null; editing: boolean; mono?: boolean; children: React.ReactNode;
}) => (
  <div>
    <Label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1.5">
      <Icon className="w-3 h-3" /> {label}
    </Label>
    {editing ? children : (
      <p className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '-'}</p>
    )}
  </div>
);

export default CustomerProfile;
