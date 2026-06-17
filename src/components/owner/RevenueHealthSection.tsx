import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  ResponsiveContainer, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { RefreshCw, TrendingUp, TrendingDown, Users, Wallet, Percent, AlertTriangle, Pencil } from 'lucide-react';

// ──────────────────────────────────────────────────────────────────────────
// สุขภาพรายได้ SaaS (Revenue Health) — Owner-only tab inside Payments.
// All metrics are DERIVED from the real `invoices` table (each tenant's paid
// invoice amount over time = their MRR history): NRR / GRR / Revenue Churn /
// MRR movement (New/Expansion/Contraction/Churned). CAC is owner-entered (cost
// isn't in the DB), LTV/Payback follow from it. No migration needed.
// CAVEAT: on early/sparse billing data some values read "—" or 100%/0% — that is
// correct (no churn ⇒ NRR ~100%); they firm up once real billing accrues.
// ──────────────────────────────────────────────────────────────────────────

const KK = {
  red: '#ef4444', redLight: '#fef2f2',
  blue: '#1e3a5f', blueLight: '#eff6ff',
  green: '#16a34a', greenLight: '#f0fdf4',
  amber: '#d97706', amberLight: '#fefce8',
  purple: '#7c3aed', purpleLight: '#f5f3ff',
  gray: '#94a3b8', border: '#e5e7eb',
};
const kkTooltipStyle = {
  backgroundColor: 'white', border: `1px solid ${KK.border}`, borderRadius: '8px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '11px', padding: '4px 8px',
};
const fmtCompact = (n: number) => {
  if (!Number.isFinite(n) || n === 0) return '฿0';
  const abs = Math.abs(n); const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    if (m >= 100) return `${sign}฿${Math.round(m)} ล้าน`;
    if (m >= 10) return `${sign}฿${m.toFixed(1)} ล้าน`;
    return `${sign}฿${m.toFixed(2)} ล้าน`;
  }
  if (abs >= 1_000) return `${sign}฿${(abs / 1_000).toFixed(0)}K`;
  return `${sign}฿${Math.round(abs)}`;
};

interface Derived {
  priorMRR: number; currentMRR: number;
  newMRR: number; expansion: number; contraction: number; churnedMRR: number;
  nrr: number | null; grr: number | null; revenueChurn: number | null;
  activeCount: number; arpa: number;
  monthlyLogoChurn: number | null; ltv: number | null;
  decliners: { name: string; lost: number; type: 'ดาวน์เกรด' | 'เลิกใช้' }[];
}

const RevenueHealthSection = () => {
  const [loading, setLoading] = useState(true);
  const [d, setD] = useState<Derived | null>(null);
  const [totalTenants, setTotalTenants] = useState(0);
  const [acqSpend, setAcqSpend] = useState<number | null>(() => {
    const v = typeof window !== 'undefined' ? window.localStorage.getItem('owner_acq_spend') : null;
    return v ? Number(v) : null;
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: tenants } = await supabase.from('tenants').select('id, status, name').eq('is_platform' as any, false);
      const tlist = (tenants || []) as { id: string; status: string; name: string }[];
      const activeIds = new Set(tlist.filter((t) => t.status === 'active').map((t) => t.id));
      const nameMap = new Map(tlist.map((t) => [t.id, t.name]));
      setTotalTenants(tlist.length);

      const { data: inv } = await supabase.from('invoices').select('tenant_id, amount, paid_at, created_at').eq('status', 'paid');
      const invoices = (inv || []) as { tenant_id: string; amount: number; paid_at: string | null; created_at: string }[];

      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const t = (x: any) => new Date(x.paid_at || x.created_at).getTime();

      // Per-tenant current MRR (latest paid invoice) and prior MRR (latest before this month).
      const cur = new Map<string, { time: number; amt: number }>();
      const prev = new Map<string, { time: number; amt: number }>();
      invoices.forEach((x) => {
        const tm = t(x); const amt = Number(x.amount) || 0;
        const c = cur.get(x.tenant_id);
        if (!c || tm > c.time) cur.set(x.tenant_id, { time: tm, amt });
        if (tm < monthStart.getTime()) {
          const p = prev.get(x.tenant_id);
          if (!p || tm > p.time) prev.set(x.tenant_id, { time: tm, amt });
        }
      });

      const ids = new Set<string>([...cur.keys(), ...prev.keys()]);
      let priorMRR = 0, currentMRR = 0, newMRR = 0, expansion = 0, contraction = 0, churnedMRR = 0;
      let priorLogos = 0, churnedLogos = 0;
      const decliners: { name: string; lost: number; type: 'ดาวน์เกรด' | 'เลิกใช้' }[] = [];
      ids.forEach((id) => {
        const c = activeIds.has(id) ? (cur.get(id)?.amt || 0) : 0;   // inactive tenant ⇒ MRR now = 0 (churned)
        const p = prev.get(id)?.amt || 0;
        currentMRR += c; priorMRR += p;
        if (p > 0) priorLogos += 1;
        if (p > 0 && c > 0) {
          if (c > p) expansion += c - p;
          else if (c < p) { contraction += p - c; decliners.push({ name: nameMap.get(id) || '—', lost: p - c, type: 'ดาวน์เกรด' }); }
        } else if (p > 0 && c === 0) { churnedMRR += p; churnedLogos += 1; decliners.push({ name: nameMap.get(id) || '—', lost: p, type: 'เลิกใช้' }); }
        else if (p === 0 && c > 0) { newMRR += c; }
      });
      decliners.sort((a, b) => b.lost - a.lost);

      const activeCount = activeIds.size;
      const arpa = activeCount > 0 ? currentMRR / activeCount : 0;
      const monthlyLogoChurn = priorLogos > 0 ? churnedLogos / priorLogos : null;

      setD({
        priorMRR, currentMRR, newMRR, expansion, contraction, churnedMRR,
        nrr: priorMRR > 0 ? ((priorMRR + expansion - contraction - churnedMRR) / priorMRR) * 100 : null,
        grr: priorMRR > 0 ? ((priorMRR - contraction - churnedMRR) / priorMRR) * 100 : null,
        revenueChurn: priorMRR > 0 ? ((contraction + churnedMRR) / priorMRR) * 100 : null,
        activeCount, arpa,
        monthlyLogoChurn,
        ltv: monthlyLogoChurn && monthlyLogoChurn > 0 ? arpa / monthlyLogoChurn : null,
        decliners,
      });
    } catch (e) {
      console.error('RevenueHealthSection fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const editAcqSpend = () => {
    const cur = acqSpend != null ? String(acqSpend) : '';
    const input = window.prompt('งบที่ใช้หาลูกค้าทั้งหมด (สะสม) — ค่าการตลาด + ค่าเซลส์ (บาท)', cur);
    if (input == null) return;
    const n = Number(input.replace(/[,\s]/g, ''));
    if (!Number.isFinite(n) || n < 0) return;
    window.localStorage.setItem('owner_acq_spend', String(n));
    setAcqSpend(n);
  };

  const cac = acqSpend != null && totalTenants > 0 ? acqSpend / totalTenants : null;
  const ltvCac = d?.ltv != null && cac && cac > 0 ? d.ltv / cac : null;
  const paybackMonths = cac != null && d && d.arpa > 0 ? cac / d.arpa : null;

  const movement = useMemo(() => d ? [
    { name: 'ลูกค้าใหม่', v: d.newMRR, c: KK.green },
    { name: 'อัปเกรด', v: d.expansion, c: KK.green },
    { name: 'ดาวน์เกรด', v: -d.contraction, c: KK.amber },
    { name: 'เลิกใช้', v: -d.churnedMRR, c: KK.red },
  ] : [], [d]);

  const pctColor = (v: number | null, goodHigh = true) => v == null ? KK.gray : (goodHigh ? (v >= 100 ? KK.green : KK.amber) : (v <= 5 ? KK.green : KK.red));
  const fmtPct = (v: number | null) => v == null ? '—' : `${Math.round(v)}%`;

  const Kpi = ({ title, value, sub, color, icon: Icon, bg, onEdit }: {
    title: string; value: string; sub?: string; color: string; icon: any; bg: string; onEdit?: () => void;
  }) => (
    <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-soft">
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium text-gray-500 pt-1.5">{title}</p>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: bg }}>
          <Icon className="w-5 h-5" style={{ color }} strokeWidth={2.2} />
        </div>
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-gray-900 leading-none tabular-nums">{value}</p>
        {onEdit && <button onClick={onEdit} className="text-gray-400 hover:text-gray-700 mb-0.5"><Pencil className="w-3.5 h-3.5" /></button>}
      </div>
      {sub && <p className="text-sm text-gray-400 mt-2.5">{sub}</p>}
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-12 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
        <p className="text-sm text-gray-500">กำลังคำนวณสุขภาพรายได้...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border px-4 py-2.5 text-xs flex items-center gap-2" style={{ color: KK.blue, backgroundColor: KK.blueLight, borderColor: '#bfdbfe' }}>
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        คำนวณจาก <span className="font-semibold">invoice จริง</span> (เทียบ MRR เดือนนี้ vs เดือนก่อน) · ค่าจะนิ่งขึ้นเมื่อมี billing หลายเดือน · "—" = ยังไม่มีฐานเทียบ
      </div>

      {/* Retention row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi title="NRR (รายได้คงเหลือสุทธิ)" value={fmtPct(d?.nrr ?? null)} sub="≥ 100% = โตจากลูกค้าเดิม" color={pctColor(d?.nrr ?? null)} bg={KK.greenLight} icon={RefreshCw} />
        <Kpi title="GRR (คงเหลือขั้นต่ำ)" value={fmtPct(d?.grr ?? null)} sub="ไม่รวมการอัปเกรด" color={pctColor(d?.grr ?? null)} bg={KK.blueLight} icon={TrendingUp} />
        <Kpi title="Revenue Churn" value={fmtPct(d?.revenueChurn ?? null)} sub="รายได้ที่หาย ÷ เดือนก่อน" color={pctColor(d?.revenueChurn ?? null, false)} bg={KK.redLight} icon={TrendingDown} />
        <Kpi title="MRR ปัจจุบัน" value={fmtCompact(d?.currentMRR ?? 0)} sub={`จาก ${d?.activeCount ?? 0} บริษัทที่ใช้งาน`} color={KK.blue} bg={KK.blueLight} icon={Wallet} />
      </div>

      {/* MRR movement */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
        <div className="mb-1">
          <h2 className="text-base font-bold text-gray-900">การเคลื่อนไหวของ MRR (เดือนนี้)</h2>
          <p className="text-xs text-gray-500 mt-0.5">รายได้เพิ่ม (เขียว) จากลูกค้าใหม่+อัปเกรด · รายได้ลด (แดง) จากดาวน์เกรด+เลิกใช้ — ตอบ "ทำไมรายได้ขยับ"</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm mb-3">
          <span className="text-gray-500">เดือนก่อน <span className="font-semibold text-gray-800 tabular-nums">{fmtCompact(d?.priorMRR ?? 0)}</span></span>
          <span className="text-gray-300">→</span>
          <span className="text-gray-500">ปัจจุบัน <span className="font-semibold text-gray-800 tabular-nums">{fmtCompact(d?.currentMRR ?? 0)}</span></span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={movement} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(Number(v))} />
            <Tooltip contentStyle={kkTooltipStyle} formatter={((v: any) => [fmtCompact(Number(v)), '']) as any} cursor={{ fill: 'rgba(0,0,0,0.03)' }} />
            <ReferenceLine y={0} stroke="#d1d5db" />
            <Bar dataKey="v" radius={[5, 5, 0, 0]} maxBarSize={56}>
              {movement.map((m, i) => <Cell key={i} fill={m.c} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Who caused the drop — derived list of downgraded/churned tenants this month */}
      {d && (
        <div className="bg-white border border-gray-100 rounded-2xl shadow-soft p-5">
          <div className="mb-3">
            <h2 className="text-base font-bold text-gray-900">ตัวการที่ทำให้รายได้ลด (เดือนนี้)</h2>
            <p className="text-xs text-gray-500 mt-0.5">บริษัทที่ดาวน์เกรดหรือเลิกใช้ · เรียงตามเงินที่หาย — ตอบ "ใครทำให้รายได้ดิ่ง"</p>
          </div>
          {d.decliners.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">🎉 เดือนนี้ไม่มีบริษัทที่ทำให้รายได้ลด</p>
          ) : (
            <div className="space-y-1">
              {d.decliners.map((x, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-100 last:border-0">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ color: KK.red, backgroundColor: KK.redLight }}>{i + 1}</span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{x.name}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md flex-shrink-0" style={x.type === 'เลิกใช้' ? { color: KK.red, backgroundColor: KK.redLight } : { color: KK.amber, backgroundColor: KK.amberLight }}>{x.type}</span>
                  <span className="text-sm font-bold tabular-nums w-24 text-right flex-shrink-0" style={{ color: KK.red }}>−{fmtCompact(x.lost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Unit economics row */}
      <div>
        <h2 className="text-base font-bold text-gray-900 mb-1">เศรษฐศาสตร์ต่อลูกค้า (Unit Economics)</h2>
        <p className="text-xs text-gray-500 mb-3">CAC กรอกเอง (ต้นทุนหาลูกค้าไม่อยู่ใน DB) · ที่เหลือคำนวณต่อจากรายได้จริง</p>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Kpi title="ARPA (รายได้/บริษัท/เดือน)" value={fmtCompact(d?.arpa ?? 0)} sub="เฉลี่ยต่อบริษัทที่ใช้งาน" color={KK.blue} bg={KK.blueLight} icon={Users} />
          <Kpi title="LTV (มูลค่าตลอดอายุ)" value={d?.ltv != null ? fmtCompact(d.ltv) : '—'} sub={d?.ltv == null ? 'churn 0 → คำนวณยังไม่ได้' : 'ARPA ÷ churn'} color={KK.green} bg={KK.greenLight} icon={TrendingUp} />
          <Kpi title="CAC (ต้นทุนหาลูกค้า)" value={cac != null ? fmtCompact(cac) : 'ตั้งค่า'} sub={cac != null ? `งบ ${fmtCompact(acqSpend!)} ÷ ${totalTenants} บริษัท` : 'กดดินสอเพื่อกรอกงบ'} color={KK.purple} bg={KK.purpleLight} icon={Wallet} onEdit={editAcqSpend} />
          <Kpi title="LTV : CAC" value={ltvCac != null ? `${ltvCac.toFixed(1)} : 1` : '—'} sub="ควร > 3 : 1" color={ltvCac != null && ltvCac >= 3 ? KK.green : KK.amber} bg={KK.amberLight} icon={Percent} />
          <Kpi title="CAC Payback" value={paybackMonths != null ? `${Math.round(paybackMonths)} เดือน` : '—'} sub="คืนทุนค่าหาลูกค้า · ควร < 12" color={paybackMonths != null && paybackMonths <= 12 ? KK.green : KK.amber} bg={KK.greenLight} icon={RefreshCw} />
        </div>
      </div>
    </div>
  );
};

export default RevenueHealthSection;
