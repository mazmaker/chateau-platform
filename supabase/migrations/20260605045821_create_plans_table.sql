-- Subscription plan catalog (control-plane / Owner-managed).
-- Replaces the previously hardcoded package data. Read by:
--   src/components/admin/PackageCatalog.tsx, src/pages/OwnerDashboard.tsx,
--   src/pages/TenantManagement.tsx.
-- Depends on existing helpers: is_owner(), update_updated_at_column().

CREATE TABLE IF NOT EXISTS public.plans (
  id             text        PRIMARY KEY,            -- matches subscription_plan enum values
  name           text        NOT NULL,
  price_monthly  numeric     NOT NULL DEFAULT 0,
  price_yearly   numeric,
  max_properties integer     NOT NULL DEFAULT 0,     -- -1 = unlimited
  max_admins     integer     NOT NULL DEFAULT 1,
  max_sales      integer     NOT NULL DEFAULT 0,
  features       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  sort_order     integer     NOT NULL DEFAULT 0,
  is_active      boolean     NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- keep updated_at fresh on edits
DROP TRIGGER IF EXISTS set_plans_updated_at ON public.plans;
CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: catalog is public-readable; only the platform Owner may write.
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view plans" ON public.plans;
CREATE POLICY "Anyone can view plans"
  ON public.plans FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner manages plans" ON public.plans;
CREATE POLICY "Owner manages plans"
  ON public.plans FOR ALL
  USING (is_owner())
  WITH CHECK (is_owner());

-- Seed the 4 default tiers. ON CONFLICT DO NOTHING so live Owner edits are never clobbered.
INSERT INTO public.plans (id, name, price_monthly, price_yearly, max_properties, max_admins, max_sales, features, sort_order, is_active)
VALUES
  ('free',         'Free',          0,      0,     5,  1, 2,
    '["ระบบจัดการลูกค้า","ระบบ Leads"]'::jsonb, 0, true),
  ('starter',      'Starter',       2900,   29000, 10, 1, 4,
    '["ระบบจัดการลูกค้า","ระบบ Leads","ระบบแคมเปญ"]'::jsonb, 1, true),
  ('professional', 'Professional',  5900,   59000, 50, 2, 8,
    '["ระบบจัดการลูกค้า","ระบบ Leads","ระบบแคมเปญ","รายงานวิเคราะห์","API Access"]'::jsonb, 2, true),
  ('enterprise',   'Enterprise',    15900,  159000, -1, 4, 16,
    '["ระบบจัดการลูกค้า","ระบบ Leads","ระบบแคมเปญ","รายงานวิเคราะห์","API Access","รายงานวิเคราะห์ขั้นสูง","Custom Development","Support 24/7"]'::jsonb, 3, true)
ON CONFLICT (id) DO NOTHING;
