// Single source of truth for tenant HEALTH scoring — the churn signal every Owner
// page derives from a tenant's last-login recency. Extracted from OwnerTenantHealth
// so the Insights engine (useOwnerInsights) and ภาพรวมผู้เช่า report the SAME
// health status / at-risk population — no drifting copies.
//
// HEALTH_META (labels + colors) stays in the page layer because it is tied to that
// page's KK palette; this lib owns only the pure, color-free scoring logic.

export type HealthStatus = 'healthy' | 'at_risk' | 'dormant' | 'churned';

// "ไม่เคยเข้าใช้" sentinel — separated from a real login that is simply very old,
// so the UI can label the two differently (ไม่เคยเข้าใช้ vs "N วันก่อน").
export const NEVER_LOGGED_IN = 99999;

export const daysSince = (dateStr: string | null | undefined): number => {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
};

// Health score 0–95 from tenant status + days since last login. Measured from the
// most recent login ALONE — the most accurate churn signal we have.
//   ≤14 วัน = ปกติ (healthy) · 15–30 วัน = เริ่มเสี่ยง · >30 วัน = ไม่ใช้งาน
export const computeHealth = (tenantStatus: string, lastLoginDays: number): number => {
  if (tenantStatus === 'cancelled') return 0;
  if (tenantStatus === 'suspended') return 15;
  let score: number;
  if (lastLoginDays <= 3)       score = 95;
  else if (lastLoginDays <= 7)  score = 85;
  else if (lastLoginDays <= 14) score = 72;
  else if (lastLoginDays <= 30) score = 55;
  else if (lastLoginDays <= 60) score = 30;
  else                          score = 15;
  return score;
};

export const toHealthStatus = (score: number): HealthStatus =>
  score >= 70 ? 'healthy' : score >= 40 ? 'at_risk' : 'dormant';

export const trialDaysLeft = (trial_ends_at: string | null): number | null => {
  if (!trial_ends_at) return null;
  return Math.ceil((new Date(trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
};
