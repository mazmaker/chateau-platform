-- Restrict public_browse policies to non-staff users
--
-- Problem: `units_public_browse` and `properties_public_browse` used `USING: true`,
-- which permitted ALL authenticated users (including Agent/Sales) to bypass the
-- assignment-based SELECT policies, because PostgreSQL combines RLS policies with OR.
--
-- Fix: limit public_browse to "non-staff" users — anyone whose auth.uid() is NOT
-- present in the `users` table. This matches:
--   - Customer Portal users (auth user lives in `customers`, not `users`)
--   - Anonymous (auth.uid() = NULL) — won't match EXISTS, so passes
--
-- Staff (owner/admin/sales/agent — all in `users` table) now fall through to their
-- proper assignment-based policies.

DROP POLICY IF EXISTS "units_public_browse" ON public.units;
CREATE POLICY "units_public_browse" ON public.units FOR SELECT
USING (
  NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid())
);

DROP POLICY IF EXISTS "properties_public_browse" ON public.properties;
CREATE POLICY "properties_public_browse" ON public.properties FOR SELECT
USING (
  NOT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid())
);
