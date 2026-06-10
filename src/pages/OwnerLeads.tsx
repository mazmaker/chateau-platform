import { useState, useEffect } from 'react';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { supabase } from '@/lib/supabase';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Building2, Plus, Search, Users, Loader2, TrendingUp, Trophy, Trash2, Briefcase, FileText, Pencil,
  MoreHorizontal, Eye, Rocket, CheckCircle2, Flame, Phone,
} from 'lucide-react';

// Prospective developer company interested in subscribing to Chateau (platform-level).
interface PLead {
  id: string;
  company_name: string;
  current_projects_count: number | null;
  province: string | null;
  contact_name: string;
  contact_title: string | null;
  contact_phone: string | null;
  contact_line_id: string | null;
  contact_email: string | null;
  interested_plan: string | null;
  seats_needed: number | null;
  estimated_mrr: number | null;
  source: string | null;
  stage: string;
  expected_close_date: string | null;
  notes: string | null;
  lost_reason: string | null;
  converted_tenant_id: string | null;
  converted_at: string | null;
  created_at: string;
  last_contact_date: string | null;
  is_hot: boolean;
}

// Palette + THB currency formatting — kept identical to OwnerDashboard so the two
// Owner pages share the same look (KPI colors, money format).
const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  orange: '#d97706', orangeLight: '#fef3c7',
  brand: '#e60023', brandLight: '#fff1f2',
};
const formatCurrency = (amount: number | null | undefined) =>
  new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(Number(amount) || 0);

// Status pill — bordered colored badge matching LeadManagement.tsx (colors/shape) but WITHOUT icon (per request).
const STAGE_CONFIG: Record<string, { label: string; badge: string }> = {
  new:            { label: 'ใหม่',            badge: 'bg-blue-50 text-blue-700 border border-blue-200' },
  contacted:      { label: 'ติดต่อแล้ว',       badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200' },
  qualified:      { label: 'ผ่านคุณสมบัติ',     badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  demo_scheduled: { label: 'นัดดูเดโม',         badge: 'bg-indigo-50 text-indigo-700 border border-indigo-200' },
  proposal_sent:  { label: 'ส่งใบเสนอราคา',     badge: 'bg-purple-50 text-purple-700 border border-purple-200' },
  negotiation:    { label: 'เจรจา',            badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  won:            { label: 'ปิดดีลสำเร็จ',     badge: 'bg-green-100 text-green-800 border border-green-300' },
  lost:           { label: 'ปิดดีลไม่สำเร็จ',   badge: 'bg-red-50 text-red-700 border border-red-200' },
};

// Renders a status pill (label only — no icon).
const stageBadge = (stage: string) => {
  const cfg = STAGE_CONFIG[stage] || { label: stage, badge: 'bg-gray-50 text-gray-700 border border-gray-200' };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
};

// Read-only label/value row for the detail dialog — label/value sizing matches
// TenantManagement & LeadManagement detail views (text-sm muted label, font-medium value).
const Field = ({ label, value }: { label: string; value: string | number | null | undefined }) => (
  <div>
    <p className="text-[11px] text-gray-400 uppercase font-medium tracking-wide mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-800 break-words">{value === null || value === undefined || value === '' ? '—' : value}</p>
  </div>
);
const STAGE_ORDER = ['new','contacted','qualified','demo_scheduled','proposal_sent','negotiation','won','lost'];
const OPEN_STAGES = ['new','contacted','qualified','demo_scheduled','proposal_sent','negotiation'];

// ที่มาของลีด — ช่องทางจริงที่บริษัทมาถึงเรา (must match the source CHECK constraint in DB).
const SOURCE_LABELS: Record<string, string> = {
  line:     'LINE',
  phone:    'โทรศัพท์',
  email:    'อีเมล',
  event:    'งานสัมมนา',
  referral: 'การแนะนำ',
  website:  'เว็บไซต์',
};
const PLAN_LABELS: Record<string, string> = {
  free: 'Free', starter: 'Starter', professional: 'Professional', enterprise: 'Enterprise',
};
// Monthly list price per plan is loaded live from the `plans` catalog inside the
// component (see planPrices state) — auto-fills estimated MRR when a plan is picked.

const emptyForm = {
  company_name: '', current_projects_count: '',
  province: '', contact_name: '', contact_title: '', contact_phone: '', contact_line_id: '',
  contact_email: '', interested_plan: '', seats_needed: '',
  source: 'line', stage: 'new', expected_close_date: '', notes: '',
  is_hot: false,
};

const OwnerLeads = () => {
  const { user } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [leads, setLeads] = useState<PLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  // Health-card filter (ลีดใหม่ / SLA / เงียบ / hot). Mutually exclusive with the
  // stage dropdown so they can't intersect into a confusing empty result.
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [detailLead, setDetailLead] = useState<PLead | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [convertLead, setConvertLead] = useState<PLead | null>(null);
  const [converting, setConverting] = useState(false);
  const [lostLead, setLostLead] = useState<PLead | null>(null);
  const [lostReason, setLostReason] = useState('');
  const [savingLost, setSavingLost] = useState(false);
  const [planPrices, setPlanPrices] = useState<Record<string, number>>({}); // live from `plans` catalog

  const fetchLeads = async () => {
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('platform_leads') as any)
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true });
    if (error) {
      console.error('fetch platform_leads error:', error);
      toast.error('โหลดข้อมูล Leads ไม่สำเร็จ', { description: error.message });
      setLeads([]);
    } else {
      setLeads((data || []) as PLead[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLeads();
    // Live plan prices from the Owner-managed catalog → estimated MRR stays in sync.
    (supabase.from('plans') as any).select('id, price_monthly').then(({ data }: any) => {
      if (data) setPlanPrices(Object.fromEntries(data.map((p: any) => [p.id, Number(p.price_monthly)])));
    });
  }, []);

  const setF = (k: keyof typeof emptyForm, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const txt = (v: string) => (v.trim() === '' ? null : v.trim());

  const handleSave = async () => {
    if (!form.company_name.trim() || !form.contact_name.trim()) {
      toast.error('กรุณากรอกชื่อบริษัทและผู้ติดต่อ');
      return;
    }
    setSaving(true);
    const payload = {
      company_name: form.company_name.trim(),
      current_projects_count: num(form.current_projects_count),
      province: txt(form.province),
      contact_name: form.contact_name.trim(),
      contact_title: txt(form.contact_title),
      contact_phone: txt(form.contact_phone),
      contact_line_id: txt(form.contact_line_id),
      contact_email: txt(form.contact_email),
      interested_plan: txt(form.interested_plan),
      seats_needed: num(form.seats_needed),
      estimated_mrr: form.interested_plan ? (planPrices[form.interested_plan] ?? null) : null, // derived from plan, not a manual field
      source: form.source,
      stage: form.stage,
      expected_close_date: txt(form.expected_close_date),
      notes: txt(form.notes),
      is_hot: form.is_hot,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = supabase.from('platform_leads') as any;
    const { error } = editingId
      ? await q.update(payload).eq('id', editingId)                  // edit: keep original assigned_to
      : await q.insert({ ...payload, assigned_to: user?.id ?? null });
    setSaving(false);
    if (error) {
      toast.error(editingId ? 'แก้ไขไม่สำเร็จ' : 'บันทึก Lead ไม่สำเร็จ', { description: error.message });
      return;
    }
    toast.success(editingId ? 'แก้ไขสำเร็จ' : 'เพิ่มผู้สนใจสำเร็จ', { description: form.company_name });
    setShowCreate(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    fetchLeads();
  };

  // Open the form pre-filled to edit an existing prospect.
  const handleEdit = (l: PLead) => {
    setForm({
      company_name: l.company_name || '',
      current_projects_count: l.current_projects_count != null ? String(l.current_projects_count) : '',
      province: l.province || '',
      contact_name: l.contact_name || '',
      contact_title: l.contact_title || '',
      contact_phone: l.contact_phone || '',
      contact_line_id: l.contact_line_id || '',
      contact_email: l.contact_email || '',
      interested_plan: l.interested_plan || '',
      seats_needed: l.seats_needed != null ? String(l.seats_needed) : '',
      source: l.source || 'line',
      stage: l.stage || 'new',
      expected_close_date: l.expected_close_date || '',
      notes: l.notes || '',
      is_hot: l.is_hot ?? false,
    });
    setEditingId(l.id);
    setDetailLead(null);
    setShowCreate(true);
  };

  const updateStage = async (id: string, stage: string) => {
    const lead = leads.find((l) => l.id === id);
    // "ปิดได้" must go through conversion (which creates the tenant) — never set inline.
    if (stage === 'won' && lead && !lead.converted_tenant_id) { setConvertLead(lead); return; }
    // "ไม่สำเร็จ" prompts for a reason.
    if (stage === 'lost' && lead) { setLostReason(lead.lost_reason || ''); setLostLead(lead); return; }
    // Moving a prospect's stage = you just engaged them → stamp last_contact_date so
    // the SLA / silent health signals clear automatically.
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('platform_leads') as any).update({ stage, last_contact_date: nowIso }).eq('id', id);
    if (error) { toast.error('อัปเดตสถานะไม่สำเร็จ'); return; }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, stage, last_contact_date: nowIso } : l)));
  };

  // Log a contact without changing the stage — clears the SLA / silent flags.
  const markContacted = async (id: string, name: string) => {
    const nowIso = new Date().toISOString();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('platform_leads') as any).update({ last_contact_date: nowIso }).eq('id', id);
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return; }
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, last_contact_date: nowIso } : l)));
    toast.success('บันทึกการติดต่อแล้ว', { description: name });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ลบผู้สนใจ "${name}"?`)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('platform_leads') as any).delete().eq('id', id);
    if (error) { toast.error('ลบไม่สำเร็จ'); return; }
    setLeads((prev) => prev.filter((l) => l.id !== id));
    toast.success('ลบแล้ว');
  };

  // company_name → url-safe citext slug. Thai strips to '' so we always append a
  // unique fragment of the lead id to satisfy the tenants.slug UNIQUE constraint.
  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

  // Close the loop: a won prospect becomes a real paying tenant. Creates the tenant
  // row (Owner RLS allows direct insert) then stamps the lead converted + won.
  const handleConvert = async () => {
    if (!convertLead) return;
    const lead = convertLead;
    setConverting(true);
    const slug = `${slugify(lead.company_name) || 'tenant'}-${lead.id.slice(0, 8)}`;
    // 1. create the tenant (developer company joins the platform)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: tenant, error: tErr } = await (supabase.from('tenants') as any)
      .insert({
        name: lead.company_name,
        slug,
        status: 'active',                       // won = deal closed/paid → active customer (not trial; trial is a pre-close stage)
        subscription_plan: lead.interested_plan || 'starter',
        email: lead.contact_email,
        billing_email: lead.contact_email,
        billing_phone: lead.contact_phone,
      })
      .select('id')
      .single();
    if (tErr || !tenant) {
      setConverting(false);
      toast.error('สร้างบริษัทไม่สำเร็จ', { description: tErr?.message });
      return;
    }
    // 2. stamp the lead won + linked to the new tenant
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: lErr } = await (supabase.from('platform_leads') as any)
      .update({ stage: 'won', converted_tenant_id: tenant.id, converted_at: new Date().toISOString() })
      .eq('id', lead.id);
    setConverting(false);
    if (lErr) {
      toast.error('อัปเดต Lead ไม่สำเร็จ', { description: lErr.message });
      return;
    }
    toast.success('เพิ่มเป็นบริษัทในระบบแล้ว', { description: `เพิ่ม ${lead.company_name} เข้าระบบแล้ว` });
    setConvertLead(null);
    setDetailLead(null);
    fetchLeads();
  };

  // Mark a prospect as lost, capturing why (for funnel analysis).
  const handleMarkLost = async () => {
    if (!lostLead) return;
    setSavingLost(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('platform_leads') as any)
      .update({ stage: 'lost', lost_reason: lostReason.trim() || null })
      .eq('id', lostLead.id);
    setSavingLost(false);
    if (error) { toast.error('อัปเดตไม่สำเร็จ', { description: error.message }); return; }
    toast.success('บันทึกเป็น "ปิดดีลไม่สำเร็จ" แล้ว');
    setLostLead(null);
    setLostReason('');
    fetchLeads();
  };

  const toggleHot = async (l: PLead) => {
    const next = !l.is_hot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('platform_leads') as any).update({ is_hot: next }).eq('id', l.id);
    if (error) { toast.error('บันทึกไม่สำเร็จ'); return; }
    setLeads((prev) => prev.map((x) => (x.id === l.id ? { ...x, is_hot: next } : x)));
    toast.success(next ? `${l.company_name} — แท็กเป็น Hot แล้ว` : `${l.company_name} — ยกเลิก Hot แล้ว`);
  };

  const filtered = leads.filter((l) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q ||
      l.company_name.toLowerCase().includes(q) ||
      (l.contact_name || '').toLowerCase().includes(q) ||
      (l.province || '').toLowerCase().includes(q);
    const matchStage = stageFilter === 'all' || l.stage === stageFilter;
    const matchSource = sourceFilter === 'all' || l.source === sourceFilter;
    return matchSearch && matchStage && matchSource;
  });

  const openLeads = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const wonLeads = leads.filter((l) => l.stage === 'won');
  const pipelineMrr = openLeads.reduce((s, l) => s + Number(l.estimated_mrr || 0), 0);

  const kpis = [
    { title: 'ผู้สนใจทั้งหมด', value: leads.length.toLocaleString(), sub: 'บริษัท Developer', icon: Users, color: KK.blue, bg: KK.blueLight },
    { title: 'กำลังดำเนินการ', value: openLeads.length.toLocaleString(), sub: 'ยังไม่ปิด', icon: TrendingUp, color: KK.orange, bg: KK.orangeLight },
    { title: 'ปิดดีลสำเร็จ', value: wonLeads.length.toLocaleString(), sub: 'เป็นบริษัทในระบบแล้ว', icon: Trophy, color: KK.green, bg: KK.greenLight },
    { title: 'มูลค่า Pipeline', value: formatCurrency(pipelineMrr), sub: 'MRR คาดการณ์ (ยังไม่ปิด)', icon: Building2, color: KK.red, bg: KK.redLight },
  ];

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8">
            {/* Page header */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 mb-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center flex-shrink-0">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Leads (ผู้สนใจแพลตฟอร์ม)</h1>
                    <p className="text-sm sm:text-base text-gray-600 mt-1">
                      บริษัท Developer ที่สนใจสมัครใช้ Chateau — pipeline การขายแพ็กเกจ
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => { setForm({ ...emptyForm }); setEditingId(null); setShowCreate(true); }}
                  className="bg-gray-900 hover:bg-black text-white shadow-lg w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่ม Leads
                </Button>
              </div>
            </div>

            {/* KPI cards — same treatment as OwnerDashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {kpis.map((k) => (
                <div
                  key={k.title}
                  className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{k.title}</p>
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${k.bg}f0 0%, ${k.bg} 100%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${k.color}15`,
                      }}
                    >
                      <k.icon className="w-5 h-5" style={{ color: k.color }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{k.value}</p>
                  <p className="text-[13px] text-gray-400 mt-3.5 truncate">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 mb-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="ค้นหาบริษัท / ผู้ติดต่อ / จังหวัด"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={stageFilter} onValueChange={(v) => setStageFilter(v)}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="สถานะ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="ช่องทาง" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกช่องทาง</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>บริษัท</TableHead>
                    <TableHead>ผู้ติดต่อ</TableHead>
                    <TableHead>แพ็กเกจ</TableHead>
                    <TableHead className="text-right">MRR คาดการณ์</TableHead>
                    <TableHead>ช่องทาง</TableHead>
                    <TableHead>สถานะ</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-400">
                      <Loader2 className="w-5 h-5 animate-spin inline mr-2" />กำลังโหลด...
                    </TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-gray-400">
                      ยังไม่มีผู้สนใจ — กด “เพิ่ม Leads” เพื่อบันทึกบริษัทที่ติดต่อเข้ามา
                    </TableCell></TableRow>
                  ) : filtered.map((l) => (
                    <TableRow key={l.id} onClick={() => setDetailLead(l)} className="cursor-pointer hover:bg-gray-50">
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {l.is_hot && <Flame className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />}
                          <span className="font-medium text-gray-900">{l.company_name}</span>
                        </div>
                        <div className="text-xs text-gray-400">
                          {[l.province, l.current_projects_count != null ? `${l.current_projects_count} โครงการ` : null]
                            .filter(Boolean).join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm text-gray-900">{l.contact_name}</div>
                        <div className="text-xs text-gray-400">
                          {[l.contact_phone, l.contact_line_id ? `LINE: ${l.contact_line_id}` : null]
                            .filter(Boolean).join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700">
                        {l.interested_plan ? (PLAN_LABELS[l.interested_plan] || l.interested_plan) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-gray-900 tabular-nums">
                        {l.estimated_mrr ? formatCurrency(l.estimated_mrr) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {l.source ? (SOURCE_LABELS[l.source] || l.source) : '—'}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select value={l.stage} onValueChange={(v) => updateStage(l.id, v)}>
                          <SelectTrigger className="h-8 w-auto gap-1 border-0 p-0 focus:ring-0 shadow-none">
                            {stageBadge(l.stage)}
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetailLead(l)}>
                              <Eye className="w-4 h-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(l)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            {OPEN_STAGES.includes(l.stage) && (
                              <DropdownMenuItem onClick={() => markContacted(l.id, l.company_name)}>
                                <Phone className="w-4 h-4 mr-2" />
                                บันทึกว่าติดต่อแล้ว
                              </DropdownMenuItem>
                            )}
                            {l.converted_tenant_id ? (
                              <DropdownMenuItem disabled className="text-green-600">
                                <CheckCircle2 className="w-4 h-4 mr-2" />
                                เป็นบริษัทในระบบแล้ว
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => setConvertLead(l)} className="text-green-700">
                                <Rocket className="w-4 h-4 mr-2" />
                                เพิ่มเป็นบริษัทในระบบ
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDelete(l.id, l.company_name)}
                              className="text-red-600"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              ลบ
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </main>
        </div>
      </div>

      {/* Add prospect dialog */}
      <Dialog open={showCreate} onOpenChange={(o) => { setShowCreate(o); if (!o) setEditingId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'แก้ไขผู้สนใจ' : 'เพิ่มผู้สนใจ (บริษัท Developer)'}</DialogTitle>
            <DialogDescription>บันทึกบริษัทที่สนใจสมัครใช้ Chateau — เริ่มจากกรอกเอง (LINE/โทร/งาน/แนะนำ)</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">บริษัท</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Label>ชื่อบริษัท *</Label>
                <Input value={form.company_name} onChange={(e) => setF('company_name', e.target.value)} placeholder="เช่น บริษัท พัฒนาที่ดิน จำกัด" />
              </div>
              <div>
                <Label>จังหวัด</Label>
                <Input value={form.province} onChange={(e) => setF('province', e.target.value)} placeholder="เช่น กรุงเทพฯ" />
              </div>
              <div>
                <Label>จำนวนโครงการที่บริหารอยู่</Label>
                <Input type="number" value={form.current_projects_count} onChange={(e) => setF('current_projects_count', e.target.value)} />
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">ผู้ติดต่อ</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>ชื่อผู้ติดต่อ *</Label>
                <Input value={form.contact_name} onChange={(e) => setF('contact_name', e.target.value)} />
              </div>
              <div>
                <Label>ตำแหน่ง</Label>
                <Input value={form.contact_title} onChange={(e) => setF('contact_title', e.target.value)} placeholder="เช่น ผู้จัดการฝ่ายขาย" />
              </div>
              <div>
                <Label>เบอร์โทร</Label>
                <Input value={form.contact_phone} onChange={(e) => setF('contact_phone', e.target.value)} />
              </div>
              <div>
                <Label>LINE ID</Label>
                <Input value={form.contact_line_id} onChange={(e) => setF('contact_line_id', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>อีเมล</Label>
                <Input type="email" value={form.contact_email} onChange={(e) => setF('contact_email', e.target.value)} />
              </div>
            </div>

            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-2">ดีล</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>แพ็กเกจที่สนใจ</Label>
                <Select value={form.interested_plan} onValueChange={(v) => setF('interested_plan', v)}>
                  <SelectTrigger><SelectValue placeholder="เลือก" /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PLAN_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>จำนวนผู้ใช้ (seat)</Label>
                <Input type="number" value={form.seats_needed} onChange={(e) => setF('seats_needed', e.target.value)} />
              </div>
              <div>
                <Label>ช่องทางที่มา</Label>
                <Select value={form.source} onValueChange={(v) => setF('source', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SOURCE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>สถานะ</Label>
                <Select value={form.stage} onValueChange={(v) => setF('stage', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGE_ORDER.map((s) => <SelectItem key={s} value={s}>{STAGE_CONFIG[s].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>วันคาดปิด</Label>
                <Input type="date" value={form.expected_close_date} onChange={(e) => setF('expected_close_date', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label>บันทึก</Label>
                <Input value={form.notes} onChange={(e) => setF('notes', e.target.value)} placeholder="โน้ตการคุย / ความต้องการพิเศษ" />
              </div>
              <div>
                <Label>ความสำคัญ</Label>
                <Select value={form.is_hot ? 'hot' : 'normal'} onValueChange={(v) => setForm((p) => ({ ...p, is_hot: v === 'hot' }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">ปกติ</SelectItem>
                    <SelectItem value="hot">Hot Lead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); setEditingId(null); }} disabled={saving}>ยกเลิก</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gray-900 hover:bg-black text-white">
              {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</> : (editingId ? 'บันทึกการแก้ไข' : 'บันทึก')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prospect detail (read-only) — click a row to open */}
      <Dialog open={!!detailLead} onOpenChange={(o) => { if (!o) setDetailLead(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detailLead && (
            <>
              <DialogHeader>
                <DialogTitle>รายละเอียดผู้สนใจ</DialogTitle>
                <DialogDescription>บริษัท Developer ที่สนใจสมัครใช้ Chateau</DialogDescription>
              </DialogHeader>

              {/* gray panel holding white section cards — matches LeadManagement lead detail */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-4">
                {/* Header card — company avatar + name + scope + stage */}
                <div className="bg-white border border-gray-100 rounded-xl p-5 flex gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-chateau to-chateau-600 shadow-md flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-gray-900 truncate">{detailLead.company_name}</h2>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {[detailLead.province, detailLead.current_projects_count != null ? `${detailLead.current_projects_count} โครงการ` : null].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        {stageBadge(detailLead.stage)}
                        {detailLead.converted_tenant_id && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md bg-green-50 text-green-700 border border-green-200">
                            <CheckCircle2 className="w-3 h-3" /> เป็นบริษัทในระบบแล้ว
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4 text-gray-500" /> ผู้ติดต่อ
                  </h3>
                  <div className="grid grid-cols-3 gap-y-3 gap-x-4">
                    <Field label="ชื่อผู้ติดต่อ" value={detailLead.contact_name} />
                    <Field label="ตำแหน่ง" value={detailLead.contact_title} />
                    <Field label="เบอร์โทร" value={detailLead.contact_phone} />
                    <Field label="LINE ID" value={detailLead.contact_line_id} />
                    <Field label="อีเมล" value={detailLead.contact_email} />
                  </div>
                </div>

                {/* Deal */}
                <div className="bg-white border border-gray-100 rounded-xl p-5">
                  <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-gray-500" /> ดีล
                  </h3>
                  <div className="grid grid-cols-3 gap-y-3 gap-x-4">
                    <Field label="แพ็กเกจที่สนใจ" value={detailLead.interested_plan ? (PLAN_LABELS[detailLead.interested_plan] || detailLead.interested_plan) : '—'} />
                    <Field label="MRR คาดการณ์" value={detailLead.estimated_mrr ? formatCurrency(detailLead.estimated_mrr) : '—'} />
                    <Field label="จำนวนผู้ใช้ (seat)" value={detailLead.seats_needed} />
                    <Field label="ช่องทางที่มา" value={detailLead.source ? (SOURCE_LABELS[detailLead.source] || detailLead.source) : '—'} />
                    <Field label="วันคาดปิด" value={detailLead.expected_close_date} />
                    <Field label="วันที่เพิ่ม" value={detailLead.created_at ? new Date(detailLead.created_at).toLocaleDateString('th-TH') : '—'} />
                    <Field label="ติดต่อล่าสุด" value={detailLead.last_contact_date ? new Date(detailLead.last_contact_date).toLocaleDateString('th-TH') : 'ยังไม่ติดต่อ'} />
                    {detailLead.stage === 'lost' && (
                      <Field label="เหตุผลที่ไม่สำเร็จ" value={detailLead.lost_reason} />
                    )}
                    {detailLead.converted_tenant_id && (
                      <Field label="เพิ่มเข้าระบบเมื่อ" value={detailLead.converted_at ? new Date(detailLead.converted_at).toLocaleDateString('th-TH') : '—'} />
                    )}
                  </div>
                </div>

                {/* Notes */}
                {detailLead.notes && (
                  <div className="bg-white border border-gray-100 rounded-xl p-5">
                    <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-500" /> บันทึก
                    </h3>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{detailLead.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-3">
                <Button variant="outline" onClick={() => setDetailLead(null)}>ปิด</Button>
                {!detailLead.converted_tenant_id && (
                  <Button onClick={() => setConvertLead(detailLead)} className="bg-green-600 hover:bg-green-700 text-white">
                    เพิ่มเป็นบริษัทในระบบ
                  </Button>
                )}
                <Button onClick={() => handleEdit(detailLead)} className="bg-gray-900 hover:bg-black text-white">
                  <Pencil className="w-4 h-4 mr-2" />แก้ไข
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert-to-customer confirm — creates a real tenant + closes the loop */}
      <Dialog open={!!convertLead} onOpenChange={(o) => { if (!o) setConvertLead(null); }}>
        <DialogContent className="max-w-md">
          {convertLead && (
            <>
              <DialogHeader>
                <DialogTitle>เพิ่มเป็นบริษัทในระบบ</DialogTitle>
                <DialogDescription>เพิ่มบริษัทนี้เข้าระบบ (สร้าง tenant) และตั้งสถานะเป็น "ปิดดีลสำเร็จ"</DialogDescription>
              </DialogHeader>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">บริษัท</span>
                  <span className="font-semibold text-gray-900 text-right">{convertLead.company_name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">แพ็กเกจ</span>
                  <span className="font-semibold text-gray-900">{convertLead.interested_plan ? (PLAN_LABELS[convertLead.interested_plan] || convertLead.interested_plan) : 'Starter'}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">สถานะเริ่มต้น</span>
                  <span className="font-semibold text-green-700">ใช้งานจริง (active)</span>
                </div>
              </div>
              <p className="text-xs text-gray-400">ปิดดีลได้ = เริ่มใช้งานจริง (active) — ตั้งค่ารอบบิล/การชำระเงินได้ที่หน้า "จัดการบริษัท"</p>
              <DialogFooter>
                <Button variant="outline" onClick={() => setConvertLead(null)} disabled={converting}>ยกเลิก</Button>
                <Button onClick={handleConvert} disabled={converting} className="bg-green-600 hover:bg-green-700 text-white">
                  {converting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังสร้าง...</> : 'ยืนยันแปลง'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Mark-as-lost — capture the reason for funnel analysis */}
      <Dialog open={!!lostLead} onOpenChange={(o) => { if (!o) { setLostLead(null); setLostReason(''); } }}>
        <DialogContent className="max-w-md">
          {lostLead && (
            <>
              <DialogHeader>
                <DialogTitle>ทำเครื่องหมาย "ปิดดีลไม่สำเร็จ"</DialogTitle>
                <DialogDescription>{lostLead.company_name} — ระบุเหตุผลที่ดีลไม่สำเร็จ ไว้วิเคราะห์ภายหลัง</DialogDescription>
              </DialogHeader>
              <div>
                <Label>เหตุผล</Label>
                <Input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="เช่น ราคาสูงไป / เลือกคู่แข่ง / ยังไม่พร้อม" />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setLostLead(null); setLostReason(''); }} disabled={savingLost}>ยกเลิก</Button>
                <Button onClick={handleMarkLost} disabled={savingLost} className="bg-gray-900 hover:bg-black text-white">
                  {savingLost ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />กำลังบันทึก...</> : 'บันทึก'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </OwnerGuard>
  );
};

export default OwnerLeads;
