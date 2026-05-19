-- ============================================================
-- View tracking (Funnel layer 1: anonymous browse signals)
-- ============================================================
-- Captures WHO viewed WHAT and HOW DEEPLY, before they create a lead.
-- Used by Agent dashboard to show "X people viewed your link, Y came back".
--
-- PDPA: visitor_id is a client-generated UUID in localStorage, no PII stored.

CREATE TABLE IF NOT EXISTS public.property_views (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  visitor_id       TEXT NOT NULL,
  ref_code         TEXT,
  ref_agent_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  property_id      UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  unit_id          UUID REFERENCES public.units(id) ON DELETE SET NULL,
  page_path        TEXT,
  referrer         TEXT,
  utm_source       TEXT,
  utm_medium       TEXT,
  utm_campaign     TEXT,
  user_agent       TEXT,
  duration_sec     INT CHECK (duration_sec >= 0 AND duration_sec <= 86400),
  scroll_depth_pct INT CHECK (scroll_depth_pct >= 0 AND scroll_depth_pct <= 100),
  authed_user_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  visited_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_views_visitor
  ON public.property_views(visitor_id, visited_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_views_unit
  ON public.property_views(unit_id, visited_at DESC) WHERE unit_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_views_ref_agent
  ON public.property_views(ref_agent_id, visited_at DESC) WHERE ref_agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_property_views_property
  ON public.property_views(property_id, visited_at DESC) WHERE property_id IS NOT NULL;

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can record a view" ON public.property_views;
CREATE POLICY "Anyone can record a view" ON public.property_views
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Owner sees all views" ON public.property_views;
CREATE POLICY "Owner sees all views" ON public.property_views
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Admin/Sales see tenant views" ON public.property_views;
CREATE POLICY "Admin/Sales see tenant views" ON public.property_views
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'sales') AND u.tenant_id = property_views.tenant_id
    )
  );

DROP POLICY IF EXISTS "Agent sees their own attributed views" ON public.property_views;
CREATE POLICY "Agent sees their own attributed views" ON public.property_views
  FOR SELECT TO authenticated
  USING (
    ref_agent_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'agent')
  );
