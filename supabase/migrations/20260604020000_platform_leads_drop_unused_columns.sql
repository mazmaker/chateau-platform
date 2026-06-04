-- Drop platform_leads columns that were intentionally removed from the Owner Leads
-- form during field pruning (2026-06-04) but left orphaned in the schema.
--   company_size / current_units_count / projects_needed — the user removed these
--     inputs as unnecessary; plan + current_projects_count already size the deal.
--   website — scaffolded but never surfaced. We sell TO these developer companies,
--     so their corporate site adds no qualification signal here.
-- The only values present were our own seed/demo rows, so dropping loses no real data.

ALTER TABLE public.platform_leads
  DROP COLUMN IF EXISTS company_size,
  DROP COLUMN IF EXISTS current_units_count,
  DROP COLUMN IF EXISTS projects_needed,
  DROP COLUMN IF EXISTS website;
