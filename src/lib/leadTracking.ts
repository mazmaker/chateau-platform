// Lead counter tracking — increments tracking fields on the current customer's leads.
// Used by Customer Portal to record real engagement signals that feed the ML scoring model.
// Silently no-ops if the visitor is anonymous or has no lead matching the context.

import { supabase } from './supabase';

type TrackableField = 'brochure_downloads' | 'pages_viewed' | 'website_visits' | 'interaction_count';

interface IncrementOptions {
  field: TrackableField;
  /** Restrict to lead(s) for this property. Omit to update ALL of the customer's leads. */
  propertyId?: string | null;
  /** How much to add. Default 1. */
  by?: number;
}

/**
 * Increment a tracking counter on the logged-in customer's lead(s).
 * Returns the number of leads updated (0 if no auth / no matching lead).
 */
export async function incrementLeadCounter(opts: IncrementOptions): Promise<number> {
  const { field, propertyId, by = 1 } = opts;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer } = await (supabase.from('customers') as any)
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!customer?.id) return 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from('leads') as any)
      .select(`id, ${field}`)
      .eq('customer_id', customer.id);
    if (propertyId) q = q.eq('property_id', propertyId);

    const { data: leads } = await q;
    if (!leads || leads.length === 0) return 0;

    let updated = 0;
    for (const lead of leads) {
      const next = (Number(lead[field]) || 0) + by;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from('leads') as any)
        .update({ [field]: next })
        .eq('id', lead.id);
      if (!error) updated++;
    }
    return updated;
  } catch {
    return 0; // never throw — tracking must not break UX
  }
}

/**
 * Track a unique website visit per session per customer.
 * Uses sessionStorage so reloads in same tab don't double-count.
 */
export async function trackWebsiteVisitOncePerSession(): Promise<void> {
  const KEY = 'chateau_visit_tracked';
  try {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem(KEY)) return;
    sessionStorage.setItem(KEY, '1');
    await incrementLeadCounter({ field: 'website_visits' });
  } catch {
    // ignore
  }
}
