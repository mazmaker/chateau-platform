-- Add viewed_at column so UnitDetail can record/display when Sales marked the visit done
-- Was referenced by UnitDetail.tsx but column didn't exist → the entire .select() returned null
-- → "Leads ที่สนใจยูนิตนี้" UI showed 0 leads even when DB had records.

ALTER TABLE public.lead_interests
  ADD COLUMN IF NOT EXISTS viewed_at timestamptz;

COMMENT ON COLUMN public.lead_interests.viewed_at
  IS 'Timestamp when Sales confirmed the customer attended the viewing (status: viewing_scheduled → viewed)';
