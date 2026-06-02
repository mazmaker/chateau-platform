-- Segment system, part 2: live recompute function.
--
-- recompute_segment_members(p_tenant_id) rebuilds segment_members + member_count +
-- last_computed_at for ALL active lead segments of one tenant, evaluating each segment's
-- filter_rules against current data. SECURITY DEFINER is required because segment_members
-- has SELECT-only RLS (no write policy) — a normal caller cannot write to it.
--
-- Authorization: a trusted context (direct SQL / migration / cron / service_role) has no
-- end-user JWT, so auth.uid() is NULL — allowed. An authenticated web user must be an Owner
-- (is_owner, cross-tenant by design) or belong to p_tenant_id. EXECUTE is granted only to
-- authenticated + service_role (never anon), so anon cannot reach it at all.
--
-- Supported filter_rules keys (all NULL-safe — a lead missing the field fails the predicate):
--   age_range[min,max]          -> leads.age
--   income_min / income_max     -> leads.monthly_income
--   household_size[_min]        -> COALESCE(leads.household_size, customers.preferences.family_members)
--   is_first_time_buyer (bool)  -> leads.is_first_time_buyer
--   purchase_purpose (text)     -> customers.preferences->>'purchase_purpose'
--   buyer_type (text)           -> customers.preferences->>'buyer_type'   (forward-compat)
--   property_interest (text)    -> behavioral: lead_interests -> properties.type

CREATE OR REPLACE FUNCTION public.recompute_segment_members(p_tenant_id uuid)
RETURNS TABLE (out_code text, out_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seg RECORD;
  v_count integer;
  v_caller_tenant uuid;
  v_is_owner boolean := false;
BEGIN
  IF p_tenant_id IS NULL THEN
    RAISE EXCEPTION 'p_tenant_id is required';
  END IF;

  -- Authorization (DEFINER bypasses RLS, so we guard manually).
  IF auth.uid() IS NOT NULL THEN
    BEGIN v_is_owner := is_owner(); EXCEPTION WHEN OTHERS THEN v_is_owner := false; END;
    IF NOT v_is_owner THEN
      SELECT u.tenant_id INTO v_caller_tenant FROM public.users u WHERE u.id = auth.uid();
      IF v_caller_tenant IS DISTINCT FROM p_tenant_id THEN
        RAISE EXCEPTION 'not authorized to recompute segments for tenant %', p_tenant_id
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  FOR v_seg IN
    SELECT s.id, s.code, s.filter_rules
    FROM public.segments s
    WHERE s.tenant_id = p_tenant_id
      AND s.is_active = true
      AND COALESCE(s.target_type, 'lead') = 'lead'
  LOOP
    DELETE FROM public.segment_members WHERE segment_id = v_seg.id AND tenant_id = p_tenant_id;

    INSERT INTO public.segment_members (segment_id, member_id, member_type, tenant_id)
    SELECT v_seg.id, l.id, 'lead', p_tenant_id
    FROM public.leads l
    WHERE l.tenant_id = p_tenant_id
      -- age_range [min, max]
      AND (v_seg.filter_rules->'age_range' IS NULL
           OR (l.age IS NOT NULL
               AND l.age >= (v_seg.filter_rules->'age_range'->>0)::int
               AND l.age <= (v_seg.filter_rules->'age_range'->>1)::int))
      -- income_min
      AND (v_seg.filter_rules->>'income_min' IS NULL
           OR (l.monthly_income IS NOT NULL
               AND l.monthly_income >= (v_seg.filter_rules->>'income_min')::numeric))
      -- income_max
      AND (v_seg.filter_rules->>'income_max' IS NULL
           OR (l.monthly_income IS NOT NULL
               AND l.monthly_income <= (v_seg.filter_rules->>'income_max')::numeric))
      -- household_size_min (leads.household_size, fallback customers.preferences.family_members)
      AND (v_seg.filter_rules->>'household_size_min' IS NULL
           OR (COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id)) IS NOT NULL
               AND COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id))
                 >= (v_seg.filter_rules->>'household_size_min')::int))
      -- household_size (exact)
      AND (v_seg.filter_rules->>'household_size' IS NULL
           OR (COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id)) IS NOT NULL
               AND COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id))
                 = (v_seg.filter_rules->>'household_size')::int))
      -- is_first_time_buyer (boolean)
      AND (v_seg.filter_rules->>'is_first_time_buyer' IS NULL
           OR (l.is_first_time_buyer IS NOT NULL
               AND l.is_first_time_buyer = (v_seg.filter_rules->>'is_first_time_buyer')::boolean))
      -- buyer_type (customers.preferences->>'buyer_type') — forward-compat
      AND (v_seg.filter_rules->>'buyer_type' IS NULL
           OR EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = l.customer_id
                        AND c.preferences->>'buyer_type' = v_seg.filter_rules->>'buyer_type'))
      -- purchase_purpose (customers.preferences->>'purchase_purpose')
      AND (v_seg.filter_rules->>'purchase_purpose' IS NULL
           OR EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = l.customer_id
                        AND c.preferences->>'purchase_purpose' = v_seg.filter_rules->>'purchase_purpose'))
      -- property_interest (behavioral: lead_interests -> properties.type)
      AND (v_seg.filter_rules->>'property_interest' IS NULL
           OR EXISTS (SELECT 1
                      FROM public.lead_interests li
                      JOIN public.properties p ON p.id = li.property_id AND p.tenant_id = l.tenant_id
                      WHERE li.lead_id = l.id
                        AND li.tenant_id = l.tenant_id
                        AND li.status NOT IN ('lost','dropped')
                        AND p.type::text = v_seg.filter_rules->>'property_interest'))
    ON CONFLICT (segment_id, member_id, member_type) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;

    UPDATE public.segments
       SET member_count = v_count, last_computed_at = now(), updated_at = now()
     WHERE id = v_seg.id;

    out_code := v_seg.code;
    out_count := v_count;
    RETURN NEXT;
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.recompute_segment_members(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.recompute_segment_members(uuid) IS
  'Live rebuild of segment_members + member_count + last_computed_at for all active lead segments of one tenant. SECURITY DEFINER (segment_members has no write RLS). Tenant-scoped; authenticated callers must be Owner or same-tenant; anon has no EXECUTE. NULL-safe.';
