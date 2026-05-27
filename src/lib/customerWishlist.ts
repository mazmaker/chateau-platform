// Customer Wishlist — single source of truth for "saved units".
// Syncs localStorage (fast offline reads) with lead_interests (DB, Sales-visible).
//
// Design (Option A — industry-standard, Sansiri/AP/DDproperty style):
// - Customer saves a unit → entry exists in BOTH localStorage AND lead_interests
// - Sales sees every saved unit (potential lead) → low-priority by default
// - Customer scheduling a visit → updates same row to status='viewing_scheduled', interest_level='high'
import { supabase } from './supabase';

const STORAGE_KEY = 'customer_wishlist';
const EVENT = 'wishlist:changed';

export function getWishlistIds(): string[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function setWishlistIds(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event(EVENT));
}

// Silent variant — updates localStorage without dispatching the change event.
// Used when the caller wants to coordinate the event with a downstream DB write
// (e.g. removeFromWishlist needs the DB row marked 'dropped' BEFORE listeners
// reload, otherwise they read stale 'interested' rows and the unit reappears).
function setWishlistIdsSilent(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function isInWishlist(unitId: string): boolean {
  return getWishlistIds().includes(unitId);
}

/**
 * Ensure a `leads` row exists for this customer + tenant.
 * Auto-creates one with `source='customer_self'` if missing.
 * Returns lead id, or null if customer not found / not authenticated.
 */
async function ensureLead(unit: { id: string; tenant_id: string; project_id?: string | null }): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customer } = await (supabase.from('customers') as any)
    .select('id').eq('auth_user_id', user.id).maybeSingle();
  if (!customer) return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase.from('leads') as any)
    .select('id').eq('customer_id', (customer as any).id).eq('tenant_id', unit.tenant_id).maybeSingle();
  if (existing) return (existing as any).id;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: newLead, error } = await (supabase.from('leads') as any)
    .insert({
      tenant_id: unit.tenant_id,
      customer_id: (customer as any).id,
      property_id: unit.project_id,
      unit_id: unit.id,
      status: 'new',
      source: 'customer_self',
      priority: 'medium',
      notes: 'ลูกค้าบันทึกยูนิตเข้ารายการที่สนใจ',
    }).select('id').single();
  if (error) { console.error('ensureLead error:', error); return null; }
  return (newLead as any).id;
}

/**
 * Save a unit to wishlist — writes to localStorage AND upserts lead_interests.
 * Silent — does not toast. Caller handles UI feedback.
 */
export async function addToWishlist(unit: { id: string; tenant_id: string; project_id?: string | null }): Promise<void> {
  // localStorage first for instant UI feedback (heart fills in immediately).
  const ids = getWishlistIds();
  if (!ids.includes(unit.id)) setWishlistIds([...ids, unit.id]);

  // DB sync — three cases:
  //   1) No existing row    → insert fresh with status='interested', level='low'
  //   2) Existing 'dropped' → resurrect to 'interested' (customer re-hearting is a
  //                            deliberate re-engagement signal; respect it). The
  //                            old "deliberately do NOT resurrect" rule confused
  //                            customers — they'd click heart, the UI would show
  //                            "นำออกจากรายการแล้ว", and they had no idea why.
  //   3) Existing 'interested' or later → no-op (already in the wishlist).
  try {
    const leadId = await ensureLead(unit);
    if (!leadId) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (supabase.from('lead_interests') as any)
      .select('id, status').eq('lead_id', leadId).eq('unit_id', unit.id).maybeSingle();
    if (!existing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('lead_interests') as any).insert({
        tenant_id: unit.tenant_id,
        lead_id: leadId,
        property_id: unit.project_id,
        unit_id: unit.id,
        status: 'interested',
        interest_level: 'low',
        notes: 'บันทึกไว้ดูทีหลัง (heart) จาก Customer Portal',
      });
    } else if ((existing as any).status === 'dropped' || (existing as any).status === 'lost') {
      // Resurrect — keep the same row (preserves audit trail / created_at) but
      // flip status + level back to a fresh bookmark.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('lead_interests') as any)
        .update({
          status: 'interested',
          interest_level: 'low',
          notes: 'บันทึกไว้ดูทีหลัง (heart) — ลูกค้ากลับมาบันทึกอีกครั้งจาก Customer Portal',
          updated_at: new Date().toISOString(),
        })
        .eq('id', (existing as any).id);
    }
  } catch (e) {
    console.error('addToWishlist DB sync error:', e);
  }
}

/**
 * Remove a unit from wishlist — removes from localStorage AND marks
 * lead_interest as `dropped` (preserves history; doesn't hard-delete).
 */
export async function removeFromWishlist(unitId: string): Promise<void> {
  // 1. localStorage — silent update. We deliberately do NOT fire 'wishlist:changed'
  // here, because the CustomerDashboard listener reloads from BOTH localStorage AND
  // DB; firing now would race the DB write below and re-pull the still-'interested'
  // row, causing the unit to flicker back into the bookmark list. Fire the event at
  // the very end so listeners observe the consistent post-write state.
  const ids = getWishlistIds().filter((x) => x !== unitId);
  setWishlistIdsSilent(ids);

  // 2. DB — soft-delete (status='dropped'), only for passive bookmarks (low/medium).
  // High-intent rows (customer pressed "ฉันสนใจยูนิตนี้") stay 'interested' because
  // Sales has already been notified and is expecting follow-up; un-tapping the heart
  // shouldn't silently cancel that.
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: customer } = await (supabase.from('customers') as any)
      .select('id').eq('auth_user_id', user.id).maybeSingle();
    if (!customer) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: leads } = await (supabase.from('leads') as any)
      .select('id').eq('customer_id', (customer as any).id);
    const leadIds = ((leads as any[]) || []).map((l: any) => l.id);
    if (leadIds.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('lead_interests') as any)
      .update({ status: 'dropped', updated_at: new Date().toISOString() })
      .in('lead_id', leadIds)
      .eq('unit_id', unitId)
      .eq('status', 'interested')
      .in('interest_level', ['low', 'medium']);
  } catch (e) {
    console.error('removeFromWishlist DB sync error:', e);
  } finally {
    // 3. Now that DB is in sync (or the write failed and we're at least localStorage-only
    // clean), notify listeners. A single dispatch at the end avoids the flicker bug.
    window.dispatchEvent(new Event(EVENT));
  }
}

/**
 * Toggle helper — adds if missing, removes if present.
 * Returns the new state (true = saved, false = removed).
 */
export async function toggleWishlist(unit: { id: string; tenant_id: string; project_id?: string | null }): Promise<boolean> {
  const present = isInWishlist(unit.id);
  if (present) {
    await removeFromWishlist(unit.id);
    return false;
  }
  await addToWishlist(unit);
  return true;
}
