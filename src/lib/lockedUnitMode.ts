// Locked-to-unit mode.
//
// When a customer arrives via an agent's per-unit referral link
// (e.g. /customer/units/<id>?ref=AG-2026-001) we trap them on that one unit so
// they can't navigate to other projects/units the referring agent doesn't service.
// The lock lives in sessionStorage (matches `chateau_ref_code` lifetime) and is
// cleared on customer login — once attribution is locked into a lead in the DB,
// the returning customer is free to browse the whole catalog normally.

const LOCK_KEY = 'chateau_locked_unit_id';

export function setLockedUnit(unitId: string): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.setItem(LOCK_KEY, unitId); } catch { /* private mode */ }
}

export function getLockedUnit(): string | null {
  if (typeof window === 'undefined') return null;
  try { return sessionStorage.getItem(LOCK_KEY); } catch { return null; }
}

export function clearLockedUnit(): void {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(LOCK_KEY); } catch { /* ignore */ }
}

// Convenience: capture the lock from the current URL if it matches the
// /customer/units/:id pattern AND carries ?ref=. Call BEFORE
// captureReferralFromUrl() strips the query string.
export function captureLockedUnitFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.get('ref')) return null;
  const match = window.location.pathname.match(/^\/customer\/units\/([^/?#]+)/);
  if (!match) return null;
  const unitId = match[1];
  setLockedUnit(unitId);
  return unitId;
}
