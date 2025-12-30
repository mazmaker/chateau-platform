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

interface AddLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadCreated: () => void;
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

const CONSENT_OPTIONS = [
  { value: "consent", label: "ยินยอม" },
  { value: "no_consent", label: "ไม่ยินยอม" },
];

const AddLeadModal = ({ isOpen, onClose, onLeadCreated }: AddLeadModalProps) => {
  const { currentTenant } = useSimpleAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  // Data from database
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    // Project & Unit
    property_id: "",
    unit_id: "",
    assigned_to: "",
    // Personal Info
    image: null as File | null,
    imagePreview: "",
    first_name: "",
    last_name: "",
    gender: "",
    age: "",
    phone: "",
    email: "",
    // Financial Info
    occupation: "",
    marital_status: "",
    monthly_income: "",
    monthly_debt: "",
    family_members: "",
    education: "",
    // Work Address
    workplace: "",
    province_id: "",
    district_id: "",
    sub_district_id: "",
    postal_code: "",
    // News Source
    news_source_main: "",
    news_source_online: "",
    news_source_other: "",
    // Purchase Purpose
    purchase_purpose: "",
    purchase_purpose_other: "",
    // Consent
    consent: "",
    signature: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPolicyDialog, setShowPolicyDialog] = useState(false);
  const [policyAccepted, setPolicyAccepted] = useState(false);

  // Fetch initial data on open
  useEffect(() => {
    if (isOpen) {
      fetchProvinces();
      fetchProperties();
      fetchSalesPeople();
      resetForm();
    }
  }, [isOpen]);

  // Fetch districts when province changes
  useEffect(() => {
    if (formData.province_id) {
      fetchDistricts(parseInt(formData.province_id));
      setFormData(prev => ({ ...prev, district_id: "", sub_district_id: "", postal_code: "" }));
    }
  }, [formData.province_id]);

  // Fetch sub-districts when district changes
  useEffect(() => {
    if (formData.district_id) {
      fetchSubDistricts(parseInt(formData.district_id));
      setFormData(prev => ({ ...prev, sub_district_id: "", postal_code: "" }));
    }
  }, [formData.district_id]);

  // Fetch zipcode when sub-district changes
  useEffect(() => {
    if (formData.sub_district_id) {
      fetchZipcode(formData.sub_district_id);
    }
  }, [formData.sub_district_id]);

  // Fetch units when property changes
  useEffect(() => {
    if (formData.property_id) {
      fetchUnits(formData.property_id);
      setFormData(prev => ({ ...prev, unit_id: "" }));
    }
  }, [formData.property_id]);

  // API Calls
  const fetchProvinces = async () => {
    try {
      const { data, error } = await supabase
        .from('th_provinces')
        .select('*')
        .order('name_th');
      if (error) throw error;
      setProvinces(data || []);
    } catch (err) {
      console.error('Error fetching provinces:', err);
    }
  };

  const fetchDistricts = async (provinceId: number) => {
    try {
      const { data, error } = await supabase
        .from('th_districts')
        .select('*')
        .eq('province_id', provinceId)
        .order('name_th');
      if (error) throw error;
      setDistricts(data || []);
    } catch (err) {
      console.error('Error fetching districts:', err);
    }
  };

  const fetchSubDistricts = async (districtId: number) => {
    try {
      const { data, error } = await supabase
        .from('th_sub_districts')
        .select('*')
        .eq('district_id', districtId)
        .order('name_th');
      if (error) throw error;
      setSubDistricts(data || []);
    } catch (err) {
      console.error('Error fetching sub-districts:', err);
    }
  };

  const fetchZipcode = async (subDistrictId: string) => {
    try {
      const subDistrict = subDistricts.find(sd => sd.id === parseInt(subDistrictId));
      if (!subDistrict) return;

      const { data, error } = await supabase
        .from('th_zipcodes')
        .select('*')
        .eq('sub_district_code', subDistrict.code)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, postal_code: data[0].zipcode }));
      }
    } catch (err) {
      console.error('Error fetching zipcode:', err);
    }
  };

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select('id, name, type')
        .eq('tenant_id', currentTenant?.id)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setProperties(data || []);
    } catch (err) {
      console.error('Error fetching properties:', err);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, unit_number, project_id, status')
        .eq('project_id', propertyId)
        .eq('status', 'available')
        .order('unit_number');
      if (error) throw error;
      setUnits(data || []);
    } catch (err) {
      console.error('Error fetching units:', err);
      setUnits([]);
    }
  };

  const fetchSalesPeople = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email')
        .eq('tenant_id', currentTenant?.id)
        .in('role', ['admin', 'sales', 'owner'])
        .order('full_name');
      if (error) throw error;
      setSalesPeople(data || []);
    } catch (err) {
      console.error('Error fetching sales people:', err);
    }
  };

  // Image handling
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        image: file,
        imagePreview: URL.createObjectURL(file)
      }));
    }
  };

  // Signature canvas handling
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsDrawing(true);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    saveSignature();
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

  const resetForm = () => {
    setFormData({
      property_id: "",
      unit_id: "",
      assigned_to: "",
      image: null,
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
    setDistricts([]);
    setSubDistricts([]);
    setUnits([]);
    setError("");
    setPolicyAccepted(false);
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('leads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('leads')
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (err) {
      console.error('Error uploading file:', err);
      return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Validate required fields
      if (!formData.property_id) {
        setError("กรุณาเลือกโครงการที่สนใจ");
        setLoading(false);
        return;
      }
      if (!formData.unit_id) {
        setError("กรุณาเลือกยูนิตที่สนใจ");
        setLoading(false);
        return;
      }
      if (!formData.image) {
        setError("กรุณาอัปโหลดรูปภาพ");
        setLoading(false);
        return;
      }
      if (!formData.first_name) {
        setError("กรุณาระบุชื่อ");
        setLoading(false);
        return;
      }
      if (!formData.last_name) {
        setError("กรุณาระบุนามสกุล");
        setLoading(false);
        return;
      }
      if (!formData.phone) {
        setError("กรุณาระบุเบอร์โทร");
        setLoading(false);
        return;
      }
      if (!formData.workplace) {
        setError("กรุณาระบุสถานที่ทำงาน");
        setLoading(false);
        return;
      }
      if (!formData.province_id) {
        setError("กรุณาเลือกจังหวัด");
        setLoading(false);
        return;
      }
      if (!formData.district_id) {
        setError("กรุณาเลือกอำเภอ");
        setLoading(false);
        return;
      }
      if (!formData.sub_district_id) {
        setError("กรุณาเลือกตำบล");
        setLoading(false);
        return;
      }
      if (!formData.news_source_main) {
        setError("กรุณาเลือกแหล่งข่าวสาร");
        setLoading(false);
        return;
      }
      if (!formData.purchase_purpose) {
        setError("กรุณาเลือกจุดประสงค์การซื้อ");
        setLoading(false);
        return;
      }
      if (!formData.consent) {
        setError("กรุณาเลือกการยินยอม");
        setLoading(false);
        return;
      }
      if (formData.consent === "consent" && !formData.signature) {
        setError("กรุณาลงลายมือชื่อ");
        setLoading(false);
        return;
      }

      // Upload image
      let imageUrl = null;
      if (formData.image) {
        imageUrl = await uploadFile(formData.image, 'customer-images');
      }

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

      // Create customer with existing columns + preferences for extra data
      const customerData = {
        tenant_id: currentTenant?.id,
        full_name: `${formData.first_name} ${formData.last_name}`,
        email: formData.email || null,
        phone: formData.phone,
        preferences: {
          // Personal info
          first_name: formData.first_name,
          last_name: formData.last_name,
          gender: formData.gender || null,
          age: formData.age ? parseInt(formData.age) : null,
          profile_image: imageUrl,
          // Financial info
          occupation: formData.occupation || null,
          marital_status: formData.marital_status || null,
          monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
          monthly_debt: formData.monthly_debt ? parseFloat(formData.monthly_debt) : null,
          family_members: formData.family_members ? parseInt(formData.family_members) : null,
          education: formData.education || null,
          // Work address
          workplace: formData.workplace,
          address: {
            province: province?.name_th || '',
            district: district?.name_th || '',
            sub_district: subDistrict?.name_th || '',
            postal_code: formData.postal_code,
          },
          province_id: parseInt(formData.province_id),
          district_id: parseInt(formData.district_id),
          sub_district_id: parseInt(formData.sub_district_id),
          // Source and purpose
          news_source: newsSource,
          purchase_purpose: purchasePurpose,
          // Consent
          consent_given: formData.consent === "consent",
          signature: formData.signature || null,
          consent_date: formData.consent === "consent" ? new Date().toISOString() : null,
        },
      };

      // Check if customer with same email/phone already exists in this tenant
      let customer;
      if (formData.email) {
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', currentTenant?.id)
          .eq('email', formData.email)
          .single();

        if (existingCustomer) {
          // Update existing customer with new data
          const { data: updatedCustomer, error: updateError } = await supabase
            .from('customers')
            .update({
              full_name: customerData.full_name,
              phone: customerData.phone,
              preferences: customerData.preferences,
            })
            .eq('id', existingCustomer.id)
            .select()
            .single();

          if (updateError) throw updateError;
          customer = updatedCustomer;
        }
      }

      // If no existing customer found, create new one
      if (!customer) {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert([customerData])
          .select()
          .single();

        if (customerError) throw customerError;
        customer = newCustomer;
      }

      // Create lead
      const leadData = {
        tenant_id: currentTenant?.id,
        customer_id: customer.id,
        property_id: formData.property_id,
        unit_id: formData.unit_id,
        status: 'new',
        source: newsSource,
        assigned_to: formData.assigned_to || null,
        notes: `จุดประสงค์: ${purchasePurpose}`,
      };

      const { error: leadError } = await supabase
        .from('leads')
        .insert([leadData]);

      if (leadError) throw leadError;

      onLeadCreated();
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Error creating lead:', err);
      setError(err.message || "เกิดข้อผิดพลาดในการสร้าง Lead");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
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

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>เพิ่ม Lead ใหม่</DialogTitle>
            <DialogDescription>
              กรอกข้อมูลลูกค้าและรายละเอียดเพื่อสร้าง Lead ใหม่
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Section 1: Project & Unit Interest */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ข้อมูลโครงการที่สนใจ</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="property_id">โครงการที่สนใจ *</Label>
                  <Select
                    value={formData.property_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value }))}
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
                  <Label htmlFor="unit_id">ยูนิตที่สนใจ *</Label>
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
                  <Label htmlFor="assigned_to">พนักงานขายผู้รับผิดชอบ</Label>
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
              </div>
            </div>

            {/* Section 2: Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ข้อมูลส่วนตัว</h3>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>รูปภาพ *</Label>
                <div className="flex items-center gap-4">
                  {formData.imagePreview ? (
                    <div className="relative">
                      <img
                        src={formData.imagePreview}
                        alt="Preview"
                        className="w-24 h-24 object-cover rounded-full border"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, image: null, imagePreview: "" }))}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-full cursor-pointer hover:border-gray-400">
                      <User className="w-8 h-8 text-gray-400" />
                      <span className="text-xs text-gray-500 mt-1">อัปโหลด</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        disabled={loading}
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">ชื่อ *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                    placeholder="ชื่อ"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="last_name">นามสกุล *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                    placeholder="นามสกุล"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">เพศ</Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="โปรดเลือกเพศ" />
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

                <div className="space-y-2">
                  <Label htmlFor="age">อายุ (ปี)</Label>
                  <Input
                    id="age"
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                    placeholder="อายุ"
                    min="0"
                    max="150"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">เบอร์โทร *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="0812345678"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@example.com"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Financial & Background Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ข้อมูลอาชีพและการเงิน</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">อาชีพ</Label>
                  <Select
                    value={formData.occupation}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, occupation: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="โปรดเลือกอาชีพ" />
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

                <div className="space-y-2">
                  <Label htmlFor="marital_status">สถานภาพ</Label>
                  <Select
                    value={formData.marital_status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="โปรดเลือกสถานภาพ" />
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

                <div className="space-y-2">
                  <Label htmlFor="monthly_income">รายได้ต่อเดือน (บาท)</Label>
                  <Input
                    id="monthly_income"
                    type="number"
                    value={formData.monthly_income}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_income: e.target.value }))}
                    placeholder="0"
                    min="0"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthly_debt">ภาระทางการเงินต่อเดือน (บาท)</Label>
                  <Input
                    id="monthly_debt"
                    type="number"
                    value={formData.monthly_debt}
                    onChange={(e) => setFormData(prev => ({ ...prev, monthly_debt: e.target.value }))}
                    placeholder="0"
                    min="0"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="family_members">สมาชิกในครอบครัว (คน)</Label>
                  <Input
                    id="family_members"
                    type="number"
                    value={formData.family_members}
                    onChange={(e) => setFormData(prev => ({ ...prev, family_members: e.target.value }))}
                    placeholder="0"
                    min="0"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="education">การศึกษา</Label>
                  <Select
                    value={formData.education}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, education: value }))}
                    disabled={loading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="โปรดเลือกการศึกษา" />
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
              </div>
            </div>

            {/* Section 4: Work Address */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ที่อยู่ที่ทำงาน</h3>
              <div className="space-y-2">
                <Label htmlFor="workplace">สถานที่ทำงาน *</Label>
                <Input
                  id="workplace"
                  value={formData.workplace}
                  onChange={(e) => setFormData(prev => ({ ...prev, workplace: e.target.value }))}
                  placeholder="ชื่อบริษัท / สถานที่ทำงาน"
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="province_id">จังหวัด *</Label>
                  <Select
                    value={formData.province_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, province_id: value }))}
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
                  <Label htmlFor="district_id">อำเภอ *</Label>
                  <Select
                    value={formData.district_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, district_id: value }))}
                    disabled={loading || !formData.province_id}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="sub_district_id">ตำบล *</Label>
                  <Select
                    value={formData.sub_district_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, sub_district_id: value }))}
                    disabled={loading || !formData.district_id}
                  >
                    <SelectTrigger>
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

                <div className="space-y-2">
                  <Label htmlFor="postal_code">รหัสไปรษณีย์ *</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code}
                    readOnly
                    placeholder="จะแสดงอัตโนมัติ"
                    className="bg-gray-50"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Section 5: News Source */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ท่านได้รับข่าวสารมาจากแหล่งใด *</h3>
              <div className="space-y-3">
                {NEWS_SOURCE_MAIN.map((source) => (
                  <div key={source.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`news_source_${source.value}`}
                      name="news_source_main"
                      value={source.value}
                      checked={formData.news_source_main === source.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        news_source_main: e.target.value,
                        news_source_online: "",
                        news_source_other: ""
                      }))}
                      className="w-4 h-4"
                      disabled={loading}
                    />
                    <Label htmlFor={`news_source_${source.value}`} className="font-normal cursor-pointer">
                      {source.label}
                    </Label>
                  </div>
                ))}

                {/* Online sub-options */}
                {formData.news_source_main === "online" && (
                  <div className="ml-6 space-y-2 p-3 bg-gray-50 rounded-lg">
                    <Label className="text-sm text-gray-600">เลือกช่องทางออนไลน์:</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {NEWS_SOURCE_ONLINE.map((source) => (
                        <div key={source.value} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id={`news_source_online_${source.value}`}
                            name="news_source_online"
                            value={source.value}
                            checked={formData.news_source_online === source.value}
                            onChange={(e) => setFormData(prev => ({
                              ...prev,
                              news_source_online: e.target.value,
                              news_source_other: source.value === "other" ? prev.news_source_other : ""
                            }))}
                            className="w-4 h-4"
                            disabled={loading}
                          />
                          <Label htmlFor={`news_source_online_${source.value}`} className="font-normal cursor-pointer text-sm">
                            {source.label}
                          </Label>
                        </div>
                      ))}
                    </div>

                    {/* Other textarea for online */}
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

                {/* Other textarea for main */}
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

            {/* Section 6: Purchase Purpose */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">จุดประสงค์ของการซื้ออสังหาริมทรัพย์ *</h3>
              <div className="space-y-3">
                {PURCHASE_PURPOSE_OPTIONS.map((purpose) => (
                  <div key={purpose.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`purchase_purpose_${purpose.value}`}
                      name="purchase_purpose"
                      value={purpose.value}
                      checked={formData.purchase_purpose === purpose.value}
                      onChange={(e) => setFormData(prev => ({
                        ...prev,
                        purchase_purpose: e.target.value,
                        purchase_purpose_other: ""
                      }))}
                      className="w-4 h-4"
                      disabled={loading}
                    />
                    <Label htmlFor={`purchase_purpose_${purpose.value}`} className="font-normal cursor-pointer">
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

            {/* Section 7: Consent */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium border-b pb-2">ยินยอมให้สามารถนำข้อมูลลูกค้าไปใช้งานได้ *</h3>
              <div className="space-y-3">
                {CONSENT_OPTIONS.map((option) => (
                  <div key={option.value} className="flex items-center space-x-2">
                    <input
                      type="radio"
                      id={`consent_${option.value}`}
                      name="consent"
                      value={option.value}
                      checked={formData.consent === option.value}
                      onChange={(e) => handleConsentChange(e.target.value)}
                      className="w-4 h-4"
                      disabled={loading}
                    />
                    <Label htmlFor={`consent_${option.value}`} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}

                {/* Signature Pad */}
                {formData.consent === "consent" && policyAccepted && (
                  <div className="ml-6 space-y-2 p-4 bg-gray-50 rounded-lg">
                    <Label>ลงลายมือชื่อ *</Label>
                    <div className="border rounded-lg bg-white">
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
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                ยกเลิก
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    กำลังบันทึก...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="w-4 h-4 mr-2" />
                    สร้าง Lead
                  </div>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Policy Dialog */}
      <Dialog open={showPolicyDialog} onOpenChange={setShowPolicyDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>นโยบายการนำข้อมูลไปใช้งาน</DialogTitle>
            <DialogDescription>
              กรุณาอ่านนโยบายก่อนลงลายมือชื่อ
            </DialogDescription>
          </DialogHeader>

          <div className="prose prose-sm max-w-none">
            <h4>นโยบายความเป็นส่วนตัว (Privacy Policy)</h4>
            <p>
              บริษัทฯ ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่าน โดยนโยบายนี้อธิบายถึงวิธีการที่เราเก็บรวบรวม ใช้ เปิดเผย และเก็บรักษาข้อมูลส่วนบุคคลของท่าน
            </p>

            <h5>1. ข้อมูลที่เก็บรวบรวม</h5>
            <ul>
              <li>ข้อมูลส่วนตัว: ชื่อ นามสกุล เพศ อายุ</li>
              <li>ข้อมูลติดต่อ: เบอร์โทรศัพท์ อีเมล ที่อยู่</li>
              <li>ข้อมูลการเงิน: รายได้ ภาระหนี้สิน</li>
              <li>ข้อมูลความสนใจ: โครงการที่สนใจ จุดประสงค์การซื้อ</li>
            </ul>

            <h5>2. วัตถุประสงค์ในการใช้ข้อมูล</h5>
            <ul>
              <li>เพื่อติดต่อและให้ข้อมูลเกี่ยวกับโครงการที่ท่านสนใจ</li>
              <li>เพื่อวิเคราะห์ความต้องการและนำเสนอโครงการที่เหมาะสม</li>
              <li>เพื่อดำเนินการตามขั้นตอนการขายและการบริการหลังการขาย</li>
              <li>เพื่อส่งข้อมูลข่าวสารและโปรโมชั่น</li>
            </ul>

            <h5>3. การเปิดเผยข้อมูล</h5>
            <p>
              บริษัทฯ จะไม่เปิดเผยข้อมูลส่วนบุคคลของท่านต่อบุคคลภายนอก ยกเว้นกรณีที่จำเป็นต้องเปิดเผยตามกฎหมาย หรือเพื่อดำเนินการตามวัตถุประสงค์ที่ได้แจ้งไว้
            </p>

            <h5>4. สิทธิ์ของเจ้าของข้อมูล</h5>
            <p>
              ท่านมีสิทธิ์ในการเข้าถึง แก้ไข ลบ หรือขอรับสำเนาข้อมูลส่วนบุคคลของท่าน รวมถึงสิทธิ์ในการถอนความยินยอมได้ทุกเมื่อ
            </p>

            <h5>5. การติดต่อ</h5>
            <p>
              หากท่านมีคำถามเกี่ยวกับนโยบายนี้ สามารถติดต่อเราได้ที่ฝ่ายดูแลข้อมูลส่วนบุคคล
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPolicyDialog(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAcceptPolicy}>
              ยอมรับนโยบาย
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddLeadModal;
