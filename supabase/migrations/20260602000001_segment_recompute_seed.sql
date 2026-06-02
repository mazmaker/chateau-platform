-- Segment system, part 1: freshness column + behavioral property-interest segments
-- + rewire the two dead buyer-intent segments to fields that already exist & are populated.
--
-- Context (audited): every segment's member_count was a one-time SEED value, wildly off
-- from live data (e.g. family stored 7 vs 178 real leads). first_home/investment pointed
-- at customers.preferences->>'buyer_type' which is NULL on every row, so they matched 0.
-- Rather than add a redundant input field, we point them at existing populated fields.

-- 1) Freshness column for the "อัปเดตล่าสุด" indicator (distinct from updated_at).
ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS last_computed_at timestamptz;
UPDATE public.segments SET last_computed_at = updated_at WHERE last_computed_at IS NULL;

-- 2) Behavioral property-interest segments — computed from a lead's actual interests
--    (lead_interests.property_id -> properties.type). New rule key: property_interest.
--    Seeded generically for every tenant that has leads; idempotent via (tenant_id, code).
INSERT INTO public.segments (tenant_id, code, name, description, filter_rules, target_type, member_count)
SELECT t.id, v.code, v.name, v.description, v.filter_rules::jsonb, 'lead', 0
FROM (SELECT DISTINCT tenant_id AS id FROM public.leads WHERE tenant_id IS NOT NULL) t
CROSS JOIN (VALUES
  ('interest_condo',        'สนใจคอนโด',      'Lead ที่แสดงความสนใจคอนโด (คำนวณจากยูนิตที่กดสนใจ)',       '{"property_interest":"condo"}'),
  ('interest_single_house', 'สนใจบ้านเดี่ยว',  'Lead ที่แสดงความสนใจบ้านเดี่ยว (คำนวณจากยูนิตที่กดสนใจ)',  '{"property_interest":"single_house"}')
) AS v(code, name, description, filter_rules)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- 3) Rewire the two dead buyer-intent segments to existing, populated fields so they
--    work immediately with NO new data entry:
--      first_home  -> leads.is_first_time_buyer = true            (136 leads in demo)
--      investment  -> customers.preferences->>'purchase_purpose'  (the existing dropdown)
UPDATE public.segments SET filter_rules = '{"is_first_time_buyer":true}'::jsonb     WHERE code = 'first_home';
UPDATE public.segments SET filter_rules = '{"purchase_purpose":"investment"}'::jsonb WHERE code = 'investment';

COMMENT ON COLUMN public.segments.last_computed_at IS
  'Set by recompute_segment_members() on each rebuild. Drives the อัปเดตล่าสุด badge in the campaign builder.';
