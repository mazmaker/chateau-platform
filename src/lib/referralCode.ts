// Agent referral code capture + persistence (silent attribution).
//
// Pattern: the customer arrives via a URL like /customer/units/A-101?ref=AG-2026-001.
// We capture the code into sessionStorage on the first page they land on, then strip
// it from the URL so it doesn't leak via copy-paste or social sharing. The code
// survives until the tab closes, and is read back when the customer creates their
// first lead — at which point we lock it onto leads.referred_by_agent_id (immutable
// per the DB trigger).
//
// Why sessionStorage (not localStorage):
//   - localStorage would persist across tabs/days and could mis-attribute future
//     organic visits to an old Agent.
//   - sessionStorage scopes the attribution to *this browsing session*, matching the
//     intent of "this visit came from this Agent's link."
//
// Why strip the URL afterwards:
//   - Cleaner share-back (customer shares the URL with a friend → friend doesn't
//     accidentally inherit the Agent attribution).
//   - Avoids the URL "advertising" that there's a referral involved.

const STORAGE_KEY = 'chateau_ref_code';

const REF_CODE_PATTERN = /^AG-\d{4}-\d{3,}$/;

/**
 * Read `?ref=` from the current URL, store in sessionStorage if valid, and strip
 * from the address bar. Safe to call multiple times — only acts on the first
 * arrival that carries a ref param.
 */
export function captureReferralFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const raw = params.get('ref');
  if (!raw) return getStoredReferralCode();

  // Validate before storing — drops noise like ?ref=undefined or tampered values.
  if (!REF_CODE_PATTERN.test(raw)) return getStoredReferralCode();

  try {
    sessionStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // sessionStorage can throw in private mode / quota exceeded — degrade silently.
  }

  // Strip ?ref= from URL without a navigation.
  params.delete('ref');
  const newSearch = params.toString();
  const newUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
  window.history.replaceState({}, '', newUrl);

  return raw;
}

export function getStoredReferralCode(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearStoredReferralCode(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
