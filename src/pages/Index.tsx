import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  DollarSign,
  Hourglass,
  Package,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useSimpleAuth } from "@/contexts/AuthContextSimple";

// Soft luxury real-estate palette — red theme but airy & refined.
// All shades 1-2 levels softer than full saturation; lots of pale tints.
const C = {
  // Brand red — softened (red-500 instead of intense brand bright)
  red:        '#ef4444',     // soft brand red — hero + anchor
  redLight:   '#fef2f2',     // pale pink tint
  // Dusty rose — sibling for YTD (softer than burgundy)
  redDeep:    '#e11d48',
  redDeepLight: '#fff1f2',
  // Soft copper/gold — luxury accent
  amber:      '#d97706',
  amberLight: '#fefce8',
  // Soft green — success / growth
  green:      '#16a34a',
  greenLight: '#f0fdf4',
  // Soft slate — premium neutral (instead of near-black charcoal)
  charcoal:   '#475569',
  charcoalLight: '#f1f5f9',
  // Lighter slate — chart neutral fill
  slate:      '#94a3b8',
  slateLight: '#f1f5f9',
  // Soft rose accent — funnel mid-tone
  rose:       '#fb7185',
  roseLight:  '#fff1f2',
  // Sub headers
  blue:       '#64748b',
  blueLight:  '#f1f5f9',
  // UI neutrals
  gray:       '#94a3b8',
  grayLight:  '#fafafa',
  border:     '#e5e7eb',
};

const formatTHB = (n: number) => {
  if (n >= 1_000_000_000) return `฿${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `฿${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `฿${(n / 1_000).toFixed(0)}K`;
  return `฿${n.toFixed(0)}`;
};

const tooltipStyle = {
  backgroundColor: 'white',
  border: `1px solid ${C.border}`,
  borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  fontSize: '12px',
  padding: '8px 12px',
};

interface UnitRow {
  id: string;
  status: string;
  price: number;
  deposit_amount: number | null;
  sold_at: string | null;
  reserved_at: string | null;
  updated_at: string;
  project_id: string;
}

interface PropertyRow {
  id: string;
  name: string;
}

interface LeadRow {
  id: string;
  status: string | null;
}

const Index = () => {
  const { currentTenant, userRole } = useSimpleAuth();
  const navigate = useNavigate();

  // Sales role should never see executive financials — redirect to their personal dashboard
  useEffect(() => {
    if (userRole === 'sales' || userRole === 'agent') {
      navigate('/my-dashboard', { replace: true });
    }
  }, [userRole, navigate]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const tenantId = currentTenant?.id;
        if (!tenantId) {
          setLoading(false);
          return;
        }

        const [unitsRes, propRes, leadsRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('units') as any)
            .select('id, status, price, deposit_amount, sold_at, reserved_at, updated_at, project_id')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('leads') as any)
            .select('id, status')
            .eq('tenant_id', tenantId),
        ]);

        setUnits((unitsRes.data || []) as UnitRow[]);
        setProperties((propRes.data || []) as PropertyRow[]);
        setLeads((leadsRes.data || []) as LeadRow[]);
      } catch (e) {
        console.error('Dashboard load failed:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentTenant]);

  // ─── Compute board KPIs ────────────────────────────────────
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const startOfPrevYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  const endOfPrevYearSameMonth = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1);
  const ninetyDaysAgo = new Date(); ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const oneEightyDaysAgo = new Date(); oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);
  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());

  const soldUnits = units.filter((u) => u.status === 'sold');
  const reservedUnits = units.filter((u) => u.status === 'reserved');
  const availableUnits = units.filter((u) => u.status === 'available');

  const soldInRange = (from: Date, to?: Date) =>
    soldUnits.filter((u) => {
      if (!u.sold_at) return false;
      const t = new Date(u.sold_at);
      if (t < from) return false;
      if (to && t >= to) return false;
      return true;
    });

  const salesMTD = soldInRange(startOfMonth).reduce((s, u) => s + Number(u.price || 0), 0);
  const salesPrevMonth = soldInRange(startOfPrevMonth, startOfMonth).reduce((s, u) => s + Number(u.price || 0), 0);
  const salesYTD = soldInRange(startOfYear).reduce((s, u) => s + Number(u.price || 0), 0);
  const salesPrevYearSameMonth = soldInRange(startOfPrevYearSameMonth, endOfPrevYearSameMonth).reduce((s, u) => s + Number(u.price || 0), 0);

  const momChange = salesPrevMonth > 0 ? ((salesMTD - salesPrevMonth) / salesPrevMonth) * 100 : null;
  const yoyChange = salesPrevYearSameMonth > 0 ? ((salesMTD - salesPrevYearSameMonth) / salesPrevYearSameMonth) * 100 : null;

  const pipelineValue = reservedUnits.reduce((s, u) => s + Number(u.price || 0), 0);
  const pipelineDeposit = reservedUnits.reduce((s, u) => s + Number(u.deposit_amount || 0), 0);
  const pipelineCount = reservedUnits.length;

  const recent90Sold = soldInRange(ninetyDaysAgo);
  const prev90Sold = soldInRange(oneEightyDaysAgo, ninetyDaysAgo);
  const avgPrice90 = recent90Sold.length > 0 ? recent90Sold.reduce((s, u) => s + Number(u.price || 0), 0) / recent90Sold.length : 0;
  const avgPricePrev = prev90Sold.length > 0 ? prev90Sold.reduce((s, u) => s + Number(u.price || 0), 0) / prev90Sold.length : 0;
  const aspChange = avgPricePrev > 0 ? ((avgPrice90 - avgPricePrev) / avgPricePrev) * 100 : null;

  // Inventory
  const totalUnits = units.length;
  const availableCount = availableUnits.length;
  const reservedCount = reservedUnits.length;
  const soldCount = soldUnits.length;
  const inventoryValue = availableUnits.reduce((s, u) => s + Number(u.price || 0), 0);

  // Sell-through velocity (per month over last 90 days)
  const sellThroughPerMonth = recent90Sold.length / 3;
  const daysOfInventory = sellThroughPerMonth > 0 ? availableCount / sellThroughPerMonth : null; // in months

  // Top selling projects (last 12 months)
  const projectSalesMap = new Map<string, number>();
  soldInRange(twelveMonthsAgo).forEach((u) => {
    projectSalesMap.set(u.project_id, (projectSalesMap.get(u.project_id) || 0) + Number(u.price || 0));
  });
  const propNameById = new Map(properties.map((p) => [p.id, p.name]));
  const topProjects = Array.from(projectSalesMap.entries())
    .map(([id, value]) => ({ id, name: propNameById.get(id) || '(ไม่ระบุ)', value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  const allRevenue12mo = Array.from(projectSalesMap.values()).reduce((s, v) => s + v, 0);

  // Funnel — keep pure-lead pipeline (units in DB don't have FK to leads)
  const leadsTotal = leads.length;
  const leadsContacted = leads.filter((l) => l.status === 'contacted' || l.status === 'qualified' || l.status === 'negotiating' || l.status === 'won').length;
  const leadsQualified = leads.filter((l) => l.status === 'qualified' || l.status === 'negotiating' || l.status === 'won').length;
  const leadsNegotiating = leads.filter((l) => l.status === 'negotiating' || l.status === 'won').length;
  const leadsWon = leads.filter((l) => l.status === 'won').length;
  const conversionRate = leadsTotal > 0 ? (leadsWon / leadsTotal) * 100 : 0;

  // Donut data — semantic real-estate convention:
  // green = พร้อมขาย (available, ซื้อได้) · amber = จองอยู่ (wait) · red = ขายแล้ว (closed)
  const donutData = [
    { name: 'พร้อมขาย', value: availableCount, color: C.green },
    { name: 'จองอยู่', value: reservedCount, color: C.amber },
    { name: 'ขายแล้ว', value: soldCount, color: C.red },
  ].filter((d) => d.value > 0);

  // Insight strip
  const insight = (() => {
    if (loading || totalUnits === 0) return null;
    if (daysOfInventory && daysOfInventory > 24) {
      return `⚠️ Days of Inventory ${daysOfInventory.toFixed(0)} เดือน — เกินมาตรฐาน 24 เดือน พิจารณาทำ promo หรือปรับราคา`;
    }
    if (topProjects.length > 0 && allRevenue12mo > 0) {
      const topShare = (topProjects[0].value / allRevenue12mo) * 100;
      if (topShare > 30) {
        return `💡 ${topProjects[0].name} คิดเป็น ${topShare.toFixed(0)}% ของรายได้ 12 เดือน — concentration risk สูง`;
      }
    }
    if (momChange !== null && momChange < -10) {
      return `📉 ยอดขายลดลง ${Math.abs(momChange).toFixed(0)}% เทียบเดือนก่อน — ต้องตรวจสอบ`;
    }
    if (momChange !== null && momChange > 20) {
      return `🚀 ยอดขายเติบโต ${momChange.toFixed(0)}% เทียบเดือนก่อน — โมเมนตัมดี`;
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-10 space-y-7">
          {/* === Page Title === */}
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <span className="inline-block text-xs font-semibold uppercase tracking-wide mb-3 px-2.5 py-1 rounded-md" style={{ color: C.red, backgroundColor: C.redLight }}>
                Executive View
              </span>
              <h1 className="text-[34px] font-bold text-gray-900 leading-tight tracking-tight">Dashboard</h1>
              <p className="text-[15px] text-gray-500 mt-1.5">
                ยอดขาย · สต๊อก · pipeline · {currentTenant?.name || ''} — อัปเดต {new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="space-y-7">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 h-[170px] animate-pulse" />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 h-[300px] animate-pulse" />)}
              </div>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {[...Array(2)].map((_, i) => <div key={i} className="bg-white border border-gray-100 rounded-2xl p-6 h-[300px] animate-pulse" />)}
              </div>
            </div>
          ) : (
            <>
              {/* === Row 1: Financial Headline === */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <FinancialCard
                  title="ยอดขายเดือนนี้"
                  value={formatTHB(salesMTD)}
                  icon={Wallet}
                  color={C.red}
                  bg={C.redLight}
                  sub={momChange !== null ? <ChangeBadge value={momChange} label="เทียบเดือนก่อน" /> : <span className="text-xs text-gray-400">ยังไม่มียอดเดือนก่อน</span>}
                />
                <FinancialCard
                  title="ยอดขายปีนี้"
                  value={formatTHB(salesYTD)}
                  icon={TrendingUp}
                  color={C.redDeep}
                  bg={C.redDeepLight}
                  sub={yoyChange !== null ? <ChangeBadge value={yoyChange} label="YoY เดือนเดียวกัน" /> : <span className="text-xs text-gray-400">ปีก่อนไม่มียอด</span>}
                />
                <FinancialCard
                  title="Pre-sales Pipeline"
                  value={formatTHB(pipelineValue)}
                  icon={Hourglass}
                  color={C.amber}
                  bg={C.amberLight}
                  sub={<span className="text-xs text-gray-500">{pipelineCount} ดีล · มัดจำ {formatTHB(pipelineDeposit)}</span>}
                />
                <FinancialCard
                  title="ราคาเฉลี่ยที่ขายได้"
                  value={avgPrice90 > 0 ? formatTHB(avgPrice90) : '—'}
                  icon={Tag}
                  color={C.charcoal}
                  bg={C.charcoalLight}
                  sub={aspChange !== null ? <ChangeBadge value={aspChange} label="QoQ" /> : <span className="text-xs text-gray-400">90 วันล่าสุด</span>}
                />
              </div>

              {/* Insight strip */}
              {insight && (
                <div className="px-4 py-3 rounded-xl border" style={{ borderColor: C.amberLight, backgroundColor: '#fffdf5' }}>
                  <p className="text-sm font-medium text-gray-800">{insight}</p>
                </div>
              )}

              {/* === Row 2: Inventory Velocity === */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Inventory Status */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Package className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">Inventory Status</h2>
                    <span className="ml-auto text-sm text-gray-500">{totalUnits} ยูนิต</span>
                  </div>

                  {totalUnits === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">ยังไม่มียูนิตในระบบ</div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={donutData}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />)}
                          </Pie>
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v) => [`${v} ยูนิต`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>

                      <div className="space-y-3">
                        <StatusRow color={C.green} label="พร้อมขาย" count={availableCount} total={totalUnits} />
                        <StatusRow color={C.amber} label="จองอยู่"  count={reservedCount} total={totalUnits} />
                        <StatusRow color={C.red}   label="ขายแล้ว"  count={soldCount} total={totalUnits} />
                        <div className="pt-3 mt-2 border-t border-gray-100 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">มูลค่าคงค้าง</span>
                            <span className="font-semibold tabular-nums">{formatTHB(inventoryValue)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">มัดจำคงค้าง</span>
                            <span className="font-semibold tabular-nums">{formatTHB(pipelineDeposit)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Sell-through Velocity */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <DollarSign className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">Sell-Through Velocity</h2>
                  </div>

                  <div className="space-y-5">
                    <div className="p-4 rounded-xl" style={{ backgroundColor: C.greenLight }}>
                      <p className="text-xs text-gray-600 mb-1">อัตราขายเฉลี่ย (90 วัน)</p>
                      <p className="text-3xl font-bold" style={{ color: C.green }}>
                        {sellThroughPerMonth.toFixed(1)}<span className="text-base font-medium text-gray-500 ml-1.5">ยูนิต / เดือน</span>
                      </p>
                    </div>

                    <div className="p-4 rounded-xl" style={{
                      backgroundColor: daysOfInventory && daysOfInventory > 24 ? C.redLight : daysOfInventory && daysOfInventory > 18 ? C.amberLight : C.greenLight
                    }}>
                      <p className="text-xs text-gray-600 mb-1">Days of Inventory</p>
                      <p className="text-3xl font-bold" style={{
                        color: daysOfInventory && daysOfInventory > 24 ? C.red : daysOfInventory && daysOfInventory > 18 ? C.amber : C.green
                      }}>
                        {daysOfInventory !== null ? `${daysOfInventory.toFixed(0)} ` : '— '}
                        <span className="text-base font-medium text-gray-500 ml-1.5">เดือน</span>
                      </p>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {daysOfInventory === null
                          ? 'ยังไม่มีข้อมูลการขาย 90 วันล่าสุด'
                          : daysOfInventory > 24
                          ? 'เกินมาตรฐานอุตสาหกรรม (18-24 เดือน)'
                          : daysOfInventory > 18
                          ? 'อยู่ในระดับสูง — เฝ้าระวัง'
                          : 'อยู่ในเกณฑ์ดี'}
                      </p>
                    </div>

                    <div className="text-xs text-gray-400 pt-1">
                      มาตรฐานอุตสาหกรรมไทย: 18-24 เดือน · เกิน 24 = สต๊อกค้าง
                    </div>
                  </div>
                </div>
              </div>

              {/* === Row 3: Top Projects + Conversion Funnel === */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Top Selling Projects */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4" style={{ color: C.red }} />
                    <h2 className="text-base font-bold text-gray-900">โครงการที่ขายดีที่สุด</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ยอดขาย 12 เดือนล่าสุด · Top 5</p>

                  {topProjects.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
                      ยังไม่มียอดขายใน 12 เดือนล่าสุด
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={topProjects} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTHB(Number(v))} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={120} />
                          <Tooltip
                            contentStyle={tooltipStyle}
                            formatter={(v) => [formatTHB(Number(v)), 'ยอดขาย']}
                          />
                          <Bar dataKey="value" fill={C.red} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>

                      {allRevenue12mo > 0 && (
                        <p className="text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
                          💡 {topProjects[0].name} คิดเป็น <span className="font-semibold text-gray-700">{((topProjects[0].value / allRevenue12mo) * 100).toFixed(0)}%</span> ของรายได้ 12 เดือน
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Conversion Funnel */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="w-4 h-4" style={{ color: C.redDeep }} />
                    <h2 className="text-base font-bold text-gray-900">Conversion Funnel</h2>
                  </div>
                  <p className="text-xs text-gray-500 mb-5">Lead → ปิดดีล</p>

                  <div className="space-y-3.5">
                    <FunnelStep label="ลูกค้าสนใจทั้งหมด" value={leadsTotal} max={Math.max(leadsTotal, 1)} color="#cbd5e1" />
                    <FunnelStep label="ติดต่อแล้ว +" value={leadsContacted} max={Math.max(leadsTotal, 1)} color={C.gray} />
                    <FunnelStep label="มีคุณสมบัติ +" value={leadsQualified} max={Math.max(leadsTotal, 1)} color={C.charcoal} />
                    <FunnelStep label="กำลังเจรจา +" value={leadsNegotiating} max={Math.max(leadsTotal, 1)} color={C.amber} />
                    <FunnelStep label="ปิดดีลแล้ว" value={leadsWon} max={Math.max(leadsTotal, 1)} color={C.green} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-5 pt-5 border-t border-gray-100">
                    <div className="rounded-xl p-3" style={{ backgroundColor: C.greenLight }}>
                      <p className="text-xs text-gray-600">อัตราปิดดีล</p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: C.green }}>
                        {conversionRate.toFixed(1)}<span className="text-sm">%</span>
                      </p>
                    </div>
                    <div className="rounded-xl p-3" style={{ backgroundColor: C.charcoalLight }}>
                      <p className="text-xs text-gray-600">ค่าเฉลี่ยอุตสาหกรรม</p>
                      <p className="text-2xl font-bold tabular-nums" style={{ color: C.charcoal }}>
                        4-6<span className="text-sm">%</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

// ─── Sub-components ─────────────────────────────────────────────

interface FinancialCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  sub?: React.ReactNode;
}

const FinancialCard = ({ title, value, icon: Icon, color, bg, sub }: FinancialCardProps) => (
  <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200">
    <div className="flex items-start justify-between mb-4">
      <p className="text-sm font-medium text-gray-500 leading-tight pt-1.5">{title}</p>
      <div
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px ${color}15`,
        }}
      >
        <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
      </div>
    </div>
    <p className="text-[28px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
    <div className="mt-3.5 min-h-[20px]">{sub}</div>
  </div>
);

const ChangeBadge = ({ value, label }: { value: number; label: string }) => {
  const up = value >= 0;
  const Icon = up ? ArrowUp : ArrowDown;
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="inline-flex items-center gap-0.5 font-semibold tabular-nums" style={{ color: up ? C.green : C.red }}>
        <Icon className="w-3 h-3" strokeWidth={3} />
        {Math.abs(value).toFixed(1)}%
      </span>
      <span className="text-gray-400">{label}</span>
    </div>
  );
};

const StatusRow = ({ color, label, count, total }: { color: string; label: string; count: number; total: number }) => {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-gray-700">{label}</span>
        </div>
        <span className="font-semibold tabular-nums">
          {count} <span className="text-gray-400 text-xs">({pct.toFixed(0)}%)</span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

const FunnelStep = ({ label, value, max, color }: { label: string; value: number; max: number; color: string }) => {
  const pct = (value / max) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums text-gray-900">{value.toLocaleString()}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

export default Index;
