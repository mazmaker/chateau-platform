-- ============================================================
-- Agent Commission System v1 (Demo Scope)
-- ============================================================
-- Scope: ONE rate per project, applied to Agent-attributed deals.
-- Excluded (Phase 2): tiered rates, co-broking splits, tax,
-- batch payout, monthly invoicing.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS commission_rate_agent_pct NUMERIC(5,2) DEFAULT 3.00
    CHECK (commission_rate_agent_pct >= 0 AND commission_rate_agent_pct <= 30);

COMMENT ON COLUMN public.properties.commission_rate_agent_pct IS
  'Commission % paid to external Agent on each sold unit. Snapshot at sale time into agent_commissions.rate_pct.';

CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  lead_id         UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  unit_id         UUID REFERENCES public.units(id) ON DELETE SET NULL,
  property_id     UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  sale_price      NUMERIC(14,2) NOT NULL CHECK (sale_price >= 0),
  rate_pct        NUMERIC(5,2)  NOT NULL CHECK (rate_pct >= 0 AND rate_pct <= 30),
  amount          NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  status          TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  notes           TEXT,
  approved_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at     TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_commissions_agent
  ON public.agent_commissions(agent_user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_tenant_status
  ON public.agent_commissions(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_commissions_unit
  ON public.agent_commissions(unit_id);

CREATE OR REPLACE FUNCTION public.set_agent_commissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_agent_commissions_updated_at ON public.agent_commissions;
CREATE TRIGGER trg_agent_commissions_updated_at
  BEFORE UPDATE ON public.agent_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_agent_commissions_updated_at();

ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner sees all commissions" ON public.agent_commissions;
CREATE POLICY "Owner sees all commissions" ON public.agent_commissions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Admin manages tenant commissions" ON public.agent_commissions;
CREATE POLICY "Admin manages tenant commissions" ON public.agent_commissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = agent_commissions.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin' AND tenant_id = agent_commissions.tenant_id
    )
  );

DROP POLICY IF EXISTS "Agent reads own commissions" ON public.agent_commissions;
CREATE POLICY "Agent reads own commissions" ON public.agent_commissions
  FOR SELECT TO authenticated
  USING (
    agent_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'agent')
  );

DROP POLICY IF EXISTS "Tenant staff can insert commissions" ON public.agent_commissions;
CREATE POLICY "Tenant staff can insert commissions" ON public.agent_commissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'sales')
        AND (role = 'owner' OR tenant_id = agent_commissions.tenant_id)
    )
  );
