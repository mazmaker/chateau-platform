-- ============================================================
-- Site Plans v1: multi-plan + clickable hotspots
-- ============================================================
-- Replaces single properties.master_plan_url with a proper plan model:
--   property_plans   - one row per plan (master site plan / floor 1 / floor 2 / ...)
--   plan_hotspots    - clickable pins on a plan, each linked to a unit
--
-- Coords are stored as PERCENTAGES (0..100) so the same hotspot stays correct
-- across viewports and even if the underlying image is reuploaded at a different
-- resolution. The frontend just does `style={{ left: x_pct+'%', top: y_pct+'%' }}`.

CREATE TABLE IF NOT EXISTS public.property_plans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id  UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  image_url    TEXT NOT NULL,
  plan_type    TEXT NOT NULL DEFAULT 'site'
    CHECK (plan_type IN ('site', 'floor', 'other')),
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_plans_property
  ON public.property_plans(property_id, sort_order);

CREATE OR REPLACE FUNCTION public.set_property_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_property_plans_updated_at ON public.property_plans;
CREATE TRIGGER trg_property_plans_updated_at
  BEFORE UPDATE ON public.property_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_property_plans_updated_at();

CREATE TABLE IF NOT EXISTS public.plan_hotspots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     UUID NOT NULL REFERENCES public.property_plans(id) ON DELETE CASCADE,
  unit_id     UUID NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  x_pct       NUMERIC(5,2) NOT NULL CHECK (x_pct >= 0 AND x_pct <= 100),
  y_pct       NUMERIC(5,2) NOT NULL CHECK (y_pct >= 0 AND y_pct <= 100),
  label       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_hotspots_plan ON public.plan_hotspots(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_hotspots_unit ON public.plan_hotspots(unit_id);

DROP TRIGGER IF EXISTS trg_plan_hotspots_updated_at ON public.plan_hotspots;
CREATE TRIGGER trg_plan_hotspots_updated_at
  BEFORE UPDATE ON public.plan_hotspots
  FOR EACH ROW EXECUTE FUNCTION public.set_property_plans_updated_at();

ALTER TABLE public.property_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_hotspots  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans" ON public.property_plans;
CREATE POLICY "Anyone can view plans" ON public.property_plans
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Anyone can view hotspots" ON public.plan_hotspots;
CREATE POLICY "Anyone can view hotspots" ON public.plan_hotspots
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Owner manages all plans" ON public.property_plans;
CREATE POLICY "Owner manages all plans" ON public.property_plans
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Owner manages all hotspots" ON public.plan_hotspots;
CREATE POLICY "Owner manages all hotspots" ON public.plan_hotspots
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'owner'));

DROP POLICY IF EXISTS "Admin manages tenant plans" ON public.property_plans;
CREATE POLICY "Admin manages tenant plans" ON public.property_plans
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.properties p ON p.id = property_plans.property_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = p.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.properties p ON p.id = property_plans.property_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = p.tenant_id
    )
  );

DROP POLICY IF EXISTS "Admin manages tenant hotspots" ON public.plan_hotspots;
CREATE POLICY "Admin manages tenant hotspots" ON public.plan_hotspots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.property_plans pl ON pl.id = plan_hotspots.plan_id
      JOIN public.properties p ON p.id = pl.property_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = p.tenant_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      JOIN public.property_plans pl ON pl.id = plan_hotspots.plan_id
      JOIN public.properties p ON p.id = pl.property_id
      WHERE u.id = auth.uid() AND u.role = 'admin' AND u.tenant_id = p.tenant_id
    )
  );

-- Backfill: existing master_plan_url -> property_plans 'ผังรวม' row
INSERT INTO public.property_plans (property_id, label, image_url, plan_type, sort_order)
SELECT p.id, 'ผังรวม', p.master_plan_url, 'site', 0
FROM public.properties p
WHERE p.master_plan_url IS NOT NULL
  AND p.master_plan_url <> ''
  AND NOT EXISTS (SELECT 1 FROM public.property_plans pp WHERE pp.property_id = p.id);
