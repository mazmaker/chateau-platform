-- PROPERTY HUB-style unit fields
-- All nullable, no breaking changes
ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS promo_price numeric,
  ADD COLUMN IF NOT EXISTS plot_number text,
  ADD COLUMN IF NOT EXISTS view text,
  ADD COLUMN IF NOT EXISTS floor_plan_url text,
  ADD COLUMN IF NOT EXISTS tour_3d_url text,
  ADD COLUMN IF NOT EXISTS furnishing text;

COMMENT ON COLUMN public.units.promo_price IS 'Promotional price (lower than list price). NULL = no promo.';
COMMENT ON COLUMN public.units.plot_number IS 'Plot/lot identifier within project (e.g. C-012)';
COMMENT ON COLUMN public.units.view IS 'View description (สวน, สระว่ายน้ำ, เมือง, ทะเล)';
COMMENT ON COLUMN public.units.floor_plan_url IS 'URL to floor plan image or PDF';
COMMENT ON COLUMN public.units.tour_3d_url IS 'URL to 3D/VR tour (Matterport, etc.)';
COMMENT ON COLUMN public.units.furnishing IS 'Furnishing level: fully | partial | unfurnished';
