import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { AdminGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  MapPin,
  Bed,
  Bath,
  Square,
  TrendingUp,
  Calendar,
  MoreHorizontal,
  Filter,
  Home,
  Layers,
  User,
  ImagePlus,
  X,
  Upload
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import CreateProjectModal from '@/components/properties/CreateProjectModal';

interface Property {
  id: string;
  tenant_id: string;
  name: string;
  type: 'apartment' | 'house' | 'single_house' | 'twin_house' | 'townhome' | 'villa' | 'condo' | 'commercial';
  description: string;
  address: Record<string, any>;
  base_price: number;
  currency: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  images: string[];
  thumbnail_url?: string;
  total_units?: number;
  floor_count?: number;
  has_facilities?: boolean;
  developer?: string;
  is_active: boolean;
  is_featured?: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  project_id: string;
  unit_number: string;
  unit_type?: string;
  floor_number: number;
  building?: string;
  area_sqm: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
  price_per_sqm?: number;
  layout_description?: string;
  facing_direction?: string;
  balcony?: boolean;
  garden?: boolean;
  pool?: boolean;
  parking_spaces?: number;
  images: string[];
  status: 'available' | 'reserved' | 'sold' | 'unavailable';
}

const PropertyManagement = () => {
  const navigate = useNavigate();
  const { currentTenant, userRole } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [showPropertyDialog, setShowPropertyDialog] = useState(false);
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Form states
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    type: 'condo' as Property['type'],
    description: '',
    address: '',
    province: '',
    district: '',
    base_price: '',
    max_guests: 2,
    bedrooms: 1,
    bathrooms: 1,
    size_sqft: ''
  });

  const [unitForm, setUnitForm] = useState({
    unit_number: '',
    floor: '',
    size_sqm: '',
    land_area_sqw: '',
    bedrooms: '',
    bathrooms: '',
    floor_count: '',
    price: '',
    thumbnail: null as File | null,
    thumbnail_preview: '',
    images: [] as File[],
    image_previews: [] as string[],
    description: '',
    status: 'available' as Unit['status']
  });

  useEffect(() => {
    if (currentTenant) {
      fetchProperties();
    }
  }, [currentTenant]);

  useEffect(() => {
    if (selectedProperty) {
      fetchUnits(selectedProperty.id);
    }
  }, [selectedProperty]);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      // Fetch from properties table
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
      }

      // Also fetch from projects table (for THE FORESTIAS and similar)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Error fetching projects:', projectsError);
      }

      // Map projects to Property interface
      const mappedProjects: Property[] = (projectsData || []).map((project: any) => ({
        id: project.id,
        tenant_id: project.tenant_id,
        name: project.name,
        type: 'condo' as const,
        description: project.description || '',
        address: project.address || {},
        base_price: project.price_min || 0,
        currency: 'THB',
        max_guests: 0,
        bedrooms: 0,
        bathrooms: 0,
        size_sqft: 0,
        images: project.images || [],
        thumbnail_url: project.thumbnail_url,
        total_units: project.total_units,
        floor_count: project.floor_count,
        has_facilities: project.has_facilities,
        developer: project.developer,
        is_active: project.is_active ?? true,
        is_featured: project.is_featured,
        created_at: project.created_at
      }));

      // Merge both arrays
      setProperties([...(propertiesData || []), ...mappedProjects]);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async (projectId: string) => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .eq('project_id', projectId)
        .order('unit_number', { ascending: true });

      if (error) {
        console.error('Error fetching units:', error);
        setUnits([]);
        return;
      }

      // Map database response to Unit interface
      const mappedUnits: Unit[] = (data || []).map((unit: any) => ({
        id: unit.id,
        project_id: unit.project_id,
        unit_number: unit.unit_number,
        unit_type: unit.unit_type,
        floor_number: unit.floor_number || 0,
        building: unit.building,
        area_sqm: unit.area_sqm || 0,
        bedrooms: unit.bedrooms || 0,
        bathrooms: unit.bathrooms || 0,
        price: unit.price || 0,
        price_per_sqm: unit.price_per_sqm,
        layout_description: unit.layout_description,
        facing_direction: unit.facing_direction,
        balcony: unit.balcony || false,
        garden: unit.garden || false,
        pool: unit.pool || false,
        parking_spaces: unit.parking_spaces || 0,
        images: unit.images || [],
        status: unit.status || 'available'
      }));

      setUnits(mappedUnits);
    } catch (error) {
      console.error('Error fetching units:', error);
      setUnits([]);
    }
  };

  const handleSaveProperty = async () => {
    try {
      const propertyData = {
        tenant_id: currentTenant?.id,
        name: propertyForm.name,
        type: propertyForm.type,
        description: propertyForm.description,
        address: {
          street: propertyForm.address,
          province: propertyForm.province,
          district: propertyForm.district
        },
        base_price: parseFloat(propertyForm.base_price),
        currency: 'THB',
        max_guests: propertyForm.max_guests,
        bedrooms: propertyForm.bedrooms,
        bathrooms: propertyForm.bathrooms,
        size_sqft: parseFloat(propertyForm.size_sqft),
        images: [],
        is_active: true
      };

      if (editingProperty) {
        await supabase.from('properties').update(propertyData).eq('id', editingProperty.id);
      } else {
        await supabase.from('properties').insert(propertyData);
      }

      setShowPropertyDialog(false);
      setEditingProperty(null);
      resetPropertyForm();
      fetchProperties();
    } catch (error) {
      console.error('Error saving property:', error);
    }
  };

  const [savingUnit, setSavingUnit] = useState(false);

  const handleSaveUnit = async () => {
    if (!selectedProperty || !currentTenant) return;

    setSavingUnit(true);
    try {
      // Upload thumbnail if exists
      let thumbnailUrl: string | null = null;
      if (unitForm.thumbnail) {
        thumbnailUrl = await uploadUnitImage(unitForm.thumbnail, 'thumbnails');
      }

      // Upload gallery images
      const imageUrls: string[] = [];
      for (const file of unitForm.images) {
        const url = await uploadUnitImage(file, 'gallery');
        if (url) {
          imageUrls.push(url);
        }
      }

      const unitData = {
        tenant_id: currentTenant.id,
        project_id: selectedProperty.id,
        unit_number: unitForm.unit_number,
        floor_number: unitForm.floor ? parseInt(unitForm.floor) : null,
        area_sqm: unitForm.size_sqm ? parseFloat(unitForm.size_sqm) : null,
        land_area_sqw: unitForm.land_area_sqw ? parseFloat(unitForm.land_area_sqw) : null,
        bedrooms: unitForm.bedrooms ? parseInt(unitForm.bedrooms) : 0,
        bathrooms: unitForm.bathrooms ? parseInt(unitForm.bathrooms) : 0,
        floor_count: unitForm.floor_count ? parseInt(unitForm.floor_count) : 1,
        price: parseFloat(unitForm.price),
        layout_description: unitForm.description || null,
        thumbnail_url: thumbnailUrl,
        images: imageUrls.length > 0 ? imageUrls : [],
        status: unitForm.status
      };

      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', editingUnit.id);

        if (error) throw error;
      } else {
        console.log('Inserting unit data:', unitData);
        const { data, error } = await supabase
          .from('units')
          .insert(unitData)
          .select();

        console.log('Insert result:', { data, error });
        if (error) throw error;
      }

      setShowUnitDialog(false);
      setEditingUnit(null);
      resetUnitForm();
      fetchUnits(selectedProperty.id);
    } catch (error: any) {
      console.error('Error saving unit:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการบันทึกยูนิต');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleDeleteProperty = async () => {
    if (!selectedProperty) return;
    try {
      await supabase.from('properties').delete().eq('id', selectedProperty.id);
      setShowDeleteDialog(false);
      setSelectedProperty(null);
      fetchProperties();
    } catch (error) {
      console.error('Error deleting property:', error);
    }
  };

  const resetPropertyForm = () => {
    setPropertyForm({
      name: '',
      type: 'condo',
      description: '',
      address: '',
      province: '',
      district: '',
      base_price: '',
      max_guests: 2,
      bedrooms: 1,
      bathrooms: 1,
      size_sqft: ''
    });
  };

  const resetUnitForm = () => {
    // Revoke object URLs to prevent memory leaks
    if (unitForm.thumbnail_preview) {
      URL.revokeObjectURL(unitForm.thumbnail_preview);
    }
    unitForm.image_previews.forEach(url => URL.revokeObjectURL(url));

    setUnitForm({
      unit_number: '',
      floor: '',
      size_sqm: '',
      land_area_sqw: '',
      bedrooms: '',
      bathrooms: '',
      floor_count: '',
      price: '',
      thumbnail: null,
      thumbnail_preview: '',
      images: [],
      image_previews: [],
      description: '',
      status: 'available'
    });
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Revoke previous URL
      if (unitForm.thumbnail_preview) {
        URL.revokeObjectURL(unitForm.thumbnail_preview);
      }
      const previewUrl = URL.createObjectURL(file);
      setUnitForm(prev => ({
        ...prev,
        thumbnail: file,
        thumbnail_preview: previewUrl
      }));
    }
  };

  const removeThumbnail = () => {
    if (unitForm.thumbnail_preview) {
      URL.revokeObjectURL(unitForm.thumbnail_preview);
    }
    setUnitForm(prev => ({
      ...prev,
      thumbnail: null,
      thumbnail_preview: ''
    }));
  };

  const handleImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setUnitForm(prev => ({
        ...prev,
        images: [...prev.images, ...files],
        image_previews: [...prev.image_previews, ...newPreviews]
      }));
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(unitForm.image_previews[index]);
    setUnitForm(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      image_previews: prev.image_previews.filter((_, i) => i !== index)
    }));
  };

  // Upload image to Supabase Storage
  const uploadUnitImage = async (file: File, folder: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${currentTenant?.id}/${selectedProperty?.id}/${folder}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('units')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('units')
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    }
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: 'อพาร์ตเมนท์',
      house: 'บ้านเดี่ยว',
      single_house: 'บ้านเดี่ยว',
      twin_house: 'บ้านแฝด',
      townhome: 'ทาวน์โฮม',
      villa: 'วิลล่า',
      condo: 'คอนโด',
      commercial: 'อาคารพาณิชย์'
    };
    return labels[type] || type;
  };

  const getUnitStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      available: { label: 'ว่าง', variant: 'default' },
      reserved: { label: 'จอง', variant: 'secondary' },
      sold: { label: 'ขายแล้ว', variant: 'destructive' },
      unavailable: { label: 'ไม่ว่าง', variant: 'outline' }
    };
    const badge = badges[status] || badges.available;
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const filteredProperties = properties.filter(property => {
    const matchesSearch = property.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || property.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const filteredUnits = units.filter(unit => {
    return statusFilter === 'all' || unit.status === statusFilter;
  });

  // Calculate stats for selected property's units
  const totalUnits = units.length;
  const availableUnits = units.filter(u => u.status === 'available').length;
  const soldUnits = units.filter(u => u.status === 'sold').length;
  const totalValue = units.reduce((sum, u) => sum + u.price, 0);

  // Calculate stats for all projects (project list view)
  const projectStats = {
    totalUnits: properties.reduce((sum, p) => sum + (p.total_units || 0), 0),
    // For now, assume all units are available since we don't track sold units per project yet
    availableUnits: properties.reduce((sum, p) => sum + (p.total_units || 0), 0),
    soldUnits: 0, // Will be implemented when unit tracking is added
    totalValue: properties.reduce((sum, p) => sum + (p.base_price * (p.total_units || 1)), 0)
  };

  if (!currentTenant) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center text-muted-foreground">
                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>กรุณาเลือกบริษัทก่อน</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-[260px] min-h-screen">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="p-6">
          <AdminGuard>
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">โครงการ</h1>
                  <p className="text-muted-foreground">
                    จัดการโครงการอสังหาและยูนิตทั้งหมดของบริษัท
                  </p>
                </div>
                <Button onClick={() => {
                  setEditingProperty(null);
                  setShowPropertyDialog(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มโครงการใหม่
                </Button>
              </div>

        {/* Property List or Units */}
        {!selectedProperty ? (
          // Properties List
          <>
            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    โครงการทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{properties.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {projectStats.totalUnits.toLocaleString()} ยูนิต
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ยูนิตทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {projectStats.totalUnits.toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    จาก {properties.length} โครงการ
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    โครงการที่เปิดขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {properties.filter(p => p.is_active).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {properties.length > 0
                      ? Math.round((properties.filter(p => p.is_active).length / properties.length) * 100)
                      : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    มูลค่ารวม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">
                    {formatCurrency(projectStats.totalValue)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ราคาเริ่มต้น x จำนวนยูนิต
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="ค้นหาโครงการ..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="ประเภท" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกประเภท</SelectItem>
                      <SelectItem value="condo">คอนโด</SelectItem>
                      <SelectItem value="single_house">บ้านเดี่ยว</SelectItem>
                      <SelectItem value="twin_house">บ้านแฝด</SelectItem>
                      <SelectItem value="townhome">ทาวน์โฮม</SelectItem>
                      <SelectItem value="villa">วิลล่า</SelectItem>
                      <SelectItem value="apartment">อพาร์ตเมนท์</SelectItem>
                      <SelectItem value="commercial">อาคารพาณิชย์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Properties Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {loading ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  กำลังโหลด...
                </div>
              ) : filteredProperties.length === 0 ? (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Building2 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>ไม่พบโครงการ</p>
                </div>
              ) : (
                filteredProperties.map((property) => (
                  <Card
                    key={property.id}
                    className="cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
                    onClick={() => setSelectedProperty(property)}
                  >
                    {/* Thumbnail Image */}
                    <div className="relative h-48 bg-gray-100">
                      {property.thumbnail_url ? (
                        <img
                          src={property.thumbnail_url}
                          alt={property.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Building2 className="w-16 h-16 text-gray-300" />
                        </div>
                      )}
                      {property.is_featured && (
                        <Badge className="absolute top-2 left-2 bg-yellow-500 hover:bg-yellow-600">
                          แนะนำ
                        </Badge>
                      )}
                      <Badge variant="outline" className="absolute top-2 right-2 bg-white/90">
                        {getPropertyTypeLabel(property.type)}
                      </Badge>
                    </div>
                    <CardHeader className="pb-2">
                      <div className="flex-1">
                        <CardTitle className="text-lg line-clamp-1">{property.name}</CardTitle>
                        <CardDescription className="flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {property.address?.district || '-'} {property.address?.province ? `, ${property.address.province}` : ''}
                        </CardDescription>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {property.total_units ? (
                            <div className="flex items-center gap-1">
                              <Home className="w-4 h-4" />
                              {property.total_units} ยูนิต
                            </div>
                          ) : null}
                          {property.floor_count ? (
                            <div className="flex items-center gap-1">
                              <Layers className="w-4 h-4" />
                              {property.floor_count} ชั้น
                            </div>
                          ) : null}
                          {property.developer && (
                            <div className="flex items-center gap-1">
                              <User className="w-4 h-4" />
                              {property.developer}
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">ราคาเริ่มต้น</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(property.base_price)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        ) : (
          // Units View
          <div className="space-y-6">
            {/* Back Button */}
            <Button variant="outline" onClick={() => setSelectedProperty(null)}>
              ← กลับไปรายการโครงการ
            </Button>

            {/* Property Info */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{selectedProperty.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {selectedProperty.address?.district || '-'} {selectedProperty.address?.province ? `, ${selectedProperty.address.province}` : ''}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditingProperty(selectedProperty);
                      setShowPropertyDialog(true);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      แก้ไข
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      ลบ
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{selectedProperty.description || '-'}</p>
              </CardContent>
            </Card>

            {/* Units Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ยูนิตทั้งหมด
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalUnits}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ว่างขาย
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{availableUnits}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUnits > 0 ? Math.round((availableUnits / totalUnits) * 100) : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ขายแล้ว
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{soldUnits}</div>
                  <p className="text-xs text-muted-foreground">
                    {totalUnits > 0 ? Math.round((soldUnits / totalUnits) * 100) : 0}% ของทั้งหมด
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    มูลค่ารวม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-xl font-bold">{formatCurrency(totalValue)}</div>
                </CardContent>
              </Card>
            </div>

            {/* Units Actions */}
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="ค้นหาเลขที่ยูนิต..."
                    className="pl-10 w-64"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[150px]">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="สถานะ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">ทุกสถานะ</SelectItem>
                    <SelectItem value="available">ว่าง</SelectItem>
                    <SelectItem value="reserved">จอง</SelectItem>
                    <SelectItem value="sold">ขายแล้ว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => {
                resetUnitForm();
                setShowUnitDialog(true);
              }}>
                <Plus className="w-4 h-4 mr-2" />
                เพิ่มยูนิตใหม่
              </Button>
            </div>

            {/* Units Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>เลขที่</TableHead>
                      <TableHead>ชั้น</TableHead>
                      <TableHead>ขนาด</TableHead>
                      <TableHead>ห้องนอน/น้ำ</TableHead>
                      <TableHead>ราคา</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUnits.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          ไม่พบยูนิต
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUnits.map((unit) => (
                        <TableRow key={unit.id}>
                          <TableCell className="font-medium">{unit.unit_number}</TableCell>
                          <TableCell>{unit.floor_number ? `ชั้น ${unit.floor_number}` : '-'}</TableCell>
                          <TableCell>{unit.area_sqm ? `${unit.area_sqm.toLocaleString()} ตร.ม.` : '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Bed className="w-3 h-3" /> {unit.bedrooms}
                              <Bath className="w-3 h-3" /> {unit.bathrooms}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(unit.price)}
                          </TableCell>
                          <TableCell>{getUnitStatusBadge(unit.status)}</TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/units/${unit.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  ดูรายละเอียด
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Edit className="w-4 h-4 mr-2" />
                                  แก้ไข
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Create/Edit Project Modal */}
        <CreateProjectModal
          isOpen={showPropertyDialog}
          onClose={() => {
            setShowPropertyDialog(false);
            setEditingProperty(null);
          }}
          onProjectCreated={() => {
            fetchProperties();
            setShowPropertyDialog(false);
            setEditingProperty(null);
            setSelectedProperty(null);
          }}
          editingProject={editingProperty}
        />

        {/* Unit Dialog */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? 'แก้ไขยูนิต' : 'เพิ่มยูนิตใหม่'}
              </DialogTitle>
              <DialogDescription>
                {selectedProperty?.name} - กรอกข้อมูลยูนิต
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              {/* Row 1: Unit Number and Floor */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_number">เลขที่ยูนิต *</Label>
                  <Input
                    id="unit_number"
                    value={unitForm.unit_number}
                    onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                    placeholder="เช่น A101"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="floor">เลขที่ชั้น (คอนโด)</Label>
                  <Input
                    id="floor"
                    type="number"
                    value={unitForm.floor}
                    onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                    placeholder="เช่น 15"
                  />
                </div>
              </div>

              {/* Row 2: Price */}
              <div className="space-y-2">
                <Label htmlFor="unit_price">ราคา (฿) *</Label>
                <Input
                  id="unit_price"
                  type="number"
                  value={unitForm.price}
                  onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                  placeholder="2500000"
                  required
                />
              </div>

              {/* Row 3: Thumbnail Upload */}
              <div className="space-y-2">
                <Label>รูป Thumbnail</Label>
                <p className="text-xs text-muted-foreground">รูปที่จะแสดงในหน้ารายการยูนิตทั้งหมด</p>
                {unitForm.thumbnail_preview ? (
                  <div className="relative w-40 h-28 rounded-lg overflow-hidden border">
                    <img
                      src={unitForm.thumbnail_preview}
                      alt="Thumbnail preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={removeThumbnail}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-40 h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <Upload className="w-6 h-6 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">อัปโหลดรูป</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleThumbnailChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Row 4: Image Gallery */}
              <div className="space-y-2">
                <Label>รูปยูนิต (Gallery)</Label>
                <p className="text-xs text-muted-foreground">สามารถเพิ่มได้หลายรูป</p>
                <div className="flex flex-wrap gap-3">
                  {unitForm.image_previews.map((preview, index) => (
                    <div key={index} className="relative w-24 h-24 rounded-lg overflow-hidden border">
                      <img
                        src={preview}
                        alt={`Image ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex flex-col items-center justify-center w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary transition-colors">
                    <ImagePlus className="w-5 h-5 text-gray-400" />
                    <span className="text-xs text-gray-500 mt-1">เพิ่มรูป</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImagesChange}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Row 5: Areas */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="size_sqm">พื้นที่ใช้สอย (ตร.ม.)</Label>
                  <Input
                    id="size_sqm"
                    type="number"
                    step="0.01"
                    value={unitForm.size_sqm}
                    onChange={(e) => setUnitForm({ ...unitForm, size_sqm: e.target.value })}
                    placeholder="เช่น 45.5"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="land_area_sqw">พื้นที่ดิน (ตร.ว.)</Label>
                  <Input
                    id="land_area_sqw"
                    type="number"
                    step="0.01"
                    value={unitForm.land_area_sqw}
                    onChange={(e) => setUnitForm({ ...unitForm, land_area_sqw: e.target.value })}
                    placeholder="เช่น 50"
                  />
                </div>
              </div>

              {/* Row 6: Rooms */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_bedrooms">จำนวนห้องนอน</Label>
                  <Input
                    id="unit_bedrooms"
                    type="number"
                    min="0"
                    value={unitForm.bedrooms}
                    onChange={(e) => setUnitForm({ ...unitForm, bedrooms: e.target.value })}
                    placeholder="เช่น 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_bathrooms">จำนวนห้องน้ำ</Label>
                  <Input
                    id="unit_bathrooms"
                    type="number"
                    min="0"
                    value={unitForm.bathrooms}
                    onChange={(e) => setUnitForm({ ...unitForm, bathrooms: e.target.value })}
                    placeholder="เช่น 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="floor_count">จำนวนชั้น</Label>
                  <Input
                    id="floor_count"
                    type="number"
                    min="1"
                    value={unitForm.floor_count}
                    onChange={(e) => setUnitForm({ ...unitForm, floor_count: e.target.value })}
                    placeholder="เช่น 2"
                  />
                </div>
              </div>

              {/* Row 7: Description */}
              <div className="space-y-2">
                <Label htmlFor="description">ข้อมูลเพิ่มเติม</Label>
                <Textarea
                  id="description"
                  value={unitForm.description}
                  onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                  placeholder="รายละเอียดเพิ่มเติมของยูนิต..."
                  rows={3}
                />
              </div>

              {/* Row 8: Status */}
              <div className="space-y-2">
                <Label htmlFor="unit_status">สถานะ</Label>
                <Select
                  value={unitForm.status}
                  onValueChange={(value: any) => setUnitForm({ ...unitForm, status: value })}
                >
                  <SelectTrigger id="unit_status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">ว่าง</SelectItem>
                    <SelectItem value="reserved">จอง</SelectItem>
                    <SelectItem value="sold">ขายแล้ว</SelectItem>
                    <SelectItem value="unavailable">ไม่ว่าง</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowUnitDialog(false)}
                disabled={savingUnit}
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSaveUnit}
                disabled={!unitForm.unit_number || !unitForm.price || savingUnit}
              >
                {savingUnit ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึก...
                  </div>
                ) : (
                  editingUnit ? 'บันทึก' : 'เพิ่มยูนิต'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ยืนยันการลบโครงการ</DialogTitle>
              <DialogDescription>
                คุณต้องการลบโครงการ "{selectedProperty?.name}" ใช่หรือไม่?
                <br /><br />
                <span className="text-red-600 font-medium">
                  การกระทำนี้จะลบข้อมูลยูนิตและข้อมูลอื่นๆ ทั้งหมดของโครงการนี้
                  และไม่สามารถกู้คืนได้
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleDeleteProperty}>
                ลบโครงการ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </AdminGuard>
        </main>
      </div>
    </div>
  );
};

export default PropertyManagement;
