-- Add user tracking columns to properties table
-- This enables tracking who created and last updated each property

-- Add user tracking columns
ALTER TABLE properties
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES users(id) ON DELETE SET NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_properties_created_by ON properties(created_by);
CREATE INDEX IF NOT EXISTS idx_properties_updated_by ON properties(updated_by);

-- Add column comments for documentation
COMMENT ON COLUMN properties.created_by IS 'User who created this property';
COMMENT ON COLUMN properties.updated_by IS 'User who last updated this property';

-- Update the trigger to set updated_by when properties are modified
CREATE OR REPLACE FUNCTION update_properties_updated_by()
RETURNS TRIGGER AS $$
BEGIN
    -- Set updated_at timestamp (existing functionality)
    NEW.updated_at = now();

    -- Set updated_by to current user if authenticated
    -- This will be NULL for system operations or when user context is not available
    NEW.updated_by = auth.uid();

    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create trigger for updated_by tracking
DROP TRIGGER IF EXISTS trigger_properties_updated_by ON properties;
CREATE TRIGGER trigger_properties_updated_by
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_properties_updated_by();

-- For new properties, we'll set created_by in the application code
-- since auth.uid() might not be available in all contexts

-- Update activity_logs enum to include property tracking activities
DO $$
BEGIN
    -- Check if the values already exist before adding them
    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'activity_type'
        AND e.enumlabel = 'property_created'
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'property_created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'activity_type'
        AND e.enumlabel = 'property_updated'
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'property_updated';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON t.oid = e.enumtypid
        WHERE t.typname = 'activity_type'
        AND e.enumlabel = 'property_deleted'
    ) THEN
        ALTER TYPE activity_type ADD VALUE 'property_deleted';
    END IF;
END $$;

-- Function to get properties with creator information
CREATE OR REPLACE FUNCTION get_properties_with_creators(p_tenant_id uuid)
RETURNS TABLE (
    id uuid,
    tenant_id uuid,
    name text,
    type property_type,
    description text,
    address jsonb,
    base_price decimal(10,2),
    currency char(3),
    is_active boolean,
    created_at timestamptz,
    updated_at timestamptz,
    created_by uuid,
    updated_by uuid,
    creator_name text,
    updater_name text,
    creator_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id,
        p.tenant_id,
        p.name,
        p.type,
        p.description,
        p.address,
        p.base_price,
        p.currency,
        p.is_active,
        p.created_at,
        p.updated_at,
        p.created_by,
        p.updated_by,
        COALESCE(creator.full_name, 'ระบบเก่า') as creator_name,
        updater.full_name as updater_name,
        CASE
            WHEN p.created_by IS NULL THEN 'legacy'
            WHEN creator.id IS NULL THEN 'deleted'
            ELSE 'active'
        END as creator_status
    FROM properties p
    LEFT JOIN users creator ON p.created_by = creator.id
    LEFT JOIN users updater ON p.updated_by = updater.id
    WHERE p.tenant_id = p_tenant_id
    ORDER BY p.created_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_properties_with_creators TO authenticated;
GRANT EXECUTE ON FUNCTION update_properties_updated_by TO authenticated;