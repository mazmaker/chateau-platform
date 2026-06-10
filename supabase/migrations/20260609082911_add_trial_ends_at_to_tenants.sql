-- The Owner Executive Dashboard's "ต่ออายุเร็วๆ นี้" (upcoming renewals) and "ต้องเฝ้าระวัง"
-- (at-risk) cards filter tenants by status='trial' AND trial_ends_at — but the column was
-- missing, so those features silently never populated. Add it (nullable; only trial
-- tenants set it; active/suspended stay NULL).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;

COMMENT ON COLUMN public.tenants.trial_ends_at IS
  'When a trial tenant''s trial period ends. Drives the Owner dashboard renewals/at-risk cards. NULL for active/suspended tenants.';
