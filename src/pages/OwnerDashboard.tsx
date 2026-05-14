import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
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
import {
  Building2,
  Users,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MoreHorizontal,
  Calendar,
  Clock,
  Star,
  UserPlus as UserPlusIcon,
  UserMinus,
  Edit,
  Trash2,
  Ban,
  Building,
  RefreshCw
} from 'lucide-react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/lib/supabase';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: 'trial' | 'active' | 'suspended' | 'cancelled';
  subscription_plan: 'starter' | 'professional' | 'enterprise';
  max_properties: number;
  created_at: string;
  trial_ends_at?: string;
}

interface DashboardStats {
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  totalUsers: number;
  monthlyRevenue: number;
  annualRunRate: number;
  churnRate: number;
  mrrGrowth: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  tenants: number;
}

interface ActivityItem {
  id: string;
  type: 'user_added' | 'user_updated' | 'user_deleted' | 'tenant_created' | 'tenant_updated' | 'tenant_deleted' | 'tenant_suspended' | 'subscription_renewed' | 'plan_upgraded';
  description: string;
  tenantName?: string;
  timestamp: string;
}

interface TenantWithStats extends Tenant {
  userCount: number;
  revenue: number;
}

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user } = useSimpleAuth();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalTenants: 0,
    activeTenants: 0,
    trialTenants: 0,
    totalUsers: 0,
    monthlyRevenue: 0,
    annualRunRate: 0,
    churnRate: 0,
    mrrGrowth: 0
  });
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [atRiskTenants, setAtRiskTenants] = useState<Tenant[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [topTenants, setTopTenants] = useState<TenantWithStats[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<Tenant[]>([]);
  const [revenueByPlan, setRevenueByPlan] = useState<{
    enterprise: number;
    professional: number;
    starter: number;
  }>({ enterprise: 0, professional: 0, starter: 0 });

  useEffect(() => {
    if (!isOwner) {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [isOwner, navigate]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch all tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (tenants) {
        const tenantList = tenants as Tenant[];

        // Calculate stats
        const activeCount = tenantList.filter(t => t.status === 'active').length;
        const trialCount = tenantList.filter(t => t.status === 'trial').length;

        // Calculate actual revenue from paid invoices
        const { data: paidInvoices } = await supabase
          .from('invoices')
          .select('amount, paid_at')
          .eq('status', 'paid');

        const currentRevenue = paidInvoices?.reduce((sum, inv) => {
          const paidDate = new Date(inv.paid_at || inv.created_at);
          const currentMonth = new Date();
          currentMonth.setDate(1); // First day of current month

          if (paidDate >= currentMonth) {
            return sum + inv.amount;
          }
          return sum;
        }, 0) || 0;

        // Calculate churn rate from actual data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const churnedTenants = tenantList.filter(t =>
          t.status === 'cancelled' && new Date((t as any).updated_at || t.created_at) >= thirtyDaysAgo
        ).length;
        const realChurnRate = tenantList.length > 0 ? (churnedTenants / tenantList.length) * 100 : 0;

        // Calculate MRR growth from previous month
        const previousMonth = new Date();
        previousMonth.setMonth(previousMonth.getMonth() - 1);
        previousMonth.setDate(1);

        const { data: previousMonthInvoices } = await supabase
          .from('invoices')
          .select('amount, paid_at')
          .eq('status', 'paid')
          .gte('paid_at', previousMonth.toISOString())
          .lt('paid_at', new Date(previousMonth.getFullYear(), previousMonth.getMonth() + 1, 1).toISOString());

        const previousRevenue = previousMonthInvoices?.reduce((sum, inv) => sum + inv.amount, 0) || 1;
        const realMrrGrowth = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;

        setStats({
          totalTenants: tenantList.length,
          activeTenants: activeCount,
          trialTenants: trialCount,
          totalUsers: 0, // Will fetch from users table
          monthlyRevenue: currentRevenue,
          annualRunRate: currentRevenue * 12,
          churnRate: Math.round(realChurnRate * 100) / 100,
          mrrGrowth: Math.round(realMrrGrowth * 100) / 100
        });

        // Recent tenants (last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        setRecentTenants(
          tenantList
            .filter(t => new Date(t.created_at) > sevenDaysAgo)
            .slice(0, 5)
        );

        // At-risk tenants (trial ending soon or suspended)
        const atRisk = tenantList.filter(t => {
          if (t.status === 'suspended') return true;
          if (t.status === 'trial' && t.trial_ends_at) {
            const daysUntilEnd = Math.floor(
              (new Date(t.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilEnd <= 7 && daysUntilEnd >= 0;
          }
          return false;
        }).slice(0, 5);

        setAtRiskTenants(atRisk);

        // Generate real revenue trend data from invoices (last 6 months)
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const revenueTrend: RevenueData[] = [];

        // Get all paid invoices for the last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const { data: historicalInvoices } = await supabase
          .from('invoices')
          .select('amount, paid_at, tenant_id')
          .eq('status', 'paid')
          .gte('paid_at', sixMonthsAgo.toISOString());

        for (let i = 5; i >= 0; i--) {
          const monthIndex = (currentMonth - i + 12) % 12;
          const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
          const monthName = months[monthIndex];

          // Get start and end of this month
          const monthStart = new Date(year, monthIndex, 1);
          const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

          // Calculate actual revenue for this month
          const monthInvoices = historicalInvoices?.filter(inv => {
            const paidDate = new Date(inv.paid_at || inv.created_at);
            return paidDate >= monthStart && paidDate <= monthEnd;
          }) || [];

          const monthRevenue = monthInvoices.reduce((sum, inv) => sum + inv.amount, 0);

          // Calculate unique tenants who paid in this month
          const uniqueTenants = new Set(monthInvoices.map(inv => inv.tenant_id)).size;

          revenueTrend.push({
            month: monthName,
            revenue: monthRevenue,
            tenants: uniqueTenants
          });
        }
        setRevenueData(revenueTrend);

        // Fetch recent activities from database
        const { data: activityData, error: activityError } = await supabase
          .rpc('get_recent_activities', { limit_count: 10 });

        if (activityError) {
          console.error('Error fetching activities:', activityError);
        } else if (activityData) {
          const activities: ActivityItem[] = activityData.map((item: any) => ({
            id: item.id,
            type: item.activity_type as ActivityItem['type'],
            description: item.description,
            tenantName: item.tenant_name,
            timestamp: item.created_at
          }));
          setRecentActivities(activities);
        } else {
          setRecentActivities([]);
        }

        // Generate top performing tenants with real revenue and user counts
        const { data: tenantUserCounts } = await supabase
          .from('users')
          .select('tenant_id')
          .not('tenant_id', 'is', null);

        // Count users per tenant
        const userCountMap = new Map<string, number>();
        tenantUserCounts?.forEach(user => {
          const count = userCountMap.get(user.tenant_id) || 0;
          userCountMap.set(user.tenant_id, count + 1);
        });

        // Get actual revenue per tenant from paid invoices
        const { data: tenantRevenues } = await supabase
          .from('invoices')
          .select('tenant_id, amount')
          .eq('status', 'paid');

        const revenueMap = new Map<string, number>();
        tenantRevenues?.forEach(invoice => {
          const current = revenueMap.get(invoice.tenant_id) || 0;
          revenueMap.set(invoice.tenant_id, current + invoice.amount);
        });

        const tenantsWithRealData = tenantList
          .map(t => ({
            ...t,
            revenue: revenueMap.get(t.id) || 0,
            userCount: userCountMap.get(t.id) || 0
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5) as TenantWithStats[];
        setTopTenants(tenantsWithRealData);

        // Calculate revenue by plan from real data
        const planRevenue = {
          enterprise: tenantList
            .filter(t => t.subscription_plan === 'enterprise' && t.status === 'active')
            .reduce((sum, t) => sum + (revenueMap.get(t.id) || 0), 0),
          professional: tenantList
            .filter(t => t.subscription_plan === 'professional' && t.status === 'active')
            .reduce((sum, t) => sum + (revenueMap.get(t.id) || 0), 0),
          starter: tenantList
            .filter(t => t.subscription_plan === 'starter' && t.status === 'active')
            .reduce((sum, t) => sum + (revenueMap.get(t.id) || 0), 0)
        };
        setRevenueByPlan(planRevenue);

        // Upcoming renewals (trial ending or subscriptions ending in 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

        const renewals = tenantList.filter(t => {
          if (t.status === 'trial' && t.trial_ends_at) {
            const endDate = new Date(t.trial_ends_at);
            return endDate <= thirtyDaysFromNow && endDate > new Date();
          }
          return false;
        }).sort((a, b) => {
          const dateA = new Date(a.trial_ends_at || 0);
          const dateB = new Date(b.trial_ends_at || 0);
          return dateA.getTime() - dateB.getTime();
        }).slice(0, 5);

        setUpcomingRenewals(renewals);
      }

      // Fetch total users count
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      setStats(prev => ({ ...prev, totalUsers: userCount || 0 }));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionPrice = (plan: string) => {
    const prices: Record<string, { monthly: number; annual: number }> = {
      starter: { monthly: 2900, annual: 29000 },
      professional: { monthly: 5900, annual: 59000 },
      enterprise: { monthly: 15900, annual: 159000 }
    };
    return prices[plan] || { monthly: 0, annual: 0 };
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; variant: any }> = {
      active: { label: 'Active', variant: 'default' },
      trial: { label: 'Trial', variant: 'secondary' },
      suspended: { label: 'Suspended', variant: 'destructive' },
      cancelled: { label: 'Cancelled', variant: 'outline' }
    };
    const badge = badges[status] || { label: status, variant: 'outline' };
    return <Badge variant={badge.variant}>{badge.label}</Badge>;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getActivityIcon = (type: ActivityItem['type']) => {
    const icons: Record<string, React.ReactElement> = {
      user_added: <UserPlusIcon className="w-4 h-4 text-blue-600" />,
      user_updated: <Edit className="w-4 h-4 text-blue-500" />,
      user_deleted: <UserMinus className="w-4 h-4 text-red-600" />,
      tenant_created: <Building className="w-4 h-4 text-green-600" />,
      tenant_updated: <Edit className="w-4 h-4 text-green-500" />,
      tenant_deleted: <Trash2 className="w-4 h-4 text-red-600" />,
      tenant_suspended: <Ban className="w-4 h-4 text-orange-600" />,
      subscription_renewed: <RefreshCw className="w-4 h-4 text-purple-600" />,
      plan_upgraded: <Star className="w-4 h-4 text-chateau" />
    };
    return icons[type] || <Activity className="w-4 h-4 text-gray-600" />;
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`;
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`;
    return `${diffDays} วันที่แล้ว`;
  };

  const getDaysUntilEnd = (endDate?: string) => {
    if (!endDate) return null;
    const days = Math.floor((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  // Soft luxury palette — matches Executive Dashboard / My Dashboard for consistency
  const KK = {
    red: '#ef4444', redLight: '#fef2f2', redBorder: '#fecaca',
    blue: '#1e3a5f', blueLight: '#eff6ff',
    purple: '#475569', purpleLight: '#f1f5f9',   // mapped to charcoal slate
    green: '#16a34a', greenLight: '#f0fdf4',
    orange: '#d97706', orangeLight: '#fef3c7',
    amber: '#d97706', amberLight: '#fefce8',
    gray: '#94a3b8', grayLight: '#fafafa',
    border: '#e5e7eb',
  };
  const kkTooltipStyle = {
    backgroundColor: 'white',
    border: `1px solid ${KK.border}`,
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    fontSize: '12px',
    padding: '8px 12px',
  };

  const tenantStatusData = [
    { name: 'Active',    value: stats.activeTenants, color: KK.green },
    { name: 'Trial',     value: stats.trialTenants, color: KK.amber },
    { name: 'Suspended', value: Math.max(0, stats.totalTenants - stats.activeTenants - stats.trialTenants), color: KK.red },
  ].filter(d => d.value > 0);

  const planRevenueData = [
    { name: 'Enterprise',   value: revenueByPlan.enterprise,   color: KK.purple },
    { name: 'Professional', value: revenueByPlan.professional, color: KK.blue },
    { name: 'Starter',      value: revenueByPlan.starter,      color: KK.gray },
  ];
  const maxPlanRevenue = Math.max(...planRevenueData.map(p => p.value), 1);

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-10 space-y-7">
            {/* === Page Title === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Platform Overview
                </span>
                <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Platform Overview</h1>
                <p className="text-[15px] text-gray-500 mt-1.5">ภาพรวมระบบ SaaS Platform · MRR / ARR / Tenants / Churn · อัปเดตล่าสุด {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.</p>
              </div>
              <div className="flex gap-2.5">
                <Button variant="outline" className="rounded-xl text-sm h-11 px-5 border-gray-200">
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Refresh
                </Button>
                <Button onClick={() => navigate('/tenants')} style={{ backgroundColor: KK.red, color: '#fff', border: 'none' }} className="rounded-xl text-sm h-11 px-5 hover:opacity-90 transition-opacity">
                  <Plus className="w-4 h-4 mr-1.5" /> เพิ่มบริษัท
                </Button>
              </div>
            </div>

            {/* === KPI Row (5 cards) === */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {[
                { title: 'รายได้ต่อเดือน (MRR)', value: formatCurrency(stats.monthlyRevenue), icon: DollarSign,  color: KK.red,    bg: KK.redLight,    trend: { value: stats.mrrGrowth, up: stats.mrrGrowth >= 0 } },
                { title: 'รายได้ต่อปี (ARR)',     value: formatCurrency(stats.annualRunRate),  icon: TrendingUp,  color: KK.purple, bg: KK.purpleLight, sub: 'MRR × 12' },
                { title: 'บริษัททั้งหมด',         value: stats.totalTenants.toLocaleString(),  icon: Building2,   color: KK.blue,   bg: KK.blueLight,   sub: `${stats.activeTenants} Active · ${stats.trialTenants} Trial` },
                { title: 'ผู้ใช้ทั้งหมด',          value: stats.totalUsers.toLocaleString(),    icon: Users,       color: KK.green,  bg: KK.greenLight,  sub: `~${stats.totalTenants > 0 ? Math.round(stats.totalUsers / stats.totalTenants) : 0} คน/บริษัท` },
                { title: 'อัตราเลิกใช้ (Churn)',  value: `${stats.churnRate}%`,                icon: TrendingDown,color: stats.churnRate > 5 ? KK.red : KK.green, bg: stats.churnRate > 5 ? KK.redLight : KK.greenLight, sub: 'เดือนนี้' },
              ].map((kpi, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
                  <div className="flex items-start justify-between mb-5">
                    <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
                    <div
                      className="kpi-icon-bg w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${kpi.bg}f0 0%, ${kpi.bg} 100%)`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${kpi.color}15`,
                      }}
                    >
                      <kpi.icon className="w-5 h-5" style={{ color: kpi.color, filter: `drop-shadow(0 1px 1px ${kpi.color}20)` }} strokeWidth={2.2} />
                    </div>
                  </div>
                  <p className="text-[32px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
                  {kpi.trend ? (
                    <div className="flex items-center gap-1.5 mt-3.5">
                      <span className="text-[13px] font-semibold" style={{ color: kpi.trend.up ? KK.green : KK.red }}>
                        {kpi.trend.up ? '↗' : '↘'} {Math.abs(kpi.trend.value)}%
                      </span>
                      <span className="text-[13px] text-gray-400">vs เดือนก่อน</span>
                    </div>
                  ) : (
                    <p className="text-[13px] text-gray-400 mt-3.5 truncate">{kpi.sub}</p>
                  )}
                </div>
              ))}
            </div>

            {/* === Row 1: Revenue Trend (2/3) + Tenant Status Donut (1/3) === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Revenue Trend — Smooth area chart */}
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">แนวโน้มรายได้ (MRR)</h2>
                    <p className="text-xs text-gray-500 mt-0.5">6 เดือนที่ผ่านมา · รวมทุก plan</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>6 เดือน</span>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={revenueData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ownerRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor={KK.red} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [formatCurrency(Number(v ?? 0)), 'MRR']) as any} />
                    <Area type="monotone" dataKey="revenue" stroke={KK.red} strokeWidth={2.5} fill="url(#ownerRevGrad)" dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tenant Status — Donut */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Building className="w-4 h-4" style={{ color: KK.blue }} />
                  <h2 className="text-base font-bold text-gray-900">สถานะบริษัท</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">การกระจายตาม status</p>
                <div className="relative" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={tenantStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={88} paddingAngle={2} dataKey="value">
                        {tenantStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                      <Tooltip contentStyle={kkTooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{stats.totalTenants}</div>
                    <div className="text-[11px] text-gray-500">บริษัทรวม</div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {tenantStatusData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600 flex-1">{item.name}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">{item.value}</span>
                      <span className="text-gray-400 tabular-nums">({stats.totalTenants > 0 ? Math.round((item.value / stats.totalTenants) * 100) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* === Row 2: Plan Revenue (1/3) + Top Tenants (2/3) === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* Plan Revenue — Horizontal bars */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="w-4 h-4" style={{ color: KK.green }} />
                  <h2 className="text-base font-bold text-gray-900">รายได้ตาม Plan</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">MRR per subscription tier</p>
                <div className="space-y-3">
                  {planRevenueData.map((item, i) => {
                    const widthPct = (item.value / maxPlanRevenue) * 100;
                    return (
                      <div key={i}>
                        <div className="flex justify-between items-center mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                            <span className="text-xs font-medium text-gray-700">{item.name}</span>
                          </div>
                          <span className="text-xs font-semibold text-gray-800 tabular-nums">{formatCurrency(item.value)}</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${widthPct}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-xs text-gray-500">รวม MRR</span>
                  <span className="text-sm font-bold text-gray-900 tabular-nums">{formatCurrency(planRevenueData.reduce((s, p) => s + p.value, 0))}</span>
                </div>
              </div>

              {/* Top Tenants */}
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4" style={{ color: KK.amber }} />
                      <h2 className="text-base font-bold text-gray-900">บริษัทยอดนิยม</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามรายได้/เดือน สูงสุด</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/tenants')} className="rounded-lg text-xs h-8 border-gray-200">
                    ดูทั้งหมด <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {topTenants.length === 0 ? (
                  <div className="text-center py-8">
                    <Star className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">ยังไม่มีข้อมูล</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topTenants.slice(0, 5).map((tenant, index) => (
                      <div
                        key={tenant.id}
                        className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-gray-50"
                        onClick={() => navigate(`/tenants/${tenant.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{
                            backgroundColor: index === 0 ? KK.amberLight : index === 1 ? KK.grayLight : index === 2 ? KK.orangeLight : '#fafafa',
                            color: index === 0 ? KK.amber : index === 1 ? KK.gray : index === 2 ? KK.orange : '#9ca3af',
                          }}>
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                              <Users className="w-3 h-3" /> {tenant.userCount} ผู้ใช้
                              <span className="text-gray-300">·</span>
                              <span className="capitalize">{tenant.subscription_plan}</span>
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold tabular-nums" style={{ color: KK.red }}>{formatCurrency(tenant.revenue)}</p>
                          <p className="text-[11px] text-gray-400">/เดือน</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* === Row 3: Upcoming Renewals + Recent Activity === */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Upcoming Renewals */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4" style={{ color: KK.amber }} />
                  <h2 className="text-base font-bold text-gray-900">ต่ออายุเร็วๆ นี้</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">30 วันข้างหน้า</p>
                {upcomingRenewals.length === 0 ? (
                  <div className="text-center py-8">
                    <Calendar className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">ไม่มีการต่ออายุใน 30 วัน</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {upcomingRenewals.slice(0, 5).map((tenant) => {
                      const daysUntilEnd = getDaysUntilEnd(tenant.trial_ends_at);
                      const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 7;
                      return (
                        <div
                          key={tenant.id}
                          className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:bg-gray-50"
                          style={{
                            borderColor: isUrgent ? KK.redBorder : '#f3f4f6',
                            backgroundColor: isUrgent ? KK.redLight : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: isUrgent ? '#fff' : KK.grayLight }}>
                              <Building2 className="w-4 h-4" style={{ color: isUrgent ? KK.red : KK.gray }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</p>
                              <p className="text-xs text-gray-500 capitalize">{tenant.subscription_plan} plan</p>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold tabular-nums" style={{ color: isUrgent ? KK.red : '#374151' }}>
                              {daysUntilEnd === 0 ? 'วันนี้' : daysUntilEnd === 1 ? 'พรุ่งนี้' : `อีก ${daysUntilEnd} วัน`}
                            </p>
                            <p className="text-[11px] text-gray-400">
                              {tenant.trial_ends_at && new Date(tenant.trial_ends_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-4 h-4" style={{ color: KK.purple }} />
                  <h2 className="text-base font-bold text-gray-900">กิจกรรมล่าสุด</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">การเปลี่ยนแปลงในระบบ</p>
                {recentActivities.length === 0 ? (
                  <div className="text-center py-8">
                    <Activity className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">ไม่มีกิจกรรมล่าสุด</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentActivities.slice(0, 6).map((activity) => (
                      <div key={activity.id} className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: KK.purple }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-800 leading-tight">{activity.description}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                            {activity.tenantName && <><span className="truncate max-w-[140px]">{activity.tenantName}</span><span className="text-gray-300">·</span></>}
                            <Clock className="w-3 h-3" />
                            {formatTimestamp(activity.timestamp)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* === Row 4: Recent Tenants + At-Risk Tenants === */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {/* Recent Tenants */}
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <UserPlusIcon className="w-4 h-4" style={{ color: KK.green }} />
                      <h2 className="text-base font-bold text-gray-900">บริษัทใหม่ล่าสุด</h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">7 วันที่ผ่านมา</p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate('/tenants')} className="rounded-lg text-xs h-8 border-gray-200">
                    ดูทั้งหมด <ArrowUpRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
                {recentTenants.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm text-gray-500">ไม่มีบริษัทใหม่ใน 7 วัน</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {recentTenants.slice(0, 5).map((tenant) => (
                      <div key={tenant.id} className="flex items-center justify-between p-3 rounded-xl border border-gray-50 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</p>
                            {getStatusBadge(tenant.status)}
                          </div>
                          <p className="text-xs text-gray-500 capitalize">{tenant.subscription_plan} plan</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: KK.red }}>
                          {formatCurrency(getSubscriptionPrice(tenant.subscription_plan).monthly)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* At-Risk Tenants */}
              <div className="bg-white border rounded-2xl shadow-soft p-5" style={{ borderColor: atRiskTenants.length > 0 ? KK.amberLight : '#f3f4f6' }}>
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="w-4 h-4" style={{ color: atRiskTenants.length > 0 ? KK.amber : KK.green }} />
                  <h2 className="text-base font-bold text-gray-900">ต้องเฝ้าระวัง</h2>
                </div>
                <p className="text-xs text-gray-500 mb-4">Trial ใกล้หมด หรือถูกระงับ</p>
                {atRiskTenants.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-10 h-10 mx-auto mb-2" style={{ color: KK.green }} />
                    <p className="text-sm text-gray-500">ไม่มีบริษัทที่ต้องเฝ้าระวัง</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {atRiskTenants.slice(0, 5).map((tenant) => {
                      const daysUntilEnd = tenant.trial_ends_at
                        ? Math.floor((new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : 0;
                      const isCritical = daysUntilEnd <= 3 && tenant.status === 'trial';
                      return (
                        <div
                          key={tenant.id}
                          className="flex items-center justify-between p-3 rounded-xl border transition-colors hover:bg-gray-50"
                          style={{
                            borderColor: isCritical ? KK.redBorder : '#f3f4f6',
                            backgroundColor: isCritical ? KK.redLight : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#fff' }}>
                              <AlertCircle className="w-4 h-4" style={{ color: isCritical ? KK.red : KK.amber }} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</p>
                              <p className="text-xs text-gray-500 capitalize">
                                {tenant.status === 'trial' ? `เหลือ ${daysUntilEnd} วัน` : tenant.status} · {tenant.subscription_plan}
                              </p>
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/tenants/${tenant.id}`)}>ดูรายละเอียด</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/billing/${tenant.id}`)}>ดู Billing</DropdownMenuItem>
                              <DropdownMenuItem>ส่งอีเมลแจ้งเตือน</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
