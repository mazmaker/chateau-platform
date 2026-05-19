-- ============================================================
-- Agent referral code (AG-YYYY-NNN format)
-- ============================================================
-- Format: AG-2026-001 - year + sequence. Decided over UUID because demo
-- audience reads codes off slides, and over name-based codes because of
-- the "silent attribution" rule (customer must not see Agent identity
-- in URLs). See memory: project_silent_agent_attribution.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

COMMENT ON COLUMN public.users.referral_code IS
  'Public-facing Agent code used in referral URLs (?ref=AG-2026-NNN). Only populated for role=agent. Opaque to customers - they should not be able to identify the Agent from this code.';

CREATE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users(referral_code)
  WHERE referral_code IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS agent_referral_code_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_agent_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  next_n INTEGER;
  year_part TEXT;
BEGIN
  IF NEW.role = 'agent' AND NEW.referral_code IS NULL THEN
    next_n := nextval('agent_referral_code_seq');
    year_part := to_char(now(), 'YYYY');
    NEW.referral_code := 'AG-' || year_part || '-' || lpad(next_n::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_assign_agent_referral_code ON public.users;
CREATE TRIGGER trg_assign_agent_referral_code
  BEFORE INSERT OR UPDATE OF role ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.assign_agent_referral_code();

UPDATE public.users
SET role = role
WHERE role = 'agent' AND referral_code IS NULL;
