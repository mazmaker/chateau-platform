import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { toast } from 'sonner';
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
  Filter,
  BarChart3,
  Settings as SettingsIcon,
  Package,
  Info,
  Ban
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import { PageTabs } from '@/components/ui/PageTabs';
import type { TabItem } from '@/components/ui/PageTabs';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscription_plan: 'free' | 'starter' | 'professional' | 'enterprise';
  max_properties: number;
  max_users: number;
  created_at: string;
  trial_ends_at?: string;
  settings?: Record<string, any>;
  // Billing information
  billing_address?: string;
  billing_email?: string;
  billing_phone?: string;
  tax_id?: string;
}

interface TenantStats {
  id: string;
  userCount: number;
  adminCount: number;
  salesCount: number;
  propertyCount: number;
}

interface Invoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  due_date: string;
  paid_at?: string;
  created_at: string;
  subscription_plan: string;
  billing_period: string;
}

interface PackageConfig {
  id: string;
  name: string;
  price: string;
  properties: number;
  users: number;
  adminCount: number;
  salesCount: number;
  features: string[];
}

const TenantManagement = () => {
  const navigate = useNavigate();
  const { user } = useSimpleAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('tenants');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [tenantStats, setTenantStats] = useState<Record<string, TenantStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showBillDialog, setShowBillDialog] = useState(false);
  const [showSuspendDialog, setShowSuspendDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantBills, setTenantBills] = useState<Invoice[]>([]);

  // Package management states
  const [packageConfig, setPackageConfig] = useState<PackageConfig[]>([
    {
      id: 'free',
      name: 'Free',
      price: '0',
      properties: 5,
      users: 3,
      adminCount: 1,
      salesCount: 2,
      features: ['โครงการสูงสุด 5 แห่ง', 'Admin 1 คน + Sales 2 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads']
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '2,900',
      properties: 10,
      users: 5,
      adminCount: 1,
      salesCount: 4,
      features: ['โครงการสูงสุด 10 แห่ง', 'Admin 1 คน + Sales 4 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads']
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '5,900',
      properties: 50,
      users: 10,
      adminCount: 2,
      salesCount: 8,
      features: ['โครงการสูงสุด 50 แห่ง', 'Admin 2 คน + Sales 8 คน', 'ระบบจัดการลูกค้า', 'ระบบ Leads', 'รายงานวิเคราะห์', 'API Access']
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '15,900',
      properties: -1,
      users: 20,
      adminCount: 4,
      salesCount: 16,
      features: ['โครงการไม่จำกัด', 'Admin 4 คน + Sales 16 คน', 'ระบบทั้งหมด', 'รายงานวิเคราะห์ขั้นสู้', 'API Access', 'Support 24/7', 'Custom Development']
    },
  ]);
  const [editingPackage, setEditingPackage] = useState<PackageConfig | null>(null);
  const [showPackageDialog, setShowPackageDialog] = useState(false);
  const [packageFormData, setPackageFormData] = useState<PackageConfig>({
    id: '',
    name: '',
    price: '',
    properties: 10,
    users: 5,
    adminCount: 1,
    salesCount: 4,
    features: []
  });

  // Form state for create/edit
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    status: 'active' as Tenant['status'],
    subscription_plan: 'free' as Tenant['subscription_plan'],
    max_properties: 10,
    max_users: 5,
    billing_address: '',
    billing_email: '',
    billing_phone: '',
    tax_id: ''
  });

  // Track which columns exist in the database to avoid errors
  const [dbColumns, setDbColumns] = useState<Set<string>>(new Set());

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

      // Store which columns exist in the database
      // If we have tenants, extract columns from the first one
      // Otherwise, we'll default to assuming all common columns exist
      if (data && data.length > 0) {
        const columns = new Set(Object.keys(data[0]));
        setDbColumns(columns);
      } else {
        // No tenants yet - assume all standard columns exist in the database
        // These columns should exist after running the migrations
        setDbColumns(new Set([
          'id', 'name', 'slug', 'status', 'subscription_plan',
          'max_properties', 'max_users', 'trial_ends_at',
          'billing_address', 'billing_email', 'billing_phone', 'tax_id',
          'created_at', 'settings'
        ]));
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenantStats = async () => {
    try {
      // Get user count per tenant with role
      const { data: users } = await supabase
        .from('users')
        .select('tenant_id, role');

      // Get property count per tenant
      const { data: properties } = await supabase
        .from('properties')
        .select('tenant_id');

      const stats: Record<string, TenantStats> = {};

      users?.forEach(user => {
        if (!stats[user.tenant_id]) {
          stats[user.tenant_id] = {
            id: user.tenant_id,
            userCount: 0,
            adminCount: 0,
            salesCount: 0,
            propertyCount: 0
          };
        }
        stats[user.tenant_id].userCount++;
        if (user.role === 'admin') {
          stats[user.tenant_id].adminCount++;
        } else if (user.role === 'sales') {
          stats[user.tenant_id].salesCount++;
        }
      });

      properties?.forEach(property => {
        if (stats[property.tenant_id]) {
          stats[property.tenant_id].propertyCount++;
        } else {
          stats[property.tenant_id] = {
            id: property.tenant_id,
            userCount: 0,
            adminCount: 0,
            salesCount: 0,
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
      // Determine status based on subscription plan
      // Free plan = Trial (7 days), other plans = Active
      const isFreePlan = formData.subscription_plan === 'free';
      const status = isFreePlan ? 'trial' : 'active';

      // Calculate trial end date (7 days from now) only for free plan
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 7);

      // Translate Thai to English using LibreTranslate (free, open source)
      const translateThaiToEnglish = async (text: string): Promise<string> => {
        // Check if text contains Thai characters
        const hasThai = /[\u0E00-\u0E7F]/.test(text);
        if (!hasThai) return text; // No translation needed

        try {
          const response = await fetch('https://libretranslate.com/translate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              q: text,
              source: 'th',
              target: 'en',
              format: 'text'
            })
          });

          if (response.ok) {
            const data = await response.json();
            return data.translatedText || text;
          }
        } catch (error) {
          console.log('Translation failed, using original text:', error);
        }
        return text; // Fallback to original if translation fails
      };

      // Generate slug from company name (remove Thai characters, special chars, spaces)
      const generateSlug = (name: string) => {
        return name
          .toLowerCase()
          .replace(/[\u0E00-\u0E7F]/g, '') // Remove Thai characters
          .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and hyphens
          .trim()
          .replace(/\s+/g, '-') // Replace spaces with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .substring(0, 50); // Limit to 50 chars
      };

      // Generate unique slug - if it exists, append a number
      const generateUniqueSlug = async (name: string): Promise<string> => {
        // First, try to translate Thai to English
        const translatedName = await translateThaiToEnglish(name);
        let baseSlug = generateSlug(translatedName);

        // If slug is still empty, generate a random one
        if (!baseSlug || baseSlug === '') {
          baseSlug = 'company-' + Date.now().toString(36);
        }

        let slug = baseSlug;
        let counter = 2;

        // Check if slug already exists
        while (true) {
          const { data: existing } = await supabase
            .from('tenants')
            .select('slug')
            .eq('slug', slug)
            .maybeSingle();

          if (!existing) {
            return slug; // Slug is unique
          }

          // Try with counter
          slug = `${baseSlug}-${counter}`;
          counter++;

          // Safety limit
          if (counter > 100) {
            return `${baseSlug}-${Date.now().toString(36)}`;
          }
        }
      };

      const uniqueSlug = await generateUniqueSlug(formData.name);

      // Build insert object with required fields only
      const insertData: any = {
        name: formData.name,
        slug: uniqueSlug,
        status: status,
        subscription_plan: formData.subscription_plan,
      };

      // Only add max_properties if it exists in the database
      if (dbColumns.has('max_properties')) {
        insertData.max_properties = formData.max_properties;
      }

      // Only add max_users if it exists in the database
      if (dbColumns.has('max_users')) {
        insertData.max_users = formData.max_users;
      }

      // Only add trial_ends_at for free plan
      if (isFreePlan && dbColumns.has('trial_ends_at')) {
        insertData.trial_ends_at = trialEndsAt.toISOString();
      }

      // Only add billing fields if they exist in the database
      if (dbColumns.has('billing_address')) {
        insertData.billing_address = formData.billing_address || null;
      }
      if (dbColumns.has('billing_email')) {
        insertData.billing_email = formData.billing_email || null;
      }
      if (dbColumns.has('billing_phone')) {
        insertData.billing_phone = formData.billing_phone || null;
      }
      if (dbColumns.has('tax_id')) {
        insertData.tax_id = formData.tax_id || null;
      }

      const { data, error } = await supabase
        .from('tenants')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      // Log activity (ignore if function doesn't exist)
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: data.id,
          p_user_id: user?.id,
          p_activity_type: 'tenant_created',
          p_description: `สร้างบริษัทใหม่: ${formData.name}`,
          p_metadata: { tenant_id: data.id, name: formData.name, plan: formData.subscription_plan }
        });
      } catch {
        // Ignore log_activity errors
      }

      // Create first admin user for this tenant
      // This would typically be done via invitation
      setShowCreateDialog(false);
      resetForm();
      fetchTenants();

      // Show success toast
      toast.success('สร้างบริษัทสำเร็จ', {
        description: `เพิ่ม ${formData.name} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('Error creating tenant:', error);
      toast.error('ไม่สามารถสร้างบริษัทได้', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง'
      });
    }
  };

  // Helper function to get changes between old and new data
  const getChangesDescription = (oldData: any, newData: typeof formData): string[] => {
    const changes: string[] = [];
    const fieldLabels: Record<string, string> = {
      name: 'ชื่อบริษัท',
      subscription_plan: 'แพ็กเกจ',
      status: 'สถานะ',
      max_properties: 'จำนวนโครงการสูงสุด',
      max_users: 'จำนวนผู้ใช้สูงสุด',
      billing_address: 'ที่อยู่ออกใบเสร็จ',
      billing_email: 'อีเมลออกใบเสร็จ',
      billing_phone: 'เบอร์โทรออกใบเสร็จ',
      tax_id: 'เลขประจำตัวผู้เสียภาษี'
    };

    // Check each field for changes
    if (oldData.name !== newData.name) {
      changes.push(`${fieldLabels.name}: "${oldData.name}" → "${newData.name}"`);
    }
    if (oldData.subscription_plan !== newData.subscription_plan) {
      changes.push(`${fieldLabels.subscription_plan}: "${oldData.subscription_plan}" → "${newData.subscription_plan}"`);
    }
    if (oldData.status !== newData.status) {
      changes.push(`${fieldLabels.status}: "${oldData.status}" → "${newData.status}"`);
    }
    if (oldData.max_properties !== undefined && oldData.max_properties !== newData.max_properties) {
      changes.push(`${fieldLabels.max_properties}: ${oldData.max_properties} → ${newData.max_properties}`);
    }
    if (oldData.max_users !== undefined && oldData.max_users !== newData.max_users) {
      changes.push(`${fieldLabels.max_users}: ${oldData.max_users} → ${newData.max_users}`);
    }
    if (oldData.billing_address !== newData.billing_address) {
      changes.push(fieldLabels.billing_address);
    }
    if (oldData.billing_email !== newData.billing_email) {
      changes.push(fieldLabels.billing_email);
    }
    if (oldData.billing_phone !== newData.billing_phone) {
      changes.push(fieldLabels.billing_phone);
    }
    if (oldData.tax_id !== newData.tax_id) {
      changes.push(fieldLabels.tax_id);
    }

    return changes;
  };

  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;

    try {
      // Build update object dynamically - only include fields that exist in the database
      // Check what columns actually exist by looking at the selectedTenant object
      const updateData: any = {
        name: formData.name,
        status: formData.status,
        subscription_plan: formData.subscription_plan,
      };

      // Only add max_properties if it exists in the selected tenant
      if (selectedTenant.max_properties !== undefined) {
        updateData.max_properties = formData.max_properties;
      }

      // Only add max_users if it exists in the selected tenant
      if (selectedTenant.max_users !== undefined) {
        updateData.max_users = formData.max_users;
      }

      // Only add billing fields if they exist in the selected tenant
      if (selectedTenant.billing_address !== undefined) {
        updateData.billing_address = formData.billing_address || null;
      }
      if (selectedTenant.billing_email !== undefined) {
        updateData.billing_email = formData.billing_email || null;
      }
      if (selectedTenant.billing_phone !== undefined) {
        updateData.billing_phone = formData.billing_phone || null;
      }
      if (selectedTenant.tax_id !== undefined) {
        updateData.tax_id = formData.tax_id || null;
      }

      // Get changes for activity log
      const changes = getChangesDescription(selectedTenant, formData);

      const { error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', selectedTenant.id);

      if (error) throw error;

      // Log activity with detailed changes
      try {
        let description = `แก้ไขข้อมูลบริษัท: ${formData.name}`;
        if (changes.length > 0) {
          description += ` (${changes.join(', ')})`;
        }

        await supabase.rpc('log_activity', {
          p_tenant_id: selectedTenant.id,
          p_user_id: user?.id,
          p_activity_type: 'tenant_updated',
          p_description: description,
          p_metadata: {
            tenant_id: selectedTenant.id,
            name: formData.name,
            status: formData.status,
            plan: formData.subscription_plan,
            changes: changes
          }
        });
      } catch {
        // Ignore log_activity errors
      }

      setShowEditDialog(false);
      setSelectedTenant(null);
      resetForm();
      fetchTenants();

      // Show success toast
      toast.success('บันทึกข้อมูลบริษัทสำเร็จ', {
        description: `อัปเดตข้อมูล ${formData.name} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('Error updating tenant:', error);
      toast.error('ไม่สามารถบันทึกข้อมูลได้', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง'
      });
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

      // Log activity (ignore if function doesn't exist)
      try {
        await supabase.rpc('log_activity', {
          p_tenant_id: selectedTenant.id,
          p_user_id: user?.id,
          p_activity_type: 'tenant_deleted',
          p_description: `ลบบริษัท: ${selectedTenant.name}`,
          p_metadata: { tenant_id: selectedTenant.id, name: selectedTenant.name }
        });
      } catch {
        // Ignore log_activity errors
      }

      setShowDeleteDialog(false);
      setSelectedTenant(null);
      fetchTenants();

      toast.success('ลบบริษัทสำเร็จ', {
        description: `ลบ ${selectedTenant.name} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('Error deleting tenant:', error);
      toast.error('ไม่สามารถลบบริษัทได้', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง'
      });
    }
  };

  const handleSuspendTenant = async () => {
    if (!selectedTenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'suspended' })
        .eq('id', selectedTenant.id);

      if (error) throw error;

      // Log activity
      await supabase.rpc('log_activity', {
        p_tenant_id: selectedTenant.id,
        p_user_id: user?.id,
        p_activity_type: 'tenant_suspended',
        p_description: `ระงับบริษัท: ${selectedTenant.name}`,
        p_metadata: { tenant_id: selectedTenant.id, name: selectedTenant.name }
      });

      setShowSuspendDialog(false);
      setSelectedTenant(null);
      fetchTenants();

      toast.success('ระงับบริษัทสำเร็จ', {
        description: `ระงับ ${selectedTenant.name} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('Error suspending tenant:', error);
      toast.error('ไม่สามารถระงับบริษัทได้', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง'
      });
    }
  };

  const openDetailDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowDetailDialog(true);
  };

  const openBillDialog = async (tenant: Tenant) => {
    setSelectedTenant(tenant);

    // Fetch bills for this tenant
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching bills:', error);
        setTenantBills([]);
      } else {
        setTenantBills(data || []);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      setTenantBills([]);
    }

    setShowBillDialog(true);
  };

  const openSuspendDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowSuspendDialog(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const openEditDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      name: tenant.name,
      slug: tenant.slug,
      status: tenant.status,
      subscription_plan: tenant.subscription_plan,
      max_properties: tenant.max_properties,
      max_users: tenant.max_users,
      billing_address: tenant.billing_address || '',
      billing_email: tenant.billing_email || '',
      billing_phone: tenant.billing_phone || '',
      tax_id: tenant.tax_id || ''
    });
    setShowEditDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      status: 'active',
      subscription_plan: 'starter',
      max_properties: 10,
      max_users: 5,
      billing_address: '',
      billing_email: '',
      billing_phone: '',
      tax_id: ''
    });
  };

  // Package management functions
  const handleSavePackage = () => {
    if (editingPackage) {
      // Update existing package
      setPackageConfig(packageConfig.map(p =>
        p.id === editingPackage.id ? { ...packageFormData } : p
      ));
    } else {
      // Add new package
      setPackageConfig([...packageConfig, { ...packageFormData }]);
    }
    setShowPackageDialog(false);
    setEditingPackage(null);
  };

  const handleAddFeature = () => {
    const newFeature = prompt('เพิ่มคุณสมบัติใหม่:');
    if (newFeature && newFeature.trim()) {
      setPackageFormData({
        ...packageFormData,
        features: [...packageFormData.features, newFeature.trim()]
      });
    }
  };

  const handleRemoveFeature = (index: number) => {
    setPackageFormData({
      ...packageFormData,
      features: packageFormData.features.filter((_, i) => i !== index)
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

  const getBillStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      paid: { label: 'จ่ายแล้ว', className: 'bg-green-100 text-green-800' },
      pending: { label: 'รอชำระ', className: 'bg-amber-100 text-amber-800' },
      overdue: { label: 'เกินกำหนด', className: 'bg-red-100 text-red-800' },
      cancelled: { label: 'ยกเลิก', className: 'bg-gray-100 text-gray-800' }
    };
    const badge = badges[status] || badges.pending;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const filteredTenants = tenants.filter(tenant => {
    const matchesSearch = tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         tenant.slug.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || tenant.status === statusFilter;
    const matchesPlan = planFilter === 'all' || tenant.subscription_plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  const getPlanPrice = (plan: string): number => {
    const pkg = packageConfig.find(p => p.id === plan);
    return pkg ? parseInt(pkg.price.replace(/,/g, ''), 10) : 0;
  };

  // Define tabs
  const tabs: TabItem[] = [
    { id: 'tenants', label: 'รายการบริษัท', icon: Building2 },
    { id: 'overview', label: 'ภาพรวม', icon: BarChart3 },
    { id: 'packages', label: 'จัดการแพ็กเกจ', icon: Package },
  ];

  // Render Stats Overview Tab
  const renderOverviewTab = () => (
    <div className="space-y-6">
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

      {/* Plan Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>สัดส่วนแพ็กเกจ</CardTitle>
          <CardDescription>จำนวนบริษัทแบ่งตามแพ็กเกจ subscription</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {['starter', 'professional', 'enterprise'].map(plan => {
              const count = tenants.filter(t => t.subscription_plan === plan).length;
              const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
              const colors = {
                starter: 'bg-gray-500',
                professional: 'bg-blue-500',
                enterprise: 'bg-purple-500'
              };
              const labels: Record<string, string> = {
                starter: 'Starter',
                professional: 'Professional',
                enterprise: 'Enterprise'
              };
              const prices: Record<string, string> = {
                starter: '฿2,900',
                professional: '฿5,900',
                enterprise: '฿15,900'
              };
              return (
                <div key={plan} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{labels[plan]} ({prices[plan]})</span>
                    <span className="text-muted-foreground">{count} บริษัท ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[plan]}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Status Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>สถานะบริษัท</CardTitle>
          <CardDescription>จำนวนบริษัทแบ่งตามสถานะ</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {['active', 'trial', 'suspended', 'cancelled'].map(status => {
              const count = tenants.filter(t => t.status === status).length;
              const labels: Record<string, string> = {
                active: 'Active',
                trial: 'Trial',
                suspended: 'ระงับ',
                cancelled: 'ยกเลิก'
              };
              const colors: Record<string, string> = {
                active: 'border-green-500 bg-green-50',
                trial: 'border-orange-500 bg-orange-50',
                suspended: 'border-red-500 bg-red-50',
                cancelled: 'border-gray-500 bg-gray-50'
              };
              return (
                <div key={status} className={`border rounded-lg p-4 ${colors[status]}`}>
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-sm text-muted-foreground">{labels[status]}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render Package Management Tab
  const renderPackageManagementTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>จัดการแพ็กเกจ (Packages)</CardTitle>
              <CardDescription>
                แก้ไข ชื่อ ราคา และคุณสมบัติของแต่ละแพ็กเกจ
              </CardDescription>
            </div>
            <Button onClick={() => {
              setPackageFormData({
                id: `custom_${Date.now()}`,
                name: '',
                price: '',
                properties: 10,
                users: 5,
                adminCount: 1,
                salesCount: 4,
                features: []
              });
              setEditingPackage(null);
              setShowPackageDialog(true);
            }}>
              <Plus className="w-4 h-4 mr-2" />
              เพิ่มแพ็กเกจใหม่
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {packageConfig.map((pkg) => (
              <Card key={pkg.id} className="border-2">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <h3 className="text-xl font-bold">{pkg.name}</h3>
                        <Badge className="text-lg px-3 py-1 bg-green-100 text-green-800">
                          ฿{pkg.price} / เดือน
                        </Badge>
                        <Badge className="text-lg px-3 py-1">
                          {pkg.properties === -1 ? 'ไม่จำกัด' : pkg.properties} โครงการ
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-blue-50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Admin</div>
                          <div className="font-bold text-blue-700">{pkg.adminCount} คน</div>
                        </div>
                        <div className="bg-green-50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">Sales</div>
                          <div className="font-bold text-green-700">{pkg.salesCount} คน</div>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <div className="text-sm text-muted-foreground">รวม</div>
                          <div className="font-bold">{pkg.adminCount + pkg.salesCount} คน</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-2">คุณสมบัติ:</div>
                        <div className="flex flex-wrap gap-2">
                          {pkg.features.map((feature, idx) => (
                            <Badge key={idx} variant="outline" className="text-sm">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPackageFormData({ ...pkg });
                          setEditingPackage(pkg);
                          setShowPackageDialog(true);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        แก้ไข
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm(`ต้องการลบแพ็กเกจ "${pkg.name}" ใช่หรือไม่?`)) {
                            setPackageConfig(packageConfig.filter(p => p.id !== pkg.id));
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render Settings Tab
  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* Info Box */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-800">
            <strong>หมายเหตุ:</strong> แต่ละบริษัทมี <strong>Owner 1 คน</strong> (ไม่นับรวมในแพ็กเกจ)
            จำนวนผู้ใช้ในแพ็กเกจคือ <strong>Admin + Sales</strong> เท่านั้น
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>ตั้งค่าระบบ SaaS</CardTitle>
          <CardDescription>
            ตั้งค่าแพ็กเกจ ราคา และข้อจำกัดของแต่ละแพ็กเกจ
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {packageConfig.map(plan => (
              <Card key={plan.id} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <CardDescription>฿{plan.price} / เดือน</CardDescription>
                    </div>
                    <Badge className="text-lg px-4 py-1">
                      {plan.properties === -1 ? 'ไม่จำกัด' : plan.properties} โครงการ
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* User Breakdown */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm font-medium mb-2">สิทธิ์การใช้งาน</div>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-purple-100 text-purple-800">
                            Owner 1 คน
                          </Badge>
                          <span className="text-xs text-muted-foreground">(ไม่นับรวม)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-blue-100 text-blue-800">
                            Admin {plan.adminCount} คน
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">
                            Sales {plan.salesCount} คน
                          </Badge>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        รวมทั้งหมด: {plan.adminCount + plan.salesCount} คน (Admin + Sales)
                      </div>
                    </div>

                    {/* Features */}
                    <div>
                      <div className="text-sm font-medium mb-2">คุณสมบัติ</div>
                      <ul className="space-y-2">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  // Render Tenants List Tab
  const renderTenantsTab = () => (
    <div className="space-y-6">
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
                <TableHead className="w-[180px]">ผู้ใช้</TableHead>
                <TableHead>โครงการ</TableHead>
                <TableHead>สร้างเมื่อ</TableHead>
                <TableHead className="text-right">ดำเนินการ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    กำลังโหลด...
                  </TableCell>
                </TableRow>
              ) : filteredTenants.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                        <div className="text-sm">
                          Admin {stats?.adminCount || 0} + Sales {stats?.salesCount || 0}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-muted-foreground" />
                          {stats?.propertyCount || 0} / {tenant.max_properties === -1 ? '∞' : tenant.max_properties}
                        </div>
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
                            <DropdownMenuItem onClick={() => openDetailDialog(tenant)}>
                              <Eye className="w-4 h-4 mr-2" />
                              ดูรายละเอียด
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openBillDialog(tenant)}>
                              <CreditCard className="w-4 h-4 mr-2" />
                              ดูบิล
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEditDialog(tenant)}>
                              <Edit className="w-4 h-4 mr-2" />
                              แก้ไข
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => openSuspendDialog(tenant)}
                              className="text-amber-600"
                              disabled={tenant.status === 'suspended'}
                            >
                              <Ban className="w-4 h-4 mr-2" />
                              {tenant.status === 'suspended' ? 'ระงับอยู่' : 'ระงับ'}
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
    </div>
  );

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
            {/* Page Header */}
            <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100 mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">จัดการบริษัท (Tenants)</h1>
                      <p className="text-gray-600 mt-1">
                        จัดการบริษัททั้งหมดในระบบ SaaS
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowCreateDialog(true);
                    }}
                    className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    เพิ่มบริษัทใหม่
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Tabs Layout */}
            <div className="flex flex-col md:flex-row gap-6">
              {/* Left Sidebar - Tabs */}
              <div className="w-full md:w-56">
                <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
              </div>

              {/* Right Content */}
              <div className="flex-1">
                {activeTab === 'tenants' && renderTenantsTab()}
                {activeTab === 'overview' && renderOverviewTab()}
                {activeTab === 'packages' && renderPackageManagementTab()}
                {activeTab === 'settings' && renderSettingsTab()}
              </div>
            </div>

            {/* Dialogs */}
            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>เพิ่มบริษัทใหม่</DialogTitle>
                  <DialogDescription>
                    สร้างบริษัทใหม่ในระบบ SaaS และกำหนดแพ็กเกจ subscription
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="name">ชื่อบริษัท *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="เช่น บริษัท เอบีซี จำกัด"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="plan">แพ็คเกจ *</Label>
                      <Select
                        value={formData.subscription_plan}
                        onValueChange={(value: any) => {
                          const selectedPlan = packageConfig.find(p => p.id === value);
                          setFormData({
                            ...formData,
                            subscription_plan: value,
                            max_properties: selectedPlan?.properties || 10,
                            max_users: selectedPlan?.users || 5
                          });
                        }}
                      >
                        <SelectTrigger id="plan">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {packageConfig.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} (฿{pkg.price}) - Admin {pkg.adminCount} + Sales {pkg.salesCount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const selectedPkg = packageConfig.find(p => p.id === formData.subscription_plan);
                          if (!selectedPkg) return '';
                          return `โครงการสูงสุด ${selectedPkg.properties === -1 ? 'ไม่จำกัด' : selectedPkg.properties} แห่ง, ผู้ใช้ ${selectedPkg.adminCount + selectedPkg.salesCount} คน`;
                        })()}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">สถานะ *</Label>
                      <div className="px-3 py-2 bg-gray-100 text-gray-700 text-xs rounded-md">
                        {(() => {
                          if (formData.subscription_plan === 'free') {
                            return 'Trial 7 วัน - หลังจากนั้นจะระงับการใช้งาน';
                          }
                          return 'Active - พร้อมใช้งานทันที';
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Billing Information Section */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-violet-600" />
                      <h3 className="font-semibold text-gray-900">ข้อมูลสำหรับออกใบเสร็จ</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="billing-address">ที่อยู่บริษัท</Label>
                        <Input
                          id="billing-address"
                          value={formData.billing_address}
                          onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                          placeholder="เช่น 123/45 ถนนสุขุมวิท แขวงคลองเตย เขตวัฒนา กรุงเทพฯ 10110"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="billing-email">อีเมล์สำหรับเสนอใบเสร็จ</Label>
                          <Input
                            id="billing-email"
                            type="email"
                            value={formData.billing_email}
                            onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                            placeholder="billing@company.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="billing-phone">เบอร์โทรศัพท์</Label>
                          <Input
                            id="billing-phone"
                            value={formData.billing_phone}
                            onChange={(e) => setFormData({ ...formData, billing_phone: e.target.value })}
                            placeholder="02-123-4567"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="tax-id">เลขประจำตัวผู้เสียภาษี (ถ้ามี)</Label>
                        <Input
                          id="tax-id"
                          value={formData.tax_id}
                          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                          placeholder="เช่น 0105551234567"
                        />
                        <p className="text-xs text-muted-foreground">
                          ใช้สำหรับออกใบเสร็จ/ใบกำกับภาษี
                        </p>
                      </div>
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
                <div className="space-y-4 py-4 max-h-[70vh] overflow-y-auto">
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
                      <Label htmlFor="edit-plan">แพ็คเกจ *</Label>
                      <Select
                        value={formData.subscription_plan}
                        onValueChange={(value: any) => {
                          const selectedPlan = packageConfig.find(p => p.id === value);
                          setFormData({
                            ...formData,
                            subscription_plan: value,
                            max_properties: selectedPlan?.properties || 10,
                            max_users: selectedPlan?.users || 5
                          });
                        }}
                      >
                        <SelectTrigger id="edit-plan">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {packageConfig.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.name} (฿{pkg.price}) - Admin {pkg.adminCount} + Sales {pkg.salesCount}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const selectedPkg = packageConfig.find(p => p.id === formData.subscription_plan);
                          if (!selectedPkg) return '';
                          return `โครงการสูงสุด ${selectedPkg.properties === -1 ? 'ไม่จำกัด' : selectedPkg.properties} แห่ง, ผู้ใช้ ${selectedPkg.adminCount + selectedPkg.salesCount} คน`;
                        })()}
                      </p>
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

                  {/* Billing Information Section */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-violet-600" />
                      <h3 className="font-semibold text-gray-900">ข้อมูลสำหรับออกใบเสร็จ</h3>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-billing-address">ที่อยู่บริษัท</Label>
                        <Input
                          id="edit-billing-address"
                          value={formData.billing_address}
                          onChange={(e) => setFormData({ ...formData, billing_address: e.target.value })}
                          placeholder="เช่น 123/45 ถนนสุขุมวิท แขวงคลองเตย เขตวัฒนา กรุงเทพฯ 10110"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-billing-email">อีเมล์สำหรับเสนอใบเสร็จ</Label>
                          <Input
                            id="edit-billing-email"
                            type="email"
                            value={formData.billing_email}
                            onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                            placeholder="billing@company.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-billing-phone">เบอร์โทรศัพท์</Label>
                          <Input
                            id="edit-billing-phone"
                            value={formData.billing_phone}
                            onChange={(e) => setFormData({ ...formData, billing_phone: e.target.value })}
                            placeholder="02-123-4567"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-tax-id">เลขประจำตัวผู้เสียภาษี (ถ้ามี)</Label>
                        <Input
                          id="edit-tax-id"
                          value={formData.tax_id}
                          onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                          placeholder="เช่น 0105551234567"
                        />
                        <p className="text-xs text-muted-foreground">
                          ใช้สำหรับออกใบเสร็จ/ใบกำกับภาษี
                        </p>
                      </div>
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

            {/* Package Edit/Create Dialog */}
            <Dialog open={showPackageDialog} onOpenChange={setShowPackageDialog}>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>
                    {editingPackage ? 'แก้ไขแพ็กเกจ' : 'เพิ่มแพ็กเกจใหม่'}
                  </DialogTitle>
                  <DialogDescription>
                    {editingPackage
                      ? 'แก้ไขข้อมูลแพ็กเกจ subscription'
                      : 'สร้างแพ็กเกจ subscription ใหม่'}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  {/* Package ID */}
                  <div className="space-y-2">
                    <Label htmlFor="pkgId">รหัสแพ็กเกจ (ID) *</Label>
                    <Input
                      id="pkgId"
                      value={packageFormData.id}
                      onChange={(e) => setPackageFormData({ ...packageFormData, id: e.target.value })}
                      placeholder="เช่น starter, professional, enterprise"
                      disabled={!!editingPackage}
                    />
                    <p className="text-xs text-muted-foreground">
                      รหัสพิเศษสำหรับอ้างอิงในระบบ (ไม่สามารถเปลี่ยนหลังจากสร้างแล้ว)
                    </p>
                  </div>

                  {/* Package Name */}
                  <div className="space-y-2">
                    <Label htmlFor="pkgName">ชื่อแพ็กเกจ *</Label>
                    <Input
                      id="pkgName"
                      value={packageFormData.name}
                      onChange={(e) => setPackageFormData({ ...packageFormData, name: e.target.value })}
                      placeholder="เช่น Starter, Professional, Enterprise"
                    />
                  </div>

                  {/* Price */}
                  <div className="space-y-2">
                    <Label htmlFor="pkgPrice">ราคาต่อเดือน (บาท) *</Label>
                    <Input
                      id="pkgPrice"
                      value={packageFormData.price}
                      onChange={(e) => setPackageFormData({ ...packageFormData, price: e.target.value })}
                      placeholder="เช่น 2,900"
                    />
                  </div>

                  {/* Properties Limit */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pkgProperties">จำนวนโครงการสูงสุด</Label>
                      <Input
                        id="pkgProperties"
                        type="number"
                        value={packageFormData.properties === -1 ? '' : packageFormData.properties}
                        onChange={(e) => setPackageFormData({
                          ...packageFormData,
                          properties: e.target.value ? parseInt(e.target.value) : -1
                        })}
                        placeholder="-1 สำหรับไม่จำกัด"
                      />
                      <p className="text-xs text-muted-foreground">
                        ใส่ -1 หรือปล่อยว่างสำหรับไม่จำกัด
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pkgUsers">จำนวนผู้ใช้ทั้งหมด</Label>
                      <Input
                        id="pkgUsers"
                        type="number"
                        value={packageFormData.users}
                        onChange={(e) => setPackageFormData({ ...packageFormData, users: parseInt(e.target.value) || 0 })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Admin + Sales (Owner ไม่นับรวม)
                      </p>
                    </div>
                  </div>

                  {/* Admin/Sales Breakdown */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pkgAdmin">จำนวน Admin</Label>
                      <Input
                        id="pkgAdmin"
                        type="number"
                        value={packageFormData.adminCount}
                        onChange={(e) => setPackageFormData({
                          ...packageFormData,
                          adminCount: parseInt(e.target.value) || 0,
                          users: (parseInt(e.target.value) || 0) + packageFormData.salesCount
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pkgSales">จำนวน Sales</Label>
                      <Input
                        id="pkgSales"
                        type="number"
                        value={packageFormData.salesCount}
                        onChange={(e) => setPackageFormData({
                          ...packageFormData,
                          salesCount: parseInt(e.target.value) || 0,
                          users: packageFormData.adminCount + (parseInt(e.target.value) || 0)
                        })}
                      />
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>สรุป:</strong> Admin {packageFormData.adminCount} คน + Sales {packageFormData.salesCount} คน = ทั้งหมด {packageFormData.adminCount + packageFormData.salesCount} คน (Owner 1 คน ไม่นับรวม)
                    </p>
                  </div>

                  {/* Features */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>คุณสมบัติ (Features)</Label>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddFeature}>
                        <Plus className="w-4 h-4 mr-1" />
                        เพิ่ม
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {packageFormData.features.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          ยังไม่มีคุณสมบัติ คลิก "เพิ่ม" เพื่อเพิ่มคุณสมบัติ
                        </p>
                      ) : (
                        packageFormData.features.map((feature, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <Input
                              value={feature}
                              onChange={(e) => {
                                const newFeatures = [...packageFormData.features];
                                newFeatures[idx] = e.target.value;
                                setPackageFormData({
                                  ...packageFormData,
                                  features: newFeatures
                                });
                              }}
                              placeholder="ระบุคุณสมบัติ"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRemoveFeature(idx)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowPackageDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button
                    onClick={handleSavePackage}
                    disabled={!packageFormData.name || !packageFormData.price || !packageFormData.id}
                  >
                    {editingPackage ? 'บันทึกการแก้ไข' : 'สร้างแพ็กเกจ'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Company Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>รายละเอียดบริษัท</DialogTitle>
                  <DialogDescription>
                    ข้อมูลทั้งหมดของ {selectedTenant?.name}
                  </DialogDescription>
                </DialogHeader>
                {selectedTenant && (
                  <div className="space-y-6 py-4">
                    {/* Company Info */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-violet-600" />
                        ข้อมูลบริษัท
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">ชื่อบริษัท</p>
                          <p className="font-medium">{selectedTenant.name}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Slug</p>
                          <p className="font-medium font-mono">{selectedTenant.slug}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">สถานะ</p>
                          <div>{getStatusBadge(selectedTenant.status)}</div>
                        </div>
                        <div>
                          <p className="text-gray-500">แพ็คเกจ</p>
                          <div>{getPlanBadge(selectedTenant.subscription_plan)}</div>
                        </div>
                        <div>
                          <p className="text-gray-500">สร้างเมื่อ</p>
                          <p className="font-medium">{new Date(selectedTenant.created_at).toLocaleDateString('th-TH')}</p>
                        </div>
                        {selectedTenant.trial_ends_at && (
                          <div>
                            <p className="text-gray-500">Trial สิ้นสุด</p>
                            <p className="font-medium">{new Date(selectedTenant.trial_ends_at).toLocaleDateString('th-TH')}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Usage */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <BarChart3 className="w-5 h-5 text-violet-600" />
                        การใช้งาน
                      </h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">โครงการ</p>
                          <p className="font-medium">
                            {tenantStats[selectedTenant.id]?.propertyCount || 0} / {selectedTenant.max_properties === -1 ? 'ไม่จำกัด' : selectedTenant.max_properties}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-500">ผู้ใช้</p>
                          <p className="font-medium">
                            {tenantStats[selectedTenant.id]?.userCount || 0} / {selectedTenant.max_users}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Billing Info */}
                    <div className="space-y-3">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-violet-600" />
                        ข้อมูลสำหรับออกใบเสร็จ
                      </h3>
                      <div className="space-y-2 text-sm">
                        {selectedTenant.billing_address && (
                          <div>
                            <p className="text-gray-500">ที่อยู่</p>
                            <p className="font-medium">{selectedTenant.billing_address}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-4">
                          {selectedTenant.billing_email && (
                            <div>
                              <p className="text-gray-500">อีเมล์</p>
                              <p className="font-medium">{selectedTenant.billing_email}</p>
                            </div>
                          )}
                          {selectedTenant.billing_phone && (
                            <div>
                              <p className="text-gray-500">เบอร์โทร</p>
                              <p className="font-medium">{selectedTenant.billing_phone}</p>
                            </div>
                          )}
                        </div>
                        {selectedTenant.tax_id && (
                          <div>
                            <p className="text-gray-500">เลขประจำตัวผู้เสียภาษี</p>
                            <p className="font-medium">{selectedTenant.tax_id}</p>
                          </div>
                        )}
                        {!selectedTenant.billing_address && !selectedTenant.billing_email && !selectedTenant.billing_phone && !selectedTenant.tax_id && (
                          <p className="text-gray-400 italic">ไม่มีข้อมูล</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={() => setShowDetailDialog(false)}>
                    ปิด
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Bill History Dialog */}
            <Dialog open={showBillDialog} onOpenChange={setShowBillDialog}>
              <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>ประวัติการชำระเงิน</DialogTitle>
                  <DialogDescription>
                    ประวัติบิลและสถานะการชำระเงินของ {selectedTenant?.name}
                  </DialogDescription>
                </DialogHeader>
                {selectedTenant && (
                  <div className="space-y-4 py-4">
                    {/* Current Plan Info */}
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">แพ็คเกจปัจจุบัน</p>
                          <p className="font-semibold text-lg">{getPlanBadge(selectedTenant.subscription_plan)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">ค่าบริการต่อเดือน</p>
                          <p className="font-semibold text-lg text-violet-600">
                            {formatCurrency(getPlanPrice(selectedTenant.subscription_plan))}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bill History Table */}
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3">ประวัติบิล</h3>
                      {tenantBills.length === 0 ? (
                        <div className="border rounded-lg p-8 text-center text-gray-400">
                          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>ยังไม่มีประวัติการชำระเงิน</p>
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50">
                              <tr>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">เลขที่</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">งวดบิล</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">ยอด</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">สถานะ</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">วันครบกำหนด</th>
                                <th className="px-4 py-2 text-left font-medium text-gray-600">วันที่ชำระ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {tenantBills.map((bill) => (
                                <tr key={bill.id} className="border-t">
                                  <td className="px-4 py-3 font-mono text-xs">{bill.invoice_number}</td>
                                  <td className="px-4 py-3">{bill.billing_period || '-'}</td>
                                  <td className="px-4 py-3 font-medium">
                                    {formatCurrency(bill.amount)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {getBillStatusBadge(bill.status)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {new Date(bill.due_date).toLocaleDateString('th-TH')}
                                  </td>
                                  <td className="px-4 py-3">
                                    {bill.paid_at
                                      ? new Date(bill.paid_at).toLocaleDateString('th-TH')
                                      : '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-gray-900">
                          {formatCurrency(tenantBills.reduce((sum, b) => sum + b.amount, 0))}
                        </p>
                        <p className="text-sm text-gray-500">ยอดรวมทั้งหมด</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {tenantBills.filter(b => b.status === 'pending' || b.status === 'overdue').length}
                        </p>
                        <p className="text-sm text-gray-500">บิลค้างชำระ</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {formatCurrency(tenantBills.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.amount, 0))}
                        </p>
                        <p className="text-sm text-gray-500">จ่ายแล้ว</p>
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button onClick={() => setShowBillDialog(false)}>
                    ปิด
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Suspend Confirmation Dialog */}
            <Dialog open={showSuspendDialog} onOpenChange={setShowSuspendDialog}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>ระงับบริษัท</DialogTitle>
                  <DialogDescription>
                    ยืนยันการระงับการใช้งานบริษัทนี้
                  </DialogDescription>
                </DialogHeader>
                {selectedTenant && (
                  <div className="space-y-4 py-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <p className="text-sm text-amber-800">
                        <strong>ระวัง:</strong> การระงับบริษัทจะทำให้ผู้ใช้ทั้งหมดในบริษัทนี้ไม่สามารถเข้าใช้งานระบบได้
                        แต่ข้อมูลทั้งหมดจะยังคงอยู่
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">บริษัทที่จะระงับ:</p>
                      <p className="font-semibold">{selectedTenant.name}</p>
                      <p className="text-sm text-gray-500">แพ็คเกจ: {selectedTenant.subscription_plan}</p>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowSuspendDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button variant="destructive" onClick={handleSuspendTenant}>
                    ยืนยันการระงับ
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default TenantManagement;
