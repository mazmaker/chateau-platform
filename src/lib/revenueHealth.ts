// Single source of truth for SaaS revenue-retention metrics, derived from the
// real `invoices` table (each tenant's paid-invoice amount over time = their MRR
// history): NRR / GRR / Revenue Churn / MRR movement (new/expansion/contraction/
// churned). Used by Payments › สุขภาพรายได้ (full view) AND the Executive
// Dashboard (headline summary) so both report the SAME numbers — no duplicated,
// drifting logic.
//
// NOTE on MRR basis: `currentMRR` here is BILLED MRR (sum of each active tenant's
// latest paid invoice). This is the correct basis for retention/movement (it
// reflects money actually invoiced over time). It is intentionally DIFFERENT from
// the committed-MRR run-rate (see committedMRR in ./mrr), which also counts active
// tenants not yet invoiced at list price. Label billed MRR as "ออกบิลแล้ว/เก็บได้",
// never plain "MRR", to avoid confusion with the committed run-rate.

export interface TenantLite { id: string; status: string; name: string }
export interface PaidInvoiceLite { tenant_id: string; amount: number; paid_at: string | null; created_at: string }

export interface RevenueHealth {
  priorMRR: number; currentMRR: number;
  newMRR: number; expansion: number; contraction: number; churnedMRR: number;
  nrr: number | null; grr: number | null; revenueChurn: number | null;
  activeCount: number; arpa: number;
  monthlyLogoChurn: number | null; ltv: number | null;
  decliners: { name: string; lost: number; type: 'ดาวน์เกรด' | 'เลิกใช้' }[];
}

export function computeRevenueHealth(
  tenants: TenantLite[],
  paidInvoices: PaidInvoiceLite[],
  referenceDate?: Date,
): RevenueHealth {
  const activeIds = new Set(tenants.filter((t) => t.status === 'active').map((t) => t.id));
  const nameMap = new Map(tenants.map((t) => [t.id, t.name]));

  const ref = referenceDate || new Date();
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
  const now = new Date();
  const isCurrentMonth = ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth();
  const invTime = (x: PaidInvoiceLite) => new Date(x.paid_at || x.created_at).getTime();

  // Per-tenant current MRR (latest paid invoice ≤ monthEnd) and prior MRR (latest before monthStart).
  const cur = new Map<string, { time: number; amt: number }>();
  const prev = new Map<string, { time: number; amt: number }>();
  paidInvoices.forEach((x) => {
    const tm = invTime(x); const amt = Number(x.amount) || 0;
    if (tm > monthEnd.getTime()) return; // exclude invoices after selected month
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
    // Current month: respect activeIds (cancelled tenant = churned even if has old invoices).
    // Historical month: use invoice presence to infer activity at that point in time.
    const c = isCurrentMonth
      ? (activeIds.has(id) ? (cur.get(id)?.amt || 0) : 0)
      : (cur.get(id)?.amt || 0);
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

  return {
    priorMRR, currentMRR, newMRR, expansion, contraction, churnedMRR,
    nrr: priorMRR > 0 ? ((priorMRR + expansion - contraction - churnedMRR) / priorMRR) * 100 : null,
    grr: priorMRR > 0 ? ((priorMRR - contraction - churnedMRR) / priorMRR) * 100 : null,
    revenueChurn: priorMRR > 0 ? ((contraction + churnedMRR) / priorMRR) * 100 : null,
    activeCount, arpa,
    monthlyLogoChurn,
    ltv: monthlyLogoChurn && monthlyLogoChurn > 0 ? arpa / monthlyLogoChurn : null,
    decliners,
  };
}
