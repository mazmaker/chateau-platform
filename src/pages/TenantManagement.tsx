import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
import { FeatureSelector } from '@/components/admin/FeatureSelector';
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
  Ban,
  Clock,
  CheckCircle
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
}

interface PaymentHistory {
  id: string;
  tenant_id: string;
  invoice_id: string;
  invoice_number: string;
  amount: number;
  currency: string;
  payment_method: 'credit_card' | 'bank_transfer' | 'paypal' | 'cash';
  payment_status: 'completed' | 'pending' | 'failed' | 'refunded';
  paid_at: string;
  transaction_id?: string;
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
  const { id: tenantId } = useParams();
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
  const [showActivateDialog, setShowActivateDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [tenantBills, setTenantBills] = useState<Invoice[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [billingHistory, setBillingHistory] = useState<Invoice[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [loadingBilling, setLoadingBilling] = useState(false);

  // Compute selectedTenant based on URL parameter instead of state
  const selectedTenantFromUrl = tenants.find(tenant => tenant.id === tenantId) || null;

  // Handle invalid tenant ID in URL
  useEffect(() => {
    // Check if tenantId is a valid UUID format
    const isValidUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId || '');

    if (tenantId && !isValidUUID) {
      console.warn(`Invalid tenant ID format: ${tenantId}, redirecting to tenants list`);
      navigate('/tenants', { replace: true });
      return;
    }

    if (tenantId && tenants.length > 0 && !selectedTenantFromUrl) {
      console.warn(`Tenant with ID ${tenantId} not found, redirecting to tenants list`);
      navigate('/tenants', { replace: true });
    }
  }, [tenantId, tenants, selectedTenantFromUrl, navigate]);

  // Fetch payment history for current tenant
  const fetchPaymentHistory = async (currentTenantId: string) => {
    if (!currentTenantId) return;

    setLoadingPayments(true);
    try {
      // First, try to fetch from payments table if exists
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          invoices (
            invoice_number
          )
        `)
        .eq('tenant_id', currentTenantId)
        .order('paid_at', { ascending: false });

      if (paymentsError && paymentsError.code !== 'PGRST116') {
        throw paymentsError;
      }

      if (paymentsData && paymentsData.length > 0) {
        // Format payments data
        const formattedPayments: PaymentHistory[] = paymentsData.map(payment => ({
          id: payment.id,
          tenant_id: payment.tenant_id,
          invoice_id: payment.invoice_id,
          invoice_number: payment.invoices?.invoice_number || payment.invoice_number || '',
          amount: payment.amount,
          currency: payment.currency || 'THB',
          payment_method: payment.payment_method,
          payment_status: payment.payment_status,
          paid_at: payment.paid_at,
          transaction_id: payment.transaction_id
        }));
        setPaymentHistory(formattedPayments);
      } else {
        // Fallback: Use paid invoices as payment history
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select('*')
          .eq('tenant_id', currentTenantId)
          .eq('status', 'paid')
          .order('paid_at', { ascending: false });

        if (invoicesError) throw invoicesError;

        if (invoicesData) {
          const paymentFromInvoices: PaymentHistory[] = invoicesData.map(invoice => ({
            id: invoice.id + '_payment',
            tenant_id: invoice.tenant_id,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            currency: invoice.currency || 'THB',
            payment_method: 'bank_transfer', // Default since we don't have payment method in invoices
            payment_status: 'completed',
            paid_at: invoice.paid_at || invoice.created_at,
            transaction_id: undefined
          }));
          setPaymentHistory(paymentFromInvoices);
        }
      }
    } catch (error) {
      console.error('Error fetching payment history:', error);
      setPaymentHistory([]);
    } finally {
      setLoadingPayments(false);
    }
  };

  // Fetch billing history for current tenant
  const fetchBillingHistory = async (currentTenantId: string) => {
    if (!currentTenantId) return;

    setLoadingBilling(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('tenant_id', currentTenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setBillingHistory(data || []);
    } catch (error) {
      console.error('Error fetching billing history:', error);
      setBillingHistory([]);
    } finally {
      setLoadingBilling(false);
    }
  };

  // Fetch payment and billing history when tenantId changes
  useEffect(() => {
    if (tenantId) {
      fetchPaymentHistory(tenantId);
      fetchBillingHistory(tenantId);
    } else {
      setPaymentHistory([]);
      setBillingHistory([]);
    }
  }, [tenantId]);

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
      features: ['ระบบจัดการลูกค้า', 'ระบบ Leads']
    },
    {
      id: 'starter',
      name: 'Starter',
      price: '2,900',
      properties: 10,
      users: 5,
      adminCount: 1,
      salesCount: 4,
      features: ['ระบบจัดการลูกค้า', 'ระบบ Leads', 'ระบบแคมเปญ']
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '5,900',
      properties: 50,
      users: 10,
      adminCount: 2,
      salesCount: 8,
      features: ['ระบบจัดการลูกค้า', 'ระบบ Leads', 'ระบบแคมเปญ', 'รายงานวิเคราะห์', 'API Access']
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: '15,900',
      properties: -1,
      users: 20,
      adminCount: 4,
      salesCount: 16,
      features: ['ระบบจัดการลูกค้า', 'ระบบ Leads', 'ระบบแคมเปญ', 'รายงานวิเคราะห์', 'API Access', 'รายงานวิเคราะห์ขั้นสูง', 'Custom Development', 'Support 24/7']
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
    features: ['ระบบจัดการลูกค้า', 'ระบบ Leads']
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

  const handleActivateTenant = async () => {
    if (!selectedTenant) return;

    try {
      const { error } = await supabase
        .from('tenants')
        .update({ status: 'active' })
        .eq('id', selectedTenant.id);

      if (error) throw error;

      // Log activity
      await supabase.rpc('log_activity', {
        p_tenant_id: selectedTenant.id,
        p_user_id: user?.id,
        p_activity_type: 'tenant_activated',
        p_description: `เปิดใช้งานบริษัท: ${selectedTenant.name}`,
        p_metadata: { tenant_id: selectedTenant.id, name: selectedTenant.name }
      });

      setShowActivateDialog(false);
      setSelectedTenant(null);
      fetchTenants();

      toast.success('เปิดใช้งานบริษัทสำเร็จ', {
        description: `เปิดใช้งาน ${selectedTenant.name} เรียบร้อยแล้ว`
      });
    } catch (error) {
      console.error('Error activating tenant:', error);
      toast.error('ไม่สามารถเปิดใช้งานบริษัทได้', {
        description: error instanceof Error ? error.message : 'กรุณาลองอีกครั้ง'
      });
    }
  };

  const openDetailDialog = (tenant: Tenant) => {
    navigate(`/tenants/${tenant.id}`);
  };

  const openBillDialog = async (tenant: Tenant) => {
    setSelectedTenant(tenant);

    // For now, use mock data since invoices table doesn't exist yet
    try {
      console.log('📊 Loading mock bill data for tenant:', tenant.name);

      // Generate mock bills for this tenant
      const mockBills = [
        {
          id: `bill-${tenant.id}-1`,
          tenant_id: tenant.id,
          invoice_number: `INV-${tenant.slug?.toUpperCase() || 'TENANT'}-001`,
          amount: 2900,
          status: 'paid',
          due_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          paid_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()
        },
        {
          id: `bill-${tenant.id}-2`,
          tenant_id: tenant.id,
          invoice_number: `INV-${tenant.slug?.toUpperCase() || 'TENANT'}-002`,
          amount: 2900,
          status: 'pending',
          due_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          paid_at: null
        }
      ];

      setTenantBills(mockBills as any);
    } catch (error) {
      console.error('Error loading bill data:', error);
      setTenantBills([]);
    }

    setShowBillDialog(true);
  };

  const openSuspendDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowSuspendDialog(true);
  };

  const openActivateDialog = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setShowActivateDialog(true);
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


  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      active:    { label: 'Active',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
      trial:     { label: 'Trial',   className: 'bg-amber-50 text-amber-700 border border-amber-200' },
      suspended: { label: 'ระงับ',   className: 'bg-red-50 text-red-700 border border-red-200' },
      cancelled: { label: 'ยกเลิก',  className: 'bg-gray-100 text-gray-600 border border-gray-300' },
    };
    const badge = badges[status] || { label: status, className: 'bg-gray-50 text-gray-700 border border-gray-200' };
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getPlanBadge = (plan: string) => {
    // Find package config for this plan
    const pkg = packageConfig.find(p => p.id === plan);

    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-700 border border-gray-300',
      starter: 'bg-blue-100 text-blue-800 border border-blue-300',
      professional: 'bg-purple-100 text-purple-800 border border-purple-300',
      enterprise: 'bg-chateau-100 text-chateau-700 border border-chateau-200'
    };

    const labels: Record<string, string> = {
      free: 'Free',
      starter: 'Starter',
      professional: 'Professional',
      enterprise: 'Enterprise'
    };

    const planColor = colors[plan] || 'bg-gray-100 text-gray-700';
    const planLabel = pkg?.name || labels[plan] || plan;
    const planPrice = pkg?.price || '0';

    return (
      <div className="flex flex-col gap-1">
        <Badge className={planColor}>
          {planLabel}
        </Badge>
        <span className="text-xs text-gray-500">฿{planPrice}/เดือน</span>
      </div>
    );
  };

  const getBillStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      paid:      { label: 'จ่ายแล้ว',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
      pending:   { label: 'รอชำระ',    className: 'bg-amber-50 text-amber-700 border border-amber-200' },
      overdue:   { label: 'เกินกำหนด', className: 'bg-red-50 text-red-700 border border-red-200' },
      cancelled: { label: 'ยกเลิก',    className: 'bg-gray-100 text-gray-600 border border-gray-300' },
    };
    const badge = badges[status] || badges.pending;
    return (
      <span className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      credit_card: 'บัตรเครดิต',
      bank_transfer: 'โอนผ่านธนาคาร',
      paypal: 'PayPal',
      cash: 'เงินสด'
    };
    return labels[method] || method;
  };

  const getPaymentStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      completed: { label: 'สำเร็จ', className: 'bg-green-100 text-green-800' },
      pending: { label: 'รอดำเนินการ', className: 'bg-red-100 text-red-800' },
      failed: { label: 'ล้มเหลว', className: 'bg-red-100 text-red-800' },
      refunded: { label: 'คืนเงินแล้ว', className: 'bg-gray-100 text-gray-700' }
    };
    const badge = badges[status] || badges.pending;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
                const pkg = packageConfig.find(p => p.id === t.subscription_plan);
                const price = pkg ? parseInt(pkg.price.replace(/,/g, ''), 10) : 0;
                return sum + price;
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
            {packageConfig.filter(pkg => pkg.id !== 'free').map(pkg => {
              const count = tenants.filter(t => t.subscription_plan === pkg.id).length;
              const percentage = tenants.length > 0 ? (count / tenants.length) * 100 : 0;
              const colors: Record<string, string> = {
                starter: 'bg-blue-500',
                professional: 'bg-purple-500',
                enterprise: 'bg-chateau-500'
              };
              return (
                <div key={pkg.id} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{pkg.name} (฿{pkg.price})</span>
                    <span className="text-muted-foreground">{count} บริษัท ({percentage.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${colors[pkg.id]}`} style={{ width: `${percentage}%` }} />
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
                        <div className="bg-white shadow-sm p-3 rounded-lg">
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
      <Card className="bg-white shadow-sm border-gray-200">
        <CardContent className="pt-6">
          <p className="text-sm text-gray-700">
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
                          <Badge className="bg-gray-100 text-gray-700">
                            Owner 1 คน
                          </Badge>
                          <span className="text-xs text-muted-foreground">(ไม่นับรวม)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gray-100 text-gray-700">
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
                <SelectItem value="active">ใช้งานอยู่</SelectItem>
                <SelectItem value="trial">ทดลองใช้</SelectItem>
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

      {/* Desktop Tenants Table */}
      <Card className="hidden md:block">
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
                            {tenant.status === 'suspended' ? (
                              <DropdownMenuItem
                                onClick={() => openActivateDialog(tenant)}
                                className="text-green-600"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                เปิดใช้งาน
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => openSuspendDialog(tenant)}
                                className="text-chateau"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                ระงับ
                              </DropdownMenuItem>
                            )}
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

      {/* Mobile Tenants Cards */}
      <div className="md:hidden space-y-4">
        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mr-2"></div>
              <span>กำลังโหลด...</span>
            </CardContent>
          </Card>
        ) : filteredTenants.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-muted-foreground">ไม่พบบริษัท</p>
            </CardContent>
          </Card>
        ) : (
          filteredTenants.map((tenant) => {
            const stats = tenantStats[tenant.id];
            return (
              <Card key={tenant.id} className="border-l-4 border-l-blue-500">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{tenant.name}</h3>
                      <p className="text-sm text-muted-foreground">/{tenant.slug}</p>
                    </div>
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
                        {tenant.status === 'suspended' ? (
                          <DropdownMenuItem
                            onClick={() => openActivateDialog(tenant)}
                            className="text-green-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            เปิดใช้งาน
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem
                            onClick={() => openSuspendDialog(tenant)}
                            className="text-chateau"
                          >
                            <Ban className="w-4 h-4 mr-2" />
                            ระงับ
                          </DropdownMenuItem>
                        )}
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
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <p className="text-xs text-muted-foreground">สถานะ</p>
                      {getStatusBadge(tenant.status)}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">แพ็คเกจ</p>
                      {getPlanBadge(tenant.subscription_plan)}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">ผู้ใช้</p>
                      <p>Admin {stats?.adminCount || 0} + Sales {stats?.salesCount || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">โครงการ</p>
                      <div className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-muted-foreground" />
                        <span>{stats?.propertyCount || 0} / {tenant.max_properties === -1 ? '∞' : tenant.max_properties}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      สร้างเมื่อ: {new Date(tenant.created_at).toLocaleDateString('th-TH')}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar */}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main Content */}
        <div className="lg:ml-[260px] min-h-screen">
          {/* Header */}
          <Header onMenuClick={() => setSidebarOpen(true)} />

          {/* Page Content */}
          <main className="p-6 lg:p-8">
            {/* Page Header */}
            <Card className="bg-white border-gray-200 shadow-lg mb-6">
              <CardContent className="pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">จัดการบริษัท (Tenants)</h1>
                      <p className="text-sm sm:text-base text-gray-600 mt-1">
                        จัดการบริษัททั้งหมดในระบบ SaaS
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      resetForm();
                      setShowCreateDialog(true);
                    }}
                    className="bg-gray-900 hover:bg-black text-white shadow-lg w-full sm:w-auto"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">เพิ่มบริษัทใหม่</span>
                    <span className="sm:hidden">เพิ่มบริษัท</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Conditional Content: List View or Detail View */}
            {!tenantId ? (
              /* Tenants List - Tabs Layout */
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
            ) : (
              /* Tenant Detail View */
              selectedTenantFromUrl && (
                <div className="space-y-6">
                  {/* Back Button */}
                  <Button variant="outline" onClick={() => navigate('/tenants')}>
                    ← กลับไปรายการบริษัท
                  </Button>

                  {/* Tenant Header */}
                  <Card>
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <CardTitle className="text-3xl font-bold">{selectedTenantFromUrl.name}</CardTitle>
                            {getStatusBadge(selectedTenantFromUrl.status)}
                            {getPlanBadge(selectedTenantFromUrl.subscription_plan)}
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">Slug</p>
                              <div className="flex items-center gap-1">
                                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">/{selectedTenantFromUrl.slug}</span>
                              </div>
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">ผู้ใช้</p>
                              <span className="text-xl font-bold text-blue-600">
                                {tenantStats[selectedTenantFromUrl.id]?.userCount || 0} / {selectedTenantFromUrl.max_users}
                              </span>
                            </div>

                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">โครงการ</p>
                              <span className="text-xl font-semibold">
                                {tenantStats[selectedTenantFromUrl.id]?.propertyCount || 0} / {selectedTenantFromUrl.max_properties === -1 ? 'ไม่จำกัด' : selectedTenantFromUrl.max_properties}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 ml-6">
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedTenant(selectedTenantFromUrl);
                            setFormData({
                              name: selectedTenantFromUrl.name,
                              slug: selectedTenantFromUrl.slug || '',
                              status: selectedTenantFromUrl.status,
                              subscription_plan: selectedTenantFromUrl.subscription_plan,
                              max_properties: Number(selectedTenantFromUrl.max_properties) || 0,
                              max_users: Number(selectedTenantFromUrl.max_users) || 0,
                              billing_address: selectedTenantFromUrl.billing_address || '',
                              billing_email: selectedTenantFromUrl.billing_email || '',
                              billing_phone: selectedTenantFromUrl.billing_phone || '',
                              tax_id: selectedTenantFromUrl.tax_id || ''
                            });
                            setShowEditDialog(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" />
                            แก้ไข
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            setSelectedTenant(selectedTenantFromUrl);
                            setShowDetailDialog(true);
                          }}>
                            <Eye className="w-4 h-4 mr-2" />
                            รายละเอียดเต็ม
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>

                  {/* Tenant Information */}
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {/* Company Information */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Building2 className="w-5 h-5" />
                          ข้อมูลบริษัท
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">ชื่อบริษัท</p>
                          <p className="font-medium">{selectedTenantFromUrl.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">สร้างเมื่อ</p>
                          <p className="font-medium">{new Date(selectedTenantFromUrl.created_at).toLocaleDateString('th-TH')}</p>
                        </div>
                        {selectedTenantFromUrl.trial_ends_at && (
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-muted-foreground">Trial สิ้นสุด</p>
                            <p className="font-medium text-chateau">
                              {new Date(selectedTenantFromUrl.trial_ends_at).toLocaleDateString('th-TH')}
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Usage Statistics */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <BarChart3 className="w-5 h-5" />
                          สถิติการใช้งาน
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>ผู้ใช้</span>
                            <span>{tenantStats[selectedTenantFromUrl.id]?.userCount || 0} / {selectedTenantFromUrl.max_users}</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-white shadow-sm0 h-2 rounded-full"
                              style={{
                                width: `${Math.min(100, ((tenantStats[selectedTenantFromUrl.id]?.userCount || 0) / selectedTenantFromUrl.max_users) * 100)}%`
                              }}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>โครงการ</span>
                            <span>{tenantStats[selectedTenantFromUrl.id]?.propertyCount || 0} / {selectedTenantFromUrl.max_properties === -1 ? '∞' : selectedTenantFromUrl.max_properties}</span>
                          </div>
                          {selectedTenantFromUrl.max_properties !== -1 && (
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-white shadow-sm0 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(100, ((tenantStats[selectedTenantFromUrl.id]?.propertyCount || 0) / selectedTenantFromUrl.max_properties) * 100)}%`
                                }}
                              />
                            </div>
                          )}
                        </div>
                        <div className="pt-3 border-t space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Admin</span>
                            <span>{tenantStats[selectedTenantFromUrl.id]?.adminCount || 0}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Sales</span>
                            <span>{tenantStats[selectedTenantFromUrl.id]?.salesCount || 0}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Billing Information */}
                    {(selectedTenantFromUrl.billing_email || selectedTenantFromUrl.billing_address) ? (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <CreditCard className="w-5 h-5" />
                            ข้อมูลการเรียกเก็บเงิน
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {selectedTenantFromUrl.billing_email && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">อีเมลสำหรับเรียกเก็บเงิน</p>
                              <p className="font-medium">{selectedTenantFromUrl.billing_email}</p>
                            </div>
                          )}
                          {selectedTenantFromUrl.billing_address && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">ที่อยู่สำหรับเรียกเก็บเงิน</p>
                              <p className="font-medium">{selectedTenantFromUrl.billing_address}</p>
                            </div>
                          )}
                          {selectedTenantFromUrl.billing_phone && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">เบอร์โทร</p>
                              <p className="font-medium">{selectedTenantFromUrl.billing_phone}</p>
                            </div>
                          )}
                          {selectedTenantFromUrl.tax_id && (
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-muted-foreground">เลขประจำตัวผู้เสียภาษี</p>
                              <p className="font-medium">{selectedTenantFromUrl.tax_id}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ) : (
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            กิจกรรมล่าสุด
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">ไม่มีกิจกรรมบันทึกไว้</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  {/* Payment History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5" />
                        ประวัติการชำระเงิน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {loadingPayments ? (
                          <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
                          </div>
                        ) : paymentHistory.length > 0 ? (
                          <div className="space-y-3">
                            {paymentHistory.map((payment) => (
                              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                                    <CreditCard className="w-5 h-5 text-green-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{payment.invoice_number}</p>
                                    <p className="text-sm text-gray-500">
                                      {getPaymentMethodLabel(payment.payment_method)} • {formatDate(payment.paid_at)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                                  {getPaymentStatusBadge(payment.payment_status)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <CreditCard className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">ไม่มีประวัติการชำระเงิน</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Billing History */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        ประวัติบิล
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {loadingBilling ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-600"></div>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left py-3 px-2">เลขที่บิล</th>
                                <th className="text-left py-3 px-2">วันที่ออกบิล</th>
                                <th className="text-left py-3 px-2">วันครบกำหนด</th>
                                <th className="text-right py-3 px-2">จำนวนเงิน</th>
                                <th className="text-center py-3 px-2">สถานะ</th>
                                <th className="text-left py-3 px-2">แพ็คเกจ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {billingHistory.map((invoice) => (
                              <tr key={invoice.id} className="border-b hover:bg-gray-50">
                                <td className="py-3 px-2 font-medium">{invoice.invoice_number}</td>
                                <td className="py-3 px-2 text-gray-600">
                                  {new Date(invoice.created_at).toLocaleDateString('th-TH')}
                                </td>
                                <td className="py-3 px-2 text-gray-600">
                                  {new Date(invoice.due_date).toLocaleDateString('th-TH')}
                                </td>
                                <td className="py-3 px-2 text-right font-semibold">
                                  {formatCurrency(invoice.amount)}
                                </td>
                                <td className="py-3 px-2 text-center">
                                  {getBillStatusBadge(invoice.status)}
                                </td>
                                <td className="py-3 px-2">
                                  <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    {invoice.subscription_plan}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                          {billingHistory.length === 0 && (
                            <div className="text-center py-8">
                              <Package className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                              <p className="text-gray-500">ไม่มีประวัติบิล</p>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            )}

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
                      <CreditCard className="w-5 h-5 text-gray-600" />
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
                          <SelectItem value="trial">ทดลองใช้</SelectItem>
                          <SelectItem value="active">ใช้งานอยู่</SelectItem>
                          <SelectItem value="suspended">ระงับ</SelectItem>
                          <SelectItem value="cancelled">ยกเลิก</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Billing Information Section */}
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-4">
                      <CreditCard className="w-5 h-5 text-gray-600" />
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
                  <div className="bg-white shadow-sm p-3 rounded-lg">
                    <p className="text-sm text-gray-700">
                      <strong>สรุป:</strong> Admin {packageFormData.adminCount} คน + Sales {packageFormData.salesCount} คน = ทั้งหมด {packageFormData.adminCount + packageFormData.salesCount} คน (Owner 1 คน ไม่นับรวม)
                    </p>
                  </div>

                  {/* Features */}
                  <FeatureSelector
                    selectedFeatures={packageFormData.features}
                    onFeatureChange={(features) =>
                      setPackageFormData({ ...packageFormData, features })
                    }
                  />
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
                        <Building2 className="w-5 h-5 text-gray-600" />
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
                        <BarChart3 className="w-5 h-5 text-gray-600" />
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
                        <CreditCard className="w-5 h-5 text-gray-600" />
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
                    <div className="bg-white border border-gray-200 shadow-sm p-4 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">แพ็คเกจปัจจุบัน</p>
                          <p className="font-semibold text-lg">{getPlanBadge(selectedTenant.subscription_plan)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">ค่าบริการต่อเดือน</p>
                          <p className="font-semibold text-lg text-gray-600">
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
                                  <td className="px-4 py-3">{(bill as any).billing_period || '-'}</td>
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
                    <div className="bg-chateau-50 border border-chateau-100 rounded-lg p-4">
                      <p className="text-sm text-chateau-700">
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

            {/* Activate Confirmation Dialog */}
            <Dialog open={showActivateDialog} onOpenChange={setShowActivateDialog}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>เปิดใช้งานบริษัท</DialogTitle>
                  <DialogDescription>
                    ยืนยันการเปิดใช้งานบริษัทนี้
                  </DialogDescription>
                </DialogHeader>
                {selectedTenant && (
                  <div className="space-y-4 py-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-sm text-green-800">
                        <strong>การเปิดใช้งาน:</strong> บริษัทนี้จะสามารถเข้าใช้งานระบบได้ตามปกติ
                        และผู้ใช้ทั้งหมดในบริษัทจะสามารถเข้าสู่ระบบได้
                      </p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-gray-600">บริษัทที่จะเปิดใช้งาน:</p>
                      <p className="font-semibold">{selectedTenant.name}</p>
                      <p className="text-sm text-gray-500">แพ็คเกจ: {selectedTenant.subscription_plan}</p>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowActivateDialog(false)}>
                    ยกเลิก
                  </Button>
                  <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={handleActivateTenant}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    ยืนยันการเปิดใช้งาน
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
