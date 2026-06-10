-- Support ticket channel: tenant admin reports an issue → Owner sees it in inbox.
-- This is Tier-2 of the support system (Tier-1 = unified contact email already done).
-- RLS follows the "Owner sees all" principle: tenant users INSERT+SELECT own tickets;
-- Owner can SELECT+UPDATE all tickets across tenants.

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  reported_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  subject       text        NOT NULL,
  description   text        NOT NULL,
  context       jsonb       NOT NULL DEFAULT '{}',  -- page, user_agent, etc.
  priority      text        NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('low','normal','high','urgent')),
  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open','in_progress','resolved')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

-- Tenant users can file a ticket for their own tenant
CREATE POLICY "support_tickets_insert_own_tenant"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
  );

-- Tenant users see own tenant's tickets; Owner sees all
CREATE POLICY "support_tickets_select"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = (SELECT auth.uid()))
    OR (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'owner'
  );

-- Only Owner can update (mark resolved / in_progress)
CREATE POLICY "support_tickets_update_owner"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (
    (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'owner'
  )
  WITH CHECK (
    (SELECT role FROM public.users WHERE id = (SELECT auth.uid())) = 'owner'
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_support_tickets_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_support_tickets_updated_at();
