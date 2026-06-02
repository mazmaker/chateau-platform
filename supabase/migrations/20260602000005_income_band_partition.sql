-- Make the income bands a clean partition (no boundary double-counting).
-- Before: รายได้น้อย (<=30k) and รายได้ปานกลาง (30k..100k inclusive) both contained exactly
-- 30,000; ปานกลาง and รายได้สูง (>=100k) both contained exactly 100,000. A lead at a band
-- edge landed in two bands. We add strict bounds (income_gt / income_lt) to the recompute
-- function and redefine ปานกลาง as STRICTLY between, so each income belongs to exactly one band:
--   น้อย:   x <= 30,000
--   ปานกลาง: 30,000 < x < 100,000
--   สูง:    x >= 100,000

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
      AND (v_seg.filter_rules->'age_range' IS NULL
           OR (l.age IS NOT NULL
               AND l.age >= (v_seg.filter_rules->'age_range'->>0)::int
               AND l.age <= (v_seg.filter_rules->'age_range'->>1)::int))
      AND (v_seg.filter_rules->>'income_min' IS NULL
           OR (l.monthly_income IS NOT NULL AND l.monthly_income >= (v_seg.filter_rules->>'income_min')::numeric))
      AND (v_seg.filter_rules->>'income_max' IS NULL
           OR (l.monthly_income IS NOT NULL AND l.monthly_income <= (v_seg.filter_rules->>'income_max')::numeric))
      AND (v_seg.filter_rules->>'income_gt' IS NULL
           OR (l.monthly_income IS NOT NULL AND l.monthly_income > (v_seg.filter_rules->>'income_gt')::numeric))
      AND (v_seg.filter_rules->>'income_lt' IS NULL
           OR (l.monthly_income IS NOT NULL AND l.monthly_income < (v_seg.filter_rules->>'income_lt')::numeric))
      AND (v_seg.filter_rules->>'household_size_min' IS NULL
           OR (COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id)) IS NOT NULL
               AND COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id))
                 >= (v_seg.filter_rules->>'household_size_min')::int))
      AND (v_seg.filter_rules->>'household_size' IS NULL
           OR (COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id)) IS NOT NULL
               AND COALESCE(l.household_size,
                 (SELECT NULLIF(c.preferences->>'family_members','')::int
                    FROM public.customers c WHERE c.id = l.customer_id))
                 = (v_seg.filter_rules->>'household_size')::int))
      AND (v_seg.filter_rules->>'is_first_time_buyer' IS NULL
           OR (l.is_first_time_buyer IS NOT NULL
               AND l.is_first_time_buyer = (v_seg.filter_rules->>'is_first_time_buyer')::boolean))
      AND (v_seg.filter_rules->>'buyer_type' IS NULL
           OR EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = l.customer_id
                        AND c.preferences->>'buyer_type' = v_seg.filter_rules->>'buyer_type'))
      AND (v_seg.filter_rules->>'purchase_purpose' IS NULL
           OR EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = l.customer_id
                        AND c.preferences->>'purchase_purpose' = v_seg.filter_rules->>'purchase_purpose'))
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

-- Redefine ปานกลาง as strictly between the two edges (owns neither boundary).
UPDATE public.segments
   SET filter_rules = '{"income_gt":30000,"income_lt":100000}'::jsonb
 WHERE code = 'income_medium';

-- Re-sync every tenant's counts with the new band logic.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT tenant_id FROM public.segments WHERE tenant_id IS NOT NULL LOOP
    PERFORM public.recompute_segment_members(r.tenant_id);
  END LOOP;
END $$;
