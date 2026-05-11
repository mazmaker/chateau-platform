-- Project-level location, master plan, nearby places (PROPERTY HUB parity)
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS master_plan_url text,
  ADD COLUMN IF NOT EXISTS location_lat numeric,
  ADD COLUMN IF NOT EXISTS location_lng numeric,
  ADD COLUMN IF NOT EXISTS nearby jsonb;

COMMENT ON COLUMN public.properties.master_plan_url IS 'URL to project master plan image/PDF (overview of all plots/buildings)';
COMMENT ON COLUMN public.properties.location_lat IS 'Latitude for map embed';
COMMENT ON COLUMN public.properties.location_lng IS 'Longitude for map embed';
COMMENT ON COLUMN public.properties.nearby IS 'Array of nearby places: [{name, type, distance_km}]';
