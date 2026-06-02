import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AdminGuard } from "@/components/auth/PermissionGuard";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import {
  Wand2,
  Check,
  Send,
  Save,
  Sparkles,
  Image as ImageIcon,
  Layout,
  Square,
  MousePointerClick,
  Users,
  ChevronRight,
  Calendar,
  Clock,
  Loader2,
  AlertCircle,
  Building2,
  Link as LinkIcon,
  Hash,
  Target,
  UserCheck,
  MessageSquare,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

const KK = {
  red: '#e60023', redLight: '#fff1f2', redBorder: '#fecdd3',
  blue: '#3b82f6', blueLight: '#eff6ff',
  purple: '#8b5cf6', purpleLight: '#f5f3ff',
  green: '#10b981', greenLight: '#ecfdf5',
  orange: '#f97316', orangeLight: '#fff7ed',
  amber: '#f59e0b', amberLight: '#fffbeb',
  gray: '#6b7280', grayLight: '#f3f4f6',
};

// Thai relative-time for the "อัปเดตล่าสุด" badge.
const relativeThai = (iso: string | null): string => {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs)) return '';
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'เมื่อสักครู่';
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชม.ที่แล้ว`;
  const day = Math.floor(hr / 24);
  return `${day} วันที่แล้ว`;
};

const STEPS = [
  { num: 1, label: "เลือก Segment",       desc: "เลือกกลุ่มเป้าหมาย — เลือกจาก Segments ที่สร้างไว้" },
  { num: 2, label: "ออกแบบ LINE Push",   desc: "เขียน content + เลือก template + preview" },
  { num: 3, label: "ตั้งเวลา + ยืนยัน",   desc: "Schedule / Send Now / รอ Approval" },
];

const TEMPLATES = [
  { id: "carousel", label: "Carousel", icon: Layout },
  { id: "bubble",   label: "Bubble",   icon: Square },
  { id: "image",    label: "Image",    icon: ImageIcon },
  { id: "buttons",  label: "Buttons",  icon: MousePointerClick },
];

interface SegmentRow {
  id: string;
  code: string;
  name: string;
  description: string | null;
  member_count: number;
  last_computed_at: string | null;
}

interface PropertyRow {
  id: string;
  name: string;
  type: string;
  base_price: number | null;
  images: any;
}

interface ApproverRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
}

const CAMPAIGN_TYPES = [
  { value: "launch",                label: " Project Launch",         desc: "เปิดโครงการใหม่" },
  { value: "open_house",            label: " Open House",              desc: "นัดดูบ้าน" },
  { value: "construction_update",   label: " Construction Update",     desc: "ความคืบหน้า" },
  { value: "sales",                 label: " Sales Update",            desc: "ห้องเหลือ/โปรพิเศษ" },
  { value: "event",                 label: " Event Invitation",        desc: "งานอีเวนต์" },
  { value: "newsletter",            label: " Newsletter",              desc: "ข่าวสารทั่วไป" },
];

const PERSONALIZATION_TOKENS = [
  { token: "{{first_name}}",          label: "ชื่อจริง" },
  { token: "{{last_name}}",           label: "นามสกุล" },
  { token: "{{property_interested}}", label: "โครงการที่สนใจ" },
  { token: "{{tenant_name}}",         label: "ชื่อบริษัท" },
  { token: "{{sales_name}}",          label: "ชื่อ Sales ที่ดูแล" },
];

const CampaignBuilderWizard = () => {
  const { currentTenant, userProfile } = useSimpleAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);

  // === Reference data จาก DB ===
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [segmentsLoading, setSegmentsLoading] = useState(true);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [approvers, setApprovers] = useState<ApproverRow[]>([]);

  // Reusable so we can re-fetch fresh member_count after a recompute.
  const loadSegments = async () => {
    if (!currentTenant?.id) return;
    const { data, error } = await supabase
      .from('segments')
      .select('id, code, name, description, member_count, last_computed_at')
      .eq('tenant_id', currentTenant.id)
      .eq('is_active', true)
      .order('member_count', { ascending: false });
    if (error) throw error;
    setSegments(data || []);
  };

  // Live-rebuild segment membership against current leads, then re-fetch. member_count
  // ships as a seed and drifts as leads change; this is the manual "make it accurate now".
  const handleRecompute = async () => {
    if (!currentTenant?.id || recomputing) return;
    setRecomputing(true);
    setSegmentsError(null);
    try {
      const { error } = await supabase.rpc('recompute_segment_members', { p_tenant_id: currentTenant.id });
      if (error) throw error;
      await loadSegments();
    } catch (e: any) {
      console.error('Recompute segments failed:', e);
      setSegmentsError(e?.message || 'คำนวณ segment ใหม่ไม่สำเร็จ');
    } finally {
      setRecomputing(false);
    }
  };

  // Newest last_computed_at across loaded segments → drives the freshness badge.
  const segmentsFreshness = relativeThai(
    segments.reduce<string | null>((newest, s) =>
      s.last_computed_at && (!newest || s.last_computed_at > newest) ? s.last_computed_at : newest, null)
  );

  useEffect(() => {
    if (!currentTenant?.id) { setSegmentsLoading(false); return; }
    const load = async () => {
      // Load segments
      try {
        await loadSegments();
      } catch (e: any) {
        console.error('Failed to load segments:', e);
        setSegmentsError(e?.message || 'โหลด segments ไม่สำเร็จ');
      } finally {
        setSegmentsLoading(false);
      }

      // Load properties (สำหรับ Step 1)
      try {
        const { data } = await supabase
          .from('properties')
          .select('id, name, type, base_price, images')
          .eq('tenant_id', currentTenant.id)
          .eq('is_active', true)
          .order('name');
        setProperties(data || []);
      } catch (e) { console.error('Failed to load properties:', e); }

      // Load approvers (Owner role)
      try {
        const { data } = await supabase
          .from('users')
          .select('id, full_name, email, role')
          .eq('tenant_id', currentTenant.id)
          .in('role', ['owner', 'admin'])
          .eq('is_active', true);
        setApprovers(data || []);
      } catch (e) { console.error('Failed to load approvers:', e); }
    };
    load();
  }, [currentTenant]);

  // === Form state ===
  // Step 1
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  // Step 2
  const [campaignType, setCampaignType] = useState("newsletter");
  const [campaignName, setCampaignName] = useState("");
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [ctaText, setCtaText] = useState("ดูรายละเอียด");
  const [ctaUrl, setCtaUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("bubble");

  // Step 3
  const [scheduleType, setScheduleType] = useState<"now" | "schedule" | "recurring">("now");
  const [scheduleDate, setScheduleDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [scheduleTime, setScheduleTime] = useState("10:00");
  const [recurringPattern, setRecurringPattern] = useState("weekly_friday");
  const [approverId, setApproverId] = useState("");
  const [approverNote, setApproverNote] = useState("");
  const [kpiOpenRate, setKpiOpenRate] = useState("");
  const [kpiClickRate, setKpiClickRate] = useState("");

  // === Save state ===
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const toggleSegment = (id: string) => {
    setSelectedSegments((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  };
  const toggleProperty = (id: string) => {
    setSelectedProperties((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  // === Validation per step ===
  const stepValid = (step: number): { valid: boolean; reason?: string } => {
    if (step === 1) {
      if (selectedSegments.length === 0) return { valid: false, reason: "ต้องเลือกอย่างน้อย 1 segment" };
      return { valid: true };
    }
    if (step === 2) {
      if (!campaignName.trim())     return { valid: false, reason: "กรอก ชื่อแคมเปญ" };
      if (!headline.trim())         return { valid: false, reason: "กรอก Headline" };
      if (!body.trim())             return { valid: false, reason: "กรอก Message Body" };
      if (body.length > 1000)       return { valid: false, reason: "Message Body เกิน 1000 ตัวอักษร" };
      if (!ctaText.trim())          return { valid: false, reason: "กรอก CTA Text" };
      if (!ctaUrl.trim())           return { valid: false, reason: "กรอก CTA URL ปลายทาง" };
      if (!/^https?:\/\//.test(ctaUrl)) return { valid: false, reason: "CTA URL ต้องเริ่มด้วย http:// หรือ https://" };
      return { valid: true };
    }
    if (step === 3) {
      if (scheduleType === "schedule" && (!scheduleDate || !scheduleTime))
        return { valid: false, reason: "เลือกวันและเวลาส่ง" };
      return { valid: true };
    }
    return { valid: true };
  };

  const currentValidation = stepValid(activeStep);

  const goNext = () => {
    if (!currentValidation.valid) return;
    if (activeStep < 3) {
      setCompletedSteps((prev) => [...new Set([...prev, activeStep])]);
      setActiveStep(activeStep + 1);
    }
  };
  const goBack = () => activeStep > 1 && setActiveStep(activeStep - 1);

  // Insert token at end of body
  const insertToken = (token: string) => {
    setBody((prev) => prev + token);
  };

  // Compute audience reach
  const totalReach = segments.filter((s) => selectedSegments.includes(s.id))
    .reduce((sum, s) => sum + (s.member_count || 0), 0);

  // === Save campaign to DB ===
  const saveCampaign = async (saveStatus: 'draft' | 'pending_approval') => {
    // Pre-flight validation
    setSaveError(null);
    setSaveSuccess(null);

    if (selectedSegments.length === 0) {
      setSaveError('เลือก segment อย่างน้อย 1 รายการก่อน (Step 1)');
      setActiveStep(1);
      return;
    }
    if (!campaignName.trim() || !headline.trim() || !body.trim() || !ctaText.trim() || !ctaUrl.trim()) {
      setSaveError('กรอกข้อมูล Step 2 ให้ครบ (ชื่อ / Headline / Body / CTA Text / CTA URL)');
      setActiveStep(2);
      return;
    }
    if (!/^https?:\/\//.test(ctaUrl)) {
      setSaveError('CTA URL ต้องเริ่มด้วย http:// หรือ https://');
      setActiveStep(2);
      return;
    }
    if (saveStatus === 'pending_approval' && !approverId) {
      setSaveError('เลือก Approver ก่อน Submit (Step 3)');
      setActiveStep(3);
      return;
    }

    setSaving(true);
    try {
      // Map selected segment IDs → codes (campaigns.segments stores codes)
      const segmentCodes = segments
        .filter((s) => selectedSegments.includes(s.id))
        .map((s) => s.code);

      // Compute scheduled_at + start/end dates
      let scheduledAt: string | null = null;
      let startDate = new Date().toISOString().split('T')[0];
      if (scheduleType === 'now') {
        scheduledAt = new Date().toISOString();
      } else if (scheduleType === 'schedule') {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
        startDate = scheduleDate;
      }
      const endDateD = new Date(startDate);
      endDateD.setDate(endDateD.getDate() + 30);
      const endDate = endDateD.toISOString().split('T')[0];

      const payload: Record<string, unknown> = {
        tenant_id: currentTenant?.id,
        campaign_code: `CMP-${Date.now().toString(36).toUpperCase()}`,
        campaign_name: campaignName,
        detail: body,
        image_url: imageUrl || null,
        start_date: startDate,
        end_date: endDate,
        frequency: scheduleType === 'recurring' ? recurringPattern : 'one_time',
        segments: segmentCodes,
        activities: [campaignType],
        status: saveStatus,
        created_by: userProfile?.id ?? null,

        // Marketing extension columns (from migration 20260424000002)
        property_id: selectedProperties[0] ?? null,
        campaign_type: campaignType,
        cta_text: ctaText,
        cta_url: ctaUrl,
        template: selectedTemplate,
        headline,
        message_body: body,
        schedule_type: scheduleType,
        scheduled_at: scheduledAt,
        approval_status: saveStatus === 'pending_approval' ? 'pending' : null,
        approver_id: saveStatus === 'pending_approval' ? approverId : null,
        utm_params: { source: 'line', campaign: 'auto', kpi_open: kpiOpenRate || null, kpi_click: kpiClickRate || null, approver_note: approverNote || null },
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('campaigns') as any)
        .insert([payload])
        .select();

      if (error) throw error;

      setSaveSuccess(
        saveStatus === 'draft'
          ? `บันทึก Draft สำเร็จ — กำลังกลับไปที่หน้ารายการ...`
          : `ส่งไปขอ Approval สำเร็จ — กำลังกลับไปที่หน้ารายการ...`
      );
      console.log('Campaign saved:', data?.[0]?.id);
      setTimeout(() => navigate('/campaigns'), 1200);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ';
      console.error('Save campaign failed:', e);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => saveCampaign('draft');
  const handleSubmitForApproval = () => saveCampaign('pending_approval');

  return (
    <AdminGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:pl-[260px]">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-8 space-y-7">
            {/* === Page Title === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  สร้างแคมเปญใน 4 ขั้นตอน
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Campaign Builder Wizard</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">Drag &amp; Drop · ไม่ต้องจ้าง Agency · Preview ทุกขั้นตอน · Approval Flow บังคับก่อนส่ง</p>
              </div>
              <div className="flex gap-2.5">
                <Button
                  variant="outline"
                  className="rounded-xl text-sm h-11 px-5 border-gray-200"
                  onClick={handleSaveDraft}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
                  บันทึก Draft
                </Button>
                <Button
                  style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }}
                  className="rounded-xl text-sm h-11 px-5"
                  onClick={handleSubmitForApproval}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Send className="w-4 h-4 mr-1.5" />}
                  Submit for Approval
                </Button>
              </div>
            </div>

            {/* Save status banner */}
            {saveError && (
              <div className="rounded-xl p-3.5 flex items-start gap-2.5 border" style={{ backgroundColor: KK.redLight, borderColor: KK.redBorder }}>
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: KK.red }} />
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: KK.red }}>บันทึกไม่สำเร็จ</p>
                  <p className="text-xs text-gray-600 mt-0.5">{saveError}</p>
                </div>
                <button onClick={() => setSaveError(null)} className="text-gray-400 hover:text-gray-600 text-sm">×</button>
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-xl p-3.5 flex items-center gap-2.5 border" style={{ backgroundColor: KK.greenLight, borderColor: '#86efac' }}>
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" style={{ color: KK.green }} />
                <p className="text-sm font-semibold flex-1" style={{ color: KK.green }}>{saveSuccess}</p>
              </div>
            )}

            {/* === Stepper === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
              <div className="flex items-center justify-between gap-3">
                {STEPS.map((step, idx) => {
                  const isActive = activeStep === step.num;
                  const isCompleted = completedSteps.includes(step.num);
                  const isLast = idx === STEPS.length - 1;
                  return (
                    <div key={step.num} className="flex-1 flex items-start gap-3">
                      <div className="flex flex-col items-center flex-1">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-base mb-3 transition-all"
                          style={{
                            backgroundColor: isCompleted ? KK.green : isActive ? KK.red : KK.grayLight,
                            color: isCompleted || isActive ? "#fff" : KK.gray,
                            boxShadow: isActive ? "0 4px 12px rgba(230, 0, 35, 0.25)" : isCompleted ? "0 2px 6px rgba(16, 185, 129, 0.2)" : "none",
                          }}
                        >
                          {isCompleted ? <Check className="w-5 h-5" /> : step.num}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 text-center">{step.label}</p>
                        <p className="text-[11px] text-gray-500 text-center mt-1 max-w-[180px]">{step.desc}</p>
                      </div>
                      {!isLast && (
                        <div className="flex-1 h-0.5 mt-6" style={{ backgroundColor: completedSteps.includes(step.num) ? KK.green : KK.grayLight }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* === Main: Form (2/3) + LINE Preview (1/3) === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Form section */}
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6 space-y-5">
                {/* STEP 1: Segment (จาก DB จริง) */}
                {activeStep === 1 && (
                  <>
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Users className="w-5 h-5" style={{ color: KK.red }} />
                        <h2 className="text-lg font-bold text-gray-900">Step 1: เลือก Segment</h2>
                      </div>
                      {/* Member counts are a live cache — recompute rebuilds them against
                          current leads so the campaign reaches the right people. */}
                      <div className="flex items-center gap-2">
                        {segmentsFreshness && (
                          <span className="text-[11px] text-gray-400">อัปเดตล่าสุด: {segmentsFreshness}</span>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRecompute}
                          disabled={recomputing || segmentsLoading}
                          className="h-8 text-xs"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${recomputing ? 'animate-spin' : ''}`} />
                          {recomputing ? 'กำลังคำนวณ…' : 'คำนวณใหม่'}
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">เลือกกลุ่มเป้าหมายจาก Segments ที่บันทึกไว้ — เลือกได้หลายกลุ่ม</p>

                    {segmentsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 animate-spin" style={{ color: KK.red }} />
                        <span className="ml-2 text-sm text-gray-500">กำลังโหลด segments จากฐานข้อมูล...</span>
                      </div>
                    ) : segmentsError ? (
                      <div className="rounded-xl p-5 border" style={{ backgroundColor: KK.redLight, borderColor: KK.redBorder }}>
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: KK.red }} />
                          <div>
                            <p className="text-sm font-semibold text-gray-900">โหลด Segments ไม่สำเร็จ</p>
                            <p className="text-xs text-gray-600 mt-1">{segmentsError}</p>
                            <p className="text-xs text-gray-500 mt-2">
                               หาก table <code className="font-mono">segments</code> ยังไม่มีใน DB —
                              ต้อง apply migration <code className="font-mono">20260424000002_create_marketing_tables.sql</code> ก่อน
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : segments.length === 0 ? (
                      <div className="rounded-xl p-5 border-2 border-dashed border-gray-200 text-center">
                        <Users className="w-10 h-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-sm font-semibold text-gray-700 mb-1">ยังไม่มี Segments</p>
                        <p className="text-xs text-gray-500 mb-3">สร้าง segment กลุ่มเป้าหมายก่อนเริ่มแคมเปญ</p>
                        <p className="text-[11px] text-gray-400">
                           ถ้าเป็นการ demo — apply migration <code className="font-mono">20260424000003_seed_marketing_demo_data.sql</code><br/>
                          เพื่อ seed 10 segments ตัวอย่างเข้า DB
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {segments.map((seg) => {
                            const isSelected = selectedSegments.includes(seg.id);
                            return (
                              <button
                                key={seg.id}
                                onClick={() => toggleSegment(seg.id)}
                                className="flex items-center justify-between p-4 rounded-xl border-2 transition-all text-left"
                                style={{
                                  borderColor: isSelected ? KK.red : KK.grayLight,
                                  backgroundColor: isSelected ? KK.redLight : "#fff",
                                }}
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{seg.name}</p>
                                  <p className="text-xs text-gray-500 mt-0.5 tabular-nums">
                                    {(seg.member_count ?? 0).toLocaleString()} คน
                                    {seg.description && <span className="text-gray-400"> · {seg.description}</span>}
                                  </p>
                                </div>
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center border-2 flex-shrink-0 ml-3"
                                  style={{ borderColor: isSelected ? KK.red : KK.gray, backgroundColor: isSelected ? KK.red : "transparent" }}
                                >
                                  {isSelected && <Check className="w-3 h-3 text-white" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <div className="rounded-xl p-3" style={{ backgroundColor: KK.blueLight }}>
                          <p className="text-xs font-semibold" style={{ color: KK.blue }}>
                            รวมกลุ่มเป้าหมาย: {totalReach.toLocaleString()} คน
                            <span className="text-gray-500 font-normal ml-1">
                              ({selectedSegments.length} จาก {segments.length} segments · หัก unsubscribed อัตโนมัติตอนส่ง)
                            </span>
                          </p>
                        </div>
                      </>
                    )}

                    {/* === Property selector — สำหรับ real estate === */}
                    {properties.length > 0 && (
                      <div className="mt-6 pt-6 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <Label className="text-sm font-semibold text-gray-900">โครงการที่ promote (ไม่บังคับ)</Label>
                            <p className="text-xs text-gray-500 mt-0.5">ผูกแคมเปญกับโครงการเพื่อ track conversion · {properties.length} โครงการ</p>
                          </div>
                          {selectedProperties.length > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                              เลือก {selectedProperties.length}
                            </span>
                          )}
                        </div>
                        {/* Show every assigned project (RLS already scopes this list); scroll
                            instead of capping so nothing is silently hidden when a tenant has
                            many projects. */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                          {properties.map((p) => {
                            const isSel = selectedProperties.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleProperty(p.id)}
                                className="flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left"
                                style={{
                                  borderColor: isSel ? KK.red : '#e5e7eb',
                                  backgroundColor: isSel ? KK.redLight : '#fff',
                                }}
                              >
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isSel ? KK.red : KK.grayLight }}>
                                  <Building2 className="w-4 h-4" style={{ color: isSel ? '#fff' : KK.gray }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                                  <p className="text-[10px] text-gray-500 capitalize">{p.type}</p>
                                </div>
                                {isSel && <Check className="w-4 h-4 flex-shrink-0" style={{ color: KK.red }} />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* STEP 2: LINE Push Design */}
                {activeStep === 2 && (
                  <>
                    <div className="flex items-center gap-2 mb-4">
                      <Wand2 className="w-5 h-5" style={{ color: KK.red }} />
                      <h2 className="text-lg font-bold text-gray-900">Step 2: ออกแบบ LINE Push</h2>
                    </div>

                    {/* Campaign Type */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <Hash className="w-3.5 h-3.5" /> ประเภทแคมเปญ <span className="text-red-500">*</span>
                      </Label>
                      <select
                        value={campaignType}
                        onChange={(e) => setCampaignType(e.target.value)}
                        className="mt-1.5 w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-chateau/20 focus:border-chateau"
                      >
                        {CAMPAIGN_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label} — {t.desc}</option>
                        ))}
                      </select>
                    </div>

                    {/* Campaign Name */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700">ชื่อแคมเปญ <span className="text-red-500">*</span></Label>
                      <Input
                        value={campaignName}
                        onChange={(e) => setCampaignName(e.target.value)}
                        placeholder="เช่น Family Weekend Special April 2026"
                        className="mt-1.5 h-11 rounded-xl"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">ชื่อสำหรับ admin · ลูกค้าจะไม่เห็น</p>
                    </div>

                    {/* Headline */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700">Headline <span className="text-red-500">*</span></Label>
                      <Input
                        value={headline}
                        onChange={(e) => setHeadline(e.target.value)}
                        placeholder=" เปิดจองโครงการใหม่ — ส่วนลด 500K"
                        maxLength={120}
                        className="mt-1.5 h-11 rounded-xl"
                      />
                      <p className={`text-[11px] mt-1 ${headline.length > 100 ? 'text-amber-600' : 'text-gray-400'}`}>
                        {headline.length} / 120 ตัวอักษร · แสดงเป็นหัวข้อใน LINE
                      </p>
                    </div>

                    {/* Message Body + Token Picker */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-sm font-medium text-gray-700">
                          Message Body <span className="text-red-500">*</span>
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] text-gray-500">+ Token:</span>
                          {PERSONALIZATION_TOKENS.map((t) => (
                            <button
                              key={t.token}
                              type="button"
                              onClick={() => insertToken(t.token)}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded border hover:bg-gray-50 transition-colors"
                              style={{ color: KK.red, borderColor: '#fecdd3' }}
                              title={t.label}
                            >
                              {t.token.replace(/[{}]/g, '')}
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        rows={5}
                        placeholder="สวัสดีครับ คุณ{{first_name}} —&#10;โครงการ {{property_interested}} เปิดจองรอบพิเศษ ส่วนลดสูงสุด 500,000 บาท..."
                        className="rounded-xl"
                      />
                      <div className="flex items-center justify-between mt-1.5">
                        <p className={`text-[11px] ${body.length > 1000 ? 'text-red-500 font-semibold' : body.length > 800 ? 'text-amber-600' : 'text-gray-400'}`}>
                          {body.length} / 1000 ตัวอักษร · LINE Flex Message
                        </p>
                        <p className="text-[11px] text-gray-400">
                           ใช้ token ทำให้ message ส่วนตัว · CTR เพิ่ม 3-5×
                        </p>
                      </div>
                    </div>

                    {/* Hero Image URL */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 flex items-center gap-1">
                        <ImageIcon className="w-3.5 h-3.5" /> Hero Image URL
                      </Label>
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://images.unsplash.com/... หรือ /properties/baan-issara/hero.jpg"
                        className="mt-1.5 h-11 rounded-xl"
                      />
                      <p className="text-[11px] text-gray-400 mt-1">รูปจะแสดงด้านบนของ LINE message · แนะนำ 800×500px</p>

                      {/* Live image preview */}
                      {imageUrl && /^https?:\/\//.test(imageUrl) && (
                        <div className="mt-3 rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
                          <div className="aspect-[8/5] w-full max-w-[280px] relative">
                            <img
                              src={imageUrl}
                              alt="Hero preview"
                              className="absolute inset-0 w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'flex';
                              }}
                              onLoad={(e) => {
                                const target = e.currentTarget;
                                target.style.display = 'block';
                                if (target.nextElementSibling) (target.nextElementSibling as HTMLElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-gray-400" style={{ display: 'none' }}>
                              <AlertCircle className="w-5 h-5" />
                              <p className="text-xs">โหลดรูปไม่สำเร็จ — ตรวจ URL</p>
                            </div>
                          </div>
                          <div className="px-3 py-2 border-t border-gray-200 flex items-center justify-between">
                            <p className="text-[10px] text-gray-500 truncate flex-1">{imageUrl}</p>
                            <button
                              type="button"
                              onClick={() => setImageUrl("")}
                              className="text-[10px] text-gray-400 hover:text-red-500 ml-2 flex-shrink-0"
                            >
                              ล้าง
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* CTA Section */}
                    <div className="rounded-xl p-4 border" style={{ backgroundColor: '#fafafa', borderColor: '#e5e7eb' }}>
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                        <Target className="w-4 h-4" style={{ color: KK.red }} /> Call-to-Action Button
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Button Text <span className="text-red-500">*</span></Label>
                          <Input
                            value={ctaText}
                            onChange={(e) => setCtaText(e.target.value)}
                            maxLength={20}
                            className="mt-1 h-10 rounded-lg text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                            <LinkIcon className="w-3 h-3" /> URL ปลายทาง <span className="text-red-500">*</span>
                          </Label>
                          <Input
                            value={ctaUrl}
                            onChange={(e) => setCtaUrl(e.target.value)}
                            placeholder="https://chateau.app/properties/baan-issara-2"
                            className="mt-1 h-10 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      {ctaUrl && /^https?:\/\//.test(ctaUrl) && (
                        <p className="text-[11px] text-gray-500 mt-2 flex items-center gap-1">
                           Auto-tracking: <code className="font-mono text-[10px]">?utm_source=line&amp;utm_campaign=auto</code>
                        </p>
                      )}
                    </div>

                    {/* Template */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">เลือก Template</Label>
                      <div className="grid grid-cols-4 gap-3">
                        {TEMPLATES.map((tmpl) => {
                          const isSelected = selectedTemplate === tmpl.id;
                          return (
                            <button
                              key={tmpl.id}
                              onClick={() => setSelectedTemplate(tmpl.id)}
                              className="aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-all"
                              style={{
                                borderColor: isSelected ? KK.red : KK.grayLight,
                                backgroundColor: isSelected ? KK.redLight : "#fff",
                              }}
                            >
                              <tmpl.icon className="w-7 h-7" style={{ color: isSelected ? KK.red : KK.gray }} />
                              <span className="text-xs font-semibold" style={{ color: isSelected ? KK.red : KK.gray }}>{tmpl.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}

                {/* STEP 3: Schedule + ยืนยัน */}
                {activeStep === 3 && (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5" style={{ color: KK.red }} />
                      <h2 className="text-lg font-bold text-gray-900">Step 3: ตั้งเวลา + Approval</h2>
                    </div>
                    <p className="text-sm text-gray-500 mb-4">เลือกรูปแบบการส่ง · กำหนด approver · ตั้ง KPI เป้าหมาย (optional)</p>

                    {/* Schedule Type — 3 options */}
                    <div>
                      <Label className="text-sm font-medium text-gray-700 mb-2 block">รูปแบบการส่ง</Label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: "now",       label: "ส่งทันที",     icon: Send,     desc: "หลังผ่าน Approval" },
                          { id: "schedule",  label: "ตั้งเวลาส่ง",  icon: Clock,    desc: "เลือกวันและเวลา" },
                          { id: "recurring", label: "ส่งซ้ำ",      icon: Calendar, desc: "Recurring schedule" },
                        ].map((opt) => {
                          const isSelected = scheduleType === opt.id;
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setScheduleType(opt.id as any)}
                              className="p-4 rounded-xl border-2 transition-all text-left"
                              style={{
                                borderColor: isSelected ? KK.red : KK.grayLight,
                                backgroundColor: isSelected ? KK.redLight : "#fff",
                              }}
                            >
                              <opt.icon className="w-5 h-5 mb-2" style={{ color: isSelected ? KK.red : KK.gray }} />
                              <p className="text-sm font-bold text-gray-900">{opt.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Date/Time picker */}
                    {scheduleType === "schedule" && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-sm font-medium text-gray-700">วันที่ส่ง <span className="text-red-500">*</span></Label>
                          <Input
                            type="date"
                            value={scheduleDate}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={(e) => setScheduleDate(e.target.value)}
                            className="mt-1.5 h-11 rounded-xl"
                          />
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-gray-700">เวลา <span className="text-red-500">*</span></Label>
                          <Input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="mt-1.5 h-11 rounded-xl"
                          />
                        </div>
                      </div>
                    )}

                    {/* Recurring pattern */}
                    {scheduleType === "recurring" && (
                      <div>
                        <Label className="text-sm font-medium text-gray-700">รูปแบบการส่งซ้ำ</Label>
                        <select
                          value={recurringPattern}
                          onChange={(e) => setRecurringPattern(e.target.value)}
                          className="mt-1.5 w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-chateau/20 focus:border-chateau"
                        >
                          <option value="daily">ทุกวัน · 09:00</option>
                          <option value="weekly_monday">ทุกวันจันทร์ · 09:00</option>
                          <option value="weekly_friday">ทุกวันศุกร์ · 09:00</option>
                          <option value="monthly_1st">วันที่ 1 ของทุกเดือน · 09:00</option>
                          <option value="monthly_15th">วันที่ 15 ของทุกเดือน · 09:00</option>
                        </select>
                      </div>
                    )}

                    {/* Approval workflow */}
                    <div className="rounded-xl p-4 border-2 border-dashed" style={{ borderColor: KK.amber }}>
                      <p className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: KK.amber }}>
                        <UserCheck className="w-4 h-4" /> Approval Workflow
                      </p>
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">เลือก Approver <span className="text-red-500">*</span></Label>
                          <select
                            value={approverId}
                            onChange={(e) => setApproverId(e.target.value)}
                            className="mt-1 w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white"
                          >
                            <option value="">-- เลือก Owner/Admin ที่จะอนุมัติ --</option>
                            {approvers.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.full_name || u.email} ({u.role})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> หมายเหตุถึง Approver (optional)
                          </Label>
                          <Textarea
                            value={approverNote}
                            onChange={(e) => setApproverNote(e.target.value)}
                            rows={2}
                            placeholder="เช่น ขอ approve ภายในวันนี้ · ส่งวันศุกร์ตามแผน Q2"
                            className="mt-1 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* KPI Goals (optional) */}
                    <div className="rounded-xl p-4 border" style={{ backgroundColor: '#fafafa', borderColor: '#e5e7eb' }}>
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
                        <Target className="w-4 h-4" style={{ color: KK.red }} /> KPI Target (optional)
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Open Rate Target (%)</Label>
                          <Input
                            type="number"
                            value={kpiOpenRate}
                            onChange={(e) => setKpiOpenRate(e.target.value)}
                            placeholder="60"
                            min="0"
                            max="100"
                            className="mt-1 h-10 rounded-lg text-sm"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-medium text-gray-600">Click Rate Target (%)</Label>
                          <Input
                            type="number"
                            value={kpiClickRate}
                            onChange={(e) => setKpiClickRate(e.target.value)}
                            placeholder="15"
                            min="0"
                            max="100"
                            className="mt-1 h-10 rounded-lg text-sm"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-2">ตั้งเป้าหมายเพื่อ track performance · ระบบจะแจ้งเตือนถ้าต่ำกว่าเป้า</p>
                    </div>

                    {/* Summary */}
                    <div className="rounded-xl p-4" style={{ backgroundColor: KK.greenLight, border: `1px solid ${KK.green}40` }}>
                      <p className="text-sm font-semibold flex items-center gap-2 mb-2" style={{ color: KK.green }}>
                         สรุปก่อน Submit
                      </p>
                      <ul className="text-xs text-gray-700 space-y-1">
                        <li> Audience: <span className="font-semibold">{totalReach.toLocaleString()} คน</span> ({selectedSegments.length} segments)</li>
                        {selectedProperties.length > 0 && <li> Properties: <span className="font-semibold">{selectedProperties.length} โครงการ</span></li>}
                        <li> Type: <span className="font-semibold">{CAMPAIGN_TYPES.find(t => t.value === campaignType)?.label}</span></li>
                        <li>ส่ง: <span className="font-semibold">
                          {scheduleType === "now" ? "ทันทีหลัง approve" :
                           scheduleType === "schedule" ? `${scheduleDate} ${scheduleTime}` :
                           recurringPattern}
                        </span></li>
                        {approverId && <li> Approver: <span className="font-semibold">{approvers.find(a => a.id === approverId)?.full_name || approvers.find(a => a.id === approverId)?.email}</span></li>}
                      </ul>
                    </div>
                  </>
                )}

                {/* Validation message */}
                {!currentValidation.valid && (
                  <div className="rounded-lg p-3 flex items-start gap-2" style={{ backgroundColor: KK.redLight, border: `1px solid ${KK.redBorder}` }}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: KK.red }} />
                    <p className="text-xs font-medium" style={{ color: KK.red }}>
                      {currentValidation.reason}
                    </p>
                  </div>
                )}

                {/* Step navigation */}
                <div className="flex justify-between pt-5 border-t border-gray-100">
                  <Button onClick={goBack} disabled={activeStep === 1} variant="outline" className="rounded-xl h-11 px-5 border-gray-200">
                    ← ย้อนกลับ
                  </Button>
                  {activeStep < 3 ? (
                    <Button
                      onClick={goNext}
                      disabled={!currentValidation.valid}
                      style={{
                        backgroundColor: currentValidation.valid ? KK.red : KK.gray,
                        color: "#fff",
                        border: "none",
                        opacity: currentValidation.valid ? 1 : 0.5,
                        cursor: currentValidation.valid ? 'pointer' : 'not-allowed',
                      }}
                      className="rounded-xl h-11 px-5"
                    >
                      ถัดไป <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      disabled={!currentValidation.valid || !approverId}
                      style={{
                        backgroundColor: (currentValidation.valid && approverId) ? KK.green : KK.gray,
                        color: "#fff",
                        border: "none",
                        opacity: (currentValidation.valid && approverId) ? 1 : 0.5,
                        cursor: (currentValidation.valid && approverId) ? 'pointer' : 'not-allowed',
                      }}
                      className="rounded-xl h-11 px-5"
                    >
                      <Send className="w-4 h-4 mr-1.5" /> Submit for Approval
                    </Button>
                  )}
                </div>
              </div>

              {/* LINE Preview */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 h-fit sticky top-6">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Square className="w-4 h-4" style={{ color: KK.green }} />
                    <h2 className="text-base font-bold text-gray-900">LINE Preview</h2>
                  </div>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                    {selectedTemplate}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-5">ภาพจำลองเมื่อส่งผ่าน LINE OA · เปลี่ยน Template เพื่อเปรียบเทียบ</p>

                {/* LINE chat mockup */}
                <div className="rounded-xl p-4" style={{ backgroundColor: "#3a4858" }}>
                  {/* OA Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: KK.green }}>
                      C
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold leading-tight">CHATEAU</p>
                      <p className="text-white/60 text-[11px]">Official Account</p>
                    </div>
                  </div>
                  {/* Flex card — render different layout per template */}
                  {(() => {
                    const hasImage = imageUrl && /^https?:\/\//.test(imageUrl);
                    const heroBg = hasImage ? null : (
                      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #ff6b8a 0%, #e60023 100%)" }} />
                    );
                    const heroImg = hasImage ? (
                      <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                    ) : null;

                    // === CAROUSEL: 2 mini cards side by side, scroll horizontal ===
                    if (selectedTemplate === 'carousel') {
                      return (
                        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollSnapType: 'x mandatory' }}>
                          {[1, 2].map((n) => (
                            <div key={n} className="bg-white rounded-2xl overflow-hidden flex-shrink-0" style={{ width: '70%', scrollSnapAlign: 'start' }}>
                              <div className="h-20 bg-gray-100 relative overflow-hidden">
                                {heroImg ? <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, #ff6b8a 0%, #e60023 100%)" }} />}
                              </div>
                              <div className="p-2.5">
                                <p className="text-xs font-bold text-gray-900 leading-tight line-clamp-1">{headline} #{n}</p>
                                <p className="text-[10px] text-gray-500 mt-1 line-clamp-1">{body}</p>
                                <button className="w-full mt-2 py-1.5 rounded-md text-[10px] font-semibold text-white" style={{ backgroundColor: KK.red }}>
                                  {ctaText}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    }

                    // === IMAGE: just big image, no text/buttons ===
                    if (selectedTemplate === 'image') {
                      return (
                        <div className="bg-white rounded-2xl overflow-hidden">
                          <div className="aspect-[4/5] bg-gray-100 relative overflow-hidden">
                            {heroImg}
                            {heroBg}
                            {!hasImage && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <ImageIcon className="w-12 h-12 text-white/50" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    // === BUTTONS: text + multiple stacked buttons (no image) ===
                    if (selectedTemplate === 'buttons') {
                      return (
                        <div className="bg-white rounded-2xl overflow-hidden p-3.5">
                          <p className="text-sm font-bold text-gray-900 leading-snug">{headline}</p>
                          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-3">{body}</p>
                          <div className="space-y-1.5 mt-3">
                            <button className="w-full py-2 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: KK.red }}>
                              {ctaText} →
                            </button>
                            <button className="w-full py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700">
                              นัดดูบ้าน
                            </button>
                            <button className="w-full py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700">
                              คุยกับ Sales
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // === BUBBLE (default): image + text + 1 button ===
                    return (
                      <div className="bg-white rounded-2xl overflow-hidden">
                        <div className="h-28 bg-gray-100 relative overflow-hidden">
                          {heroImg}
                          {heroBg}
                        </div>
                        <div className="p-3.5">
                          <p className="text-sm font-bold text-gray-900 leading-snug">{headline}</p>
                          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed line-clamp-2">{body}</p>
                          <button className="w-full mt-3 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1" style={{ backgroundColor: KK.red }}>
                            {ctaText} →
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  <p className="text-white/50 text-[10px] text-right mt-1.5">อ่านแล้ว</p>
                </div>

                {/* Forecast */}
                <div className="rounded-xl p-3 mt-4 border border-gray-200 bg-gray-50">
                  <p className="text-xs font-semibold flex items-center gap-1.5 text-gray-700">
                    <Sparkles className="w-3.5 h-3.5" style={{ color: KK.red }} /> คาดการณ์ผล <span className="text-[10px] font-normal text-gray-400">(ตัวอย่าง)</span>
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">
                    Open Rate <span className="font-semibold text-gray-900">~85%</span> · Click <span className="font-semibold text-gray-900">~58%</span> · Revenue est. <span className="font-semibold" style={{ color: KK.red }}>฿148,000</span>
                  </p>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default CampaignBuilderWizard;
