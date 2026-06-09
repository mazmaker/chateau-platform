-- Performance: wrap auth.*() calls inside RLS USING / WITH CHECK so Postgres evaluates
-- them ONCE per query (an initPlan) instead of once PER ROW. `(select auth.uid())`
-- returns the IDENTICAL value as `auth.uid()` (it is STABLE) — so who-can-see-what is
-- completely unchanged; queries on large tables (units, leads, properties, bookings…)
-- just run much faster. Resolves all `auth_rls_initplan` advisor lints (128 policies).
--
-- Idempotent + safe to re-run: the "already wrapped" guard is CASE-INSENSITIVE
-- (`!~* 'select\s+auth\.'`) because Postgres renders the wrapped form with an UPPERCASE
-- keyword — `( SELECT auth.uid() AS uid)`. A case-sensitive guard would fail to detect
-- that and double-wrap on a second run. Uses ALTER POLICY, so each policy's roles,
-- command and permissive/restrictive flags are preserved untouched.
DO $$
DECLARE
  r    record;
  nq   text;
  nc   text;
  pat  text := 'auth\.(uid|jwt|role|email|aud)\(\)';
  repl text := '(select auth.\1())';
BEGIN
  FOR r IN
    SELECT tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND ( qual ~ pat OR coalesce(with_check, '') ~ pat )
      AND coalesce(qual, '')        !~* 'select\s+auth\.'
      AND coalesce(with_check, '')  !~* 'select\s+auth\.'
  LOOP
    nq := CASE WHEN r.qual       IS NOT NULL THEN regexp_replace(r.qual,       pat, repl, 'g') END;
    nc := CASE WHEN r.with_check IS NOT NULL THEN regexp_replace(r.with_check, pat, repl, 'g') END;

    IF    nq IS NOT NULL AND nc IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s) WITH CHECK (%s)', r.policyname, r.tablename, nq, nc);
    ELSIF nq IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (%s)', r.policyname, r.tablename, nq);
    ELSIF nc IS NOT NULL THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (%s)', r.policyname, r.tablename, nc);
    END IF;
  END LOOP;
END $$;
