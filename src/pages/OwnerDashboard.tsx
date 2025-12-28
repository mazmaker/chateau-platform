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
  CreditCard,
  TrendingUp,
  TrendingDown,
  Activity,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Settings,
  Plus,
  MoreHorizontal
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
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold tracking-tight">Owner Dashboard</h1>
                  <p className="text-muted-foreground">
                    ภาพรวมระบบ SaaS Platform - จัดการทั้งหมดจากที่เดียว
                  </p>
                </div>
              </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Monthly Recurring Revenue */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                รายได้ต่อเดือน (MRR)
              </CardTitle>
              <DollarSign className="w-4 h-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats.monthlyRevenue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="flex items-center text-green-600">
                  <ArrowUpRight className="w-3 h-3 mr-1" />
                  {stats.mrrGrowth}%
                </span>
                <span className="ml-1">จากเดือนที่แล้ว</span>
              </p>
            </CardContent>
          </Card>

          {/* Annual Run Rate */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                รายได้ต่อปี (ARR)
              </CardTitle>
              <TrendingUp className="w-4 h-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatCurrency(stats.annualRunRate)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                คำนวณจาก MRR x 12
              </p>
            </CardContent>
          </Card>

          {/* Total Tenants */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                บริษัททั้งหมด
              </CardTitle>
              <Building2 className="w-4 h-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalTenants}</div>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="text-green-600">{stats.activeTenants} Active</span>
                <span className="mx-1">•</span>
                <span className="text-orange-600">{stats.trialTenants} Trial</span>
              </p>
            </CardContent>
          </Card>

          {/* Total Users */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                ผู้ใช้ทั้งหมด
              </CardTitle>
              <Users className="w-4 h-4 text-cyan-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                เฉลี่ย {stats.totalTenants > 0 ? Math.round(stats.totalUsers / stats.totalTenants) : 0} คน/บริษัท
              </p>
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

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>ดำเนินการด่วน</CardTitle>
            <CardDescription>จัดการระบบได้รวดเร็ว</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate('/tenants/new')}
              >
                <Building2 className="w-6 h-6" />
                <span>เพิ่มบริษัทใหม่</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate('/billing')}
              >
                <CreditCard className="w-6 h-6" />
                <span>จัดการ Billing</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate('/users')}
              >
                <Users className="w-6 h-6" />
                <span>จัดการผู้ใช้</span>
              </Button>
              <Button
                variant="outline"
                className="h-24 flex-col gap-2"
                onClick={() => navigate('/settings')}
              >
                <Settings className="w-6 h-6" />
                <span>ตั้งค่าระบบ</span>
              </Button>
            </div>
          </CardContent>
        </Card>
            </div>
          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
