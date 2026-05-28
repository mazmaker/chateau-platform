// Anonymous funnel tracking — record property/unit views without requiring login.
//
// Pairs with table public.property_views (migration 20260519000003).
// visitor_id is a UUID we generate in localStorage on first visit. It survives across
// sessions for the same browser but does not personally identify anyone — it is just
// the smallest signal needed to distinguish "the same anonymous person" from "two
// different people" so we can compute return-visit rates and unique counts.

import { supabase } from '@/lib/supabase';
import { getStoredReferralCode } from '@/lib/referralCode';

const VISITOR_KEY = 'chateau_visitor_id';
const REF_CODE_PATTERN = /^AG-\d{4}-\d{3,}$/;

/**
 * Return the stable visitor UUID for this browser, generating + persisting one
 * on first call. Returns null in SSR/no-window contexts.
 */
export function getOrCreateVisitorId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    // localStorage can throw in private mode — return ephemeral id so tracking
    // still works for this session, just won't dedupe across page loads.
    return crypto.randomUUID();
  }
}

interface TrackArgs {
  tenantId?: string | null;
  propertyId?: string | null;
  unitId?: string | null;
  pagePath: string;
}

interface TrackerHandle {
  /** Call this to flush early (e.g. on route change). Beacon-style fire-and-forget. */
  flush: () => void;
}

/**
 * Start tracking a page visit. Returns a handle whose .flush() records the visit
 * with the duration + max scroll observed so far. The caller is responsible for
 * invoking flush on unmount / route change / beforeunload.
 *
 * Designed so multiple flushes are safe but only the LAST observation is what
 * makes it into the DB (we insert once per call).
 */
export function startViewTracking(args: TrackArgs): TrackerHandle {
  if (typeof window === 'undefined') {
    return { flush: () => {} };
  }

  const startMs = Date.now();
  let maxScrollPct = 0;
  let flushed = false;

  const onScroll = () => {
    const docHeight = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
    );
    const winHeight = window.innerHeight;
    const scrolled = window.scrollY + winHeight;
    const pct = docHeight > 0 ? Math.min(100, Math.round((scrolled / docHeight) * 100)) : 0;
    if (pct > maxScrollPct) maxScrollPct = pct;
  };
  // Initial sample in case content fits entirely above the fold
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const flush = () => {
    if (flushed) return;
    flushed = true;
    window.removeEventListener('scroll', onScroll);

    const visitorId = getOrCreateVisitorId();
    if (!visitorId) return;

    const durationSec = Math.min(86400, Math.round((Date.now() - startMs) / 1000));
    const refCode = getStoredReferralCode();
    const params = new URLSearchParams(window.location.search);

    // Resolve ref_code → ref_agent_id when possible; otherwise leave null and let
    // SQL queries join on ref_code if the agent gets created later.
    void (async () => {
      let refAgentId: string | null = null;
      if (refCode && REF_CODE_PATTERN.test(refCode)) {
        try {
          // Resolve via SECURITY DEFINER RPC — anonymous visitors can't read public.users
          // (RLS), so a direct query always returned null and ref_agent_id never got set.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: agentId } = await (supabase as any).rpc('resolve_referral_agent', {
            p_code: refCode,
            p_tenant_id: args.tenantId ?? null,
          });
          if (agentId) refAgentId = agentId as string;
        } catch {
          // tracking should never throw — degrade silently
        }
      }

      // Attach authed user if logged in (Sales/Admin/Owner browsing also counts).
      let authedUserId: string | null = null;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) authedUserId = user.id;
      } catch {
        // ignore
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('property_views') as any).insert({
          tenant_id: args.tenantId ?? null,
          visitor_id: visitorId,
          ref_code: refCode || null,
          ref_agent_id: refAgentId,
          property_id: args.propertyId ?? null,
          unit_id: args.unitId ?? null,
          page_path: args.pagePath,
          referrer: document.referrer || null,
          utm_source: params.get('utm_source'),
          utm_medium: params.get('utm_medium'),
          utm_campaign: params.get('utm_campaign'),
          user_agent: navigator.userAgent.slice(0, 500),
          duration_sec: durationSec,
          scroll_depth_pct: maxScrollPct,
          authed_user_id: authedUserId,
        });
      } catch {
        // ignore tracking errors — never block the user experience
      }
    })();
  };

  // Auto-flush on tab close / hide
  const onHide = () => flush();
  window.addEventListener('beforeunload', onHide);
  window.addEventListener('pagehide', onHide);

  // Slight modification of returned flush to also remove listeners
  return {
    flush: () => {
      window.removeEventListener('beforeunload', onHide);
      window.removeEventListener('pagehide', onHide);
      flush();
    },
  };
}
