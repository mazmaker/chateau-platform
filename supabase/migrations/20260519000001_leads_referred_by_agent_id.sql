-- ============================================================
-- Lead attribution: who originally brought the customer
-- ============================================================
-- Separates operational ownership (assigned_to - mutable, changes on handoff)
-- from commission attribution (referred_by_agent_id - locked once set).
--
-- Industry standard: external Agent gets commission credit even AFTER they
-- handoff to in-house Sales. Without this column, our commission hook
-- (UnitDetail.handleMarkAsSold) reads assigned_to and pays the Sales user
-- instead of the Agent who actually brought the customer.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS referred_by_agent_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.leads.referred_by_agent_id IS
  'The Agent who first brought this customer to the platform. Locked once set; survives handoff to Sales. Used for commission attribution at sale close, NOT assigned_to.';

CREATE INDEX IF NOT EXISTS idx_leads_referred_by_agent_id
  ON public.leads(referred_by_agent_id)
  WHERE referred_by_agent_id IS NOT NULL;

-- Immutability guard: once referred_by_agent_id is set, only Owner/Admin can change it.
CREATE OR REPLACE FUNCTION public.guard_lead_referred_by_immutable()
RETURNS TRIGGER AS $$
DECLARE
  caller_role text;
BEGIN
  IF OLD.referred_by_agent_id IS NOT DISTINCT FROM NEW.referred_by_agent_id THEN
    RETURN NEW;
  END IF;

  IF OLD.referred_by_agent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT role::text INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IN ('owner', 'admin') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'referred_by_agent_id is immutable once set (only owner/admin can change)';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_lead_referred_by_immutable ON public.leads;
CREATE TRIGGER trg_lead_referred_by_immutable
  BEFORE UPDATE OF referred_by_agent_id ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.guard_lead_referred_by_immutable();
