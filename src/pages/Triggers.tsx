import { useState, useEffect } from "react";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import {
  Zap, Plus, Play, Pause, UserPlus, Calendar, ShoppingCart, AlertTriangle, Heart, Clock,
  Loader2, Trash2, Eye, Send, AlertCircle, CheckCircle2, Home, FileSignature, TrendingDown,
  Building2, X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

const KK = {
  red: '#e60023', redLight: '#fff1f2', redBorder: '#fecdd3',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
};

interface TriggerRow {
  id: string;
  name: string;
  description: string | null;
  event_type: string;
  action_type: string;
  is_active: boolean;
  fired_count: number;
  action_config?: Record<string, unknown> | null;
}

// Event catalog — all real-estate events users can pick from
type EventCatalogItem = {
  event_type: string;
  category: 'Lead' | 'Viewing' | 'Booking' | 'Project' | 'Customer' | 'Inventory';
  label: string;
  description: string;
  default_template: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any;
  color: string;
  bg: string;
};

const EVENT_CATALOG: EventCatalogItem[] = [
  // Lead
  { event_type: 'lead.created', category: 'Lead', label: 'Lead ใหม่ลงทะเบียน', description: 'มีคนกรอกฟอร์มสนใจโครงการ', default_template: 'ยินดีต้อนรับคุณ {{first_name}} สู่ {{tenant_name}}!\nสนใจโครงการไหนเป็นพิเศษ ทักได้เลยนะครับ', icon: UserPlus, color: KK.blue, bg: KK.blueLight },
  { event_type: 'lead.viewed_property', category: 'Lead', label: 'ดูโครงการในเว็บ', description: 'Lead เปิดดูหน้าโครงการแต่ไม่ติดต่อใน 24 ชม.', default_template: 'เห็นว่าคุณดู {{property_name}} ไป — ต้องการนัดดูบ้านจริงไหมครับ?', icon: Eye, color: KK.blue, bg: KK.blueLight },
  { event_type: 'lead.inactive_7d', category: 'Lead', label: 'Lead เงียบ 7 วัน', description: 'ไม่มี activity ใน 7 วัน', default_template: 'คุณ {{first_name}} ครับ ยังคิดถึง {{property_name}} อยู่ไหม? เรามีโปรพิเศษเหลือ 3 วัน', icon: AlertTriangle, color: KK.amber, bg: KK.amberLight },
  { event_type: 'lead.inactive_30d', category: 'Lead', label: 'Lead เงียบ 30 วัน', description: 'Win-back campaign สำหรับ lead เก่า', default_template: 'เราคิดถึงคุณ! เปิดยูนิตใหม่ที่อาจจะถูกใจ — ดูได้ที่ลิงก์ด้านล่าง', icon: Clock, color: KK.gray, bg: KK.grayLight },

  // Viewing
  { event_type: 'viewing.scheduled', category: 'Viewing', label: 'นัดดูบ้านสำเร็จ', description: 'ลูกค้านัดเวลาดูโครงการเรียบร้อย', default_template: 'ยืนยันนัดดูบ้าน {{property_name}}\nวันที่ {{viewing_date}} เวลา {{viewing_time}}\nเจ้าหน้าที่ดูแล: {{sales_name}}', icon: Calendar, color: KK.green, bg: KK.greenLight },
  { event_type: 'viewing.tomorrow_reminder', category: 'Viewing', label: 'เตือนก่อนนัด 1 วัน', description: 'reminder อัตโนมัติ 24 ชม. ก่อนวันนัด', default_template: '⏰ พรุ่งนี้พบกัน!\nคุณ {{first_name}} เรานัดดู {{property_name}} วันที่ {{viewing_date}} เวลา {{viewing_time}}', icon: Clock, color: KK.amber, bg: KK.amberLight },
  { event_type: 'viewing.no_show', category: 'Viewing', label: 'ไม่มาตามนัด', description: 'ลูกค้าไม่มาตามนัดดูบ้าน', default_template: 'เสียดายที่พลาดนัดวันนี้! ไม่เป็นไรครับ — เลือกเวลาใหม่ที่สะดวกได้ที่ลิงก์ด้านล่าง', icon: AlertCircle, color: KK.orange, bg: KK.orangeLight },

  // Booking
  { event_type: 'booking.deposit_paid', category: 'Booking', label: 'จ่ายเงินจอง', description: 'ลูกค้าจ่ายเงินจองยูนิตสำเร็จ', default_template: 'ขอบคุณที่เลือก {{property_name}}!\nคุณ {{first_name}} ได้จองยูนิต {{unit_number}} เรียบร้อย', icon: ShoppingCart, color: KK.green, bg: KK.greenLight },
  { event_type: 'booking.payment_due_3d', category: 'Booking', label: 'ใกล้กำหนดชำระงวด', description: 'reminder 3 วันก่อนถึงกำหนดชำระเงินดาวน์', default_template: 'แจ้งเตือนชำระเงินดาวน์ในอีก 3 วัน ({{due_date}})\nยอด: ฿{{amount_due}}', icon: AlertCircle, color: KK.amber, bg: KK.amberLight },
  { event_type: 'booking.contract_signed', category: 'Booking', label: 'เซ็นสัญญาซื้อ', description: 'เซ็นสัญญาซื้อขายเรียบร้อย', default_template: 'ยินดีต้อนรับสู่ครอบครัว!\nคุณ {{first_name}} ได้เซ็นสัญญา {{property_name}} เรียบร้อย', icon: FileSignature, color: KK.purple, bg: KK.purpleLight },

  // Project
  { event_type: 'project.construction_milestone', category: 'Project', label: 'ความคืบหน้าโครงการ', description: 'อัปเดตประจำเดือนให้ลูกค้าที่จองแล้ว', default_template: 'อัปเดตความคืบหน้า {{property_name}} เดือน {{current_month}} — {{progress_percent}}% แล้ว!', icon: Building2, color: KK.purple, bg: KK.purpleLight },
  { event_type: 'project.handover_ready', category: 'Project', label: 'พร้อมโอน', description: 'ยูนิตพร้อมส่งมอบ — นัดวันโอน', default_template: 'ยูนิตของคุณพร้อมส่งมอบแล้ว! กรุณานัดวันโอนได้ที่ {{sales_name}}', icon: Home, color: KK.green, bg: KK.greenLight },

  // Inventory
  { event_type: 'unit.price_dropped', category: 'Inventory', label: 'ราคาลด', description: 'แจ้ง leads ที่เคยสนใจเมื่อมีโปร', default_template: 'ราคาพิเศษ! {{property_name}} จาก ฿{{original_price}} เหลือ ฿{{new_price}} — ประหยัด ฿{{savings}}', icon: TrendingDown, color: KK.red, bg: KK.redLight },
  { event_type: 'unit.last_3_remaining', category: 'Inventory', label: 'เหลือ 3 ยูนิตสุดท้าย', description: 'แจ้งความเร่งด่วนให้ leads ที่สนใจ', default_template: 'เหลือเพียง 3 ยูนิต! {{property_name}} ที่คุณเคยสนใจ รีบจองด่วน', icon: AlertTriangle, color: KK.red, bg: KK.redLight },

  // Customer (post-sale)
  { event_type: 'customer.birthday', category: 'Customer', label: 'วันเกิด', description: 'อวยพรวันเกิดลูกค้าทุกปี', default_template: 'สุขสันต์วันเกิดคุณ {{first_name}}!\nขอให้มีความสุขมากๆ จาก {{tenant_name}}', icon: Heart, color: KK.red, bg: KK.redLight },
  { event_type: 'customer.anniversary', category: 'Customer', label: 'ครบรอบลงทะเบียน', description: 'ครบ 1 ปีหลังจองครั้งแรก', default_template: 'ครบรอบ 1 ปีที่คุณเป็นลูกค้าของเรา ขอบคุณที่เชื่อใจ {{tenant_name}} ', icon: Calendar, color: KK.purple, bg: KK.purpleLight },
];

const SAMPLE_DATA: Record<string, string> = {
  '{{first_name}}': 'คุณสมชาย',
  '{{last_name}}': 'ใจดี',
  '{{property_name}}': 'Blu Diamond Condo',
  '{{tenant_name}}': 'CHATEAU',
  '{{sales_name}}': 'น้องแอน',
  '{{sales_phone}}': '081-234-5678',
  '{{viewing_date}}': '15 พ.ค. 2026',
  '{{viewing_time}}': '14:00',
  '{{property_location}}': 'พระราม 9 (ใกล้ MRT)',
  '{{unit_number}}': 'A2305',
  '{{deposit_amount}}': '50,000',
  '{{due_date}}': '20 พ.ค. 2026',
  '{{amount_due}}': '500,000',
  '{{bank_account}}': 'กรุงไทย 123-4-56789-0',
  '{{handover_date}}': 'ธ.ค. 2026',
  '{{current_month}}': 'พฤษภาคม',
  '{{progress_percent}}': '68',
  '{{milestone_summary}}': '• เทพื้นชั้น 12-15\n• ติดตั้งหน้าต่างชั้น 8-10',
  '{{original_price}}': '5,500,000',
  '{{new_price}}': '4,990,000',
  '{{savings}}': '510,000',
  '{{promo_end_date}}': '31 พ.ค. 2026',
  '{{last_viewed}}': '3 พ.ค.',
  '{{remaining_units_list}}': '• A2305 (40 ตร.ม.)\n• B0812 (55 ตร.ม.)\n• C1502 (62 ตร.ม.)',
};

// Render message with sample data substituted in
const renderPreview = (template: string): string => {
  let result = template;
  for (const [token, value] of Object.entries(SAMPLE_DATA)) {
    result = result.split(token).join(value);
  }
  return result;
};

const getEventDisplay = (eventType: string) => {
  const item = EVENT_CATALOG.find((e) => e.event_type === eventType);
  if (item) return { icon: item.icon, color: item.color, bg: item.bg };
  return { icon: Zap, color: KK.gray, bg: KK.grayLight };
};

const Triggers = () => {
  const { currentTenant, userProfile } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [triggers, setTriggers] = useState<TriggerRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCreate, setShowCreate] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState<TriggerRow | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // === Create form state ===
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formEventType, setFormEventType] = useState<string>("");
  const [formTemplate, setFormTemplate] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSaving, setFormSaving] = useState(false);

  const resetForm = () => {
    setFormName("");
    setFormDescription("");
    setFormEventType("");
    setFormTemplate("");
    setFormIsActive(true);
    setFormError(null);
  };

  // When user picks an event_type, prefill defaults
  useEffect(() => {
    if (!formEventType) return;
    const ev = EVENT_CATALOG.find((e) => e.event_type === formEventType);
    if (!ev) return;
    if (!formName) setFormName(ev.label);
    if (!formDescription) setFormDescription(ev.description);
    if (!formTemplate) setFormTemplate(ev.default_template);
  }, [formEventType]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTriggers = async () => {
    if (!currentTenant?.id) { setLoading(false); return; }
    try {
      const { data, error } = await supabase
        .from('triggers')
        .select('id, name, description, event_type, action_type, is_active, fired_count, action_config')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTriggers((data || []) as TriggerRow[]);
    } catch (e) {
      console.error('Failed to load triggers:', e);
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTriggers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [currentTenant]);

  const filtered = triggers.filter((t) =>
    filter === "all" ? true : filter === "active" ? t.is_active : !t.is_active
  );

  const totalFired = triggers.reduce((sum, t) => sum + (t.fired_count || 0), 0);
  const activeCount = triggers.filter((t) => t.is_active).length;

  // === Toggle is_active ===
  const handleToggle = async (trigger: TriggerRow) => {
    setSavingId(trigger.id);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('triggers') as any)
        .update({ is_active: !trigger.is_active })
        .eq('id', trigger.id);
      if (error) throw error;
      setTriggers((prev) => prev.map((t) => t.id === trigger.id ? { ...t, is_active: !t.is_active } : t));
      showToast(trigger.is_active ? `หยุด "${trigger.name}" แล้ว` : `เปิด "${trigger.name}" แล้ว`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'อัปเดตไม่สำเร็จ';
      showToast(msg, 'error');
    } finally {
      setSavingId(null);
    }
  };

  // === Delete ===
  const handleDelete = async () => {
    if (!selectedTrigger) return;
    setSavingId(selectedTrigger.id);
    try {
      const { error } = await supabase.from('triggers').delete().eq('id', selectedTrigger.id);
      if (error) throw error;
      setTriggers((prev) => prev.filter((t) => t.id !== selectedTrigger.id));
      showToast(`ลบ "${selectedTrigger.name}" แล้ว`);
      setShowDelete(false);
      setSelectedTrigger(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'ลบไม่สำเร็จ';
      showToast(msg, 'error');
    } finally {
      setSavingId(null);
    }
  };

  // === Create ===
  const handleCreate = async () => {
    setFormError(null);
    if (!formName.trim()) return setFormError('กรอกชื่อ trigger');
    if (!formEventType) return setFormError('เลือก event type');
    if (!formTemplate.trim()) return setFormError('กรอกข้อความที่จะส่ง');

    setFormSaving(true);
    try {
      const payload = {
        tenant_id: currentTenant?.id,
        name: formName,
        description: formDescription || null,
        event_type: formEventType,
        action_type: 'send_line_message',
        action_config: { message_template: formTemplate },
        is_active: formIsActive,
        fired_count: 0,
        created_by: userProfile?.id ?? null,
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('triggers') as any).insert([payload]);
      if (error) throw error;
      showToast(`สร้าง "${formName}" แล้ว`);
      setShowCreate(false);
      resetForm();
      loadTriggers();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'สร้างไม่สำเร็จ';
      setFormError(msg);
    } finally {
      setFormSaving(false);
    }
  };

  // Group catalog by category for the create modal
  const catalogByCategory = EVENT_CATALOG.reduce((acc, ev) => {
    if (!acc[ev.category]) acc[ev.category] = [];
    acc[ev.category].push(ev);
    return acc;
  }, {} as Record<string, EventCatalogItem[]>);

  // Get template for selected trigger (for preview)
  const getMessageTemplate = (trigger: TriggerRow): string => {
    const cfg = trigger.action_config;
    if (cfg && typeof cfg === 'object' && 'message_template' in cfg) {
      return String((cfg as Record<string, unknown>).message_template || '');
    }
    // Fallback to default from catalog
    const ev = EVENT_CATALOG.find((e) => e.event_type === trigger.event_type);
    return ev?.default_template || '(ไม่มี template)';
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-7">
            {/* === Page Title === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Marketing Automation
                </span>
                <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Triggers</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">Automation rules · เมื่อเกิด event ระบบจะส่ง LINE หาลูกค้าอัตโนมัติ</p>
              </div>
              <Button
                onClick={() => { resetForm(); setShowCreate(true); }}
                style={{ backgroundColor: KK.red, color: "#fff", border: "none" }}
                className="rounded-xl text-sm h-11 px-5"
              >
                <Plus className="w-4 h-4 mr-1.5" /> สร้าง Trigger ใหม่
              </Button>
            </div>

            {/* Toast */}
            {toast && (
              <div className="fixed top-6 right-6 z-50 rounded-xl p-3.5 flex items-center gap-2.5 border shadow-lg bg-white max-w-md" style={{ borderColor: toast.type === 'success' ? '#86efac' : KK.redBorder }}>
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: KK.green }} />
                ) : (
                  <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: KK.red }} />
                )}
                <p className="text-sm font-semibold flex-1" style={{ color: toast.type === 'success' ? KK.green : KK.red }}>{toast.msg}</p>
                <button onClick={() => setToast(null)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
              </div>
            )}

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { title: "Triggers ทั้งหมด",    value: triggers.length.toString(), icon: Zap,     color: KK.red,    bg: KK.redLight },
                { title: "Active",              value: activeCount.toString(),     icon: Play,    color: KK.green,  bg: KK.greenLight },
                { title: "Paused",              value: (triggers.length - activeCount).toString(), icon: Pause, color: KK.gray, bg: KK.grayLight },
                { title: "ส่งทั้งหมด (สะสม)",   value: totalFired.toLocaleString(), icon: Send, color: KK.purple, bg: KK.purpleLight },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft">
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: kpi.bg }}>
                      <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Triggers List */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              {/* Filter tabs */}
              <div className="flex gap-1 mb-5 border-b border-gray-100 -mx-6 px-6 overflow-x-auto">
                {[
                  { value: "all",    label: "ทั้งหมด", count: triggers.length },
                  { value: "active", label: "Active",  count: activeCount },
                  { value: "paused", label: "Paused",  count: triggers.length - activeCount },
                ].map((tab) => {
                  const isActive = filter === tab.value;
                  return (
                    <button
                      key={tab.value}
                      onClick={() => setFilter(tab.value as "all" | "active" | "paused")}
                      className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
                      style={{ color: isActive ? KK.red : "#6b7280", borderColor: isActive ? KK.red : "transparent" }}
                    >
                      {tab.label}
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold tabular-nums" style={{ backgroundColor: isActive ? KK.redLight : "#f3f4f6", color: isActive ? KK.red : "#6b7280" }}>
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Trigger cards */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: KK.red }} />
                  <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12">
                  <Zap className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 mb-1">ยังไม่มี Triggers</p>
                  <p className="text-xs text-gray-400">กดปุ่ม "+ สร้าง Trigger ใหม่" เพื่อเริ่ม</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filtered.map((trigger) => {
                    const display = getEventDisplay(trigger.event_type);
                    const Icon = display.icon;
                    const isSaving = savingId === trigger.id;
                    return (
                      <div key={trigger.id} className="border border-gray-100 rounded-xl p-4 hover:shadow-soft-md transition-all">
                        <div className="flex items-start justify-between mb-3 gap-2">
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: display.bg }}>
                              <Icon className="w-5 h-5" style={{ color: display.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-sm font-bold text-gray-900 truncate">{trigger.name}</h3>
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: trigger.is_active ? KK.greenLight : KK.grayLight, color: trigger.is_active ? "#047857" : KK.gray }}>
                                  {trigger.is_active ? "ACTIVE" : "PAUSED"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 line-clamp-2">{trigger.description}</p>
                            </div>
                          </div>
                          {/* Active toggle */}
                          <Switch
                            checked={trigger.is_active}
                            onCheckedChange={() => handleToggle(trigger)}
                            disabled={isSaving}
                            className="data-[state=checked]:bg-chateau"
                          />
                        </div>

                        <div className="flex items-center gap-2 text-[11px] font-mono pt-3 border-t border-gray-50">
                          <span className="px-2 py-1 rounded" style={{ backgroundColor: KK.grayLight, color: KK.gray }}>{trigger.event_type}</span>
                          <span className="text-gray-300">→</span>
                          <span className="px-2 py-1 rounded font-semibold" style={{ backgroundColor: display.bg, color: display.color }}>{trigger.action_type}</span>
                          <span className="ml-auto text-xs text-gray-500 tabular-nums">{(trigger.fired_count || 0).toLocaleString()} ครั้ง</span>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => { setSelectedTrigger(trigger); setShowTest(true); }}
                            className="flex-1 flex items-center justify-center gap-1.5 h-8 text-xs font-semibold rounded-lg transition-colors"
                            style={{ color: KK.red, backgroundColor: KK.redLight }}
                          >
                            <Eye className="w-3.5 h-3.5" /> ดูตัวอย่าง
                          </button>
                          <button
                            onClick={() => { setSelectedTrigger(trigger); setShowDelete(true); }}
                            className="flex items-center justify-center w-8 h-8 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="ลบ"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ============================================================================
          CREATE MODAL
          ============================================================================ */}
      <Dialog open={showCreate} onOpenChange={(open) => { if (!open) { setShowCreate(false); resetForm(); } }}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: KK.redLight }}>
                <Zap className="w-4 h-4" style={{ color: KK.red }} />
              </span>
              สร้าง Trigger ใหม่
            </DialogTitle>
            <DialogDescription>
              เลือก event ที่จะให้ระบบส่งข้อความอัตโนมัติเมื่อเกิดขึ้น
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Step 1: Event picker (grouped) */}
            <div>
              <Label className="text-sm font-semibold text-gray-900 mb-2 block">1. เลือก Event <span className="text-red-500">*</span></Label>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {Object.entries(catalogByCategory).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-[11px] font-semibold uppercase text-gray-400 tracking-wide mb-1.5">{category}</p>
                    <div className="space-y-1.5">
                      {items.map((ev) => {
                        const isSel = formEventType === ev.event_type;
                        const Icon = ev.icon;
                        return (
                          <button
                            key={ev.event_type}
                            onClick={() => setFormEventType(ev.event_type)}
                            className="w-full text-left flex items-start gap-3 p-2.5 rounded-lg border transition-all"
                            style={{
                              borderColor: isSel ? KK.red : '#e5e7eb',
                              backgroundColor: isSel ? KK.redLight : 'white',
                            }}
                          >
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: ev.bg }}>
                              <Icon className="w-4 h-4" style={{ color: ev.color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-gray-900 truncate">{ev.label}</p>
                              <p className="text-[11px] text-gray-500 line-clamp-1">{ev.description}</p>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 mt-1.5">{ev.event_type}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step 2: Name + description */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium text-gray-700">2. ชื่อ Trigger <span className="text-red-500">*</span></Label>
                <Input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ต้อนรับ Lead ใหม่"
                  className="mt-1 h-10 rounded-lg"
                />
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-700">คำอธิบาย</Label>
                <Input
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="บอกว่า trigger นี้ใช้ทำอะไร"
                  className="mt-1 h-10 rounded-lg"
                />
              </div>
            </div>

            {/* Step 3: Message template */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-sm font-medium text-gray-700">3. ข้อความที่จะส่ง <span className="text-red-500">*</span></Label>
                <span className="text-[11px] text-gray-400">รองรับ <code className="font-mono px-1 bg-gray-100 rounded">{`{{token}}`}</code></span>
              </div>
              <Textarea
                value={formTemplate}
                onChange={(e) => setFormTemplate(e.target.value)}
                placeholder="เช่น: ยินดีต้อนรับคุณ {{first_name}} สู่ {{tenant_name}}!"
                rows={5}
                className="rounded-lg text-sm font-mono"
              />
              <p className="text-[11px] text-gray-500 mt-1.5">
                Tokens ที่ใช้ได้: <code className="font-mono">{`{{first_name}}`}</code>, <code className="font-mono">{`{{property_name}}`}</code>, <code className="font-mono">{`{{tenant_name}}`}</code>, <code className="font-mono">{`{{sales_name}}`}</code>, <code className="font-mono">{`{{viewing_date}}`}</code>, ฯลฯ
              </p>
            </div>

            {/* Step 4: Active toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 border border-gray-200">
              <div>
                <p className="text-sm font-medium text-gray-900">เปิดใช้งานทันที</p>
                <p className="text-[11px] text-gray-500">ถ้าปิด — สร้างเป็น Paused (ทดสอบก่อนค่อยเปิด)</p>
              </div>
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} className="data-[state=checked]:bg-chateau" />
            </div>

            {formError && (
              <div className="rounded-lg p-3 flex items-start gap-2 border" style={{ backgroundColor: KK.redLight, borderColor: KK.redBorder }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: KK.red }} />
                <p className="text-sm" style={{ color: KK.red }}>{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }}>ยกเลิก</Button>
            <Button
              onClick={handleCreate}
              disabled={formSaving}
              style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }}
            >
              {formSaving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
              สร้าง Trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================================
          TEST / PREVIEW MODAL
          ============================================================================ */}
      <Dialog open={showTest} onOpenChange={(open) => { if (!open) { setShowTest(false); setSelectedTrigger(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: KK.redLight }}>
                <Eye className="w-4 h-4" style={{ color: KK.red }} />
              </span>
              ตัวอย่างข้อความ
            </DialogTitle>
            <DialogDescription>
              ข้อความที่จะถูกส่งเมื่อ trigger นี้ทำงาน
            </DialogDescription>
          </DialogHeader>

          {selectedTrigger && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{selectedTrigger.name}</span>
                <br />
                Event: <code className="font-mono px-1 bg-gray-100 rounded">{selectedTrigger.event_type}</code>
              </div>

              {/* LINE-style preview */}
              <div className="rounded-xl p-4" style={{ backgroundColor: "#3a4858" }}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: KK.green }}>C</div>
                  <div>
                    <p className="text-white text-sm font-semibold leading-tight">CHATEAU</p>
                    <p className="text-white/60 text-[11px]">Official Account</p>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-3.5">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                    {renderPreview(getMessageTemplate(selectedTrigger))}
                  </p>
                </div>
                <p className="text-white/50 text-[10px] text-right mt-1.5">อ่านแล้ว</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowTest(false); setSelectedTrigger(null); }}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================================
          DELETE CONFIRMATION
          ============================================================================ */}
      <Dialog open={showDelete} onOpenChange={(open) => { if (!open) { setShowDelete(false); setSelectedTrigger(null); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: KK.redLight }}>
                <Trash2 className="w-4 h-4" style={{ color: KK.red }} />
              </span>
              ยืนยันการลบ
            </DialogTitle>
            <DialogDescription>
              จะลบ trigger นี้ออกจากฐานข้อมูล — ไม่สามารถกู้คืนได้
            </DialogDescription>
          </DialogHeader>

          {selectedTrigger && (
            <div className="rounded-lg p-3 bg-gray-50 border border-gray-200 my-2">
              <p className="text-sm font-semibold text-gray-900">{selectedTrigger.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{selectedTrigger.description}</p>
              <p className="text-[11px] text-gray-400 mt-2 font-mono">{selectedTrigger.event_type} · ยิงไปแล้ว {selectedTrigger.fired_count} ครั้ง</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDelete(false); setSelectedTrigger(null); }}>ยกเลิก</Button>
            <Button
              onClick={handleDelete}
              disabled={savingId === selectedTrigger?.id}
              style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }}
            >
              {savingId === selectedTrigger?.id ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1.5" />}
              ลบ trigger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminGuard>
  );
};

export default Triggers;
