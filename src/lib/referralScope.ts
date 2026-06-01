// Referral browsing scope.
//
// When a customer arrives via an agent referral link (?ref=AG-YYYY-NNN), the portal
// should only show the units that agent actually services — so every lead the agent
// receives is one they can hold/handle. This resolves the stored ref code to that
// agent's active unit-id set via the `referral_agent_unit_ids` SECURITY DEFINER RPC
// (customers can't read agent_unit_assignments directly under RLS).
//
// Returns null when there is NO active referral → callers must then show everything
// as normal (a null scope means "no restriction", an empty Set means "show nothing").

import { supabase } from '@/lib/supabase';
import { getStoredReferralCode } from '@/lib/referralCode';

const CACHE_KEY = 'chateau_ref_unit_ids';

export async function getReferralUnitScope(): Promise<Set<string> | null> {
  const code = getStoredReferralCode();
  if (!code) return null;

  // Session cache — avoid re-hitting the RPC on every page within the same referral.
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached) as { code: string; ids: string[] };
      if (parsed.code === code && Array.isArray(parsed.ids)) return new Set(parsed.ids);
    }
  } catch { /* ignore malformed cache */ }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('referral_agent_unit_ids', { p_code: code });
  // On error, fail open (null = no restriction) so a transient RPC failure never
  // leaves the customer staring at an empty catalog.
  if (error) return null;
  const ids: string[] = Array.isArray(data) ? (data as string[]) : [];
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ code, ids })); } catch { /* ignore */ }
  return new Set(ids);
}
