-- Fix evaluate_segment_rules to match actual schema:
-- - leads has top-level columns (age, monthly_income, monthly_debt, household_size, marital_status)
-- - customers has full_name + date_of_birth + preferences JSONB
-- - lead_interests has NO 'purpose' column (use is_first_time_buyer / existing_properties on leads instead)
--
-- Run AFTER 20260424000004_create_segment_members.sql

-- ============================================================================
-- 1. Add target_type column to segments (was missing because pre-existing table)
-- ============================================================================
ALTER TABLE segments ADD COLUMN IF NOT EXISTS target_type VARCHAR(20) DEFAULT 'lead';

-- Backfill: all current seeds target leads (their filters need lead-level data)
UPDATE segments SET target_type = 'lead' WHERE target_type IS NULL;

-- ============================================================================
-- 2. Replace evaluate_segment_rules with schema-correct version
-- ============================================================================
DROP FUNCTION IF EXISTS evaluate_segment_rules(UUID, JSONB);

CREATE OR REPLACE FUNCTION evaluate_segment_rules(
  p_tenant_id UUID,
  p_filter_rules JSONB
)
RETURNS TABLE (member_id UUID, member_type VARCHAR(20))
LANGUAGE plpgsql AS $$
DECLARE
  v_target_type TEXT;
BEGIN
  v_target_type := COALESCE(p_filter_rules->>'type', 'lead');

  IF v_target_type = 'customer' THEN
    -- Filter CUSTOMERS (limited data — date_of_birth + preferences JSONB only)
    RETURN QUERY
    SELECT c.id, 'customer'::VARCHAR(20) FROM customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.is_active = true
      -- Age range from date_of_birth
      AND (p_filter_rules->'age_range' IS NULL OR c.date_of_birth IS NOT NULL)
      AND (p_filter_rules->'age_range' IS NULL
           OR (
             EXTRACT(YEAR FROM AGE(c.date_of_birth)) >= (p_filter_rules->'age_range'->>0)::INT
             AND EXTRACT(YEAR FROM AGE(c.date_of_birth)) <= (p_filter_rules->'age_range'->>1)::INT
           ))
      -- Income from preferences JSONB
      AND (p_filter_rules->>'income_min' IS NULL
           OR (c.preferences->>'income')::NUMERIC >= (p_filter_rules->>'income_min')::NUMERIC)
      AND (p_filter_rules->>'income_max' IS NULL
           OR (c.preferences->>'income')::NUMERIC <= (p_filter_rules->>'income_max')::NUMERIC);

  ELSE
    -- Filter LEADS (default — rich top-level columns)
    RETURN QUERY
    SELECT l.id, 'lead'::VARCHAR(20) FROM leads l
    WHERE l.tenant_id = p_tenant_id
      -- Lead lifecycle filters
      AND (p_filter_rules->>'created_within_days' IS NULL
           OR l.created_at >= NOW() - ((p_filter_rules->>'created_within_days')::INT || ' days')::INTERVAL)
      AND (p_filter_rules->>'last_contact_before_days' IS NULL
           OR l.last_contact_date < NOW() - ((p_filter_rules->>'last_contact_before_days')::INT || ' days')::INTERVAL)
      -- Status (single)
      AND (p_filter_rules->>'status' IS NULL
           OR l.status = p_filter_rules->>'status')
      -- Status (array)
      AND (p_filter_rules->'status_in' IS NULL
           OR l.status = ANY(SELECT jsonb_array_elements_text(p_filter_rules->'status_in')))
      -- Priority
      AND (p_filter_rules->>'priority' IS NULL
           OR l.priority = p_filter_rules->>'priority')
      -- Estimated value
      AND (p_filter_rules->>'estimated_value_min' IS NULL
           OR l.estimated_value >= (p_filter_rules->>'estimated_value_min')::NUMERIC)
      AND (p_filter_rules->>'estimated_value_max' IS NULL
           OR l.estimated_value <= (p_filter_rules->>'estimated_value_max')::NUMERIC)
      -- Demographics (top-level columns on leads)
      AND (p_filter_rules->'age_range' IS NULL
           OR (l.age IS NOT NULL
               AND l.age >= (p_filter_rules->'age_range'->>0)::INT
               AND l.age <= (p_filter_rules->'age_range'->>1)::INT))
      -- Income (top-level)
      AND (p_filter_rules->>'income_min' IS NULL
           OR l.monthly_income >= (p_filter_rules->>'income_min')::NUMERIC)
      AND (p_filter_rules->>'income_max' IS NULL
           OR l.monthly_income <= (p_filter_rules->>'income_max')::NUMERIC)
      -- Household size (top-level)
      AND (p_filter_rules->>'household_size_min' IS NULL
           OR l.household_size >= (p_filter_rules->>'household_size_min')::INT)
      AND (p_filter_rules->>'household_size' IS NULL
           OR l.household_size = (p_filter_rules->>'household_size')::INT)
      -- Marital status
      AND (p_filter_rules->>'marital_status' IS NULL
           OR l.marital_status = p_filter_rules->>'marital_status')
      -- Buyer type (mapped to actual columns)
      AND (p_filter_rules->>'buyer_type' IS NULL
           OR (
             (p_filter_rules->>'buyer_type' = 'first_home' AND l.is_first_time_buyer = true)
             OR (p_filter_rules->>'buyer_type' = 'investment' AND COALESCE(l.existing_properties, 0) > 0)
             OR (p_filter_rules->>'buyer_type' = 'upgrade' AND l.sold_property_recently = true)
           ));
  END IF;
END $$;

-- ============================================================================
-- 3. Re-run refresh on all active segments
-- ============================================================================
SELECT * FROM refresh_all_segments();

COMMENT ON FUNCTION evaluate_segment_rules IS 'Schema-correct version v2 — reads leads top-level columns (age, monthly_income, household_size, marital_status, is_first_time_buyer, existing_properties, sold_property_recently), customers preferences JSONB';
