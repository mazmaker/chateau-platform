-- Migration: platform_leads — SaaS sales pipeline (prospective developer companies)
-- Date: 2026-06-04
--
-- PLATFORM-LEVEL table: deliberately NO tenant_id. A platform_lead is a prospective
-- real-estate DEVELOPER company interested in SUBSCRIBING to Chateau — NOT a home-buyer
-- (that is the tenant-scoped `leads` table). This lives in the SaaS control-plane that
-- the Owner manages across all tenants. Owner-only RLS per the Owner-sees-all principle;
-- a won lead converts into a `tenants` row (converted_tenant_id) closing the loop.

-- 1. Table -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_leads (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Company (the developer firm being courted)
  company_name           text NOT NULL,
  company_size           text CHECK (company_size IN ('solo','small','medium','large','enterprise')),
  current_projects_count integer,
  current_units_count    integer,
  province               text,
  website                text,

  -- Contact person
  contact_name           text NOT NULL,
  contact_title          text,
  contact_phone          text,
  contact_line_id        text,
  contact_email          text,

  -- Deal / pipeline
  interested_plan        subscription_plan,            -- reuse existing plan enum (free/starter/professional/enterprise)
  seats_needed           integer,
  projects_needed        integer,
  estimated_mrr          numeric(15,2),                -- THB monthly recurring value of the deal
  source                 text CHECK (source IN (
                            'direct_inbound','event','referral','outbound',
                            'demo_request','trial_signup','contact_sales')),
  stage                  text NOT NULL DEFAULT 'new' CHECK (stage IN (
                            'new','contacted','qualified','demo_scheduled',
                            'proposal_sent','negotiation','won','lost')),
  assigned_to            uuid REFERENCES public.users(id) ON DELETE SET NULL,
  expected_close_date    date,
  notes                  text,
  lost_reason            text,

  -- Conversion to a paying tenant (set on win)
  converted_tenant_id    uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  converted_at           timestamptz,

  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- 2. Indexes -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_platform_leads_stage       ON public.platform_leads(stage);
CREATE INDEX IF NOT EXISTS idx_platform_leads_source      ON public.platform_leads(source);
CREATE INDEX IF NOT EXISTS idx_platform_leads_assigned_to ON public.platform_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_platform_leads_converted   ON public.platform_leads(converted_tenant_id);
CREATE INDEX IF NOT EXISTS idx_platform_leads_created_at  ON public.platform_leads(created_at DESC);

-- 3. updated_at trigger (reuse the global helper from initial_schema) ---------
DROP TRIGGER IF EXISTS update_platform_leads_updated_at ON public.platform_leads;
CREATE TRIGGER update_platform_leads_updated_at
  BEFORE UPDATE ON public.platform_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. RLS ---------------------------------------------------------------------
ALTER TABLE public.platform_leads ENABLE ROW LEVEL SECURITY;

-- Owner: full CRUD (platform-level, no tenant predicate)
DROP POLICY IF EXISTS "Owner manages platform_leads" ON public.platform_leads;
CREATE POLICY "Owner manages platform_leads" ON public.platform_leads
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

-- Service role bypass (system / migration writes)
DROP POLICY IF EXISTS "Service role manages platform_leads" ON public.platform_leads;
CREATE POLICY "Service role manages platform_leads" ON public.platform_leads
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- 5. Verify ------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='platform_leads') THEN
    RAISE EXCEPTION 'platform_leads table not created';
  END IF;
  RAISE NOTICE 'platform_leads ready: Owner-only RLS + service_role bypass.';
END $$;
