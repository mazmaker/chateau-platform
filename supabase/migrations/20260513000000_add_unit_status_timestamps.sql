-- Track when a unit transitioned to reserved / sold status.
-- Needed for board-level dashboard KPIs: revenue MTD/YTD, sell-through rate, days of inventory.

ALTER TABLE public.units
  ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.track_unit_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'reserved' AND (OLD.status IS DISTINCT FROM 'reserved') THEN
    NEW.reserved_at = COALESCE(NEW.reserved_at, NOW());
  END IF;

  IF NEW.status = 'sold' AND (OLD.status IS DISTINCT FROM 'sold') THEN
    NEW.sold_at = COALESCE(NEW.sold_at, NOW());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS unit_status_change_tracking ON public.units;
CREATE TRIGGER unit_status_change_tracking
  BEFORE UPDATE ON public.units
  FOR EACH ROW
  EXECUTE FUNCTION public.track_unit_status_change();

-- Backfill historical rows using updated_at as best-guess
UPDATE public.units
  SET reserved_at = updated_at
  WHERE status = 'reserved' AND reserved_at IS NULL;

UPDATE public.units
  SET sold_at = updated_at
  WHERE status = 'sold' AND sold_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_units_sold_at     ON public.units(sold_at)     WHERE status = 'sold';
CREATE INDEX IF NOT EXISTS idx_units_reserved_at ON public.units(reserved_at) WHERE status = 'reserved';
