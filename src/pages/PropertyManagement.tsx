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
  Filter
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';

interface Property {
  id: string;
  tenant_id: string;
  name: string;
  type: 'apartment' | 'house' | 'villa' | 'condo' | 'commercial';
  description: string;
  address: Record<string, any>;
  base_price: number;
  currency: string;
  max_guests: number;
  bedrooms: number;
  bathrooms: number;
  size_sqft: number;
  images: string[];
  is_active: boolean;
  created_at: string;
}

interface Unit {
  id: string;
  property_id: string;
  unit_number: string;
  floor: number;
  size_sqft: number;
  bedrooms: number;
  bathrooms: number;
  price: number;
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
    floor: 1,
    size_sqft: '',
    bedrooms: 1,
    bathrooms: 1,
    price: '',
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
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('tenant_id', currentTenant?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProperties(data || []);

      // Select first property by default
      if (data && data.length > 0 && !selectedProperty) {
        setSelectedProperty(data[0]);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnits = async (propertyId: string) => {
    try {
      // Mock units data - in real app, fetch from units table
      const mockUnits: Unit[] = [
        { id: '1', property_id: propertyId, unit_number: 'A101', floor: 1, size_sqft: 45, bedrooms: 1, bathrooms: 1, price: 2500000, status: 'available' },
        { id: '2', property_id: propertyId, unit_number: 'A102', floor: 1, size_sqft: 45, bedrooms: 1, bathrooms: 1, price: 2500000, status: 'reserved' },
        { id: '3', property_id: propertyId, unit_number: 'A201', floor: 2, size_sqft: 55, bedrooms: 2, bathrooms: 1, price: 3200000, status: 'sold' },
        { id: '4', property_id: propertyId, unit_number: 'B101', floor: 1, size_sqft: 80, bedrooms: 3, bathrooms: 2, price: 5500000, status: 'available' },
        { id: '5', property_id: propertyId, unit_number: 'B201', floor: 2, size_sqft: 85, bedrooms: 3, bathrooms: 2, price: 5800000, status: 'available' },
      ];
      setUnits(mockUnits);
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

  const handleSaveUnit = async () => {
    try {
      const unitData = {
        property_id: selectedProperty?.id,
        unit_number: unitForm.unit_number,
        floor: unitForm.floor,
        size_sqft: parseFloat(unitForm.size_sqft),
        bedrooms: unitForm.bedrooms,
        bathrooms: unitForm.bathrooms,
        price: parseFloat(unitForm.price),
        status: unitForm.status
      };

      if (editingUnit) {
        // await supabase.from('units').update(unitData).eq('id', editingUnit.id);
      } else {
        // await supabase.from('units').insert(unitData);
      }

      setShowUnitDialog(false);
      setEditingUnit(null);
      resetUnitForm();
      fetchUnits(selectedProperty!.id);
    } catch (error) {
      console.error('Error saving unit:', error);
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
    setUnitForm({
      unit_number: '',
      floor: 1,
      size_sqft: '',
      bedrooms: 1,
      bathrooms: 1,
      price: '',
      status: 'available'
    });
  };

  const getPropertyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      apartment: 'อพาร์ตเมนท์',
      house: 'บ้านเดี่ยว',
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

  // Calculate stats
  const totalUnits = units.length;
  const availableUnits = units.filter(u => u.status === 'available').length;
  const soldUnits = units.filter(u => u.status === 'sold').length;
  const totalValue = units.reduce((sum, u) => sum + u.price, 0);

  if (!currentTenant) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>กรุณาเลือกบริษัทก่อน</p>
        </div>
      </div>
    );
  }

  return (
    <AdminGuard>
      <div className="min-h-screen bg-background">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <div className="lg:ml-[260px] min-h-screen">
          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <main className="p-6">
            <div className="space-y-6">
              {/* Page Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">โครงการและยูนิต</h1>
                  <p className="text-muted-foreground">
                    จัดการโครงการอสังหาและยูนิตทั้งหมดของบริษัท
                  </p>
                </div>
                <Button onClick={() => {
                  resetPropertyForm();
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
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ยูนิตว่าง
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">-</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    ขายแล้ว
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">-</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    มูลค่ารวม
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">-</div>
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
                      <SelectItem value="house">บ้านเดี่ยว</SelectItem>
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
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedProperty(property)}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{property.name}</CardTitle>
                          <CardDescription className="flex items-center gap-1 mt-1">
                            <MapPin className="w-3 h-3" />
                            {property.address?.district || '-'} {property.address?.province ? `, ${property.address.province}` : ''}
                          </CardDescription>
                        </div>
                        <Badge variant="outline">
                          {getPropertyTypeLabel(property.type)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Bed className="w-4 h-4" />
                            {property.bedrooms} ห้องนอน
                          </div>
                          <div className="flex items-center gap-1">
                            <Bath className="w-4 h-4" />
                            {property.bathrooms} ห้องน้ำ
                          </div>
                          <div className="flex items-center gap-1">
                            <Square className="w-4 h-4" />
                            {property.size_sqft.toLocaleString()} ตร.ม.
                          </div>
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
                      setPropertyForm({
                        name: selectedProperty.name,
                        type: selectedProperty.type,
                        description: selectedProperty.description,
                        address: selectedProperty.address?.street || '',
                        province: selectedProperty.address?.province || '',
                        district: selectedProperty.address?.district || '',
                        base_price: String(selectedProperty.base_price),
                        max_guests: selectedProperty.max_guests,
                        bedrooms: selectedProperty.bedrooms,
                        bathrooms: selectedProperty.bathrooms,
                        size_sqft: String(selectedProperty.size_sqft)
                      });
                      setShowPropertyDialog(true);
                    }}>
                      <Edit className="w-4 h-4 mr-2" />
                      แก้ไข
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setShowDeleteDialog(true)}>
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
                          <TableCell>ชั้น {unit.floor}</TableCell>
                          <TableCell>{unit.size_sqft.toLocaleString()} ตร.ม.</TableCell>
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

        {/* Property Dialog */}
        <Dialog open={showPropertyDialog} onOpenChange={setShowPropertyDialog}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingProperty ? 'แก้ไขโครงการ' : 'เพิ่มโครงการใหม่'}
              </DialogTitle>
              <DialogDescription>
                กรอกข้อมูลโครงการอสังหาริมทรัพย์
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">ชื่อโครงการ *</Label>
                  <Input
                    id="name"
                    value={propertyForm.name}
                    onChange={(e) => setPropertyForm({ ...propertyForm, name: e.target.value })}
                    placeholder="เช่น คอนโด ลุมพินี"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">ประเภท *</Label>
                  <Select
                    value={propertyForm.type}
                    onValueChange={(value: any) => setPropertyForm({ ...propertyForm, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="condo">คอนโด</SelectItem>
                      <SelectItem value="house">บ้านเดี่ยว</SelectItem>
                      <SelectItem value="villa">วิลล่า</SelectItem>
                      <SelectItem value="apartment">อพาร์ตเมนท์</SelectItem>
                      <SelectItem value="commercial">อาคารพาณิชย์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  value={propertyForm.description}
                  onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                  placeholder="อธิบายรายละเอียดเกี่ยวกับโครงการ..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address">ที่อยู่</Label>
                  <Input
                    id="address"
                    value={propertyForm.address}
                    onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                    placeholder="เลขที่"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="district">แขวง/อำเภอ</Label>
                  <Input
                    id="district"
                    value={propertyForm.district}
                    onChange={(e) => setPropertyForm({ ...propertyForm, district: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="province">จังหวัด</Label>
                  <Input
                    id="province"
                    value={propertyForm.province}
                    onChange={(e) => setPropertyForm({ ...propertyForm, province: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bedrooms">ห้องนอน</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={propertyForm.bedrooms}
                    onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bathrooms">ห้องน้ำ</Label>
                  <Input
                    id="bathrooms"
                    type="number"
                    value={propertyForm.bathrooms}
                    onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">ขนาด (ตร.ม.)</Label>
                  <Input
                    id="size"
                    type="number"
                    value={propertyForm.size_sqft}
                    onChange={(e) => setPropertyForm({ ...propertyForm, size_sqft: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">ราคาเริ่มต้น</Label>
                  <Input
                    id="price"
                    type="number"
                    value={propertyForm.base_price}
                    onChange={(e) => setPropertyForm({ ...propertyForm, base_price: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPropertyDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveProperty}>
                {editingProperty ? 'บันทึก' : 'สร้างโครงการ'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unit Dialog */}
        <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingUnit ? 'แก้ไขยูนิต' : 'เพิ่มยูนิตใหม่'}
              </DialogTitle>
              <DialogDescription>
                {selectedProperty?.name} - เพิ่มยูนิตใหม่
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_number">เลขที่ยูนิต *</Label>
                  <Input
                    id="unit_number"
                    value={unitForm.unit_number}
                    onChange={(e) => setUnitForm({ ...unitForm, unit_number: e.target.value })}
                    placeholder="เช่น A101"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="floor">ชั้น</Label>
                  <Input
                    id="floor"
                    type="number"
                    value={unitForm.floor}
                    onChange={(e) => setUnitForm({ ...unitForm, floor: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_bedrooms">ห้องนอน</Label>
                  <Input
                    id="unit_bedrooms"
                    type="number"
                    value={unitForm.bedrooms}
                    onChange={(e) => setUnitForm({ ...unitForm, bedrooms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_bathrooms">ห้องน้ำ</Label>
                  <Input
                    id="unit_bathrooms"
                    type="number"
                    value={unitForm.bathrooms}
                    onChange={(e) => setUnitForm({ ...unitForm, bathrooms: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit_size">ขนาด (ตร.ม.)</Label>
                  <Input
                    id="unit_size"
                    type="number"
                    value={unitForm.size_sqft}
                    onChange={(e) => setUnitForm({ ...unitForm, size_sqft: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="unit_price">ราคาขาย *</Label>
                  <Input
                    id="unit_price"
                    type="number"
                    value={unitForm.price}
                    onChange={(e) => setUnitForm({ ...unitForm, price: e.target.value })}
                    placeholder="2500000"
                  />
                </div>
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
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUnitDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSaveUnit}>
                {editingUnit ? 'บันทึก' : 'เพิ่มยูนิต'}
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
          </main>
        </div>
      </div>
    </AdminGuard>
  );
};

export default PropertyManagement;
