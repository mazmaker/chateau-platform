import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { usePermissions, OwnerGuard } from '@/components/auth/PermissionGuard';
import Sidebar from '@/components/dashboard/Sidebar';
import Header from '@/components/dashboard/Header';
import { toast } from 'sonner';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { HeartPulse, ShieldCheck, AlertTriangle, TrendingDown, ChevronRight, Package, Clock, Search, MoreHorizontal, Eye, Trash2, ArrowUp, ArrowDown, ArrowUpDown, FileText, Trophy } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { committedMRR } from '@/lib/mrr';

// ──────────────────────────────────────────────────────────────────────────
// ภาพรวมผู้เช่า — SaaS owner view: health, MRR per tenant, trial expiry,
// churn risk signals. Real data from tenants + profiles + projects + invoices.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  gray: '#94a3b8', grayLight: '#fafafa',
  border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '12px', padding: '8px 12px',
};

type HealthStatus = 'healthy' | 'at_risk' | 'dormant' | 'churned';
const HEALTH_META: Record<HealthStatus, { label: string; color: string; bg: string }> = {
  healthy: { label: 'ใช้งานอยู่',    color: KK.green, bg: KK.greenLight },
  at_risk: { label: 'เสี่ยงเลิกใช้', color: KK.amber, bg: KK.amberLight },
  dormant: { label: 'ไม่ใช้งาน',     color: KK.red,   bg: KK.redLight   },
  churned: { label: 'ยกเลิกแล้ว',    color: KK.gray,  bg: KK.grayLight  },
};

const PLAN_TH: Record<string, string> = { professional: 'Professional', starter: 'Starter', enterprise: 'Enterprise', free: 'Free' };
const PLAN_COLOR: Record<string, string> = { enterprise: KK.red, professional: KK.blue, starter: KK.amber, free: KK.gray };

const fmtMRR = (v: number) => {
  if (v === 0) return '—';
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)} ล้าน`;
  if (v >= 1_000) return `฿${(v / 1_000).toFixed(0)}K`;
  return `฿${v.toLocaleString()}`;
};

const computeHealth = (tenantStatus: string, lastLoginDays: number): number => {
  if (tenantStatus === 'cancelled') return 0;
  if (tenantStatus === 'suspended') return 15;
  // วัดจากวันใช้งานล่าสุดอย่างเดียว — นี่คือสัญญาณ churn ที่แม่นที่สุด
  let score: number;
  if (lastLoginDays <= 3)       score = 90;
  else if (lastLoginDays <= 7)  score = 75;
  else if (lastLoginDays <= 14) score = 65;
  else if (lastLoginDays <= 30) score = 50;
  else if (lastLoginDays <= 60) score = 30;
  else                          score = 15;
  return score;
};
const toHealthStatus = (score: number): HealthStatus =>
  score >= 70 ? 'healthy' : score >= 40 ? 'at_risk' : 'dormant';

const daysSince = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

const trialDaysLeft = (trial_ends_at: string | null): number | null => {
  if (!trial_ends_at) return null;
  return Math.ceil((new Date(trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};

interface TenantRow {
  id: string;
  name: string;
  plan: string;
  tenantStatus: string;
  trial_ends_at: string | null;
  users: number;
  projects: number;
  lastLoginDays: number;
  health: number;
  healthStatus: HealthStatus;
  mrr: number;
  owner_notes: string | null;
}

const OwnerTenantHealth = () => {
  const navigate = useNavigate();
  const { isOwner } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [dealStats, setDealStats] = useState<{ wonValue: number; conversion: number }>({ wonValue: 0, conversion: 0 });
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'priority' | 'health' | 'lastLogin' | 'mrr'>('priority');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [noteTarget, setNoteTarget] = useState<{ id: string; name: string; notes: string } | null>(null);
  const [noteBody, setNoteBody] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  if (!isOwner) { navigate('/'); return null; }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ data: tenants }, { data: usersList }, { data: projects }, { data: invoices }, { data: planRows }, { data: leadsList }] = await Promise.all([
        supabase.from('tenants').select('id, name, subscription_plan, status, trial_ends_at, owner_notes').eq('is_platform' as any, false).order('created_at', { ascending: false }),
        supabase.from('users').select('id, tenant_id, updated_at'),
        supabase.from('projects').select('id, tenant_id'),
        supabase.from('invoices').select('tenant_id, amount, paid_at, created_at, status').eq('status', 'paid'),
        supabase.from('plans').select('id, price_monthly'),
        // Cross-tenant end-customer leads → product-value / retention proof (aggregate, no PII).
        supabase.from('leads').select('tenant_id, status, estimated_value'),
      ]);

      // Plan list prices from the `plans` catalog (single source — no hardcode drift).
      const planPrices: Record<string, number> = {};
      ((planRows || []) as any[]).forEach((p) => { planPrices[p.id] = Number(p.price_monthly) || 0; });

      // Build lookup maps
      const usersByTenant: Record<string, number> = {};
      const lastActiveByTenant: Record<string, string> = {};
      (usersList || []).forEach((p: any) => {
        if (!p.tenant_id) return;
        usersByTenant[p.tenant_id] = (usersByTenant[p.tenant_id] || 0) + 1;
        if (!lastActiveByTenant[p.tenant_id] || p.updated_at > lastActiveByTenant[p.tenant_id])
          lastActiveByTenant[p.tenant_id] = p.updated_at;
      });

      const projectsByTenant: Record<string, number> = {};
      (projects || []).forEach((p: any) => {
        if (p.tenant_id) projectsByTenant[p.tenant_id] = (projectsByTenant[p.tenant_id] || 0) + 1;
      });

      // Latest paid-invoice rate per tenant (current monthly rate) — same basis as
      // the Executive Dashboard, so platform MRR matches across both pages.
      const latestRate: Record<string, number> = {};
      const latestTime: Record<string, number> = {};
      (invoices || []).forEach((inv: any) => {
        if (!inv.tenant_id) return;
        const t = new Date(inv.paid_at || inv.created_at || '').getTime();
        if (!(inv.tenant_id in latestTime) || t > latestTime[inv.tenant_id]) {
          latestTime[inv.tenant_id] = t;
          latestRate[inv.tenant_id] = Number(inv.amount) || 0;
        }
      });

      const built: TenantRow[] = (tenants || []).map((t: any) => {
        const users = usersByTenant[t.id] || 0;
        const projs = projectsByTenant[t.id] || 0;
        const lastDays = daysSince(lastActiveByTenant[t.id]);
        const health = computeHealth(t.status || 'active', lastDays >= 999 ? 999 : lastDays);
        return {
          id: t.id,
          name: t.name || t.id,
          plan: t.subscription_plan || 'free',
          tenantStatus: t.status || 'active',
          trial_ends_at: t.trial_ends_at || null,
          users,
          projects: projs,
          lastLoginDays: lastDays >= 999 ? 0 : lastDays,
          health,
          healthStatus: t.status === 'cancelled' ? 'churned' : toHealthStatus(health),
          // MRR counts ACTIVE tenants only (committed run-rate) — same population as /owner.
          mrr: t.status === 'active' ? committedMRR(latestRate[t.id], t.subscription_plan, planPrices) : 0,
          owner_notes: t.owner_notes || null,
        };
      }).sort((a, b) => {
        const group = (r: TenantRow) => {
          if (r.healthStatus === 'at_risk') return 0;
          if (r.healthStatus === 'healthy') return 1;
          if (r.healthStatus === 'dormant') return 2;
          return 3; // churned (ยกเลิกแล้ว) — ล่างสุด
        };
        const diff = group(a) - group(b);
        return diff !== 0 ? diff : b.health - a.health; // within group: score สูงขึ้นก่อน
      });

      setRows(built);

      // Product-value / retention proof: deals tenants closed on-platform (won leads) + avg conversion.
      // Scoped to customer tenants (non-platform). Aggregate only — no per-customer PII.
      const custIds = new Set((tenants || []).map((t: any) => t.id));
      const custLeads = (leadsList || []).filter((l: any) => custIds.has(l.tenant_id));
      const wonLeads = custLeads.filter((l: any) => l.status === 'won');
      const wonValue = wonLeads.reduce((s: number, l: any) => s + (Number(l.estimated_value) || 0), 0);
      const conversion = custLeads.length > 0 ? Math.round((wonLeads.length / custLeads.length) * 100) : 0;
      setDealStats({ wonValue, conversion });
      setLoading(false);
    };
    load();
  }, []);

  const healthy    = rows.filter(r => r.healthStatus === 'healthy').length;
  const atRisk     = rows.filter(r => r.healthStatus === 'at_risk').length;
  const dormant    = rows.filter(r => r.healthStatus === 'dormant').length;
  const atRiskMRR  = rows.filter(r => r.healthStatus === 'at_risk').reduce((s, r) => s + r.mrr, 0);
  const atRiskRows = rows.filter(r => r.healthStatus === 'at_risk');
  // Total MRR = committed run-rate ของ active tenants (r.mrr เป็น 0 อยู่แล้วสำหรับ trial/suspended/cancelled)
  const totalMRR   = rows.reduce((s, r) => s + r.mrr, 0);
  const atRiskPct  = totalMRR > 0 ? Math.round((atRiskMRR / totalMRR) * 100) : 0;
  const trialExpiringSoon = rows.filter(r => {
    if (r.tenantStatus !== 'trial') return false;
    const days = trialDaysLeft(r.trial_ends_at);
    return days !== null && days <= 7;
  });
  const churned = rows.filter(r => r.healthStatus === 'churned').length;
  const donut = ([
    { name: HEALTH_META.healthy.label, value: healthy, color: KK.green },
    { name: HEALTH_META.at_risk.label, value: atRisk,  color: KK.amber },
    { name: HEALTH_META.dormant.label, value: dormant, color: KK.red   },
    { name: HEALTH_META.churned.label, value: churned, color: KK.gray  },
  ]).filter(d => d.value > 0);

  const PLAN_KEYS = ['enterprise', 'professional', 'starter', 'free'] as const;
  const planStats = PLAN_KEYS.reduce((acc, p) => {
    const pr = rows.filter(r => r.plan === p);
    acc[p] = { companies: pr.length, users: pr.reduce((s, r) => s + r.users, 0), mrr: pr.reduce((s, r) => s + r.mrr, 0) };
    return acc;
  }, {} as Record<string, { companies: number; users: number; mrr: number }>);
  const totalPaidMRR = rows.reduce((s, r) => s + r.mrr, 0);
  const maxCompanies = Math.max(1, ...PLAN_KEYS.map(p => planStats[p].companies));

  const filtered = rows.filter(r => {
    if (statusFilter !== 'all' && r.healthStatus !== statusFilter) return false;
    if (tenantStatusFilter !== 'all' && r.tenantStatus !== tenantStatusFilter) return false;
    if (planFilter !== 'all' && r.plan !== planFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!r.name.toLowerCase().includes(q)) return false;
    }
    return true;
  });
  const toggleSort = (key: 'health' | 'lastLogin' | 'mrr') => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };
  const sorted = [...filtered].sort((a, b) => {
    // Default = ลำดับความสำคัญแบบ SaaS owner: เสี่ยง (กู้ได้) บนสุด → ยกเลิกแล้ว (เสียไปแล้ว) ล่างสุด
    if (sortKey === 'priority') {
      const group = (r: TenantRow) => {
        if (r.healthStatus === 'at_risk') return 0; // เสี่ยงเลิกใช้ — เงินยังกู้ได้ ต้องรีบ
        if (r.healthStatus === 'dormant') return 1; // ไม่ใช้งาน — ใกล้หลุด
        if (r.healthStatus === 'healthy') return 2; // ใช้งานอยู่ — ปกติ
        return 3;                                   // ยกเลิกแล้ว — ล่างสุด
      };
      const diff = group(a) - group(b);
      return diff !== 0 ? diff : a.health - b.health; // ในกลุ่มเดียวกัน: คะแนนต่ำ (ใกล้หลุด) ก่อน
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortKey === 'health') return (a.health - b.health) * dir;
    if (sortKey === 'mrr') return (a.mrr - b.mrr) * dir;
    return (a.lastLoginDays - b.lastLoginDays) * dir;
  });
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginated = sorted.slice(pageStart, pageStart + pageSize);

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`ลบบริษัท "${name}" ออกจากระบบ?\n\nการลบจะไม่สามารถกู้คืนได้`)) return;
    const { error } = await (supabase.from('tenants') as any).delete().eq('id', id);
    if (error) { toast.error('ลบไม่สำเร็จ', { description: error.message }); return; }
    setRows(prev => prev.filter(r => r.id !== id));
    toast.success('ลบบริษัทแล้ว', { description: name });
  };

  const handleSaveNote = async () => {
    if (!noteTarget) return;
    setSavingNote(true);
    const { error } = await (supabase.from('tenants') as any)
      .update({ owner_notes: noteBody.trim() || null })
      .eq('id', noteTarget.id);
    setSavingNote(false);
    if (error) { toast.error('บันทึกไม่สำเร็จ', { description: error.message }); return; }
    setRows(prev => prev.map(r => r.id === noteTarget.id ? { ...r, owner_notes: noteBody.trim() || null } : r));
    toast.success('บันทึก note แล้ว');
    setNoteTarget(null);
  };

  const KpiCard = ({ title, value, sub, icon: Icon, color, bg, onClick }: { title: string; value: string; sub?: string; icon: React.ElementType; color: string; bg: string; onClick?: () => void }) => (
    <div onClick={onClick} className={`bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 ${onClick ? 'cursor-pointer select-none' : ''}`}>
      <div className="flex items-start justify-between mb-5">
        <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`, boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15` }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className="text-sm text-gray-400 mt-3.5 truncate">{sub}</p>}
    </div>
  );

  // Health signal chips — inline below company name
  const HealthChips = ({ row }: { row: TenantRow }) => {
    const loginColor = row.lastLoginDays <= 3 ? KK.green : row.lastLoginDays <= 14 ? KK.amber : KK.red;
    const userColor  = row.users >= 5 ? KK.green : row.users >= 2 ? KK.amber : KK.red;
    const projColor  = row.projects >= 2 ? KK.green : row.projects >= 1 ? KK.amber : KK.red;
    const loginLabel = row.lastLoginDays === 0 ? 'วันนี้' : `${row.lastLoginDays} วันก่อน`;
    return (
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
        <span className="text-xs font-medium" style={{ color: loginColor }}>{loginLabel}</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs font-medium" style={{ color: userColor }}>{row.users} คน</span>
        <span className="text-xs text-gray-300">·</span>
        <span className="text-xs font-medium" style={{ color: projColor }}>
          {row.projects === 0 ? 'ไม่มีโครงการ ⚠' : `${row.projects} โครงการ`}
        </span>
      </div>
    );
  };

  // Trial expiry badge
  const TrialBadge = ({ row }: { row: TenantRow }) => {
    if (row.tenantStatus !== 'trial') return null;
    const days = trialDaysLeft(row.trial_ends_at);
    if (days === null) return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ color: KK.gray, background: KK.grayLight }}>Trial</span>;
    if (days <= 0)  return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ color: KK.red,   background: KK.redLight }}>Trial หมดแล้ว</span>;
    if (days <= 7)  return <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5" style={{ color: KK.red,   background: KK.redLight }}><Clock className="w-2.5 h-2.5" />Trial หมดใน {days} วัน</span>;
    if (days <= 14) return <span className="text-xs px-1.5 py-0.5 rounded font-semibold flex items-center gap-0.5" style={{ color: KK.amber, background: KK.amberLight }}><Clock className="w-2.5 h-2.5" />Trial {days} วัน</span>;
    return <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ color: KK.gray, background: KK.grayLight }}>Trial {days} วัน</span>;
  };

  return (
    <OwnerGuard>
      <div className="min-h-screen bg-gray-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="lg:ml-[260px] min-h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          <main className="p-6 lg:p-8 space-y-7">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: KK.red, backgroundColor: KK.redLight }}>Tenants</span>
                <h1 className="text-2xl font-bold text-gray-900">ภาพรวมผู้เช่า (Tenants Overview)</h1>
                <p className="text-sm text-gray-500 mt-1.5">
                  สุขภาพฐานลูกค้า B2B · รายได้ที่เสี่ยง · ใครต้องติดตามด่วน · <span className="font-semibold text-gray-700">ข้อมูล ณ วันนี้</span>
                </p>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <KpiCard
                title="MRR รวม"
                value={loading ? '—' : fmtMRR(totalMRR)}
                sub={`Active ${rows.filter(r => r.tenantStatus === 'active').length} · Trial ${rows.filter(r => r.tenantStatus === 'trial').length} · ระงับ ${rows.filter(r => r.tenantStatus === 'suspended').length} · ยกเลิก ${rows.filter(r => r.tenantStatus === 'cancelled').length}`}
                icon={ShieldCheck} color={KK.green} bg={KK.greenLight}
                onClick={() => { setStatusFilter('all'); setTenantStatusFilter('all'); setPlanFilter('all'); setSearchQuery(''); setCurrentPage(1); }}
              />
              <KpiCard
                title="MRR ที่เสี่ยง"
                value={loading ? '—' : (atRiskMRR > 0 ? fmtMRR(atRiskMRR) : '฿0')}
                sub={`${atRiskRows.length} บริษัท · ${atRiskPct}% ของ MRR รวม`}
                icon={TrendingDown} color={KK.amber} bg={KK.amberLight}
                onClick={() => {
                  if (statusFilter === 'at_risk' && tenantStatusFilter === 'all') { setStatusFilter('all'); }
                  else { setStatusFilter('at_risk'); setTenantStatusFilter('all'); }
                  setCurrentPage(1);
                }}
              />
              <KpiCard
                title="Trial ใกล้หมด"
                value={loading ? '—' : trialExpiringSoon.length.toLocaleString()}
                sub={trialExpiringSoon.length > 0 ? `${trialExpiringSoon.map(r => r.name.replace(/^บริษัท\s+/, '').split(' ')[0]).slice(0,2).join(', ')}${trialExpiringSoon.length > 2 ? ` +${trialExpiringSoon.length - 2}` : ''}` : 'ไม่มี Trial ที่ใกล้หมด'}
                icon={Clock} color={KK.red} bg={KK.redLight}
                onClick={() => {
                  if (tenantStatusFilter === 'trial') { setTenantStatusFilter('all'); }
                  else { setTenantStatusFilter('trial'); setStatusFilter('all'); }
                  setCurrentPage(1);
                }}
              />
              <KpiCard
                title="เสี่ยงเลิกใช้"
                value={loading ? '—' : atRisk.toLocaleString()}
                sub={`ต้องติดตามด่วน · ไม่ใช้งาน ${dormant}`}
                icon={AlertTriangle} color={KK.amber} bg={KK.amberLight}
                onClick={() => {
                  if (statusFilter === 'at_risk' && tenantStatusFilter === 'all') { setStatusFilter('all'); }
                  else { setStatusFilter('at_risk'); setTenantStatusFilter('all'); }
                  setCurrentPage(1);
                }}
              />
              <KpiCard
                title="ดีลที่ลูกค้าปิดบนระบบ"
                value={loading ? '—' : (dealStats.wonValue > 0 ? fmtMRR(dealStats.wonValue) : '฿0')}
                sub={`Conversion เฉลี่ย ${dealStats.conversion}% · คุณค่าที่ tenant ได้รับ`}
                icon={Trophy} color={KK.green} bg={KK.greenLight}
              />
            </div>

            {/* Two donuts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5 flex flex-col">
                <div className="flex items-start justify-between mb-0.5">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4" style={{ color: KK.blue }} />
                    <h2 className="text-base font-bold text-gray-900">สรุปตามแพ็กเกจ</h2>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-400">รวม MRR</div>
                    <div className="text-sm font-bold text-gray-900 tabular-nums">{fmtMRR(totalPaidMRR) === '—' ? '฿0' : fmtMRR(totalPaidMRR)}</div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-5">จำนวนบริษัท · ผู้ใช้งาน · MRR รายเดือน</p>
                <div className="flex-1 flex flex-col justify-between">
                  {PLAN_KEYS.map(p => {
                    const s = planStats[p];
                    const barW = maxCompanies > 0 ? Math.round((s.companies / maxCompanies) * 100) : 0;
                    const mrrPct = totalPaidMRR > 0 ? Math.round((s.mrr / totalPaidMRR) * 100) : 0;
                    return (
                      <div key={p} className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PLAN_COLOR[p] }} />
                        <span className="text-sm text-gray-600 w-24 flex-shrink-0">{PLAN_TH[p]}</span>
                        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${barW}%`, backgroundColor: PLAN_COLOR[p] }} />
                        </div>
                        <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0 tabular-nums">
                          {s.companies} บริษัท · {s.users} ผู้ใช้
                        </span>
                        <div className="text-right flex-shrink-0 w-20">
                          <div className="text-sm font-semibold text-gray-900 tabular-nums">{s.mrr > 0 ? fmtMRR(s.mrr) : '฿0'}</div>
                          <div className="text-xs text-gray-400">{mrrPct}% ของ MRR</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
                <div className="flex items-center gap-2 mb-0.5">
                  <HeartPulse className="w-4 h-4" style={{ color: KK.red }} />
                  <h2 className="text-base font-bold text-gray-900">สัดส่วนสุขภาพบริษัท</h2>
                </div>
                <p className="text-xs text-gray-500 mb-2">ใช้งานอยู่ / เสี่ยงเลิกใช้ / ไม่ใช้งาน / ยกเลิกแล้ว</p>
                <div className="relative" style={{ height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2}>
                        {donut.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any, n: any) => [`${v} บริษัท`, n]) as any} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="text-2xl font-bold text-gray-900 tabular-nums">{rows.length}</div>
                    <div className="text-xs text-gray-500">บริษัท</div>
                  </div>
                </div>
                <div className="space-y-1.5 mt-3 pt-3 border-t border-gray-100">
                  {donut.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: d.color }} />
                      <span className="text-gray-600 flex-1">{d.name}</span>
                      <span className="font-semibold text-gray-800 tabular-nums">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Company table */}
            <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="text-base font-bold text-gray-900">รายบริษัท</h2>
                    <p className="text-xs text-gray-500 mt-0.5">เรียงตามความเร่งด่วน: เสี่ยงเลิกใช้ → ไม่ใช้งาน → ใช้งานอยู่ → ยกเลิกแล้ว · กดหัวคอลัมน์เพื่อเรียงเอง</p>
                  </div>
                  {(statusFilter !== 'all' || tenantStatusFilter !== 'all' || planFilter !== 'all' || searchQuery) && (
                    <button
                      onClick={() => { setStatusFilter('all'); setTenantStatusFilter('all'); setPlanFilter('all'); setSearchQuery(''); setCurrentPage(1); }}
                      className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-500 hover:text-gray-900 hover:border-gray-300 transition-colors"
                    >
                      <span>ล้างตัวกรอง</span>
                      <span className="text-gray-400">×</span>
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="ค้นหาบริษัท..."
                      value={searchQuery}
                      onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="w-full h-9 pl-8 pr-3 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                    />
                  </div>
                  <Select value={tenantStatusFilter} onValueChange={(v) => { setTenantStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกบัญชี</SelectItem>
                      <SelectItem value="active">ใช้งานอยู่</SelectItem>
                      <SelectItem value="trial">Trial</SelectItem>
                      <SelectItem value="suspended">ระงับ</SelectItem>
                      <SelectItem value="cancelled">ยกเลิก</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกสถานะ</SelectItem>
                      <SelectItem value="healthy">ใช้งานอยู่</SelectItem>
                      <SelectItem value="at_risk">เสี่ยงเลิกใช้</SelectItem>
                      <SelectItem value="dormant">ไม่ใช้งาน</SelectItem>
                      <SelectItem value="churned">ยกเลิกแล้ว</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={planFilter} onValueChange={(v) => { setPlanFilter(v); setCurrentPage(1); }}>
                    <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทุกแพ็กเกจ</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="free">Free</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-40 text-sm text-gray-400">กำลังโหลด...</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>บริษัท</TableHead>
                        <TableHead className="text-center w-[150px]">แพ็กเกจ</TableHead>
                        <TableHead
                          className="text-right w-[120px] cursor-pointer select-none"
                          onClick={() => toggleSort('mrr')}
                        >
                          <span className="inline-flex items-center justify-end gap-1 w-full">
                            MRR เดือนนี้
                            {sortKey === 'mrr'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead
                          className="w-[130px] cursor-pointer select-none"
                          onClick={() => toggleSort('health')}
                        >
                          <span className="inline-flex items-center gap-1">
                            สุขภาพ
                            {sortKey === 'health'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead
                          className="w-[130px] cursor-pointer select-none"
                          onClick={() => toggleSort('lastLogin')}
                        >
                          <span className="inline-flex items-center gap-1">
                            ใช้งานล่าสุด
                            {sortKey === 'lastLogin'
                              ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)
                              : <ArrowUpDown className="w-3 h-3 text-gray-300" />}
                          </span>
                        </TableHead>
                        <TableHead className="text-center w-[52px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((r, idx) => {
                        const m = HEALTH_META[r.healthStatus];
                        return (
                          <TableRow
                            key={r.id}
                            className={`cursor-pointer transition-colors hover:bg-blue-50/30 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                            onClick={() => navigate(`/tenants/${r.id}`)}
                          >
                            {/* Company name */}
                            <TableCell>
                              <div className="font-semibold text-gray-900 flex items-center gap-1.5 flex-wrap leading-snug">
                                {r.name}
                                <TrialBadge row={r} />
                              </div>
                              {/* Trial outcome — แสดงเฉพาะเมื่อ trial หมดแล้ว */}
                              {r.trial_ends_at && new Date(r.trial_ends_at) < new Date() && r.tenantStatus !== 'trial' && (
                                <div className="text-xs mt-0.5">
                                  {r.tenantStatus === 'active'
                                    ? <span style={{ color: '#16a34a' }}>✓ Convert แล้ว</span>
                                    : <span style={{ color: '#ef4444' }}>✕ ไม่ต่อสัญญา</span>
                                  }
                                </div>
                              )}
                              {r.owner_notes && (
                                <div className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{r.owner_notes}</div>
                              )}
                            </TableCell>

                            {/* Plan badge — neutral blue (ไม่แย่งความสนใจจาก warning สี) */}
                            <TableCell className="text-center">
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full border"
                                style={{ color: KK.blue, borderColor: '#bfdbfe', background: KK.blueLight }}>
                                {PLAN_TH[r.plan] || r.plan}
                              </span>
                            </TableCell>

                            {/* MRR — committed run-rate (active only); other statuses show a status pill */}
                            <TableCell className="text-right tabular-nums">
                              {r.tenantStatus === 'trial' ? (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: KK.amber, background: KK.amberLight }}>Trial</span>
                              ) : r.tenantStatus === 'cancelled' ? (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: KK.gray, background: KK.grayLight }}>ยกเลิกแล้ว</span>
                              ) : r.tenantStatus === 'suspended' ? (
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: '#ea580c', background: '#fff7ed' }}>ระงับ</span>
                              ) : r.mrr > 0 ? (
                                <span className="font-semibold text-sm text-gray-900">{fmtMRR(r.mrr)}</span>
                              ) : (
                                <span className="text-xs text-gray-400">฿0</span>
                              )}
                            </TableCell>

                            {/* สุขภาพ — badge เท่านั้น */}
                            <TableCell>
                              <span
                                className="text-xs font-semibold px-2 py-0.5 rounded-md whitespace-nowrap"
                                style={{
                                  color: r.tenantStatus === 'suspended' ? '#ea580c' : m.color,
                                  backgroundColor: r.tenantStatus === 'suspended' ? '#fff7ed' : m.bg,
                                }}
                              >
                                {r.tenantStatus === 'suspended' ? 'ระงับ' : m.label}
                              </span>
                            </TableCell>

                            {/* ใช้งานล่าสุด — color-coded */}
                            <TableCell>
                              <span className="text-sm tabular-nums" style={{
                                color: r.lastLoginDays <= 3 ? KK.green : r.lastLoginDays <= 14 ? KK.amber : KK.red,
                              }}>
                                {r.lastLoginDays === 0 ? 'วันนี้' : r.lastLoginDays === 1 ? 'เมื่อวาน' : `${r.lastLoginDays} วันก่อน`}
                              </span>
                            </TableCell>

                            {/* Action — 3-dot dropdown; stopPropagation to avoid row click */}
                            <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700">
                                    <MoreHorizontal className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => navigate(`/tenants/${r.id}`)}>
                                    <Eye className="w-4 h-4 mr-2" />ดูรายละเอียด
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => { setNoteTarget({ id: r.id, name: r.name, notes: r.owner_notes || '' }); setNoteBody(r.owner_notes || ''); }}>
                                    <FileText className="w-4 h-4 mr-2" />บันทึก note
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(r.id, r.name)}
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />ลบบริษัท
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {paginated.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-sm text-gray-400 py-10">ไม่พบข้อมูล</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {!loading && sorted.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 pt-4 mt-2 border-t border-gray-100">
                  <span className="text-sm text-gray-500">แสดง {pageStart + 1}–{Math.min(pageStart + pageSize, sorted.length)} จาก {sorted.length} บริษัท</span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </Button>
                    {(() => {
                      const pages: number[] = [];
                      const from = Math.max(1, safePage - 2);
                      const to = Math.min(totalPages, from + 4);
                      for (let i = Math.max(1, to - 4); i <= to; i++) pages.push(i);
                      return pages.map(p => (
                        <Button key={p} variant={p === safePage ? 'default' : 'outline'} size="sm" className={`h-8 w-8 p-0 text-xs ${p === safePage ? 'bg-chateau hover:bg-chateau-700 text-white' : ''}`} onClick={() => setCurrentPage(p)}>{p}</Button>
                      ));
                    })()}
                    <Button variant="outline" size="sm" className="h-8 px-2" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

          </main>
        </div>
      </div>

      {/* Quick note dialog */}
      <Dialog open={!!noteTarget} onOpenChange={(o) => { if (!o) setNoteTarget(null); }}>
        <DialogContent className="max-w-md">
          {noteTarget && (
            <>
              <DialogHeader>
                <DialogTitle>บันทึก note — {noteTarget.name}</DialogTitle>
              </DialogHeader>
              <textarea
                className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-200"
                rows={4}
                placeholder="บันทึกสิ่งที่ต้องติดตาม เช่น ติดต่อ 15 ก.ค. / รอ renewal..."
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setNoteTarget(null)}>ยกเลิก</Button>
                <Button onClick={handleSaveNote} disabled={savingNote}>
                  {savingNote ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </OwnerGuard>
  );
};

export default OwnerTenantHealth;
