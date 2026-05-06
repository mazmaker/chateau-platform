-- segment_members — Junction table mapping leads/customers → segments
-- Solves: "ลูกค้าคนนี้อยู่ segment ไหน?" + speeds up campaign sending 100×
-- Run AFTER 20260424000002_create_marketing_tables.sql

-- ============================================================================
-- 1. SEGMENT_MEMBERS table
-- ============================================================================
CREATE TABLE IF NOT EXISTS segment_members (
  segment_id    UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  member_id     UUID NOT NULL,
  member_type   VARCHAR(20) NOT NULL CHECK (member_type IN ('lead', 'customer')),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  added_at      TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (segment_id, member_id, member_type)
);

CREATE INDEX IF NOT EXISTS idx_segment_members_member ON segment_members(member_id, member_type);
CREATE INDEX IF NOT EXISTS idx_segment_members_segment ON segment_members(segment_id);
CREATE INDEX IF NOT EXISTS idx_segment_members_tenant ON segment_members(tenant_id);

-- RLS
ALTER TABLE segment_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_segment_members" ON segment_members FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- 2. Function: Evaluate filter_rules → return matching member IDs
-- ============================================================================
CREATE OR REPLACE FUNCTION evaluate_segment_rules(
  p_tenant_id UUID,
  p_filter_rules JSONB
)
RETURNS TABLE (member_id UUID, member_type VARCHAR(20))
LANGUAGE plpgsql AS $$
DECLARE
  v_target_type TEXT;
BEGIN
  v_target_type := COALESCE(p_filter_rules->>'type', 'customer');

  IF v_target_type = 'lead' THEN
    -- Filter LEADS
    RETURN QUERY
    SELECT l.id, 'lead'::VARCHAR(20) FROM leads l
    WHERE l.tenant_id = p_tenant_id
      -- Lead lifecycle filters
      AND (p_filter_rules->>'created_within_days' IS NULL
           OR l.created_at >= NOW() - ((p_filter_rules->>'created_within_days')::INT || ' days')::INTERVAL)
      AND (p_filter_rules->>'last_contact_before_days' IS NULL
           OR l.last_contact_date < NOW() - ((p_filter_rules->>'last_contact_before_days')::INT || ' days')::INTERVAL)
      -- Status filter (single)
      AND (p_filter_rules->>'status' IS NULL
           OR l.status = p_filter_rules->>'status')
      -- Status filter (array)
      AND (p_filter_rules->'status_in' IS NULL
           OR l.status = ANY(SELECT jsonb_array_elements_text(p_filter_rules->'status_in')))
      -- Priority
      AND (p_filter_rules->>'priority' IS NULL
           OR l.priority = p_filter_rules->>'priority')
      -- Estimated value range
      AND (p_filter_rules->>'estimated_value_min' IS NULL
           OR l.estimated_value >= (p_filter_rules->>'estimated_value_min')::NUMERIC)
      AND (p_filter_rules->>'estimated_value_max' IS NULL
           OR l.estimated_value <= (p_filter_rules->>'estimated_value_max')::NUMERIC);

  ELSE
    -- Filter CUSTOMERS (default)
    RETURN QUERY
    SELECT c.id, 'customer'::VARCHAR(20) FROM customers c
    WHERE c.tenant_id = p_tenant_id
      AND c.is_active = true
      -- Income filters (from preferences JSONB)
      AND (p_filter_rules->>'income_min' IS NULL
           OR (c.preferences->>'income')::INT >= (p_filter_rules->>'income_min')::INT)
      AND (p_filter_rules->>'income_max' IS NULL
           OR (c.preferences->>'income')::INT <= (p_filter_rules->>'income_max')::INT)
      -- Age range
      AND (p_filter_rules->'age_range' IS NULL
           OR (
             EXTRACT(YEAR FROM AGE(c.date_of_birth)) >= (p_filter_rules->'age_range'->>0)::INT
             AND EXTRACT(YEAR FROM AGE(c.date_of_birth)) <= (p_filter_rules->'age_range'->>1)::INT
           ))
      -- Household size
      AND (p_filter_rules->>'household_size_min' IS NULL
           OR (c.preferences->>'household_size')::INT >= (p_filter_rules->>'household_size_min')::INT)
      AND (p_filter_rules->>'household_size' IS NULL
           OR (c.preferences->>'household_size')::INT = (p_filter_rules->>'household_size')::INT)
      -- Buyer type (from lead_interests)
      AND (p_filter_rules->>'buyer_type' IS NULL
           OR EXISTS (
             SELECT 1 FROM leads l
             JOIN lead_interests li ON li.lead_id = l.id
             WHERE l.customer_id = c.id
               AND li.purpose = p_filter_rules->>'buyer_type'
           ));
  END IF;
END $$;

-- ============================================================================
-- 3. Function: Refresh members of ONE segment
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_segment_members(p_segment_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql AS $$
DECLARE
  v_segment RECORD;
  v_count INTEGER;
BEGIN
  -- Get segment definition
  SELECT id, tenant_id, filter_rules INTO v_segment
  FROM segments WHERE id = p_segment_id;

  IF NOT FOUND THEN
    RAISE NOTICE 'Segment % not found', p_segment_id;
    RETURN 0;
  END IF;

  -- Clear old members
  DELETE FROM segment_members WHERE segment_id = p_segment_id;

  -- Re-evaluate rules + insert matching members
  INSERT INTO segment_members (segment_id, member_id, member_type, tenant_id)
  SELECT p_segment_id, t.member_id, t.member_type, v_segment.tenant_id
  FROM evaluate_segment_rules(v_segment.tenant_id, v_segment.filter_rules) t
  ON CONFLICT (segment_id, member_id, member_type) DO NOTHING;

  -- Update cached count
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE segments SET member_count = v_count, updated_at = NOW()
  WHERE id = p_segment_id;

  RETURN v_count;
END $$;

-- ============================================================================
-- 4. Function: Refresh ALL active segments (run by cron)
-- ============================================================================
CREATE OR REPLACE FUNCTION refresh_all_segments()
RETURNS TABLE (segment_id UUID, segment_name VARCHAR, member_count INTEGER)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT s.id, s.name, refresh_segment_members(s.id)
  FROM segments s
  WHERE s.is_active = true;
END $$;

-- ============================================================================
-- 5. Convenience VIEW: Customer/Lead with their segments
-- ============================================================================
CREATE OR REPLACE VIEW v_member_segments AS
SELECT
  sm.member_id,
  sm.member_type,
  sm.tenant_id,
  ARRAY_AGG(s.code ORDER BY s.code) AS segment_codes,
  ARRAY_AGG(s.name ORDER BY s.name) AS segment_names,
  COUNT(*) AS segment_count
FROM segment_members sm
JOIN segments s ON s.id = sm.segment_id
GROUP BY sm.member_id, sm.member_type, sm.tenant_id;

-- Now you can query:
-- SELECT * FROM v_member_segments WHERE member_id = 'lead-001-uuid';
-- → ['vip', 'family', 'hot_lead']

-- ============================================================================
-- 6. (Optional) pg_cron schedule — Refresh every night at 02:00
-- ============================================================================
-- Uncomment if pg_cron extension is enabled:
-- SELECT cron.schedule(
--   'refresh-segment-members-nightly',
--   '0 2 * * *',
--   $$ SELECT refresh_all_segments(); $$
-- );

-- ============================================================================
-- 7. Initial population — refresh all existing segments now
-- ============================================================================
-- DO $$
-- BEGIN
--   PERFORM refresh_all_segments();
--   RAISE NOTICE 'Initial segment_members population complete';
-- END $$;

COMMENT ON TABLE segment_members IS 'Junction table mapping leads/customers to segments. Refreshed nightly via refresh_all_segments() or manually per segment via refresh_segment_members(uuid)';
