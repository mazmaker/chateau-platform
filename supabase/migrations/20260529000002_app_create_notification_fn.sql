-- Reliable notification creation that works from ANY authenticated context.
--
-- Problem: notifications are often created as a side effect of one user's action that
-- targets ANOTHER user (e.g. a customer expresses interest → notify the owning agent;
-- an agent hands off → notify Sales). The notifications INSERT RLS only lets a caller
-- insert rows for themselves in practice, so these cross-user notifications were being
-- rejected (42501) and silently dropped — the customer-portal "new lead" notifications
-- to admin/sales/agent never actually fired.
--
-- Fix: a SECURITY DEFINER function that performs the insert with a lightweight
-- authorization check (caller must belong to the target tenant, or be a platform owner)
-- so it cannot be abused to spam other tenants.
create or replace function public.app_create_notification(
  p_tenant_id uuid,
  p_user_id uuid,
  p_type text,
  p_title text,
  p_message text,
  p_related_entity_type text default null,
  p_related_entity_id text default null,
  p_action_url text default null,
  p_action_text text default null,
  p_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    return null;
  end if;

  -- Authorization: caller is a staff member or customer of the target tenant, or an owner.
  if not (
    exists (select 1 from public.users u where u.id = auth.uid() and u.tenant_id = p_tenant_id)
    or exists (select 1 from public.customers c where c.auth_user_id = auth.uid() and c.tenant_id = p_tenant_id)
    or exists (select 1 from public.users o where o.id = auth.uid() and o.role = 'owner')
  ) then
    return null;
  end if;

  insert into public.notifications (
    tenant_id, user_id, type, title, message,
    related_entity_type, related_entity_id, action_url, action_text, data
  ) values (
    p_tenant_id, p_user_id, p_type::notification_type, p_title, p_message,
    p_related_entity_type, nullif(p_related_entity_id, '')::uuid, p_action_url, p_action_text, coalesce(p_data, '{}'::jsonb)
  ) returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.app_create_notification(uuid,uuid,text,text,text,text,text,text,text,jsonb) to authenticated;
