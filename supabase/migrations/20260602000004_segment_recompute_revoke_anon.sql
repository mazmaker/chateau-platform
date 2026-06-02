-- Security hardening: PostgreSQL grants EXECUTE to PUBLIC by default, which includes the
-- PostgREST `anon` role. Combined with recompute_segment_members()'s guard treating a NULL
-- auth.uid() as a trusted backend context, an anonymous web caller could trigger expensive
-- segment rebuilds (and mutate member_count/segment_members) for ANY tenant. Revoke the
-- default PUBLIC/anon grant so only `authenticated` (guarded to Owner/same-tenant) and
-- `service_role` / direct superuser (migrations, cron) can invoke it.
REVOKE EXECUTE ON FUNCTION public.recompute_segment_members(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recompute_segment_members(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.recompute_segment_members(uuid) TO authenticated, service_role;

-- Same default-PUBLIC hygiene for the notification RPC (intended authenticated-only; anon
-- currently no-ops via its NULL-uid guard, but should not be callable at all).
REVOKE EXECUTE ON FUNCTION public.app_create_notification(uuid,uuid,text,text,text,text,text,text,text,jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.app_create_notification(uuid,uuid,text,text,text,text,text,text,text,jsonb) FROM anon;
GRANT  EXECUTE ON FUNCTION public.app_create_notification(uuid,uuid,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;
