import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD } from '@/components/dashboard/PeriodFilter';
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
  AlertCircle,
  CheckCircle,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MoreHorizontal,
  Calendar,
  Star,
  UserPlus as UserPlusIcon,
  UserMinus,
  Edit,
  Trash2,
  Ban,
  Building,
  Layers,
  RefreshCw,
  Receipt,
  MapPin,
  Trophy,
  CreditCard,
  Contact,
  Filter,
  Home
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
import { toast } from 'sonner';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceDot,
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
  cancelledTenants: number;
  totalUsers: number;
  totalProjects: number;
  monthlyRevenue: number;
  annualRunRate: number;
  churnRate: number;
  mrrGrowth: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  arr: number;
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

// Per-company real-estate rollup (Owner HQ lens) — cross-tenant comparison row.
interface CompanyRow {
  id: string;
  name: string;
  plan: string;
  gdv: number;       // total managed property value (all units)
  sold: number;      // sold unit count
  total: number;     // total unit count
  soldValue: number; // value of sold units
  leads: number;     // total leads
}

interface TopSalesRep {
  id: string; name: string; role: string; company: string;
  won: number; wonValue: number; conversion: number;
}

// Compact THB — Thai real-estate convention "X ล้าน" / "K" (NOT M/B). Copied from
// Index.tsx / OwnerProjects.tsx (canonical). Used for large GDV / sales-value figures
// where the full formatCurrency would be unreadable (e.g. ฿3,820,000,000).
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 1000) return `${sign}฿${Math.round(m).toLocaleString('en-US')} ล้าน`;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${abs.toFixed(0)}`;
};

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
    cancelledTenants: 0,
    totalUsers: 0,
    totalProjects: 0,
    monthlyRevenue: 0,
    annualRunRate: 0,
    churnRate: 0,
    mrrGrowth: 0
  });
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [atRiskTenants, setAtRiskTenants] = useState<Tenant[]>([]);
  const [cancelledTenantNames, setCancelledTenantNames] = useState<string[]>([]);
  const [suspendedTenantNames, setSuspendedTenantNames] = useState<string[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [ytdData, setYtdData] = useState<RevenueData[]>([]);
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [topTenants, setTopTenants] = useState<TenantWithStats[]>([]);
  const [planPopularity, setPlanPopularity] = useState<{ plan: string; tenantCount: number; userCount: number }[]>([]);
  const [upcomingRenewals, setUpcomingRenewals] = useState<Tenant[]>([]);
  const [revenueByPlan, setRevenueByPlan] = useState<{
    enterprise: number;
    professional: number;
    starter: number;
  }>({ enterprise: 0, professional: 0, starter: 0 });
  // Plan list prices, read from the `plans` table (single source of truth) so
  // this matches the จัดการแพ็กเกจ editor instead of a hardcoded copy.
  const [planPrices, setPlanPrices] = useState<Record<string, { monthly: number; annual: number }>>({});
  // AR / cash health — money owed but not yet collected (≠ MRR). Sourced from invoices.
  const [arSummary, setArSummary] = useState({ overdue: 0, overdueCount: 0, pending: 0, pendingCount: 0 });
  // Cross-tenant real-estate rollup (Owner HQ lens) — GDV / sold units / new leads
  // aggregated across all customer tenants, plus per-company comparison rows.
  const [salesStats, setSalesStats] = useState({ gdv: 0, soldValue: 0, soldUnits: 0, soldUnitsThisMonth: 0, totalUnits: 0, newLeadsThisMonth: 0, totalLeads: 0 });
  const [companyRows, setCompanyRows] = useState<CompanyRow[]>([]);
  // Platform sales pipeline — companies interested in buying the platform, new this month.
  const [platformLeadsNew, setPlatformLeadsNew] = useState(0);
  // Global period filter — tells the owner what date range the dashboard reflects.
  // Executive = strategic tier (trend-level: เดือน/ไตรมาส/ปี, no single-day — that lives on
  // operational pages like Payments/Support).
  const [period, setPeriod] = useState<PeriodKey>(DEFAULT_PERIOD.strategic);
  // Month-over-month deltas (real, derived from sold_at / created_at) for KPI ↑↓ arrows.
  // null = no prior-month data to compare against (so we show no fake delta).
  const [momDelta, setMomDelta] = useState<{ soldUnits: number | null; leads: number | null; tenants: number | null }>({ soldUnits: null, leads: null, tenants: null });
  // Open support tickets (real) — feeds the exception-first alert strip.
  const [opsStats, setOpsStats] = useState<{ openTickets: number }>({ openTickets: 0 });
  // GMV monthly trend — units sold per month across the whole platform (from units.sold_at).
  const [gmvTrend, setGmvTrend] = useState<{ month: string; gmv: number; units: number }[]>([]);
  // Top 5 salespeople cross-tenant — ranked by won deal value (preview card on dashboard).
  const [topSalesReps, setTopSalesReps] = useState<TopSalesRep[]>([]);
  // Platform stickiness — active logins via auth.users (SECURITY DEFINER RPC).
  const [activeUsers, setActiveUsers] = useState({ active7d: 0, active30d: 0, total: 0 });
  // License utilization — current users vs plan quota (upsell signal).
  const [licenseUtil, setLicenseUtil] = useState({ avgPct: 0, nearLimit: 0, notOnboarded: 0, totalActive: 0, notOnboardedNames: [] as string[] });

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
      // Plan catalog prices (for the "recent tenants" list-price display).
      const { data: plansData } = await (supabase as any)
        .from('plans')
        .select('id, price_monthly, price_yearly');
      if (plansData) {
        const priceMap: Record<string, { monthly: number; annual: number }> = {};
        plansData.forEach((p: any) => {
          priceMap[p.id] = { monthly: Number(p.price_monthly) || 0, annual: Number(p.price_yearly) || 0 };
        });
        setPlanPrices(priceMap);
      }

      // Fetch all tenants
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('is_platform' as any, false) // exclude our own platform tenant (MAZMAKER) from customer stats/MRR
        .order('created_at', { ascending: false });

      if (tenants) {
        const tenantList = tenants as Tenant[];

        // Calculate stats
        const activeCount = tenantList.filter(t => t.status === 'active').length;
        const trialCount = tenantList.filter(t => t.status === 'trial').length;

        // Fetch paid invoices with tenant + dates to derive recurring revenue.
        const { data: paidInvoices } = await supabase
          .from('invoices')
          .select('tenant_id, amount, paid_at, created_at')
          .eq('status', 'paid');

        // MRR = sum of each ACTIVE tenant's CURRENT monthly rate (their most recent paid
        // invoice). This is the recurring revenue base — unlike "paid this calendar month",
        // it does NOT crater to ~0 at the start of every month before invoices are settled.
        const activeTenantIds = new Set(
          tenantList.filter(t => t.status === 'active').map(t => t.id)
        );
        const invTime = (inv: any) => new Date(inv.paid_at || inv.created_at).getTime();
        const firstOfMonth = new Date();
        firstOfMonth.setDate(1);
        firstOfMonth.setHours(0, 0, 0, 0);

        const latestRate = new Map<string, number>();  // tenant_id -> current monthly rate
        const latestTime = new Map<string, number>();
        const prevRate = new Map<string, number>();     // rate as of the start of this month
        const prevTime = new Map<string, number>();

        (paidInvoices || []).forEach((inv: any) => {
          if (!activeTenantIds.has(inv.tenant_id)) return;
          const t = invTime(inv);
          if (!latestTime.has(inv.tenant_id) || t > (latestTime.get(inv.tenant_id) as number)) {
            latestTime.set(inv.tenant_id, t);
            latestRate.set(inv.tenant_id, Number(inv.amount));
          }
          if (t < firstOfMonth.getTime() &&
              (!prevTime.has(inv.tenant_id) || t > (prevTime.get(inv.tenant_id) as number))) {
            prevTime.set(inv.tenant_id, t);
            prevRate.set(inv.tenant_id, Number(inv.amount));
          }
        });

        const mrr = Array.from(latestRate.values()).reduce((s, a) => s + a, 0);

        // Calculate churn rate from actual data (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const churnedTenants = tenantList.filter(t =>
          t.status === 'cancelled' && new Date((t as any).updated_at || t.created_at) >= thirtyDaysAgo
        ).length;
        const realChurnRate = tenantList.length > 0 ? (churnedTenants / tenantList.length) * 100 : 0;

        // MoM growth of the recurring base: MRR now vs MRR as of the start of this month.
        const previousMrr = Array.from(prevRate.values()).reduce((s, a) => s + a, 0);
        const realMrrGrowth = previousMrr > 0 ? ((mrr - previousMrr) / previousMrr) * 100 : 0;

        const cancelledCount = tenantList.filter(t => t.status === 'cancelled').length;

        setStats({
          totalTenants: tenantList.length,
          activeTenants: activeCount,
          trialTenants: trialCount,
          cancelledTenants: cancelledCount,
          totalUsers: 0, // Will fetch from users table
          totalProjects: 0, // Will fetch from properties table
          monthlyRevenue: mrr,
          annualRunRate: mrr * 12,
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
        setCancelledTenantNames(tenantList.filter(t => t.status === 'cancelled').map(t => t.name || t.id));
        setSuspendedTenantNames(tenantList.filter(t => t.status === 'suspended').map(t => t.name || t.id));

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

          const monthStart = new Date(year, monthIndex, 1);
          const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);

          // Cash collected this month — all tenants who actually paid (historical fact)
          const monthInvoices = historicalInvoices?.filter(inv => {
            const paidDate = new Date(inv.paid_at || inv.created_at);
            return paidDate >= monthStart && paidDate <= monthEnd;
          }) || [];

          let monthRevenue = monthInvoices.reduce((sum, inv) => sum + inv.amount, 0);
          let uniqueTenants = new Set(monthInvoices.map(inv => inv.tenant_id)).size;

          if (i === 0 && monthRevenue < mrr) {
            monthRevenue = mrr;
            uniqueTenants = activeTenantIds.size;
          }

          // ARR run-rate at month-end: for each active tenant, their latest invoice
          // rate paid ON OR BEFORE this month-end, summed then × 12.
          // This is consistent with the big-number ARR (MRR × 12) rather than lumpy cash flow.
          const rateAtMonth = new Map<string, number>();
          const timeAtMonth = new Map<string, number>();
          (paidInvoices || []).forEach((inv: any) => {
            if (!activeTenantIds.has(inv.tenant_id)) return;
            const t = new Date(inv.paid_at || inv.created_at).getTime();
            if (t > monthEnd.getTime()) return;
            if (!timeAtMonth.has(inv.tenant_id) || t > (timeAtMonth.get(inv.tenant_id) as number)) {
              timeAtMonth.set(inv.tenant_id, t);
              rateAtMonth.set(inv.tenant_id, Number(inv.amount));
            }
          });
          const mrrAtMonth = Array.from(rateAtMonth.values()).reduce((s, a) => s + a, 0);

          revenueTrend.push({
            month: monthName,
            revenue: monthRevenue,
            arr: i === 0 ? mrr * 12 : mrrAtMonth * 12,
            tenants: uniqueTenants
          });
        }
        setRevenueData(revenueTrend);

        // YTD revenue — actual cash collected Jan–today (all tenants, not just active).
        // This is the real "how much did we make this year" number.
        const thisYearStart = new Date(currentYear, 0, 1);
        let ytdTotal = 0;
        const ytdMonthly: RevenueData[] = [];
        for (let m = 0; m <= currentMonth; m++) {
          const mStart = new Date(currentYear, m, 1);
          const mEnd = new Date(currentYear, m + 1, 0, 23, 59, 59);
          let mRevenue = 0;
          (paidInvoices || []).forEach((inv: any) => {
            const t = new Date(inv.paid_at || inv.created_at);
            if (t >= mStart && t <= mEnd) mRevenue += Number(inv.amount);
          });
          ytdTotal += mRevenue;
          ytdMonthly.push({ month: months[m], revenue: mRevenue, arr: 0, tenants: 0 });
        }
        setYtdData(ytdMonthly);
        setStats(prev => ({ ...prev, annualRunRate: ytdTotal }));

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

        // Total revenue per tenant (reuse the paid invoices already fetched above).
        const revenueMap = new Map<string, number>();
        (paidInvoices || []).forEach((invoice: any) => {
          const current = revenueMap.get(invoice.tenant_id) || 0;
          revenueMap.set(invoice.tenant_id, current + Number(invoice.amount));
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

        // Plan popularity — tenants active/created in last 6 months, grouped by plan
        const planPopularityCutoff = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
        const { data: planRows } = await (supabase.from('tenants') as any)
          .select('id, subscription_plan')
          .eq('is_platform', false)
          .neq('status', 'cancelled')
          .gte('created_at', planPopularityCutoff);
        if (planRows) {
          const planMap = new Map<string, { tenantIds: string[] }>();
          (planRows as any[]).forEach((t: any) => {
            if (!t.subscription_plan) return;
            const entry = planMap.get(t.subscription_plan) || { tenantIds: [] };
            entry.tenantIds.push(t.id);
            planMap.set(t.subscription_plan, entry);
          });
          const planOrder = ['enterprise', 'professional', 'starter', 'free'];
          const popularity = planOrder
            .filter(p => planMap.has(p))
            .map(p => {
              const tenantIds = planMap.get(p)!.tenantIds;
              return {
                plan: p,
                tenantCount: tenantIds.length,
                userCount: tenantIds.reduce((s, id) => s + (userCountMap.get(id) || 0), 0),
              };
            })
            .sort((a, b) => b.tenantCount - a.tenantCount);
          setPlanPopularity(popularity);
        }

        // Revenue by plan — each active tenant's current monthly rate, grouped by plan
        // (same recurring basis as the MRR card, so the parts sum to MRR).
        const planRevenue = {
          enterprise: tenantList
            .filter(t => t.subscription_plan === 'enterprise' && t.status === 'active')
            .reduce((sum, t) => sum + (latestRate.get(t.id) || 0), 0),
          professional: tenantList
            .filter(t => t.subscription_plan === 'professional' && t.status === 'active')
            .reduce((sum, t) => sum + (latestRate.get(t.id) || 0), 0),
          starter: tenantList
            .filter(t => t.subscription_plan === 'starter' && t.status === 'active')
            .reduce((sum, t) => sum + (latestRate.get(t.id) || 0), 0)
        };
        setRevenueByPlan(planRevenue);

        // AR / cash health — outstanding invoices (money owed but not yet collected).
        const { data: openInvoices } = await (supabase as any)
          .from('invoices')
          .select('amount, status')
          .in('status', ['overdue', 'pending']);
        if (openInvoices) {
          const ar = { overdue: 0, overdueCount: 0, pending: 0, pendingCount: 0 };
          (openInvoices as any[]).forEach((inv: any) => {
            if (inv.status === 'overdue') { ar.overdue += Number(inv.amount) || 0; ar.overdueCount++; }
            else if (inv.status === 'pending') { ar.pending += Number(inv.amount) || 0; ar.pendingCount++; }
          });
          setArSummary(ar);
        }

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

      // Fetch total users count — customer-side only; exclude platform owners (us).
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .neq('role', 'owner');

      setStats(prev => ({ ...prev, totalUsers: userCount || 0 }));

      // Total projects across the whole platform — an Owner "scale of usage" metric
      // (aggregate count only, NOT per-project management). Scoped to customer tenants
      // so our own platform tenant (MAZMAKER) can't inflate it.
      const customerTenantIds = (tenants || []).map((t: any) => t.id);
      if (customerTenantIds.length > 0) {
        const { count: projectCount } = await supabase
          .from('properties')
          .select('*', { count: 'exact', head: true })
          .in('tenant_id', customerTenantIds);
        setStats(prev => ({ ...prev, totalProjects: projectCount || 0 }));
      }

      // === Cross-tenant real-estate rollup (Owner HQ lens) ===
      // units & leads carry tenant_id directly; Owner RLS permits cross-tenant read.
      // Scoped to customer tenants so our own platform tenant can't inflate it.
      if (customerTenantIds.length > 0) {
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        // Prior calendar month window [lastMonthStart, monthStart) for real MoM deltas.
        const lastMonthStart = new Date(monthStart);
        lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);

        const [unitsRes, leadsRes, usersRes] = await Promise.all([
          supabase.from('units').select('tenant_id, price, status, sold_at').in('tenant_id', customerTenantIds),
          supabase.from('leads').select('tenant_id, created_at, assigned_to, status, estimated_value').in('tenant_id', customerTenantIds),
          supabase.from('users').select('id, full_name, role, tenant_id').in('tenant_id', customerTenantIds),
        ]);
        const unitRows = (unitsRes.data || []) as { tenant_id: string; price: number | null; status: string | null; sold_at: string | null }[];
        const leadRows = (leadsRes.data || []) as { tenant_id: string; created_at: string | null; assigned_to: string | null; status: string | null; estimated_value: number | null }[];
        const userRows = (usersRes.data || []) as { id: string; full_name: string | null; role: string | null; tenant_id: string | null }[];

        let gdv = 0, soldValueAll = 0, soldUnits = 0, soldUnitsThisMonth = 0, newLeadsThisMonth = 0;
        let soldUnitsLastMonth = 0, newLeadsLastMonth = 0;
        const agg = new Map<string, { gdv: number; sold: number; total: number; soldValue: number; leads: number }>();
        const slot = (id: string) => {
          let r = agg.get(id);
          if (!r) { r = { gdv: 0, sold: 0, total: 0, soldValue: 0, leads: 0 }; agg.set(id, r); }
          return r;
        };
        unitRows.forEach((u) => {
          const price = Number(u.price) || 0;
          gdv += price;
          const r = slot(u.tenant_id);
          r.gdv += price; r.total += 1;
          if (u.status === 'sold') {
            soldUnits += 1; soldValueAll += price; r.sold += 1; r.soldValue += price;
            if (u.sold_at) {
              const sd = new Date(u.sold_at);
              if (sd >= monthStart) soldUnitsThisMonth += 1;
              else if (sd >= lastMonthStart) soldUnitsLastMonth += 1;
            }
          }
        });
        leadRows.forEach((l) => {
          slot(l.tenant_id).leads += 1;
          if (l.created_at) {
            const cd = new Date(l.created_at);
            if (cd >= monthStart) newLeadsThisMonth += 1;
            else if (cd >= lastMonthStart) newLeadsLastMonth += 1;
          }
        });

        setSalesStats({ gdv, soldValue: soldValueAll, soldUnits, soldUnitsThisMonth, totalUnits: unitRows.length, newLeadsThisMonth, totalLeads: leadRows.length });

        // GMV monthly breakdown — group sold units by sold_at month (last 6 months).
        const gmvByMonthKey = new Map<string, { gmv: number; units: number }>();
        unitRows.forEach((u) => {
          if (u.status === 'sold' && u.sold_at) {
            const d = new Date(u.sold_at);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const slot = gmvByMonthKey.get(key) || { gmv: 0, units: 0 };
            slot.gmv += Number(u.price) || 0;
            slot.units += 1;
            gmvByMonthKey.set(key, slot);
          }
        });
        const gmvMonths: { month: string; gmv: number; units: number }[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date();
          d.setMonth(d.getMonth() - i);
          const key = `${d.getFullYear()}-${d.getMonth()}`;
          const thaiM = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
          gmvMonths.push({ month: thaiM[d.getMonth()], ...(gmvByMonthKey.get(key) || { gmv: 0, units: 0 }) });
        }
        setGmvTrend(gmvMonths);

        // Real MoM deltas — null when there's no prior-month baseline (avoid fake %).
        const pct = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
        let tenantsThisMonth = 0, tenantsLastMonth = 0;
        ((tenants || []) as Tenant[]).forEach((t) => {
          if (!t.created_at) return;
          const cd = new Date(t.created_at);
          if (cd >= monthStart) tenantsThisMonth += 1;
          else if (cd >= lastMonthStart) tenantsLastMonth += 1;
        });
        setMomDelta({
          soldUnits: pct(soldUnitsThisMonth, soldUnitsLastMonth),
          leads: pct(newLeadsThisMonth, newLeadsLastMonth),
          tenants: pct(tenantsThisMonth, tenantsLastMonth),
        });

        const rows: CompanyRow[] = ((tenants || []) as Tenant[])
          .map((t) => {
            const r = agg.get(t.id);
            return { id: t.id, name: t.name, plan: t.subscription_plan, gdv: r?.gdv || 0, sold: r?.sold || 0, total: r?.total || 0, soldValue: r?.soldValue || 0, leads: r?.leads || 0 };
          })
          .filter((r) => r.total > 0)
          .sort((a, b) => b.soldValue - a.soldValue);
        setCompanyRows(rows);

        // Top salespeople — group leads by assigned_to, rank by won deal value.
        const tenantNameMap = new Map(((tenants || []) as Tenant[]).map((t) => [t.id, t.name]));
        const perf = new Map<string, { won: number; wonValue: number; assigned: number }>();
        leadRows.forEach((l) => {
          if (!l.assigned_to) return;
          let r = perf.get(l.assigned_to);
          if (!r) { r = { won: 0, wonValue: 0, assigned: 0 }; perf.set(l.assigned_to, r); }
          r.assigned += 1;
          if (l.status === 'won' || l.status === 'closed') {
            r.won += 1;
            r.wonValue += Number(l.estimated_value) || 0;
          }
        });
        const topReps: TopSalesRep[] = userRows
          .map((u) => {
            const p = perf.get(u.id);
            if (!p || p.assigned === 0) return null;
            return {
              id: u.id,
              name: u.full_name || 'ไม่ระบุชื่อ',
              role: u.role || 'sales',
              company: tenantNameMap.get(u.tenant_id || '') || '–',
              won: p.won,
              wonValue: p.wonValue,
              conversion: Math.round((p.won / p.assigned) * 100),
            };
          })
          .filter((r): r is TopSalesRep => r !== null)
          .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won)
          .slice(0, 5);
        setTopSalesReps(topReps);

        // Active Logins — via SECURITY DEFINER RPC (reads auth.users.last_sign_in_at safely).
        const { data: loginStats } = await (supabase as any).rpc('owner_active_user_stats', {
          p_tenant_ids: customerTenantIds,
        });
        if (loginStats?.[0]) {
          setActiveUsers({
            active7d: Number(loginStats[0].active_7d) || 0,
            active30d: Number(loginStats[0].active_30d) || 0,
            total: Number(loginStats[0].total_users) || 0,
          });
        }

        // License Utilization — plans.max_sales vs actual sales/agent user count per tenant.
        const [plansRes, tenantUsersRes] = await Promise.all([
          supabase.from('plans').select('id, max_sales'),
          supabase.from('users').select('tenant_id, role').in('tenant_id', customerTenantIds).neq('role', 'owner'),
        ]);
        const planLimits = new Map<string, number>(
          ((plansRes.data || []) as { id: string; max_sales: number }[]).map((p) => [p.id, p.max_sales])
        );
        const salesByTenant = new Map<string, number>();
        ((tenantUsersRes.data || []) as { tenant_id: string; role: string }[]).forEach((u) => {
          if (u.role === 'sales' || u.role === 'agent') {
            salesByTenant.set(u.tenant_id, (salesByTenant.get(u.tenant_id) || 0) + 1);
          }
        });
        const activeTenantList = ((tenants || []) as Tenant[]).filter((t) => t.status === 'active' && customerTenantIds.includes(t.id));
        let nearLimit = 0, totalUsed = 0, totalCap = 0;
        const notOnboardedNames: string[] = [];
        activeTenantList.forEach((t) => {
          const maxSales = planLimits.get(t.subscription_plan) || 0;
          const current = salesByTenant.get(t.id) || 0;
          totalUsed += current; totalCap += maxSales;
          if (maxSales > 0) {
            if ((current / maxSales) >= 0.7) nearLimit++;
            if (current === 0) notOnboardedNames.push(t.name || t.id);
          }
        });
        setLicenseUtil({
          avgPct: totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0,
          nearLimit,
          notOnboarded: notOnboardedNames.length,
          totalActive: activeTenantList.length,
          notOnboardedNames,
        });
      }

      // Platform sales pipeline — companies interested in buying the platform this
      // month (the Owner's OWN pipeline, distinct from tenants' home-buyer leads).
      const plMonthStart = new Date();
      plMonthStart.setDate(1); plMonthStart.setHours(0, 0, 0, 0);
      const { count: plNew } = await (supabase.from('platform_leads') as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', plMonthStart.toISOString());
      setPlatformLeadsNew(plNew || 0);

      // === Open support tickets (real) — feeds the exception-first alert strip ===
      const { data: tkData } = await (supabase as any).from('support_tickets').select('status');
      let openT = 0;
      ((tkData || []) as any[]).forEach((t: any) => { if (['open', 'pending', 'in_progress'].includes(t.status)) openT += 1; });
      setOpsStats({ openTickets: openT });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionPrice = (plan: string) => {
    // Read from the `plans` catalog (fetched into planPrices); fall back to 0
    // until it loads or if the plan has no row.
    return planPrices[plan] || { monthly: 0, annual: 0 };
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

  const thaiMonthShort = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const todayMonth = new Date().getMonth();
  const todayYear = new Date().getFullYear();

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

  // MoM delta -> KPI trend (↑↓ vs last month); undefined when no baseline (no fake %).
  const mkTrend = (d: number | null | undefined) => (d != null ? { value: Math.abs(d), up: d >= 0 } : undefined);

  // Exception-first alert chips — render ONLY when something needs the owner's attention.
  const alerts: { label: string; href: string; tone: 'red' | 'amber' }[] = [];
  if (stats.churnRate > 5) alerts.push({ label: `อัตราเลิกใช้สูง ${stats.churnRate}%`, href: '/owner-health', tone: 'red' });
  if (cancelledTenantNames.length > 0) {
    const preview = cancelledTenantNames.slice(0, 2).join(', ') + (cancelledTenantNames.length > 2 ? ` +${cancelledTenantNames.length - 2}` : '');
    alerts.push({ label: `ยกเลิกแล้ว ${cancelledTenantNames.length} บริษัท: ${preview}`, href: '/owner-health', tone: 'red' });
  }
  if (suspendedTenantNames.length > 0) {
    const preview = suspendedTenantNames.slice(0, 2).join(', ') + (suspendedTenantNames.length > 2 ? ` +${suspendedTenantNames.length - 2}` : '');
    alerts.push({ label: `ระงับการใช้ ${suspendedTenantNames.length} บริษัท: ${preview}`, href: '/owner-health', tone: 'red' });
  }
  if (opsStats.openTickets > 0) alerts.push({ label: `เคส Support ค้าง ${opsStats.openTickets} เคส`, href: '/owner-support', tone: 'amber' });
  if (atRiskTenants.length > 0) alerts.push({ label: `Trial ใกล้หมด ${atRiskTenants.filter(t => t.status === 'trial').length} ราย`, href: '/owner-health', tone: 'amber' });

  // Executive = ONLY the essentials (3-second scan). SaaS headline KPIs (real) —
  // รายได้ · ฐานลูกค้า · การรักษาฐาน. Detail lives on the dedicated pages.
  const saasKpis = [
    { title: 'รายได้ค่าเช่า/เดือน (MRR)', value: formatCurrency(stats.monthlyRevenue), icon: Receipt, color: KK.red, bg: KK.redLight, trend: mkTrend(stats.mrrGrowth), spark: revenueData.map((d) => ({ m: d.month, v: d.revenue })), sparkId: 'mrr', sparkLabel: 'MRR', sparkFmt: 'currency', href: '/payments' },
    { title: 'บริษัทในระบบ', value: stats.totalTenants.toLocaleString(), icon: Building2, color: KK.blue, bg: KK.blueLight, trend: mkTrend(momDelta.tenants), sub: `${stats.activeTenants} ใช้งาน · ${stats.trialTenants} ทดลอง${stats.totalTenants - stats.activeTenants - stats.trialTenants > 0 ? ` · ${stats.totalTenants - stats.activeTenants - stats.trialTenants} ระงับ/ยกเลิก` : ''}`, href: '/tenants' },
    { title: 'บริษัทที่เลิกใช้ (Customer Churn)', value: `${stats.churnRate}%`, icon: TrendingDown, color: stats.churnRate > 5 ? KK.red : stats.cancelledTenants > 0 ? KK.amber : KK.green, bg: stats.churnRate > 5 ? KK.redLight : stats.cancelledTenants > 0 ? KK.amberLight : KK.greenLight, sub: cancelledTenantNames.length > 0 ? `ยกเลิกแล้ว: ${cancelledTenantNames.slice(0, 3).join(', ')}${cancelledTenantNames.length > 3 ? ` +${cancelledTenantNames.length - 3}` : ''}` : `ยังไม่มีบริษัทยกเลิก จาก ${stats.totalTenants} บริษัท`, href: '/owner-health' },
  ];
  // Derived SaaS health metrics — no extra queries, all computed from stats above.
  const arr = stats.monthlyRevenue * 12;
  const arpu = stats.activeTenants > 0 ? Math.round(stats.monthlyRevenue / stats.activeTenants) : 0;
  const trialPool = stats.activeTenants + stats.cancelledTenants; // ever-started (trial → active OR cancelled)
  const trialConvPct = trialPool > 0 ? Math.round((stats.activeTenants / trialPool) * 100) : null;
  const saasKpis2 = [
    {
      title: 'ARR (รายได้ต่อปี)',
      value: fmtCompact(arr),
      icon: CreditCard,
      color: KK.red,
      bg: KK.redLight,
      sub: `MRR × 12 · YTD รวม ${fmtCompact(stats.annualRunRate)}`,
      spark: revenueData.map((d) => ({ m: d.month, v: d.arr })),
      sparkId: 'arr',
      sparkLabel: 'ARR',
      sparkFmt: 'compact' as const,
      href: '/payments',
    },
    {
      title: 'ARPU (รายได้/บริษัท/เดือน)',
      value: stats.activeTenants > 0 ? formatCurrency(arpu) : '—',
      icon: Trophy,
      color: KK.amber,
      bg: KK.amberLight,
      // proxy ARPU trend from MRR growth (tenant count stable → ARPU ∝ MRR)
      trend: stats.activeTenants > 0 && stats.mrrGrowth !== 0 ? mkTrend(stats.mrrGrowth) : undefined,
      sub: `เฉลี่ยต่อบริษัท · ${stats.activeTenants} บริษัท active · แนวโน้ม ∝ MRR`,
      href: '/payments',
    },
    {
      title: 'Trial → Paid Conversion',
      value: trialConvPct !== null ? `${trialConvPct}%` : '—',
      icon: trialConvPct !== null && trialConvPct >= 60 ? CheckCircle : AlertCircle,
      color: trialConvPct === null ? KK.gray : trialConvPct >= 60 ? KK.green : trialConvPct >= 40 ? KK.amber : KK.red,
      bg: trialConvPct === null ? '#f3f4f6' : trialConvPct >= 60 ? KK.greenLight : trialConvPct >= 40 ? KK.amberLight : KK.redLight,
      sub: `ทดลองแล้วใช้ ${stats.activeTenants} · ทดลองแล้วไม่ต่อ ${stats.cancelledTenants} · รอผล ${stats.trialTenants}`,
      href: '/tenants',
    },
  ];

  const gmvThisMonth = gmvTrend[gmvTrend.length - 1]?.gmv ?? 0;
  const gmvLastMonth = gmvTrend[gmvTrend.length - 2]?.gmv ?? 0;
  const momGmvPct = gmvLastMonth > 0 ? Math.round(((gmvThisMonth - gmvLastMonth) / gmvLastMonth) * 100) : null;
  const gmvUnitsThisMonth = gmvTrend[gmvTrend.length - 1]?.units ?? 0;

  const reKpis = [
    { title: 'GMV แพลตฟอร์ม (เดือนนี้)', value: fmtCompact(gmvThisMonth), icon: TrendingUp, color: KK.red, bg: KK.redLight, trend: mkTrend(momGmvPct), sub: `${gmvUnitsThisMonth} ยูนิต · สะสมรวม ${fmtCompact(salesStats.soldValue)} (${salesStats.soldUnits} ยูนิต)`, spark: gmvTrend.map((d) => ({ m: d.month, v: d.gmv })), sparkId: 'gmv', sparkLabel: 'มูลค่า GMV', sparkFmt: 'compact', href: '/owner-market' },
  ];

  // SaaS platform health row 2 — stickiness + license utilization (actionable SaaS signals).
  const activeUserColor = activeUsers.total === 0 ? KK.gray : activeUsers.active7d / activeUsers.total >= 0.5 ? KK.green : activeUsers.active7d / activeUsers.total >= 0.2 ? KK.amber : KK.red;
  const activeUserBg = activeUsers.total === 0 ? '#f3f4f6' : activeUsers.active7d / activeUsers.total >= 0.5 ? KK.greenLight : activeUsers.active7d / activeUsers.total >= 0.2 ? KK.amberLight : KK.redLight;
  const licenseColor = licenseUtil.nearLimit > 0 ? KK.green : licenseUtil.notOnboarded > 0 ? KK.amber : KK.green;
  const licenseBg = licenseUtil.nearLimit > 0 ? KK.greenLight : licenseUtil.notOnboarded > 0 ? KK.amberLight : KK.greenLight;
  const saasHealth2 = [
    {
      title: 'Active Logins (7 วัน)',
      value: activeUsers.total > 0 ? `${activeUsers.active7d} / ${activeUsers.total} คน` : '—',
      icon: Activity,
      color: activeUserColor,
      bg: activeUserBg,
      sub: `${activeUsers.active30d} คน active ใน 30 วัน · ยิ่งสูง = แพลตฟอร์มขาดไม่ได้`,
      href: '/owner-health',
    },
    {
      title: 'License Utilization',
      value: licenseUtil.totalActive > 0 ? `${licenseUtil.avgPct}%` : '—',
      icon: Users,
      color: licenseColor,
      bg: licenseBg,
      sub: licenseUtil.nearLimit > 0
        ? `${licenseUtil.nearLimit} บริษัท ใกล้เต็ม quota → โอกาส Upsell`
        : licenseUtil.notOnboardedNames.length > 0
        ? `ยังไม่เพิ่มผู้ใช้: ${licenseUtil.notOnboardedNames.slice(0, 3).join(', ')}${licenseUtil.notOnboardedNames.length > 3 ? ` +${licenseUtil.notOnboardedNames.length - 3}` : ''} → เสี่ยง Churn`
        : 'ใช้งานปกติ · ยังมี slot ว่าง',
      href: '/tenants',
    },
  ];

  // Zone divider header — icon chip + title + subtitle, separates the two worlds.
  const ZoneHeader = ({ icon: Icon, title, sub, color, bg }: { icon: any; title: string; sub: string; color: string; bg: string }) => (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
      </div>
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  );

  // Compact KPI card — secondary metrics (no sparkline, less height). Keeps visual hierarchy clear.
  const MiniCard = (kpi: any, i: number) => (
    <div
      key={i}
      onClick={() => kpi.href && navigate(kpi.href)}
      className={`bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 ${kpi.href ? 'cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200' : ''}`}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${kpi.bg}f0 0%, ${kpi.bg} 100%)` }}
      >
        <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 truncate">{kpi.title}</p>
        <p className="text-[22px] font-bold text-gray-900 tabular-nums leading-tight">{kpi.value}</p>
        {kpi.sub && <p className="text-[11px] text-gray-400 truncate mt-0.5">{kpi.sub}</p>}
      </div>
      {kpi.trend && (
        <span className="text-sm font-semibold flex-shrink-0" style={{ color: kpi.trend.up ? KK.green : KK.red }}>
          {kpi.trend.up ? '↗' : '↘'} {Math.abs(kpi.trend.value)}%
        </span>
      )}
    </div>
  );

  // One KPI "pulse" card — shared by both zones.
  const PulseCard = (kpi: any, i: number) => (
    <div
      key={i}
      onClick={() => (kpi.onClick ? kpi.onClick() : kpi.href && navigate(kpi.href))}
      className={`bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col ${kpi.href || kpi.onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="p-5 pb-2 flex-1">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-1.5 pt-1.5 min-w-0">
            <p className="text-sm font-medium text-gray-500 leading-tight truncate">{kpi.title}</p>
            {kpi.mock && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: KK.amber, backgroundColor: KK.amberLight }}>ตัวอย่าง</span>}
          </div>
          <div
            className="kpi-icon-bg w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: `linear-gradient(135deg, ${kpi.bg}f0 0%, ${kpi.bg} 100%)`,
              boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${kpi.color}15`,
            }}
          >
            <kpi.icon className="w-5 h-5" style={{ color: kpi.color, filter: `drop-shadow(0 1px 1px ${kpi.color}20)` }} strokeWidth={2.2} />
          </div>
        </div>
        <p className="text-[28px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{kpi.value}</p>
        {kpi.trend && (
          <div className="flex items-center gap-1.5 mt-2.5">
            <span className="text-[13px] font-semibold" style={{ color: kpi.trend.up ? KK.green : KK.red }}>
              {kpi.trend.up ? '↗' : '↘'} {Math.abs(kpi.trend.value)}%
            </span>
            <span className="text-[13px] text-gray-400">vs เดือนก่อน</span>
          </div>
        )}
        {kpi.sub && <p className={`text-[13px] text-gray-400 truncate ${kpi.trend ? 'mt-1' : 'mt-2.5'}`}>{kpi.sub}</p>}
      </div>
      {/* Sparkline — mini 6-month trend behind the headline number (cards with a real series).
          Cards without a series fall back to a spacer so the grid row stays equal-height. */}
      {kpi.spark && kpi.spark.length > 1 ? (
        <div className="px-2 pb-2 mt-1">
          <ResponsiveContainer width="100%" height={42}>
            <AreaChart data={kpi.spark} margin={{ top: 6, right: 6, left: 6, bottom: 0 }}>
              <defs>
                <linearGradient id={`spark-${kpi.sparkId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={kpi.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={kpi.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              {/* hidden axis so the hover crosshair + tooltip know the month */}
              <XAxis dataKey="m" hide />
              <Tooltip
                contentStyle={kkTooltipStyle}
                cursor={{ stroke: kpi.color, strokeWidth: 1, strokeDasharray: '3 3' }}
                formatter={((val: any) => {
                  const n = Number(val ?? 0);
                  const text = kpi.sparkFmt === 'currency' ? formatCurrency(n) : kpi.sparkFmt === 'compact' ? fmtCompact(n) : `${n.toLocaleString()} ยูนิต`;
                  return [text, kpi.sparkLabel];
                }) as any}
              />
              <Area type="monotone" dataKey="v" stroke={kpi.color} strokeWidth={2} fill={`url(#spark-${kpi.sparkId})`} dot={false} activeDot={{ r: 3, fill: kpi.color, stroke: '#fff', strokeWidth: 1.5 }} isAnimationActive={false} />
              {/* single end-dot — "นี่คือเดือนปัจจุบัน" */}
              <ReferenceDot x={kpi.spark[kpi.spark.length - 1].m} y={kpi.spark[kpi.spark.length - 1].v} r={3} fill={kpi.color} stroke="#fff" strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-3" />
      )}
    </div>
  );

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-8 space-y-7">
            {/* === Page Title === */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>
                  Platform
                </span>
                <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>

                <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: KK.blue, backgroundColor: KK.blueLight }}>
                  <Layers className="w-3.5 h-3.5" />
                  ทั้งแพลตฟอร์ม · {stats.totalTenants} บริษัท · {stats.totalProjects} โครงการ · {salesStats.totalUnits.toLocaleString()} ยูนิต · {salesStats.totalLeads.toLocaleString()} ผู้สนใจ
                </div>
              </div>
              {/* Period filter — strategic tier (เดือน/ไตรมาส/ปี); บอกว่าข้อมูลที่โชว์เป็นของช่วงไหน */}
              <PeriodFilter value={period} onChange={setPeriod} tier="strategic" className="self-start sm:self-auto" />
            </div>

            {/* Exception-first alert banner — shows only when something needs attention */}
            {alerts.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                <span className="flex items-center gap-1.5 text-sm font-bold text-amber-700 shrink-0">
                  <AlertCircle className="w-4 h-4" />
                  ต้องดำเนินการ
                </span>
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {alerts.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => navigate(a.href)}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline transition-opacity hover:opacity-75"
                      style={{ color: a.tone === 'red' ? KK.red : KK.amber }}
                    >
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {a.label} →
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ━━━━━━━━━━ ZONE 1 · ธุรกิจแพลตฟอร์ม (SaaS) ━━━━━━━━━━ */}
            <div className="pt-2">
              <ZoneHeader icon={Receipt} title="ธุรกิจแพลตฟอร์ม (SaaS)" sub="รายได้ค่าเช่าระบบ · ผู้เช่า · การเติบโตของธุรกิจเราเอง" color={KK.blue} bg={KK.blueLight} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {saasKpis.map(PulseCard)}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {saasKpis2.map(MiniCard)}
            </div>

            {/* AR / Cash Health — เงินค้างรับ แสดงเมื่อมี overdue หรือ pending */}
            {(arSummary.overdue > 0 || arSummary.pending > 0) && (
              <div className="flex flex-wrap gap-3">
                {arSummary.overdue > 0 && (
                  <div
                    className="flex-1 min-w-[200px] rounded-xl border border-red-200 bg-red-50 p-4 cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate('/payments?tab=invoices')}
                  >
                    <p className="text-xs font-semibold mb-1" style={{ color: KK.red }}>เงินค้างชำระเกินกำหนด (Overdue)</p>
                    <p className="text-2xl font-bold tabular-nums" style={{ color: KK.red }}>{fmtCompact(arSummary.overdue)}</p>
                    <p className="text-xs mt-1" style={{ color: KK.red + '99' }}>{arSummary.overdueCount} ใบแจ้งหนี้ · คลิกดูรายละเอียด →</p>
                  </div>
                )}
                {arSummary.pending > 0 && (
                  <div
                    className="flex-1 min-w-[200px] rounded-xl border border-amber-200 bg-amber-50 p-4 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => navigate('/payments?tab=invoices')}
                  >
                    <p className="text-xs font-semibold text-amber-700 mb-1">รอชำระ (Pending)</p>
                    <p className="text-2xl font-bold tabular-nums text-amber-700">{fmtCompact(arSummary.pending)}</p>
                    <p className="text-xs text-amber-500 mt-1">{arSummary.pendingCount} ใบแจ้งหนี้ · คลิกดูรายละเอียด →</p>
                  </div>
                )}
              </div>
            )}

            {/* Zone 1 charts — MRR 70% | Tenant Donut 30% (ยังอยู่ในโซน SaaS) */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">

              {/* MRR Trend */}
              <div
                className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-md transition-shadow duration-200"
                onClick={() => navigate('/payments?tab=revenue-health')}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">แนวโน้มรายได้ (MRR)</h2>
                    <p className="text-xs text-gray-500 mt-0.5">6 เดือนที่ผ่านมา · รวมทุกแพ็กเกจ · คลิกดูรายละเอียด →</p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>6 เดือน</span>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revenueData} margin={{ top: 10, right: 8, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ownerRevGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"  stopColor={KK.red} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={KK.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: KK.red + '99' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={kkTooltipStyle} cursor={{ stroke: KK.red, strokeWidth: 1, strokeDasharray: '4 4' }} formatter={((v: any) => [formatCurrency(Number(v ?? 0)), 'MRR']) as any} />
                    <Area type="monotone" dataKey="revenue" stroke={KK.red} strokeWidth={2.5} fill="url(#ownerRevGrad)" dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} animationDuration={1300} animationEasing="ease-in-out" />
                    {revenueData.length > 0 && (
                      <ReferenceDot x={revenueData[revenueData.length - 1].month} y={revenueData[revenueData.length - 1].revenue} r={5} fill={KK.red} stroke="#fff" strokeWidth={2} />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Tenant Status Donut */}
              <div
                className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-md transition-shadow duration-200"
                onClick={() => navigate('/tenants')}
              >
                <h2 className="text-base font-bold text-gray-900 mb-0.5">สัดส่วนบริษัท</h2>
                <p className="text-xs text-gray-500 mb-3">คลิกเพื่อจัดการ →</p>
                {(() => {
                  const suspended = Math.max(0, stats.totalTenants - stats.activeTenants - stats.trialTenants);
                  const donutData = [
                    { name: 'ใช้งาน', value: stats.activeTenants, color: KK.green },
                    { name: 'ทดลอง', value: stats.trialTenants, color: KK.amber },
                    ...(suspended > 0 ? [{ name: 'ระงับ/ยกเลิก', value: suspended, color: KK.gray }] : []),
                  ].filter(d => d.value > 0);
                  const total = donutData.reduce((s, d) => s + d.value, 0) || 1;
                  return (
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative" style={{ width: 160, height: 160 }}>
                        <PieChart width={160} height={160}>
                          <Pie data={donutData} cx={76} cy={76} innerRadius={50} outerRadius={72} dataKey="value" strokeWidth={2} stroke="#fff">
                            {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                        {/* Total in the donut hole — instant "how many companies" read */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <div className="text-[26px] font-bold text-gray-900 leading-none tabular-nums">{stats.totalTenants}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5">บริษัท</div>
                        </div>
                      </div>
                      <div className="w-full space-y-2">
                        {donutData.map((d, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                            <span className="text-sm text-gray-600 flex-1">{d.name}</span>
                            <span className="text-sm font-bold text-gray-900">{d.value}</span>
                            <span className="text-xs text-gray-400 w-9 text-right">{Math.round(d.value / total * 100)}%</span>
                          </div>
                        ))}
                      </div>
                      {/* Revenue by Plan — แสดงเมื่อมีรายได้จริง */}
                      {(revenueByPlan.enterprise + revenueByPlan.professional + revenueByPlan.starter) > 0 && (
                        <div className="w-full mt-4 pt-4 border-t border-gray-100">
                          <p className="text-xs font-semibold text-gray-500 mb-3">รายได้แยกตาม Plan (MRR)</p>
                          <div className="space-y-2.5">
                            {[
                              { plan: 'Enterprise', rev: revenueByPlan.enterprise, color: KK.red },
                              { plan: 'Professional', rev: revenueByPlan.professional, color: KK.blue },
                              { plan: 'Starter', rev: revenueByPlan.starter, color: KK.amber },
                            ].filter(p => p.rev > 0).map((p, i) => (
                              <div key={i}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-xs text-gray-600">{p.plan}</span>
                                  <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>{formatCurrency(p.rev)}</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                  <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((p.rev / stats.monthlyRevenue) * 100)}%`, backgroundColor: p.color }} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* SaaS Platform Health — stickiness + license utilization */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {saasHealth2.map(MiniCard)}
            </div>

            {/* ━━━━━━━━━━ ZONE 2 · ภาพรวมอสังหาฯ ข้ามทุกบริษัท ━━━━━━━━━━ */}
            <div className="pt-2">
              <ZoneHeader icon={Home} title="ภาพรวมอสังหาฯ ข้ามทุกบริษัท" sub="ยอดขาย · ลูกค้า · สต็อก — สุขภาพของลูกค้า (สัญญาณว่าจะอยู่ต่อหรือเลิกใช้)" color={KK.red} bg={KK.redLight} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {reKpis.map(PulseCard)}
            </div>

            {/* Zone 2 charts — อันดับผู้ขาย (ซ้าย) | Leaderboard Top 5 บริษัท (ขวา) 50:50 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div
              className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-md transition-shadow duration-200"
              onClick={() => navigate('/owner-companies')}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">อันดับผู้ขายดีที่สุด</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Top 5 ข้ามทุกบริษัท · จากยอดดีลที่ปิดได้ · คลิกดูทั้งหมด →</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>Top 5</span>
              </div>
              {topSalesReps.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลผู้ขาย</p>
              ) : (() => {
                const maxVal = Math.max(...topSalesReps.map((r) => r.wonValue), 1);
                return (
                  <div className="space-y-3.5">
                    {topSalesReps.map((rep, i) => (
                      <div key={rep.id} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <span className="text-sm font-semibold text-gray-800 truncate block">{rep.name}</span>
                              <span className="text-[11px] text-gray-400 truncate block">{rep.company}</span>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm font-bold tabular-nums block" style={{ color: KK.red }}>{fmtCompact(rep.wonValue)}</span>
                              <span className="text-[11px] text-gray-400">{rep.won} ดีล · {rep.conversion}%</span>
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${(rep.wonValue / maxVal) * 100}%`, backgroundColor: KK.red }} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Leaderboard — Top 5 companies by sold value (preview → /owner-companies) */}
            <div
              className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-md transition-shadow duration-200"
              onClick={() => navigate('/owner-companies')}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">อันดับบริษัทขายดี</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Top 5 ตามมูลค่าขาย · คลิกดูทั้งหมด →</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ color: KK.red, backgroundColor: KK.redLight }}>Top 5</span>
              </div>
              {(() => {
                const top = companyRows.slice(0, 5);
                if (top.length === 0) return <p className="text-sm text-gray-400 text-center py-10">ยังไม่มีข้อมูลยอดขาย</p>;
                const max = Math.max(...top.map((c) => c.soldValue), 1);
                return (
                  <div className="space-y-3.5">
                    {top.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold tabular-nums text-gray-300 flex-shrink-0 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-800 truncate">{c.name}</span>
                            <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: KK.red }}>{fmtCompact(c.soldValue)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(c.soldValue / max) * 100}%`, backgroundColor: KK.red }} />
                          </div>
                          <span className="text-[11px] text-gray-400 mt-0.5 inline-block">ขายแล้ว {c.sold.toLocaleString()} ยูนิต · {c.total.toLocaleString()} ยูนิตทั้งหมด</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            </div>

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
