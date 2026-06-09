-- Mark the SaaS vendor's OWN tenant (the platform owner, e.g. MAZMAKER) so it can be
-- excluded from customer-facing tenant lists / counts / MRR in the Owner console.
-- The platform Owner = us; we are NOT one of our own customers, but every user must
-- still belong to a tenant (users.tenant_id is NOT NULL), so the Owner is parked on a
-- dedicated is_platform tenant rather than being decoupled.
--
-- Additive, low-risk: existing customer tenants default to false.
-- NOTE: the MAZMAKER tenant row + repointing the owner accounts to it is environment
-- data (depends on the seeded owner auth users), applied directly to the DB — not here.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS is_platform boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.tenants.is_platform IS
  'True only for the SaaS vendor''s own tenant (the platform owner, e.g. MAZMAKER). Excluded from customer-facing tenant lists / counts / MRR in the Owner console.';
