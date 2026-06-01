-- Agent visibility into units of their referred customers, plus a scope-check RPC.
--
-- Problem 1 (read-side): An agent can have referred a customer (lead.referred_by_agent_id)
-- whose interest sits on a unit outside the agent's allotment. With only the
-- "Agent sees only assigned units" policy, that unit row was hidden by RLS, so the
-- agent's Leads/dashboard showed "ยูนิต -" (blank) for those interests — looks broken.
-- Fix: extend SELECT on units to include any unit that a referred-customer lead
-- expressed interest in. Read-only — does not grant the agent write/update power.
--
-- Problem 2 (write-side): handleExpressInterest needs to know whether the referring
-- agent actually services the unit the customer just picked. If yes → assign the lead
-- to the agent; if no → route to Sales. Customers can't read agent_unit_assignments
-- under RLS, so we expose a tiny SECURITY DEFINER predicate that answers just the
-- scope question (no row data leaked).

create policy "Agent reads units of referred-customer interests"
on public.units for select
to public
using (
  exists (
    select 1
    from public.lead_interests li
    join public.leads l on l.id = li.lead_id
    where li.unit_id = units.id
      and l.referred_by_agent_id = auth.uid()
  )
);

create or replace function public.agent_serves_unit(p_agent_id uuid, p_unit_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.agent_unit_assignments
    where agent_user_id = p_agent_id
      and unit_id = p_unit_id
      and revoked_at is null
  );
$$;

grant execute on function public.agent_serves_unit(uuid, uuid) to anon, authenticated;
