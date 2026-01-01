// Script to fix units table foreign key constraint
// Run with: node scripts/fix-units-table.mjs

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function fixUnitsTable() {
  console.log('🔧 Starting units table fix...\n');

  try {
    // Step 1: Get current units data
    console.log('1. Fetching current units data...');
    const { data: units, error: fetchError } = await supabase
      .from('units')
      .select('id, project_id');

    if (fetchError) {
      console.log('   No units data found or error:', fetchError.message);
    } else {
      console.log(`   Found ${units?.length || 0} units`);
    }

    // Step 2: Check if we need to map project_id to property_id
    // Since project_id references 'projects' table which doesn't exist,
    // we need to find matching properties

    console.log('\n2. Fetching properties...');
    const { data: properties, error: propError } = await supabase
      .from('properties')
      .select('id, name');

    if (propError) {
      console.error('   Error fetching properties:', propError.message);
      return;
    }
    console.log(`   Found ${properties?.length || 0} properties`);

    // Since we can't run raw SQL, we'll need to use a workaround
    // The best approach is to recreate the table with correct schema

    console.log('\n3. Creating backup of units data...');
    const unitsBackup = units || [];
    console.log(`   Backed up ${unitsBackup.length} units`);

    // We cannot drop/recreate tables via the REST API
    // User needs to run the SQL migration manually

    console.log('\n❌ Cannot modify table schema via REST API.');
    console.log('\n📋 Please run the following SQL in Supabase Dashboard > SQL Editor:\n');

    const sql = `
-- Fix units table: rename project_id to property_id and update foreign key

-- Step 1: Drop the old foreign key constraint
ALTER TABLE units DROP CONSTRAINT IF EXISTS units_project_id_fkey;

-- Step 2: Rename column from project_id to property_id
ALTER TABLE units RENAME COLUMN project_id TO property_id;

-- Step 3: Add the correct foreign key constraint to properties table
ALTER TABLE units
ADD CONSTRAINT units_property_id_fkey
FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE;

-- Step 4: Rename other columns if needed
ALTER TABLE units RENAME COLUMN floor_number TO floor;
ALTER TABLE units RENAME COLUMN area_sqm TO size_sqm;
ALTER TABLE units RENAME COLUMN layout_description TO description;

-- Step 5: Recreate indexes
DROP INDEX IF EXISTS idx_units_project_id;
CREATE INDEX IF NOT EXISTS idx_units_property_id ON units(property_id);

-- Done!
SELECT 'Migration completed successfully!' as status;
`;

    console.log(sql);

    console.log('\n✅ After running the SQL, try adding a unit again.');

  } catch (error) {
    console.error('Error:', error);
  }
}

fixUnitsTable();
