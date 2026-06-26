// ──────────────────────────────────────────────────────────────────────────
// Narrative Insight engine — the "auto-analyst" behind the ข้อมูลเชิงลึก page.
//
// ONE engine, fed by the SAME canonical utils every Owner page already uses
// (committedMRR, computeRevenueHealth, tenant-health scoring) so the numbers in
// an insight sentence always match the dashboard/health pages — no drifting copy.
//
// Every insight is framed through the SaaS-owner lens: it must terminate at OUR
// money (MRR / churn / upsell), never stop at a tenant's raw operations. Sales &
// buyer signals enter ONLY as leading indicators tied to revenue/retention.
//
// This is the cross-domain, full version of the Executive Dashboard's Priority
// Action Queue: same idea (tone + title + drill href), but ranked by ฿ impact and
// pulling from revenue + churn + sales-trend + upsell + ops at once.
// ──────────────────────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { committedMRR } from '@/lib/mrr';
import { computeRevenueHealth } from '@/lib/revenueHealth';
import { NEVER_LOGGED_IN, daysSince, computeHealth, toHealthStatus, trialDaysLeft } from '@/lib/tenantHealth';

export type InsightCategory = 'revenue' | 'churn' | 'upsell' | 'ops';
export type InsightSeverity = 'critical' | 'warning' | 'positive' | 'info';

export interface Insight {
  id: string;
  category: InsightCategory;
  severity: InsightSeverity;
  title: string;            // the narrative sentence (so-what + action)
  detail: string;           // supporting context line
  metric?: string;          // optional headline figure (฿ / %)
  impact: number;           // ฿ at stake — used to rank within a severity tier
  href: string;             // drill-down to the source page
  entity?: string;          // specific company, when the insight is about one tenant
}

export interface InsightSummary {
  critical: number;
  warning: number;
  opportunities: number;    // positive upsell/expansion signals
  revenueAtRisk: number;    // ฿ across all churn/revenue critical+warning insights
}

// A chart "pulled" onto the Insights page with an auto-generated caption beneath it.
// The data here is the SAME numbers that feed the action feed, so the caption can
// never drift from the bars/area it describes. Rendered compact + read-only; the
// drill href opens the full interactive chart on its source page.
export interface InsightChartPoint { m?: string; v?: number; name?: string; value?: number; color?: string }
export interface InsightChart {
  id: string;
  title: string;
  kind: 'area' | 'bar' | 'donut';
  data: InsightChartPoint[];
  caption: string;          // the narrative sentence under the chart
  href: string;
  valueFormat: 'thb' | 'count';
  centerLabel?: string;     // donut center number
}

const CHART_C = {
  red: '#ef4444', blue: '#1e3a5f', green: '#16a34a', amber: '#d97706', gray: '#94a3b8',
};
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const PLAN_TH: Record<string, string> = { enterprise: 'Enterprise', professional: 'Professional', starter: 'Starter' };
const PLAN_C: Record<string, string> = { enterprise: CHART_C.red, professional: CHART_C.blue, starter: CHART_C.amber };

// Compact THB — Thai convention "X ล้าน" / "K" (NOT M/B). Copied from the canonical
// formatTHB in Index.tsx per the project rule (reuse the format, copy don't reinvent).
const fmtTHB = (n: number) => {
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

const SEVERITY_WEIGHT: Record<InsightSeverity, number> = { critical: 3, warning: 2, positive: 1, info: 0 };

interface BuildResult { insights: Insight[]; summary: InsightSummary; }

// Pure: turn already-computed per-tenant rows + aggregates into ranked insights.
// Kept separate from the fetch so the rules are easy to read/verify in one place.
function buildInsights(input: {
  totalMRR: number;
  previousMRR: number;
  nrr: number | null;
  grr: number | null;
  revenueChurn: number | null;
  atRiskMRR: number; atRiskCount: number;
  dormantMRR: number; dormantCount: number; dormantNames: string[];
  suspendedPotential: number; suspendedNames: string[];
  trialSoon: { name: string; mrr: number; days: number }[];
  notOnboarded: { name: string; mrr: number }[];
  nearLimit: { name: string; pct: number; mrr: number }[];
  overdue: number; overdueCount: number;
  openTickets: number;
  salesDecline: { name: string; dropPct: number; mrr: number }[];
  salesSurge: { name: string; risePct: number; recentValue: number }[];
}): BuildResult {
  const out: Insight[] = [];
  const push = (i: Insight) => out.push(i);

  // ── REVENUE (direct money) ──────────────────────────────────────────────
  if (input.overdue > 0)
    push({
      id: 'rev-overdue', category: 'revenue', severity: 'critical',
      title: `AR ค้างชำระ ${fmtTHB(input.overdue)} จาก ${input.overdueCount} ใบ — เกินกำหนด เสี่ยงต้องระงับบริการ`,
      detail: 'เร่งติดตามเก็บเงินก่อนกลายเป็นหนี้สูญ / ต้อง suspend',
      metric: fmtTHB(input.overdue), impact: input.overdue, href: '/payments?tab=invoices',
    });

  if (input.previousMRR > 0) {
    const delta = input.totalMRR - input.previousMRR;
    const pct = Math.round((delta / input.previousMRR) * 100);
    if (delta < 0)
      push({
        id: 'rev-mrr-down', category: 'revenue', severity: 'warning',
        title: `MRR ลดลง ${Math.abs(pct)}% เหลือ ${fmtTHB(input.totalMRR)} จากเดือนก่อน`,
        detail: `ฐานรายได้ประจำหดตัว ${fmtTHB(Math.abs(delta))} — ตรวจสอบ downgrade / ยกเลิก`,
        metric: `${pct}%`, impact: Math.abs(delta), href: '/payments?tab=revenue-health',
      });
    else if (pct > 0)
      push({
        id: 'rev-mrr-up', category: 'revenue', severity: 'positive',
        title: `MRR โต ${pct}% เป็น ${fmtTHB(input.totalMRR)} จากเดือนก่อน`,
        detail: `ฐานรายได้ประจำเพิ่ม ${fmtTHB(delta)} — โมเมนตัมดี`,
        metric: `+${pct}%`, impact: delta, href: '/payments?tab=revenue-health',
      });
  }

  if (input.nrr != null) {
    const nrr = Math.round(input.nrr);
    if (nrr < 100)
      push({
        id: 'rev-nrr', category: 'revenue', severity: nrr < 90 ? 'critical' : 'warning',
        title: `NRR ${nrr}% — รายได้จากผู้เช่าเดิมหดตัวสุทธิ (ต่ำกว่า 100%)`,
        detail: `Revenue churn ${Math.round(input.revenueChurn ?? 0)}%/เดือน · expansion ยังไม่ชดเชยการสูญเสีย`,
        metric: `${nrr}%`, impact: input.atRiskMRR || input.dormantMRR, href: '/payments?tab=revenue-health',
      });
    else
      push({
        id: 'rev-nrr', category: 'revenue', severity: 'positive',
        title: `NRR ${nrr}% — ฐานผู้เช่าเดิมเติบโตสุทธิ (มากกว่า 100%)`,
        detail: 'expansion มากกว่าการสูญเสีย — สุขภาพรายได้แข็งแรง',
        metric: `${nrr}%`, impact: 0, href: '/payments?tab=revenue-health',
      });
  }

  if (input.atRiskMRR > 0) {
    const pct = input.totalMRR > 0 ? Math.round((input.atRiskMRR / input.totalMRR) * 100) : 0;
    push({
      id: 'rev-at-risk', category: 'revenue', severity: 'warning',
      title: `รายได้เสี่ยง ${fmtTHB(input.atRiskMRR)} จาก ${input.atRiskCount} บริษัทที่เริ่มห่างหาย`,
      detail: `คิดเป็น ${pct}% ของ MRR รวม — เข้าหา CS ก่อนลามเป็น churn`,
      metric: fmtTHB(input.atRiskMRR), impact: input.atRiskMRR, href: '/owner-health',
    });
  }

  // ── CHURN / RETENTION (leading indicators) ───────────────────────────────
  if (input.dormantCount > 0)
    push({
      id: 'churn-dormant', category: 'churn', severity: 'critical',
      title: `${input.dormantCount} บริษัทไม่เข้าใช้งาน >30 วัน → MRR ${fmtTHB(input.dormantMRR)} เสี่ยงหลุด`,
      detail: input.dormantNames.slice(0, 3).join(', ') + (input.dormantNames.length > 3 ? ` +${input.dormantNames.length - 3}` : ''),
      metric: fmtTHB(input.dormantMRR), impact: input.dormantMRR, href: '/owner-health',
    });

  if (input.suspendedNames.length > 0)
    push({
      id: 'churn-suspended', category: 'churn', severity: 'critical',
      title: `${input.suspendedNames.length} บริษัทถูกระงับบริการ → ติดต่อก่อนยกเลิกถาวร`,
      detail: input.suspendedNames.slice(0, 3).join(', ') + (input.suspendedNames.length > 3 ? ` +${input.suspendedNames.length - 3}` : ''),
      metric: fmtTHB(input.suspendedPotential), impact: input.suspendedPotential, href: '/owner-health',
    });

  input.salesDecline.forEach((d, i) =>
    push({
      id: `churn-sales-${i}`, category: 'churn', severity: 'warning',
      title: `${d.name} ยอดขายตก ${d.dropPct}% เทียบ 3 เดือนก่อน → เริ่มไม่เห็นผลจากระบบ`,
      detail: `สัญญาณนำของ churn · MRR ${fmtTHB(d.mrr)} ที่เกี่ยวข้อง — จับตาใกล้ชิด`,
      metric: `-${d.dropPct}%`, impact: d.mrr, href: '/owner-companies', entity: d.name,
    })
  );

  if (input.trialSoon.length > 0) {
    const potMRR = input.trialSoon.reduce((s, t) => s + t.mrr, 0);
    push({
      id: 'churn-trial', category: 'churn', severity: 'warning',
      title: `${input.trialSoon.length} บริษัท Trial หมดใน 7 วัน → ปิดการขายก่อนหลุด`,
      detail: input.trialSoon.slice(0, 3).map(t => `${t.name} (${t.days} วัน)`).join(', '),
      metric: fmtTHB(potMRR), impact: potMRR, href: '/payments?tab=calendar',
    });
  }

  input.notOnboarded.forEach((t, i) =>
    push({
      id: `churn-onboard-${i}`, category: 'churn', severity: 'warning',
      title: `${t.name} สมัครแล้วแต่ยังไม่สร้างโครงการ → onboarding เสี่ยงล้มเหลว`,
      detail: `ลูกค้าที่ไม่เริ่มใช้ = แทบไม่ต่อสัญญา · MRR ${fmtTHB(t.mrr)} เสี่ยง — ช่วย onboard ด่วน`,
      metric: fmtTHB(t.mrr), impact: t.mrr, href: '/owner-projects', entity: t.name,
    })
  );

  // ── UPSELL / EXPANSION (opportunity) ─────────────────────────────────────
  input.nearLimit.forEach((t, i) =>
    push({
      id: `upsell-quota-${i}`, category: 'upsell', severity: 'positive',
      title: `${t.name} ใช้โควตาพนักงาน ${t.pct}% → เสนออัปเกรดแพ็กเกจ`,
      detail: `ใกล้ชนเพดาน seat · โอกาส Expansion Revenue · MRR ปัจจุบัน ${fmtTHB(t.mrr)}`,
      metric: `${t.pct}%`, impact: t.mrr, href: '/tenants', entity: t.name,
    })
  );

  input.salesSurge.forEach((d, i) =>
    push({
      id: `upsell-surge-${i}`, category: 'upsell', severity: 'positive',
      title: `${d.name} ยอดขายพุ่ง ${d.risePct}% เทียบ 3 เดือนก่อน → ลูกค้าโตเร็ว`,
      detail: `ขายได้ ${fmtTHB(d.recentValue)} ใน 3 เดือนล่าสุด · candidate upsell / case study`,
      metric: `+${d.risePct}%`, impact: d.recentValue, href: '/owner-companies', entity: d.name,
    })
  );

  // ── OPS ──────────────────────────────────────────────────────────────────
  if (input.openTickets > 0)
    push({
      id: 'ops-tickets', category: 'ops', severity: 'warning',
      title: `Support ค้าง ${input.openTickets} เคส → ตอบกลับผู้เช่า`,
      detail: 'ปัญหาที่ค้างนานกระทบความพึงพอใจและ retention',
      metric: `${input.openTickets} เคส`, impact: 0, href: '/owner-support',
    });

  // Rank: severity tier first, then ฿ impact within the tier.
  out.sort((a, b) => {
    const sw = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    return sw !== 0 ? sw : b.impact - a.impact;
  });

  const revenueAtRisk = out
    .filter(i => (i.category === 'churn' || i.category === 'revenue') && (i.severity === 'critical' || i.severity === 'warning'))
    .reduce((s, i) => s + i.impact, 0);

  return {
    insights: out,
    summary: {
      critical: out.filter(i => i.severity === 'critical').length,
      warning: out.filter(i => i.severity === 'warning').length,
      opportunities: out.filter(i => i.category === 'upsell').length,
      revenueAtRisk,
    },
  };
}

const EMPTY_SUMMARY: InsightSummary = { critical: 0, warning: 0, opportunities: 0, revenueAtRisk: 0 };

export function useOwnerInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [summary, setSummary] = useState<InsightSummary>(EMPTY_SUMMARY);
  const [charts, setCharts] = useState<InsightChart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const [
          { data: tenants }, { data: paidInvoices }, { data: openInvoices },
          { data: planRows }, { data: usersList }, { data: properties },
          { data: units }, { data: tickets }, { data: loginRows },
        ] = await Promise.all([
          supabase.from('tenants').select('id, name, subscription_plan, status, trial_ends_at').eq('is_platform' as any, false),
          supabase.from('invoices').select('tenant_id, amount, paid_at, created_at').eq('status', 'paid'),
          (supabase as any).from('invoices').select('tenant_id, amount, status').in('status', ['overdue', 'pending']),
          supabase.from('plans').select('id, price_monthly, max_sales'),
          supabase.from('users').select('id, tenant_id, role'),
          supabase.from('properties').select('id, tenant_id'),
          supabase.from('units').select('tenant_id, price, status, sold_at'),
          (supabase as any).from('support_tickets').select('status'),
          (supabase as any).rpc('owner_users_last_sign_in'),
        ]);

        const tenantList = (tenants || []) as any[];

        // Plan list prices + seat caps (single source — `plans` catalog).
        const planPrices: Record<string, number> = {};
        const planMaxSales: Record<string, number> = {};
        ((planRows || []) as any[]).forEach((p) => {
          planPrices[p.id] = Number(p.price_monthly) || 0;
          planMaxSales[p.id] = Number(p.max_sales) || 0;
        });

        // Latest paid-invoice rate per tenant + rate as of start-of-month (for MoM).
        const firstOfMonth = new Date(); firstOfMonth.setDate(1); firstOfMonth.setHours(0, 0, 0, 0);
        const invTime = (inv: any) => new Date(inv.paid_at || inv.created_at).getTime();
        const latestRate: Record<string, number> = {}; const latestTime: Record<string, number> = {};
        const prevRate: Record<string, number> = {}; const prevTime: Record<string, number> = {};
        ((paidInvoices || []) as any[]).forEach((inv) => {
          if (!inv.tenant_id) return;
          const t = invTime(inv); const amt = Number(inv.amount) || 0;
          if (!(inv.tenant_id in latestTime) || t > latestTime[inv.tenant_id]) { latestTime[inv.tenant_id] = t; latestRate[inv.tenant_id] = amt; }
          if (t < firstOfMonth.getTime() && (!(inv.tenant_id in prevTime) || t > prevTime[inv.tenant_id])) { prevTime[inv.tenant_id] = t; prevRate[inv.tenant_id] = amt; }
        });

        // Per-user last login → most recent login per tenant.
        const loginByUser: Record<string, string> = {};
        ((loginRows || []) as any[]).forEach((r) => { if (r?.last_sign_in_at) loginByUser[r.id] = r.last_sign_in_at; });
        const usersByTenant: Record<string, number> = {};
        const salesByTenant: Record<string, number> = {};
        const lastActiveByTenant: Record<string, string> = {};
        ((usersList || []) as any[]).forEach((u) => {
          if (!u.tenant_id) return;
          usersByTenant[u.tenant_id] = (usersByTenant[u.tenant_id] || 0) + 1;
          if (u.role === 'sales' || u.role === 'agent') salesByTenant[u.tenant_id] = (salesByTenant[u.tenant_id] || 0) + 1;
          const login = loginByUser[u.id];
          if (login && (!lastActiveByTenant[u.tenant_id] || login > lastActiveByTenant[u.tenant_id])) lastActiveByTenant[u.tenant_id] = login;
        });

        const projectsByTenant: Record<string, number> = {};
        ((properties || []) as any[]).forEach((p) => { if (p.tenant_id) projectsByTenant[p.tenant_id] = (projectsByTenant[p.tenant_id] || 0) + 1; });

        // Per-tenant sold-units velocity: last 90 days vs prior 90 days (count + value).
        const now = Date.now();
        const d90 = 90 * 24 * 60 * 60 * 1000;
        const recent: Record<string, { count: number; value: number }> = {};
        const prior: Record<string, { count: number; value: number }> = {};
        ((units || []) as any[]).forEach((u) => {
          if (u.status !== 'sold' || !u.sold_at || !u.tenant_id) return;
          const t = new Date(u.sold_at).getTime(); const price = Number(u.price) || 0;
          if (t >= now - d90) { (recent[u.tenant_id] ||= { count: 0, value: 0 }).count++; recent[u.tenant_id].value += price; }
          else if (t >= now - 2 * d90) { (prior[u.tenant_id] ||= { count: 0, value: 0 }).count++; prior[u.tenant_id].value += price; }
        });

        // Build per-tenant rows (health + MRR), reusing the canonical scorers.
        const nameOf = (t: any) => t.name || t.id;
        let totalMRR = 0, previousMRR = 0;
        let atRiskMRR = 0, atRiskCount = 0, dormantMRR = 0, dormantCount = 0, suspendedPotential = 0;
        const dormantNames: string[] = []; const suspendedNames: string[] = [];
        const trialSoon: { name: string; mrr: number; days: number }[] = [];
        const notOnboarded: { name: string; mrr: number }[] = [];
        const nearLimit: { name: string; pct: number; mrr: number }[] = [];
        const salesDecline: { name: string; dropPct: number; mrr: number }[] = [];
        const salesSurge: { name: string; risePct: number; recentValue: number }[] = [];
        // Chart accumulators (for the annotated "เรื่องเด่นวันนี้" charts).
        const healthMix: Record<string, number> = { healthy: 0, at_risk: 0, dormant: 0, churned: 0 };
        const packageMRR: Record<string, number> = { enterprise: 0, professional: 0, starter: 0 };

        tenantList.forEach((t) => {
          const status = t.status || 'active';
          const plan = t.subscription_plan;
          const mrr = status === 'active' ? committedMRR(latestRate[t.id], plan, planPrices) : 0;
          const planPrice = planPrices[plan || 'free'] || 0;
          totalMRR += mrr;
          if (status === 'active') previousMRR += committedMRR(prevRate[t.id], plan, planPrices);

          const lastDays = lastActiveByTenant[t.id] ? daysSince(lastActiveByTenant[t.id]) : NEVER_LOGGED_IN;
          const score = computeHealth(status, lastDays);
          const hs = status === 'cancelled' ? 'churned' : toHealthStatus(score);
          healthMix[hs] = (healthMix[hs] || 0) + 1;
          if (mrr > 0 && plan in packageMRR) packageMRR[plan] += mrr;

          if (hs === 'at_risk') { atRiskMRR += mrr; atRiskCount++; }
          if (hs === 'dormant' && status !== 'cancelled') { dormantMRR += mrr; dormantCount++; dormantNames.push(nameOf(t)); }
          if (status === 'suspended') { suspendedPotential += planPrice; suspendedNames.push(nameOf(t)); }

          if (status === 'trial') {
            const days = trialDaysLeft(t.trial_ends_at);
            if (days !== null && days >= 0 && days <= 7) trialSoon.push({ name: nameOf(t), mrr: planPrice, days });
          }

          if (status === 'active' && (projectsByTenant[t.id] || 0) === 0)
            notOnboarded.push({ name: nameOf(t), mrr });

          if (status === 'active') {
            const cap = planMaxSales[plan] || 0;
            const used = salesByTenant[t.id] || 0;
            if (cap > 0) { const pct = Math.round((used / cap) * 100); if (pct >= 70) nearLimit.push({ name: nameOf(t), pct, mrr }); }
          }

          // Sales trend (active tenants only) — leading churn/upsell signal.
          if (status === 'active') {
            const r = recent[t.id] || { count: 0, value: 0 };
            const p = prior[t.id] || { count: 0, value: 0 };
            if (p.count >= 2 && r.count < p.count * 0.6)
              salesDecline.push({ name: nameOf(t), dropPct: Math.round((1 - r.count / p.count) * 100), mrr });
            else if (r.count >= 3 && p.count >= 1 && r.count > p.count * 1.5)
              salesSurge.push({ name: nameOf(t), risePct: Math.round((r.count / p.count - 1) * 100), recentValue: r.value });
          }
        });

        // Revenue retention — same util as Dashboard + Payments (single source).
        const rh = computeRevenueHealth(
          tenantList.map((t) => ({ id: t.id, status: t.status, name: nameOf(t) })),
          (paidInvoices || []) as any,
        );

        // AR open invoices.
        let overdue = 0, overdueCount = 0;
        ((openInvoices || []) as any[]).forEach((inv) => { if (inv.status === 'overdue') { overdue += Number(inv.amount) || 0; overdueCount++; } });

        let openTickets = 0;
        ((tickets || []) as any[]).forEach((t) => { if (['open', 'pending', 'in_progress'].includes(t.status)) openTickets++; });

        // Keep per-company lists focused — top 3 by ฿ magnitude (avoid flooding the feed).
        const top = <T extends { mrr?: number; recentValue?: number }>(arr: T[], key: (x: T) => number) =>
          [...arr].sort((a, b) => key(b) - key(a)).slice(0, 3);

        const { insights, summary } = buildInsights({
          totalMRR, previousMRR,
          nrr: rh.nrr, grr: rh.grr, revenueChurn: rh.revenueChurn,
          atRiskMRR, atRiskCount, dormantMRR, dormantCount, dormantNames,
          suspendedPotential, suspendedNames,
          trialSoon, notOnboarded: top(notOnboarded, x => x.mrr),
          nearLimit: top(nearLimit, x => x.mrr),
          overdue, overdueCount, openTickets,
          salesDecline: top(salesDecline, x => x.mrr),
          salesSurge: top(salesSurge, x => x.recentValue),
        });

        // ── Annotated charts ("เรื่องเด่นวันนี้") — same numbers as the feed ──────
        const activeIds = new Set(tenantList.filter((t) => t.status === 'active').map((t) => t.id));
        const nowD = new Date(); const cm = nowD.getMonth(); const cy = nowD.getFullYear();

        // MRR run-rate at each month-end over active tenants (mirrors Executive Dashboard).
        const mrrSeries: InsightChartPoint[] = [];
        for (let i = 11; i >= 0; i--) {
          const mi = (cm - i + 12) % 12; const yr = cm - i < 0 ? cy - 1 : cy;
          const monthEnd = new Date(yr, mi + 1, 0, 23, 59, 59).getTime();
          const rateAt: Record<string, number> = {}; const timeAt: Record<string, number> = {};
          ((paidInvoices || []) as any[]).forEach((inv) => {
            if (!activeIds.has(inv.tenant_id)) return;
            const t = invTime(inv); if (t > monthEnd) return;
            if (!(inv.tenant_id in timeAt) || t > timeAt[inv.tenant_id]) { timeAt[inv.tenant_id] = t; rateAt[inv.tenant_id] = Number(inv.amount) || 0; }
          });
          let v = Object.values(rateAt).reduce((s, a) => s + a, 0);
          if (i === 0 && v < totalMRR) v = totalMRR; // current month → committed run-rate
          mrrSeries.push({ m: TH_MONTHS[mi], v });
        }

        // GMV (sold-unit value) per month, last 6 months.
        const gmvSeries: InsightChartPoint[] = [];
        for (let i = 5; i >= 0; i--) {
          const mi = (cm - i + 12) % 12; const yr = cm - i < 0 ? cy - 1 : cy;
          const ms = new Date(yr, mi, 1).getTime(); const me = new Date(yr, mi + 1, 0, 23, 59, 59).getTime();
          let v = 0;
          ((units || []) as any[]).forEach((u) => {
            if (u.status !== 'sold' || !u.sold_at) return;
            const t = new Date(u.sold_at).getTime(); if (t >= ms && t <= me) v += Number(u.price) || 0;
          });
          gmvSeries.push({ m: TH_MONTHS[mi], v });
        }

        const pct = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 100) : 0);
        const charts: InsightChart[] = [];

        // 1) MRR trend — revenue momentum.
        if (mrrSeries.some((p) => (p.v || 0) > 0)) {
          const last = mrrSeries[11].v || 0; const ago3 = mrrSeries[8].v || 0;
          const dp = pct(last, ago3);
          const topPlan = Object.entries(packageMRR).sort((a, b) => b[1] - a[1])[0];
          charts.push({
            id: 'mrr', title: 'แนวโน้มรายได้ (MRR)', kind: 'area', data: mrrSeries, valueFormat: 'thb',
            href: '/payments?tab=revenue-health',
            caption: ago3 > 0
              ? `MRR ${dp >= 0 ? 'โต' : 'ลด'} ${Math.abs(dp)}% ใน 3 เดือน เป็น ${fmtTHB(last)}${topPlan && topPlan[1] > 0 ? ` · ${PLAN_TH[topPlan[0]]} ครองรายได้สูงสุด` : ''}`
              : `MRR ปัจจุบัน ${fmtTHB(last)} — ฐานรายได้ประจำของแพลตฟอร์ม`,
          });
        }

        // 2) GMV trend — tenants' sales on the platform (leading indicator of product value).
        if (gmvSeries.some((p) => (p.v || 0) > 0)) {
          const sum = gmvSeries.reduce((s, p) => s + (p.v || 0), 0);
          const dp = pct(gmvSeries[5].v || 0, gmvSeries[4].v || 0);
          charts.push({
            id: 'gmv', title: 'ยอดขายบนแพลตฟอร์ม (GMV)', kind: 'area', data: gmvSeries, valueFormat: 'thb',
            href: '/owner-market-overview',
            caption: `ผู้เช่าปิดการขายรวม ${fmtTHB(sum)} ใน 6 เดือน · เดือนล่าสุด ${dp >= 0 ? 'เพิ่ม' : 'ลด'} ${Math.abs(dp)}% — ยิ่งขายดี ยิ่งเหนียว ไม่ churn`,
          });
        }

        // 3) Tenant-health mix — churn-risk distribution.
        const healthData: InsightChartPoint[] = [
          { name: 'ใช้งานอยู่', value: healthMix.healthy, color: CHART_C.green },
          { name: 'เสี่ยงเลิกใช้', value: healthMix.at_risk, color: CHART_C.amber },
          { name: 'ไม่ใช้งาน', value: healthMix.dormant, color: CHART_C.red },
          { name: 'ยกเลิกแล้ว', value: healthMix.churned, color: CHART_C.gray },
        ].filter((d) => (d.value || 0) > 0);
        if (healthData.length > 0) {
          const totalCo = healthData.reduce((s, d) => s + (d.value || 0), 0);
          charts.push({
            id: 'health', title: 'สัดส่วนสุขภาพบริษัท', kind: 'donut', data: healthData, valueFormat: 'count',
            href: '/owner-health', centerLabel: String(totalCo),
            caption: `ใช้งานปกติ ${healthMix.healthy} จาก ${totalCo} บริษัท · เสี่ยงเลิกใช้ ${healthMix.at_risk} · ไม่ใช้งาน ${healthMix.dormant} — โฟกัสกลุ่มเสี่ยงก่อนหลุด`,
          });
        }

        // 4) MRR by package — revenue composition / upsell headroom.
        const pkgData: InsightChartPoint[] = (['enterprise', 'professional', 'starter'] as const)
          .map((p) => ({ m: PLAN_TH[p], v: packageMRR[p], color: PLAN_C[p] }))
          .filter((d) => (d.v || 0) > 0);
        if (pkgData.length > 0) {
          const totalPkg = pkgData.reduce((s, d) => s + (d.v || 0), 0);
          const topPlan = [...pkgData].sort((a, b) => (b.v || 0) - (a.v || 0))[0];
          charts.push({
            id: 'package', title: 'รายได้ตามแพ็กเกจ (MRR)', kind: 'bar', data: pkgData, valueFormat: 'thb',
            href: '/owner-health',
            caption: `${topPlan.m} ครองรายได้ ${totalPkg > 0 ? Math.round(((topPlan.v || 0) / totalPkg) * 100) : 0}% ของ MRR (${fmtTHB(topPlan.v || 0)}) — แพ็กเกจล่างคือพื้นที่ upsell`,
          });
        }

        if (!cancelled) { setInsights(insights); setSummary(summary); setCharts(charts); setLoading(false); }
      } catch (e) {
        console.error('useOwnerInsights error:', e);
        if (!cancelled) { setInsights([]); setSummary(EMPTY_SUMMARY); setCharts([]); setLoading(false); }
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  return { insights, summary, charts, loading };
}
