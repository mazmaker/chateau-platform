-- Create units table for storing individual units within properties/projects

-- Create unit status enum
DO $$ BEGIN
    CREATE TYPE unit_status AS ENUM ('available', 'reserved', 'sold', 'unavailable');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create units table
CREATE TABLE IF NOT EXISTS units (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
    property_id uuid REFERENCES properties(id) ON DELETE CASCADE NOT NULL,

    -- Basic info
    unit_number text NOT NULL,
    floor integer,

    -- Pricing
    price decimal(15,2) NOT NULL,

    -- Images
    thumbnail_url text,
    images jsonb DEFAULT '[]',

    -- Dimensions
    size_sqm decimal(10,2),
    land_area_sqw decimal(10,2),

    -- Room details
    bedrooms integer DEFAULT 0,
    bathrooms integer DEFAULT 0,
    floor_count integer DEFAULT 1,

    -- Additional info
    description text,

    -- Status
    status unit_status DEFAULT 'available',

    -- Metadata
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id),

    -- Constraints
    UNIQUE(property_id, unit_number)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_units_tenant_id ON units(tenant_id);
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);
CREATE INDEX IF NOT EXISTS idx_units_status ON units(status);
CREATE INDEX IF NOT EXISTS idx_units_price ON units(price);
CREATE INDEX IF NOT EXISTS idx_units_bedrooms ON units(bedrooms);

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_units_updated_at ON units;
CREATE TRIGGER update_units_updated_at
    BEFORE UPDATE ON units
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE units ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view units in their tenant
CREATE POLICY "Users can view units in their tenant"
ON units FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Admins can create units
CREATE POLICY "Admins can create units"
ON units FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- Admins can update units
CREATE POLICY "Admins can update units"
ON units FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

-- Owner can delete units
CREATE POLICY "Owner can delete units"
ON units FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));

-- Add comments for documentation
COMMENT ON TABLE units IS 'Individual units within a property/project';
COMMENT ON COLUMN units.unit_number IS 'Unit identifier (e.g., A101, B202)';
COMMENT ON COLUMN units.floor IS 'Floor number for condo/apartment units';
COMMENT ON COLUMN units.price IS 'Sale price in THB';
COMMENT ON COLUMN units.thumbnail_url IS 'URL of the unit thumbnail image';
COMMENT ON COLUMN units.images IS 'Array of image URLs for the unit gallery';
COMMENT ON COLUMN units.size_sqm IS 'Usable area in square meters';
COMMENT ON COLUMN units.land_area_sqw IS 'Land area in square wa (for houses)';
COMMENT ON COLUMN units.bedrooms IS 'Number of bedrooms';
COMMENT ON COLUMN units.bathrooms IS 'Number of bathrooms';
COMMENT ON COLUMN units.floor_count IS 'Number of floors in the unit (for multi-story units)';
COMMENT ON COLUMN units.description IS 'Additional information about the unit';
COMMENT ON COLUMN units.status IS 'Current status: available, reserved, sold, unavailable';
