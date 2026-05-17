-- ============================================================================
-- MANUAL BACKFILL SCRIPT — DO NOT PLACE IN migrations/ (would auto-run)
-- ============================================================================
--
-- Heals legacy data where lead_interest.status / leads.status drifted out of
-- sync with bookings.status before the app-level sync logic was added
-- (commits up through 2026-05-15).
--
-- Run instructions:
--   1. Take a backup or run in staging first.
--   2. Review the dry-run SELECT blocks (commented out — uncomment to preview).
--   3. Run in a transaction (BEGIN / COMMIT) so you can ROLLBACK on surprise.
--   4. Idempotent: safe to run multiple times.
--
-- Scenarios fixed:
--   1. Booking confirmed/checked_in/checked_out, but lead_interest stuck at
--      negotiating/viewing_scheduled/viewed/interested → bump to reserved (if
--      booking confirmed) or won (if checked_in/checked_out).
--   2. viewing_date in the past AND lead_interest.status='viewing_scheduled' →
--      promote to 'viewed' + set viewed_at = viewing_date.
--   3. leads.status='won' but no checked_in/checked_out booking exists → revert
--      to 'negotiating' (was set incorrectly by old handleReserveUnit code).
-- ============================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────────────
-- DRY RUN PREVIEW (optional, uncomment to inspect counts before mutating)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT 'scenario_1_to_reserved' AS scenario, COUNT(*) FROM lead_interests li
--   WHERE li.status NOT IN ('reserved','won','lost','dropped')
--     AND EXISTS (SELECT 1 FROM bookings b
--                 WHERE (b.notes->>'unit_id')::uuid = li.unit_id
--                   AND (b.notes->>'lead_id')::uuid = li.lead_id
--                   AND b.status = 'confirmed');
-- SELECT 'scenario_1_to_won' AS scenario, COUNT(*) FROM lead_interests li
--   WHERE li.status <> 'won' AND li.status NOT IN ('lost','dropped')
--     AND EXISTS (SELECT 1 FROM bookings b
--                 WHERE (b.notes->>'unit_id')::uuid = li.unit_id
--                   AND (b.notes->>'lead_id')::uuid = li.lead_id
--                   AND b.status IN ('checked_in','checked_out'));
-- SELECT 'scenario_2_promote_viewed' AS scenario, COUNT(*) FROM lead_interests
--   WHERE status = 'viewing_scheduled' AND viewing_date < NOW();
-- SELECT 'scenario_3_demote_leads' AS scenario, COUNT(*) FROM leads l
--   WHERE l.status = 'won'
--     AND NOT EXISTS (SELECT 1 FROM bookings b
--                     WHERE (b.notes->>'lead_id')::uuid = l.id
--                       AND b.status IN ('checked_in','checked_out'));


-- ──────────────────────────────────────────────────────────────────────────
-- SCENARIO 1a — booking 'confirmed' → lead_interest should be 'reserved'
-- ──────────────────────────────────────────────────────────────────────────
UPDATE lead_interests li
   SET status = 'reserved',
       updated_at = NOW()
  FROM bookings b
 WHERE (b.notes->>'unit_id')::uuid = li.unit_id
   AND (b.notes->>'lead_id')::uuid = li.lead_id
   AND b.status = 'confirmed'
   AND li.status NOT IN ('reserved','won','lost','dropped');


-- ──────────────────────────────────────────────────────────────────────────
-- SCENARIO 1b — booking checked_in/checked_out → lead_interest should be 'won'
-- ──────────────────────────────────────────────────────────────────────────
UPDATE lead_interests li
   SET status = 'won',
       updated_at = NOW()
  FROM bookings b
 WHERE (b.notes->>'unit_id')::uuid = li.unit_id
   AND (b.notes->>'lead_id')::uuid = li.lead_id
   AND b.status IN ('checked_in','checked_out')
   AND li.status <> 'won'
   AND li.status NOT IN ('lost','dropped');


-- ──────────────────────────────────────────────────────────────────────────
-- SCENARIO 2 — past viewing_date + still 'viewing_scheduled' → 'viewed'
--   Approximate viewed_at = viewing_date (best signal we have for legacy rows).
-- ──────────────────────────────────────────────────────────────────────────
UPDATE lead_interests
   SET status = 'viewed',
       viewed_at = COALESCE(viewed_at, viewing_date),
       updated_at = NOW()
 WHERE status = 'viewing_scheduled'
   AND viewing_date IS NOT NULL
   AND viewing_date < NOW();


-- ──────────────────────────────────────────────────────────────────────────
-- SCENARIO 3 — leads.status='won' without a checked_in/out booking → revert.
--   Old handleReserveUnit set leads.status='won' on reservation. Now we set
--   'negotiating' on reservation, 'won' only on handleMarkAsSold.
-- ──────────────────────────────────────────────────────────────────────────
UPDATE leads l
   SET status = 'negotiating',
       updated_at = NOW()
 WHERE l.status = 'won'
   AND NOT EXISTS (
       SELECT 1 FROM bookings b
        WHERE (b.notes->>'lead_id')::uuid = l.id
          AND b.status IN ('checked_in','checked_out')
   );


-- ──────────────────────────────────────────────────────────────────────────
-- Sanity check after backfill (optional — uncomment to see post-state counts)
-- ──────────────────────────────────────────────────────────────────────────
-- SELECT li.status AS interest_status, b.status AS booking_status, COUNT(*)
--   FROM lead_interests li
--   LEFT JOIN bookings b
--     ON (b.notes->>'unit_id')::uuid = li.unit_id
--    AND (b.notes->>'lead_id')::uuid = li.lead_id
--    AND b.status <> 'cancelled'
--  GROUP BY li.status, b.status
--  ORDER BY interest_status, booking_status;


-- Review counts, then either COMMIT or ROLLBACK below.
-- COMMIT;
-- ROLLBACK;
