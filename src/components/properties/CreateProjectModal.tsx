import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  X,
  Save,
  Upload,
  Plus,
  Trash2,
  FileText,
  Building2,
  MapPin,
  Settings,
  ImageIcon,
  Paperclip,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";
import LocationPicker from "./LocationPicker";

interface EditingProject {
  id: string;
  name: string;
  type: string;
  description?: string;
  thumbnail_url?: string;
  images?: string[];
  total_units?: number;
  floor_count?: number;
  has_facilities?: boolean;
  address?: {
    street?: string;
    sub_district?: string;
    district?: string;
    province?: string;
    postal_code?: string;
  };
  province_id?: number;
  district_id?: number;
  sub_district_id?: number;
  developer?: string;
  information_links?: {
    sale_kit?: string;
    fact_sheet?: string;
    roi_calculator?: string;
  };
  is_active?: boolean;
  is_featured?: boolean;
}

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProjectCreated: () => void;
  editingProject?: EditingProject | null;
  scrollToSection?: 'location' | null;
  pageMode?: boolean;
}

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

const PROJECT_TYPES = [
  { value: 'single_house', label: 'บ้านเดี่ยว' },
  { value: 'twin_house', label: 'บ้านแฝด' },
  { value: 'townhome', label: 'ทาวน์โฮม' },
  { value: 'condo', label: 'คอนโด' },
];

interface TenantOption {
  id: string;
  name: string;
}

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated, editingProject, scrollToSection, pageMode = false }: CreateProjectModalProps) => {
  const navigate = useNavigate();
  const { currentTenant, userRole } = useSimpleAuth();
  const isEditing = !!editingProject;
  const isOwner = userRole === 'owner';

  // Tenant selector (Owner only — create new project for any tenant)
  const [tenantOptions, setTenantOptions] = useState<TenantOption[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');

  // Location data
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [subDistricts, setSubDistricts] = useState<SubDistrict[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    project_type: "",
    thumbnail: null as File | null,
    thumbnailPreview: "",
    gallery: [] as File[],
    galleryPreviews: [] as string[],
    total_units: "",
    floor_count: "",
    has_facilities: "",
    address: "",
    province_id: "",
    district_id: "",
    sub_district_id: "",
    postal_code: "",
    owner_name: "",
    attachments: [] as File[],
    sale_kit_url: "",
    documents: [] as { label: string; url: string }[],
    is_active: true,
    is_featured: false,
    master_plan_url: "",
    location_lat: "",
    location_lng: "",
    nearby: [] as { name: string; type: string; distance_km: number }[],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(false);

  // Track previous province/district to detect user changes vs initial load
  const [prevProvinceId, setPrevProvinceId] = useState<string>("");
  const [prevDistrictId, setPrevDistrictId] = useState<string>("");

  // Fetch provinces on mount
  useEffect(() => {
    if (isOpen) {
      fetchProvinces();
    }
  }, [isOpen]);

  // Fetch tenant list (Owner only) + default selection
  useEffect(() => {
    if (!isOpen) return;
    setSelectedTenantId(currentTenant?.id || '');
    if (!isOwner || isEditing) return;
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('tenants') as any)
        .select('id, name, status')
        .neq('status', 'cancelled')
        .order('name');
      if (error) {
        console.error('Failed to fetch tenants:', error);
        return;
      }
      setTenantOptions((data || []) as TenantOption[]);
    })();
  }, [isOpen, isOwner, isEditing, currentTenant?.id]);

  // Pre-fill form when editing
  useEffect(() => {
    const loadEditingData = async () => {
      if (isOpen && editingProject) {
        // Debug: log editingProject data
        console.log('EditingProject data:', {
          type: editingProject.type,
          has_facilities: editingProject.has_facilities,
          province_id: editingProject.province_id,
          district_id: editingProject.district_id,
          sub_district_id: editingProject.sub_district_id,
        });

        // Set flag to prevent cascading resets during initial load
        setIsInitialLoad(true);

        const provinceIdStr = editingProject.province_id?.toString() || "";
        const districtIdStr = editingProject.district_id?.toString() || "";
        const subDistrictIdStr = editingProject.sub_district_id?.toString() || "";

        // Set previous values to match current so useEffect won't reset
        setPrevProvinceId(provinceIdStr);
        setPrevDistrictId(districtIdStr);

        // Load provinces first, then districts and sub-districts for editing
        await fetchProvinces();

        const loadPromises: Promise<any>[] = [];
        if (editingProject.province_id) {
          loadPromises.push(fetchDistricts(editingProject.province_id));
        }
        if (editingProject.district_id) {
          loadPromises.push(fetchSubDistricts(editingProject.district_id));
        }

        // Wait for all location data to load before setting form data
        await Promise.all(loadPromises);

        // Determine has_facilities value
        let hasFacilitiesValue = "";
        if (editingProject.has_facilities === true) {
          hasFacilitiesValue = "yes";
        } else if (editingProject.has_facilities === false) {
          hasFacilitiesValue = "no";
        }

        console.log('Location data loaded, setting form data:', {
          project_type: editingProject.type,
          has_facilities: hasFacilitiesValue,
          province_id: provinceIdStr,
          district_id: districtIdStr,
          sub_district_id: subDistrictIdStr,
        });

        setFormData({
          name: editingProject.name || "",
          project_type: editingProject.type || "",
          thumbnail: null,
          thumbnailPreview: editingProject.thumbnail_url || "",
          gallery: [],
          galleryPreviews: editingProject.images || [],
          total_units: editingProject.total_units?.toString() || "",
          floor_count: editingProject.floor_count?.toString() || "",
          has_facilities: hasFacilitiesValue,
          address: editingProject.address?.street || "",
          province_id: provinceIdStr,
          district_id: districtIdStr,
          sub_district_id: subDistrictIdStr,
          postal_code: editingProject.address?.postal_code || "",
          owner_name: editingProject.developer || "",
          attachments: [],
          sale_kit_url: editingProject.information_links?.sale_kit || "",
          // Migrate legacy keys into the new documents array on edit-load
          documents: (() => {
            const links = editingProject.information_links || {};
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const linksAny = links as any;
            if (Array.isArray(linksAny.documents) && linksAny.documents.length > 0) return linksAny.documents;
            const legacy: { label: string; url: string }[] = [];
            if (linksAny.fact_sheet) legacy.push({ label: 'Fact Sheet', url: linksAny.fact_sheet });
            if (linksAny.roi_calculator) legacy.push({ label: 'ROI Calculator', url: linksAny.roi_calculator });
            return legacy;
          })(),
          is_active: editingProject.is_active ?? true,
          is_featured: editingProject.is_featured ?? false,
          master_plan_url: (editingProject as any).master_plan_url || "",
          location_lat: (editingProject as any).location_lat?.toString() || "",
          location_lng: (editingProject as any).location_lng?.toString() || "",
          nearby: ((editingProject as any).nearby as any[]) || [],
        });

        // Reset flag after form has been populated
        setTimeout(() => {
          setIsInitialLoad(false);
          // Auto-scroll to location section if requested
          if (scrollToSection === 'location') {
            setTimeout(() => {
              const el = document.getElementById('location-section');
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
        }, 200);
      } else if (isOpen && !editingProject) {
        setIsInitialLoad(false);
        setPrevProvinceId("");
        setPrevDistrictId("");
        resetForm();
      }
    };

    loadEditingData();
  }, [isOpen, editingProject]);

  // Fetch districts when province changes (only reset if user is changing, not during initial load)
  useEffect(() => {
    // Only trigger if province actually changed by user (not initial load)
    if (formData.province_id && !isInitialLoad && formData.province_id !== prevProvinceId) {
      fetchDistricts(parseInt(formData.province_id));
      setFormData(prev => ({ ...prev, district_id: "", sub_district_id: "", postal_code: "" }));
      setPrevProvinceId(formData.province_id);
      setPrevDistrictId("");
    }
  }, [formData.province_id, isInitialLoad, prevProvinceId]);

  // Fetch sub-districts when district changes (only reset if user is changing, not during initial load)
  useEffect(() => {
    // Only trigger if district actually changed by user (not initial load)
    if (formData.district_id && !isInitialLoad && formData.district_id !== prevDistrictId) {
      fetchSubDistricts(parseInt(formData.district_id));
      setFormData(prev => ({ ...prev, sub_district_id: "", postal_code: "" }));
      setPrevDistrictId(formData.district_id);
    }
  }, [formData.district_id, isInitialLoad, prevDistrictId]);

  // Fetch zipcode when sub-district changes
  useEffect(() => {
    if (formData.sub_district_id) {
      fetchZipcode(formData.sub_district_id);
    }
  }, [formData.sub_district_id]);

  const fetchProvinces = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('th_provinces') as any)
        .select('*')
        .order('name_th');

      if (error) throw error;
      setProvinces(data || []);
    } catch (err) {
      console.error('Error fetching provinces:', err);
    }
  };

  const fetchDistricts = async (provinceId: number): Promise<District[]> => {
    try {
      console.log('Fetching districts for province:', provinceId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('th_districts') as any)
        .select('*')
        .eq('province_id', provinceId)
        .order('name_th');

      if (error) throw error;
      const districtsList = (data || []) as District[];
      setDistricts(districtsList);
      console.log('Loaded districts:', districtsList.length, 'items', districtsList.slice(0, 3).map((d: District) => ({ id: d.id, name: d.name_th })));
      return districtsList;
    } catch (err) {
      console.error('Error fetching districts:', err);
      return [];
    }
  };

  const fetchSubDistricts = async (districtId: number): Promise<SubDistrict[]> => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('th_sub_districts') as any)
        .select('*')
        .eq('district_id', districtId)
        .order('name_th');

      if (error) throw error;
      const subDistrictsList = (data || []) as SubDistrict[];
      setSubDistricts(subDistrictsList);
      console.log('Loaded subDistricts:', subDistrictsList.length, 'items', subDistrictsList.map((sd: SubDistrict) => ({ id: sd.id, idStr: sd.id.toString(), name: sd.name_th })));
      return subDistrictsList;
    } catch (err) {
      console.error('Error fetching sub-districts:', err);
      return [];
    }
  };

  const fetchZipcode = async (subDistrictId: string) => {
    try {
      // Find the sub-district code
      const subDistrict = subDistricts.find(sd => sd.id === parseInt(subDistrictId));
      if (!subDistrict) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.from('th_zipcodes') as any)
        .select('*')
        .eq('sub_district_code', subDistrict.code)
        .limit(1);

      if (error) throw error;
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, postal_code: (data[0] as any).zipcode }));
      }
    } catch (err) {
      console.error('Error fetching zipcode:', err);
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData(prev => ({
        ...prev,
        thumbnail: file,
        thumbnailPreview: URL.createObjectURL(file)
      }));
    }
  };

  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPreviews = files.map(file => URL.createObjectURL(file));

    setFormData(prev => ({
      ...prev,
      gallery: [...prev.gallery, ...files],
      galleryPreviews: [...prev.galleryPreviews, ...newPreviews]
    }));
  };

  const removeGalleryImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      gallery: prev.gallery.filter((_, i) => i !== index),
      galleryPreviews: prev.galleryPreviews.filter((_, i) => i !== index)
    }));
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setFormData(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...files]
    }));
  };

  const removeAttachment = (index: number) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const resetForm = () => {
    setFormData({
      name: "",
      project_type: "",
      thumbnail: null,
      thumbnailPreview: "",
      gallery: [],
      galleryPreviews: [],
      total_units: "",
      floor_count: "",
      has_facilities: "",
      address: "",
      province_id: "",
      district_id: "",
      sub_district_id: "",
      postal_code: "",
      owner_name: "",
      attachments: [],
      sale_kit_url: "",
      documents: [],
      is_active: true,
      is_featured: false,
      master_plan_url: "",
      location_lat: "",
      location_lng: "",
      nearby: [],
    });
    setDistricts([]);
    setSubDistricts([]);
    setError("");
    setIsInitialLoad(false);
    setPrevProvinceId("");
    setPrevDistrictId("");
  };

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${folder}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('projects')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('projects')
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
      if (!formData.name) {
        setError("กรุณาระบุชื่อโครงการ");
        setLoading(false);
        return;
      }
      if (!formData.project_type) {
        setError("กรุณาเลือกประเภทโครงการ");
        setLoading(false);
        return;
      }
      if (!formData.total_units) {
        setError("กรุณาระบุจำนวนยูนิต");
        setLoading(false);
        return;
      }
      if (!formData.address) {
        setError("กรุณาระบุที่อยู่");
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

      // Upload thumbnail if exists (new file uploaded)
      let thumbnailUrl = formData.thumbnail
        ? await uploadFile(formData.thumbnail, 'thumbnails')
        : (isEditing ? editingProject?.thumbnail_url : null);

      // Upload gallery images (merge with existing if editing)
      const newGalleryUrls: string[] = [];
      for (const file of formData.gallery) {
        const url = await uploadFile(file, 'gallery');
        if (url) newGalleryUrls.push(url);
      }
      // Keep existing gallery URLs that are still in previews (not removed by user)
      const existingGalleryUrls = isEditing
        ? formData.galleryPreviews.filter(url => editingProject?.images?.includes(url))
        : [];
      const galleryUrls = [...existingGalleryUrls, ...newGalleryUrls];

      // Upload attachments
      const attachmentUrls: string[] = [];
      for (const file of formData.attachments) {
        const url = await uploadFile(file, 'attachments');
        if (url) attachmentUrls.push(url);
      }

      // Get location names
      const province = provinces.find(p => p.id === parseInt(formData.province_id));
      const district = districts.find(d => d.id === parseInt(formData.district_id));
      const subDistrict = subDistricts.find(sd => sd.id === parseInt(formData.sub_district_id));

      // Prepare project data — Owner can pick tenant; everyone else falls back to current
      const effectiveTenantId = (isOwner && !isEditing && selectedTenantId)
        ? selectedTenantId
        : currentTenant?.id;

      if (!effectiveTenantId) {
        setError('ไม่พบ tenant — กรุณาเลือกบริษัทเจ้าของโครงการ');
        setLoading(false);
        return;
      }

      const projectData = {
        tenant_id: effectiveTenantId,
        name: formData.name,
        type: formData.project_type,
        description: '',
        thumbnail_url: thumbnailUrl,
        images: galleryUrls,
        total_units: parseInt(formData.total_units),
        floor_count: formData.floor_count ? parseInt(formData.floor_count) : null,
        has_facilities: formData.has_facilities === 'yes',
        address: {
          street: formData.address,
          sub_district: subDistrict?.name_th || '',
          district: district?.name_th || '',
          province: province?.name_th || '',
          postal_code: formData.postal_code,
          country: 'ประเทศไทย'
        },
        base_price: 0,
        currency: 'THB',
        province_id: parseInt(formData.province_id),
        district_id: parseInt(formData.district_id),
        sub_district_id: parseInt(formData.sub_district_id),
        developer: formData.owner_name || null,
        // Only overwrite attachments when the user actually uploaded new ones —
        // previous logic fell back to `editingProject.images` on edit, which silently
        // moved gallery image URLs into the document column.
        ...(attachmentUrls.length > 0 ? { attachments: attachmentUrls } : {}),
        // brochure_url is what CustomerPropertyDetail's "ดาวน์โหลดโบรชัวร์" button reads.
        // Save the Sale Kit URL there too so customers can actually download it; fall
        // back to the first uploaded attachment if no URL was provided.
        brochure_url: formData.sale_kit_url || attachmentUrls[0] || null,
        information_links: {
          sale_kit: formData.sale_kit_url || null,
          documents: formData.documents.filter(d => d.label.trim() && d.url.trim())
        },
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        master_plan_url: formData.master_plan_url || null,
        location_lat: formData.location_lat ? parseFloat(formData.location_lat) : null,
        location_lng: formData.location_lng ? parseFloat(formData.location_lng) : null,
        nearby: formData.nearby.length > 0 ? formData.nearby : null,
      };

      let dbError;
      if (isEditing && editingProject) {
        // Update existing project in properties table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase.from('properties') as any)
          .update(projectData)
          .eq('id', editingProject.id);
        dbError = error;

        // Also update in projects table for units foreign key
        if (!error) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('projects') as any)
            .update({
              name: projectData.name,
              address: projectData.address,
            })
            .eq('id', editingProject.id);
        }
      } else {
        // Insert new project into properties table
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: insertedProperty, error } = await (supabase.from('properties') as any)
          .insert([projectData])
          .select()
          .single();
        dbError = error;

        // Also insert into projects table for units foreign key
        if (!error && insertedProperty) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('projects') as any)
            .insert([{
              id: (insertedProperty as any).id,
              tenant_id: projectData.tenant_id,
              name: projectData.name,
              address: projectData.address,
            }]);
        }
      }

      if (dbError) throw dbError;

      onProjectCreated();
      resetForm();
      onClose();

    } catch (err: any) {
      console.error('Error creating project:', err);
      setError(err.message || "เกิดข้อผิดพลาดในการสร้างโครงการ");
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

  if (!isOpen) return null;

  return (
    <div className={pageMode
      ? 'w-full'
      : 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4'}
    >
      <div className={pageMode
        ? 'bg-white w-full'
        : 'bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl shadow-md">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? 'แก้ไขโครงการ' : 'สร้างโครงการใหม่'}
              </h2>
              <p className="text-xs text-gray-500">กรอกข้อมูลโครงการอสังหาริมทรัพย์</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <form onSubmit={handleSubmit} className={pageMode ? '' : 'flex-1 overflow-y-auto'}>
          <div className="p-6 space-y-6">

            {/* Owner-only: pick which tenant this project belongs to */}
            {isOwner && !isEditing && (
              <Card className="border-2 border-amber-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-50 to-yellow-50 border-b border-amber-200">
                    <div className="p-2 bg-amber-500 rounded-lg">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">บริษัทเจ้าของโครงการ <span className="text-red-500">*</span></h3>
                      <p className="text-xs text-gray-600">โหมด Owner — เลือกได้ว่าจะสร้างให้บริษัทไหน</p>
                    </div>
                  </div>
                  <div className="p-5">
                    <Select
                      value={selectedTenantId}
                      onValueChange={setSelectedTenantId}
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="เลือกบริษัท..." />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {tenantOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                            {t.id === currentTenant?.id && <span className="text-xs text-amber-600 ml-2">(ปัจจุบัน)</span>}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {tenantOptions.length === 0 && (
                      <p className="text-xs text-gray-500 mt-2">กำลังโหลดรายชื่อบริษัท...</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Section 1: ข้อมูลพื้นฐาน */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="p-2 bg-blue-500 rounded-lg">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">ข้อมูลพื้นฐาน</h3>
                    <p className="text-xs text-gray-500">ชื่อโครงการ ประเภท และรายละเอียดทั่วไป</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <Label htmlFor="name" className="text-sm font-medium">ชื่อโครงการ <span className="text-red-500">*</span></Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="เช่น The Garden Residence"
                        required
                        disabled={loading}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="project_type" className="text-sm font-medium">ประเภทโครงการ <span className="text-red-500">*</span></Label>
                      <Select
                        key={`project_type_${formData.project_type}`}
                        value={formData.project_type}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, project_type: value }))}
                        disabled={loading}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="เลือกประเภทโครงการ" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROJECT_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="owner_name" className="text-sm font-medium">เจ้าของโครงการ / Developer</Label>
                      <Input
                        id="owner_name"
                        value={formData.owner_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                        placeholder="ชื่อบริษัทพัฒนาโครงการ"
                        disabled={loading}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="total_units" className="text-sm font-medium">จำนวนยูนิตทั้งหมด <span className="text-red-500">*</span></Label>
                      <Input
                        id="total_units"
                        type="number"
                        value={formData.total_units}
                        onChange={(e) => setFormData(prev => ({ ...prev, total_units: e.target.value }))}
                        placeholder="เช่น 120"
                        required
                        disabled={loading}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="floor_count" className="text-sm font-medium">จำนวนชั้น (สำหรับคอนโด)</Label>
                      <Input
                        id="floor_count"
                        type="number"
                        value={formData.floor_count}
                        onChange={(e) => setFormData(prev => ({ ...prev, floor_count: e.target.value }))}
                        placeholder="เช่น 25"
                        disabled={loading}
                        className="mt-1.5"
                      />
                    </div>

                    <div>
                      <Label htmlFor="has_facilities" className="text-sm font-medium">สิ่งอำนวยความสะดวก</Label>
                      <Select
                        key={`has_facilities_${formData.has_facilities}`}
                        value={formData.has_facilities}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, has_facilities: value }))}
                        disabled={loading}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="เลือก" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">มี (สระว่ายน้ำ, ฟิตเนส, ฯลฯ)</SelectItem>
                          <SelectItem value="no">ไม่มี</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: รูปภาพ */}
            <Card className="border border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="p-2 bg-purple-500 rounded-lg">
                    <ImageIcon className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">รูปภาพโครงการ</h3>
                    <p className="text-xs text-gray-500">รูป Thumbnail และ Gallery สำหรับแสดงในระบบ</p>
                  </div>
                </div>
                <div className="p-5 space-y-5">
                  {/* Thumbnail */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">รูป Thumbnail (รูปหลัก)</Label>
                    <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/30 hover:bg-purple-50/50 transition-colors">
                      {formData.thumbnailPreview ? (
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            <img
                              src={formData.thumbnailPreview}
                              alt="Thumbnail preview"
                              className="w-40 h-28 object-cover rounded-lg shadow-md"
                            />
                            <button
                              type="button"
                              onClick={() => setFormData(prev => ({ ...prev, thumbnail: null, thumbnailPreview: "" }))}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 shadow-md"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="text-sm text-gray-600">
                            <p className="font-medium text-green-600">อัปโหลดสำเร็จ</p>
                            <p className="text-xs text-gray-500">คลิกที่ปุ่ม X เพื่อลบและเลือกใหม่</p>
                          </div>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center cursor-pointer py-6">
                          <div className="p-3 bg-purple-100 rounded-full mb-2">
                            <Upload className="w-6 h-6 text-purple-500" />
                          </div>
                          <span className="text-sm font-medium text-purple-700">คลิกเพื่ออัปโหลดรูป Thumbnail</span>
                          <span className="text-xs text-gray-500 mt-1">PNG, JPG ขนาดแนะนำ 800x600 px</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleThumbnailChange}
                            className="hidden"
                            disabled={loading}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  {/* Gallery */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">รูป Gallery (รูปเพิ่มเติม)</Label>
                    <div className="border-2 border-dashed border-purple-200 rounded-xl p-4 bg-purple-50/30">
                      <div className="grid grid-cols-4 gap-3">
                        {formData.galleryPreviews.map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Gallery ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg shadow-sm"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(index)}
                              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                        <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-purple-300 rounded-lg h-24 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                          <Plus className="w-5 h-5 text-purple-400" />
                          <span className="text-xs text-purple-500 mt-1">เพิ่มรูป</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleGalleryChange}
                            className="hidden"
                            disabled={loading}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: ที่อยู่ */}
            <Card className="border-2 border-green-100 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-green-50 to-green-100/50 border-b border-green-100">
                  <div className="p-2 bg-green-500 rounded-lg">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-green-900">ที่ตั้งโครงการ</h3>
                    <p className="text-xs text-green-600">ที่อยู่และตำแหน่งของโครงการ</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <Label htmlFor="address" className="text-sm font-medium">ที่อยู่ <span className="text-red-500">*</span></Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                      placeholder="เลขที่ ถนน ซอย หมู่บ้าน"
                      rows={2}
                      required
                      disabled={loading}
                      className="mt-1.5"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <Label htmlFor="province" className="text-sm font-medium">จังหวัด <span className="text-red-500">*</span></Label>
                      <Select
                        key={`province_${provinces.length}_${formData.province_id}`}
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
                      <Label htmlFor="district" className="text-sm font-medium">อำเภอ/เขต <span className="text-red-500">*</span></Label>
                      <Select
                        key={`district_${districts.length}_${formData.district_id}`}
                        value={formData.district_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, district_id: value }))}
                        disabled={loading || !formData.province_id}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={formData.province_id ? "เลือก" : "เลือกจังหวัดก่อน"} />
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
                      <Label htmlFor="sub_district" className="text-sm font-medium">ตำบล/แขวง <span className="text-red-500">*</span></Label>
                      <Select
                        key={`sub_district_${subDistricts.length}_${formData.sub_district_id}`}
                        value={formData.sub_district_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, sub_district_id: value }))}
                        disabled={loading || !formData.district_id}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder={formData.district_id ? "เลือก" : "เลือกอำเภอก่อน"} />
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
                      <Label htmlFor="postal_code" className="text-sm font-medium">รหัสไปรษณีย์</Label>
                      <Input
                        id="postal_code"
                        value={formData.postal_code}
                        readOnly
                        placeholder="อัตโนมัติ"
                        className="mt-1.5 bg-gray-50"
                        disabled={loading}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4: เอกสารและลิงก์ */}
            <Card className="border-2 border-orange-100 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                  <div className="p-2 bg-orange-500 rounded-lg">
                    <Paperclip className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-orange-900">เอกสารและลิงก์</h3>
                    <p className="text-xs text-orange-600">แนบเอกสารและลิงก์ข้อมูลเพิ่มเติม</p>
                  </div>
                </div>
                <div className="p-5 space-y-5">
                  {/* Attachments */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">เอกสารแนบ</Label>
                    <div className="border-2 border-dashed border-orange-200 rounded-xl p-4 bg-orange-50/30">
                      {formData.attachments.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {formData.attachments.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-orange-100">
                              <div className="flex items-center">
                                <FileText className="w-4 h-4 text-orange-500 mr-2" />
                                <span className="text-sm text-gray-700">{file.name}</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(index)}
                                className="text-red-500 hover:text-red-600 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="flex flex-col items-center cursor-pointer py-4">
                        <div className="p-2 bg-orange-100 rounded-full mb-2">
                          <Upload className="w-5 h-5 text-orange-500" />
                        </div>
                        <span className="text-sm text-orange-700">คลิกเพื่ออัปโหลดเอกสาร</span>
                        <span className="text-xs text-gray-500 mt-1">PDF, DOC, XLS</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.xls,.xlsx"
                          multiple
                          onChange={handleAttachmentChange}
                          className="hidden"
                          disabled={loading}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Sale Kit — primary doc */}
                  <div>
                    <Label htmlFor="sale_kit_url" className="text-sm font-medium flex items-center gap-1.5">
                      <ExternalLink className="w-3.5 h-3.5 text-orange-500" />
                      Sale Kit (เอกสารขายหลัก)
                    </Label>
                    <Input
                      id="sale_kit_url"
                      type="url"
                      value={formData.sale_kit_url}
                      onChange={(e) => setFormData(prev => ({ ...prev, sale_kit_url: e.target.value }))}
                      placeholder="https://drive.google.com/.../brochure.pdf"
                      disabled={loading}
                      className="mt-1.5"
                    />
                  </div>

                  {/* Flexible documents list */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-orange-500" />
                        เอกสารอื่นๆ
                      </Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          documents: [...prev.documents, { label: '', url: '' }]
                        }))}
                        disabled={loading}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มเอกสาร
                      </Button>
                    </div>
                    {formData.documents.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">
                        ใส่ได้ตามต้องการ — เช่น Fact Sheet, ROI Calculator, Floor Plan PDF, แบบสัญญา
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {formData.documents.map((doc, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <Input
                              type="text"
                              placeholder="ชื่อเอกสาร (เช่น Fact Sheet)"
                              value={doc.label}
                              onChange={(e) => {
                                const next = [...formData.documents];
                                next[idx] = { ...next[idx], label: e.target.value };
                                setFormData(prev => ({ ...prev, documents: next }));
                              }}
                              className="col-span-4"
                              disabled={loading}
                            />
                            <Input
                              type="url"
                              placeholder="https://..."
                              value={doc.url}
                              onChange={(e) => {
                                const next = [...formData.documents];
                                next[idx] = { ...next[idx], url: e.target.value };
                                setFormData(prev => ({ ...prev, documents: next }));
                              }}
                              className="col-span-7"
                              disabled={loading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const next = formData.documents.filter((_, i) => i !== idx);
                                setFormData(prev => ({ ...prev, documents: next }));
                              }}
                              disabled={loading}
                              className="col-span-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 4.5: ตำแหน่ง + ผังโครงการ + ทำเลใกล้เคียง */}
            <Card id="location-section" className="border-2 border-amber-200 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                  <div className="p-1.5 bg-amber-600 rounded-lg">
                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">ตำแหน่ง · ผังโครงการ · ทำเลใกล้เคียง</h3>
                    <p className="text-xs text-gray-600">ข้อมูลเสริมสำหรับหน้ารายละเอียดยูนิต</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Site Plans — moved to a dedicated editor that supports multiple
                      plans + clickable hotspots. The old single-URL field here was
                      removed because it can't model floor plans and there's no good
                      authoring UX for placing pins inside a modal. The button below
                      opens the standalone editor; only available after the project
                      has been created (needs an id). */}
                  {isEditing && editingProject?.id ? (
                    <div className="rounded-xl border border-dashed border-chateau/30 bg-chateau/5 p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="w-5 h-5 text-chateau flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">ผังโครงการ (Site Plan)</p>
                          <p className="text-xs text-gray-600 mt-0.5">
                            อัปโหลดได้หลายผัง (ผังรวม / ผังชั้น) · ปักหมุดแต่ละยูนิตให้คลิกได้
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            if (editingProject?.id) navigate(`/properties/${editingProject.id}/plans`);
                          }}
                          className="flex-shrink-0"
                        >
                          จัดการผัง
                          <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4">
                      <p className="text-xs text-gray-500 flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        บันทึกโครงการก่อน แล้วเข้ามาแก้ไขเพื่อจัดการผังโครงการได้
                      </p>
                    </div>
                  )}

                  {/* Interactive map picker */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">ตำแหน่งบนแผนที่</Label>
                    <LocationPicker
                      lat={formData.location_lat ? parseFloat(formData.location_lat) : null}
                      lng={formData.location_lng ? parseFloat(formData.location_lng) : null}
                      onChange={(lat, lng) => setFormData(prev => ({
                        ...prev,
                        location_lat: lat.toFixed(6),
                        location_lng: lng.toFixed(6),
                      }))}
                      height={340}
                    />
                  </div>

                  {/* Nearby list editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">ทำเลใกล้เคียง</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setFormData(prev => ({
                          ...prev,
                          nearby: [...prev.nearby, { name: '', type: 'shopping', distance_km: 0 }]
                        }))}
                        disabled={loading}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> เพิ่มสถานที่
                      </Button>
                    </div>
                    {formData.nearby.length === 0 ? (
                      <p className="text-xs text-gray-500 italic">ยังไม่มีสถานที่ใกล้เคียง — กดปุ่ม "เพิ่มสถานที่"</p>
                    ) : (
                      <div className="space-y-2">
                        {formData.nearby.map((place, idx) => (
                          <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                            <Input
                              type="text"
                              placeholder="ชื่อสถานที่"
                              value={place.name}
                              onChange={(e) => {
                                const next = [...formData.nearby];
                                next[idx] = { ...next[idx], name: e.target.value };
                                setFormData(prev => ({ ...prev, nearby: next }));
                              }}
                              className="col-span-5"
                              disabled={loading}
                            />
                            <Select
                              value={place.type}
                              onValueChange={(v) => {
                                const next = [...formData.nearby];
                                next[idx] = { ...next[idx], type: v };
                                setFormData(prev => ({ ...prev, nearby: next }));
                              }}
                            >
                              <SelectTrigger className="col-span-4">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="shopping">ห้าง / Shopping</SelectItem>
                                <SelectItem value="transit">รถไฟฟ้า / Transit</SelectItem>
                                <SelectItem value="hospital">โรงพยาบาล</SelectItem>
                                <SelectItem value="school">โรงเรียน</SelectItem>
                                <SelectItem value="airport">สนามบิน</SelectItem>
                                <SelectItem value="beach">ชายหาด</SelectItem>
                                <SelectItem value="market">ตลาด</SelectItem>
                                <SelectItem value="landmark">สถานที่สำคัญ</SelectItem>
                                <SelectItem value="leisure">พักผ่อน</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="กม."
                              value={place.distance_km}
                              onChange={(e) => {
                                const next = [...formData.nearby];
                                next[idx] = { ...next[idx], distance_km: parseFloat(e.target.value) || 0 };
                                setFormData(prev => ({ ...prev, nearby: next }));
                              }}
                              className="col-span-2"
                              disabled={loading}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const next = formData.nearby.filter((_, i) => i !== idx);
                                setFormData(prev => ({ ...prev, nearby: next }));
                              }}
                              disabled={loading}
                              className="col-span-1 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Section 5: การตั้งค่า */}
            <Card className="border-2 border-gray-200 shadow-sm">
              <CardContent className="p-0">
                <div className="flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                  <div className="p-2 bg-gray-600 rounded-lg">
                    <Settings className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">การตั้งค่า</h3>
                    <p className="text-xs text-gray-600">ตั้งค่าการแสดงผลโครงการ</p>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <Label htmlFor="is_active" className="font-medium">เปิดใช้งาน</Label>
                        <p className="text-xs text-gray-500 mt-0.5">โครงการจะปรากฏให้ผู้ใช้เห็น</p>
                      </div>
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                        disabled={loading}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <Label htmlFor="is_featured" className="font-medium">โครงการแนะนำ</Label>
                        <p className="text-xs text-gray-500 mt-0.5">แสดงเด่นในหน้าแรก</p>
                      </div>
                      <Switch
                        id="is_featured"
                        checked={formData.is_featured}
                        onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_featured: checked }))}
                        disabled={loading}
                      />
                    </div>
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
        <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
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
                {isEditing ? 'บันทึกการแก้ไข' : 'บันทึกโครงการ'}
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateProjectModal;
