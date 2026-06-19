// Single source of truth for MRR so every Owner page reports the SAME number.
//
// Committed monthly recurring revenue for ONE tenant:
//   - prefer the tenant's actual latest paid-invoice rate (captures negotiated /
//     discounted pricing for tenants we've already billed), else
//   - fall back to the plan list price from the `plans` catalog, so an active
//     tenant who simply hasn't been invoiced yet still counts as committed
//     revenue instead of dropping to ฿0.
//
// Platform MRR = sum of committedMRR over ACTIVE tenants. Used by both the
// Executive Dashboard (/owner) and ภาพรวมผู้เช่า (/owner-health). Do NOT
// reintroduce a hardcoded price table — read prices from `plans` and pass the
// map in, so there is no drift when pricing changes.
export const committedMRR = (
  latestPaidRate: number | undefined,
  plan: string | null | undefined,
  planPrices: Record<string, number>,
): number => {
  if (latestPaidRate && latestPaidRate > 0) return latestPaidRate;
  return planPrices[plan || 'free'] || 0;
};
