-- Referral scope: resolve an agent referral code (AG-YYYY-NNN) to the set of unit IDs
-- that agent is currently responsible for (active agent_unit_assignments).
--
-- Why: when a customer arrives via an agent's referral link (?ref=AG-...), the customer
-- portal should show ONLY the units that agent can actually service (so every lead the
-- agent receives is one they can hold/handle). Customers/anon cannot read
-- agent_unit_assignments under RLS, so this SECURITY DEFINER function exposes just the
-- unit-id list (no sensitive data) to anon + authenticated.
create or replace function public.referral_agent_unit_ids(p_code text)
returns uuid[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(aua.unit_id), '{}')
  from public.users u
  join public.agent_unit_assignments aua
    on aua.agent_user_id = u.id and aua.revoked_at is null
  where u.role = 'agent' and u.referral_code = p_code;
$$;

grant execute on function public.referral_agent_unit_ids(text) to anon, authenticated;
