import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { OwnerGuard } from '@/components/auth/PermissionGuard';
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
import { Badge } from '@/components/ui/badge';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Building2,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Users,
  CreditCard,
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

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscription_plan: 'starter' | 'professional' | 'enterprise';
  max_properties: number;
  max_users: number;
  created_at: string;
  trial_ends_at?: string;
  settings?: Record<string, any>;
}

interface TenantStats {
  id: string;
  userCount: number;
  propertyCount: number;
}

const TenantManagement = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'trial' as Tenant['status'],
    subscription_plan: 'starter' as Tenant['subscription_plan'],
    max_properties: 10,
    max_users: 5
  });

  useEffect(() => {
    fetchTenants();
    fetchTenantStats();
  }, []);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantStats = async () => {
    try {
      // Get user count per tenant
      const { data: users } = await supabase
        .from('users')
        .select('tenant_id');

      // Get property count per tenant
      const { data: properties } = await supabase
        .from('properties')
        .select('tenant_id');

      const stats: Record<string, TenantStats> = {};

      users?.forEach(user => {
        stats[user.tenant_id] = {
          id: user.tenant_id,
          userCount: (stats[user.tenant_id]?.userCount || 0) + 1,
          propertyCount: 0
        };
      });

      properties?.forEach(property => {
        if (stats[property.tenant_id]) {
          stats[property.tenant_id].propertyCount++;
        } else {
          stats[property.tenant_id] = {
            id: property.tenant_id,
            userCount: 0,
            propertyCount: 1
          };
        }
      });

      setTenantStats(stats);
    } catch (error) {
      console.error('Error fetching tenant stats:', error);
    }
  };

  const handleCreateTenant = async () => {
    try {
      // Calculate trial end date (14 days from now)
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14);

      const { data, error } = await supabase
        .from('tenants')
        .insert({
          name: formData.name,
          slug: formData.slug.toLowerCase().replace(/\s+/g, '-'),
          status: formData.status,
          subscription_plan: formData.subscription_plan,
          max_properties: formData.max_properties,
          max_users: formData.max_users,
          trial_ends_at: trialEndsAt.toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      // Create first admin user for this tenant
      // This would typically be done via invitation
      setShowCreateDialog(false);
      resetForm();
      fetchTenants();
    } catch (error) {
      console.error('Error creating tenant:', error);
    }
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          name: formData.name,
          status: formData.status,
          subscription_plan: formData.subscription_plan,
          max_properties: formData.max_properties,
          max_users: formData.max_users
        })
        .eq('id', selectedTenant.id);

      if (error) throw error;

      setShowEditDialog(false);
      setSelectedTenant(null);
      resetForm();
      fetchTenants();
    } catch (error) {
      console.error('Error updating tenant:', error);
    }
  };

  const handleDeleteTenant = async () => {
    if (!selectedTenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', selectedTenant.id);

      if (error) throw error;

      setShowDeleteDialog(false);
      setSelectedTenant(null);
      fetchTenants();
    } catch (error) {
      console.error('Error deleting tenant:', error);
    }
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      subscription_plan: tenant.subscription_plan,
      max_properties: tenant.max_properties,
      max_users: tenant.max_users
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      status: 'trial',
      subscription_plan: 'starter',
      max_properties: 10,
      max_users: 5
    });
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      active: { label: 'Active', variant: 'default' },
      trial: { label: 'Trial', variant: 'secondary' },
      suspended: { label: 'ระงับ', variant: 'destructive' },
      cancelled: { label: 'ยกเลิก', variant: 'outline' }
    };
    const badge = badges[status] || { label: status, variant: 'outline' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const getPlanBadge = (plan: string) => {
    const colors: Record<string, string> = {
      starter: 'bg-gray-100 text-gray-800',
      professional: 'bg-blue-100 text-blue-800',
      enterprise: 'bg-purple-100 text-purple-800'
    };
    const labels: Record<string, string> = {
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise'
    };
    return (
      <Badge className={colors[plan] || 'bg-gray-100'}>
        {labels[plan] || plan}
      </Badge>
    );
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tenant.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    const matchesPlan = planFilter === 'all' || tenant.subscription_plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const getPlanPrice = (plan: string) => {
    const prices: Record<string, string> = {
      starter: '฿2,900',
      professional: '฿5,900',
      enterprise: '฿15,900'
    };
    return prices[plan] || '-';
  };

  return (
    <OwnerGuard>
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
                  <h1 className="text-3xl font-bold tracking-tight">จัดการบริษัท (Tenants)</h1>
                  <p className="text-muted-foreground">
                    จัดการบริษัททั้งหมดในระบบ SaaS
                  </p>
                </div>
                <Button onClick={() => {
                  resetForm();
                  setShowCreateDialog(true);
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  เพิ่มบริษัทใหม่
                </Button>
              </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                บริษัททั้งหมด
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{tenants.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {tenants.filter(t => t.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Trial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {tenants.filter(t => t.status === 'trial').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MRR รวม
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ฿{tenants.reduce((sum, t) => {
                  const prices = { starter: 2900, professional: 5900, enterprise: 15900 };
                  return sum + (prices[t.subscription_plan] || 0);
                }, 0).toLocaleString()}
              </div>
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
                  placeholder="ค้นหาบริษัท..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="สถานะ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกสถานะ</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="suspended">ระงับ</SelectItem>
                  <SelectItem value="cancelled">ยกเลิก</SelectItem>
                </SelectContent>
              </Select>
              <Select value={planFilter} onValueChange={setPlanFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="แพ็กเกจ" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกแพ็กเกจ</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tenants Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ชื่อบริษัท</TableHead>
                  <TableHead>สถานะ</TableHead>
                  <TableHead>แพ็กเกจ</TableHead>
                  <TableHead>ผู้ใช้</TableHead>
                  <TableHead>โครงการ</TableHead>
                  <TableHead>ราคา/เดือน</TableHead>
                  <TableHead>สร้างเมื่อ</TableHead>
                  <TableHead className="text-right">ดำเนินการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      กำลังโหลด...
                    </TableCell>
                  </TableRow>
                ) : filteredTenants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      ไม่พบบริษัท
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTenants.map((tenant) => {
                    const stats = tenantStats[tenant.id];
                    return (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{tenant.name}</div>
                            <div className="text-sm text-muted-foreground">/{tenant.slug}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                        <TableCell>{getPlanBadge(tenant.subscription_plan)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            {stats?.userCount || 0} / {tenant.max_users}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {stats?.propertyCount || 0} / {tenant.max_properties}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {getPlanPrice(tenant.subscription_plan)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(tenant.created_at).toLocaleDateString('th-TH')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/tenants/${tenant.id}`)}>
                                <Eye className="w-4 h-4 mr-2" />
                                ดูรายละเอียด
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/billing/${tenant.id}`)}>
                                <CreditCard className="w-4 h-4 mr-2" />
                                ดู Billing
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openEditDialog(tenant)}>
                                <Edit className="w-4 h-4 mr-2" />
                                แก้ไข
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedTenant(tenant);
                                  setShowDeleteDialog(true);
                                }}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                ลบ
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>เพิ่มบริษัทใหม่</DialogTitle>
              <DialogDescription>
                สร้างบริษัทใหม่ในระบบ SaaS และกำหนดแพ็กเกจ subscription
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">ชื่อบริษัท *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น บริษัท เอบีซี จำกัด"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Slug (URL) *</Label>
                <Input
                  id="slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  placeholder="abc-company"
                />
                <p className="text-xs text-muted-foreground">
                  ใช้สำหรับ URL: chateau.platform.com/{formData.slug || 'company'}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="plan">แพ็กเกจ *</Label>
                  <Select
                    value={formData.subscription_plan}
                    onValueChange={(value: any) => setFormData({ ...formData, subscription_plan: value })}
                  >
                    <SelectTrigger id="plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (฿2,900)</SelectItem>
                      <SelectItem value="professional">Professional (฿5,900)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (฿15,900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">สถานะ *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial (14 วัน)</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="maxProperties">จำนวนโครงการสูงสุด</Label>
                  <Input
                    id="maxProperties"
                    type="number"
                    value={formData.max_properties}
                    onChange={(e) => setFormData({ ...formData, max_properties: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxUsers">จำนวนผู้ใช้สูงสุด</Label>
                  <Input
                    id="maxUsers"
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleCreateTenant}>
                สร้างบริษัท
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>แก้ไขบริษัท</DialogTitle>
              <DialogDescription>
                แก้ไขข้อมูลและแพ็กเกจของ {selectedTenant?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">ชื่อบริษัท *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-plan">แพ็กเกจ *</Label>
                  <Select
                    value={formData.subscription_plan}
                    onValueChange={(value: any) => setFormData({ ...formData, subscription_plan: value })}
                  >
                    <SelectTrigger id="edit-plan">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="starter">Starter (฿2,900)</SelectItem>
                      <SelectItem value="professional">Professional (฿5,900)</SelectItem>
                      <SelectItem value="enterprise">Enterprise (฿15,900)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-status">สถานะ *</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: any) => setFormData({ ...formData, status: value })}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">ระงับ</SelectItem>
                      <SelectItem value="cancelled">ยกเลิก</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-maxProperties">จำนวนโครงการสูงสุด</Label>
                  <Input
                    id="edit-maxProperties"
                    type="number"
                    value={formData.max_properties}
                    onChange={(e) => setFormData({ ...formData, max_properties: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-maxUsers">จำนวนผู้ใช้สูงสุด</Label>
                  <Input
                    id="edit-maxUsers"
                    type="number"
                    value={formData.max_users}
                    onChange={(e) => setFormData({ ...formData, max_users: parseInt(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleUpdateTenant}>
                บันทึก
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ยืนยันการลบบริษัท</DialogTitle>
              <DialogDescription>
                คุณต้องการลบบริษัท "{selectedTenant?.name}" ใช่หรือไม่?
                <br /><br />
                <span className="text-red-600 font-medium">
                  การกระทำนี้จะลบข้อมูลทั้งหมดของบริษัทนี้รวมถึงผู้ใช้ โครงการ และข้อมูลอื่นๆ
                  และไม่สามารถกู้คืนได้
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={handleDeleteTenant}>
                ลบบริษัท
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default TenantManagement;
