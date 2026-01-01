-- Fix units table foreign key to reference properties table instead of projects

-- Step 1: Drop the old foreign key constraint if it exists
ALTER TABLE IF EXISTS units DROP CONSTRAINT IF EXISTS units_project_id_fkey;

-- Step 2: Rename column from project_id to property_id if project_id exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'project_id'
    ) THEN
        -- Check if property_id doesn't exist yet
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'units' AND column_name = 'property_id'
        ) THEN
            ALTER TABLE units RENAME COLUMN project_id TO property_id;
        ELSE
            -- If both exist, update property_id with project_id values and drop project_id
            UPDATE units SET property_id = project_id WHERE property_id IS NULL;
            ALTER TABLE units DROP COLUMN project_id;
        END IF;
    END IF;
END $$;

-- Step 3: Add the correct foreign key constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'units_property_id_fkey'
        AND table_name = 'units'
    ) THEN
        ALTER TABLE units
        ADD CONSTRAINT units_property_id_fkey
        FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Add missing columns if they don't exist
DO $$
BEGIN
    -- Add floor column if it doesn't exist (might be named floor_number)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'floor'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'units' AND column_name = 'floor_number'
        ) THEN
            ALTER TABLE units RENAME COLUMN floor_number TO floor;
        ELSE
            ALTER TABLE units ADD COLUMN floor integer;
        END IF;
    END IF;

    -- Add description column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'description'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'units' AND column_name = 'layout_description'
        ) THEN
            ALTER TABLE units RENAME COLUMN layout_description TO description;
        ELSE
            ALTER TABLE units ADD COLUMN description text;
        END IF;
    END IF;

    -- Add size_sqm if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'units' AND column_name = 'size_sqm'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'units' AND column_name = 'area_sqm'
        ) THEN
            ALTER TABLE units RENAME COLUMN area_sqm TO size_sqm;
        ELSE
            ALTER TABLE units ADD COLUMN size_sqm decimal(10,2);
        END IF;
    END IF;
END $$;

-- Recreate index on property_id
DROP INDEX IF EXISTS idx_units_project_id;
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);

-- Add comment
COMMENT ON TABLE units IS 'Individual units within a property - Foreign key fixed to reference properties table';
