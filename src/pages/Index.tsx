import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "@/components/dashboard/Sidebar";
import Header from "@/components/dashboard/Header";
import {
  Area,
  AreaChart,
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

// Currency format — Thai real estate industry convention: "X ล้าน" with comma
// separators. Matches AP Thailand investor pages and DDproperty/Hipflat listings.
// Decimal precision scales down as the number grows so the card stays
// readable at a glance:
//   ≥ 1,000M    → "฿1,855 ล้าน"   (rounded, comma separator, headline scale)
//   100-999M    → "฿682 ล้าน"     (no decimal needed at this magnitude)
//   10-99M      → "฿62.8 ล้าน"    (1 decimal)
//   1-9M        → "฿1.85 ล้าน"    (2 decimals — precision matters at this scale)
//   1-999K      → "฿850K"          (Thai sales use K; "พัน" would be too long)
//   < 1,000     → "฿500"
const formatTHB = (n: number) => {
  // Guard against NaN/Infinity reaching the UI — a single missing field upstream
  // can otherwise produce "฿NaN ล้าน" on an executive KPI card.
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
  type: string | null;
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
  // Cancelled bookings in the last 30 days — feeds the "ยกเลิกการจอง" KPI card.
  // notes JSON carries deposit_amount (the actual money paid) — must use that, NOT
  // total_amount (which is unit price). Reserving a 10M unit with 500K deposit and
  // then cancelling with 300K refund means forfeited = 500K - 300K = 200K, not 9.7M.
  const [cancelledBookings, setCancelledBookings] = useState<Array<{
    id: string; status: string; total_amount: number | null;
    refund_amount: number | null; refunded_at: string | null;
    notes: { deposit_amount?: number; booking_fee?: number } | null;
  }>>([]);
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

        // Lazy cleanup: revert any reservations whose hold has expired before reading inventory
        try { await (supabase as any).rpc('revert_expired_unit_reservations'); } catch { /* ignore */ }

        // Bookings: only need cancelled ones from the last 30 days for the
        // "ยกเลิกการจอง" KPI card. Keep query lean — filter at DB.
        const cancelledSince = new Date();
        cancelledSince.setDate(cancelledSince.getDate() - 30);
        const [unitsRes, propRes, cancelledRes] = await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('units') as any)
            .select('id, status, price, deposit_amount, sold_at, reserved_at, updated_at, project_id')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('properties') as any)
            .select('id, name, type')
            .eq('tenant_id', tenantId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (supabase.from('bookings') as any)
            .select('id, status, total_amount, refund_amount, refunded_at, notes')
            .eq('tenant_id', tenantId)
            .eq('status', 'cancelled')
            .gte('refunded_at', cancelledSince.toISOString()),
        ]);

        setUnits((unitsRes.data || []) as UnitRow[]);
        setProperties((propRes.data || []) as PropertyRow[]);
        setCancelledBookings(cancelledRes.data || []);
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
  const salesMTDCount = soldInRange(startOfMonth).length;
  const salesYTDCount = soldInRange(startOfYear).length;
  const salesPrevMonth = soldInRange(startOfPrevMonth, startOfMonth).reduce((s, u) => s + Number(u.price || 0), 0);
  const salesYTD = soldInRange(startOfYear).reduce((s, u) => s + Number(u.price || 0), 0);
  const salesPrevYearSameMonth = soldInRange(startOfPrevYearSameMonth, endOfPrevYearSameMonth).reduce((s, u) => s + Number(u.price || 0), 0);

  const momChange = salesPrevMonth > 0 ? ((salesMTD - salesPrevMonth) / salesPrevMonth) * 100 : null;
  const yoyChange = salesPrevYearSameMonth > 0 ? ((salesMTD - salesPrevYearSameMonth) / salesPrevYearSameMonth) * 100 : null;

  const pipelineValue = reservedUnits.reduce((s, u) => s + Number(u.price || 0), 0);
  const pipelineDeposit = reservedUnits.reduce((s, u) => s + Number(u.deposit_amount || 0), 0);
  const pipelineCount = reservedUnits.length;

  // Cancellation metrics — last 30 days. "refunded" = money returned to customer,
  // "forfeited" = money kept by the company. Actual money that changed hands =
  // booking_fee (ค่าจอง, always collected) + deposit_amount (ค่ามัดจำ, only if the
  // booking reached contract signing). total_amount is the unit price (e.g. 10M)
  // which is NOT what was paid at cancellation time.
  const cancelledCount = cancelledBookings.length;
  const cancelledRefunded = cancelledBookings.reduce((s, b) => s + Number(b.refund_amount || 0), 0);
  const cancelledForfeited = cancelledBookings.reduce(
    (s, b) => {
      const paid = Number(b.notes?.booking_fee || 0) + Number(b.notes?.deposit_amount || 0);
      const refund = Number(b.refund_amount || 0);
      return s + Math.max(0, paid - refund);
    },
    0,
  );

  const recent90Sold = soldInRange(ninetyDaysAgo);

  // Inventory
  const totalUnits = units.length;
  const availableCount = availableUnits.length;
  const reservedCount = reservedUnits.length;
  const soldCount = soldUnits.length;

  // Sell-through velocity (per month over last 90 days). Require at least 3 sales
  // in the 90-day window — below that the velocity estimate is too noisy and the
  // resulting "months of inventory" becomes absurd (1 sale → 0.33/mo → 300mo for
  // 100 available units). Show 'null' instead so the UI can render "ขายช้าเกินไป".
  const sellThroughPerMonth = recent90Sold.length / 3;
  const daysOfInventory = recent90Sold.length >= 3 && sellThroughPerMonth > 0
    ? availableCount / sellThroughPerMonth
    : null; // in months

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

  // มูลค่ารวมโครงการ (GDV — Gross Development Value): sum of all unit prices = total
  // potential revenue if every unit sells. Internal variable name stays gdvTotal so
  // existing finance-team queries / dashboards that key off that term still resolve.
  // Industry-standard metric used by Sansiri/AP/Origin in annual reports
  const gdvTotal = units.reduce((s, u) => s + Number(u.price || 0), 0);

  // Monthly sales trend (last 12 months) — for hero sparkline + velocity card
  const salesByMonth12mo = Array.from({ length: 12 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - (10 - i), 1);
    const sold = soldUnits.filter((u) => {
      if (!u.sold_at) return false;
      const t = new Date(u.sold_at);
      return t >= monthStart && t < monthEnd;
    });
    return {
      month: monthStart.toLocaleDateString('th-TH', { month: 'short' }),
      value: sold.reduce((s, u) => s + Number(u.price || 0), 0),
      count: sold.length,
    };
  });

  // Monthly reservation activity (last 6 months) — for Pipeline card sparkline
  const reservationsByMonth6mo = Array.from({ length: 6 }, (_, i) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - (4 - i), 1);
    const count = units.filter((u) => {
      if (!u.reserved_at) return false;
      const t = new Date(u.reserved_at);
      return t >= monthStart && t < monthEnd;
    }).length;
    return {
      month: monthStart.toLocaleDateString('th-TH', { month: 'short' }),
      value: count,
      count,
    };
  });

  // Daily sales for current month — for MTD sparkline (day-by-day)
  const currentDay = now.getDate();
  const dailyThisMonth = Array.from({ length: currentDay }, (_, i) => {
    const day = i + 1;
    const dayStart = new Date(now.getFullYear(), now.getMonth(), day);
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), day + 1);
    const sold = soldUnits.filter((u) => {
      if (!u.sold_at) return false;
      const t = new Date(u.sold_at);
      return t >= dayStart && t < dayEnd;
    });
    return {
      month: String(day),
      value: sold.reduce((s, u) => s + Number(u.price || 0), 0),
      count: sold.length,
    };
  });

  const TYPE_LABEL: Record<string, string> = {
    apartment: 'อพาร์ตเมนต์',
    house: 'บ้าน',
    villa: 'วิลล่า',
    condo: 'คอนโด',
    commercial: 'พาณิชย์',
    single_house: 'บ้านเดี่ยว',
    twin_house: 'บ้านแฝด',
    townhome: 'ทาวน์โฮม',
  };
  const propTypeById = new Map(properties.map((p) => [p.id, p.type || 'other']));

  // ASP breakdown by property type (last 90 days) — groups condo/house/etc. separately
  const aspByType = Array.from(
    recent90Sold.reduce((map, u) => {
      const type = propTypeById.get(u.project_id) || 'other';
      const e = map.get(type) || { total: 0, count: 0 };
      e.total += Number(u.price || 0);
      e.count++;
      map.set(type, e);
      return map;
    }, new Map<string, { total: number; count: number }>())
  )
    .map(([type, { total, count }]) => ({
      label: TYPE_LABEL[type] || type,
      avg: count > 0 ? total / count : 0,
      count,
    }))
    .sort((a, b) => b.avg - a.avg);

  // Donut data — semantic real-estate convention:
  // green = พร้อมขาย (available, ซื้อได้) · amber = จองอยู่ (wait) · red = ขายแล้ว (closed)
  const donutData = [
    { name: 'พร้อมขาย', value: availableCount, color: C.green },
    { name: 'จองอยู่', value: reservedCount, color: C.amber },
    { name: 'ขายแล้ว', value: soldCount, color: C.red },
  ].filter((d) => d.value > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-[260px]">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className="p-6 lg:p-10 space-y-8">
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
              {/* Row 1 — KPI strip: 4 equal cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                <CompactKpiCard
                  title="ยอดขายปีนี้"
                  value={formatTHB(salesYTD)}
                  icon={TrendingUp}
                  accentColor={C.redDeep}
                  bg={C.redDeepLight}
                  sub={
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500">ขาย <span className="font-semibold text-gray-700 tabular-nums">{salesYTDCount}</span> ยูนิต</span>
                      {yoyChange !== null ? <ChangeBadge value={yoyChange} label="YoY" /> : <span className="text-xs text-gray-400">ปีก่อนไม่มียอด</span>}
                    </div>
                  }
                  sparkData={salesByMonth12mo}
                />
                <CompactKpiCard
                  title="ยอดขายเดือนนี้"
                  value={formatTHB(salesMTD)}
                  icon={Wallet}
                  accentColor={C.red}
                  bg={C.redLight}
                  sub={
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500">ขาย <span className="font-semibold text-gray-700 tabular-nums">{salesMTDCount}</span> ยูนิต</span>
                      {momChange !== null ? <ChangeBadge value={momChange} label="เทียบเดือนก่อน" /> : <span className="text-xs text-gray-400">เดือนแรก</span>}
                    </div>
                  }
                  sparkData={dailyThisMonth}
                  sparkLabelPrefix="วันที่"
                />
                <CompactKpiCard
                  title="มูลค่าการจอง"
                  value={formatTHB(pipelineValue)}
                  icon={Hourglass}
                  accentColor={C.amber}
                  bg={C.amberLight}
                  sub={
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-gray-500">
                        <span className="font-semibold text-gray-700 tabular-nums">{pipelineCount}</span> ดีล · มัดจำ {formatTHB(pipelineDeposit)}
                      </span>
                      {cancelledCount > 0 ? (
                        <span className="text-xs text-red-600">
                          ยกเลิก 30 วัน: <span className="font-semibold tabular-nums">{cancelledCount}</span> ราย
                          {cancelledRefunded > 0 && <> · คืน {formatTHB(cancelledRefunded)}</>}
                          {cancelledForfeited > 0 && <> · ริบ {formatTHB(cancelledForfeited)}</>}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">ไม่มีการยกเลิกใน 30 วัน</span>
                      )}
                    </div>
                  }
                  sparkData={reservationsByMonth6mo}
                />
                <CompactKpiCard
                  title="มูลค่ารวมโครงการ"
                  value={formatTHB(gdvTotal)}
                  icon={Building2}
                  accentColor={C.redDeep}
                  bg={C.redDeepLight}
                  sub={<span className="text-xs text-gray-500"><span className="font-semibold text-gray-700 tabular-nums">{totalUnits}</span> ยูนิต · <span className="font-semibold text-gray-700 tabular-nums">{properties.length}</span> โครงการ</span>}
                />
              </div>

              {/* Row 2 — Asymmetric: Velocity big (2/3) + Inventory donut small (1/3) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Sell-through Velocity — big card (2/3 width) */}
                <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <DollarSign className="w-4 h-4" style={{ color: C.red }} />
                    <h3 className="text-base font-bold text-gray-900">ความเร็วขายสต๊อก</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-gray-50">
                      <p className="text-[11px] text-gray-500 mb-1">อัตราขายเฉลี่ย (90 วัน)</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                        {sellThroughPerMonth.toFixed(1)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">ยูนิต / เดือน</p>
                    </div>
                    <div className="p-4 rounded-xl bg-gray-50">
                      <p className="text-[11px] text-gray-500 mb-1">Days of Inventory</p>
                      <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
                        {daysOfInventory !== null ? daysOfInventory.toFixed(0) : '—'}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-1">เดือน</p>
                    </div>
                  </div>

                  {/* Monthly sales bar chart */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-gray-500">ยูนิตที่ขายได้ต่อเดือน</p>
                      <span className="text-xs font-semibold text-gray-700 tabular-nums">
                        รวม {salesByMonth12mo.reduce((s, m) => s + m.count, 0)} ยูนิต / 12 เดือน
                      </span>
                    </div>
                    <ResponsiveContainer width="100%" height={90}>
                      <BarChart data={salesByMonth12mo} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
                        <Bar dataKey="count" fill={C.red} radius={[3, 3, 0, 0]} />
                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#fafafa' }} formatter={(v) => [`${v} ยูนิต`, '']} labelFormatter={(l) => `${l}`} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="text-[11px] text-gray-400 mt-3 pt-3 border-t border-gray-100">
                    มาตรฐานอุตสาหกรรมไทย: 18-24 เดือน · {daysOfInventory === null ? (recent90Sold.length === 0 ? 'ยังไม่มียอดขาย — คำนวณไม่ได้' : 'ยอดขายน้อยเกินไป — คำนวณไม่แม่นยำ') : daysOfInventory > 24 ? 'เกินมาตรฐาน — สต๊อกค้าง' : daysOfInventory > 18 ? 'อยู่ในระดับสูง — เฝ้าระวัง' : 'อยู่ในเกณฑ์ดี'}
                  </p>
                </div>

                {/* Inventory Status — narrow card (1/3 width), vertical stack */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4" style={{ color: C.red }} />
                    <h3 className="text-base font-bold text-gray-900">Inventory Status</h3>
                  </div>
                  {totalUnits === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-sm text-gray-400">ยังไม่มียูนิตในระบบ</div>
                  ) : (
                    <>
                      <div className="relative">
                        <ResponsiveContainer width="100%" height={180}>
                          <PieChart>
                            <Pie data={donutData} cx="50%" cy="50%" innerRadius={52} outerRadius={76} paddingAngle={3} dataKey="value">
                              {donutData.map((d, i) => <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />)}
                            </Pie>
                            <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${v} ยูนิต`, '']} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                          <p className="text-2xl font-bold text-gray-900 tabular-nums leading-none">{totalUnits}</p>
                          <p className="text-[11px] text-gray-500 mt-1">ยูนิตทั้งหมด</p>
                        </div>
                      </div>
                      <div className="space-y-2.5 mt-3">
                        <StatusRow color={C.green} label="พร้อมขาย" count={availableCount} total={totalUnits} />
                        <StatusRow color={C.amber} label="จองอยู่"  count={reservedCount} total={totalUnits} />
                        <StatusRow color={C.red}   label="ขายแล้ว"  count={soldCount} total={totalUnits} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Row 3 — Asymmetric: Top Projects big (2/3) + ASP breakdown small (1/3) */}
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Top Projects — big card (2/3 width) */}
                <div className="xl:col-span-2 bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <Building2 className="w-4 h-4" style={{ color: C.red }} />
                    <h3 className="text-base font-bold text-gray-900">โครงการที่ขายดี</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">ยอดขาย 12 เดือนล่าสุด · Top 5</p>
                  {topProjects.length === 0 ? (
                    <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">
                      ยังไม่มียอดขายใน 12 เดือนล่าสุด
                    </div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={topProjects} layout="vertical" margin={{ top: 5, right: 30, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => formatTHB(Number(v))} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#374151' }} axisLine={false} tickLine={false} width={120} />
                          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatTHB(Number(v)), 'ยอดขาย']} />
                          <Bar dataKey="value" fill={C.red} radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      {allRevenue12mo > 0 && (
                        <p className="text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                          {topProjects[0].name} คิดเป็น <span className="font-semibold text-gray-700">{((topProjects[0].value / allRevenue12mo) * 100).toFixed(0)}%</span> ของรายได้ 12 เดือน
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* ASP breakdown by type — narrow card (1/3 width) */}
                <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-6 flex flex-col">
                  <div className="flex items-center gap-2 mb-1">
                    <Tag className="w-4 h-4" style={{ color: C.red }} />
                    <h3 className="text-base font-bold text-gray-900">ราคาเฉลี่ยตามประเภท</h3>
                  </div>
                  <p className="text-xs text-gray-500 mb-4">90 วันล่าสุด</p>
                  {aspByType.length > 1 ? (
                    <>
                      <div className="space-y-2.5">
                        {aspByType.map((p) => {
                          const max = Math.max(...aspByType.map((x) => x.avg), 1);
                          const pct = (p.avg / max) * 100;
                          return (
                            <div key={p.label}>
                              <div className="flex justify-between items-baseline text-sm mb-1">
                                <span className="text-gray-600">{p.label}</span>
                                <span className="font-bold text-gray-900 tabular-nums">{formatTHB(p.avg)}</span>
                              </div>
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: C.red }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-auto pt-3 border-t border-gray-100">
                        จาก <span className="font-semibold text-gray-700">{recent90Sold.length}</span> ดีลใน 90 วันที่ผ่านมา
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400 text-center py-8">มีประเภทเดียว — ดูภาพรวมที่ KPI ด้านบน</p>
                  )}
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

// Sparkline — small area chart for trend visualization inside cards
interface SparklineData { value?: number; count?: number; month?: string }
const Sparkline = ({ data, color, height = 60, dataKey = 'value', labelPrefix = 'เดือน' }: { data: SparklineData[]; color: string; height?: number; dataKey?: string; labelPrefix?: string }) => (
  <ResponsiveContainer width="100%" height={height}>
    <AreaChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
      <Area
        type="monotone"
        dataKey={dataKey}
        stroke={color}
        strokeWidth={2}
        fill={color}
        fillOpacity={0.12}
      />
      <Tooltip
        contentStyle={tooltipStyle}
        labelStyle={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        labelFormatter={(_label, payload: any) => payload?.[0]?.payload?.month ? `${labelPrefix} ${payload[0].payload.month}` : ''}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter={(v: any) => [typeof v === 'number' && v > 1000 ? formatTHB(v) : String(v), 'ยอดขาย']}
        cursor={false}
      />
    </AreaChart>
  </ResponsiveContainer>
);

// Compact KPI card — left accent stripe + small icon + optional sparkline footer
interface CompactKpiCardProps {
  title: string;
  value: string;
  icon: React.ElementType;
  accentColor: string;
  bg: string;
  sub?: React.ReactNode;
  sparkData?: SparklineData[];
  sparkLabelPrefix?: string;
}
const CompactKpiCard = ({ title, value, icon: Icon, accentColor, bg, sub, sparkData, sparkLabelPrefix }: CompactKpiCardProps) => (
  <div className="bg-white border border-gray-100 rounded-2xl shadow-soft hover:shadow-soft-md hover:-translate-y-0.5 transition-all duration-200 relative overflow-hidden">
    <div className="p-5 pl-6">
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pt-1">{title}</p>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
             style={{ background: `linear-gradient(135deg, ${bg}f0 0%, ${bg} 100%)` }}>
          <Icon className="w-4 h-4" style={{ color: accentColor }} strokeWidth={2.2} />
        </div>
      </div>
      <p className="text-[26px] font-bold text-gray-900 leading-none tabular-nums tracking-tight">{value}</p>
      <div className="mt-2.5 min-h-[18px]">{sub}</div>
    </div>
    {sparkData && sparkData.length > 0 && (
      <div className="px-1 pb-1">
        <Sparkline data={sparkData} color={accentColor} height={32} labelPrefix={sparkLabelPrefix} />
      </div>
    )}
  </div>
);

export default Index;
