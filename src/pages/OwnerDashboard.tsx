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

        // Calculate revenue (simplified - should come from billing table)
        const revenue = tenantList.reduce((sum, t) => {
          const planPrices = {
            starter: 2900,
            professional: 5900,
            enterprise: 15900
          };
          return sum + (planPrices[t.subscription_plan] || 0);
        }, 0);

        setStats({
          totalTenants: tenantList.length,
          activeTenants: activeCount,
          trialTenants: trialCount,
          totalUsers: 0, // Will fetch from users table
          monthlyRevenue: revenue,
          annualRunRate: revenue * 12,
          churnRate: 2.5, // Placeholder
          mrrGrowth: 12.3 // Placeholder
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

        // Generate revenue trend data (last 6 months)
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const revenueTrend: RevenueData[] = [];

        for (let i = 5; i >= 0; i--) {
          const monthIndex = (currentMonth - i + 12) % 12;
          const year = currentMonth - i < 0 ? currentYear - 1 : currentYear;
          const monthName = months[monthIndex];

          // Simulate growing trend
          const baseRevenue = revenue * (0.6 + (i * 0.08));
          const tenantCount = Math.round(tenantList.length * (0.5 + (i * 0.08)));

          revenueTrend.push({
            month: monthName,
            revenue: Math.round(baseRevenue),
            tenants: Math.max(tenantCount, 1)
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

        // Generate top performing tenants (by revenue contribution)
        const planPrices = { starter: 2900, professional: 5900, enterprise: 15900 };
        const tenantsWithRevenue = tenantList
          .map(t => ({
            ...t,
            revenue: planPrices[t.subscription_plan] || 0,
            userCount: Math.floor(Math.random() * 15) + 1 // Random for demo
          }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5) as TenantWithStats[];
        setTopTenants(tenantsWithRevenue);

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
      plan_upgraded: <Star className="w-4 h-4 text-amber-600" />
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
              <Card className="bg-gradient-to-r from-violet-50 to-purple-50 border-violet-100">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900">Owner Dashboard</h1>
                      <p className="text-gray-600 mt-1">
                        ภาพรวมระบบ SaaS Platform - จัดการทั้งหมดจากที่เดียว
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Monthly Recurring Revenue */}
          <Card className="bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
                  <p className="text-xs text-white/80">รายได้ต่อเดือน (MRR)</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-xs text-white/90">
                <ArrowUpRight className="w-3 h-3" />
                {stats.mrrGrowth}% จากเดือนที่แล้ว
              </div>
            </CardContent>
          </Card>

          {/* Annual Run Rate */}
          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.annualRunRate)}</p>
                  <p className="text-xs text-white/80">รายได้ต่อปี (ARR)</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/90">
                คำนวณจาก MRR x 12
              </div>
            </CardContent>
          </Card>

          {/* Total Tenants */}
          <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalTenants}</p>
                  <p className="text-xs text-white/80">บริษัททั้งหมด</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/90">
                <span>{stats.activeTenants} Active</span>
                <span>•</span>
                <span>{stats.trialTenants} Trial</span>
              </div>
            </CardContent>
          </Card>

          {/* Total Users */}
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-white/80">ผู้ใช้ทั้งหมด</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-white/90">
                เฉลี่ย {stats.totalTenants > 0 ? Math.round(stats.totalUsers / stats.totalTenants) : 0} คน/บริษัท
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Metrics */}
        <div className="grid gap-4 md:grid-cols-3">
          {/* Churn Rate */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">อัตราเลิกใช้ (Churn Rate)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">{stats.churnRate}%</div>
                  <p className="text-xs text-muted-foreground">เดือนนี้</p>
                </div>
                {stats.churnRate > 5 ? (
                  <AlertCircle className="w-8 h-8 text-red-500" />
                ) : (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Active vs Trial */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">สัดส่วนบริษัท</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Active</span>
                    <span className="font-medium">
                      {stats.totalTenants > 0
                        ? Math.round((stats.activeTenants / stats.totalTenants) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full"
                      style={{
                        width: `${stats.totalTenants > 0
                          ? (stats.activeTenants / stats.totalTenants) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Trial</span>
                    <span className="font-medium">
                      {stats.totalTenants > 0
                        ? Math.round((stats.trialTenants / stats.totalTenants) * 100)
                        : 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full"
                      style={{
                        width: `${stats.totalTenants > 0
                          ? (stats.trialTenants / stats.totalTenants) * 100
                          : 0}%`
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue by Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">รายได้ตามแพ็กเกจ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span>Enterprise</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(15900 * recentTenants.filter(t => t.subscription_plan === 'enterprise').length)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Professional</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(5900 * recentTenants.filter(t => t.subscription_plan === 'professional').length)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span>Starter</span>
                  </div>
                  <span className="font-medium">
                    {formatCurrency(2900 * recentTenants.filter(t => t.subscription_plan === 'starter').length)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-violet-600" />
                  แนวโน้มรายได้ (Revenue Trend)
                </CardTitle>
                <CardDescription>6 เดือนที่ผ่านมา</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value: number) => formatCurrency(value)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#8b5cf6"
                  strokeWidth={3}
                  name="รายได้ (บาท)"
                  dot={{ fill: '#8b5cf6', r: 5 }}
                  activeDot={{ r: 7 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Activities */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-blue-600" />
                  กิจกรรมล่าสุด
                </CardTitle>
                <CardDescription>ติดตามการเปลี่ยนแปลงในระบบ</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    {activity.tenantName && (
                      <p className="text-xs text-gray-500 mt-1">{activity.tenantName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(activity.timestamp)}
                  </div>
                </div>
              ))}
              {recentActivities.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีกิจกรรมล่าสุด</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Performing Tenants & Upcoming Renewals */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Performing Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500" />
                    บริษัทยอดนิยม
                  </CardTitle>
                  <CardDescription>เรียงตามรายได้สูงสุด</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/tenants')}>
                  ดูทั้งหมด
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {topTenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีข้อมูล</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {topTenants.map((tenant, index) => (
                    <div
                      key={tenant.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => navigate(`/tenants/${tenant.id}`)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          index === 0 ? 'bg-amber-100 text-amber-700' :
                          index === 1 ? 'bg-gray-100 text-gray-700' :
                          index === 2 ? 'bg-orange-100 text-orange-700' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-500">{tenant.userCount} ผู้ใช้</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-violet-600">{formatCurrency(tenant.revenue)}</p>
                        <p className="text-xs text-gray-500">/เดือน</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Renewals */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-green-600" />
                    ต่ออายุเร็วๆ นี้
                  </CardTitle>
                  <CardDescription>30 วันข้างหน้า</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {upcomingRenewals.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีการต่ออายุใน 30 วันข้างหน้า</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingRenewals.map((tenant) => {
                    const daysUntilEnd = getDaysUntilEnd(tenant.trial_ends_at);
                    const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 7;

                    return (
                      <div
                        key={tenant.id}
                        className={`flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors ${
                          isUrgent ? 'bg-orange-50 border border-orange-200' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Building2 className={`w-5 h-5 ${isUrgent ? 'text-orange-600' : 'text-gray-400'}`} />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-500">
                              <Badge variant="outline" className="capitalize">
                                {tenant.subscription_plan}
                              </Badge>
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-semibold ${isUrgent ? 'text-orange-600' : 'text-gray-700'}`}>
                            {daysUntilEnd !== null && daysUntilEnd === 0
                              ? 'วันนี้'
                              : daysUntilEnd !== null && daysUntilEnd === 1
                              ? 'พรุ่งนี้'
                              : `อีก ${daysUntilEnd} วัน`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {tenant.trial_ends_at && new Date(tenant.trial_ends_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tables Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Recent Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>บริษัทใหม่ล่าสุด</CardTitle>
                  <CardDescription>7 วันที่ผ่านมา</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigate('/tenants')}>
                  ดูทั้งหมด
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentTenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>ไม่มีบริษัทใหม่ใน 7 วันที่ผ่านมา</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อบริษัท</TableHead>
                      <TableHead>แพ็กเกจ</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead className="text-right">รายได้/เดือน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTenants.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {tenant.subscription_plan}
                          </Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(tenant.status)}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(getSubscriptionPrice(tenant.subscription_plan).monthly)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* At-Risk Tenants */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-500" />
                    บริษัทที่ต้องเฝ้าระวัง
                  </CardTitle>
                  <CardDescription>Trial ใกล้หมด หรือถูกระงับ</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {atRiskTenants.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50 text-green-500" />
                  <p>ไม่มีบริษัทที่ต้องเฝ้าระวัง</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ชื่อบริษัท</TableHead>
                      <TableHead>สถานะ</TableHead>
                      <TableHead>แพ็กเกจ</TableHead>
                      <TableHead className="text-right">ดำเนินการ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atRiskTenants.map((tenant) => {
                      const daysUntilEnd = tenant.trial_ends_at
                        ? Math.floor(
                            (new Date(tenant.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                          )
                        : 0;

                      return (
                        <TableRow key={tenant.id}>
                          <TableCell className="font-medium">{tenant.name}</TableCell>
                          <TableCell>
                            {tenant.status === 'trial' && daysUntilEnd >= 0 ? (
                              <Badge variant="secondary" className="text-orange-600">
                                เหลือ {daysUntilEnd} วัน
                              </Badge>
                            ) : (
                              getStatusBadge(tenant.status)
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">
                              {tenant.subscription_plan}
                            </Badge>
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
                                  ดูรายละเอียด
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate(`/billing/${tenant.id}`)}>
                                  ดู Billing
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  ส่งอีเมลแจ้งเตือน
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
