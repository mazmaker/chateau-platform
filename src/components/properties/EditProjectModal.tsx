import { useState, useEffect } from "react";
import { X, Building2, MapPin, Home, Calendar, Users, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { PropertyType } from "@/lib/database-types";
import { supabase } from "@/lib/supabase";

interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  property_type: PropertyType;
  address: any;
  latitude?: number;
  longitude?: number;
  developer?: string;
  completion_date?: string;
  building_count?: number;
  total_units?: number;
  total_area_sqm?: number;
  price_min?: number;
  price_max?: number;
  is_active: boolean;
  is_featured: boolean;
}

interface EditProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
  onProjectUpdated: () => void;
}

const EditProjectModal = ({ isOpen, onClose, project, onProjectUpdated }: EditProjectModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    description: "",
    property_type: PropertyType.APARTMENT,
    developer: "",
    completion_date: "",
    building_count: "",
    total_units: "",
    total_area_sqm: "",
    price_min: "",
    price_max: "",
    latitude: "",
    longitude: "",
    address: {
      street: "",
      district: "",
      province: "",
      postal_code: "",
      country: ""
    },
    is_active: true,
    is_featured: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        code: project.code || "",
        description: project.description || "",
        property_type: project.property_type || PropertyType.APARTMENT,
        developer: project.developer || "",
        completion_date: project.completion_date || "",
        building_count: project.building_count?.toString() || "",
        total_units: project.total_units?.toString() || "",
        total_area_sqm: project.total_area_sqm?.toString() || "",
        price_min: project.price_min?.toString() || "",
        price_max: project.price_max?.toString() || "",
        latitude: project.latitude?.toString() || "",
        longitude: project.longitude?.toString() || "",
        address: {
          street: project.address?.street || "",
          district: project.address?.district || "",
          province: project.address?.province || "",
          postal_code: project.address?.postal_code || "",
          country: project.address?.country || ""
        },
        is_active: project.is_active ?? true,
        is_featured: project.is_featured ?? false
      });
      setError("");
    }
  }, [project]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;

    setLoading(true);
    setError("");

    try {
      // Validate required fields
      if (!formData.name) {
        setError("กรุณาระบุชื่อโครงการ");
        setLoading(false);
        return;
      }

      // Prepare update data
      const updateData = {
        name: formData.name,
        code: formData.code || null,
        description: formData.description || null,
        property_type: formData.property_type,
        developer: formData.developer || null,
        completion_date: formData.completion_date || null,
        building_count: formData.building_count ? parseInt(formData.building_count) : null,
        total_units: formData.total_units ? parseInt(formData.total_units) : null,
        total_area_sqm: formData.total_area_sqm ? parseFloat(formData.total_area_sqm) : null,
        price_min: formData.price_min ? parseFloat(formData.price_min) : null,
        price_max: formData.price_max ? parseFloat(formData.price_max) : null,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        address: formData.address,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', project.id);

      if (error) throw error;

      onProjectUpdated();
      onClose();

    } catch (error: any) {
      console.error('Error updating project:', error);
      setError(error.message || "เกิดข้อผิดพลาดในการอัปเดตโครงการ");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setError("");
      onClose();
    }
  };

  if (!isOpen || !project) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-semibold text-gray-900">แก้ไขโครงการ</h2>
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
                <Label htmlFor="code">รหัสโครงการ</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  placeholder="รหัสโครงการ (ถ้ามี)"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="property_type">ประเภทอสังหาริมทรัพย์</Label>
                <Select
                  value={formData.property_type}
                  onValueChange={(value: PropertyType) => setFormData(prev => ({ ...prev, property_type: value }))}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PropertyType.APARTMENT}>คอนโด</SelectItem>
                    <SelectItem value={PropertyType.HOUSE}>บ้านเดี่ยว</SelectItem>
                    <SelectItem value={PropertyType.VILLA}>วิลล่า</SelectItem>
                    <SelectItem value={PropertyType.CONDO}>คอนโดมิเนียม</SelectItem>
                    <SelectItem value={PropertyType.COMMERCIAL}>พาณิชย์</SelectItem>
                    <SelectItem value={PropertyType.TOWNHOUSE}>ทาวน์เฮาส์</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="developer">ผู้พัฒนา</Label>
                <Input
                  id="developer"
                  value={formData.developer}
                  onChange={(e) => setFormData(prev => ({ ...prev, developer: e.target.value }))}
                  placeholder="ชื่อผู้พัฒนา"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="description">รายละเอียด</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="รายละเอียดโครงการ"
                rows={3}
                disabled={loading}
              />
            </div>
          </div>

          {/* Project Details */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">รายละเอียดโครงการ</h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="completion_date">วันที่สร้างเสร็จ</Label>
                <Input
                  id="completion_date"
                  type="date"
                  value={formData.completion_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, completion_date: e.target.value }))}
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="building_count">จำนวนอาคาร</Label>
                <Input
                  id="building_count"
                  type="number"
                  value={formData.building_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, building_count: e.target.value }))}
                  placeholder="จำนวนอาคาร"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="total_units">จำนวนยูนิต</Label>
                <Input
                  id="total_units"
                  type="number"
                  value={formData.total_units}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_units: e.target.value }))}
                  placeholder="จำนวนยูนิตทั้งหมด"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="total_area_sqm">พื้นที่ทั้งหมด (ตร.ม.)</Label>
                <Input
                  id="total_area_sqm"
                  type="number"
                  value={formData.total_area_sqm}
                  onChange={(e) => setFormData(prev => ({ ...prev, total_area_sqm: e.target.value }))}
                  placeholder="พื้นที่ทั้งหมด"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="price_min">ราคาต่ำสุด (บาท)</Label>
                <Input
                  id="price_min"
                  type="number"
                  value={formData.price_min}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_min: e.target.value }))}
                  placeholder="ราคาต่ำสุด"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="price_max">ราคาสูงสุด (บาท)</Label>
                <Input
                  id="price_max"
                  type="number"
                  value={formData.price_max}
                  onChange={(e) => setFormData(prev => ({ ...prev, price_max: e.target.value }))}
                  placeholder="ราคาสูงสุด"
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* Address */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">ที่อยู่</h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="street">ถนน</Label>
                  <Input
                    id="street"
                    value={formData.address.street}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      address: { ...prev.address, street: e.target.value }
                    }))}
                    placeholder="ถนน"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="district">เขติด/อำเภอ</Label>
                  <Input
                    id="district"
                    value={formData.address.district}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      address: { ...prev.address, district: e.target.value }
                    }))}
                    placeholder="เขติด/อำเภอ"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="province">จังหวัด</Label>
                  <Input
                    id="province"
                    value={formData.address.province}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      address: { ...prev.address, province: e.target.value }
                    }))}
                    placeholder="จังหวัด"
                    disabled={loading}
                  />
                </div>

                <div>
                  <Label htmlFor="postal_code">รหัสไปรษณีย์</Label>
                  <Input
                    id="postal_code"
                    value={formData.address.postal_code}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      address: { ...prev.address, postal_code: e.target.value }
                    }))}
                    placeholder="รหัสไปรษณีย์"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Coordinates */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">พิกัด GPS (ถ้ามี)</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">ละติจูด</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  placeholder="13.7563"
                  disabled={loading}
                />
              </div>

              <div>
                <Label htmlFor="longitude">ลองจิจูด</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  placeholder="100.5018"
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
                  บันทึกการเปลี่ยนแปลง
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditProjectModal;