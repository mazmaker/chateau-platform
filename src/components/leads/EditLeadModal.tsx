import { useState, useEffect, useRef } from "react";
import { X, Save, Upload, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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

const PURCHASE_PURPOSE_OPTIONS = [
  { value: "residence", label: "เพื่ออยู่อาศัย" },
  { value: "speculation", label: "เก็งกำไร" },
  { value: "monthly_rent", label: "ปล่อยเช่ารายเดือน" },
  { value: "daily_rent", label: "ปล่อยเช่ารายวัน" },
  { value: "flip", label: "ซ่อมแล้วขาย" },
  { value: "other", label: "อื่นๆ" },
];

const STATUS_OPTIONS = [
  { value: "new", label: "ใหม่" },
  { value: "contacted", label: "ติดต่อแล้ว" },
  { value: "qualified", label: "มีคุณสมบัติ" },
  { value: "proposal", label: "เสนอขาย" },
  { value: "negotiation", label: "เจรจา" },
  { value: "closed", label: "ปิดการขาย" },
  { value: "lost", label: "สูญเสีย" },
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
        newsSourceOther = source;
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
        lead_notes: lead.notes || "",
        imagePreview: prefs.profile_image || "",
        first_name: prefs.first_name || "",
        last_name: prefs.last_name || "",
        gender: prefs.gender || "",
        age: prefs.age?.toString() || "",
        phone: customer?.phone || "",
        email: customer?.email || "",
        occupation: prefs.occupation || "",
        marital_status: prefs.marital_status || "",
        monthly_income: prefs.monthly_income?.toString() || "",
        monthly_debt: prefs.monthly_debt?.toString() || "",
        family_members: prefs.family_members?.toString() || "",
        education: prefs.education || "",
        workplace: prefs.workplace || "",
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
    const { data } = await supabase
      .from('th_zipcodes')
      .select('zipcode')
      .eq('sub_district_id', subDistrictId)
      .single();
    if (data) {
      setFormData(prev => ({ ...prev, postal_code: data.zipcode }));
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

  // Signature pad functions
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
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const signatureData = canvas.toDataURL('image/png');
    setFormData(prev => ({ ...prev, signature: signatureData }));
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

      // Prepare news source data
      let newsSource = formData.news_source_main;
      if (formData.news_source_main === "online" && formData.news_source_online) {
        newsSource = `online_${formData.news_source_online}`;
      }
      if (formData.news_source_other) {
        newsSource = `${newsSource}_other: ${formData.news_source_other}`;
      }

      // Prepare purchase purpose data
      let purchasePurpose = formData.purchase_purpose;
      if (formData.purchase_purpose === "other" && formData.purchase_purpose_other) {
        purchasePurpose = `other: ${formData.purchase_purpose_other}`;
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
          signature: formData.signature || null,
          consent_date: formData.consent === "consent" ? new Date().toISOString() : null,
        },
      };

      const { error: customerError } = await supabase
        .from('customers')
        .update(customerUpdate)
        .eq('id', lead.customer_id);

      if (customerError) throw customerError;

      // Update lead data
      const leadUpdate = {
        property_id: formData.property_id,
        unit_id: formData.unit_id || null,
        status: formData.status,
        source: newsSource,
        assigned_to: formData.assigned_to || null,
        notes: formData.lead_notes,
        next_follow_up: formData.next_follow_up || null,
      };

      const { error: leadError } = await supabase
        .from('leads')
        .update(leadUpdate)
        .eq('id', lead.id);

      if (leadError) throw leadError;

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
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>แก้ไขข้อมูล Lead</DialogTitle>
            <DialogDescription>
              แก้ไขข้อมูลลูกค้าและรายละเอียด Lead
            </DialogDescription>
          </DialogHeader>

          {dataLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Section 1: Lead Status & Project Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">ข้อมูลโครงการและสถานะ</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>สถานะ Lead *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกสถานะ" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>โครงการที่สนใจ *</Label>
                    <Select
                      value={formData.property_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value, unit_id: "" }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label>ยูนิตที่สนใจ</Label>
                    <Select
                      value={formData.unit_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, unit_id: value }))}
                      disabled={loading || !formData.property_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.property_id ? "เลือกยูนิต" : "เลือกโครงการก่อน"} />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {units.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.unit_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>พนักงานขายผู้รับผิดชอบ</Label>
                    <Select
                      value={formData.assigned_to}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
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

                  <div className="space-y-2">
                    <Label>นัดติดตามครั้งต่อไป</Label>
                    <Input
                      type="date"
                      value={formData.next_follow_up}
                      onChange={(e) => setFormData(prev => ({ ...prev, next_follow_up: e.target.value }))}
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Personal Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">ข้อมูลส่วนตัว</h3>

                {/* Profile Image */}
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {formData.imagePreview ? (
                      <img src={formData.imagePreview} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-gray-400" />
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">รูปภาพปัจจุบัน (ไม่สามารถเปลี่ยนได้จากหน้านี้)</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>ชื่อ *</Label>
                    <Input
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      placeholder="กรอกชื่อ"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>นามสกุล *</Label>
                    <Input
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      placeholder="กรอกนามสกุล"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>เพศ</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกเพศ" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value || "none"}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>อายุ</Label>
                    <Input
                      type="number"
                      value={formData.age}
                      onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                      placeholder="กรอกอายุ"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>เบอร์โทร *</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="กรอกเบอร์โทร"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="กรอก Email"
                      disabled={loading}
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Financial Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">ข้อมูลทางการเงิน</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>อาชีพ</Label>
                    <Select
                      value={formData.occupation}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, occupation: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกอาชีพ" />
                      </SelectTrigger>
                      <SelectContent>
                        {OCCUPATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value || "none"}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>สถานภาพสมรส</Label>
                    <Select
                      value={formData.marital_status}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกสถานภาพ" />
                      </SelectTrigger>
                      <SelectContent>
                        {MARITAL_STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value || "none"}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>รายได้ต่อเดือน (บาท)</Label>
                    <Input
                      type="number"
                      value={formData.monthly_income}
                      onChange={(e) => setFormData(prev => ({ ...prev, monthly_income: e.target.value }))}
                      placeholder="กรอกรายได้"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ภาระหนี้ต่อเดือน (บาท)</Label>
                    <Input
                      type="number"
                      value={formData.monthly_debt}
                      onChange={(e) => setFormData(prev => ({ ...prev, monthly_debt: e.target.value }))}
                      placeholder="กรอกภาระหนี้"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>จำนวนสมาชิกในครอบครัว</Label>
                    <Input
                      type="number"
                      value={formData.family_members}
                      onChange={(e) => setFormData(prev => ({ ...prev, family_members: e.target.value }))}
                      placeholder="กรอกจำนวน"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>ระดับการศึกษา</Label>
                    <Select
                      value={formData.education}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, education: value }))}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกระดับการศึกษา" />
                      </SelectTrigger>
                      <SelectContent>
                        {EDUCATION_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value || "none"}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Section 4: Work Address */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">ที่อยู่ที่ทำงาน</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label>สถานที่ทำงาน *</Label>
                    <Input
                      value={formData.workplace}
                      onChange={(e) => setFormData(prev => ({ ...prev, workplace: e.target.value }))}
                      placeholder="กรอกชื่อบริษัท/สถานที่ทำงาน"
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>จังหวัด *</Label>
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
                      <SelectTrigger>
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
                  <div className="space-y-2">
                    <Label>อำเภอ/เขต *</Label>
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
                      <SelectTrigger>
                        <SelectValue placeholder={formData.province_id ? "เลือกอำเภอ/เขต" : "เลือกจังหวัดก่อน"} />
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
                  <div className="space-y-2">
                    <Label>ตำบล/แขวง *</Label>
                    <Select
                      value={formData.sub_district_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, sub_district_id: value }))}
                      disabled={loading || !formData.district_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={formData.district_id ? "เลือกตำบล/แขวง" : "เลือกอำเภอก่อน"} />
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
                  <div className="space-y-2">
                    <Label>รหัสไปรษณีย์</Label>
                    <Input
                      value={formData.postal_code}
                      onChange={(e) => setFormData(prev => ({ ...prev, postal_code: e.target.value }))}
                      placeholder="รหัสไปรษณีย์"
                      disabled={loading}
                      readOnly
                    />
                  </div>
                </div>
              </div>

              {/* Section 5: News Source */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">แหล่งข่าวสาร</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    {NEWS_SOURCE_MAIN.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="news_source_main"
                          value={option.value}
                          checked={formData.news_source_main === option.value}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            news_source_main: e.target.value,
                            news_source_online: "",
                            news_source_other: ""
                          }))}
                          disabled={loading}
                          className="w-4 h-4"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>

                  {formData.news_source_main === "online" && (
                    <div className="ml-6 space-y-2">
                      <Label>ช่องทางออนไลน์</Label>
                      <div className="flex flex-wrap gap-4">
                        {NEWS_SOURCE_ONLINE.map((option) => (
                          <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="news_source_online"
                              value={option.value}
                              checked={formData.news_source_online === option.value}
                              onChange={(e) => setFormData(prev => ({ ...prev, news_source_online: e.target.value }))}
                              disabled={loading}
                              className="w-4 h-4"
                            />
                            <span>{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {(formData.news_source_main === "other" || formData.news_source_online === "other") && (
                    <div className="ml-6">
                      <Input
                        value={formData.news_source_other}
                        onChange={(e) => setFormData(prev => ({ ...prev, news_source_other: e.target.value }))}
                        placeholder="ระบุแหล่งข่าวสารอื่นๆ"
                        disabled={loading}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 6: Purchase Purpose */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">จุดประสงค์การซื้อ</h3>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    {PURCHASE_PURPOSE_OPTIONS.map((option) => (
                      <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="purchase_purpose"
                          value={option.value}
                          checked={formData.purchase_purpose === option.value}
                          onChange={(e) => setFormData(prev => ({
                            ...prev,
                            purchase_purpose: e.target.value,
                            purchase_purpose_other: ""
                          }))}
                          disabled={loading}
                          className="w-4 h-4"
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>

                  {formData.purchase_purpose === "other" && (
                    <div className="ml-6">
                      <Textarea
                        value={formData.purchase_purpose_other}
                        onChange={(e) => setFormData(prev => ({ ...prev, purchase_purpose_other: e.target.value }))}
                        placeholder="ระบุจุดประสงค์อื่นๆ"
                        disabled={loading}
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Section 7: Notes */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">บันทึกเพิ่มเติม</h3>
                <Textarea
                  value={formData.lead_notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, lead_notes: e.target.value }))}
                  placeholder="บันทึกข้อมูลเพิ่มเติม..."
                  disabled={loading}
                  rows={3}
                />
              </div>

              {/* Section 8: Consent */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b pb-2">การยินยอม PDPA</h3>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="consent"
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
                        name="consent"
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
                    <div className="space-y-2">
                      <Label>ลายเซ็น</Label>
                      <div className="border rounded-lg p-2 bg-white">
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={150}
                          className="border rounded cursor-crosshair w-full"
                          onMouseDown={startDrawing}
                          onMouseMove={draw}
                          onMouseUp={stopDrawing}
                          onMouseLeave={stopDrawing}
                          onTouchStart={startDrawing}
                          onTouchMove={draw}
                          onTouchEnd={stopDrawing}
                        />
                        <div className="flex gap-2 mt-2">
                          <Button type="button" variant="outline" size="sm" onClick={clearSignature}>
                            ล้างลายเซ็น
                          </Button>
                          <Button type="button" variant="outline" size="sm" onClick={saveSignature}>
                            บันทึกลายเซ็น
                          </Button>
                        </div>
                      </div>
                      {formData.signature && (
                        <p className="text-sm text-green-600">✓ บันทึกลายเซ็นแล้ว</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      บันทึกการแก้ไข
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Policy Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นโยบายความเป็นส่วนตัว (PDPA)</DialogTitle>
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
            <Button onClick={handleAcceptPolicy}>
              ยอมรับและดำเนินการต่อ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EditLeadModal;
