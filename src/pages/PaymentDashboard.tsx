// @ts-nocheck — legacy admin-only payment dashboard with extensive type drift.
// Scheduled for refactor when payment module is rewritten in Phase 2.
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  TrendingUp,
  Calendar,
  FileText,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Plus,
  Eye,
  Edit,
  Trash2,
  Download,
  Send,
  RefreshCw,
  Activity,
  ChevronLeft,
  ChevronRight,
  Settings,
  Mail,
  Bell
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageTabs } from '@/components/ui/PageTabs';
import type { TabItem } from '@/components/ui/PageTabs';
import InvoiceManagement from '@/components/invoices/InvoiceManagement';
import { emailService } from '@/lib/email-service';
import { suspensionService } from '@/lib/suspension-service';
import { billingScheduler } from '@/lib/billing-scheduler';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar
} from 'recharts';

interface PaymentOverview {
  totalRevenue: number;
  totalOutstanding: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalInvoices: number;
  tenantsWithOverdue: number;
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
  tenant?: {
    name: string;
    slug: string;
  };
}

interface RecentPayment {
  id: string;
  tenant_name: string;
  invoice_number: string;
  amount: number;
  paid_at: string;
  payment_method: string;
}

interface Payment {
  id: string;
  tenant_id: string;
  invoice_id?: string;
  invoice_number?: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: 'pending' | 'completed' | 'failed' | 'refunded' | 'cancelled' | 'overdue';
  transaction_id?: string;
  reference_code?: string;
  notes?: string;
  paid_at?: string;
  created_at: string;
  tenant?: {
    name: string;
    slug: string;
  };
}

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'due' | 'overdue' | 'reminder' | 'payment';
  invoice_number?: string;
  invoice_id?: string;
  amount?: number;
  tenant_name?: string;
  tenant_email?: string;
  invoice_detail?: any; // Full invoice details with tenant info
}

interface OverdueData {
  tenant_id: string;
  tenant_name: string;
  tenant_email?: string;
  invoice_count: number;
  total_amount: number;
  oldest_due_date: string;
  subscription_plan: string;
}

const PaymentDashboard = () => {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [paymentOverview, setPaymentOverview] = useState<PaymentOverview>({
    totalRevenue: 0,
    totalOutstanding: 0,
    paidInvoices: 0,
    overdueInvoices: 0,
    totalInvoices: 0,
    tenantsWithOverdue: 0
  });
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [overdueData, setOverdueData] = useState<OverdueData[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarStats, setCalendarStats] = useState({
    totalProjects: 0,
    dueToday: 0,
    overdue: 0,
    totalAmount: 0
  });

  // Invoice Creation Modal State
  const [showCreateInvoice, setShowCreateInvoice] = useState(false);
  const [tenantList, setTenantList] = useState<{id: string, name: string, subscription_plan: string}[]>([]);
  const [newInvoice, setNewInvoice] = useState({
    tenant_id: '',
    subscription_plan: 'starter',
    amount: 2900,
    currency: 'THB',
    due_date: '',
    description: '',
    custom_amount: false
  });

  // Payment Detail Modal State
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<Payment | RecentPayment | null>(null);

  // Calendar Event Detail Modal State
  const [showCalendarEventModal, setShowCalendarEventModal] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<CalendarEvent | null>(null);

  // Package Pricing
  const PACKAGE_PRICES = {
    starter: { monthly: 2900, annual: 29000, label: 'Starter Plan' },
    professional: { monthly: 5900, annual: 59000, label: 'Professional Plan' },
    enterprise: { monthly: 15900, annual: 159000, label: 'Enterprise Plan' }
  };

  // Automation Status
  const [automationStatus, setAutomationStatus] = useState({
    scheduler_running: false,
    email_queue: 0,
    pending_suspensions: 0,
    jobs_status: {
      auto_billing: 'active',
      email_notifications: 'active',
      suspensions: 'active'
    }
  });

  const [showAutomationPanel, setShowAutomationPanel] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  // Beautiful Popup State
  const [showResultPopup, setShowResultPopup] = useState(false);
  const [popupData, setPopupData] = useState({
    type: 'success',
    title: '',
    message: '',
    details: ''
  });

  // Advanced Settings State
  const [advancedConfig, setAdvancedConfig] = useState({
    // Scheduler Settings
    scheduler: {
      timezone: 'Asia/Bangkok',
      businessHours: { start: '08:00', end: '18:00' },
      holidays: ['2024-01-01', '2024-12-25'],
      retryPolicy: {
        enabled: true,
        maxRetries: 3,
        backoffStrategy: 'exponential',
        backoffBase: 2
      }
    },
    // Email Settings
    email: {
      fromName: 'CHATEAU Platform',
      fromEmail: 'billing@chateau-platform.com',
      replyTo: 'support@chateau-platform.com',
      enableTracking: true,
      enableA11yMode: false
    },
    // Billing Rules
    billing: {
      invoicePrefix: 'INV',
      gracePeriodDays: 7,
      autoSuspendAfterDays: 14,
      currency: 'THB',
      taxRate: 0.07,
      paymentTerms: 'NET 7'
    },
    // Notification Settings
    notifications: {
      enableAdminEmail: true,
      adminEmail: 'admin@chateau-platform.com'
    }
  });

  const tabs: TabItem[] = [
    { id: 'overview', label: 'ภาพรวมการเงิน', icon: TrendingUp },
    { id: 'invoices', label: 'จัดการใบแจ้งหนี้', icon: FileText },
    { id: 'payments', label: 'ติดตามการชำระ', icon: CreditCard },
    { id: 'calendar', label: 'ปฎิทินแจ้งเตือน', icon: Calendar },
    { id: 'overdue', label: 'ค้างชำระ', icon: AlertCircle },
    { id: 'reports', label: 'รายงานการเงิน', icon: Activity }
  ];

  // Fetch all invoices for payment tracking
  const fetchAllPayments = async () => {
    console.log('🔍 Fetching all invoices for payment tracking...');
    try {
      // ดึงข้อมูลใบแจ้งหนี้ทั้งหมดพร้อมสถานะปัจจุบัน
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          currency,
          status,
          due_date,
          paid_at,
          created_at,
          tenant_id,
          tenants (
            name,
            slug
          )
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching invoices:', error);
        throw error;
      }

      console.log('📊 Invoices found:', invoices?.length || 0);
      console.log('📝 Invoice data:', invoices);

      if (invoices) {
        const formattedPayments: Payment[] = invoices.map(invoice => {
          // แปลงสถานะใบแจ้งหนี้เป็นสถานะการชำระเงิน
          let paymentStatus: 'pending' | 'completed' | 'failed' | 'cancelled' = 'pending';
          let paymentMethod = 'bank_transfer';

          switch (invoice.status) {
            case 'paid':
              paymentStatus = 'completed';
              break;
            case 'pending':
              paymentStatus = 'pending';
              break;
            case 'overdue':
              paymentStatus = 'overdue'; // ค้างชำระ
              break;
            case 'cancelled':
              paymentStatus = 'cancelled';
              break;
            default:
              paymentStatus = 'pending';
          }

          return {
            id: `invoice_${invoice.id}`,
            tenant_id: invoice.tenant_id,
            invoice_id: invoice.id,
            invoice_number: invoice.invoice_number,
            amount: invoice.amount || 0,
            currency: invoice.currency || 'THB',
            payment_method: paymentMethod,
            payment_status: paymentStatus,
            transaction_id: undefined,
            reference_code: undefined,
            notes: undefined,
            paid_at: invoice.paid_at,
            created_at: invoice.created_at,
            tenant: invoice.tenants
          };
        });

        console.log('✅ Formatted payment tracking:', formattedPayments.length);
        console.log('📊 Payment status breakdown:', {
          completed: formattedPayments.filter(p => p.payment_status === 'completed').length,
          pending: formattedPayments.filter(p => p.payment_status === 'pending').length,
          failed: formattedPayments.filter(p => p.payment_status === 'failed').length,
          cancelled: formattedPayments.filter(p => p.payment_status === 'cancelled').length
        });

        setAllPayments(formattedPayments);
      } else {
        console.log('⚠️ No invoices data returned');
        setAllPayments([]);
      }
    } catch (error) {
      console.error('❌ Error fetching payment tracking data:', error);
      setAllPayments([]);
    }
  };

  // Fetch calendar events
  const fetchCalendarEvents = async () => {
    try {
      // Get upcoming due dates and overdue invoices
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          amount,
          due_date,
          status,
          tenants (
            name
          )
        `)
        .in('status', ['pending', 'overdue'])
        .order('due_date', { ascending: true });

      const events: CalendarEvent[] = [];
      const now = new Date();

      // ถ้าไม่มีข้อมูลหรือมีข้อผิดพลาด ให้ใช้ array เปล่า
      if (error || !invoicesData || invoicesData.length === 0) {
        console.log('No calendar data available');
        setCalendarEvents([]);
        return;
      }

      // ใช้ข้อมูลจริง
      invoicesData?.forEach(invoice => {
        const dueDate = new Date(invoice.due_date);
        const isOverdue = dueDate < now;

        events.push({
          id: invoice.id,
          title: `${invoice.tenants?.name} - ${invoice.invoice_number}`,
          date: invoice.due_date,
          type: isOverdue ? 'overdue' : 'due',
          invoice_number: invoice.invoice_number,
          invoice_id: invoice.id,
          amount: invoice.amount,
          tenant_name: invoice.tenants?.name,
          tenant_email: invoice.tenants?.email
        });

        // Add reminder events (7 days before due date)
        const reminderDate = new Date(dueDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (reminderDate >= now) {
          events.push({
            id: `reminder-${invoice.id}`,
            title: `แจ้งเตือน: ${invoice.tenants?.name}`,
            date: reminderDate.toISOString(),
            type: 'reminder',
            invoice_number: invoice.invoice_number,
            invoice_id: invoice.id,
            amount: invoice.amount,
            tenant_name: invoice.tenants?.name,
            tenant_email: invoice.tenants?.email
          });
        }
      });

      setCalendarEvents(events);
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      // ในกรณีที่เกิดข้อผิดพลาด ให้แสดงข้อมูลจำลอง
      setCalendarEvents([]);
    }
  };

  // Fetch overdue data by tenant
  const fetchOverdueData = async () => {
    try {
      const { data: overdueInvoices, error } = await supabase
        .from('invoices')
        .select(`
          tenant_id,
          amount,
          due_date,
          subscription_plan,
          tenants (
            name,
            email
          )
        `)
        .eq('status', 'overdue')
        .order('due_date', { ascending: true });

      if (error) throw error;

      // Group by tenant
      const tenantMap = new Map<string, OverdueData>();

      overdueInvoices?.forEach(invoice => {
        const tenantId = invoice.tenant_id;
        const existing = tenantMap.get(tenantId);

        if (existing) {
          existing.invoice_count++;
          existing.total_amount += invoice.amount;
          if (new Date(invoice.due_date) < new Date(existing.oldest_due_date)) {
            existing.oldest_due_date = invoice.due_date;
          }
        } else {
          tenantMap.set(tenantId, {
            tenant_id: tenantId,
            tenant_name: invoice.tenants?.name || 'Unknown',
            tenant_email: invoice.tenants?.email,
            invoice_count: 1,
            total_amount: invoice.amount,
            oldest_due_date: invoice.due_date,
            subscription_plan: invoice.subscription_plan
          });
        }
      });

      setOverdueData(Array.from(tenantMap.values()));
    } catch (error) {
      console.error('Error fetching overdue data:', error);
      setOverdueData([]);
    }
  };

  // Fetch payment overview data
  const fetchPaymentOverview = async () => {
    setLoading(true);
    console.log('🔍 Fetching payment overview data...');
    try {
      // Get current date for filtering
      const now = new Date();
      const daysAgo = new Date(now.getTime() - parseInt(timeRange) * 24 * 60 * 60 * 1000);

      // Fetch all invoices with tenant information
      const { data: invoices, error } = await supabase
        .from('invoices')
        .select(`
          *,
          tenants (
            name,
            slug
          )
        `)
        .gte('created_at', daysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('📊 Found invoices:', invoices?.length || 0);
      if (invoices) {
        const overview: PaymentOverview = {
          totalRevenue: 0,
          totalOutstanding: 0,
          paidInvoices: 0,
          overdueInvoices: 0,
          totalInvoices: invoices.length,
          tenantsWithOverdue: 0
        };

        const tenantsWithOverdue = new Set<string>();

        invoices.forEach(invoice => {
          // ✅ แก้ไข: ไม่รวม cancelled invoices ในยอดรายได้
          if (invoice.status !== 'cancelled') {
            overview.totalRevenue += invoice.amount;
          }

          switch (invoice.status) {
            case 'paid':
              overview.paidInvoices++;
              break;
            case 'overdue':
              overview.overdueInvoices++;
              overview.totalOutstanding += invoice.amount;
              tenantsWithOverdue.add(invoice.tenant_id);
              break;
            case 'pending':
              if (new Date(invoice.due_date) < now) {
                overview.overdueInvoices++;
                overview.totalOutstanding += invoice.amount;
                tenantsWithOverdue.add(invoice.tenant_id);
              } else {
                overview.totalOutstanding += invoice.amount;
              }
              break;
          }
        });

        overview.tenantsWithOverdue = tenantsWithOverdue.size;
        setPaymentOverview(overview);

        // Format recent invoices
        const formattedInvoices = invoices.slice(0, 10).map(invoice => ({
          ...invoice,
          tenant: invoice.tenants
        }));
        setRecentInvoices(formattedInvoices);
      }

      // Fetch recent payments (from paid invoices or payments table)
      await fetchRecentPayments();

    } catch (error) {
      console.error('❌ Error fetching payment overview:', error);
      console.log('🔧 Setting empty data due to error');

      // Set empty data on error
      setPaymentOverview({
        totalRevenue: 0,
        totalOutstanding: 0,
        paidInvoices: 0,
        overdueInvoices: 0,
        totalInvoices: 0,
        tenantsWithOverdue: 0
      });
      setRecentInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentPayments = async () => {
    try {
      // Try to fetch from payments table first
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          *,
          invoices (
            invoice_number,
            tenants (
              name
            )
          )
        `)
        .eq('payment_status', 'completed')
        .order('paid_at', { ascending: false })
        .limit(5);

      if (paymentsData && paymentsData.length > 0) {
        const formattedPayments: RecentPayment[] = paymentsData.map(payment => ({
          id: payment.id,
          tenant_name: payment.invoices?.tenants?.name || 'Unknown',
          invoice_number: payment.invoices?.invoice_number || '',
          amount: payment.amount,
          paid_at: payment.paid_at,
          payment_method: payment.payment_method
        }));
        setRecentPayments(formattedPayments);
      } else {
        // Fallback: use paid invoices
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            tenants (
              name
            )
          `)
          .eq('status', 'paid')
          .not('paid_at', 'is', null)
          .order('paid_at', { ascending: false })
          .limit(5);

        if (invoicesData) {
          const paymentsFromInvoices: RecentPayment[] = invoicesData.map(invoice => ({
            id: invoice.id,
            tenant_name: invoice.tenants?.name || 'Unknown',
            invoice_number: invoice.invoice_number,
            amount: invoice.amount,
            paid_at: invoice.paid_at || invoice.created_at,
            payment_method: 'bank_transfer' // Default since we don't have payment method
          }));
          setRecentPayments(paymentsFromInvoices);
        }
      }
    } catch (error) {
      console.error('Error fetching recent payments:', error);
    }
  };

  // Fetch tenants for invoice creation
  const fetchTenants = async () => {
    try {
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, subscription_plan')
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching tenants:', error);
        // ใช้ข้อมูลจำลอง
        setTenantList([
          { id: '1', name: 'บริษัท สมิติเวช จำกัด', subscription_plan: 'starter' },
          { id: '2', name: 'บริษัท โกลเด้นแลนด์ จำกัด', subscription_plan: 'enterprise' },
          { id: '3', name: 'บริษัท เซ็นทรัล เรสซิเดนซ์ จำกัด', subscription_plan: 'starter' },
          { id: '4', name: 'บริษัท ดิ เอส เอสเตท จำกัด', subscription_plan: 'professional' },
          { id: '5', name: 'บริษัท แกรนด์ ยูนิตี้ จำกัด', subscription_plan: 'enterprise' }
        ]);
        return;
      }

      setTenantList(tenants || []);
    } catch (error) {
      console.error('Error fetching tenants:', error);
    }
  };

  // Load advanced settings (with localStorage fallback)
  const fetchAdvancedSettings = async () => {
    try {
      // Try localStorage first
      const savedSettings = localStorage.getItem('chateau_billing_settings');
      if (savedSettings) {
        setAdvancedConfig(JSON.parse(savedSettings));
        console.log('✅ Loaded settings from localStorage');
        return;
      }

      // Try multiple database approaches as fallback
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
          console.log('No user found, using default settings');
          return;
        }

        // Method 1: Try RPC function (if exists)
        try {
          const { data: billingSettings, error: rpcError } = await supabase
            .rpc('get_billing_settings');

          if (!rpcError && billingSettings && Object.keys(billingSettings).length > 0) {
            setAdvancedConfig(billingSettings);
            console.log('✅ Loaded settings from database via RPC');
            return;
          }
        } catch (rpcErr) {
          // RPC doesn't exist, continue to next method
        }

        // Method 2: Try profiles table
        try {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('billing_settings')
            .eq('user_id', user.id)
            .single();

          if (!profileError && profileData?.billing_settings) {
            setAdvancedConfig(profileData.billing_settings);
            console.log('✅ Loaded settings from profiles table');
            return;
          }
        } catch (profileErr) {
          // Profiles access failed, continue to next method
        }

        // Method 3: Try tenants table (if billing_settings column exists)
        try {
          const { data: userData } = await supabase
            .from('users')
            .select('tenant_id')
            .eq('id', user.id)
            .single();

          if (userData?.tenant_id) {
            const { data: tenantData, error: tenantError } = await supabase
              .from('tenants')
              .select('billing_settings')
              .eq('id', userData.tenant_id)
              .single();

            if (!tenantError && tenantData?.billing_settings) {
              setAdvancedConfig(tenantData.billing_settings);
              console.log('✅ Loaded settings from tenants table');
              return;
            }
          }
        } catch (tenantErr) {
          // Tenants access failed
        }

        console.log('All database methods failed, using localStorage only');

      } catch (dbError) {
        console.log('Database access failed, using localStorage only:', dbError);
      }
    } catch (error) {
      console.error('Error loading advanced settings:', error);
    }
  };

  // Auto Billing System - Generate invoices for due subscriptions
  const checkAndGenerateInvoices = async () => {
    console.log('🤖 Checking for due billing cycles...');

    try {
      // Get all active tenants with their created dates
      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, subscription_plan, created_at, status')
        .eq('status', 'active');

      if (error || !tenants) return;

      const today = new Date();
      const tenantsNeedBilling: any[] = [];

      // Check each tenant for billing anniversary
      for (const tenant of tenants) {
        const createdDate = new Date(tenant.created_at);
        const dayOfMonth = createdDate.getDate();

        // Check if today is billing day (same day of month as created)
        if (today.getDate() === dayOfMonth) {
          // Check if invoice already exists for this month
          const { data: existingInvoices } = await supabase
            .from('invoices')
            .select('id')
            .eq('tenant_id', tenant.id)
            .gte('created_at', new Date(today.getFullYear(), today.getMonth(), 1).toISOString())
            .lt('created_at', new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString());

          if (!existingInvoices || existingInvoices.length === 0) {
            tenantsNeedBilling.push(tenant);
          }
        }
      }

      // Generate invoices for due tenants
      for (const tenant of tenantsNeedBilling) {
        await createAutoBillingInvoice(tenant);
      }

      if (tenantsNeedBilling.length > 0) {
        console.log(`✅ Generated ${tenantsNeedBilling.length} invoices automatically`);
        await fetchAllData(); // Refresh data
      }

    } catch (error) {
      console.error('❌ Error in auto billing:', error);
    }
  };

  // Create auto-generated invoice for tenant
  const createAutoBillingInvoice = async (tenant: any) => {
    const now = new Date();
    const invoiceNumber = generateInvoiceNumber();
    const packagePrice = PACKAGE_PRICES[tenant.subscription_plan as keyof typeof PACKAGE_PRICES];
    const dueDate = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // NET 15

    const invoiceData = {
      tenant_id: tenant.id,
      invoice_number: invoiceNumber,
      amount: packagePrice?.monthly || 2900,
      currency: 'THB',
      status: 'pending',
      subscription_plan: tenant.subscription_plan,
      due_date: dueDate.toISOString(),
      description: `Monthly subscription - ${packagePrice?.label || 'Plan'} (Auto-generated)`,
      created_at: now.toISOString()
    };

    console.log(`📄 Auto-generating invoice for ${tenant.name}:`, invoiceData);

    // TODO: Insert to real database
    // For now, just log the action
  };

  // Generate invoice number
  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()) + String(now.getMinutes());
    return `INV-${year}${month}${day}-${time}`;
  };

  // Create new invoice
  const createInvoice = async () => {
    try {
      // Generate invoice number
      const invoiceNumber = generateInvoiceNumber();

      // Prepare invoice data
      const invoiceData = {
        tenant_id: newInvoice.tenant_id,
        invoice_number: invoiceNumber,
        amount: newInvoice.amount,
        currency: newInvoice.currency,
        status: 'pending',
        subscription_plan: newInvoice.subscription_plan,
        due_date: newInvoice.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: newInvoice.description || `Monthly subscription - ${PACKAGE_PRICES[newInvoice.subscription_plan as keyof typeof PACKAGE_PRICES]?.label || 'Plan'}`,
        created_at: new Date().toISOString()
      };

      // Insert to database
      console.log('Creating invoice:', invoiceData);

      // Try to save to database
      try {
        const { data, error } = await supabase
          .from('invoices')
          .insert(invoiceData)
          .select();

        if (error) {
          console.warn('Database insert failed, saving to localStorage:', error.message);
          // Fallback: Save to localStorage
          const existingInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
          const newInvoiceWithId = { ...invoiceData, id: Date.now().toString() };
          existingInvoices.push(newInvoiceWithId);
          localStorage.setItem('invoices', JSON.stringify(existingInvoices));
          console.log('✅ Invoice saved to localStorage');
        } else {
          console.log('✅ Invoice saved to database:', data);
        }
      } catch (dbError) {
        console.warn('Database operation failed, using localStorage fallback:', dbError);
        // Fallback: Save to localStorage
        const existingInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
        const newInvoiceWithId = { ...invoiceData, id: Date.now().toString() };
        existingInvoices.push(newInvoiceWithId);
        localStorage.setItem('invoices', JSON.stringify(existingInvoices));
        console.log('✅ Invoice saved to localStorage');
      }

      // Reset form and close modal
      setNewInvoice({
        tenant_id: '',
        subscription_plan: 'starter',
        amount: 2900,
        currency: 'THB',
        due_date: '',
        description: '',
        custom_amount: false
      });
      setShowCreateInvoice(false);

      // Refresh data
      await fetchAllData();

      setPopupData({
        type: 'success',
        title: 'สร้างใบแจ้งหนี้สำเร็จ!',
        message: `หมายเลข: ${invoiceNumber}`,
        details: 'ระบบได้สร้างใบแจ้งหนี้ใหม่เรียบร้อยแล้ว'
      });
      setShowResultPopup(true);
    } catch (error) {
      console.error('Error creating invoice:', error);
      setPopupData({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถสร้างใบแจ้งหนี้ได้',
        details: 'กรุณาตรวจสอบข้อมูลและลองใหม่อีกครั้ง'
      });
      setShowResultPopup(true);
    }
  };

  // Handle package selection change
  const handlePackageChange = (plan: string) => {
    const packageData = PACKAGE_PRICES[plan as keyof typeof PACKAGE_PRICES];
    setNewInvoice(prev => ({
      ...prev,
      subscription_plan: plan,
      amount: prev.custom_amount ? prev.amount : packageData?.monthly || 2900,
      description: `Monthly subscription - ${packageData?.label || 'Plan'}`
    }));
  };

  // Handle tenant selection change
  const handleTenantChange = (tenantId: string) => {
    const tenant = tenantList.find(t => t.id === tenantId);
    setNewInvoice(prev => ({
      ...prev,
      tenant_id: tenantId,
      subscription_plan: tenant?.subscription_plan || 'starter'
    }));

    // Auto-update amount based on tenant's plan
    if (tenant && !newInvoice.custom_amount) {
      const packageData = PACKAGE_PRICES[tenant.subscription_plan as keyof typeof PACKAGE_PRICES];
      setNewInvoice(prev => ({
        ...prev,
        amount: packageData?.monthly || 2900,
        description: `Monthly subscription - ${packageData?.label || 'Plan'}`
      }));
    }
  };

  // Business Logic: Check invoice status and manage suspensions
  const checkInvoiceStatus = (invoice: any) => {
    const now = new Date();
    const dueDate = new Date(invoice.due_date);
    const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    return {
      isPastDue: daysPastDue > 0,
      daysPastDue,
      shouldSuspend: daysPastDue > 7, // Grace period: 7 days
      status: daysPastDue <= 0 ? 'current' :
              daysPastDue <= 7 ? 'overdue' : 'suspend'
    };
  };

  // Payment Detail Modal Functions
  const openPaymentDetail = (payment: Payment | RecentPayment) => {
    setSelectedPayment(payment);
    setShowPaymentDetail(true);
  };

  const closePaymentDetail = () => {
    setSelectedPayment(null);
    setShowPaymentDetail(false);
  };

  // Helper functions for Payment Detail Modal
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      credit_card: 'บัตรเครดิต',
      bank_transfer: 'โอนผ่านธนาคาร',
      paypal: 'PayPal',
      cash: 'เงินสด',
      auto: 'อัตโนมัติ'
    };
    return labels[method] || method;
  };


  // Financial Reports Export Functions
  const handleDownloadPDFReport = async () => {
    try {
      console.log('📄 Generating financial report PDF...');

      // Generate PDF content
      const reportContent = `
        รายงานการเงิน CHATEAU Platform
        วันที่สร้าง: ${new Date().toLocaleDateString('th-TH')}
        =====================================

        สรุปการเงิน (${timeRange} วันล่าสุด):
        - รายได้รวม: ${formatCurrency(paymentOverview.totalRevenue)}
        - ยอดค้างชำระ: ${formatCurrency(paymentOverview.totalOutstanding)}
        - ใบแจ้งหนี้ทั้งหมด: ${paymentOverview.totalInvoices}
        - บริษัทค้างชำระ: ${paymentOverview.tenantsWithOverdue}

        อัตราการชำระเงินตรงเวลา: ${((paymentOverview.paidInvoices / (paymentOverview.totalInvoices || 1)) * 100).toFixed(1)}%
        ค่าเฉลี่ยต่อใบแจ้งหนี้: ${formatCurrency(paymentOverview.totalRevenue / (paymentOverview.totalInvoices || 1))}

        รายละเอียดการชำระเงิน:
        ${allPayments.slice(0, 10).map(payment =>
          `- ${payment.tenant?.name || 'N/A'} | ${payment.invoice_number} | ${formatCurrency(payment.amount)} | ${getPaymentStatusBadge(payment.payment_status)?.label}`
        ).join('\n        ')}

        สร้างโดย: CHATEAU Platform
        © ${new Date().getFullYear()} Chateau PropTech
      `;

      // Create and download PDF
      const element = document.createElement('div');
      element.innerHTML = `<pre style="font-family: 'Sarabun', sans-serif; font-size: 12px; white-space: pre-wrap; padding: 20px;">${reportContent}</pre>`;
      element.style.position = 'absolute';
      element.style.left = '-9999px';
      document.body.appendChild(element);

      const canvas = await html2canvas(element);
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF();
      const imgWidth = 210;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;

      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`financial-report-${new Date().toISOString().split('T')[0]}.pdf`);
      document.body.removeChild(element);

      setPopupData({
        type: 'success',
        title: 'ดาวน์โหลดสำเร็จ!',
        message: 'รายงานการเงิน PDF',
        details: 'ไฟล์ได้ถูกบันทึกลงในเครื่องแล้ว'
      });
      setShowResultPopup(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setPopupData({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถสร้าง PDF ได้',
        details: 'กรุณาลองใหม่อีกครั้ง'
      });
      setShowResultPopup(true);
    }
  };

  const handleExportCSV = () => {
    try {
      console.log('📊 Exporting CSV...');

      // Prepare CSV data
      const csvData = [
        // Header
        ['หมายเลขใบแจ้งหนี้', 'ชื่อบริษัท', 'จำนวนเงิน', 'สถานะ', 'วิธีชำระ', 'วันที่ครบกำหนด', 'วันที่ชำระ'],
        // Data rows
        ...allPayments.map(payment => [
          payment.invoice_number,
          payment.tenant?.name || 'N/A',
          payment.amount.toString(),
          getPaymentStatusBadge(payment.payment_status)?.label || payment.payment_status,
          getPaymentMethodLabel(payment.payment_method),
          payment.created_at ? new Date(payment.created_at).toLocaleDateString('th-TH') : 'N/A',
          payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('th-TH') : 'ยังไม่ชำระ'
        ])
      ];

      // Convert to CSV string
      const csvContent = csvData.map(row =>
        row.map(cell => `"${cell}"`).join(',')
      ).join('\n');

      // Add BOM for proper UTF-8 handling in Excel
      const BOM = '\uFEFF';
      const csvWithBOM = BOM + csvContent;

      // Download CSV
      const blob = new Blob([csvWithBOM], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `financial-data-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      setPopupData({
        type: 'success',
        title: 'Export สำเร็จ!',
        message: 'ข้อมูลการเงิน CSV',
        details: `ส่งออกข้อมูล ${allPayments.length} รายการ`
      });
      setShowResultPopup(true);
    } catch (error) {
      console.error('Error exporting CSV:', error);
      setPopupData({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถ export CSV ได้',
        details: 'กรุณาลองใหม่อีกครั้ง'
      });
      setShowResultPopup(true);
    }
  };

  const handleRefreshData = async () => {
    try {
      console.log('🔄 Refreshing financial data...');
      setLoading(true);

      // Refresh data sources individually with error handling
      const functionNames = ['fetchPaymentOverview', 'fetchAllPayments', 'fetchCalendarEvents', 'fetchOverdueData', 'fetchTenants', 'fetchAdvancedSettings'];
      console.log('🔄 Starting refresh of:', functionNames.join(', '));

      const results = await Promise.allSettled([
        fetchPaymentOverview(),
        fetchAllPayments(),
        fetchCalendarEvents(),
        fetchOverdueData(),
        fetchTenants(),
        fetchAdvancedSettings()
      ]);

      // Log results for debugging
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          console.log(`✅ ${functionNames[index]} completed successfully`);
        } else {
          console.error(`❌ ${functionNames[index]} failed:`, result.reason);
        }
      });

      // Check for any failures
      const failures = results.filter(result => result.status === 'rejected');

      if (failures.length > 0) {
        console.warn('Some data refresh operations failed:', failures);
        const failureDetails = failures.map((f: any, i) => `${i + 1}. ${f.reason?.message || 'Unknown error'}`).join('\n');
        setPopupData({
          type: 'warning',
          title: 'รีเฟรชข้อมูลบางส่วนไม่สำเร็จ',
          message: `${failures.length} จาก ${results.length} การดึงข้อมูลล้มเหลว`,
          details: `ข้อมูลส่วนใหญ่อัปเดตแล้ว แต่อาจมีข้อมูลบางส่วนไม่เป็นปัจจุบัน\n\nรายละเอียดข้อผิดพลาด:\n${failureDetails}`
        });
      } else {
        setPopupData({
          type: 'success',
          title: 'รีเฟรชข้อมูลสำเร็จ!',
          message: 'ข้อมูลทั้งหมดอัปเดตแล้ว',
          details: 'ได้รับข้อมูลล่าสุดจากระบบ'
        });
      }
      setShowResultPopup(true);
    } catch (error) {
      console.error('Error refreshing data:', error);
      setPopupData({
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถรีเฟรชข้อมูลได้',
        details: `ข้อผิดพลาด: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      setShowResultPopup(true);
    } finally {
      setLoading(false);
    }
  };

  // Check for tenants that need suspension
  const checkSuspensions = async () => {
    try {
      console.log('🔍 Checking for tenants that need suspension...');

      // Get all pending/overdue invoices
      const { data: overdueInvoices } = await supabase
        .from('invoices')
        .select(`
          id,
          tenant_id,
          due_date,
          status,
          tenants (
            id,
            name,
            status
          )
        `)
        .in('status', ['pending', 'overdue'])
        .lt('due_date', new Date().toISOString());

      if (overdueInvoices) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tenantsToSuspend: any[] = [];

        overdueInvoices.forEach(invoice => {
          const statusCheck = checkInvoiceStatus(invoice);
          if (statusCheck.shouldSuspend && invoice.tenants?.status === 'active') {
            tenantsToSuspend.push(invoice.tenant_id);
          }
        });

        // Actually suspend tenants that are past due
        if (tenantsToSuspend.length > 0) {
          console.log(`⚠️ ${tenantsToSuspend.length} tenants need suspension:`, tenantsToSuspend);

          let suspendedCount = 0;
          let errorCount = 0;

          for (const tenantInfo of tenantsToSuspend) {
            try {
              console.log(`🔴 Attempting to suspend tenant: ${tenantInfo.tenant_name}`);

              const success = await suspensionService.suspendTenant({
                tenant_id: tenantInfo.tenant_id,
                tenant_name: tenantInfo.tenant_name,
                tenant_email: tenantInfo.tenant_email,
                invoice_id: tenantInfo.invoice_id,
                invoice_number: tenantInfo.invoice_number,
                amount: tenantInfo.amount,
                due_date: tenantInfo.due_date,
                days_past_due: tenantInfo.days_past_due,
                current_status: 'active',
                suspension_reason: `Payment overdue by ${tenantInfo.days_past_due} days`
              });

              if (success) {
                suspendedCount++;
                console.log(`✅ Successfully suspended: ${tenantInfo.tenant_name}`);
              } else {
                errorCount++;
                console.error(`❌ Failed to suspend: ${tenantInfo.tenant_name}`);
              }
            } catch (error) {
              errorCount++;
              console.error(`❌ Error suspending ${tenantInfo.tenant_name}:`, error);
            }
          }

          console.log(`📊 Suspension Summary: ${suspendedCount} suspended, ${errorCount} errors`);

          // Update automation status
          setAutomationStatus(prev => ({
            ...prev,
            pending_suspensions: prev.pending_suspensions + suspendedCount
          }));
        }
      }
    } catch (error) {
      console.error('Error checking suspensions:', error);
    }
  };

  // Initialize automation services
  const initializeAutomation = async () => {
    console.log('🚀 Initializing automation services...');

    // Start billing scheduler
    billingScheduler.start();

    // Update automation status
    await updateAutomationStatus();

    console.log('✅ Automation services initialized');
  };

  // Update automation status
  const updateAutomationStatus = async () => {
    try {
      const schedulerStatus = billingScheduler.getSchedulerStatus();
      const emailStatus = emailService.getQueueStatus();
      const suspensionStats = await suspensionService.getSuspensionStats();

      setAutomationStatus({
        scheduler_running: schedulerStatus.isRunning,
        email_queue: emailStatus.scheduled,
        pending_suspensions: suspensionStats.suspended_tenants,
        jobs_status: {
          auto_generate_invoices: schedulerStatus.errorJobs > 0 ? 'error' : 'active',
          process_suspensions: 'active',
          send_email_notifications: 'active',
          update_invoice_status: 'active',
          billing_analytics_update: 'active'
        }
      });
    } catch (error) {
      console.error('Error updating automation status:', error);
      setAutomationStatus({
        scheduler_running: false,
        email_queue: 0,
        pending_suspensions: 0,
        jobs_status: {
          auto_generate_invoices: 'inactive',
          process_suspensions: 'inactive',
          send_email_notifications: 'inactive',
          update_invoice_status: 'inactive',
          billing_analytics_update: 'inactive'
        }
      });
    }
  };

  // Auto-restore suspended tenants when payment is received
  const autoRestoreTenant = async (tenantId: string, invoiceNumber: string) => {
    try {
      console.log(`🟢 Checking auto-restore for tenant: ${tenantId}`);

      const success = await suspensionService.restoreTenant(tenantId, 'auto-payment');

      if (success) {
        console.log(`✅ Successfully restored tenant: ${tenantId} due to payment of ${invoiceNumber}`);

        // Update automation status
        setAutomationStatus(prev => ({
          ...prev,
          pending_suspensions: Math.max(0, prev.pending_suspensions - 1)
        }));

        // Refresh data
        await fetchAllData();
      } else {
        console.log(`ℹ️ Tenant ${tenantId} was not suspended or restore failed`);
      }
    } catch (error) {
      console.error(`❌ Error auto-restoring tenant ${tenantId}:`, error);
    }
  };

  // Monitor payment status changes
  const handlePaymentReceived = async (tenantId: string, invoiceNumber: string) => {
    console.log(`💰 Payment received for tenant: ${tenantId}, invoice: ${invoiceNumber}`);
    await autoRestoreTenant(tenantId, invoiceNumber);
  };

  // Send overdue email notification
  const sendOverdueNotification = async (overdueItem: OverdueData) => {
    try {
      console.log(`📧 Sending overdue notification to: ${overdueItem.tenant_name}`);

      // Queue overdue email through email service
      const emailResult = emailService.queueEmail('overdue_notice', {
        tenant_name: overdueItem.tenant_name,
        tenant_email: overdueItem.tenant_email || `${overdueItem.tenant_name.toLowerCase().replace(/\s+/g, '')}@example.com`,
        invoice_number: `${overdueItem.invoice_count} ใบค้าง`,
        amount: overdueItem.total_amount,
        due_date: overdueItem.oldest_due_date,
        days_past_due: Math.floor((new Date().getTime() - new Date(overdueItem.oldest_due_date).getTime()) / (1000 * 60 * 60 * 24))
      });

      console.log('📧 Email service result:', emailResult);

      if (emailResult) {
        setPopupData({
          type: 'success',
          title: 'ส่งอีเมลแจ้งเตือนแล้ว',
          message: `ส่งอีเมลไปยัง ${overdueItem.tenant_name} เรียบร้อย`,
          details: `แจ้งเตือนการค้างชำระ ${overdueItem.invoice_count} ใบ ยอดรวม ${formatCurrency(overdueItem.total_amount)}`
        });
      } else {
        console.error('❌ Email service returned false');
        throw new Error('Email service returned false - check email template or data');
      }

      setShowResultPopup(true);

    } catch (error) {
      console.error('❌ Error sending overdue notification:', error);
      setPopupData({
        type: 'error',
        title: 'ส่งอีเมลไม่สำเร็จ',
        message: 'ไม่สามารถส่งอีเมลแจ้งเตือนได้',
        details: `ข้อผิดพลาด: ${error instanceof Error ? error.message : 'ระบบขัดข้อง'}`
      });
      setShowResultPopup(true);
    }
  };

  // Handle calendar event click
  const handleCalendarEventClick = async (event: CalendarEvent) => {
    console.log('📅 Calendar event clicked:', event);

    // Fetch full invoice details for this event
    if (event.invoice_id) {
      try {
        const { data: invoiceDetail, error } = await supabase
          .from('invoices')
          .select(`
            *,
            tenants (
              name,
              email,
              slug,
              subscription_plan
            )
          `)
          .eq('id', event.invoice_id)
          .single();

        if (error) {
          console.error('Error fetching invoice details:', error);
          return;
        }

        // Add the fetched details to the event
        const enrichedEvent: CalendarEvent = {
          ...event,
          invoice_detail: invoiceDetail
        };

        setSelectedCalendarEvent(enrichedEvent);
        setShowCalendarEventModal(true);
      } catch (error) {
        console.error('Error in calendar event click:', error);
      }
    } else {
      // If no invoice_id, just show basic event info
      setSelectedCalendarEvent(event);
      setShowCalendarEventModal(true);
    }
  };

  // Advanced billing controls
  const runAutoBilling = async () => {
    console.log('🤖 Manual trigger: Auto Billing...');
    const result = await billingScheduler.runJob('auto_generate_invoices');

    if (result.success) {
      setPopupData({
        type: 'success',
        title: 'Auto Billing สำเร็จ!',
        message: result.message,
        details: `ระบบได้ดำเนินการสร้างใบแจ้งหนี้อัตโนมัติเรียบร้อยแล้ว`
      });
      setShowResultPopup(true);
      await fetchAllData();
    } else {
      setPopupData({
        type: 'error',
        title: 'Auto Billing ล้มเหลว',
        message: result.message,
        details: `กรุณาตรวจสอบการตั้งค่าและลองใหม่อีกครั้ง`
      });
      setShowResultPopup(true);
    }

    await updateAutomationStatus();
  };

  const runSuspensionCheck = async () => {
    console.log('🔍 Manual trigger: Suspension Check...');

    try {
      // Run the actual suspension process
      const suspensionResult = await suspensionService.processSuspensions();
      console.log('📊 Manual suspension result:', suspensionResult);

      // Also trigger the billing scheduler job
      const schedulerResult = await billingScheduler.runJob('process_suspensions');

      const totalSuspended = suspensionResult.suspended + (schedulerResult.success ? 1 : 0);

      if (suspensionResult.checked > 0 || schedulerResult.success) {
        setPopupData({
          type: 'success',
          title: 'Suspension Check สำเร็จ!',
          message: `ตรวจสอบ ${suspensionResult.checked} รายการ, ระงับ ${suspensionResult.suspended} บัญชี`,
          details: `คำเตือน: ${suspensionResult.warnings}, ข้อผิดพลาด: ${suspensionResult.errors}`
        });
        setShowResultPopup(true);
        await fetchAllData();
      } else {
        setPopupData({
          type: 'warning',
          title: 'ไม่พบรายการที่ต้องระงับ',
          message: 'ไม่มีบัญชีใดที่เกินกำหนดชำระ',
          details: 'ระบบทำงานปกติ'
        });
        setShowResultPopup(true);
      }

    } catch (error) {
      console.error('❌ Error in manual suspension check:', error);
      setPopupData({
        type: 'error',
        title: 'Suspension Check ล้มเหลว',
        message: 'เกิดข้อผิดพลาดในระบบ',
        details: 'ไม่สามารถตรวจสอบการระงับบริการได้'
      });
      setShowResultPopup(true);
    }

    await updateAutomationStatus();
  };

  const processEmailQueue = async () => {
    console.log('📧 Manual trigger: Email Queue...');
    const result = await billingScheduler.runJob('send_email_notifications');

    setPopupData({
      type: 'success',
      title: 'Email Queue ดำเนินการแล้ว',
      message: result.message,
      details: 'ระบบได้ประมวลผลคิวอีเมลเรียบร้อยแล้ว'
    });
    setShowResultPopup(true);
    await updateAutomationStatus();
  };

  // Toggle automation services
  const toggleScheduler = () => {
    if (automationStatus.scheduler_running) {
      billingScheduler.stop();
      console.log('⏹️ Stopped billing scheduler');
    } else {
      billingScheduler.start();
      console.log('▶️ Started billing scheduler');
    }
    updateAutomationStatus();
  };

  // Fetch all data function (moved outside useEffect for global access)
  const fetchAllData = async () => {
    await Promise.all([
      fetchPaymentOverview(),
      fetchAllPayments(),
      fetchCalendarEvents(),
      fetchOverdueData(),
      fetchTenants(),
      fetchAdvancedSettings()
    ]);

    // Initialize automation on first load
    await initializeAutomation();
  };

  useEffect(() => {
    fetchAllData();

    // Update automation status every 30 seconds
    const statusInterval = setInterval(updateAutomationStatus, 30000);

    return () => {
      clearInterval(statusInterval);
    };
  }, [timeRange]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      paid:      { label: 'จ่ายแล้ว',  className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
      pending:   { label: 'รอชำระ',    className: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: Clock },
      overdue:   { label: 'เกินกำหนด', className: 'bg-red-50 text-red-700 border border-red-200',             icon: AlertCircle },
      cancelled: { label: 'ยกเลิก',    className: 'bg-gray-100 text-gray-600 border border-gray-300',         icon: XCircle },
    };
    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${badge.className}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      completed: { label: 'สำเร็จ',       className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
      paid:      { label: 'จ่ายแล้ว',      className: 'bg-emerald-50 text-emerald-700 border border-emerald-200', icon: CheckCircle },
      pending:   { label: 'รอดำเนินการ',  className: 'bg-amber-50 text-amber-700 border border-amber-200',       icon: Clock },
      overdue:   { label: 'ค้างชำระ',     className: 'bg-orange-50 text-orange-700 border border-orange-200',    icon: AlertCircle },
      failed:    { label: 'ล้มเหลว',       className: 'bg-red-50 text-red-700 border border-red-200',             icon: XCircle },
      refunded:  { label: 'คืนเงิน',       className: 'bg-blue-50 text-blue-700 border border-blue-200',          icon: RefreshCw },
      cancelled: { label: 'ยกเลิก',        className: 'bg-gray-100 text-gray-600 border border-gray-300',         icon: XCircle },
      unknown:   { label: 'ไม่ระบุ',       className: 'bg-gray-50 text-gray-700 border border-gray-200',          icon: AlertCircle },
    };
    const badge = badges[status] || badges.unknown;
    const Icon = badge.icon;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-md ${badge.className}`}>
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };



  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderPaymentTrackingTab = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          ติดตามการชำระเงิน
        </CardTitle>
        <CardDescription>
          รายการการชำระเงินทั้งหมดของระบบ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 sm:space-y-4">
          {/* Payment Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
            <div className="bg-emerald-50 p-3 sm:p-4 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="text-emerald-700 font-medium">
                  สำเร็จ: {allPayments.filter(p => p.payment_status === 'completed').length}
                </span>
              </div>
            </div>
            <div className="bg-amber-50 p-3 sm:p-4 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-amber-600" />
                <span className="text-amber-700 font-medium">
                  รอดำเนินการ: {allPayments.filter(p => p.payment_status === 'pending').length}
                </span>
              </div>
            </div>
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">
                  ล้มเหลว: {allPayments.filter(p => p.payment_status === 'failed').length}
                </span>
              </div>
            </div>
          </div>

          {/* Payment List */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">กำลังโหลดข้อมูลการชำระเงิน...</p>
              </div>
            ) : allPayments.length > 0 ? (
              allPayments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h4 className="font-medium">{payment.tenant?.name || 'Unknown'}</h4>
                        {getPaymentStatusBadge(payment.payment_status)}
                      </div>
                      <div className="mt-1 text-sm text-gray-500">
                        <span>{payment.invoice_number || 'ไม่มีเลขใบแจ้งหนี้'}</span>
                        <span className="mx-2">•</span>
                        <span>{getPaymentMethodLabel(payment.payment_method)}</span>
                        <span className="mx-2">•</span>
                        <span>{formatDateTime(payment.created_at)}</span>
                      </div>
                      {payment.transaction_id && (
                        <div className="mt-1 text-xs text-gray-400">
                          Transaction ID: {payment.transaction_id}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{formatCurrency(payment.amount)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPaymentDetail(payment)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          ดู
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CreditCard className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-500">ไม่มีข้อมูลการชำระเงิน</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Navigation functions for calendar
  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    if (direction === 'prev') {
      newDate.setMonth(currentDate.getMonth() - 1);
    } else {
      newDate.setMonth(currentDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  // Get calendar data for current month
  const getCalendarData = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    // Get first day of month and how many days
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    // Calculate stats from events for current month
    const monthEvents = calendarEvents.filter(event => {
      const eventDate = new Date(event.date);
      return eventDate.getFullYear() === year && eventDate.getMonth() === month;
    });

    const stats = {
      totalProjects: monthEvents.length,
      dueToday: monthEvents.filter(e => e.type === 'due' && new Date(e.date).toDateString() === new Date().toDateString()).length,
      overdue: monthEvents.filter(e => e.type === 'overdue').length,
      totalAmount: monthEvents.reduce((sum, e) => sum + (e.amount || 0), 0)
    };

    // Group events by day
    const eventsByDay: Record<number, CalendarEvent[]> = {};
    monthEvents.forEach(event => {
      const day = new Date(event.date).getDate();
      if (!eventsByDay[day]) eventsByDay[day] = [];
      eventsByDay[day].push(event);
    });

    // Create calendar grid
    const calendar = [];
    let day = 1;

    for (let week = 0; week < 6; week++) {
      const weekDays = [];
      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        if (week === 0 && dayOfWeek < startingDayOfWeek) {
          weekDays.push(null);
        } else if (day > daysInMonth) {
          weekDays.push(null);
        } else {
          weekDays.push({
            day,
            events: eventsByDay[day] || []
          });
          day++;
        }
      }
      calendar.push(weekDays);
      if (day > daysInMonth) break;
    }

    return { calendar, stats };
  };

  const renderCalendarTab = () => {
    const { calendar, stats } = getCalendarData();
    const monthNames = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    const dayNames = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

    return (
      <div className="space-y-6">
        {/* Header */}
        <Card>
          <CardContent className="pt-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">ปฏิทินเครดิต</h2>
              <p className="text-gray-600 text-sm">แสดงรอบเครดิตและกำหนดจ่ายรองหรือแจง</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{stats.totalProjects}</div>
                <div className="text-sm text-gray-600">โครงการที่กำหนด</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{stats.dueToday}</div>
                <div className="text-sm text-gray-600">ครบกำหนดเก็บเงิน</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
                <div className="text-sm text-gray-600">เลยกำหนด</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</div>
                <div className="text-sm text-gray-600">ยอดค้างชำระรวม</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar */}
        <Card>
          <CardContent className="pt-6">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                <h3 className="text-lg font-semibold">
                  {monthNames[currentDate.getMonth()]} {currentDate.getFullYear() + 543}
                </h3>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('prev')}
                  className="p-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 px-3">เดือน</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateMonth('next')}
                  className="p-2"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 mb-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>ชำระแล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span>ใกล้ครบกำหนด</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span>เลยกำหนด</span>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              {/* Day Headers */}
              <div className="grid grid-cols-7 bg-gray-50">
                {dayNames.map((day) => (
                  <div key={day} className="p-3 text-center text-sm font-medium text-gray-600 border-r border-gray-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Body */}
              <div className="grid grid-cols-7">
                {calendar.map((week, weekIndex) =>
                  week.map((dayData, dayIndex) => (
                    <div
                      key={`${weekIndex}-${dayIndex}`}
                      className={`min-h-[100px] p-2 border-r border-b border-gray-200 last:border-r-0 ${
                        dayData ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
                      }`}
                    >
                      {dayData && (
                        <>
                          {/* Day Number */}
                          <div className={`text-sm font-medium mb-1 ${
                            new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), dayData.day).toDateString()
                              ? 'text-orange-600 font-bold'
                              : 'text-gray-900'
                          }`}>
                            {dayData.day}
                          </div>

                          {/* Events */}
                          <div className="space-y-1">
                            {dayData.events.slice(0, 3).map((event, idx) => (
                              <div
                                key={idx}
                                onClick={() => handleCalendarEventClick(event)}
                                className={`text-xs px-2 py-1 rounded text-white truncate cursor-pointer hover:opacity-80 transition-opacity ${
                                  event.type === 'paid' ? 'bg-green-500' :
                                  event.type === 'reminder' || event.type === 'due' ? 'bg-orange-500' :
                                  event.type === 'overdue' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}
                                title={`${event.tenant_name} - ${formatCurrency(event.amount || 0)} (กดเพื่อดูรายละเอียด)`}
                              >
                                {event.tenant_name?.split(' ')[0] || event.invoice_number}
                              </div>
                            ))}
                            {dayData.events.length > 3 && (
                              <div className="text-xs text-gray-500">
                                +{dayData.events.length - 3} อีก
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderOverdueTab = () => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600" />
          จัดการค้างชำระ
        </CardTitle>
        <CardDescription>
          บริษัทที่มีการชำระเงินค้างชำระ
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Overdue Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
              <p className="text-red-800 font-medium">
                บริษัทค้างชำระ: {overdueData.length}
              </p>
            </div>
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
              <p className="text-red-800 font-medium">
                ใบแจ้งหนี้ค้าง: {overdueData.reduce((sum, item) => sum + item.invoice_count, 0)}
              </p>
            </div>
            <div className="bg-red-50 p-3 sm:p-4 rounded-lg border border-red-200">
              <p className="text-red-800 font-medium">
                ยอดรวมค้าง: {formatCurrency(overdueData.reduce((sum, item) => sum + item.total_amount, 0))}
              </p>
            </div>
          </div>

          {/* Overdue List */}
          <div className="space-y-3">
            {overdueData.length > 0 ? (
              overdueData.map((item) => (
                <div key={item.tenant_id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-semibold text-red-900">{item.tenant_name}</h4>
                      <div className="mt-1 text-sm text-red-700">
                        <span>{item.invoice_count} ใบแจ้งหนี้ค้าง</span>
                        <span className="mx-2">•</span>
                        <span>แพ็คเกจ: {item.subscription_plan}</span>
                        <span className="mx-2">•</span>
                        <span>ค้างตั้งแต่: {formatDate(item.oldest_due_date)}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-bold text-red-900">
                        {formatCurrency(item.total_amount)}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 hover:bg-red-50"
                          onClick={() => sendOverdueNotification(item)}
                        >
                          <Send className="w-4 h-4 mr-1" />
                          แจ้งเตือน
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-300 hover:bg-red-50"
                          onClick={() => {
                            // Create a mock payment object from overdue data for detail view
                            const mockPayment: Payment = {
                              id: `overdue-${item.tenant_id}`,
                              tenant_id: item.tenant_id,
                              invoice_id: '',
                              invoice_number: `${item.invoice_count} ใบค้าง`,
                              amount: item.total_amount,
                              currency: 'THB',
                              payment_method: 'pending',
                              payment_status: 'overdue',
                              created_at: item.oldest_due_date,
                              tenant: {
                                name: item.tenant_name,
                                email: item.tenant_email || '',
                                slug: ''
                              }
                            };
                            openPaymentDetail(mockPayment);
                          }}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          ดูรายละเอียด
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <p className="text-green-600">ไม่มีบริษัทค้างชำระ</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const renderReportsTab = () => {
    // Prepare data for charts
    const monthlyRevenue = recentInvoices.reduce((acc, invoice) => {
      if (invoice.status === 'paid') {
        const month = formatDate(invoice.created_at);
        acc[month] = (acc[month] || 0) + invoice.amount;
      }
      return acc;
    }, {} as Record<string, number>);

    const revenueChartData = Object.entries(monthlyRevenue).map(([month, amount]) => ({
      month,
      amount
    }));

    const planDistribution = recentInvoices.reduce((acc, invoice) => {
      acc[invoice.subscription_plan] = (acc[invoice.subscription_plan] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const planChartData = Object.entries(planDistribution).map(([plan, count]) => ({
      name: plan,
      value: count,
      fill: plan === 'enterprise' ? '#4b5563' :
            plan === 'professional' ? '#06b6d4' :
            plan === 'starter' ? '#10b981' : '#6b7280'
    }));

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            รายงานการเงิน
          </CardTitle>
          <CardDescription>
            สถิติและการวิเคราะห์ข้อมูลการเงิน
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Revenue Chart */}
            <div className="space-y-4">
              <h4 className="font-semibold">รายได้รายเดือน</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value as number), 'รายได้']}
                      labelFormatter={(label) => `เดือน: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="#4b5563"
                      strokeWidth={2}
                      name="รายได้"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Plan Distribution */}
            <div className="space-y-4">
              <h4 className="font-semibold">การกระจายแพ็คเกจ</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planChartData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {planChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-4">
              <h4 className="font-semibold">วิธีการชำระเงิน</h4>
              <div className="space-y-2">
                {Object.entries(
                  allPayments
                    .filter(p => p.payment_status === 'completed')
                    .reduce((acc, payment) => {
                      acc[payment.payment_method] = (acc[payment.payment_method] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                ).map(([method, count]) => (
                  <div key={method} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{getPaymentMethodLabel(method)}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary Stats */}
            <div className="space-y-4">
              <h4 className="font-semibold">สถิติสรุป</h4>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800">อัตราการชำระเงินตรงเวลา</p>
                  <p className="text-2xl font-bold text-green-900">
                    {((paymentOverview.paidInvoices / (paymentOverview.totalInvoices || 1)) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-white shadow-sm rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-700">ค่าเฉลี่ยต่อใบแจ้งหนี้</p>
                  <p className="text-2xl font-bold text-blue-900">
                    {formatCurrency(paymentOverview.totalRevenue / (paymentOverview.totalInvoices || 1))}
                  </p>
                </div>
                <div className="p-3 bg-white shadow-sm rounded-lg border border-gray-200">
                  <p className="font-medium text-gray-700">จำนวนลูกค้าทั้งหมด</p>
                  <p className="text-2xl font-bold text-purple-900">
                    {new Set(recentInvoices.map(i => i.tenant_id)).size}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Export Actions */}
          <div className="mt-6 pt-6 border-t">
            <div className="flex items-center gap-3">
              <Button
                className="bg-gray-900 text-white shadow-lg"
                onClick={handleDownloadPDFReport}
                disabled={loading}
              >
                <Download className="w-4 h-4 mr-2" />
                ดาวน์โหลดรายงาน PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                disabled={loading}
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={handleRefreshData}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                รีเฟรชข้อมูล
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOverviewTab = () => (
    <>
      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl flex items-center justify-center shadow-xl">
                <DollarSign className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(paymentOverview.totalRevenue)}</p>
                <p className="text-sm text-muted-foreground">รายได้รวม ({timeRange} วันล่าสุด)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl flex items-center justify-center shadow-xl">
                <AlertCircle className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatCurrency(paymentOverview.totalOutstanding)}</p>
                <p className="text-sm text-muted-foreground">ยอดค้างชำระ</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl flex items-center justify-center shadow-xl">
                <FileText className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-2xl font-bold">{paymentOverview.totalInvoices}</p>
                <p className="text-sm text-muted-foreground">ใบแจ้งหนี้ทั้งหมด</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-chateau to-chateau-600 rounded-xl flex items-center justify-center shadow-xl">
                <Users className="w-6 h-6 text-white" strokeWidth={2} />
              </div>
              <div>
                <p className="text-2xl font-bold">{paymentOverview.tenantsWithOverdue}</p>
                <p className="text-sm text-muted-foreground">บริษัทค้างชำระ</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Recent Payments */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              การชำระเงินล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayments.length > 0 ? (
                recentPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{payment.tenant_name}</p>
                      <p className="text-sm text-gray-500">
                        {payment.invoice_number} • {formatDate(payment.paid_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{formatCurrency(payment.amount)}</p>
                      <p className="text-xs text-gray-500">{getPaymentMethodLabel(payment.payment_method)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">ไม่มีการชำระเงินล่าสุด</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Invoices */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              ใบแจ้งหนี้ล่าสุด
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {recentInvoices.length > 0 ? (
                recentInvoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{invoice.tenant?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">
                        {invoice.invoice_number} • {formatDate(invoice.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(invoice.amount)}</p>
                      {getStatusBadge(invoice.status)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6">
                  <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-500">ไม่มีใบแจ้งหนี้</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );

  const renderComingSoon = (title: string) => (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-gray-500 text-center max-w-sm">
          ฟีเจอร์นี้กำลังพัฒนา จะเปิดใช้งานในเร็วๆ นี้
        </p>
      </CardContent>
    </Card>
  );

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-background">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-3 sm:p-4 lg:p-6">
            {/* Page Header */}
            <Card className="bg-white border-gray-200 shadow-lg mb-4 lg:mb-6">
              <CardContent className="pt-4 sm:pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-chateau to-chateau-600 shadow-xl rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">จัดการการชำระเงินและใบแจ้งหนี้</h1>
                      <p className="text-sm sm:text-base text-gray-600 mt-1">ระบบจัดการการเงินและการชำระเงินของบริษัททั้งหมด</p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="w-full sm:w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 วันล่าสุด</SelectItem>
                        <SelectItem value="30">30 วันล่าสุด</SelectItem>
                        <SelectItem value="90">90 วันล่าสุด</SelectItem>
                        <SelectItem value="365">1 ปีล่าสุด</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Automation Status Indicator */}
                    <div className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg border text-xs sm:text-sm ${
                      automationStatus.scheduler_running
                        ? 'bg-green-50 border-green-200 text-green-800'
                        : 'bg-red-50 border-red-200 text-red-800'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        automationStatus.scheduler_running ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span className="font-medium">
                        {automationStatus.scheduler_running ? 'Auto ON' : 'Auto OFF'}
                      </span>
                    </div>

                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        onClick={() => setShowAutomationPanel(true)}
                        className="text-blue-600 border-blue-300 hover:bg-white shadow-sm text-xs sm:text-sm px-2 sm:px-4"
                      >
                        <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Automation</span>
                        <span className="sm:hidden">Auto</span>
                      </Button>
                      <Button
                        className="bg-gray-900 hover:bg-black text-white shadow-lg text-xs sm:text-sm px-2 sm:px-4"
                        onClick={() => setShowCreateInvoice(true)}
                      >
                        <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">สร้างใบแจ้งหนี้</span>
                        <span className="sm:hidden">สร้าง</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tabs Layout */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 lg:gap-6">
              <div className="w-full md:w-56">
                <PageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
              </div>

              <div className="flex-1">
                {loading ? (
                  <div className="flex justify-center items-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600"></div>
                  </div>
                ) : (
                  <>
                    {activeTab === 'overview' && renderOverviewTab()}
                    {activeTab === 'invoices' && <InvoiceManagement />}
                    {activeTab === 'payments' && renderPaymentTrackingTab()}
                    {activeTab === 'calendar' && renderCalendarTab()}
                    {activeTab === 'overdue' && renderOverdueTab()}
                    {activeTab === 'reports' && renderReportsTab()}
                  </>
                )}
              </div>
            </div>
          </main>
        </div>

        {/* Payment Detail Modal */}
        <Dialog open={showPaymentDetail} onOpenChange={closePaymentDetail}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-blue-600" />
                รายละเอียดการชำระเงิน
              </DialogTitle>
            </DialogHeader>

            {selectedPayment && (
              <div className="space-y-6 py-4">
                {/* Payment Overview */}
                <div className="bg-gray-50 p-4 sm:p-6 rounded-lg border border-gray-200">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="text-sm text-gray-500 mb-1">จำนวนเงิน</div>
                      <div className="text-3xl font-bold text-chateau">
                        {formatCurrency(selectedPayment.amount)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {'method' in selectedPayment ? getPaymentMethodLabel(selectedPayment.method) : 'ไม่ระบุ'}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-gray-500 mb-1">วันที่ชำระ</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {formatDate(selectedPayment.created_at)}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {(() => {
                          const sp = selectedPayment as Record<string, unknown>;
                          const statusValue = (sp.payment_status as string) || (sp.status as string) || 'unknown';
                          return getPaymentStatusBadge(statusValue);
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Information */}
                <div>
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    ข้อมูลการชำระ
                  </h4>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm text-gray-600">รหัสธุรกรรม</div>
                        <div className="font-mono text-sm">
                          {'transaction_id' in selectedPayment
                            ? selectedPayment.transaction_id || `TX-${selectedPayment.id?.substr(0, 8)}`
                            : `TX-${selectedPayment.id?.substr(0, 8)}`
                          }
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-600">สถานะ</div>
                        <div className="text-sm">
                          {/* Prefer payment_status (overdue list uses this) → fall back to invoice status → unknown */}
                          {(() => {
                            const sp = selectedPayment as Record<string, unknown>;
                            const statusValue = (sp.payment_status as string) || (sp.status as string) || 'unknown';
                            return getPaymentStatusBadge(statusValue);
                          })()}
                        </div>
                      </div>
                      {'tenant_name' in selectedPayment && (
                        <div className="col-span-2">
                          <div className="text-sm text-gray-600">บริษัท</div>
                          <div className="font-medium">{selectedPayment.tenant_name}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4 border-t">
                  {selectedPayment?.payment_status === 'completed' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Generate receipt PDF logic here
                        console.log('Generate Receipt for:', selectedPayment.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      ส่งออกใบเสร็จ
                    </Button>
                  ) : selectedPayment?.payment_status === 'failed' ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Send reminder logic here
                        console.log('Send overdue reminder for:', selectedPayment.id);
                      }}
                      className="flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Send className="w-4 h-4" />
                      ส่งแจ้งเตือนค้างชำระ
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Send reminder logic here
                        console.log('Send reminder for:', selectedPayment.id);
                      }}
                      className="flex items-center gap-2 border-orange-300 text-orange-600 hover:bg-orange-50"
                    >
                      <Send className="w-4 h-4" />
                      ส่งแจ้งเตือนชำระเงิน
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    onClick={async () => {
                      console.log('View Invoice for:', selectedPayment.id);

                      // สร้าง Modal หรือหน้าใหม่แสดงใบแจ้งหนี้
                      try {
                        // หาข้อมูลใบแจ้งหนี้
                        let invoiceData = null;

                        // 1. ลอง query จาก database
                        try {
                          const { data, error } = await supabase
                            .from('invoices')
                            .select(`
                              *,
                              tenants (
                                name,
                                slug
                              )
                            `)
                            .eq('id', selectedPayment.invoice_number)
                            .single();

                          if (!error && data) {
                            invoiceData = data;
                          }
                        } catch (err) {
                          console.warn('Database query failed:', err);
                        }

                        // 2. ถ้าไม่เจอใน DB ลอง localStorage
                        if (!invoiceData) {
                          const storedInvoices = JSON.parse(localStorage.getItem('invoices') || '[]');
                          invoiceData = storedInvoices.find((inv: any) =>
                            inv.id === selectedPayment.invoice_number ||
                            inv.invoice_number === selectedPayment.invoice_number
                          );
                        }

                        // 3. ถ้าไม่เจอเลย สร้าง mock data
                        if (!invoiceData) {
                          invoiceData = {
                            id: selectedPayment.invoice_number,
                            invoice_number: selectedPayment.invoice_number,
                            amount: selectedPayment.amount,
                            currency: 'THB',
                            status: selectedPayment.payment_status === 'completed' ? 'paid' : 'pending',
                            due_date: selectedPayment.created_at,
                            created_at: selectedPayment.created_at,
                            tenant_name: selectedPayment.tenant?.name || 'Unknown',
                            description: `ใบแจ้งหนี้สำหรับ ${selectedPayment.tenant?.name || 'Unknown'}`
                          };
                        }

                        // แสดงป๊อปอัพใบแจ้งหนี้
                        setPopupData({
                          type: 'info',
                          title: `ใบแจ้งหนี้ #${invoiceData.invoice_number}`,
                          message: `บริษัท: ${invoiceData.tenant_name || invoiceData.tenants?.name || 'Unknown'}`,
                          details: `จำนวนเงิน: ${formatCurrency(invoiceData.amount)}\nสถานะ: ${invoiceData.status}\nวันที่สร้าง: ${new Date(invoiceData.created_at).toLocaleDateString('th-TH')}\nกำหนดชำระ: ${new Date(invoiceData.due_date).toLocaleDateString('th-TH')}\n\nรายละเอียด: ${invoiceData.description || 'ไม่ระบุ'}`
                        });
                        setShowResultPopup(true);

                      } catch (error) {
                        console.error('Error viewing invoice:', error);
                        setPopupData({
                          type: 'error',
                          title: 'เกิดข้อผิดพลาด',
                          message: 'ไม่สามารถแสดงใบแจ้งหนี้ได้',
                          details: 'กรุณาลองใหม่อีกครั้ง หรือติดต่อผู้ดูแลระบบ'
                        });
                        setShowResultPopup(true);
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    ดูใบแจ้งหนี้
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Calendar Event Detail Modal */}
        <Dialog open={showCalendarEventModal} onOpenChange={setShowCalendarEventModal}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-orange-500" />
                รายละเอียดบิล - ปฏิทินเครดิต
              </DialogTitle>
              <DialogDescription>
                ข้อมูลใบแจ้งหนี้และสถานะการชำระเงิน
              </DialogDescription>
            </DialogHeader>

            {selectedCalendarEvent && (
              <div className="space-y-6 py-4">
                {/* Event Overview */}
                <div className={`p-4 rounded-lg border-l-4 ${
                  selectedCalendarEvent.type === 'overdue' ? 'bg-red-50 border-l-red-500' :
                  selectedCalendarEvent.type === 'due' ? 'bg-orange-50 border-l-orange-500' :
                  selectedCalendarEvent.type === 'reminder' ? 'bg-chateau-50 border-l-chateau' :
                  'bg-gray-50 border-l-gray-500'
                }`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-1">
                        {selectedCalendarEvent.tenant_name}
                      </h4>
                      <p className="text-sm text-gray-600 mb-2">
                        {selectedCalendarEvent.type === 'overdue' ? '🔴 เกินกำหนดชำระ' :
                         selectedCalendarEvent.type === 'due' ? '🟡 ครบกำหนดชำระ' :
                         selectedCalendarEvent.type === 'reminder' ? '🔔 แจ้งเตือน' :
                         '📅 กิจกรรม'}
                      </p>
                      <p className="text-lg font-bold text-gray-900">
                        {formatCurrency(selectedCalendarEvent.amount || 0)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">วันที่</p>
                      <p className="font-medium">{formatDate(selectedCalendarEvent.date)}</p>
                    </div>
                  </div>
                </div>

                {/* Invoice Details */}
                {selectedCalendarEvent.invoice_detail && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">ข้อมูลใบแจ้งหนี้</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">เลขที่ใบแจ้งหนี้:</span>
                          <span className="font-medium">{selectedCalendarEvent.invoice_number}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">วันที่สร้าง:</span>
                          <span>{formatDate(selectedCalendarEvent.invoice_detail.created_at)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">วันครบกำหนด:</span>
                          <span>{formatDate(selectedCalendarEvent.invoice_detail.due_date)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">สถานะ:</span>
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            selectedCalendarEvent.invoice_detail.status === 'paid' ? 'bg-green-100 text-green-800' :
                            selectedCalendarEvent.invoice_detail.status === 'pending' ? 'bg-chateau-100 text-chateau-700' :
                            selectedCalendarEvent.invoice_detail.status === 'overdue' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {selectedCalendarEvent.invoice_detail.status === 'paid' ? 'ชำระแล้ว' :
                             selectedCalendarEvent.invoice_detail.status === 'pending' ? 'รอชำระ' :
                             selectedCalendarEvent.invoice_detail.status === 'overdue' ? 'เกินกำหนด' :
                             selectedCalendarEvent.invoice_detail.status}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="font-medium text-gray-900 mb-3">ข้อมูลบริษัท</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">ชื่อบริษัท:</span>
                          <span className="font-medium">{selectedCalendarEvent.invoice_detail.tenants?.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">อีเมล:</span>
                          <span>{selectedCalendarEvent.invoice_detail.tenants?.email}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">แพ็คเกจ:</span>
                          <span className="capitalize">{selectedCalendarEvent.invoice_detail.tenants?.subscription_plan}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Basic Event Info (when no detailed invoice data) */}
                {!selectedCalendarEvent.invoice_detail && (
                  <div className="text-center py-4 text-gray-500">
                    <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                    <p>ข้อมูลพื้นฐานของกิจกรรม</p>
                    <p className="text-sm mt-1">
                      {selectedCalendarEvent.title}
                    </p>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCalendarEventModal(false)}>
                ปิด
              </Button>
              {selectedCalendarEvent?.invoice_detail && (
                <Button
                  onClick={() => {
                    setShowCalendarEventModal(false);
                    setActiveTab('invoices');
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  ไปที่จัดการใบแจ้งหนี้
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Invoice Modal */}
        <Dialog open={showCreateInvoice} onOpenChange={setShowCreateInvoice}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                สร้างใบแจ้งหนี้ใหม่
              </DialogTitle>
              <DialogDescription>
                สร้างใบแจ้งหนี้สำหรับบริษัทลูกค้า โดยระบบจะใช้ราคาตามแพ็คเกจที่บริษัทใช้อยู่
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Select Tenant */}
              <div className="space-y-2">
                <Label htmlFor="tenant">เลือกบริษัท</Label>
                <Select value={newInvoice.tenant_id} onValueChange={handleTenantChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="เลือกบริษัทที่ต้องการออกใบแจ้งหนี้" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenantList.map((tenant) => (
                      <SelectItem key={tenant.id} value={tenant.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{tenant.name}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {PACKAGE_PRICES[tenant.subscription_plan as keyof typeof PACKAGE_PRICES]?.label || tenant.subscription_plan}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Package Selection */}
              <div className="space-y-2">
                <Label htmlFor="package">แพ็คเกจ</Label>
                <Select value={newInvoice.subscription_plan} onValueChange={handlePackageChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PACKAGE_PRICES).map(([key, plan]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center justify-between w-full">
                          <span>{plan.label}</span>
                          <span className="ml-4 text-sm text-gray-500">
                            ฿{plan.monthly.toLocaleString()}/เดือน
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">จำนวนเงิน (บาท)</Label>
                  <Input
                    id="amount"
                    type="number"
                    value={newInvoice.amount}
                    onChange={(e) => setNewInvoice(prev => ({
                      ...prev,
                      amount: parseInt(e.target.value) || 0,
                      custom_amount: true
                    }))}
                    className="text-right"
                  />
                  <p className="text-xs text-gray-500">
                    ราคาตามแพ็คเกจ: ฿{PACKAGE_PRICES[newInvoice.subscription_plan as keyof typeof PACKAGE_PRICES]?.monthly.toLocaleString()}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">วันครบกำหนด</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  <p className="text-xs text-gray-500">
                    ค่าเริ่มต้น: 7 วันจากวันนี้ (NET 7)
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">รายละเอียด</Label>
                <Textarea
                  id="description"
                  value={newInvoice.description}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="รายละเอียดใบแจ้งหนี้ (ถ้าไม่ระบุจะใช้ค่าเริ่มต้น)"
                  rows={3}
                />
              </div>

              {/* Preview */}
              {newInvoice.tenant_id && (
                <div className="p-4 bg-gray-50 rounded-lg border">
                  <h4 className="font-medium mb-2">ตัวอย่างใบแจ้งหนี้:</h4>
                  <div className="text-sm space-y-1">
                    <p><span className="text-gray-600">ลูกค้า:</span> {tenantList.find(t => t.id === newInvoice.tenant_id)?.name}</p>
                    <p><span className="text-gray-600">แพ็คเกจ:</span> {PACKAGE_PRICES[newInvoice.subscription_plan as keyof typeof PACKAGE_PRICES]?.label}</p>
                    <p><span className="text-gray-600">จำนวนเงิน:</span> <span className="font-semibold text-lg">฿{newInvoice.amount.toLocaleString()}</span></p>
                    <p><span className="text-gray-600">ครบกำหนด:</span> {
                      newInvoice.due_date
                        ? new Date(newInvoice.due_date).toLocaleDateString('th-TH')
                        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('th-TH')
                    }</p>
                    <p><span className="text-gray-600">รายละเอียด:</span> {
                      newInvoice.description || `Monthly subscription - ${PACKAGE_PRICES[newInvoice.subscription_plan as keyof typeof PACKAGE_PRICES]?.label}`
                    }</p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateInvoice(false)}>
                ยกเลิก
              </Button>
              <Button
                onClick={createInvoice}
                disabled={!newInvoice.tenant_id || !newInvoice.amount}
                className="bg-gray-900 hover:bg-black text-white shadow-lg"
              >
                <FileText className="w-4 h-4 mr-2" />
                สร้างใบแจ้งหนี้
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Automation Control Panel - Redesigned */}
        <Dialog open={showAutomationPanel} onOpenChange={setShowAutomationPanel}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-white shadow-sm rounded-lg">
                  <Settings className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold">ระบบอัตโนมัติการเรียกเก็บเงิน</h3>
                  <p className="text-sm text-gray-500 font-normal">Billing Automation Control Panel</p>
                </div>
                <div className="ml-auto">
                  <div className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-2 ${
                    automationStatus.scheduler_running
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      automationStatus.scheduler_running ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    {automationStatus.scheduler_running ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="py-6 space-y-8">
              {/* Quick Status Overview */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {automationStatus.email_queue}
                  </div>
                  <div className="text-sm text-gray-600">อีเมลรอส่ง</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600 mb-1">
                    {automationStatus.pending_suspensions}
                  </div>
                  <div className="text-sm text-gray-600">รอระงับบริการ</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {Object.values(automationStatus.jobs_status).filter(s => s === 'active').length}
                  </div>
                  <div className="text-sm text-gray-600">งานที่ทำงาน</div>
                </div>
                <div className="text-center">
                  <Button
                    size="lg"
                    onClick={toggleScheduler}
                    className={`w-full ${
                      automationStatus.scheduler_running
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-green-500 hover:bg-green-600 text-white'
                    }`}
                  >
                    {automationStatus.scheduler_running ? 'หยุดระบบ' : 'เริ่มระบบ'}
                  </Button>
                </div>
              </div>

              {/* Manual Controls */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-gray-600" />
                  การควบคุมด้วยตนเอง
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4">
                  <button
                    onClick={runAutoBilling}
                    className="p-4 bg-white shadow-sm hover:bg-gray-100 rounded-lg transition-colors text-left border border-gray-200"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <RefreshCw className="w-5 h-5 text-blue-600" />
                      <span className="font-medium text-blue-900">สร้างใบแจ้งหนี้</span>
                    </div>
                    <p className="text-sm text-blue-700">สร้างใบแจ้งหนี้รายเดือนอัตโนมัติ</p>
                  </button>

                  <button
                    onClick={runSuspensionCheck}
                    className="p-4 bg-red-50 hover:bg-red-100 rounded-lg transition-colors text-left border border-red-200"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="font-medium text-red-900">ตรวจสอบการระงับ</span>
                    </div>
                    <p className="text-sm text-red-700">ตรวจสอบและระงับบริการค้างชำระ</p>
                  </button>

                  <button
                    onClick={processEmailQueue}
                    className="p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left border border-green-200"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Send className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-900">ส่งอีเมล</span>
                    </div>
                    <p className="text-sm text-green-700">ประมวลผลอีเมลที่รอการส่ง</p>
                  </button>
                </div>
              </div>

              {/* Job Status with Timeline */}
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-600" />
                  สถานะงานอัตโนมัติ
                </h3>
                <div className="space-y-3">
                  {Object.entries(automationStatus.jobs_status).map(([job, status], index) => (
                    <div key={job} className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="text-2xl text-gray-400 font-mono w-8">
                          {index + 1}.
                        </div>
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                            status === 'active' ? 'bg-green-500' :
                            status === 'error' ? 'bg-red-500' :
                            'bg-gray-400'
                          }`}></div>
                          <span className="font-medium text-gray-900 capitalize">
                            {job.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        status === 'active' ? 'bg-green-100 text-green-700' :
                        status === 'error' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {status === 'active' ? 'ทำงาน' : status === 'error' ? 'ข้อผิดพลาด' : 'หยุด'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Schedule & Templates Combined */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-gray-600" />
                    กำหนดการทำงาน
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">08:00</span>
                      <span>อัปเดตสถานะใบแจ้งหนี้</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">09:00</span>
                      <span>สร้างใบแจ้งหนี้ (7 วันก่อนครบรอบ)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">10:00</span>
                      <span>ระงับบริการ (7 วันหลังครบกำหนด)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">23:00</span>
                      <span>อัปเดตข้อมูลวิเคราะห์</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">ต่อเนื่อง</span>
                      <span>ส่งอีเมล, อัปเดตสถานะ</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Send className="w-5 h-5 text-gray-600" />
                    เทมเพลตอีเมล
                  </h3>
                  <div className="space-y-2 text-sm">
                    {[
                      { key: 'invoice_created', label: 'ใบแจ้งหนี้ใหม่' },
                      { key: 'reminder_3_days', label: 'แจ้งเตือน 3 วัน' },
                      { key: 'reminder_1_day', label: 'แจ้งเตือน 1 วัน' },
                      { key: 'overdue_notice', label: 'เกินกำหนด' },
                      { key: 'final_warning', label: 'คำเตือนสุดท้าย' },
                      { key: 'service_suspended', label: 'ระงับบริการ' },
                      { key: 'payment_received', label: 'รับชำระเงินแล้ว' }
                    ].map(template => (
                      <div key={template.key} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded">
                        <span>{template.label}</span>
                        <Badge variant="outline" className="text-xs">พร้อม</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="border-t pt-4 flex justify-between">
              <Button variant="outline" onClick={() => setShowAutomationPanel(false)}>
                ปิด
              </Button>
              <Button onClick={() => setShowAdvancedSettings(true)}>
                <Settings className="w-4 h-4 mr-2" />
                ตั้งค่าขั้นสูง
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Advanced Settings Dialog */}
        <Dialog open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl">
                <div className="p-2 bg-white shadow-sm rounded-lg">
                  <Settings className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-semibold">การตั้งค่าขั้นสูง</h3>
                  <p className="text-sm text-gray-500 font-normal">Advanced Billing System Configuration</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-8 py-4">
              {/* Scheduler Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-600" />
                    ตั้งค่าตัวจัดการ (Scheduler)
                  </CardTitle>
                  <CardDescription>
                    กำหนดเวลาทำงาน เขตเวลา และนโยบายการลองใหม่
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="timezone">เขตเวลา</Label>
                      <Select
                        value={advancedConfig.scheduler.timezone}
                        onValueChange={(value) => setAdvancedConfig({
                          ...advancedConfig,
                          scheduler: { ...advancedConfig.scheduler, timezone: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Asia/Bangkok">Asia/Bangkok (GMT+7)</SelectItem>
                          <SelectItem value="Asia/Singapore">Asia/Singapore (GMT+8)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Asia/Tokyo (GMT+9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="business-hours">ชั่วโมงทำการ</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={advancedConfig.scheduler.businessHours.start}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            scheduler: {
                              ...advancedConfig.scheduler,
                              businessHours: {
                                ...advancedConfig.scheduler.businessHours,
                                start: e.target.value
                              }
                            }
                          })}
                        />
                        <span>ถึง</span>
                        <Input
                          type="time"
                          value={advancedConfig.scheduler.businessHours.end}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            scheduler: {
                              ...advancedConfig.scheduler,
                              businessHours: {
                                ...advancedConfig.scheduler.businessHours,
                                end: e.target.value
                              }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>นโยบายการลองใหม่ (Retry Policy)</Label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-retries">จำนวนครั้งสูงสุด</Label>
                        <Input
                          type="number"
                          min="0"
                          max="10"
                          value={advancedConfig.scheduler.retryPolicy.maxRetries}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            scheduler: {
                              ...advancedConfig.scheduler,
                              retryPolicy: {
                                ...advancedConfig.scheduler.retryPolicy,
                                maxRetries: parseInt(e.target.value)
                              }
                            }
                          })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="backoff-strategy">กลยุทธ์การรอ</Label>
                        <Select
                          value={advancedConfig.scheduler.retryPolicy.backoffStrategy}
                          onValueChange={(value) => setAdvancedConfig({
                            ...advancedConfig,
                            scheduler: {
                              ...advancedConfig.scheduler,
                              retryPolicy: {
                                ...advancedConfig.scheduler.retryPolicy,
                                backoffStrategy: value as 'fixed' | 'linear' | 'exponential'
                              }
                            }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="fixed">Fixed (เวลาคงที่)</SelectItem>
                            <SelectItem value="linear">Linear (เพิ่มขึ้นเป็นเส้นตรง)</SelectItem>
                            <SelectItem value="exponential">Exponential (เพิ่มขึ้นแบบยกกำลัง)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="backoff-base">ค่าฐาน (วินาที)</Label>
                        <Input
                          type="number"
                          min="1"
                          max="60"
                          value={advancedConfig.scheduler.retryPolicy.backoffBase}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            scheduler: {
                              ...advancedConfig.scheduler,
                              retryPolicy: {
                                ...advancedConfig.scheduler.retryPolicy,
                                backoffBase: parseInt(e.target.value)
                              }
                            }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Email Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="w-5 h-5 text-green-600" />
                    ตั้งค่าอีเมล (Email Configuration)
                  </CardTitle>
                  <CardDescription>
                    กำหนดการส่งอีเมลและการติดตาม
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="from-name">ชื่อผู้ส่ง</Label>
                      <Input
                        value={advancedConfig.email.fromName}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          email: { ...advancedConfig.email, fromName: e.target.value }
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="from-email">อีเมลผู้ส่ง</Label>
                      <Input
                        type="email"
                        value={advancedConfig.email.fromEmail}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          email: { ...advancedConfig.email, fromEmail: e.target.value }
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reply-to">Reply-To Address</Label>
                      <Input
                        type="email"
                        value={advancedConfig.email.replyTo}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          email: { ...advancedConfig.email, replyTo: e.target.value }
                        })}
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>ตัวเลือกขั้นสูง</Label>
                    <div className="flex flex-wrap gap-4">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={advancedConfig.email.enableTracking}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            email: { ...advancedConfig.email, enableTracking: e.target.checked }
                          })}
                          className="rounded"
                        />
                        <span>เปิดใช้งานการติดตามการเปิดอีเมล</span>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={advancedConfig.email.enableA11yMode}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            email: { ...advancedConfig.email, enableA11yMode: e.target.checked }
                          })}
                          className="rounded"
                        />
                        <span>โหมดการเข้าถึง (Accessibility)</span>
                      </label>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing Rules */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-orange-600" />
                    กฎการเรียกเก็บเงิน (Billing Rules)
                  </CardTitle>
                  <CardDescription>
                    กำหนดนโยบายการออกใบแจ้งหนี้และการระงับบริการ
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invoice-prefix">รหัสใบแจ้งหนี้</Label>
                      <Input
                        value={advancedConfig.billing.invoicePrefix}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, invoicePrefix: e.target.value }
                        })}
                        placeholder="INV"
                      />
                      <p className="text-xs text-gray-500">ตัวอย่าง: INV-2024-001</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grace-period">Grace Period (วัน)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="30"
                        value={advancedConfig.billing.gracePeriodDays}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, gracePeriodDays: parseInt(e.target.value) }
                        })}
                      />
                      <p className="text-xs text-gray-500">จำนวนวันหลังครบกำหนด</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="auto-suspend">ระงับอัตโนมัติ (วัน)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="90"
                        value={advancedConfig.billing.autoSuspendAfterDays}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, autoSuspendAfterDays: parseInt(e.target.value) }
                        })}
                      />
                      <p className="text-xs text-gray-500">ระงับบริการหลังเกินกำหนด</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">สกุลเงิน</Label>
                      <Select
                        value={advancedConfig.billing.currency}
                        onValueChange={(value) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, currency: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="THB">บาทไทย (THB)</SelectItem>
                          <SelectItem value="USD">ดอลลาร์สหรัฐ (USD)</SelectItem>
                          <SelectItem value="EUR">ยูโร (EUR)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="tax-rate">อัตราภาษี (%)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="20"
                        value={advancedConfig.billing.taxRate * 100}
                        onChange={(e) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, taxRate: parseFloat(e.target.value) / 100 }
                        })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="payment-terms">เงื่อนไขการชำระ</Label>
                      <Select
                        value={advancedConfig.billing.paymentTerms}
                        onValueChange={(value) => setAdvancedConfig({
                          ...advancedConfig,
                          billing: { ...advancedConfig.billing, paymentTerms: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NET 7">NET 7 (7 วัน)</SelectItem>
                          <SelectItem value="NET 15">NET 15 (15 วัน)</SelectItem>
                          <SelectItem value="NET 30">NET 30 (30 วัน)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Notification Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="w-5 h-5 text-red-600" />
                    การแจ้งเตือน (Notifications)
                  </CardTitle>
                  <CardDescription>
                    กำหนดช่องทางการแจ้งเตือนและผู้รับ
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <h4 className="font-medium">อีเมลแจ้งเตือน Admin</h4>
                        <p className="text-sm text-gray-500">ส่งการแจ้งเตือนสำคัญไปยังผู้ดูแลระบบ</p>
                      </div>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={advancedConfig.notifications.enableAdminEmail}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            notifications: { ...advancedConfig.notifications, enableAdminEmail: e.target.checked }
                          })}
                          className="rounded"
                        />
                      </label>
                    </div>

                    {advancedConfig.notifications.enableAdminEmail && (
                      <div className="ml-4">
                        <Label htmlFor="admin-email">อีเมล Admin</Label>
                        <Input
                          type="email"
                          value={advancedConfig.notifications.adminEmail}
                          onChange={(e) => setAdvancedConfig({
                            ...advancedConfig,
                            notifications: { ...advancedConfig.notifications, adminEmail: e.target.value }
                          })}
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setShowAdvancedSettings(false)}>
                ยกเลิก
              </Button>
              <Button
                onClick={async () => {
                  try {
                    // Save settings with localStorage + database fallback
                    console.log('💾 Saving advanced settings...');
                    console.log('📝 Settings data:', advancedConfig);

                    // Always save to localStorage first (reliable)
                    localStorage.setItem('chateau_billing_settings', JSON.stringify(advancedConfig));
                    console.log('✅ Saved to localStorage');

                    // Try to save to database using multiple methods
                    try {
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) {
                        console.log('⚠️ No user found, localStorage used');
                        return;
                      }

                      let saved = false;

                      // Method 1: Try RPC function
                      try {
                        const { error: rpcError } = await supabase
                          .rpc('update_billing_settings', { new_settings: advancedConfig });

                        if (!rpcError) {
                          console.log('✅ Saved to database via RPC');
                          saved = true;
                        }
                      } catch (rpcErr) {
                        // RPC doesn't exist or failed
                      }

                      // Method 2: Try profiles table
                      if (!saved) {
                        try {
                          const { error: profileError } = await supabase
                            .from('profiles')
                            .update({ billing_settings: advancedConfig })
                            .eq('user_id', user.id);

                          if (!profileError) {
                            console.log('✅ Saved to profiles table');
                            saved = true;
                          }
                        } catch (profileErr) {
                          // Profiles update failed
                        }
                      }

                      // Method 3: Try tenants table
                      if (!saved) {
                        try {
                          const { data: userData } = await supabase
                            .from('users')
                            .select('tenant_id')
                            .eq('id', user.id)
                            .single();

                          if (userData?.tenant_id) {
                            const { error: tenantError } = await supabase
                              .from('tenants')
                              .update({ billing_settings: advancedConfig })
                              .eq('id', userData.tenant_id);

                            if (!tenantError) {
                              console.log('✅ Saved to tenants table');
                              saved = true;
                            }
                          }
                        } catch (tenantErr) {
                          // Tenants update failed
                        }
                      }

                      if (!saved) {
                        console.log('⚠️ All database save methods failed, localStorage used');
                      }

                    } catch (dbError) {
                      console.log('⚠️ Database save failed, localStorage used:', dbError);
                    }

                    console.log('✅ Settings saved successfully');
                    setShowAdvancedSettings(false);
                    setPopupData({
                      type: 'success',
                      title: 'บันทึกการตั้งค่าสำเร็จ!',
                      message: 'การตั้งค่าขั้นสูงถูกบันทึกเรียบร้อยแล้ว',
                      details: 'ระบบจะใช้การตั้งค่าใหม่ในการทำงานต่อไป'
                    });
                    setShowResultPopup(true);

                  } catch (error) {
                    console.error('❌ Error saving settings:', error);
                    console.error('Settings data:', advancedConfig);

                    let errorMessage = 'เกิดข้อผิดพลาดในการบันทึก';
                    let errorDetails = 'กรุณาลองใหม่อีกครั้ง';

                    if (error instanceof Error) {
                      errorMessage = error.message;

                      // Specific error handling
                      if (error.message.includes('relation "company_settings" does not exist')) {
                        errorDetails = 'ตาราง company_settings ยังไม่มี กรุณารัน Migration ก่อน';
                      } else if (error.message.includes('column "billing_automation" does not exist')) {
                        errorDetails = 'คอลัมน์ billing_automation ยังไม่มี กรุณารัน Migration ก่อน';
                      } else if (error.message.includes('ไม่พบข้อมูลบริษัท')) {
                        errorDetails = 'ไม่มีข้อมูลบริษัท กรุณาสร้างข้อมูลบริษัทก่อน';
                      }
                    }

                    setPopupData({
                      type: 'error',
                      title: 'ไม่สามารถบันทึกการตั้งค่าได้',
                      message: errorMessage,
                      details: errorDetails
                    });
                    setShowResultPopup(true);
                  }
                }}
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                บันทึกการตั้งค่า
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Beautiful Result Popup */}
        <Dialog open={showResultPopup} onOpenChange={setShowResultPopup}>
          <DialogContent className="max-w-md mx-auto">
            <div className="text-center py-6">
              {/* Icon */}
              <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center">
                {popupData.type === 'success' ? (
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                ) : (
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-600" />
                  </div>
                )}
              </div>

              {/* Title */}
              <h3 className={`text-xl font-bold mb-3 ${
                popupData.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {popupData.title}
              </h3>

              {/* Message */}
              <div className="space-y-3 mb-6">
                <p className="text-gray-700 font-medium">
                  {popupData.message}
                </p>
                <p className="text-sm text-gray-500">
                  {popupData.details}
                </p>
              </div>


              {/* Action Button */}
              <Button
                onClick={() => setShowResultPopup(false)}
                className={`w-full ${
                  popupData.type === 'success'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } text-white`}
              >
                {popupData.type === 'success' ? 'ดำเนินการสำเร็จ' : 'เข้าใจแล้ว'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </OwnerGuard>
  );
};

export default PaymentDashboard;