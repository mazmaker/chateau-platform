-- Add missing columns to units table for the Add Unit form
-- These columns support: land area, floor count, and thumbnail image

-- Add land_area_sqw column (for houses with land)
ALTER TABLE units ADD COLUMN IF NOT EXISTS land_area_sqw decimal(10,2);

-- Add floor_count column (for multi-story units)
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor_count integer DEFAULT 1;

-- Add thumbnail_url column (for unit thumbnail image)
ALTER TABLE units ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Add comments for documentation
COMMENT ON COLUMN units.land_area_sqw IS 'Land area in square wa (for houses)';
COMMENT ON COLUMN units.floor_count IS 'Number of floors in the unit';
COMMENT ON COLUMN units.thumbnail_url IS 'URL of the unit thumbnail image';
