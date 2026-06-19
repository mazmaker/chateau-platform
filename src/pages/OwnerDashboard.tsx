import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSimpleAuth } from '@/contexts/AuthContextSimple';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import {
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Receipt,
  Trophy,
  CreditCard,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { committedMRR } from '@/lib/mrr';
import { computeRevenueHealth } from '@/lib/revenueHealth';
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
  churnLastMonth: number;
  mrrGrowth: number;
}

interface RevenueData {
  month: string;
  revenue: number;
  arr: number;
  tenants: number;
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

// Module-level cache — survives navigation (unmount/remount) within the same browser tab.
// Cleared automatically when the tab is closed or refreshed.
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes
interface OwnerDashCache {
  ts: number;
  stats: DashboardStats;
  revenueData: RevenueData[];
  revenueByPlan: { enterprise: number; professional: number; starter: number };
  arSummary: { overdue: number; overdueCount: number; pending: number; pendingCount: number };
  opsStats: { openTickets: number };
  activeUsers: { active7d: number; active30d: number; total: number };
  licenseUtil: { avgPct: number; nearLimit: number; notOnboarded: number; totalActive: number; notOnboardedNames: string[]; nearLimitDetails: { name: string; pct: number }[] };
  revHealth: { nrr: number | null; grr: number | null; revenueChurn: number | null };
  atRiskTenants: Tenant[];
  cancelledTenantNames: string[];
  cancelledLast30DayNames: string[];
  suspendedTenantNames: string[];
}
let _ownerDashCache: OwnerDashCache | null = null;

const OwnerDashboard = () => {
  const navigate = useNavigate();
  useSimpleAuth();
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
    churnLastMonth: 0,
    mrrGrowth: 0
  });
  const [atRiskTenants, setAtRiskTenants] = useState<Tenant[]>([]);
  const [cancelledTenantNames, setCancelledTenantNames] = useState<string[]>([]);
  const [cancelledLast30DayNames, setCancelledLast30DayNames] = useState<string[]>([]);
  const [suspendedTenantNames, setSuspendedTenantNames] = useState<string[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData[]>([]);
  const [revenueByPlan, setRevenueByPlan] = useState<{
    enterprise: number;
    professional: number;
    starter: number;
  }>({ enterprise: 0, professional: 0, starter: 0 });
  // Plan list prices, read from the `plans` table (single source of truth) so
  // this matches the จัดการแพ็กเกจ editor instead of a hardcoded copy.
  // AR / cash health — money owed but not yet collected (≠ MRR). Sourced from invoices.
  const [arSummary, setArSummary] = useState({ overdue: 0, overdueCount: 0, pending: 0, pendingCount: 0 });
  // Open support tickets (real) — feeds the exception-first alert strip.
  const [opsStats, setOpsStats] = useState<{ openTickets: number }>({ openTickets: 0 });
  // Platform stickiness — active logins via auth.users (SECURITY DEFINER RPC).
  const [activeUsers, setActiveUsers] = useState({ active7d: 0, active30d: 0, total: 0 });
  // License utilization — current users vs plan quota (upsell signal).
  const [licenseUtil, setLicenseUtil] = useState({ avgPct: 0, nearLimit: 0, notOnboarded: 0, totalActive: 0, notOnboardedNames: [] as string[], nearLimitDetails: [] as { name: string; pct: number }[] });
  // Revenue retention headline (NRR/GRR/Revenue Churn) — summary only; full view in Payments › สุขภาพรายได้.
  const [revHealth, setRevHealth] = useState<{ nrr: number | null; grr: number | null; revenueChurn: number | null }>({ nrr: null, grr: null, revenueChurn: null });
  // Incremented after every completed fetch (background or foreground) so the cache-save
  // useEffect fires with fully-settled React state, not stale closure values.
  const [fetchSeq, setFetchSeq] = useState(0);

  useEffect(() => {
    if (!isOwner) { navigate('/'); return; }
    const isFresh = _ownerDashCache && (Date.now() - _ownerDashCache.ts) < CACHE_TTL_MS;
    if (isFresh && _ownerDashCache) {
      const c = _ownerDashCache;
      setStats(c.stats); setRevenueData(c.revenueData); setRevenueByPlan(c.revenueByPlan);
      setArSummary(c.arSummary); setOpsStats(c.opsStats);
      setActiveUsers(c.activeUsers); setLicenseUtil(c.licenseUtil);
      if (c.revHealth) setRevHealth(c.revHealth);
      setAtRiskTenants(c.atRiskTenants); setCancelledTenantNames(c.cancelledTenantNames);
      setCancelledLast30DayNames(c.cancelledLast30DayNames); setSuspendedTenantNames(c.suspendedTenantNames);
      setLoading(false);
      fetchDashboardData(true); // refresh silently in background
    } else {
      fetchDashboardData(false);
    }
  }, [isOwner, navigate]);

  // Save module-level cache AFTER React has re-rendered with fresh state (fetchSeq bump
  // ensures all setX() calls from the last fetch are already reflected in state variables).
  useEffect(() => {
    if (fetchSeq === 0) return; // skip initial render — no fetch has completed yet
    _ownerDashCache = {
      ts: Date.now(),
      stats, revenueData, revenueByPlan, arSummary,
      opsStats, activeUsers, licenseUtil, revHealth,
      atRiskTenants, cancelledTenantNames, cancelledLast30DayNames, suspendedTenantNames,
    };
  }, [fetchSeq]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
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

        // Fetch paid invoices + AR invoices in parallel — one round-trip instead of three.
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const [{ data: paidInvoices }, { data: openInvoices }, { data: planRows }] = await Promise.all([
          supabase.from('invoices').select('tenant_id, amount, paid_at, created_at').eq('status', 'paid'),
          (supabase as any).from('invoices').select('amount, status').in('status', ['overdue', 'pending']),
          supabase.from('plans').select('id, price_monthly'),
        ]);
        // Plan list prices — fallback for active tenants not yet invoiced (single source).
        const planPrices: Record<string, number> = {};
        ((planRows || []) as any[]).forEach((p) => { planPrices[p.id] = Number(p.price_monthly) || 0; });

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

        // MRR = committed run-rate over active tenants: latest billed rate, else plan
        // list price for active tenants not yet invoiced (so MRR counts all committed
        // customers). Shared committedMRR util → matches /owner-health exactly.
        const mrr = tenantList
          .filter(t => t.status === 'active')
          .reduce((s, t) => s + committedMRR(latestRate.get(t.id), t.subscription_plan, planPrices), 0);

        // Calculate churn rate — ROLLING 30 days vs prior 30 days (avoids the MTD
        // artifact where churn reads ~0% at the very start of each calendar month).
        const nowMs = Date.now();
        const last30Start = new Date(nowMs - 30 * 24 * 60 * 60 * 1000);
        const prev30Start = new Date(nowMs - 60 * 24 * 60 * 60 * 1000);

        const total = tenantList.length || 1;
        const churnedLast30 = tenantList.filter(t =>
          t.status === 'cancelled' && (t as any).cancelled_at && new Date((t as any).cancelled_at) >= last30Start
        ).length;
        const churnedPrev30 = tenantList.filter(t => {
          if (t.status !== 'cancelled' || !(t as any).cancelled_at) return false;
          const d = new Date((t as any).cancelled_at);
          return d >= prev30Start && d < last30Start;
        }).length;
        const realChurnRate = Math.round((churnedLast30 / total) * 100 * 100) / 100;
        const lastMonthChurnRate = Math.round((churnedPrev30 / total) * 100 * 100) / 100;

        // MoM growth of the recurring base: MRR now vs MRR as of the start of this month.
        // Same committed basis (rate-as-of-month-start, else list price) so growth reflects
        // real rate changes, not the billed-vs-committed switch.
        const previousMrr = tenantList
          .filter(t => t.status === 'active')
          .reduce((s, t) => s + committedMRR(prevRate.get(t.id), t.subscription_plan, planPrices), 0);
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
          churnRate: realChurnRate,
          churnLastMonth: lastMonthChurnRate,
          mrrGrowth: Math.round(realMrrGrowth * 100) / 100
        });

        // Revenue retention headline — same util as Payments › สุขภาพรายได้ (single source).
        const rh = computeRevenueHealth(
          tenantList.map(t => ({ id: t.id, status: t.status, name: t.name })),
          (paidInvoices || []) as any,
        );
        setRevHealth({ nrr: rh.nrr, grr: rh.grr, revenueChurn: rh.revenueChurn });

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
        setCancelledLast30DayNames(tenantList.filter(t => t.status === 'cancelled' && (t as any).cancelled_at && new Date((t as any).cancelled_at) >= last30Start).map(t => t.name || t.id));
        setSuspendedTenantNames(tenantList.filter(t => t.status === 'suspended').map(t => t.name || t.id));

        // Generate real revenue trend data from invoices (last 6 months)
        const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const revenueTrend: RevenueData[] = [];

        // historicalInvoices = last-6-months subset of paidInvoices — no extra DB call needed
        const historicalInvoices = (paidInvoices || []).filter(inv => {
          const d = new Date(inv.paid_at || inv.created_at);
          return d >= sixMonthsAgo;
        });

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

        // YTD revenue — actual cash collected Jan–today (feeds saasKpis2 ARR sub text).
        let ytdTotal = 0;
        for (let m = 0; m <= currentMonth; m++) {
          const mStart = new Date(currentYear, m, 1);
          const mEnd = new Date(currentYear, m + 1, 0, 23, 59, 59);
          let mRevenue = 0;
          (paidInvoices || []).forEach((inv: any) => {
            const t = new Date(inv.paid_at || inv.created_at);
            if (t >= mStart && t <= mEnd) mRevenue += Number(inv.amount);
          });
          ytdTotal += mRevenue;
        }
        setStats(prev => ({ ...prev, annualRunRate: ytdTotal }));

        // Revenue by plan — each active tenant's current monthly rate, grouped by plan
        // (same recurring basis as the MRR card, so the parts sum to MRR).
        const planRevenue = {
          enterprise: tenantList
            .filter(t => t.subscription_plan === 'enterprise' && t.status === 'active')
            .reduce((sum, t) => sum + committedMRR(latestRate.get(t.id), t.subscription_plan, planPrices), 0),
          professional: tenantList
            .filter(t => t.subscription_plan === 'professional' && t.status === 'active')
            .reduce((sum, t) => sum + committedMRR(latestRate.get(t.id), t.subscription_plan, planPrices), 0),
          starter: tenantList
            .filter(t => t.subscription_plan === 'starter' && t.status === 'active')
            .reduce((sum, t) => sum + committedMRR(latestRate.get(t.id), t.subscription_plan, planPrices), 0)
        };
        setRevenueByPlan(planRevenue);

        // AR / cash health — openInvoices already fetched in parallel with paidInvoices above
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

      // === Platform stickiness + license utilization (SaaS health signals) ===
      // Scoped to customer tenants so our own platform tenant can't inflate it.
      if (customerTenantIds.length > 0) {
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
        let totalUsed = 0, totalCap = 0;
        const notOnboardedNames: string[] = [];
        const nearLimitDetails: { name: string; pct: number }[] = [];
        activeTenantList.forEach((t) => {
          const maxSales = planLimits.get(t.subscription_plan) || 0;
          const current = salesByTenant.get(t.id) || 0;
          totalUsed += current; totalCap += maxSales;
          if (maxSales > 0) {
            const pct = Math.round((current / maxSales) * 100);
            if (pct >= 70) nearLimitDetails.push({ name: t.name || t.id, pct });
            if (current === 0) notOnboardedNames.push(t.name || t.id);
          }
        });
        setLicenseUtil({
          avgPct: totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0,
          nearLimit: nearLimitDetails.length,
          notOnboarded: notOnboardedNames.length,
          totalActive: activeTenantList.length,
          notOnboardedNames,
          nearLimitDetails,
        });
      }

      // === Open support tickets (real) — feeds the exception-first alert strip ===
      const { data: tkData } = await (supabase as any).from('support_tickets').select('status');
      let openT = 0;
      ((tkData || []) as any[]).forEach((t: any) => { if (['open', 'pending', 'in_progress'].includes(t.status)) openT += 1; });
      setOpsStats({ openTickets: openT });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setFetchSeq(s => s + 1); // signal that state has fully settled → triggers cache save useEffect
    }
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

  // Priority Action Queue — replaces both alert strip + saasHealth2 mini cards.
  // Sorted: red (immediate) → amber (watch) → green (positive signals).
  interface ActionItem { tone: 'red' | 'amber' | 'green'; title: string; sub: string; href: string; }
  const actionItems: ActionItem[] = [];

  // RED — immediate action required
  if (arSummary.overdue > 0)
    actionItems.push({ tone: 'red', title: `Overdue ${fmtCompact(arSummary.overdue)} · ${arSummary.overdueCount} ใบ → เร่งรับเงิน`, sub: 'ใบแจ้งหนี้เกินกำหนดชำระ · รอการชำระ', href: '/payments?tab=invoices' });
  if (cancelledTenantNames.length > 0)
    actionItems.push({ tone: 'red', title: `${cancelledTenantNames.length} บริษัทยกเลิกแล้ว`, sub: cancelledTenantNames.slice(0, 3).join(', ') + (cancelledTenantNames.length > 3 ? ` +${cancelledTenantNames.length - 3}` : ''), href: '/owner-health' });
  if (suspendedTenantNames.length > 0)
    actionItems.push({ tone: 'red', title: `${suspendedTenantNames.length} บริษัทถูกระงับ → ติดตาม`, sub: suspendedTenantNames.slice(0, 3).join(', '), href: '/owner-health' });
  if (stats.churnRate > 5)
    actionItems.push({ tone: 'red', title: `อัตราเลิกใช้สูง ${stats.churnRate}% → วิเคราะห์สาเหตุ`, sub: 'เกินเกณฑ์ปกติ 5% · ต้องหาสาเหตุและแก้ไข', href: '/owner-health' });
  licenseUtil.nearLimitDetails.forEach(d =>
    actionItems.push({ tone: 'red', title: `${d.name} — โควตาพนักงาน ${d.pct}% → Upsell`, sub: 'โอกาส Expansion Revenue · เสนออัปเกรดแพ็กเกจ', href: '/tenants' })
  );

  // AMBER — watch and act soon
  if (arSummary.pending > 0)
    actionItems.push({ tone: 'amber', title: `Pending ${fmtCompact(arSummary.pending)} · ${arSummary.pendingCount} ใบ → ติดตาม`, sub: 'ใบแจ้งหนี้รอชำระ · ยังอยู่ในกำหนด', href: '/payments?tab=invoices' });
  licenseUtil.notOnboardedNames.forEach(name =>
    actionItems.push({ tone: 'amber', title: `${name} — ยังไม่มีพนักงานในระบบ`, sub: 'เสี่ยง Churn · ต้องช่วย Onboarding', href: '/tenants' })
  );
  if (opsStats.openTickets > 0)
    actionItems.push({ tone: 'amber', title: `Support ค้าง ${opsStats.openTickets} เคส → แก้ไข`, sub: 'ลูกค้าแจ้งปัญหารอการตอบกลับ', href: '/owner-support' });
  const trialEndingSoon = atRiskTenants.filter(t => t.status === 'trial');
  if (trialEndingSoon.length > 0)
    actionItems.push({ tone: 'amber', title: `${trialEndingSoon.length} บริษัท Trial ใกล้หมด → ปิดการขาย`, sub: trialEndingSoon.map(t => t.name || t.id).slice(0, 2).join(', '), href: '/owner-health' });

  // GREEN — positive signals (always show so CEO sees full picture)
  const loginRatio = activeUsers.total > 0 ? activeUsers.active7d / activeUsers.total : 0;
  const loginTone: 'red' | 'amber' | 'green' = loginRatio >= 0.5 ? 'green' : loginRatio >= 0.2 ? 'amber' : 'red';
  actionItems.push({ tone: loginTone, title: `Active Logins (7 วัน): ${activeUsers.total > 0 ? `${activeUsers.active7d} / ${activeUsers.total} คน` : '—'}`, sub: `${activeUsers.active30d} คน active ใน 30 วัน · ยิ่งสูง = แพลตฟอร์มขาดไม่ได้`, href: '/owner-health' });
  if (licenseUtil.nearLimit === 0 && licenseUtil.notOnboarded === 0 && licenseUtil.totalActive > 0)
    actionItems.push({ tone: 'green', title: 'License Utilization — ทุกบริษัทอยู่ในเกณฑ์', sub: `เฉลี่ย ${licenseUtil.avgPct}% · ยังมี slot ว่าง`, href: '/tenants' });

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
      sub: `รายได้เฉลี่ยต่อบริษัท · จาก ${stats.activeTenants} บริษัท active`,
      href: '/payments',
    },
    {
      title: 'Trial → Paid Conversion',
      value: trialConvPct !== null ? `${trialConvPct}%` : '—',
      icon: trialConvPct !== null && trialConvPct >= 60 ? CheckCircle : AlertCircle,
      color: trialConvPct === null ? KK.gray : trialConvPct >= 60 ? KK.green : trialConvPct >= 40 ? KK.amber : KK.red,
      bg: trialConvPct === null ? '#f3f4f6' : trialConvPct >= 60 ? KK.greenLight : trialConvPct >= 40 ? KK.amberLight : KK.redLight,
      sub: `สะสมตั้งแต่เปิด · ซื้อ ${stats.activeTenants} · ยกเลิก ${stats.cancelledTenants} · ทดลองอยู่ ${stats.trialTenants}`,
      href: '/tenants',
    },
  ];

  // Compact KPI card — renders the SaaS KPI strip (Zone 1).
  const renderKpiCard = (k: any, i: number) => (
    <div key={i} onClick={() => navigate(k.href)} className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 cursor-pointer hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5 pr-1 flex-1">{k.label}</p>
        <k.icon className="w-5 h-5 flex-shrink-0" style={{ color: k.color }} strokeWidth={2} />
      </div>
      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none tracking-tight">{k.value}</p>
      {k.trend ? (
        <>
          <p className="text-sm mt-3.5 font-semibold" style={{ color: k.invertTrend ? (k.trend.up ? KK.red : KK.green) : (k.trend.up ? KK.green : KK.red) }}>
            {k.trend.up ? '↗' : '↘'} {k.trend.value}%<span className="font-normal text-gray-400"> MoM</span>
          </p>
          {k.sub && <p className="text-xs text-gray-400 mt-0.5 truncate">{k.sub}</p>}
        </>
      ) : k.sub ? (
        <p className="text-sm text-gray-400 mt-3.5 leading-snug line-clamp-2">{k.sub}</p>
      ) : null}
    </div>
  );

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />

          <main className="p-6 lg:p-8 space-y-6">
            {/* PAGE TITLE */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-2 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Platform</span>
                <h1 className="text-2xl font-bold text-gray-900">Executive Dashboard</h1>
              </div>
            </div>

            {/* ━━━━━━ ZONE 1 · ธุรกิจแพลตฟอร์ม (SaaS) — snapshot, no period ━━━━━━ */}
            <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
              <Receipt className="w-4 h-4 flex-shrink-0" style={{ color: KK.blue }} />
              <span className="text-sm font-semibold text-gray-700">ธุรกิจแพลตฟอร์ม (SaaS)</span>
              <span className="text-xs text-gray-400 hidden sm:inline">· รายได้ค่าเช่าระบบ · ผู้เช่า</span>
            </div>

            {/* SaaS KPI — 5 uniform cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'รายได้ค่าเช่า/เดือน (MRR)', value: formatCurrency(stats.monthlyRevenue), trend: mkTrend(stats.mrrGrowth), icon: Receipt, color: KK.red, href: '/payments' },
                ...saasKpis2.slice(0, 2).map((k) => ({ label: k.title, value: k.value, trend: (k as any).trend, icon: k.icon, color: k.color, href: k.href, sub: k.sub })),
                { label: 'อัตราเลิกใช้ (Churn) · 30 วัน', value: `${stats.churnRate}%`, icon: TrendingDown, color: stats.churnRate > 5 ? KK.red : stats.churnRate > 0 ? KK.amber : KK.green, href: '/owner-health', trend: mkTrend(stats.churnRate - stats.churnLastMonth), invertTrend: true },
                ...saasKpis2.slice(2).map((k) => ({ label: k.title, value: k.value, trend: (k as any).trend, icon: k.icon, color: k.color, href: k.href, sub: k.sub })),
              ].map(renderKpiCard)}
            </div>

            {/* ── HERO CHARTS: MRR + Donut ── */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6">

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
                    <div className="flex items-start gap-4">
                      {/* Donut */}
                      <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                        <PieChart width={140} height={140}>
                          <Pie data={donutData} cx={67} cy={67} innerRadius={44} outerRadius={62} dataKey="value" strokeWidth={2} stroke="#fff">
                            {donutData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <div className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{stats.totalTenants}</div>
                          <div className="text-xs text-gray-400 mt-0.5">บริษัท</div>
                        </div>
                      </div>
                      {/* Legends + Revenue by Plan — right column */}
                      <div className="flex-1 min-w-0 pt-1">
                        <div className="space-y-2">
                          {donutData.map((d, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                              <span className="text-xs text-gray-500 flex-1">{d.name}</span>
                              <span className="text-sm font-bold text-gray-800 tabular-nums">{d.value}</span>
                              <span className="text-xs text-gray-400 w-8 text-right">{Math.round(d.value / total * 100)}%</span>
                            </div>
                          ))}
                        </div>
                        {(revenueByPlan.enterprise + revenueByPlan.professional + revenueByPlan.starter) > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-400 mb-2">รายได้ตาม Plan</p>
                            <div className="space-y-2">
                              {[
                                { plan: 'Enterprise', rev: revenueByPlan.enterprise, color: KK.red },
                                { plan: 'Professional', rev: revenueByPlan.professional, color: KK.blue },
                                { plan: 'Starter', rev: revenueByPlan.starter, color: KK.amber },
                              ].filter(p => p.rev > 0).map((p, i) => (
                                <div key={i}>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-xs text-gray-500">{p.plan}</span>
                                    <span className="text-xs font-bold tabular-nums" style={{ color: p.color }}>{formatCurrency(p.rev)}</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${Math.round((p.rev / stats.monthlyRevenue) * 100)}%`, backgroundColor: p.color }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Retention summary + action queue — side by side to keep the page compact */}
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
            {/* Revenue retention summary — headline only; full view in Payments › สุขภาพรายได้ */}
            <div
              className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 cursor-pointer hover:shadow-soft-md transition-shadow duration-200 flex flex-col"
              onClick={() => navigate('/payments?tab=revenue-health')}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" style={{ color: KK.green }} />
                  <h2 className="text-base font-bold text-gray-900">สุขภาพรายได้ (Retention)</h2>
                </div>
                <span className="text-xs font-semibold flex items-center gap-1" style={{ color: KK.red }}>
                  ดูรายละเอียด <ChevronRight className="w-3 h-3" />
                </span>
              </div>
              {/* Retention donut — เก็บไว้ได้ (GRR) vs หายไป (Churn); NRR ตรงกลาง */}
              <div className="flex-1 flex items-center">
              {revHealth.nrr == null ? (
                <p className="text-sm text-gray-400 py-4">ยังไม่มีฐานข้อมูลเทียบเดือนก่อน</p>
              ) : (() => {
                const grr = Math.max(0, Math.round(revHealth.grr ?? 0));
                const churn = Math.max(0, Math.round(revHealth.revenueChurn ?? 0));
                const nrr = Math.round(revHealth.nrr ?? 0);
                const bars = [
                  { label: 'NRR', sub: 'รายได้คงเหลือสุทธิ', v: nrr, color: KK.red, target: '≥100% = โตจากลูกค้าเดิม' },
                  { label: 'GRR', sub: 'คงเหลือขั้นต่ำ', v: grr, color: KK.red, target: 'รายได้เดิมที่รักษาไว้ได้' },
                  { label: 'Revenue Churn', sub: 'รายได้ที่หาย', v: churn, color: KK.red, target: 'ยิ่งต่ำยิ่งดี' },
                ];
                return (
                  <div className="w-full space-y-4">
                    {bars.map((m, i) => (
                      <div key={i}>
                        <div className="flex items-baseline justify-between mb-1.5">
                          <span className="text-sm font-medium text-gray-700">{m.label} <span className="text-xs text-gray-400 font-normal">· {m.sub}</span></span>
                          <span className="text-lg font-bold tabular-nums leading-none" style={{ color: m.color }}>{m.v}%</span>
                        </div>
                        <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, m.v)}%`, background: m.color }} />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{m.target}</p>
                      </div>
                    ))}
                  </div>
                );
              })()}
              </div>
            </div>

            {/* Priority Queue — SaaS-core action items (overdue / churn / trial / upsell) */}
            <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 border-b border-gray-100">
                <AlertCircle className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-bold text-gray-700">รายการต้องดำเนินการ</span>
                {actionItems.filter(a => a.tone === 'red').length > 0 && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: KK.redLight, color: KK.red }}>
                    {actionItems.filter(a => a.tone === 'red').length} เร่งด่วน
                  </span>
                )}
                {actionItems.filter(a => a.tone === 'red').length === 0 && actionItems.filter(a => a.tone === 'amber').length > 0 && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: KK.amberLight, color: KK.amber }}>
                    {actionItems.filter(a => a.tone === 'amber').length} ต้องติดตาม
                  </span>
                )}
                {actionItems.every(a => a.tone === 'green') && (
                  <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: KK.greenLight, color: KK.green }}>
                    ทุกอย่างปกติ
                  </span>
                )}
              </div>
              <div className="divide-y divide-gray-50">
                {actionItems.slice(0, 5).map((item, i) => (
                  <button key={i} onClick={() => navigate(item.href)}
                    className="w-full px-4 py-2.5 flex items-center gap-3 bg-white hover:bg-gray-50 transition-colors text-left">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: item.tone === 'red' ? KK.red : item.tone === 'amber' ? KK.amber : KK.green }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-800 block truncate">{item.title}</span>
                      <span className="text-xs text-gray-400 truncate block">{item.sub}</span>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                  </button>
                ))}
              </div>
              {actionItems.length > 5 && (
                <button onClick={() => navigate('/owner-health')}
                  className="w-full px-4 py-2.5 flex items-center justify-center gap-1.5 border-t border-gray-100 hover:bg-gray-50 transition-colors group">
                  <span className="text-xs font-semibold text-gray-500 group-hover:text-gray-700">ดูทั้งหมด {actionItems.length} รายการ</span>
                  <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-gray-600" />
                </button>
              )}
            </div>
            </div>{/* end retention + action-queue grid */}

          </main>
        </div>
      </div>
    </OwnerGuard>
  );
};

export default OwnerDashboard;
