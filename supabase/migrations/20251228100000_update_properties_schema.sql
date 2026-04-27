-- Update properties table schema for new project form fields

-- Add new property type values to enum
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'single_house';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'twin_house';
ALTER TYPE property_type ADD VALUE IF NOT EXISTS 'townhome';

-- Add new columns to properties table
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS thumbnail_url text,
ADD COLUMN IF NOT EXISTS total_units integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS floor_count integer,
ADD COLUMN IF NOT EXISTS has_facilities boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS province_id integer REFERENCES th_provinces(id),
ADD COLUMN IF NOT EXISTS district_id integer REFERENCES th_districts(id),
ADD COLUMN IF NOT EXISTS sub_district_id integer REFERENCES th_sub_districts(id),
ADD COLUMN IF NOT EXISTS developer text,
ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS information_links jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS is_featured boolean DEFAULT false;

-- Create indexes for location lookups
CREATE INDEX IF NOT EXISTS idx_properties_province ON properties(province_id);
CREATE INDEX IF NOT EXISTS idx_properties_district ON properties(district_id);
CREATE INDEX IF NOT EXISTS idx_properties_sub_district ON properties(sub_district_id);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(is_featured) WHERE is_featured = true;

-- Add comment for documentation
COMMENT ON COLUMN properties.thumbnail_url IS 'URL of the project thumbnail image';
COMMENT ON COLUMN properties.total_units IS 'Total number of units in the project';
COMMENT ON COLUMN properties.floor_count IS 'Number of floors in the building';
COMMENT ON COLUMN properties.has_facilities IS 'Whether the project has facilities';
COMMENT ON COLUMN properties.developer IS 'Name of the project developer/owner';
COMMENT ON COLUMN properties.attachments IS 'Array of attachment URLs (PDF, docs, etc)';
COMMENT ON COLUMN properties.information_links IS 'Links to sale kit, fact sheet, ROI calculator';
COMMENT ON COLUMN properties.is_featured IS 'Whether to show on homepage as featured';
