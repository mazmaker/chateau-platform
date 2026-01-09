import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { ViewPropertiesGuard, ManagePropertiesGuard } from '@/components/auth/PermissionGuard';
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
  Users,
  ImagePlus,
  X,
  Upload,
  UserPlus,
  DollarSign,
  ImageIcon,
  Ruler,
  FileText,
  Settings,
  Save,
  AlertTriangle
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import CreateProjectModal from '@/components/properties/CreateProjectModal';
import AddLeadModal from '@/components/leads/AddLeadModal';

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
  const [showUnitDetailDialog, setShowUnitDetailDialog] = useState(false);
  const [showDeleteUnitDialog, setShowDeleteUnitDialog] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [viewingUnit, setViewingUnit] = useState<Unit | null>(null);
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null);
  const [selectedUnitForLead, setSelectedUnitForLead] = useState<{ propertyId: string; propertyName: string; unitId: string; unitNumber: string } | null>(null);
  const [unitLeads, setUnitLeads] = useState<any[]>([]);
  const [minPrices, setMinPrices] = useState<Record<string, number>>({});

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

  // Fetch min prices when properties are loaded
  useEffect(() => {
    if (properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      fetchMinPrices(propertyIds);
    }
  }, [properties]);

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

  // Fetch minimum prices from units for all properties
  const fetchMinPrices = async (propertyIds: string[]) => {
    if (!currentTenant || propertyIds.length === 0) return;

    try {
      const { data, error } = await supabase
        .from('units')
        .select('project_id, price')
        .eq('tenant_id', currentTenant.id)
        .in('project_id', propertyIds)
        .gt('price', 0);

      if (error) {
        console.error('Error fetching min prices:', error);
        return;
      }

      // Group by project_id and find minimum price
      const priceMap: Record<string, number> = {};
      (data || []).forEach((unit: { project_id: string; price: number }) => {
        if (!priceMap[unit.project_id] || unit.price < priceMap[unit.project_id]) {
          priceMap[unit.project_id] = unit.price;
        }
      });

      setMinPrices(priceMap);
    } catch (error) {
      console.error('Error fetching min prices:', error);
    }
  };

  // Format price as abbreviated Thai Baht (e.g., 2.5 ล้านบาท)
  const formatPriceShort = (amount?: number) => {
    if (!amount) return "-";
    if (amount >= 1000000) {
      const millions = amount / 1000000;
      return `${millions.toFixed(1)} ล้านบาท`;
    } else if (amount >= 1000) {
      const thousands = amount / 1000;
      return `${thousands.toFixed(0)} พันบาท`;
    }
    return `${amount.toFixed(0)} บาท`;
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

        // Log activity for property update
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: null,
            p_activity_type: 'property_updated',
            p_description: `แก้ไขโครงการ: ${propertyForm.name}`,
            p_metadata: {
              property_id: editingProperty.id,
              property_name: propertyForm.name,
              type: propertyForm.type
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      } else {
        const { data } = await supabase.from('properties').insert(propertyData).select();

        // Log activity for property creation
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant?.id,
            p_user_id: null,
            p_activity_type: 'property_created',
            p_description: `สร้างโครงการใหม่: ${propertyForm.name}`,
            p_metadata: {
              property_id: data?.[0]?.id,
              property_name: propertyForm.name,
              type: propertyForm.type
            }
          });
        } catch {
          // Ignore log_activity errors
        }
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

      let unitId: string | undefined;

      if (editingUnit) {
        const { error } = await supabase
          .from('units')
          .update(unitData)
          .eq('id', editingUnit.id);

        if (error) throw error;
        unitId = editingUnit.id;

        // Log activity for unit update
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant.id,
            p_user_id: null,
            p_activity_type: 'unit_updated',
            p_description: `แก้ไขยูนิต: ${unitForm.unit_number} (${selectedProperty.name})`,
            p_metadata: {
              unit_id: editingUnit.id,
              project_id: selectedProperty.id,
              project_name: selectedProperty.name,
              unit_number: unitForm.unit_number,
              status: unitForm.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
      } else {
        console.log('Inserting unit data:', unitData);
        const { data, error } = await supabase
          .from('units')
          .insert(unitData)
          .select();

        console.log('Insert result:', { data, error });
        if (error) throw error;
        unitId = data?.[0]?.id;

        // Log activity for unit creation
        try {
          await supabase.rpc('log_activity', {
            p_tenant_id: currentTenant.id,
            p_user_id: null,
            p_activity_type: 'unit_created',
            p_description: `สร้างยูนิตใหม่: ${unitForm.unit_number} (${selectedProperty.name})`,
            p_metadata: {
              unit_id: unitId,
              project_id: selectedProperty.id,
              project_name: selectedProperty.name,
              unit_number: unitForm.unit_number,
              status: unitForm.status
            }
          });
        } catch {
          // Ignore log_activity errors
        }
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

      // Log activity for property deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant?.id,
          p_user_id: null,
          p_activity_type: 'property_deleted',
          p_description: `ลบโครงการ: ${selectedProperty.name}`,
          p_metadata: {
            property_id: selectedProperty.id,
            property_name: selectedProperty.name,
            type: selectedProperty.type
          }
        });
      } catch {
        // Ignore log_activity errors
      }

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

  // Handle edit unit - populate form with unit data
  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setUnitForm({
      unit_number: unit.unit_number,
      floor: unit.floor_number?.toString() || '',
      size_sqm: unit.area_sqm?.toString() || '',
      land_area_sqw: '',
      bedrooms: unit.bedrooms?.toString() || '',
      bathrooms: unit.bathrooms?.toString() || '',
      floor_count: '',
      price: unit.price?.toString() || '',
      thumbnail: null,
      thumbnail_preview: '',
      images: [],
      image_previews: unit.images || [],
      description: unit.layout_description || '',
      status: unit.status
    });
    setShowUnitDialog(true);
  };

  // Fetch leads interested in a specific unit
  const fetchUnitLeads = async (unitId: string) => {
    try {
      const { data, error } = await supabase
        .from('lead_interests')
        .select(`
          *,
          leads:lead_id (
            id,
            status,
            source,
            notes,
            created_at,
            customers:customer_id (
              id,
              full_name,
              email,
              phone
            ),
            users:assigned_to (
              id,
              full_name,
              email
            )
          )
        `)
        .eq('unit_id', unitId)
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUnitLeads(data || []);
    } catch (err) {
      console.error('Error fetching unit leads:', err);
      setUnitLeads([]);
    }
  };

  // Handle view unit details
  const handleViewUnit = async (unit: Unit) => {
    setViewingUnit(unit);
    setShowUnitDetailDialog(true);
    // Fetch leads for this unit
    await fetchUnitLeads(unit.id);
  };

  // Handle add lead from unit
  const handleAddLeadFromUnit = (unit: Unit) => {
    if (!selectedProperty) return;

    setSelectedUnitForLead({
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.name,
      unitId: unit.id,
      unitNumber: unit.unit_number
    });
    setShowAddLeadModal(true);
  };

  // Handle lead created - navigate to leads page
  const handleLeadCreated = () => {
    setShowAddLeadModal(false);
    setSelectedUnitForLead(null);
    navigate('/leads');
  };

  // Handle delete unit confirmation
  const handleDeleteUnitClick = (unit: Unit) => {
    setDeletingUnit(unit);
    setShowDeleteUnitDialog(true);
  };

  // Handle delete unit
  const handleDeleteUnit = async () => {
    if (!deletingUnit || !selectedProperty) return;

    try {
      const { error } = await supabase
        .from('units')
        .delete()
        .eq('id', deletingUnit.id);

      if (error) throw error;

      // Log activity for unit deletion
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: currentTenant.id,
          p_user_id: null,
          p_activity_type: 'unit_deleted',
          p_description: `ลบยูนิต: ${deletingUnit.unit_number} (${selectedProperty.name})`,
          p_metadata: {
            unit_id: deletingUnit.id,
            project_id: selectedProperty.id,
            project_name: selectedProperty.name,
            unit_number: deletingUnit.unit_number
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      setShowDeleteUnitDialog(false);
      setDeletingUnit(null);
      fetchUnits(selectedProperty.id);
    } catch (error: any) {
      console.error('Error deleting unit:', error);
      alert(error.message || 'เกิดข้อผิดพลาดในการลบยูนิต');
    }
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
          <ViewPropertiesGuard>
            <div className="space-y-6">
              {/* Header */}
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
                <CardContent className="pt-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                        <Building2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h1 className="text-2xl font-bold text-gray-900">โครงการ</h1>
                        <p className="text-gray-600 mt-1">
                          จัดการโครงการอสังหาและยูนิตทั้งหมดของบริษัท
                        </p>
                      </div>
                    </div>
                    <ManagePropertiesGuard fallback={null} showMessage={false}>
                      <Button
                        onClick={() => {
                          setEditingProperty(null);
                          setShowPropertyDialog(true);
                        }}
                        className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        เพิ่มโครงการใหม่
                      </Button>
                    </ManagePropertiesGuard>
                  </div>
                </CardContent>
              </Card>

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
                              {formatPriceShort(minPrices[property.id] || property.base_price)}
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
                  <ManagePropertiesGuard fallback={null} showMessage={false}>
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
                  </ManagePropertiesGuard>
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
              <ManagePropertiesGuard fallback={null} showMessage={false}>
                <Button onClick={() => {
                  resetUnitForm();
                  setShowUnitDialog(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มยูนิตใหม่
                </Button>
              </ManagePropertiesGuard>
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
                                <DropdownMenuItem onClick={() => handleViewUnit(unit)}>
                                  <Eye className="w-4 h-4 mr-2" />
                                  ดูรายละเอียด
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleAddLeadFromUnit(unit)}>
                                  <UserPlus className="w-4 h-4 mr-2" />
                                  เพิ่ม Lead ใหม่
                                </DropdownMenuItem>
                                <ManagePropertiesGuard fallback={null} showMessage={false}>
                                  <DropdownMenuItem onClick={() => handleEditUnit(unit)}>
                                    <Edit className="w-4 h-4 mr-2" />
                                    แก้ไข
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteUnitClick(unit)}
                                    className="text-red-600 focus:text-red-600"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    ลบ
                                  </DropdownMenuItem>
                                </ManagePropertiesGuard>
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
          <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden p-0 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-[#676AF1]/10 via-[#8B5CF6]/10 to-[#676AF1]/10 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-[#676AF1] to-[#8B5CF6] rounded-xl shadow-md">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    {editingUnit ? 'แก้ไขยูนิต' : 'เพิ่มยูนิตใหม่'}
                  </h2>
                  <p className="text-xs text-gray-500">{selectedProperty?.name}</p>
                </div>
              </div>
            </div>

            {/* Form Content - Scrollable */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Section 1: ข้อมูลพื้นฐาน */}
              <Card className="border-2 border-blue-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100/50 border-b border-blue-100">
                    <div className="p-1.5 bg-blue-500 rounded-lg">
                      <Home className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 text-sm">ข้อมูลพื้นฐาน</h3>
                      <p className="text-xs text-blue-600">เลขที่ยูนิต ชั้น และราคา</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="unit_number" className="text-sm font-medium">เลขที่ยูนิต <span className="text-red-500">*</span></Label>
                        <Input
                          id="unit_number"
                          value={unitForm.unit_number}
                          onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                          placeholder="เช่น A101"
                          required
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor" className="text-sm font-medium">เลขที่ชั้น</Label>
                        <Input
                          id="floor"
                          type="number"
                          value={unitForm.floor}
                          onChange={(e) => setUnitForm({ ...unitForm, floor: e.target.value })}
                          placeholder="เช่น 15"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_price" className="text-sm font-medium">ราคา (฿) <span className="text-red-500">*</span></Label>
                        <Input
                          id="unit_price"
                          type="number"
                          value={unitForm.price}
                          onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                          placeholder="เช่น 2,500,000"
                          required
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 2: รูปภาพ */}
              <Card className="border-2 border-purple-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-purple-50 to-purple-100/50 border-b border-purple-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <ImageIcon className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900 text-sm">รูปภาพยูนิต</h3>
                      <p className="text-xs text-purple-600">รูป Thumbnail และ Gallery</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {/* Thumbnail */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">รูป Thumbnail (รูปหลัก)</Label>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-3 bg-purple-50/30 hover:bg-purple-50/50 transition-colors">
                        {unitForm.thumbnail_preview ? (
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <img
                                src={unitForm.thumbnail_preview}
                                alt="Thumbnail preview"
                                className="w-32 h-24 object-cover rounded-lg shadow-md"
                              />
                              <button
                                type="button"
                                onClick={removeThumbnail}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            <div className="text-sm text-gray-600">
                              <p className="font-medium text-green-600">อัปโหลดสำเร็จ</p>
                              <p className="text-xs text-gray-500">คลิกที่ปุ่ม X เพื่อลบ</p>
                            </div>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center cursor-pointer py-4">
                            <div className="p-2 bg-purple-100 rounded-full mb-2">
                              <Upload className="w-5 h-5 text-purple-500" />
                            </div>
                            <span className="text-sm font-medium text-purple-700">คลิกเพื่ออัปโหลดรูป Thumbnail</span>
                            <span className="text-xs text-gray-500 mt-1">PNG, JPG ขนาดแนะนำ 800x600 px</span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleThumbnailChange}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Gallery */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">รูป Gallery (รูปเพิ่มเติม)</Label>
                      <div className="border-2 border-dashed border-purple-200 rounded-xl p-3 bg-purple-50/30">
                        <div className="grid grid-cols-5 gap-2">
                          {unitForm.image_previews.map((preview, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={preview}
                                alt={`Gallery ${index + 1}`}
                                className="w-full h-20 object-cover rounded-lg shadow-sm"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                          <label className="flex flex-col items-center justify-center cursor-pointer border-2 border-dashed border-purple-300 rounded-lg h-20 hover:border-purple-400 hover:bg-purple-50 transition-colors">
                            <Plus className="w-4 h-4 text-purple-400" />
                            <span className="text-xs text-purple-500 mt-0.5">เพิ่มรูป</span>
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
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 3: พื้นที่ */}
              <Card className="border-2 border-green-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-green-50 to-green-100/50 border-b border-green-100">
                    <div className="p-1.5 bg-green-500 rounded-lg">
                      <Ruler className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-green-900 text-sm">ขนาดพื้นที่</h3>
                      <p className="text-xs text-green-600">พื้นที่ใช้สอยและพื้นที่ดิน</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="size_sqm" className="text-sm font-medium">พื้นที่ใช้สอย (ตร.ม.)</Label>
                        <Input
                          id="size_sqm"
                          type="number"
                          step="0.01"
                          value={unitForm.size_sqm}
                          onChange={(e) => setUnitForm({ ...unitForm, size_sqm: e.target.value })}
                          placeholder="เช่น 45.5"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="land_area_sqw" className="text-sm font-medium">พื้นที่ดิน (ตร.ว.)</Label>
                        <Input
                          id="land_area_sqw"
                          type="number"
                          step="0.01"
                          value={unitForm.land_area_sqw}
                          onChange={(e) => setUnitForm({ ...unitForm, land_area_sqw: e.target.value })}
                          placeholder="เช่น 50"
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 4: ห้อง */}
              <Card className="border-2 border-orange-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-orange-50 to-orange-100/50 border-b border-orange-100">
                    <div className="p-1.5 bg-orange-500 rounded-lg">
                      <Bed className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-orange-900 text-sm">จำนวนห้อง</h3>
                      <p className="text-xs text-orange-600">ห้องนอน ห้องน้ำ และชั้น</p>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="unit_bedrooms" className="text-sm font-medium flex items-center gap-1.5">
                          <Bed className="w-3.5 h-3.5 text-orange-500" />
                          ห้องนอน
                        </Label>
                        <Input
                          id="unit_bedrooms"
                          type="number"
                          min="0"
                          value={unitForm.bedrooms}
                          onChange={(e) => setUnitForm({ ...unitForm, bedrooms: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="unit_bathrooms" className="text-sm font-medium flex items-center gap-1.5">
                          <Bath className="w-3.5 h-3.5 text-orange-500" />
                          ห้องน้ำ
                        </Label>
                        <Input
                          id="unit_bathrooms"
                          type="number"
                          min="0"
                          value={unitForm.bathrooms}
                          onChange={(e) => setUnitForm({ ...unitForm, bathrooms: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                      <div>
                        <Label htmlFor="floor_count" className="text-sm font-medium flex items-center gap-1.5">
                          <Layers className="w-3.5 h-3.5 text-orange-500" />
                          จำนวนชั้น
                        </Label>
                        <Input
                          id="floor_count"
                          type="number"
                          min="1"
                          value={unitForm.floor_count}
                          onChange={(e) => setUnitForm({ ...unitForm, floor_count: e.target.value })}
                          placeholder="เช่น 2"
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Section 5: รายละเอียดและสถานะ */}
              <Card className="border-2 border-gray-200 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                    <div className="p-1.5 bg-gray-600 rounded-lg">
                      <FileText className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 text-sm">รายละเอียดและสถานะ</h3>
                      <p className="text-xs text-gray-600">ข้อมูลเพิ่มเติมและสถานะยูนิต</p>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <Label htmlFor="description" className="text-sm font-medium">ข้อมูลเพิ่มเติม</Label>
                      <Textarea
                        id="description"
                        value={unitForm.description}
                        onChange={(e) => setUnitForm({ ...unitForm, description: e.target.value })}
                        placeholder="รายละเอียดเพิ่มเติมของยูนิต เช่น วิวสวย ห้องมุม ฯลฯ"
                        rows={2}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <Label htmlFor="unit_status" className="text-sm font-medium">สถานะยูนิต</Label>
                      <Select
                        value={unitForm.status}
                        onValueChange={(value: any) => setUnitForm({ ...unitForm, status: value })}
                      >
                        <SelectTrigger id="unit_status" className="mt-1.5">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500"></span>
                              ว่าง
                            </span>
                          </SelectItem>
                          <SelectItem value="reserved">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                              จอง
                            </span>
                          </SelectItem>
                          <SelectItem value="sold">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                              ขายแล้ว
                            </span>
                          </SelectItem>
                          <SelectItem value="unavailable">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                              ไม่ว่าง
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer - Fixed at bottom */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50 flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowUnitDialog(false)}
                disabled={savingUnit}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                onClick={handleSaveUnit}
                disabled={!unitForm.unit_number || !unitForm.price || savingUnit}
                className="flex-1 bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:opacity-90"
              >
                {savingUnit ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    กำลังบันทึก...
                  </div>
                ) : (
                  <div className="flex items-center justify-center">
                    <Save className="w-4 h-4 mr-2" />
                    {editingUnit ? 'บันทึกการแก้ไข' : 'เพิ่มยูนิต'}
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    ยืนยันการลบโครงการ
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <Card className="border-2 border-purple-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <Building2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900 text-sm">โครงการที่จะลบ</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-medium text-gray-800">
                      {selectedProperty?.name}
                    </p>
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                          การลบโครงการนี้จะลบข้อมูลยูนิตและข้อมูลที่เกี่ยวข้องทั้งหมด
                          <strong> ไม่สามารถกู้คืนได้</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteProperty}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบโครงการ
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Unit Detail Dialog */}
        <Dialog open={showUnitDetailDialog} onOpenChange={setShowUnitDetailDialog}>
          <DialogContent className="sm:max-w-[950px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold gradient-primary-text">
                    ยูนิต {viewingUnit?.unit_number}
                  </DialogTitle>
                  <DialogDescription className="text-base mt-1">
                    {selectedProperty?.name}
                  </DialogDescription>
                </div>
                {viewingUnit && getUnitStatusBadge(viewingUnit.status)}
              </div>
            </DialogHeader>
            {viewingUnit && (
              <div className="space-y-5 py-2">
                {/* Images */}
                {viewingUnit.images && viewingUnit.images.length > 0 && (
                  <Card className="overflow-hidden border-2">
                    <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 pb-3">
                      <CardTitle className="text-base font-semibold text-[#676AF1]">
                        รูปภาพยูนิต
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <div className="grid grid-cols-3 gap-3">
                        {viewingUnit.images.map((img, index) => (
                          <img
                            key={index}
                            src={img}
                            alt={`Unit image ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border-2 border-gray-100 hover:border-[#676AF1] transition-all cursor-pointer shadow-sm"
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Basic Information */}
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 pb-3">
                    <CardTitle className="text-base font-semibold text-green-700 flex items-center gap-2">
                      <Building2 className="w-5 h-5" />
                      ข้อมูลพื้นฐาน
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-lg">
                        <p className="text-xs font-medium text-blue-700 mb-1">เลขที่ยูนิต</p>
                        <p className="text-xl font-bold text-blue-900">{viewingUnit.unit_number}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-lg">
                        <p className="text-xs font-medium text-purple-700 mb-1">ชั้น</p>
                        <p className="text-xl font-bold text-purple-900">{viewingUnit.floor_number || '-'}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-lg">
                        <p className="text-xs font-medium text-orange-700 mb-1">พื้นที่ใช้สอย</p>
                        <p className="text-xl font-bold text-orange-900">{viewingUnit.area_sqm ? `${viewingUnit.area_sqm} ตร.ม.` : '-'}</p>
                      </div>
                      <div className="p-3 bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg">
                        <p className="text-xs font-medium text-green-700 mb-1">ราคา</p>
                        <p className="text-xl font-bold text-green-900">{formatCurrency(viewingUnit.price)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Room Details */}
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-indigo-50 to-blue-50 pb-3">
                    <CardTitle className="text-base font-semibold text-indigo-700 flex items-center gap-2">
                      <Home className="w-5 h-5" />
                      รายละเอียดห้อง
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-pink-50 to-pink-100/50 rounded-lg border border-pink-200">
                        <div className="p-2 bg-white rounded-lg">
                          <Bed className="w-6 h-6 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-pink-700">ห้องนอน</p>
                          <p className="text-2xl font-bold text-pink-900">{viewingUnit.bedrooms}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-cyan-50 to-cyan-100/50 rounded-lg border border-cyan-200">
                        <div className="p-2 bg-white rounded-lg">
                          <Bath className="w-6 h-6 text-cyan-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-cyan-700">ห้องน้ำ</p>
                          <p className="text-2xl font-bold text-cyan-900">{viewingUnit.bathrooms}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-gradient-to-br from-amber-50 to-amber-100/50 rounded-lg border border-amber-200">
                        <div className="p-2 bg-white rounded-lg">
                          <Square className="w-6 h-6 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-amber-700">ราคา/ตร.ม.</p>
                          <p className="text-lg font-bold text-amber-900">{viewingUnit.price_per_sqm ? formatCurrency(viewingUnit.price_per_sqm) : '-'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Info */}
                    {viewingUnit.layout_description && (
                      <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <p className="text-xs font-semibold text-slate-700 mb-2">รายละเอียดเพิ่มเติม</p>
                        <p className="text-sm text-slate-600 leading-relaxed">{viewingUnit.layout_description}</p>
                      </div>
                    )}

                    {/* Features */}
                    {(viewingUnit.balcony || viewingUnit.garden || viewingUnit.pool || viewingUnit.facing_direction || viewingUnit.building) && (
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-slate-700 mb-2">คุณสมบัติพิเศษ</p>
                        <div className="flex flex-wrap gap-2">
                          {viewingUnit.balcony && (
                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">มีระเบียง</Badge>
                          )}
                          {viewingUnit.garden && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-200">มีสวน</Badge>
                          )}
                          {viewingUnit.pool && (
                            <Badge variant="secondary" className="bg-cyan-100 text-cyan-800 hover:bg-cyan-200">มีสระว่ายน้ำ</Badge>
                          )}
                          {viewingUnit.facing_direction && (
                            <Badge variant="outline" className="border-purple-300 text-purple-700">ทิศ {viewingUnit.facing_direction}</Badge>
                          )}
                          {viewingUnit.building && (
                            <Badge variant="outline" className="border-orange-300 text-orange-700">อาคาร {viewingUnit.building}</Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Leads Interested in This Unit */}
                <Card className="border-2">
                  <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold text-purple-700 flex items-center gap-2">
                        <Users className="w-5 h-5" />
                        Leads ที่สนใจยูนิตนี้
                      </CardTitle>
                      <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                        {unitLeads.length} รายการ
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {unitLeads.length > 0 ? (
                      <div className="border-2 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] hover:from-[#676AF1] hover:to-[#8B5CF6]">
                              <TableHead className="text-white font-semibold">ชื่อลูกค้า</TableHead>
                              <TableHead className="text-white font-semibold">เบอร์โทร</TableHead>
                              <TableHead className="text-white font-semibold">สถานะ</TableHead>
                              <TableHead className="text-white font-semibold">ระดับความสนใจ</TableHead>
                              <TableHead className="text-white font-semibold">พนักงานขาย</TableHead>
                              <TableHead className="text-white font-semibold text-center">ดูข้อมูล</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {unitLeads.map((leadInterest: any) => {
                              const lead = leadInterest.leads;
                              const customer = lead?.customers;
                              const assignedUser = lead?.users;

                              return (
                                <TableRow key={leadInterest.id} className="hover:bg-purple-50/50">
                                  <TableCell className="font-medium">
                                    <div>
                                      <p className="font-semibold text-foreground">{customer?.full_name || '-'}</p>
                                      {customer?.email && (
                                        <p className="text-xs text-muted-foreground mt-0.5">{customer.email}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm">
                                    {customer?.phone || '-'}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        leadInterest.status === 'interested' ? 'default' :
                                        leadInterest.status === 'contacted' ? 'secondary' :
                                        leadInterest.status === 'viewing_scheduled' ? 'outline' :
                                        leadInterest.status === 'negotiating' ? 'outline' :
                                        leadInterest.status === 'reserved' ? 'default' :
                                        leadInterest.status === 'purchased' ? 'default' :
                                        'secondary'
                                      }
                                      className={
                                        leadInterest.status === 'interested' ? 'bg-blue-100 text-blue-800' :
                                        leadInterest.status === 'contacted' ? 'bg-purple-100 text-purple-800' :
                                        leadInterest.status === 'viewing_scheduled' ? 'bg-yellow-100 text-yellow-800' :
                                        leadInterest.status === 'negotiating' ? 'bg-orange-100 text-orange-800' :
                                        leadInterest.status === 'reserved' ? 'bg-indigo-100 text-indigo-800' :
                                        leadInterest.status === 'purchased' ? 'bg-green-100 text-green-800' :
                                        ''
                                      }
                                    >
                                      {leadInterest.status === 'interested' && 'สนใจ'}
                                      {leadInterest.status === 'contacted' && 'ติดต่อแล้ว'}
                                      {leadInterest.status === 'viewing_scheduled' && 'นัดชม'}
                                      {leadInterest.status === 'negotiating' && 'เจรจา'}
                                      {leadInterest.status === 'reserved' && 'จอง'}
                                      {leadInterest.status === 'purchased' && 'ซื้อแล้ว'}
                                      {leadInterest.status === 'lost' && 'เสียโอกาส'}
                                      {!['interested', 'contacted', 'viewing_scheduled', 'negotiating', 'reserved', 'purchased', 'lost'].includes(leadInterest.status) && leadInterest.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant="outline"
                                      className={
                                        leadInterest.interest_level === 'high' ? 'bg-red-50 text-red-700 border-red-300 font-semibold' :
                                        leadInterest.interest_level === 'medium' ? 'bg-yellow-50 text-yellow-700 border-yellow-300 font-semibold' :
                                        leadInterest.interest_level === 'low' ? 'bg-gray-50 text-gray-700 border-gray-300' :
                                        ''
                                      }
                                    >
                                      {leadInterest.interest_level === 'high' && '⭐ สูง'}
                                      {leadInterest.interest_level === 'medium' && '⭐ กลาง'}
                                      {leadInterest.interest_level === 'low' && '⭐ ต่ำ'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <div className="text-sm font-medium text-foreground">
                                      {assignedUser?.full_name || assignedUser?.email || '-'}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex justify-center">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-[#676AF1] hover:text-[#8B5CF6] hover:bg-purple-50"
                                        onClick={() => {
                                          navigate(`/leads/${lead?.id}/cdp`);
                                        }}
                                        title="ดูข้อมูล CDP"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-10 bg-gradient-to-br from-gray-50 to-slate-50 rounded-lg border-2 border-dashed border-gray-300">
                        <User className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm font-medium text-muted-foreground">ยังไม่มี Lead ที่สนใจยูนิตนี้</p>
                        <p className="text-xs text-muted-foreground mt-1">เมื่อมีผู้สนใจจะแสดงที่นี่</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnitDetailDialog(false)}>
                ปิด
              </Button>
              <Button onClick={() => {
                setShowUnitDetailDialog(false);
                if (viewingUnit) handleEditUnit(viewingUnit);
              }}>
                <Edit className="w-4 h-4 mr-2" />
                แก้ไข
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Unit Confirmation Dialog */}
        <Dialog open={showDeleteUnitDialog} onOpenChange={setShowDeleteUnitDialog}>
          <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#676AF1] to-[#8B5CF6] px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-white">
                    ยืนยันการลบยูนิต
                  </DialogTitle>
                  <DialogDescription className="text-purple-100 text-sm mt-0.5">
                    การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <Card className="border-2 border-purple-100 shadow-sm">
                <CardContent className="p-0">
                  <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
                    <div className="p-1.5 bg-purple-500 rounded-lg">
                      <Home className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-purple-900 text-sm">ยูนิตที่จะลบ</h3>
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-lg font-medium text-gray-800">
                      ยูนิต {deletingUnit?.unit_number}
                    </p>
                    <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-red-700">
                          การลบยูนิตนี้จะลบข้อมูลที่เกี่ยวข้องทั้งหมด
                          <strong> ไม่สามารถกู้คืนได้</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t bg-gray-50">
              <Button
                variant="outline"
                onClick={() => setShowDeleteUnitDialog(false)}
                className="flex-1"
              >
                ยกเลิก
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteUnit}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                ลบยูนิต
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Add Lead Modal */}
        <AddLeadModal
          isOpen={showAddLeadModal}
          onClose={() => {
            setShowAddLeadModal(false);
            setSelectedUnitForLead(null);
          }}
          onLeadCreated={handleLeadCreated}
          initialPropertyId={selectedUnitForLead?.propertyId}
          initialUnitId={selectedUnitForLead?.unitId}
        />
            </div>
          </ViewPropertiesGuard>
        </main>
      </div>
    </div>
  );
};

export default PropertyManagement;
