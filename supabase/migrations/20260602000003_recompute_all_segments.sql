-- Segment system, part 3: one-time correction — bring every tenant's stored member_count
-- in line with live data so the campaign builder stops showing stale seed numbers.
-- Idempotent: re-running recomputes to the same live counts.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT tenant_id FROM public.segments WHERE tenant_id IS NOT NULL LOOP
    PERFORM public.recompute_segment_members(r.tenant_id);
  END LOOP;
END $$;
