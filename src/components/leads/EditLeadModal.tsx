import { useState, useEffect, useRef } from "react";
import { X, Save, User, UserCircle, Briefcase, MapPin, Megaphone, Target, ShieldCheck, FileText, Building2, CalendarDays, UserCog, CheckCircle, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import LeadInterestsList from "./LeadInterestsList";

// Types
interface Province {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
}

interface District {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
  province_id: number;
}

interface SubDistrict {
  id: number;
  code: string;
  name_th: string;
  name_en: string;
  district_id: number;
  province_id: number;
}

interface Property {
  id: string;
  name: string;
  type: string;
}

interface Unit {
  id: string;
  unit_number: string;
  project_id: string;
  status: string;
}

interface SalesPerson {
  id: string;
  full_name: string;
  email: string;
}

interface Lead {
  id: string;
  tenant_id: string;
  customer_id: string;
  property_id: string;
  unit_id?: string;
  status: string;
  source: string;
  assigned_to?: string;
  notes: string;
  next_follow_up?: string;
  created_at: string;
}

interface EditLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadUpdated: () => void;
  lead: Lead | null;
}

// Options
const GENDER_OPTIONS = [
  { value: "", label: "โปรดเลือกเพศ" },
  { value: "male", label: "ชาย" },
  { value: "female", label: "หญิง" },
  { value: "other", label: "อื่นๆ" },
];

const OCCUPATION_OPTIONS = [
  { value: "", label: "โปรดเลือกอาชีพ" },
  { value: "business_owner", label: "ธุรกิจส่วนตัว" },
  { value: "government", label: "รับราชการ / พนักงานของรัฐ / พนักงานหน่วยงานราชการ" },
  { value: "state_enterprise", label: "พนักงานรัฐวิสาหกิจ" },
  { value: "private_company", label: "พนักงานบริษัทเอกชน" },
  { value: "farmer", label: "เกษตรกร" },
  { value: "employee", label: "รับจ้าง" },
  { value: "other", label: "อื่นๆ" },
];

const OCCUPATION_TO_EMPLOYMENT_TYPE: Record<string, string> = {
  business_owner:   "business",
  government:       "government",
  state_enterprise: "government",
  private_company:  "private",
  farmer:           "freelance",
  employee:         "freelance",
  other:            "freelance",
};

const MARITAL_STATUS_OPTIONS = [
  { value: "", label: "โปรดเลือกสถานภาพ" },
  { value: "single", label: "โสด" },
  { value: "married", label: "สมรส" },
  { value: "widowed", label: "หม้าย" },
  { value: "divorced", label: "หย่า" },
  { value: "separated", label: "แยกกันอยู่" },
];

const EDUCATION_OPTIONS = [
  { value: "", label: "โปรดเลือกการศึกษา" },
  { value: "primary", label: "ระดับประถมศึกษา" },
  { value: "junior_high", label: "ระดับมัธยมศึกษาตอนต้น" },
  { value: "senior_high", label: "ระดับมัธยมศึกษาตอนปลาย / ปวช." },
  { value: "diploma", label: "ระดับ ปวส. / อนุปริญญา" },
  { value: "bachelor", label: "ระดับปริญญาตรี" },
  { value: "master", label: "ระดับปริญญาโท" },
  { value: "doctorate", label: "ระดับปริญญาเอก" },
  { value: "other", label: "อื่นๆ" },
];

const NEWS_SOURCE_MAIN = [
  { value: "online", label: "จากสื่อออนไลน์" },
  { value: "offline", label: "จากสื่อออฟไลน์" },
  { value: "other", label: "อื่นๆ" },
];

const NEWS_SOURCE_ONLINE = [
  { value: "google", label: "Google" },
  { value: "youtube", label: "Youtube" },
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "tiktok", label: "Tiktok" },
  { value: "line", label: "Line" },
  { value: "twitter", label: "Twitter" },
  { value: "website", label: "Website" },
  { value: "other", label: "อื่นๆ" },
];

// Canonical 5-category set — shared with Customer Profile + Lead CDP
const PURCHASE_PURPOSE_OPTIONS = [
  { value: "residence",  label: "อยู่อาศัยเอง" },
  { value: "investment", label: "ลงทุน (เช่า / ขายต่อ)" },
  { value: "vacation",   label: "บ้านที่สอง / พักผ่อน" },
  { value: "family",     label: "ครอบครัว (พ่อแม่ / บุตรหลาน)" },
  { value: "other",      label: "อื่นๆ / ยังไม่ตัดสินใจ" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "ใหม่", color: "bg-blue-100 text-blue-700" },
  { value: "contacted", label: "ติดต่อแล้ว", color: "bg-cyan-100 text-cyan-700" },
  { value: "qualified", label: "มีคุณสมบัติ", color: "bg-green-100 text-green-700" },
  { value: "negotiating", label: "กำลังเจรจา", color: "bg-orange-100 text-orange-700" },
  { value: "won", label: "ปิดการขายสำเร็จ", color: "bg-emerald-100 text-emerald-700" },
  { value: "lost", label: "สูญเสีย", color: "bg-red-100 text-red-700" },
];

const EditLeadModal = ({ isOpen, onClose, onLeadUpdated, lead }: EditLeadModalProps) => {
  const { currentTenant } = useSimpleAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  // Reference data
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);

  // Form state
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  const [formData, setFormData] = useState({
    // Lead data
    property_id: "",
    unit_id: "",
    assigned_to: "",
    status: "new",
    next_follow_up: "",
    purchase_timeline: "",
    lead_notes: "",
    // Customer data
    imagePreview: "",
    first_name: "",
    last_name: "",
    gender: "",
    age: "",
    phone: "",
    email: "",
    occupation: "",
    marital_status: "",
    monthly_income: "",
    monthly_debt: "",
    down_payment_ready: "",     // เงินดาวน์พร้อม — Sales ถามตั้งแต่นัดดู
    employment_type: "",        // ประเภทงาน — ส่งผลต่อการอนุมัติสินเชื่อ
    years_employed: "",         // อายุงาน
    max_loan_amount_manual: "", // วงเงินจากธนาคาร (manual override — only when loan_is_manual=true)
    max_loan_amount_auto: 0,    // วงเงินที่ระบบคำนวณ — แสดงเป็น placeholder เพื่อให้ Sales รู้
    loan_is_manual_initial: false, // สถานะเดิมตอนเปิด form — ใช้ตัดสินใจ UI badge
    decision_maker: false,      // ผู้มีอำนาจตัดสินใจ — feeds fit score
    financing_approved: false,  // ได้รับอนุมัติสินเชื่อแล้ว — feeds fit score
    family_members: "",
    education: "",
    workplace: "",
    province_id: "",
    district_id: "",
    sub_district_id: "",
    postal_code: "",
    news_source_main: "",
    news_source_online: "",
    news_source_other: "",
    purchase_purpose: "",
    purchase_purpose_other: "",
    consent: "",
    signature: "",
  });

  // Load data when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      loadLeadData();
      fetchProvinces();
      fetchProperties();
      fetchSalesPeople();
    }
  }, [isOpen, lead]);

  // Fetch units when property changes
  useEffect(() => {
    if (formData.property_id) {
      fetchUnits(formData.property_id);
    }
  }, [formData.property_id]);

  // Fetch districts when province changes
  useEffect(() => {
    if (formData.province_id) {
      fetchDistricts(parseInt(formData.province_id));
    }
  }, [formData.province_id]);

  // Fetch sub-districts when district changes
  useEffect(() => {
    if (formData.district_id) {
      fetchSubDistricts(parseInt(formData.district_id));
    }
  }, [formData.district_id]);

  // Auto-fill postal code when sub-district changes
  useEffect(() => {
    if (formData.sub_district_id) {
      fetchPostalCode(parseInt(formData.sub_district_id));
    }
  }, [formData.sub_district_id]);

  const loadLeadData = async () => {
    if (!lead) return;
    setDataLoading(true);

    try {
      // Fetch customer data
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .select('*')
        .eq('id', lead.customer_id)
        .single();

      if (customerError) throw customerError;

      const prefs = customer?.preferences || {};

      // Parse news source
      let newsSourceMain = "";
      let newsSourceOnline = "";
      let newsSourceOther = "";
      const source = prefs.news_source || lead.source || "";
      if (source.startsWith("online_")) {
        newsSourceMain = "online";
        const rest = source.replace("online_", "");
        if (rest.includes("_other:")) {
          const parts = rest.split("_other:");
          newsSourceOnline = parts[0];
          newsSourceOther = parts[1]?.trim() || "";
        } else {
          newsSourceOnline = rest;
        }
      } else if (source === "offline" || source.startsWith("offline")) {
        newsSourceMain = "offline";
      } else if (source) {
        newsSourceMain = "other";
        // Strip "other:" and any accumulated "other_other:" prefixes from legacy
        // corrupted data — guard so the form shows just the actual free text.
        newsSourceOther = source
          .replace(/^(?:other_)+other:\s*/i, '')
          .replace(/^other:\s*/i, '')
          .trim();
      }

      // Parse purchase purpose
      let purchasePurpose = prefs.purchase_purpose || "";
      let purchasePurposeOther = "";
      if (purchasePurpose.startsWith("other:")) {
        purchasePurposeOther = purchasePurpose.replace("other:", "").trim();
        purchasePurpose = "other";
      }

      // Set form data
      setFormData({
        property_id: lead.property_id || "",
        unit_id: lead.unit_id || "",
        assigned_to: lead.assigned_to || "",
        status: lead.status || "new",
        next_follow_up: lead.next_follow_up || "",
        purchase_timeline: (lead as any).purchase_timeline || "",
        lead_notes: lead.notes || "",
        imagePreview: prefs.profile_image || "",
        // Fallback split — 220/236 leads in the demo dataset have customer.full_name
        // set but customers.preferences.first_name empty. Without this split, opening
        // Edit shows blank name fields even though the Lead has a clear name in the list.
        // Thai names typically split on the first space: "เบญจมาศ ทองคำ" → first/last.
        first_name: prefs.first_name || (customer?.full_name ? customer.full_name.split(' ')[0] : "") || "",
        last_name: prefs.last_name || (customer?.full_name ? customer.full_name.split(' ').slice(1).join(' ') : "") || "",
        // Fallback to leads.* — most leads in DB have demographic data on the
        // leads row directly, with empty customers.preferences. Without this
        // fallback, opening Edit shows blank dropdowns even though Lead Detail
        // shows the values correctly.
        gender: prefs.gender || (lead as any).gender || "",
        // Fallback to lead.age (and customers.age column) — AddLeadModal writes age
        // to leads.age + customers.age but NOT customers.preferences.age, so reading
        // only from prefs would show an empty input for newly created leads.
        age: prefs.age?.toString() || (lead as any).age?.toString() || (customer as any)?.age?.toString() || "",
        phone: customer?.phone || "",
        email: customer?.email || "",
        occupation: prefs.occupation || "",
        marital_status: prefs.marital_status || (lead as any).marital_status || "",
        monthly_income: prefs.monthly_income?.toString() || (lead as any).monthly_income?.toString() || "",
        monthly_debt: prefs.monthly_debt?.toString() || (lead as any).monthly_debt?.toString() || "",
        down_payment_ready: (lead as any).down_payment_ready?.toString() || "",
        employment_type: (lead as any).employment_type || "",
        years_employed: (lead as any).years_employed?.toString() || "",
        // Only prefill the input with the manual value when Sales actually entered
        // it from a Pre-approval Letter. Otherwise show empty + use auto value as
        // the placeholder so the field clearly says "ระบบคำนวณให้" without making
        // the user think they entered that number themselves.
        max_loan_amount_manual: (lead as any).loan_is_manual ? ((lead as any).max_loan_amount?.toString() || "") : "",
        max_loan_amount_auto: !(lead as any).loan_is_manual ? Number((lead as any).max_loan_amount || 0) : 0,
        loan_is_manual_initial: !!(lead as any).loan_is_manual,
        decision_maker: !!(lead as any).decision_maker,
        financing_approved: !!(lead as any).financing_approved,
        family_members: prefs.family_members?.toString() || (lead as any).household_size?.toString() || "",
        education: prefs.education || (lead as any).education || "",
        workplace: prefs.workplace || (lead as any).workplace || "",
        province_id: prefs.province_id?.toString() || "",
        district_id: prefs.district_id?.toString() || "",
        sub_district_id: prefs.sub_district_id?.toString() || "",
        postal_code: prefs.address?.postal_code || "",
        news_source_main: newsSourceMain,
        news_source_online: newsSourceOnline,
        news_source_other: newsSourceOther,
        purchase_purpose: purchasePurpose,
        purchase_purpose_other: purchasePurposeOther,
        consent: prefs.consent_given ? "consent" : "no_consent",
        signature: prefs.signature || "",
      });

      // Load districts and sub-districts if province/district are set
      if (prefs.province_id) {
        await fetchDistricts(prefs.province_id);
      }
      if (prefs.district_id) {
        await fetchSubDistricts(prefs.district_id);
      }

    } catch (err) {
      console.error('Error loading lead data:', err);
      setError('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setDataLoading(false);
    }
  };

  const fetchProvinces = async () => {
    const { data } = await supabase
      .from('th_provinces')
      .select('id, code, name_th, name_en')
      .order('name_th');
    setProvinces(data || []);
  };

  const fetchDistricts = async (provinceId: number) => {
    const { data } = await supabase
      .from('th_districts')
      .select('id, code, name_th, name_en, province_id')
      .eq('province_id', provinceId)
      .order('name_th');
    setDistricts(data || []);
  };

  const fetchSubDistricts = async (districtId: number) => {
    const { data } = await supabase
      .from('th_sub_districts')
      .select('id, code, name_th, name_en, district_id, province_id')
      .eq('district_id', districtId)
      .order('name_th');
    setSubDistricts(data || []);
  };

  const fetchPostalCode = async (subDistrictId: number) => {
    try {
      // First get the sub_district code from th_sub_districts
      const { data: subDistrict } = await supabase
        .from('th_sub_districts')
        .select('code')
        .eq('id', subDistrictId)
        .single();

      if (subDistrict?.code) {
        // Then get the zipcode using the sub_district_code
        const { data: zipcodeData } = await supabase
          .from('th_zipcodes')
          .select('zipcode')
          .eq('sub_district_code', subDistrict.code)
          .single();

        if (zipcodeData?.zipcode) {
          setFormData(prev => ({ ...prev, postal_code: zipcodeData.zipcode }));
        }
      }
    } catch {
      // Silently ignore errors - postal code will remain empty if lookup fails
    }
  };

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('id, name, type')
      .eq('tenant_id', currentTenant?.id)
      .order('name');
    setProperties(data || []);
  };

  const fetchUnits = async (propertyId: string) => {
    const { data } = await supabase
      .from('units')
      .select('id, unit_number, project_id, status')
      .eq('project_id', propertyId)
      .order('unit_number');
    setUnits(data || []);
  };

  const fetchSalesPeople = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .eq('tenant_id', currentTenant?.id)
      .in('role', ['admin', 'sales', 'owner'])
      .order('full_name');
    setSalesPeople(data || []);
  };

  // Signature pad functions with proper scaling
  const getCanvasCoordinates = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';

    // Draw existing signature if any
    if (formData.signature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
      img.src = formData.signature;
    }
  };

  useEffect(() => {
    if (isOpen && policyAccepted) {
      setTimeout(initCanvas, 100);
    }
  }, [isOpen, policyAccepted, formData.signature]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const { x, y } = getCanvasCoordinates(canvas, e);
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(canvas, e);

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setFormData(prev => ({ ...prev, signature: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    setLoading(true);
    setError("");

    try {
      // Get location names
      const province = provinces.find(p => p.id === parseInt(formData.province_id));
      const district = districts.find(d => d.id === parseInt(formData.district_id));
      const subDistrict = subDistricts.find(sd => sd.id === parseInt(formData.sub_district_id));

      // Prepare news source data — encoded as a string in DB.
      //   main='online'  → "online_<channel>" (channel=facebook/line/google/etc.)
      //                     "online_<channel>_other: <free text>" if also a custom note
      //   main='offline' → "offline"
      //   main='other'   → "other: <free text>"   ← NOT "other_other: ..." (legacy bug)
      // The previous code blindly appended "_other:" even when main was already
      // "other", producing "other_other: facebook". On next load that whole string
      // got stuffed back into newsSourceOther, so the next save produced
      // "other_other: other_other: facebook", and it accumulated every time Sales
      // touched the form.
      let newsSource = formData.news_source_main;
      if (formData.news_source_main === "online" && formData.news_source_online) {
        newsSource = `online_${formData.news_source_online}`;
      }
      if (formData.news_source_other) {
        // Strip any accumulated "other_other: " / "other: " prefixes from corrupted older data
        const cleanOther = formData.news_source_other
          .replace(/^(?:other_)+other:\s*/i, '')
          .replace(/^other:\s*/i, '')
          .trim();
        // If the user typed a known platform in the "other" text box, promote to
        // its canonical online_* value instead of wrapping as "other: facebook".
        const PROMOTE_TO_ONLINE = new Set(['facebook', 'instagram', 'google', 'line', 'tiktok', 'youtube']);
        const lower = cleanOther.toLowerCase();
        if (PROMOTE_TO_ONLINE.has(lower)) {
          newsSource = `online_${lower}`;
        } else if (formData.news_source_main === "other") {
          newsSource = `other: ${cleanOther}`;
        } else {
          newsSource = `${newsSource}_other: ${cleanOther}`;
        }
      }

      // Prepare purchase purpose data
      let purchasePurpose = formData.purchase_purpose;
      if (formData.purchase_purpose === "other" && formData.purchase_purpose_other) {
        purchasePurpose = `other: ${formData.purchase_purpose_other}`;
      }

      // Get signature from canvas
      let signatureData = formData.signature;
      if (formData.consent === "consent" && canvasRef.current) {
        signatureData = canvasRef.current.toDataURL('image/png');
      }

      // Update customer data
      const customerUpdate = {
        full_name: `${formData.first_name} ${formData.last_name}`,
        email: formData.email || null,
        phone: formData.phone,
        preferences: {
          first_name: formData.first_name,
          last_name: formData.last_name,
          gender: formData.gender || null,
          age: formData.age ? parseInt(formData.age) : null,
          profile_image: formData.imagePreview || null,
          occupation: formData.occupation || null,
          marital_status: formData.marital_status || null,
          monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
          monthly_debt: formData.monthly_debt ? parseFloat(formData.monthly_debt) : null,
          family_members: formData.family_members ? parseInt(formData.family_members) : null,
          education: formData.education || null,
          workplace: formData.workplace,
          address: {
            province: province?.name_th || '',
            district: district?.name_th || '',
            sub_district: subDistrict?.name_th || '',
            postal_code: formData.postal_code,
          },
          province_id: formData.province_id ? parseInt(formData.province_id) : null,
          district_id: formData.district_id ? parseInt(formData.district_id) : null,
          sub_district_id: formData.sub_district_id ? parseInt(formData.sub_district_id) : null,
          news_source: newsSource,
          purchase_purpose: purchasePurpose,
          consent_given: formData.consent === "consent",
          signature: signatureData || null,
          consent_date: formData.consent === "consent" ? new Date().toISOString() : null,
        },
      };

      const { error: customerError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', lead.customer_id);

      if (customerError) throw customerError;

      // Update lead data — financial fields are stored on leads (not customers.preferences)
      // so that PotentialScore/loan calculations and recomputeLeadScore see the latest values.
      const manualLoan = formData.max_loan_amount_manual ? parseFloat(formData.max_loan_amount_manual) : null;
      const leadUpdate: Record<string, any> = {
        property_id: formData.property_id,
        unit_id: formData.unit_id || null,
        status: formData.status,
        source: newsSource,
        assigned_to: formData.assigned_to || null,
        notes: formData.lead_notes,
        next_follow_up: formData.next_follow_up || null,
        purchase_timeline: formData.purchase_timeline || null,
        // Age must be mirrored to leads.age too — the loan estimator + scoring read
        // from there, NOT customer.preferences. The old bug let prefs.age and lead.age
        // drift apart (Sales updated prefs but loan calc kept using stale lead.age).
        age: formData.age ? parseInt(formData.age, 10) : null,
        // Financial data — mirrored so the scoring + loan engine can read from leads.*
        monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
        monthly_debt: formData.monthly_debt ? parseFloat(formData.monthly_debt) : null,
        down_payment_ready: formData.down_payment_ready ? parseFloat(formData.down_payment_ready) : null,
        employment_type: OCCUPATION_TO_EMPLOYMENT_TYPE[formData.occupation] || formData.employment_type || null,
        years_employed: formData.years_employed ? parseFloat(formData.years_employed) : null,
        decision_maker: formData.decision_maker,
        // financing_approved is derived from the Pre-approval field below — Sales no longer
        // ticks a separate checkbox (one source of truth: if they entered the bank amount,
        // it means there's a real Letter, so financing IS approved).
      };
      // Manual override for bank pre-approval — when Sales has the actual approval letter,
      // they enter that exact figure here and it takes priority over the computed estimate.
      // Set loan_is_manual=true so recompute won't overwrite (replaces fragile timestamp logic).
      const hasPreApproval = manualLoan != null && !isNaN(manualLoan) && manualLoan > 0;
      if (hasPreApproval) {
        leadUpdate.max_loan_amount = manualLoan;
        leadUpdate.loan_is_manual = true;
        leadUpdate.loan_last_updated = new Date().toISOString();
        leadUpdate.financing_approved = true;
      } else {
        // Sales cleared the field — revert to system estimate mode + clear approval flag.
        leadUpdate.loan_is_manual = false;
        leadUpdate.financing_approved = false;
      }

      const { error: leadError } = await supabase
        .from('leads')
        .update(leadUpdate)
        .eq('id', lead.id);

      if (leadError) throw leadError;

      // Recompute potential_score + max_loan_amount from the new data — fire-and-forget,
      // never blocks the save flow.
      try {
        const { recomputeLeadScore } = await import('@/lib/recomputeLeadScore');
        await recomputeLeadScore(lead.id);
      } catch { /* non-fatal */ }

      onLeadUpdated();
      onClose();
    } catch (err: any) {
      console.error('Error updating lead:', err);
      setError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleConsentChange = (value: string) => {
    if (value === "consent") {
      setShowPolicyDialog(true);
    } else {
      setFormData(prev => ({ ...prev, consent: value, signature: "" }));
    }
  };

  const handleAcceptPolicy = () => {
    setPolicyAccepted(true);
    setShowPolicyDialog(false);
    setFormData(prev => ({ ...prev, consent: "consent" }));
  };

  if (!lead) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden p-0 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl shadow-md">
                <UserCog className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">แก้ไขข้อมูล Lead</h2>
                <p className="text-xs text-gray-500">อัปเดตข้อมูลลูกค้าและรายละเอียด Lead</p>
              </div>
            </div>
          </div>

          {dataLoading ? (
            <div className="flex items-center justify-center py-12 flex-1">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Form Content - Scrollable */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-5">

                  {/* Section 1: Lead Status & Project Info - Cyan */}
                  <Card className="border-2 border-cyan-100 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 border-b border-cyan-100">
                        <div className="p-1.5 bg-cyan-500 rounded-lg">
                          <Building2 className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-cyan-900 text-sm">ข้อมูลโครงการและสถานะ</h3>
                          <p className="text-xs text-cyan-600">สถานะ Lead โครงการ และพนักงานขายที่รับผิดชอบ</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-medium">สถานะ Lead <span className="text-red-500">*</span></Label>
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกสถานะ" />
                              </SelectTrigger>
                              <SelectContent>
                                {STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    <span className={`px-2 py-0.5 rounded text-xs ${option.color}`}>
                                      {option.label}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">โครงการที่สนใจ <span className="text-red-500">*</span></Label>
                            <Select
                              value={formData.property_id}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value, unit_id: "" }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกโครงการ" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {properties.map((property) => (
                                  <SelectItem key={property.id} value={property.id}>
                                    {property.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">พนักงานขายผู้รับผิดชอบ</Label>
                            <Select
                              value={formData.assigned_to}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกพนักงานขาย" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {salesPeople.map((person) => (
                                  <SelectItem key={person.id} value={person.id}>
                                    {person.full_name || person.email}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-cyan-500" />
                              นัดติดตามครั้งต่อไป
                            </Label>
                            <Input
                              type="date"
                              value={formData.next_follow_up}
                              onChange={(e) => setFormData(prev => ({ ...prev, next_follow_up: e.target.value }))}
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>

                          <div>
                            <Label className="text-sm font-medium flex items-center gap-2">
                              <CalendarDays className="w-4 h-4 text-blue-500" />
                              กรอบเวลาการซื้อ
                            </Label>
                            <Select
                              value={formData.purchase_timeline}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, purchase_timeline: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="ลูกค้าวางแผนซื้อเมื่อไร" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="immediate">ทันที</SelectItem>
                                <SelectItem value="1_month">ภายใน 1 เดือน</SelectItem>
                                <SelectItem value="3_months">ภายใน 3 เดือน</SelectItem>
                                <SelectItem value="6_months">ภายใน 6 เดือน</SelectItem>
                                <SelectItem value="1_year">ภายใน 1 ปี</SelectItem>
                                <SelectItem value="no_timeline">ยังไม่มีกำหนด</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 2: Units of Interest */}
                  {lead && (
                    <Card className="border-2 border-chateau-50 shadow-sm">
                      <CardContent className="p-0">
                        <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-chateau-50 to-chateau-100/50 border-b border-chateau-50">
                          <div className="p-1.5 bg-chateau-500 rounded-lg">
                            <Building2 className="w-3.5 h-3.5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-chateau-800 text-sm">ยูนิตที่สนใจ</h3>
                            <p className="text-xs text-chateau">รายการยูนิตที่ลูกค้าสนใจ</p>
                          </div>
                        </div>
                        <div className="p-4">
                          <LeadInterestsList
                            leadId={lead.id}
                            onInterestsChange={() => {}}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Section 3: Personal Information - Blue */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <div className="p-1.5 bg-blue-500 rounded-lg">
                          <UserCircle className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">ข้อมูลส่วนตัว</h3>
                          <p className="text-xs text-gray-500">ชื่อ รูปภาพ และข้อมูลติดต่อ</p>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Profile Image */}
                        <div className="flex items-center gap-4">
                          {formData.imagePreview ? (
                            <img
                              src={formData.imagePreview}
                              alt="Profile"
                              className="w-20 h-20 object-cover rounded-full border-2 border-blue-200 shadow-sm"
                            />
                          ) : (
                            <div className="w-20 h-20 rounded-full border-2 border-dashed border-blue-300 flex items-center justify-center bg-blue-50">
                              <User className="w-8 h-8 text-blue-300" />
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            <p>รูปภาพปัจจุบัน</p>
                            <p className="text-gray-400">(ไม่สามารถเปลี่ยนได้จากหน้านี้)</p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label className="text-sm font-medium">ชื่อ <span className="text-red-500">*</span></Label>
                            <Input
                              value={formData.first_name}
                              onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                              placeholder="กรอกชื่อ"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">นามสกุล <span className="text-red-500">*</span></Label>
                            <Input
                              value={formData.last_name}
                              onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                              placeholder="กรอกนามสกุล"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">เพศ</Label>
                            <Select
                              value={formData.gender}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกเพศ" />
                              </SelectTrigger>
                              <SelectContent>
                                {GENDER_OPTIONS.filter(o => o.value).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">อายุ (ปี)</Label>
                            <Input
                              type="number"
                              value={formData.age}
                              onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                              placeholder="กรอกอายุ"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">เบอร์โทร <span className="text-red-500">*</span></Label>
                            <Input
                              value={formData.phone}
                              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                              placeholder="0812345678"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Email</Label>
                            <Input
                              type="email"
                              value={formData.email}
                              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                              placeholder="email@example.com"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 4: Financial Info - Green */}
                  <Card className="border-2 border-green-100 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-green-100/50 border-b border-green-100">
                        <div className="p-1.5 bg-green-500 rounded-lg">
                          <Briefcase className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-green-900 text-sm">ข้อมูลอาชีพและการเงิน</h3>
                          <p className="text-xs text-green-600">อาชีพ รายได้ และภาระทางการเงิน</p>
                        </div>
                      </div>
                      <div className="p-4 space-y-5">
                        {/* Group 1: Demographics — อาชีพ / สถานภาพ / การศึกษา / ครอบครัว */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-sm font-medium">อาชีพ</Label>
                            <Select
                              value={formData.occupation}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, occupation: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกอาชีพ" />
                              </SelectTrigger>
                              <SelectContent>
                                {OCCUPATION_OPTIONS.filter(o => o.value).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">สถานภาพ</Label>
                            <Select
                              value={formData.marital_status}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกสถานภาพ" />
                              </SelectTrigger>
                              <SelectContent>
                                {MARITAL_STATUS_OPTIONS.filter(o => o.value).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">ระดับการศึกษา</Label>
                            <Select
                              value={formData.education}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, education: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกระดับการศึกษา" />
                              </SelectTrigger>
                              <SelectContent>
                                {EDUCATION_OPTIONS.filter(o => o.value).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">สมาชิกในครอบครัว (คน)</Label>
                            <Input
                              type="number"
                              value={formData.family_members}
                              onChange={(e) => setFormData(prev => ({ ...prev, family_members: e.target.value }))}
                              placeholder="0"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                        </div>

                        {/* Group 2: Income / Debt / Down payment / Job tenure — all numeric financial fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                          <div>
                            <Label className="text-sm font-medium">รายได้ต่อเดือน (บาท)</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formData.monthly_income ? Number(formData.monthly_income).toLocaleString('en-US') : ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, monthly_income: e.target.value.replace(/[^\d]/g, '') }))}
                              placeholder="0"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">ภาระหนี้ต่อเดือน (บาท)</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formData.monthly_debt ? Number(formData.monthly_debt).toLocaleString('en-US') : ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, monthly_debt: e.target.value.replace(/[^\d]/g, '') }))}
                              placeholder="0"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">เงินดาวน์ที่พร้อม (บาท)</Label>
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formData.down_payment_ready ? Number(formData.down_payment_ready).toLocaleString('en-US') : ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, down_payment_ready: e.target.value.replace(/[^\d]/g, '') }))}
                              placeholder="เช่น 1,500,000"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                          <div>
                            <Label className="text-sm font-medium">อายุงาน (ปี)</Label>
                            <Input
                              type="number"
                              value={formData.years_employed}
                              onChange={(e) => setFormData(prev => ({ ...prev, years_employed: e.target.value }))}
                              placeholder="เช่น 5"
                              disabled={loading}
                              className="mt-1.5"
                            />
                          </div>
                        </div>

                        {/* Group 3: Pre-approval — full-width since it's a "special" field with hint text.
                            UX: distinguish 3 states clearly so Sales never confuses a system-estimate for a real bank approval:
                              (a) Manual Pre-approval set (loan_is_manual=true)  → green "bank-approved" banner above input
                              (b) System auto-calculated value (loan_is_manual=false, has value) → orange "system estimate" hint with the number shown as placeholder
                              (c) No data yet (no income filled etc.)            → neutral placeholder */}
                        <div className="pt-4 border-t border-gray-100">
                          <Label className="text-sm font-medium flex items-center gap-1.5">
                            วงเงินกู้ที่ธนาคารอนุมัติ (บาท)
                            <span className="text-[10px] font-normal text-gray-400">— ระบุเมื่อมี Pre-approval Letter</span>
                          </Label>

                          {/* State indicator banner */}
                          {formData.max_loan_amount_manual ? (
                            <div className="mt-1.5 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
                              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              <span className="text-xs text-green-800">
                                <span className="font-semibold">Pre-approval จากธนาคาร</span> — ตัวเลขจริงที่ธนาคารอนุมัติให้
                              </span>
                            </div>
                          ) : formData.max_loan_amount_auto > 0 ? (
                            <div className="mt-1.5 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                              <Calculator className="w-4 h-4 text-amber-600 flex-shrink-0" />
                              <span className="text-xs text-amber-900">
                                <span className="font-semibold">ระบบประเมินให้</span> ~ ฿{formData.max_loan_amount_auto.toLocaleString('en-US')} — ใส่ตัวเลขจริงด้านล่างเพื่อแทนที่
                              </span>
                            </div>
                          ) : null}

                          {/* Constrain input width to match the 4-col grid above (รายได้/หนี้/ดาวน์/อายุงาน) */}
                          <div className="mt-1.5 max-w-xs">
                            <Input
                              type="text"
                              inputMode="numeric"
                              value={formData.max_loan_amount_manual ? Number(formData.max_loan_amount_manual).toLocaleString('en-US') : ''}
                              onChange={(e) => setFormData(prev => ({ ...prev, max_loan_amount_manual: e.target.value.replace(/[^\d]/g, '') }))}
                              placeholder={formData.max_loan_amount_auto > 0
                                ? `${formData.max_loan_amount_auto.toLocaleString('en-US')}`
                                : 'ปล่อยว่างให้ระบบคำนวณ'}
                              disabled={loading}
                            />
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">ถ้ามีจดหมาย Pre-approval จากธนาคาร ใส่ตัวเลขจริงจะแทนค่าที่ระบบคำนวณ</p>
                        </div>

                        {/* Group 4: Decision maker — visual checkbox card, full width */}
                        <div className="pt-4 border-t border-gray-100">
                          <label className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            formData.decision_maker ? 'border-chateau-200 bg-chateau-50/50' : 'border-gray-200 bg-white hover:bg-gray-50'
                          }`}>
                            <input
                              type="checkbox"
                              checked={formData.decision_maker}
                              onChange={(e) => setFormData(prev => ({ ...prev, decision_maker: e.target.checked }))}
                              disabled={loading}
                              className="mt-0.5 w-4 h-4 accent-chateau"
                            />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">เป็นผู้ตัดสินใจหลัก</p>
                              <p className="text-xs text-gray-500 mt-0.5">ลูกค้าสามารถตัดสินใจซื้อได้เอง (ไม่ใช่แทนผู้อื่น)</p>
                            </div>
                          </label>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 5: Work Address - Orange */}
                  <Card className="border-2 border-orange-100 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                        <div className="p-1.5 bg-orange-500 rounded-lg">
                          <MapPin className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-orange-900 text-sm">ที่อยู่ที่ทำงาน</h3>
                          <p className="text-xs text-orange-600">สถานที่ทำงานและที่อยู่ติดต่อ</p>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <Label className="text-sm font-medium">สถานที่ทำงาน <span className="text-red-500">*</span></Label>
                          <Input
                            value={formData.workplace}
                            onChange={(e) => setFormData(prev => ({ ...prev, workplace: e.target.value }))}
                            placeholder="ชื่อบริษัท / สถานที่ทำงาน"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">จังหวัด <span className="text-red-500">*</span></Label>
                            <Select
                              value={formData.province_id}
                              onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                province_id: value,
                                district_id: "",
                                sub_district_id: "",
                                postal_code: ""
                              }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder="เลือกจังหวัด" />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {provinces.map((province) => (
                                  <SelectItem key={province.id} value={province.id.toString()}>
                                    {province.name_th}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">อำเภอ <span className="text-red-500">*</span></Label>
                            <Select
                              value={formData.district_id}
                              onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                district_id: value,
                                sub_district_id: "",
                                postal_code: ""
                              }))}
                              disabled={loading || !formData.province_id}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder={formData.province_id ? "เลือกอำเภอ" : "เลือกจังหวัดก่อน"} />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {districts.map((district) => (
                                  <SelectItem key={district.id} value={district.id.toString()}>
                                    {district.name_th}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">ตำบล <span className="text-red-500">*</span></Label>
                            <Select
                              value={formData.sub_district_id}
                              onValueChange={(value) => setFormData(prev => ({ ...prev, sub_district_id: value }))}
                              disabled={loading || !formData.district_id}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder={formData.district_id ? "เลือกตำบล" : "เลือกอำเภอก่อน"} />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {subDistricts.map((subDistrict) => (
                                  <SelectItem key={subDistrict.id} value={subDistrict.id.toString()}>
                                    {subDistrict.name_th}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">รหัสไปรษณีย์</Label>
                            <Input
                              value={formData.postal_code}
                              readOnly
                              placeholder="จะแสดงอัตโนมัติ"
                              className="mt-1.5 bg-gray-50"
                              disabled={loading}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 6: News Source - Purple */}
                  <Card className="border border-gray-200 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <div className="p-1.5 bg-purple-500 rounded-lg">
                          <Megaphone className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">แหล่งข่าวสาร</h3>
                          <p className="text-xs text-gray-500">ท่านได้รับข่าวสารมาจากแหล่งใด</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          {NEWS_SOURCE_MAIN.map((source) => (
                            <div key={source.value} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id={`edit_news_source_${source.value}`}
                                name="edit_news_source_main"
                                value={source.value}
                                checked={formData.news_source_main === source.value}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  news_source_main: e.target.value,
                                  news_source_online: "",
                                  news_source_other: ""
                                }))}
                                className="w-4 h-4 text-purple-600"
                                disabled={loading}
                              />
                              <Label htmlFor={`edit_news_source_${source.value}`} className="font-normal cursor-pointer">
                                {source.label}
                              </Label>
                            </div>
                          ))}

                          {formData.news_source_main === "online" && (
                            <div className="ml-6 space-y-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                              <Label className="text-sm text-purple-700 font-medium">เลือกช่องทางออนไลน์:</Label>
                              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                {NEWS_SOURCE_ONLINE.map((source) => (
                                  <div key={source.value} className="flex items-center space-x-2">
                                    <input
                                      type="radio"
                                      id={`edit_news_source_online_${source.value}`}
                                      name="edit_news_source_online"
                                      value={source.value}
                                      checked={formData.news_source_online === source.value}
                                      onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        news_source_online: e.target.value,
                                        news_source_other: source.value === "other" ? prev.news_source_other : ""
                                      }))}
                                      className="w-4 h-4 text-purple-600"
                                      disabled={loading}
                                    />
                                    <Label htmlFor={`edit_news_source_online_${source.value}`} className="font-normal cursor-pointer text-sm">
                                      {source.label}
                                    </Label>
                                  </div>
                                ))}
                              </div>

                              {formData.news_source_online === "other" && (
                                <Textarea
                                  value={formData.news_source_other}
                                  onChange={(e) => setFormData(prev => ({ ...prev, news_source_other: e.target.value }))}
                                  placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                  className="mt-2"
                                  disabled={loading}
                                />
                              )}
                            </div>
                          )}

                          {formData.news_source_main === "other" && (
                            <div className="ml-6">
                              <Textarea
                                value={formData.news_source_other}
                                onChange={(e) => setFormData(prev => ({ ...prev, news_source_other: e.target.value }))}
                                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                disabled={loading}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 7: Purchase Purpose - Indigo */}
                  <Card className="border-2 border-chateau-50 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-chateau-50 to-chateau-100/50 border-b border-chateau-50">
                        <div className="p-1.5 bg-chateau-500 rounded-lg">
                          <Target className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-chateau-800 text-sm">จุดประสงค์การซื้อ</h3>
                          <p className="text-xs text-chateau">เหตุผลในการซื้ออสังหาริมทรัพย์</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          {PURCHASE_PURPOSE_OPTIONS.map((purpose) => (
                            <div key={purpose.value} className="flex items-center space-x-2">
                              <input
                                type="radio"
                                id={`edit_purchase_purpose_${purpose.value}`}
                                name="edit_purchase_purpose"
                                value={purpose.value}
                                checked={formData.purchase_purpose === purpose.value}
                                onChange={(e) => setFormData(prev => ({
                                  ...prev,
                                  purchase_purpose: e.target.value,
                                  purchase_purpose_other: ""
                                }))}
                                className="w-4 h-4 text-chateau"
                                disabled={loading}
                              />
                              <Label htmlFor={`edit_purchase_purpose_${purpose.value}`} className="font-normal cursor-pointer">
                                {purpose.label}
                              </Label>
                            </div>
                          ))}

                          {formData.purchase_purpose === "other" && (
                            <div className="ml-6">
                              <Textarea
                                value={formData.purchase_purpose_other}
                                onChange={(e) => setFormData(prev => ({ ...prev, purchase_purpose_other: e.target.value }))}
                                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                disabled={loading}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 8: Notes - Teal */}
                  <Card className="border-2 border-teal-100 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-teal-50 to-teal-100/50 border-b border-teal-100">
                        <div className="p-1.5 bg-teal-500 rounded-lg">
                          <FileText className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-teal-900 text-sm">บันทึกเพิ่มเติม</h3>
                          <p className="text-xs text-teal-600">หมายเหตุและรายละเอียดอื่นๆ</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <Textarea
                          value={formData.lead_notes}
                          onChange={(e) => setFormData(prev => ({ ...prev, lead_notes: e.target.value }))}
                          placeholder="บันทึกข้อมูลเพิ่มเติม..."
                          disabled={loading}
                          rows={3}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Section 9: Consent - Gray */}
                  <Card className="border-2 border-gray-200 shadow-sm">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                        <div className="p-1.5 bg-gray-600 rounded-lg">
                          <ShieldCheck className="w-3.5 h-3.5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 text-sm">การยินยอม PDPA</h3>
                          <p className="text-xs text-gray-600">ยินยอมให้สามารถนำข้อมูลไปใช้งานได้</p>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="space-y-3">
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="edit_consent"
                                value="consent"
                                checked={formData.consent === "consent"}
                                onChange={() => handleConsentChange("consent")}
                                disabled={loading}
                                className="w-4 h-4"
                              />
                              <span>ยินยอม</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="edit_consent"
                                value="no_consent"
                                checked={formData.consent === "no_consent"}
                                onChange={() => handleConsentChange("no_consent")}
                                disabled={loading}
                                className="w-4 h-4"
                              />
                              <span>ไม่ยินยอม</span>
                            </label>
                          </div>

                          {formData.consent === "consent" && (
                            <div className="ml-6 space-y-2 p-4 bg-gray-50/50 rounded-xl border border-gray-200">
                              <Label className="text-sm font-medium">ลงลายมือชื่อ</Label>
                              <div className="border-2 border-gray-200 rounded-lg bg-white">
                                <canvas
                                  ref={canvasRef}
                                  width={400}
                                  height={150}
                                  className="w-full touch-none cursor-crosshair"
                                  onMouseDown={startDrawing}
                                  onMouseMove={draw}
                                  onMouseUp={stopDrawing}
                                  onMouseLeave={stopDrawing}
                                  onTouchStart={startDrawing}
                                  onTouchMove={draw}
                                  onTouchEnd={stopDrawing}
                                />
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={clearSignature}
                                disabled={loading}
                              >
                                ล้างลายเซ็น
                              </Button>
                              {formData.signature && (
                                <p className="text-sm text-green-600">✓ มีลายเซ็นเดิมอยู่แล้ว (สามารถลงใหม่ได้)</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Error Message */}
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm text-red-600 font-medium">{error}</p>
                    </div>
                  )}
                </div>
              </form>

              {/* Footer - Fixed at bottom */}
              <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={loading}
                  className="flex-1"
                >
                  ยกเลิก
                </Button>
                <Button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="flex-1 bg-gradient-to-r from-[#e60023] to-[#8B5CF6] hover:opacity-90"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      กำลังบันทึก...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Save className="w-4 h-4 mr-2" />
                      บันทึกการแก้ไข
                    </div>
                  )}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Policy Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นโยบายการนำข้อมูลไปใช้งาน</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none">
            <p>
              บริษัทฯ มีความมุ่งมั่นที่จะปกป้องความเป็นส่วนตัวของท่าน โดยนโยบายความเป็นส่วนตัวฉบับนี้
              จะอธิบายถึงวิธีการที่บริษัทฯ เก็บรวบรวม ใช้ เปิดเผย และ/หรือ โอนข้อมูลส่วนบุคคลของท่าน
            </p>
            <h4>ข้อมูลที่เก็บรวบรวม</h4>
            <ul>
              <li>ข้อมูลส่วนตัว: ชื่อ นามสกุล เพศ อายุ</li>
              <li>ข้อมูลติดต่อ: เบอร์โทรศัพท์ อีเมล ที่อยู่</li>
              <li>ข้อมูลทางการเงิน: อาชีพ รายได้ ภาระหนี้</li>
              <li>ความสนใจในอสังหาริมทรัพย์</li>
            </ul>
            <h4>วัตถุประสงค์ในการใช้ข้อมูล</h4>
            <ul>
              <li>ติดต่อและนำเสนอข้อมูลโครงการ</li>
              <li>วิเคราะห์ความสามารถในการซื้อ</li>
              <li>ปรับปรุงการให้บริการ</li>
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>
              ปิด
            </Button>
            <Button onClick={handleAcceptPolicy} className="bg-gradient-to-r from-[#e60023] to-[#8B5CF6]">
              ยอมรับและดำเนินการต่อ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditLeadModal;
