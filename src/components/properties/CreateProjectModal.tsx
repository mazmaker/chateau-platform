import { useState, useEffect } from "react";
import { X, Save, Upload, Plus, Trash2, Link, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

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

interface Zipcode {
  id: number;
  sub_district_code: string;
  zipcode: string;
}

const PROJECT_TYPES = [
  { value: 'single_house', label: 'บ้านเดี่ยว' },
  { value: 'twin_house', label: 'บ้านแฝด' },
  { value: 'townhome', label: 'ทาวน์โฮม' },
  { value: 'condo', label: 'คอนโด' },
];

const CreateProjectModal = ({ isOpen, onClose, onProjectCreated, editingProject }: CreateProjectModalProps) => {
  const { currentTenant } = useSimpleAuth();
  const isEditing = !!editingProject;

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
    fact_sheet_url: "",
    roi_calculator_url: "",
    is_active: true,
    is_featured: false
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch provinces on mount
  useEffect(() => {
    if (isOpen) {
      fetchProvinces();
    }
  }, [isOpen]);

  // Pre-fill form when editing
  useEffect(() => {
    if (isOpen && editingProject) {
      // Load districts and sub-districts for editing
      if (editingProject.province_id) {
        fetchDistricts(editingProject.province_id);
      }
      if (editingProject.district_id) {
        fetchSubDistricts(editingProject.district_id);
      }

      setFormData({
        name: editingProject.name || "",
        project_type: editingProject.type || "",
        thumbnail: null,
        thumbnailPreview: editingProject.thumbnail_url || "",
        gallery: [],
        galleryPreviews: editingProject.images || [],
        total_units: editingProject.total_units?.toString() || "",
        floor_count: editingProject.floor_count?.toString() || "",
        has_facilities: editingProject.has_facilities ? "yes" : "no",
        address: editingProject.address?.street || "",
        province_id: editingProject.province_id?.toString() || "",
        district_id: editingProject.district_id?.toString() || "",
        sub_district_id: editingProject.sub_district_id?.toString() || "",
        postal_code: editingProject.address?.postal_code || "",
        owner_name: editingProject.developer || "",
        attachments: [],
        sale_kit_url: editingProject.information_links?.sale_kit || "",
        fact_sheet_url: editingProject.information_links?.fact_sheet || "",
        roi_calculator_url: editingProject.information_links?.roi_calculator || "",
        is_active: editingProject.is_active ?? true,
        is_featured: editingProject.is_featured ?? false
      });
    } else if (isOpen && !editingProject) {
      resetForm();
    }
  }, [isOpen, editingProject]);

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
      // Find the sub-district code
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
      fact_sheet_url: "",
      roi_calculator_url: "",
      is_active: true,
      is_featured: false
    });
    setDistricts([]);
    setSubDistricts([]);
    setError("");
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

      // Prepare project data
      const projectData = {
        tenant_id: currentTenant?.id,
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
        attachments: attachmentUrls.length > 0 ? attachmentUrls : (isEditing ? editingProject?.images : []),
        information_links: {
          sale_kit: formData.sale_kit_url || null,
          fact_sheet: formData.fact_sheet_url || null,
          roi_calculator: formData.roi_calculator_url || null
        },
        is_active: formData.is_active,
        is_featured: formData.is_featured
      };

      let dbError;
      if (isEditing && editingProject) {
        // Update existing project
        const { error } = await supabase
          .from('properties')
          .update(projectData)
          .eq('id', editingProject.id);
        dbError = error;
      } else {
        // Insert new project
        const { error } = await supabase
          .from('properties')
          .insert([projectData]);
        dbError = error;
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">{isEditing ? 'แก้ไขโครงการ' : 'สร้างโครงการใหม่'}</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">ข้อมูลพื้นฐาน</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">ชื่อโครงการ *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ชื่อโครงการ"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="project_type">ประเภทโครงการ *</Label>
                <Select
                  value={formData.project_type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, project_type: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
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
                <Label htmlFor="total_units">จำนวนยูนิต *</Label>
                <Input
                  id="total_units"
                  type="number"
                  value={formData.total_units}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_units: e.target.value }))}
                  placeholder="จำนวนยูนิตทั้งหมด"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="floor_count">จำนวนชั้น</Label>
                <Input
                  id="floor_count"
                  type="number"
                  value={formData.floor_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, floor_count: e.target.value }))}
                  placeholder="จำนวนชั้น"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="has_facilities">สิ่งอำนวยความสะดวกและสถานที่ใกล้เคียง</Label>
                <Select
                  value={formData.has_facilities}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, has_facilities: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="เลือก" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">มี</SelectItem>
                    <SelectItem value="no">ไม่มี</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="owner_name">เจ้าของโครงการ</Label>
                <Input
                  id="owner_name"
                  value={formData.owner_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, owner_name: e.target.value }))}
                  placeholder="ชื่อเจ้าของโครงการ"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Thumbnail */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">รูป Thumbnail</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {formData.thumbnailPreview ? (
                <div className="relative inline-block">
                  <img
                    src={formData.thumbnailPreview}
                    alt="Thumbnail preview"
                    className="w-48 h-32 object-cover rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, thumbnail: null, thumbnailPreview: "" }))}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer py-4">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">คลิกเพื่ออัปโหลดรูป Thumbnail</span>
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">รูปโครงการ (Gallery)</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-3 mb-3">
                {formData.galleryPreviews.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Gallery ${index + 1}`}
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeGalleryImage(index)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-gray-300 rounded-lg h-24 hover:border-gray-400">
                  <Plus className="w-6 h-6 text-gray-400" />
                  <span className="text-xs text-gray-500 mt-1">เพิ่มรูป</span>
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

          {/* Address */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">ที่อยู่</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="address">ที่อยู่ *</Label>
                <Textarea
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="เลขที่ ถนน ซอย"
                  rows={2}
                  required
                  disabled={loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="province">จังหวัด *</Label>
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

                <div>
                  <Label htmlFor="district">อำเภอ *</Label>
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

                <div>
                  <Label htmlFor="sub_district">ตำบล *</Label>
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

                <div>
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
          </div>

          {/* Attachments */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">เอกสารแนบ (Attachments)</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              {formData.attachments.length > 0 && (
                <div className="space-y-2 mb-3">
                  {formData.attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex items-center">
                        <FileText className="w-4 h-4 text-gray-500 mr-2" />
                        <span className="text-sm text-gray-700">{file.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col items-center cursor-pointer py-2">
                <Upload className="w-6 h-6 text-gray-400 mb-1" />
                <span className="text-sm text-gray-500">คลิกเพื่ออัปโหลดเอกสาร</span>
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

          {/* Information Links */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">ข้อมูลเพิ่มเติม (Information)</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="sale_kit_url" className="flex items-center">
                  <Link className="w-4 h-4 mr-2" />
                  Link Sale Kit
                </Label>
                <Input
                  id="sale_kit_url"
                  type="url"
                  value={formData.sale_kit_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, sale_kit_url: e.target.value }))}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="fact_sheet_url" className="flex items-center">
                  <Link className="w-4 h-4 mr-2" />
                  Link Fact Sheet
                </Label>
                <Input
                  id="fact_sheet_url"
                  type="url"
                  value={formData.fact_sheet_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, fact_sheet_url: e.target.value }))}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="roi_calculator_url" className="flex items-center">
                  <Link className="w-4 h-4 mr-2" />
                  Link ตารางคำนวณผลตอบแทน
                </Label>
                <Input
                  id="roi_calculator_url"
                  type="url"
                  value={formData.roi_calculator_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, roi_calculator_url: e.target.value }))}
                  placeholder="https://..."
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">การตั้งค่า</h3>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_active">เปิดใช้งาน</Label>
                  <p className="text-sm text-gray-600">โครงการจะปรากฏให้ผู้ใช้เห็น</p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="is_featured">โครงการแนะนำ</Label>
                  <p className="text-sm text-gray-600">แสดงในหน้าแรก</p>
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

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t">
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
              disabled={loading}
              className="flex-1"
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
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;
