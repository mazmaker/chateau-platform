import { supabase } from '@/lib/supabase';

// Auto-release expired reservation holds.
//
// A unit reservation sets status='reserved' + locked_until = now + N days
// (PropertyManagement.handleReserveUnit). There is NO background job, so once
// the timer passes the unit just shows "หมดอายุแล้ว" yet stays 'reserved' —
// silently disappearing from the sellable pool until someone manually cancels.
//
// This returns any expired hold to the available pool (clears the lock + flips
// status), WITHOUT wiping the customer / deposit fields — those stay as dormant
// history (only shown while a unit is actually 'reserved', and overwritten on
// the next reservation), so we don't silently destroy a record of who held it.
//
// Best-effort + RLS-scoped: the UPDATE only touches units the caller may edit;
// for users without update rights it simply affects 0 rows. Call it before
// reading inventory so the fetched units already reflect the release.
export async function releaseExpiredReservations(projectId?: string): Promise<void> {
  let query = supabase
    .from('units')
    .update({ status: 'available', locked_by: null, locked_until: null })
    .eq('status', 'reserved')
    .lt('locked_until', new Date().toISOString());

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { error } = await query;
  if (error) {
    // Non-fatal: inventory still loads, just without the auto-cleanup.
    console.error('releaseExpiredReservations error:', error);
  }
}
