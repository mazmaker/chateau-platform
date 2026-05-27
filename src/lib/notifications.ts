// In-app notifications helper. Writes to the `notifications` table (per-user
// targeted) so the bell icon in the Header shows only what's relevant to the
// logged-in user. Pair with — don't replace — activity_logs: activity_logs is
// the tenant-wide audit trail; notifications is the per-user inbox.
//
// Design:
//   - user_id NULL = broadcast to all users of the tenant (e.g. unassigned
//     Lead pool — any Sales of the tenant can see + claim).
//   - user_id set = targeted at one specific user.
//   - related_entity_type/id = entity reference for deep linking + claim flow.
//   - data jsonb = whatever extra metadata the UI may need (e.g. previous_status).
//   - All inserts are fire-and-forget: notification failure must never block
//     the underlying action (lead create, booking, etc.).

import { supabase } from './supabase';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

// Activity type the UI maps to its own icon + label (lead_created, lead_assigned, ...).
// Kept as a free-form string so adding a new event doesn't require a DB migration —
// the Header component just falls back to a generic icon for unknown types.
export type NotificationActivityType = string;

export interface CreateNotificationInput {
  /** Tenant scope. Required — RLS enforces it. */
  tenantId: string;
  /** Target user. Pass null/undefined for tenant-wide broadcast (system announcements). */
  userId?: string | null;
  /** Semantic event type — drives icon + label in the UI (e.g. 'lead_created'). */
  activityType: NotificationActivityType;
  /** Short headline shown in the bell dropdown. */
  title: string;
  /** Longer description shown when the row expands. */
  message: string;
  /** Severity controls badge color (info/success/warning/error). Default 'info'. */
  severity?: NotificationSeverity;
  /** Entity reference for deep-linking — e.g. type='lead', id=<leadId>. */
  relatedEntityType?: string;
  relatedEntityId?: string;
  /** Optional explicit URL to navigate to on click (overrides entity-based link). */
  actionUrl?: string;
  /** Button label for actionable notifications (currently unused — pool/claim retired). */
  actionText?: string;
  /** Extra metadata the UI may render (e.g. financial_score, previous_status). */
  data?: Record<string, unknown>;
}

/**
 * Insert a notification. Returns the new row's id on success, or null on failure.
 * Failures are logged to console but never thrown — callers should treat this as
 * best-effort so a failed notification never blocks the user's primary action.
 */
export async function createNotification(input: CreateNotificationInput): Promise<string | null> {
  try {
    const row = {
      tenant_id: input.tenantId,
      user_id: input.userId ?? null,
      type: input.severity ?? 'info',
      title: input.title,
      message: input.message,
      related_entity_type: input.relatedEntityType ?? null,
      related_entity_id: input.relatedEntityId ?? null,
      action_url: input.actionUrl ?? null,
      action_text: input.actionText ?? null,
      data: {
        activity_type: input.activityType,
        ...(input.data ?? {}),
      },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('notifications') as any)
      .insert(row).select('id').single();
    if (error) {
      console.warn('[notifications] insert failed:', error.message);
      return null;
    }
    return (data as any)?.id ?? null;
  } catch (err) {
    console.warn('[notifications] insert threw:', err);
    return null;
  }
}

/**
 * Fan-out helper — send the same notification to multiple users. Used when a
 * single event has several stakeholders (e.g. payment_received → Sales owner +
 * tenant Admin). Returns the array of inserted ids (null entries = failed).
 */
export async function createNotificationsForUsers(
  userIds: Array<string | null>,
  rest: Omit<CreateNotificationInput, 'userId'>,
): Promise<Array<string | null>> {
  // Deduplicate while preserving order — same admin may be passed twice if
  // they're also the lead owner.
  const seen = new Set<string | null>();
  const unique = userIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return Promise.all(unique.map((userId) => createNotification({ ...rest, userId })));
}

/**
 * Look up the user_ids of Admin + Owner roles within a tenant. Used to fan-out
 * tenant-management notifications (e.g. Lead unclaimed pool, large payment).
 */
export async function getTenantAdminUserIds(tenantId: string): Promise<string[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.from('users') as any)
      .select('id')
      .eq('tenant_id', tenantId)
      .in('role', ['admin', 'owner'])
      .eq('is_active', true);
    return ((data as any[]) || []).map((u: any) => u.id).filter(Boolean);
  } catch (err) {
    console.warn('[notifications] getTenantAdminUserIds failed:', err);
    return [];
  }
}

/**
 * Mark a notification as read. Idempotent — calling on an already-read row is a
 * no-op. Errors swallowed.
 */
export async function markNotificationRead(notificationId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('is_read', false); // skip re-write if already read
  } catch (err) {
    console.warn('[notifications] markNotificationRead failed:', err);
  }
}

/**
 * Mark all unread notifications for the current user as read.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('notifications') as any)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);
  } catch (err) {
    console.warn('[notifications] markAllNotificationsRead failed:', err);
  }
}
