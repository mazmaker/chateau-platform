-- Demo data polish — fill gaps that make Executive Dashboard show ฿0 / 0% / 0 leads
-- Idempotent: safe to re-run; only updates NULL fields

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE NOTICE 'No tenants found. Skipping.'; RETURN; END IF;

  -- ============================================================================
  -- 1. UPDATE existing leads — fill estimated_value, last_contact_date, scoring, vary status/priority
  -- ============================================================================

  -- Set deterministic random for reproducible demo (md5 of row.id)
  UPDATE leads SET
    -- Pipeline Value source
    estimated_value = CASE WHEN estimated_value IS NULL THEN
      ROUND((2500000 + (('x' || substring(md5(id::text) FROM 1 FOR 8))::bit(32)::int % 12500000))::numeric, -4)
    ELSE estimated_value END,

    -- Inactive Leads Alert source
    last_contact_date = CASE WHEN last_contact_date IS NULL THEN
      NOW() - ((('x' || substring(md5(id::text) FROM 9 FOR 8))::bit(32)::int % 75) || ' days')::INTERVAL
    ELSE last_contact_date END,

    next_follow_up = CASE WHEN next_follow_up IS NULL THEN
      CURRENT_DATE + (((('x' || substring(md5(id::text) FROM 17 FOR 8))::bit(32)::int % 21) - 7) || ' days')::INTERVAL
    ELSE next_follow_up END,

    -- Hot Leads source — vary priority
    priority = CASE
      WHEN (('x' || substring(md5(id::text) FROM 1 FOR 4))::bit(16)::int % 10) < 3 THEN 'high'
      WHEN (('x' || substring(md5(id::text) FROM 1 FOR 4))::bit(16)::int % 10) < 7 THEN 'medium'
      ELSE 'low'
    END,

    -- Scoring fields (composite Hot Lead detection)
    potential_score = COALESCE(potential_score,
      40 + (('x' || substring(md5(id::text) FROM 5 FOR 4))::bit(16)::int % 60)),
    engagement_score = COALESCE(engagement_score,
      30 + (('x' || substring(md5(id::text) FROM 9 FOR 4))::bit(16)::int % 70)),
    urgency_score = COALESCE(urgency_score,
      20 + (('x' || substring(md5(id::text) FROM 13 FOR 4))::bit(16)::int % 80)),
    fit_score = COALESCE(fit_score,
      40 + (('x' || substring(md5(id::text) FROM 17 FOR 4))::bit(16)::int % 60)),
    conversion_probability = COALESCE(conversion_probability,
      0.2 + ((('x' || substring(md5(id::text) FROM 21 FOR 4))::bit(16)::int % 60) / 100.0)::NUMERIC),

    -- Status: vary across pipeline stages (Sales Funnel)
    -- Valid values: new, contacted, qualified, negotiating, won, lost
    status = CASE
      WHEN (('x' || substring(md5(id::text) FROM 25 FOR 4))::bit(16)::int % 10) < 3 THEN 'new'
      WHEN (('x' || substring(md5(id::text) FROM 25 FOR 4))::bit(16)::int % 10) < 5 THEN 'contacted'
      WHEN (('x' || substring(md5(id::text) FROM 25 FOR 4))::bit(16)::int % 10) < 7 THEN 'qualified'
      WHEN (('x' || substring(md5(id::text) FROM 25 FOR 4))::bit(16)::int % 10) < 9 THEN 'negotiating'
      ELSE 'won'
    END
  WHERE tenant_id = v_tenant_id;

  RAISE NOTICE 'Updated % existing leads', (SELECT COUNT(*) FROM leads WHERE tenant_id = v_tenant_id);

  -- ============================================================================
  -- 2. INSERT new leads dated this month (for Leads MTD KPI + Lead Trend chart)
  -- ============================================================================
  INSERT INTO leads (tenant_id, status, source, priority, estimated_value,
    last_contact_date, next_follow_up, monthly_income, monthly_debt, household_size,
    urgency_level, decision_maker, financing_approved, site_visit_attended,
    potential_score, engagement_score, urgency_score, fit_score, conversion_probability,
    age, gender, marital_status, education,
    is_first_time_buyer, existing_properties, created_at)
  SELECT
    v_tenant_id,
    (ARRAY['new','new','new','contacted','qualified'])[1 + (i % 5)],
    (ARRAY['online_facebook','online_google','offline','online_facebook','online_google'])[1 + (i % 5)],
    (ARRAY['high','medium','medium','low'])[1 + (i % 4)],
    ROUND((3000000 + i * 1500000)::numeric, -4),
    NOW() - ((i * 2) || ' days')::INTERVAL,
    CURRENT_DATE + ((i + 3) || ' days')::INTERVAL,
    50000 + i * 15000,
    8000 + i * 2000,
    1 + (i % 4),
    (ARRAY['high','medium','low'])[1 + (i % 3)],
    (i % 2 = 0),
    (i % 3 = 0),
    (i % 2 = 1),
    50 + i * 5,
    40 + i * 6,
    35 + i * 7,
    55 + i * 4,
    (0.3 + (i * 0.07))::numeric,
    28 + i * 3,
    (ARRAY['male','female','male','female'])[1 + (i % 4)],
    (ARRAY['single','married','married','single'])[1 + (i % 4)],
    (ARRAY['bachelor','master','bachelor','doctorate'])[1 + (i % 4)],
    (i % 2 = 0),
    (i % 3),
    DATE_TRUNC('month', NOW()) + ((i * (EXTRACT(DAY FROM NOW())::int)::float / 8)::int || ' days')::INTERVAL
  FROM generate_series(0, 7) AS i;

  RAISE NOTICE 'Inserted 8 new leads dated this month';

  -- ============================================================================
  -- 3. UPDATE customers — fill date_of_birth (so customer.birthday trigger works)
  -- ============================================================================
  UPDATE customers SET
    date_of_birth = CURRENT_DATE - ((25 + (('x' || substring(md5(id::text) FROM 1 FOR 8))::bit(32)::int % 40) * 365) || ' days')::INTERVAL
  WHERE date_of_birth IS NULL AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Filled date_of_birth on customers';

  -- ============================================================================
  -- 4. INSERT customer_interactions — sample interactions (for Lead Detail timeline)
  -- ============================================================================
  -- Skip if customer_interactions table has different schema — try-safe
  BEGIN
    INSERT INTO customer_interactions (tenant_id, customer_id, interaction_type, notes, occurred_at)
    SELECT
      v_tenant_id,
      c.id,
      (ARRAY['phone_call','email','line_chat','site_visit','meeting'])[1 + (i % 5)],
      (ARRAY[
        'สอบถามข้อมูลโครงการเพิ่มเติม',
        'นัดดูบ้านวันเสาร์',
        'ขอราคาพิเศษและเงื่อนไขผ่อน',
        'พูดคุยเรื่องสินเชื่อ',
        'follow up หลังเข้าชมโครงการ'
      ])[1 + (i % 5)],
      NOW() - ((i * 3) || ' days')::INTERVAL
    FROM customers c, generate_series(0, 1) AS i
    WHERE c.tenant_id = v_tenant_id
    LIMIT 15
    ON CONFLICT DO NOTHING;
    RAISE NOTICE 'Inserted customer interactions';
  EXCEPTION WHEN undefined_column THEN
    RAISE NOTICE 'Skipped customer_interactions (different schema)';
  END;

  RAISE NOTICE 'Demo data polish complete!';
END $$;
