-- Switch platform_leads.source from category-based values to concrete channels
-- (line / phone / email / event / referral / website). The Owner Leads "ที่มาของลีด"
-- dropdown lists these channels. Order matters: drop the old CHECK first, remap any
-- existing rows, then add the new CHECK (otherwise the remap violates the old constraint).

ALTER TABLE public.platform_leads DROP CONSTRAINT IF EXISTS platform_leads_source_check;

UPDATE public.platform_leads SET source = CASE source
  WHEN 'direct_inbound' THEN 'line'
  WHEN 'outbound'       THEN 'phone'
  WHEN 'demo_request'   THEN 'website'
  WHEN 'trial_signup'   THEN 'website'
  WHEN 'contact_sales'  THEN 'phone'
  ELSE source            -- 'event' and 'referral' stay the same
END
WHERE source IS NOT NULL;

ALTER TABLE public.platform_leads ADD CONSTRAINT platform_leads_source_check
  CHECK (source IN ('line','phone','email','event','referral','website'));
