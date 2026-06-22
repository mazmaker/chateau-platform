-- Per-user last-login signal for the Owner /users page (adoption / churn).
-- auth.users.last_sign_in_at is the source of truth; public.users.last_sign_in_at is
-- stale/seed-only (Supabase Auth never syncs it). Mirrors owner_active_user_stats()
-- (SECURITY DEFINER + auth join), guarded by is_owner() so only the platform owner sees
-- login timestamps (PII). Locked to the authenticated role (anon revoked).

CREATE OR REPLACE FUNCTION public.owner_users_last_sign_in()
RETURNS TABLE(id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT u.id, a.last_sign_in_at
  FROM public.users u
  JOIN auth.users a ON a.id = u.id
  WHERE public.is_owner();
$function$;

REVOKE ALL ON FUNCTION public.owner_users_last_sign_in() FROM public;
REVOKE EXECUTE ON FUNCTION public.owner_users_last_sign_in() FROM anon;
GRANT EXECUTE ON FUNCTION public.owner_users_last_sign_in() TO authenticated;
