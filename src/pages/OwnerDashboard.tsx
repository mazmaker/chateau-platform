import { useState, useEffect, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import PeriodFilter, { type PeriodKey, DEFAULT_PERIOD, periodRangeLabel } from '@/components/dashboard/PeriodFilter';
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
  Clock,
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
  ChevronRight,
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

// Thai Baht glyph that drops into the same slot as a lucide icon (lucide has no ฿ icon).
// Accepts the same className/style props the icon map passes, so money cards read in THB not $.
// Sized/weighted to visually match the lucide line-icons next to it (bigger + heavier than the
// raw glyph default). w-4 callers (section headers) get a smaller size than w-5 KPI badges.
const BahtSign = ({ className = '', style }: { className?: string; style?: CSSProperties; strokeWidth?: number }) => (
  <span
    className="inline-flex items-center justify-center leading-none"
    style={{ ...style, fontSize: className.includes('w-4') ? '17px' : '23px', fontWeight: 800 }}
  >฿</span>
);

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
    totalUsers: 0,
    totalProjects: 0,
    monthlyRevenue: 0,
    annualRunRate: 0,
    churnRate: 0,
    mrrGrowth: 0
  });
  const [recentTenants, setRecentTenants] = useState<Tenant[]>([]);
  const [atRiskTenants, setAtRiskTenants] = useState<Tenant[]>([]);
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

        setStats({
          totalTenants: tenantList.length,
          activeTenants: activeCount,
          trialTenants: trialCount,
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

        const [unitsRes, leadsRes] = await Promise.all([
          supabase.from('units').select('tenant_id, price, status, sold_at').in('tenant_id', customerTenantIds),
          supabase.from('leads').select('tenant_id, created_at').in('tenant_id', customerTenantIds),
        ]);
        const unitRows = (unitsRes.data || []) as { tenant_id: string; price: number | null; status: string | null; sold_at: string | null }[];
        const leadRows = (leadsRes.data || []) as { tenant_id: string; created_at: string | null }[];

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
      }

      // Platform sales pipeline — companies interested in buying the platform this
      // month (the Owner's OWN pipeline, distinct from tenants' home-buyer leads).
      const plMonthStart = new Date();
      plMonthStart.setDate(1); plMonthStart.setHours(0, 0, 0, 0);
      const { count: plNew } = await (supabase.from('platform_leads') as any)
        .select('*', { count: 'exact', head: true })
        .gte('created_at', plMonthStart.toISOString());
      setPlatformLeadsNew(plNew || 0);

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

  const tenantStatusData = [
    { name: 'ใช้งาน',    value: stats.activeTenants, color: KK.green },
    { name: 'ทดลองใช้', value: stats.trialTenants, color: KK.amber },
    { name: 'ระงับ',     value: Math.max(0, stats.totalTenants - stats.activeTenants - stats.trialTenants), color: KK.red },
  ].filter(d => d.value > 0);

  const planRevenueData = [
    { name: 'Enterprise',   value: revenueByPlan.enterprise,   color: KK.purple },
    { name: 'Professional', value: revenueByPlan.professional, color: KK.blue },
    { name: 'Starter',      value: revenueByPlan.starter,      color: KK.gray },
  ];
  const maxPlanRevenue = Math.max(...planRevenueData.map(p => p.value), 1);

  // ── Analysis mini-widget data ──
  // REAL where the aggregate is already in scope (inventory, top company). The rest are
  // clearly-labeled "ตัวอย่าง" (mock) placeholders kept for UI-first validation — they mark
  // IMPORTANT owner metrics whose source data isn't wired yet (monthly series, price buckets,
  // lead-stage breakdown, occupation, province) and carry a badge so no fake number reads as truth.
  const wSalesTrend = [{ m: 'ม.ค.', v: 18 }, { m: 'ก.พ.', v: 22 }, { m: 'มี.ค.', v: 19 }, { m: 'เม.ย.', v: 27 }, { m: 'พ.ค.', v: 31 }, { m: 'มิ.ย.', v: salesStats.soldUnitsThisMonth || 24 }];
  const wTopProvince = [{ label: 'กรุงเทพฯ', v: 14 }, { label: 'ประจวบฯ', v: 9 }, { label: 'สมุทรปราการ', v: 7 }, { label: 'เชียงใหม่', v: 5 }, { label: 'นนทบุรี', v: 4 }];
  const provMax = Math.max(...wTopProvince.map(p => p.v));
  // REAL — derived from live aggregates already fetched (no mock):
  const wInventory = [
    { name: 'ขายแล้ว', v: salesStats.soldUnits, c: KK.green },
    { name: 'ยังว่าง', v: Math.max(0, salesStats.totalUnits - salesStats.soldUnits), c: KK.blue },
  ];
  const wTopCompany = companyRows.slice(0, 3).map((c) => ({ name: c.name, v: fmtCompact(c.soldValue) }));

  // Reusable summary-widget shell: title (+ optional 'ตัวอย่าง' mock badge) + "ดูเพิ่ม →" drill link + inline mini-chart.
  const Widget = ({ title, sub, href, mock, children }: { title: string; sub?: string; href: string; mock?: boolean; children: React.ReactNode }) => (
    <div
      onClick={() => navigate(href)}
      className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <h3 className="text-sm font-bold text-gray-900 truncate">{title}</h3>
            {mock && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: KK.amber, backgroundColor: KK.amberLight }}>ตัวอย่าง</span>}
          </div>
          {sub && <p className="text-[11px] text-gray-400 mt-0.5 truncate">{sub}</p>}
        </div>
        <span className="text-[11px] font-medium flex items-center gap-0.5 flex-shrink-0 ml-2 group-hover:underline" style={{ color: KK.red }}>
          ดูเพิ่ม <ChevronRight className="w-3 h-3" />
        </span>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );

  // Resolved date-range label for the header (strategic tier).
  const periodRange = periodRangeLabel(period);

  // Executive = command center of BOTH worlds. Split into 2 labeled zones so it reads
  // as "everything at a glance" without feeling mixed: SaaS business vs cross-tenant real-estate.
  // MoM delta -> KPI trend object (↑↓ vs last month); undefined when no baseline (no fake %).
  const mkTrend = (d: number | null | undefined) => (d != null ? { value: Math.abs(d), up: d >= 0 } : undefined);
  const saasKpis = [
    { title: 'รายได้ค่าเช่า/เดือน (MRR)', value: formatCurrency(stats.monthlyRevenue), icon: Receipt, color: KK.blue, bg: KK.blueLight, trend: mkTrend(stats.mrrGrowth), href: '/payments' },
    { title: 'บริษัทในระบบ', value: stats.totalTenants.toLocaleString(), icon: Building2, color: KK.blue, bg: KK.blueLight, trend: mkTrend(momDelta.tenants), sub: `${stats.activeTenants} ใช้งาน · ${stats.trialTenants} ทดลอง`, href: '/tenants' },
    { title: 'อัตราเลิกใช้ (Churn)', value: `${stats.churnRate}%`, icon: TrendingDown, color: stats.churnRate > 5 ? KK.red : KK.green, bg: stats.churnRate > 5 ? KK.redLight : KK.greenLight, sub: 'เดือนนี้', href: '/owner-health' },
  ];
  const reKpis = [
    { title: 'ยอดขายรวมทั้งแพลตฟอร์ม', value: fmtCompact(salesStats.soldValue), icon: TrendingUp, color: KK.red, bg: KK.redLight, sub: `ขายแล้ว ${salesStats.soldUnits.toLocaleString()} ยูนิต`, href: '/owner-market' },
    { title: 'ขายได้เดือนนี้', value: `${salesStats.soldUnitsThisMonth.toLocaleString()} ยูนิต`, icon: CheckCircle, color: KK.green, bg: KK.greenLight, trend: mkTrend(momDelta.soldUnits), sub: `จากทั้งหมด ${salesStats.soldUnits.toLocaleString()} ยูนิต`, href: '/owner-market' },
    { title: 'ผู้ติดต่อทั้งหมด', value: salesStats.totalLeads.toLocaleString(), icon: Users, color: KK.amber, bg: KK.amberLight, trend: mkTrend(momDelta.leads), sub: 'ผู้ติดต่อข้ามทุกบริษัท', href: '/owner-customers' },
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

  // One KPI "pulse" card — shared by both zones.
  const PulseCard = (kpi: any, i: number) => (
    <div
      key={i}
      onClick={() => kpi.href && navigate(kpi.href)}
      className={`bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 flex flex-col ${kpi.href ? 'cursor-pointer' : ''}`}
    >
      <div className="p-5 pb-2 flex-1">
        <div className="flex items-start justify-between mb-4">
          <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{kpi.title}</p>
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
      <div className="h-3" />{/* uniform bottom spacing — all KPI cards same height */}
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
                <p className="text-[15px] text-gray-500 mt-1.5">มุมมอง HQ ข้ามทุกบริษัท · ข้อมูลช่วง <span className="font-semibold text-gray-700">{periodRange}</span></p>
                <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ color: KK.blue, backgroundColor: KK.blueLight }}>
                  <Layers className="w-3.5 h-3.5" />
                  ทั้งแพลตฟอร์ม · {stats.totalTenants} บริษัท · {stats.totalProjects} โครงการ · {salesStats.totalUnits.toLocaleString()} ยูนิต · {salesStats.totalLeads.toLocaleString()} ผู้ติดต่อ
                </div>
              </div>
              {/* Period filter — strategic tier (เดือน/ไตรมาส/ปี); บอกว่าข้อมูลที่โชว์เป็นของช่วงไหน */}
              <PeriodFilter value={period} onChange={setPeriod} tier="strategic" className="self-start sm:self-auto" />
            </div>

            {/* ━━━━━━━━━━ ZONE 1 · ธุรกิจแพลตฟอร์ม (SaaS) ━━━━━━━━━━ */}
            <div className="pt-2">
              <ZoneHeader icon={Receipt} title="ธุรกิจแพลตฟอร์ม (SaaS)" sub="รายได้ค่าเช่าระบบ · ผู้เช่า · การเติบโตของธุรกิจเราเอง" color={KK.blue} bg={KK.blueLight} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {saasKpis.map(PulseCard)}
            </div>

            {/* === Revenue Trend — full-width hero chart === */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-gray-900">แนวโน้มรายได้</h2>
                  <p className="text-xs text-gray-500 mt-0.5">6 เดือนที่ผ่านมา · รวมทุกแพ็กเกจ</p>
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
                  <Area type="monotone" dataKey="revenue" stroke={KK.red} strokeWidth={2.5} fill="url(#ownerRevGrad)" dot={false} activeDot={{ r: 4, fill: KK.red, stroke: '#fff', strokeWidth: 2 }} animationDuration={1300} animationEasing="ease-in-out" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* === Composition: Tenant Status donut (1/3) + Plan Summary (2/3) === */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
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

              {/* Plan Summary (merged revenue + popularity) */}
              <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <BahtSign className="w-4 h-4" style={{ color: KK.green }} />
                    <h2 className="text-base font-bold text-gray-900">สรุปตามแพ็กเกจ</h2>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">จำนวนบริษัท · ผู้ใช้งาน · MRR รายเดือน</p>
                </div>
                <span className="text-xs text-gray-400">รวม MRR <span className="font-bold text-gray-700 tabular-nums ml-1">{formatCurrency(planRevenueData.reduce((s, p) => s + p.value, 0))}</span></span>
              </div>
              {(() => {
                const PLAN_META: Record<string, { label: string; color: string; bg: string; revenue: number }> = {
                  enterprise:   { label: 'Enterprise',   color: KK.amber,  bg: KK.amberLight,  revenue: revenueByPlan.enterprise   },
                  professional: { label: 'Professional', color: KK.blue,   bg: KK.blueLight,   revenue: revenueByPlan.professional },
                  starter:      { label: 'Starter',      color: KK.green,  bg: KK.greenLight,  revenue: revenueByPlan.starter      },
                  free:         { label: 'Free',         color: KK.gray,   bg: KK.grayLight,   revenue: 0                         },
                };
                const allPlans = ['enterprise', 'professional', 'starter', 'free'];
                const rows = allPlans.map(key => {
                  const pop = planPopularity.find(p => p.plan === key);
                  const meta = PLAN_META[key];
                  return { key, ...meta, tenantCount: pop?.tenantCount || 0, userCount: pop?.userCount || 0 };
                });  // show all 4 plan tiers — even 0-tenant ones — so the breakdown reads as a full price ladder
                const maxCount = Math.max(...rows.map(r => r.tenantCount), 1);
                const totalMrr = rows.reduce((s, r) => s + r.revenue, 0);
                return (
                  <div className="flex-1 flex flex-col divide-y divide-gray-100">
                    {rows.map((r) => {
                      const pct = totalMrr > 0 ? Math.round((r.revenue / totalMrr) * 100) : 0;
                      return (
                        <div key={r.key} className="flex-1 flex items-center gap-4">
                          <div className="flex items-center gap-2.5 w-32 flex-shrink-0">
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
                            <span className="text-sm font-medium text-gray-700">{r.label}</span>
                          </div>
                          <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((r.tenantCount / maxCount) * 100)}%`, backgroundColor: r.color, opacity: 0.85 }} />
                          </div>
                          <span className="text-xs text-gray-400 tabular-nums w-32 text-right flex-shrink-0">{r.tenantCount} บริษัท · {r.userCount} ผู้ใช้</span>
                          <div className="w-24 text-right flex-shrink-0">
                            <div className="text-sm font-bold tabular-nums" style={{ color: r.revenue > 0 ? '#111827' : '#d1d5db' }}>{formatCurrency(r.revenue)}</div>
                            <div className="text-[11px] text-gray-400 tabular-nums">{pct}% ของ MRR</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              </div>
            </div>

            {/* ━━━━━━━━━━ ZONE 2 · ภาพรวมอสังหาฯ ข้ามทุกบริษัท ━━━━━━━━━━ */}
            <div className="pt-2">
              <ZoneHeader icon={Home} title="ภาพรวมอสังหาฯ ข้ามทุกบริษัท" sub="ยอดขาย · ลูกค้า · สต็อก — สุขภาพของลูกค้า (สัญญาณว่าจะอยู่ต่อหรือเลิกใช้)" color={KK.red} bg={KK.redLight} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reKpis.map(PulseCard)}
            </div>

            {/* ภาพรวมวิเคราะห์แต่ละด้าน — มินิกราฟ inline (สรุป → "ดูเพิ่ม" เพื่อเจาะลึก) */}
            <div>
              <h2 className="text-base font-bold text-gray-900 mb-1">ภาพรวมวิเคราะห์</h2>
              <p className="text-xs text-gray-500 mb-4">สรุปทุกด้านในหน้าเดียว · กด "ดูเพิ่ม →" เพื่อเจาะลึกแต่ละเมนู · ป้าย <span className="font-semibold" style={{ color: KK.amber }}>ตัวอย่าง</span> = ยังไม่ได้ต่อข้อมูลจริง</p>
              <div className="space-y-5">

                <Widget title="แนวโน้มยอดขาย" sub="ยูนิตที่ขายได้ · 6 เดือนล่าสุด" href="/owner-market" mock>
                  <ResponsiveContainer width="100%" height={170}>
                    <AreaChart data={wSalesTrend} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
                      <defs><linearGradient id="wSales" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={KK.red} stopOpacity={0.3} /><stop offset="100%" stopColor={KK.red} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="m" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={28} />
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [`${v} ยูนิต`, '']) as any} />
                      <Area type="monotone" dataKey="v" stroke={KK.red} strokeWidth={2.5} fill="url(#wSales)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Widget>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                <Widget title="สถานะสินค้าคงคลัง" sub="ขายแล้ว / ยังว่าง" href="/owner-inventory">
                  <div className="flex items-center gap-3">
                    <div className="w-[120px] h-[120px] flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={wInventory} dataKey="v" nameKey="name" cx="50%" cy="50%" innerRadius={38} outerRadius={56} paddingAngle={2}>{wInventory.map((d, i) => <Cell key={i} fill={d.c} />)}</Pie><Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} ยูนิต`, n]) as any} /></PieChart></ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-1">{wInventory.map((d, i) => (<div key={i} className="flex items-center gap-1.5 text-[11px]"><span className="w-2 h-2 rounded-sm" style={{ backgroundColor: d.c }} /><span className="text-gray-600 flex-1 truncate">{d.name}</span><span className="tabular-nums text-gray-800 font-semibold">{d.v}</span></div>))}</div>
                  </div>
                </Widget>

                <Widget title="ทำเลขายดี" sub="Top จังหวัด (ยูนิตที่ขายได้)" href="/owner-geography" mock>
                  <div className="space-y-1.5 pt-1">
                    {wTopProvince.map((p, i) => (<div key={p.label}>
                      <div className="flex justify-between text-[11px] mb-0.5"><span className="text-gray-600">{p.label}</span><span className="tabular-nums text-gray-400">{p.v}</span></div>
                      <div className="h-3 rounded bg-gray-100 overflow-hidden"><div className="h-full rounded" style={{ width: `${Math.max((p.v / provMax) * 100, 3)}%`, background: i === 0 ? KK.red : '#fca5a5' }} /></div>
                    </div>))}
                  </div>
                </Widget>

                <Widget title="บริษัททำยอดสูงสุด" sub="Top 3 · มูลค่าขาย (รวมอันดับผู้ขายในหน้านี้)" href="/owner-companies">
                  <div className="space-y-2.5 pt-1">{wTopCompany.length === 0 ? <p className="text-xs text-gray-400">ยังไม่มีข้อมูลยอดขาย</p> : wTopCompany.map((c, i) => (<div key={i} className="flex items-center gap-2 text-sm"><span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0" style={{ color: KK.blue, backgroundColor: KK.blueLight }}>{i + 1}</span><span className="text-gray-700 flex-1 truncate">{c.name}</span><span className="tabular-nums font-semibold text-gray-900">{c.v}</span></div>))}</div>
                </Widget>

                </div>
              </div>
            </div>

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
