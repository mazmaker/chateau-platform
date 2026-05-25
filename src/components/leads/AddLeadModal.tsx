import { useState, useEffect, useRef } from "react";
import {
  X, Save, User, Plus, Trash2, Building2,
  UserCircle, Briefcase, MapPin, Megaphone, Target, ShieldCheck, Users
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  InterestStatus,
  InterestLevel,
  INTEREST_STATUS_OPTIONS,
  INTEREST_LEVEL_OPTIONS,
} from "@/types/lead-interest";
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
import { calculateLeadScore } from "@/lib/leadScoring";
import { estimateLoan } from "@/lib/loanEstimation";
import type { LeadScoringData } from "@/types/leadScoring";

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
  price?: number;
}

// Interest item for multiple interests
interface InterestItem {
  id: string; // temporary id for UI
  property_id: string;
  unit_id: string;
  status: InterestStatus;
  interest_level: InterestLevel;
  notes: string;
  // Cached display data
  property_name?: string;
  unit_number?: string;
  unit_price?: number;
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
  initialPropertyId?: string;
  initialUnitId?: string;
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

// Canonical 5-category set — shared with Customer Profile + Lead CDP
// (granular sub-types like monthly_rent/daily_rent/flip can be captured in notes if needed)
const PURCHASE_PURPOSE_OPTIONS = [
  { value: "residence",  label: "อยู่อาศัยเอง" },
  { value: "investment", label: "ลงทุน (เช่า / ขายต่อ)" },
  { value: "vacation",   label: "บ้านที่สอง / พักผ่อน" },
  { value: "family",     label: "ครอบครัว (พ่อแม่ / บุตรหลาน)" },
  { value: "other",      label: "อื่นๆ / ยังไม่ตัดสินใจ" },
];

const CONSENT_OPTIONS = [
  { value: "consent", label: "ยินยอม" },
  { value: "no_consent", label: "ไม่ยินยอม" },
];

const AddLeadModal = ({ isOpen, onClose, onLeadCreated, initialPropertyId, initialUnitId }: AddLeadModalProps) => {
  const { currentTenant, userRole, userProfile } = useSimpleAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  // Data from database
  const [properties, setProperties] = useState<Property[]>([]);
  const [salesPeople, setSalesPeople] = useState<SalesPerson[]>([]);

  // Multiple interests state
  const [interests, setInterests] = useState<InterestItem[]>([]);
  const [showAddInterest, setShowAddInterest] = useState(false);
  const [newInterest, setNewInterest] = useState({
    property_id: "",
    unit_id: "",
    status: "interested" as InterestStatus,
    interest_level: "medium" as InterestLevel,
    notes: "",
  });
  const [interestUnits, setInterestUnits] = useState<Unit[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    // Sales person
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
    // Lead Scoring - Financial
    down_payment_ready: "",
    savings: "",
    // Lead Scoring - Employment
    employment_type: "",
    years_employed: "",
    // Work Address (includes company name)
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

  // Auto-assign to self for sales/agent roles
  useEffect(() => {
    if (isOpen && (userRole === 'sales' || userRole === 'agent') && userProfile?.id) {
      setFormData(prev => ({ ...prev, assigned_to: userProfile.id }));
    }
  }, [isOpen, userRole, userProfile?.id]);

  // Auto-populate interest when initialPropertyId and initialUnitId are provided
  useEffect(() => {
    if (isOpen && initialPropertyId && initialUnitId && properties.length > 0) {
      // Find property and unit details
      const property = properties.find(p => p.id === initialPropertyId);

      if (property) {
        // Fetch units for this property
        const fetchInitialUnit = async () => {
          try {
            const { data, error } = await supabase
              .from('units')
              .select('id, unit_number, project_id, status, price')
              .eq('id', initialUnitId)
              .single();

            if (error) throw error;

            if (data) {
              // Add the interest automatically
              const newItem: InterestItem = {
                id: `temp-${Date.now()}`,
                property_id: initialPropertyId,
                unit_id: initialUnitId,
                status: "interested",
                interest_level: "medium",
                notes: "",
                property_name: property.name,
                unit_number: data.unit_number,
                unit_price: data.price,
              };

              setInterests([newItem]);
            }
          } catch (err) {
            console.error('Error fetching initial unit:', err);
          }
        };

        fetchInitialUnit();
      }
    }
  }, [isOpen, initialPropertyId, initialUnitId, properties]);

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

  // Fetch units when new interest property changes
  useEffect(() => {
    if (newInterest.property_id) {
      fetchInterestUnits(newInterest.property_id);
      setNewInterest(prev => ({ ...prev, unit_id: "" }));
    } else {
      setInterestUnits([]);
    }
  }, [newInterest.property_id]);

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

  const fetchInterestUnits = async (propertyId: string) => {
    try {
      const existingUnitIds = interests.map(i => i.unit_id);

      let units: Unit[] = [];

      if (userRole === 'agent' && userProfile?.id) {
        // Agent: only show their assigned units in this project
        const { data, error } = await supabase
          .from('agent_unit_assignments')
          .select('units(id, unit_number, project_id, status, price)')
          .eq('agent_user_id', userProfile.id)
          .is('revoked_at', null);
        if (error) throw error;
        units = ((data || []).map((r: any) => r.units).filter(Boolean) as Unit[])
          .filter(u => u.project_id === propertyId);
      } else {
        const { data, error } = await supabase
          .from('units')
          .select('id, unit_number, project_id, status, price')
          .eq('project_id', propertyId)
          .order('unit_number');
        if (error) throw error;
        units = data || [];
      }

      setInterestUnits(units.filter(u => !existingUnitIds.includes(u.id)));
    } catch (err) {
      console.error('Error fetching interest units:', err);
      setInterestUnits([]);
    }
  };

  // Interest management functions
  const handleAddInterest = () => {
    if (!newInterest.property_id || !newInterest.unit_id) return;

    const property = properties.find(p => p.id === newInterest.property_id);
    const unit = interestUnits.find(u => u.id === newInterest.unit_id);

    const newItem: InterestItem = {
      id: `temp-${Date.now()}`,
      property_id: newInterest.property_id,
      unit_id: newInterest.unit_id,
      status: newInterest.status,
      interest_level: newInterest.interest_level,
      notes: newInterest.notes,
      property_name: property?.name,
      unit_number: unit?.unit_number,
      unit_price: unit?.price,
    };

    setInterests(prev => [...prev, newItem]);
    setNewInterest({
      property_id: "",
      unit_id: "",
      status: "interested",
      interest_level: "medium",
      notes: "",
    });
    setShowAddInterest(false);
    setInterestUnits([]);
  };

  const handleRemoveInterest = (id: string) => {
    setInterests(prev => prev.filter(i => i.id !== id));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
    }).format(amount);
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

  // Signature canvas handling - with proper scaling for touch/mouse position
  const getCanvasCoordinates = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const rect = canvas.getBoundingClientRect();
    // Calculate scale ratio between actual canvas size and displayed size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    // Apply scaling to get correct position on canvas
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;

    return { x, y };
  };

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
      down_payment_ready: "",
      savings: "",
      employment_type: "",
      years_employed: "",
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
    setInterests([]);
    setNewInterest({
      property_id: "",
      unit_id: "",
      status: "interested",
      interest_level: "medium",
      notes: "",
    });
    setShowAddInterest(false);
    setInterestUnits([]);
    setDistricts([]);
    setSubDistricts([]);
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
      if (interests.length === 0) {
        setError("กรุณาเพิ่มยูนิตที่สนใจอย่างน้อย 1 รายการ");
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
      let imageUrl: string | null = null;
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
        const { data: existingCustomer, error: existingError } = await supabase
          .from('customers')
          .select('*')
          .eq('tenant_id', currentTenant?.id)
          .eq('email', formData.email)
          .maybeSingle();

        // Only throw if it's a real error (not "not found")
        if (existingError && existingError.code !== 'PGRST116') {
          throw existingError;
        }

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

      // Create lead (use first interest for legacy property_id/unit_id fields)
      const firstInterest = interests[0];
      // Commission attribution — set referred_by_agent_id at creation time.
      // Rules: (a) if the lead is being assigned to an Agent → that Agent is the referrer.
      //        (b) if the creator is themselves an Agent and no one else is being assigned → creator is the referrer.
      // The DB trigger guard_lead_referred_by_immutable() locks this once set, so handoff to Sales
      // later won't reroute commission credit. See migration 20260519000001.
      let referredByAgentId: string | null = null;
      const assignedToId = formData.assigned_to || null;
      if (assignedToId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: assignee } = await (supabase.from('users') as any)
          .select('role')
          .eq('id', assignedToId)
          .maybeSingle();
        if (assignee?.role === 'agent') {
          referredByAgentId = assignedToId;
        }
      }
      if (!referredByAgentId && userRole === 'agent' && userProfile?.id) {
        referredByAgentId = userProfile.id;
      }

      const leadData = {
        tenant_id: currentTenant?.id,
        customer_id: customer.id,
        property_id: firstInterest.property_id,
        unit_id: firstInterest.unit_id,
        status: 'new',
        source: newsSource,
        assigned_to: assignedToId,
        referred_by_agent_id: referredByAgentId,
        notes: `จุดประสงค์: ${purchasePurpose}`,
        // Lead Scoring - Financial fields
        monthly_income: formData.monthly_income ? parseFloat(formData.monthly_income) : null,
        monthly_debt: formData.monthly_debt ? parseFloat(formData.monthly_debt) : null,
        down_payment_ready: formData.down_payment_ready ? parseFloat(formData.down_payment_ready) : null,
        savings: formData.savings ? parseFloat(formData.savings) : null,
        // Lead Scoring - Employment fields
        employment_type: formData.employment_type || null,
        years_employed: formData.years_employed ? parseFloat(formData.years_employed) : null,
        // Lead Scoring - Demographics (from customer preferences)
        age: formData.age ? parseInt(formData.age) : null,
        gender: formData.gender || null,
        marital_status: formData.marital_status || null,
        education: formData.education || null,
        household_size: formData.family_members ? parseInt(formData.family_members) : null,
        // Work location
        workplace: formData.workplace || null,
      };

      const { data: newLead, error: leadError } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single();

      if (leadError) throw leadError;

      // Create lead_interests records for all interests
      const interestsData = interests.map(interest => ({
        tenant_id: currentTenant?.id,
        lead_id: newLead.id,
        property_id: interest.property_id,
        unit_id: interest.unit_id,
        status: interest.status,
        interest_level: interest.interest_level,
        notes: interest.notes || null,
      }));

      const { error: interestsError } = await supabase
        .from('lead_interests')
        .insert(interestsData);

      if (interestsError) {
        console.error('Error creating interests:', interestsError);
        // Don't throw here - lead is already created
      }

      // Calculate Lead Score and Loan Estimation if we have enough data
      console.log('[Lead Scoring] Checking conditions:', {
        monthly_income: leadData.monthly_income,
        unit_id: firstInterest.unit_id,
        canCalculate: !!(leadData.monthly_income && firstInterest.unit_id)
      });

      if (leadData.monthly_income && firstInterest.unit_id) {
        try {
          // Get unit price for loan calculation
          const { data: unitData } = await supabase
            .from('units')
            .select('price')
            .eq('id', firstInterest.unit_id)
            .single();

          const propertyPrice = unitData?.price || 0;
          console.log('[Lead Scoring] Unit price:', propertyPrice);

          // Prepare scoring data — DB returns `null` for missing values, scoring expects `undefined`
          // Cast to `any` because LeadScoringData type doesn't expose every column we read.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const scoringData: LeadScoringData = ({
            monthly_income: leadData.monthly_income ?? undefined,
            monthly_debt: leadData.monthly_debt || 0,
            employment_type: (leadData.employment_type ?? undefined) as any,
            years_employed: leadData.years_employed ?? undefined,
            age: leadData.age ?? undefined,
            gender: (leadData.gender ?? undefined) as any,
            marital_status: (leadData.marital_status ?? undefined) as any,
            education: (leadData.education ?? undefined) as any,
            household_size: leadData.household_size ?? undefined,
            down_payment_ready: leadData.down_payment_ready || 0,
            savings: leadData.savings || 0,
            // Behavioral fields intentionally omitted — a brand-new lead has no tracking
            // data yet. Leaving them undefined makes the engagement category honestly show
            // "ข้อมูลไม่พอ" until the customer browses or Sales records interactions.
            // urgency_level comes from leads.priority (set later by Sales); fresh lead = undefined
            urgency_level: ((leadData as any).priority as any) || undefined,
            interest_level: firstInterest.interest_level || undefined,
            budget_max: propertyPrice,
            // purchase_timeline is set later via EditLeadModal; do not assume a default.
          } as any);

          // Calculate scores
          const potentialScore = calculateLeadScore(scoringData);
          console.log('[Lead Scoring] Calculated score:', {
            overall_score: potentialScore.overall_score,
            breakdown: potentialScore.score_breakdown
          });

          const loanEstimation = propertyPrice > 0 ? estimateLoan({
            monthly_income: leadData.monthly_income ?? undefined,
            monthly_debt: leadData.monthly_debt || 0,
            property_value: propertyPrice,
            down_payment: leadData.down_payment_ready || 0,
            // Loan estimator requires a credit score for its interest-rate tier lookup.
            // Sales don't see this field, so use 700 (market-average tier) as the assumption.
            credit_score: 700,
            age: leadData.age ?? undefined,
            employment_type: (leadData.employment_type ?? undefined) as any,
            years_employed: leadData.years_employed ?? undefined,
          }) : null;

          console.log('[Lead Scoring] Loan estimation:', loanEstimation ? {
            max_loan: loanEstimation.max_loan_amount,
            monthly_payment: loanEstimation.monthly_payment
          } : 'No estimation');

          // Update lead with calculated scores (using snake_case from API)
          const { error: updateError } = await supabase
            .from('leads')
            .update({
              potential_score: potentialScore.overall_score,
              financial_score: potentialScore.score_breakdown.financial_score,
              engagement_score: potentialScore.score_breakdown.engagement_score,
              urgency_score: potentialScore.score_breakdown.urgency_score,
              fit_score: potentialScore.score_breakdown.fit_score,
              conversion_probability: potentialScore.conversion_probability,
              // Auto-set deal value from interested unit price (Sansiri/AP pattern)
              estimated_value: propertyPrice > 0 ? propertyPrice : null,
              max_loan_amount: loanEstimation?.max_loan_amount || null,
              estimated_monthly_payment: loanEstimation?.monthly_payment || null,
              estimated_interest_rate: loanEstimation?.interest_rate || null,
              dti_ratio: (loanEstimation as any)?.dti_ratio || null,
              ltv_ratio: (loanEstimation as any)?.ltv_ratio || null,
              loan_approval_probability: (loanEstimation as any)?.approval_probability || null,
              score_last_updated: new Date().toISOString(),
              loan_last_updated: loanEstimation ? new Date().toISOString() : null,
            })
            .eq('id', newLead.id);

          if (updateError) {
            console.error('[Lead Scoring] Update error:', updateError);
          } else {
            console.log('[Lead Scoring] Successfully updated lead with scores');
            console.log('[Lead Scoring] Lead ID:', newLead.id);
            console.log('[Lead Scoring] Updated values:', {
              potential_score: potentialScore.overall_score,
              max_loan_amount: loanEstimation?.max_loan_amount
            });
          }
        } catch (error) {
          console.error('Error calculating lead scores:', error);
          // Don't throw - lead is already created
        }
      }

      // Log activity for lead creation
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: formData.assigned_to || null,
          p_activity_type: 'lead_created',
          p_description: `สร้าง Lead ใหม่: ${customerData.full_name}`,
          p_metadata: {
            lead_id: newLead.id,
            customer_id: customer.id,
            customer_name: customerData.full_name,
            interests_count: interests.length,
            assigned_to: formData.assigned_to
          }
        });
      } catch {
        // Ignore log_activity errors
      }

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
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-hidden p-0 flex flex-col">
          {/* Hidden Accessibility Elements */}
          <DialogHeader className="sr-only">
            <DialogTitle>เพิ่ม Lead ใหม่</DialogTitle>
            <DialogDescription>
              กรอกข้อมูลลูกค้าและโครงการที่สนใจเพื่อสร้าง Lead ใหม่
            </DialogDescription>
          </DialogHeader>

          {/* Visual Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl shadow-md">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">เพิ่ม Lead ใหม่</h2>
                <p className="text-xs text-gray-500">กรอกข้อมูลลูกค้าและรายละเอียดเพื่อสร้าง Lead ใหม่</p>
              </div>
            </div>
          </div>

          {/* Form Content - Scrollable */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-5">

              {/* Section 1: Unit Interests - Cyan */}
              <Card className="border-2 border-cyan-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-cyan-50 to-cyan-100/50 border-b border-cyan-100">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 bg-cyan-500 rounded-lg">
                        <Building2 className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-cyan-900 text-sm flex items-center gap-2">
                          ยูนิตที่สนใจ <span className="text-red-500">*</span>
                          <Badge variant="secondary" className="text-xs">{interests.length} รายการ</Badge>
                        </h3>
                        <p className="text-xs text-cyan-600">เลือกโครงการและยูนิตที่ลูกค้าสนใจ</p>
                      </div>
                    </div>
                    {!showAddInterest && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddInterest(true)}
                        disabled={loading}
                        className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        เพิ่มยูนิต
                      </Button>
                    )}
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Add Interest Form (Inline) */}
                    {showAddInterest && (
                      <div className="p-4 bg-cyan-50/50 border border-cyan-200 rounded-xl space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label className="text-sm font-medium">โครงการ <span className="text-red-500">*</span></Label>
                            <Select
                              value={newInterest.property_id}
                              onValueChange={(value) => setNewInterest(prev => ({ ...prev, property_id: value }))}
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
                            <Label className="text-sm font-medium">ยูนิต <span className="text-red-500">*</span></Label>
                            <Select
                              value={newInterest.unit_id}
                              onValueChange={(value) => setNewInterest(prev => ({ ...prev, unit_id: value }))}
                              disabled={loading || !newInterest.property_id}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue placeholder={newInterest.property_id ? "เลือกยูนิต" : "เลือกโครงการก่อน"} />
                              </SelectTrigger>
                              <SelectContent className="max-h-60">
                                {interestUnits.length === 0 && newInterest.property_id ? (
                                  <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                                    ไม่มียูนิตที่พร้อมเพิ่ม
                                  </div>
                                ) : (
                                  interestUnits.map((unit) => (
                                    <SelectItem key={unit.id} value={unit.id}>
                                      <div className="flex items-center justify-between w-full">
                                        <span>{unit.unit_number}</span>
                                        {unit.price && (
                                          <span className="text-muted-foreground ml-2">
                                            {formatCurrency(unit.price)}
                                          </span>
                                        )}
                                      </div>
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">สถานะ</Label>
                            <Select
                              value={newInterest.status}
                              onValueChange={(value: InterestStatus) => setNewInterest(prev => ({ ...prev, status: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INTEREST_STATUS_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.icon} {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label className="text-sm font-medium">ระดับความสนใจ</Label>
                            <Select
                              value={newInterest.interest_level}
                              onValueChange={(value: InterestLevel) => setNewInterest(prev => ({ ...prev, interest_level: value }))}
                              disabled={loading}
                            >
                              <SelectTrigger className="mt-1.5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {INTEREST_LEVEL_OPTIONS.map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.icon} {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div>
                          <Label className="text-sm font-medium">บันทึก</Label>
                          <Textarea
                            value={newInterest.notes}
                            onChange={(e) => setNewInterest(prev => ({ ...prev, notes: e.target.value }))}
                            placeholder="บันทึกเพิ่มเติม..."
                            disabled={loading}
                            rows={2}
                            className="mt-1.5"
                          />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleAddInterest}
                            disabled={loading || !newInterest.property_id || !newInterest.unit_id}
                            className="bg-cyan-600 hover:bg-cyan-700"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            เพิ่ม
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowAddInterest(false);
                              setNewInterest({
                                property_id: "",
                                unit_id: "",
                                status: "interested",
                                interest_level: "medium",
                                notes: "",
                              });
                              setInterestUnits([]);
                            }}
                            disabled={loading}
                          >
                            ยกเลิก
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Interest List */}
                    {interests.length > 0 ? (
                      <div className="space-y-2 max-h-[200px] overflow-y-auto">
                        {interests.map((interest) => {
                          const statusOption = INTEREST_STATUS_OPTIONS.find(o => o.value === interest.status);
                          const levelOption = INTEREST_LEVEL_OPTIONS.find(o => o.value === interest.interest_level);
                          return (
                            <div
                              key={interest.id}
                              className="p-3 border rounded-lg bg-gradient-to-r from-cyan-50 to-blue-50 flex items-start gap-3"
                            >
                              <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                <Building2 className="w-5 h-5 text-cyan-700" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="font-semibold text-gray-800 truncate">
                                    {interest.property_name || 'โครงการ'}
                                  </p>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge className={statusOption?.color || 'bg-gray-100'}>
                                      {statusOption?.icon} {statusOption?.label}
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                      onClick={() => handleRemoveInterest(interest.id)}
                                      disabled={loading}
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="text-gray-600">
                                    ยูนิต <strong className="text-gray-800">{interest.unit_number || '-'}</strong>
                                  </span>
                                  {interest.unit_price && (
                                    <span className="font-semibold text-cyan-600">
                                      {formatCurrency(interest.unit_price)}
                                    </span>
                                  )}
                                  <span className={levelOption?.color || 'text-gray-600'}>
                                    {levelOption?.icon} {levelOption?.label}
                                  </span>
                                </div>
                                {interest.notes && (
                                  <p className="text-xs text-gray-500 mt-1 truncate">{interest.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-gray-500 border-2 border-dashed border-cyan-200 rounded-xl bg-cyan-50/30">
                        <Building2 className="w-10 h-10 mx-auto mb-2 text-cyan-300" />
                        <p className="font-medium text-cyan-700">ยังไม่มียูนิตที่สนใจ</p>
                        <p className="text-sm text-cyan-600">กดปุ่ม "เพิ่มยูนิต" เพื่อเริ่มต้น</p>
                      </div>
                    )}

                    {/* Sales Person */}
                    <div className="pt-3 border-t border-cyan-100">
                      <Label htmlFor="assigned_to" className="text-sm font-medium">พนักงานขายผู้รับผิดชอบ</Label>
                      {(userRole === 'sales' || userRole === 'agent') ? (
                        <div className="mt-1.5 max-w-md flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-md text-sm text-gray-700">
                          <span className="text-gray-500">มอบหมายให้:</span>
                          <span className="font-medium">{userProfile?.full_name || 'คุณ'}</span>
                          <span className="text-xs text-gray-400 ml-auto">(อัตโนมัติ)</span>
                        </div>
                      ) : (
                        <Select
                          value={formData.assigned_to}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, assigned_to: value }))}
                          disabled={loading}
                        >
                          <SelectTrigger className="mt-1.5 max-w-md">
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
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: Personal Information - Blue */}
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
                    {/* Image Upload */}
                    <div>
                      <Label className="text-sm font-medium">รูปภาพ <span className="text-red-500">*</span></Label>
                      <div className="flex items-center gap-4 mt-1.5">
                        {formData.imagePreview ? (
                          <div className="relative">
                            <img
                              src={formData.imagePreview}
                              alt="Preview"
                              className="w-20 h-20 object-cover rounded-full border-2 border-blue-200 shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, image: null, imagePreview: "" }))}
                              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-20 h-20 border-2 border-dashed border-blue-300 rounded-full cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                            <User className="w-6 h-6 text-blue-400" />
                            <span className="text-xs text-blue-500 mt-1">อัปโหลด</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleImageChange}
                              className="hidden"
                              disabled={loading}
                            />
                          </label>
                        )}
                        <div className="text-xs text-gray-500">
                          <p>อัปโหลดรูปถ่ายลูกค้า</p>
                          <p>รองรับ PNG, JPG</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="first_name" className="text-sm font-medium">ชื่อ <span className="text-red-500">*</span></Label>
                        <Input
                          id="first_name"
                          value={formData.first_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                          placeholder="ชื่อ"
                          disabled={loading}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="last_name" className="text-sm font-medium">นามสกุล <span className="text-red-500">*</span></Label>
                        <Input
                          id="last_name"
                          value={formData.last_name}
                          onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                          placeholder="นามสกุล"
                          disabled={loading}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="gender" className="text-sm font-medium">เพศ</Label>
                        <Select
                          value={formData.gender}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                          disabled={loading}
                        >
                          <SelectTrigger className="mt-1.5">
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

                      <div>
                        <Label htmlFor="age" className="text-sm font-medium">อายุ (ปี)</Label>
                        <Input
                          id="age"
                          type="number"
                          value={formData.age}
                          onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                          placeholder="อายุ"
                          min="0"
                          max="150"
                          disabled={loading}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="phone" className="text-sm font-medium">เบอร์โทร <span className="text-red-500">*</span></Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={formData.phone}
                          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                          placeholder="0812345678"
                          disabled={loading}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                        <Input
                          id="email"
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

              {/* Section 3: Financial & Background Information - Green */}
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
                  <div className="p-4 space-y-6">
                    {/* Basic Financial Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">ข้อมูลพื้นฐาน</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="marital_status" className="text-sm font-medium">สถานภาพ</Label>
                          <Select
                            value={formData.marital_status}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, marital_status: value }))}
                            disabled={loading}
                          >
                            <SelectTrigger className="mt-1.5">
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

                        <div>
                          <Label htmlFor="education" className="text-sm font-medium">การศึกษา</Label>
                          <Select
                            value={formData.education}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, education: value }))}
                            disabled={loading}
                          >
                            <SelectTrigger className="mt-1.5">
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

                        <div>
                          <Label htmlFor="family_members" className="text-sm font-medium">สมาชิกในครอบครัว (คน)</Label>
                          <Input
                            id="family_members"
                            type="number"
                            value={formData.family_members}
                            onChange={(e) => setFormData(prev => ({ ...prev, family_members: e.target.value }))}
                            placeholder="0"
                            min="0"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Financial Details for Lead Scoring */}
                    <div className="pt-4 border-t border-green-100">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">ข้อมูลการเงินสำหรับประเมินสินเชื่อ</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="monthly_income" className="text-sm font-medium">รายได้ต่อเดือน (บาท)</Label>
                          <Input
                            id="monthly_income"
                            type="number"
                            value={formData.monthly_income}
                            onChange={(e) => setFormData(prev => ({ ...prev, monthly_income: e.target.value }))}
                            placeholder="0"
                            min="0"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="monthly_debt" className="text-sm font-medium">ภาระหนี้สินต่อเดือน (บาท)</Label>
                          <Input
                            id="monthly_debt"
                            type="number"
                            value={formData.monthly_debt}
                            onChange={(e) => setFormData(prev => ({ ...prev, monthly_debt: e.target.value }))}
                            placeholder="0"
                            min="0"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="down_payment_ready" className="text-sm font-medium">เงินดาวน์ที่พร้อม (บาท)</Label>
                          <Input
                            id="down_payment_ready"
                            type="number"
                            value={formData.down_payment_ready}
                            onChange={(e) => setFormData(prev => ({ ...prev, down_payment_ready: e.target.value }))}
                            placeholder="0"
                            min="0"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="savings" className="text-sm font-medium">เงินออม (บาท)</Label>
                          <Input
                            id="savings"
                            type="number"
                            value={formData.savings}
                            onChange={(e) => setFormData(prev => ({ ...prev, savings: e.target.value }))}
                            placeholder="0"
                            min="0"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Employment Details */}
                    <div className="pt-4 border-t border-green-100">
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">ข้อมูลการทำงาน</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label htmlFor="employment_type" className="text-sm font-medium">ประเภทการจ้างงาน</Label>
                          <Select
                            value={formData.employment_type}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, employment_type: value }))}
                            disabled={loading}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder="เลือกประเภท" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="government">รับราชการ</SelectItem>
                              <SelectItem value="private">พนักงานเอกชน</SelectItem>
                              <SelectItem value="business">ธุรกิจส่วนตัว</SelectItem>
                              <SelectItem value="freelance">ฟรีแลนซ์</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="years_employed" className="text-sm font-medium">อายุงาน (ปี)</Label>
                          <Input
                            id="years_employed"
                            type="number"
                            value={formData.years_employed}
                            onChange={(e) => setFormData(prev => ({ ...prev, years_employed: e.target.value }))}
                            placeholder="0"
                            min="0"
                            step="0.5"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>

                        <div>
                          <Label htmlFor="workplace" className="text-sm font-medium">ชื่อบริษัท/สถานที่ทำงาน</Label>
                          <Input
                            id="workplace"
                            value={formData.workplace}
                            onChange={(e) => setFormData(prev => ({ ...prev, workplace: e.target.value }))}
                            placeholder="ระบุชื่อบริษัทหรือสถานที่ทำงาน"
                            disabled={loading}
                            className="mt-1.5"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: Work Address - Orange */}
              <Card className="border-2 border-orange-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <MapPin className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-900 text-sm">ที่อยู่ที่ทำงาน</h3>
                      <p className="text-xs text-orange-600">จังหวัด อำเภอ ตำบล</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="province_id" className="text-sm font-medium">จังหวัด <span className="text-red-500">*</span></Label>
                        <Select
                          value={formData.province_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, province_id: value }))}
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
                        <Label htmlFor="district_id" className="text-sm font-medium">อำเภอ <span className="text-red-500">*</span></Label>
                        <Select
                          value={formData.district_id}
                          onValueChange={(value) => setFormData(prev => ({ ...prev, district_id: value }))}
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
                        <Label htmlFor="sub_district_id" className="text-sm font-medium">ตำบล <span className="text-red-500">*</span></Label>
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
                        <Label htmlFor="postal_code" className="text-sm font-medium">รหัสไปรษณีย์ <span className="text-red-500">*</span></Label>
                        <Input
                          id="postal_code"
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

              {/* Section 5: News Source - Purple */}
              <Card className="border border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <Megaphone className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">แหล่งข่าวสาร <span className="text-red-500">*</span></h3>
                      <p className="text-xs text-gray-500">ท่านได้รับข่าวสารมาจากแหล่งใด</p>
                    </div>
                  </div>
                  <div className="p-4">
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
                            className="w-4 h-4 text-purple-600"
                            disabled={loading}
                          />
                          <Label htmlFor={`news_source_${source.value}`} className="font-normal cursor-pointer">
                            {source.label}
                          </Label>
                        </div>
                      ))}

                      {/* Online sub-options */}
                      {formData.news_source_main === "online" && (
                        <div className="ml-6 space-y-2 p-3 bg-purple-50/50 rounded-xl border border-purple-100">
                          <Label className="text-sm text-purple-700 font-medium">เลือกช่องทางออนไลน์:</Label>
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
                                  className="w-4 h-4 text-purple-600"
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
                </CardContent>
              </Card>

              {/* Section 6: Purchase Purpose - Indigo */}
              <Card className="border-2 border-chateau-50 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-chateau-50 to-chateau-100/50 border-b border-chateau-50">
                    <div className="p-1.5 bg-chateau-500 rounded-lg">
                      <Target className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-chateau-800 text-sm">จุดประสงค์การซื้อ <span className="text-red-500">*</span></h3>
                      <p className="text-xs text-chateau">เหตุผลในการซื้ออสังหาริมทรัพย์</p>
                    </div>
                  </div>
                  <div className="p-4">
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
                            className="w-4 h-4 text-chateau"
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
                </CardContent>
              </Card>

              {/* Section 7: Consent - Gray */}
              <Card className="border-2 border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                    <div className="p-1.5 bg-gray-600 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">การยินยอม PDPA <span className="text-red-500">*</span></h3>
                      <p className="text-xs text-gray-600">ยินยอมให้สามารถนำข้อมูลไปใช้งานได้</p>
                    </div>
                  </div>
                  <div className="p-4">
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
                            className="w-4 h-4 text-gray-600"
                            disabled={loading}
                          />
                          <Label htmlFor={`consent_${option.value}`} className="font-normal cursor-pointer">
                            {option.label}
                          </Label>
                        </div>
                      ))}

                      {/* Signature Pad */}
                      {formData.consent === "consent" && policyAccepted && (
                        <div className="ml-6 space-y-2 p-4 bg-gray-50/50 rounded-xl border border-gray-200">
                          <Label className="text-sm font-medium">ลงลายมือชื่อ <span className="text-red-500">*</span></Label>
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
                  สร้าง Lead
                </div>
              )}
            </Button>
          </div>
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
