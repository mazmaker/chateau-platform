-- Normalize legacy purchase_purpose values in customers.preferences to canonical 5-category set:
--   residence / investment / vacation / family / other
--
-- Old granular values are collapsed:
--   own_residence                          → residence
--   speculation / monthly_rent / daily_rent / flip  → investment
--   children / parents                     → family
--   "other:..." free-text                  → other  (free text intentionally dropped — collected in notes)

UPDATE public.customers
SET preferences = jsonb_set(
  preferences,
  '{purchase_purpose}',
  '"residence"'
)
WHERE preferences->>'purchase_purpose' = 'own_residence';

UPDATE public.customers
SET preferences = jsonb_set(
  preferences,
  '{purchase_purpose}',
  '"investment"'
)
WHERE preferences->>'purchase_purpose' IN ('speculation', 'monthly_rent', 'daily_rent', 'flip');

UPDATE public.customers
SET preferences = jsonb_set(
  preferences,
  '{purchase_purpose}',
  '"family"'
)
WHERE preferences->>'purchase_purpose' IN ('children', 'parents');

UPDATE public.customers
SET preferences = jsonb_set(
  preferences,
  '{purchase_purpose}',
  '"other"'
)
WHERE preferences->>'purchase_purpose' LIKE 'other:%';
