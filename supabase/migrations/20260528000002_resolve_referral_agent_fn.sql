-- Resolve an Agent's referral code → their user id, WITHOUT exposing the staff users
-- table to customers/anonymous visitors. RLS blocks customers from reading public.users,
-- so the silent-attribution flow (customer arrives via ?ref=AG-YYYY-NNN) could never map
-- the code to an agent. This SECURITY DEFINER function returns ONLY the agent's uuid,
-- gated to role='agent' and (optionally) a matching tenant — no sensitive data leaks.
CREATE OR REPLACE FUNCTION public.resolve_referral_agent(p_code text, p_tenant_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id
  FROM public.users
  WHERE referral_code = p_code
    AND role = 'agent'
    AND (p_tenant_id IS NULL OR tenant_id = p_tenant_id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_referral_agent(text, uuid) TO anon, authenticated;
