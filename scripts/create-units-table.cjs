/**
 * Script to create units table and storage bucket
 * Usage: node scripts/create-units-table.cjs
 */

const { Client } = require('pg');
const readline = require('readline');

const PROJECT_REF = 'pqnjvcbmnatrtvpqnrdx';

// SQL to create units table
const CREATE_UNITS_SQL = `
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
    unit_number text NOT NULL,
    floor integer,
    price decimal(15,2) NOT NULL,
    thumbnail_url text,
    images jsonb DEFAULT '[]',
    size_sqm decimal(10,2),
    land_area_sqw decimal(10,2),
    bedrooms integer DEFAULT 0,
    bathrooms integer DEFAULT 0,
    floor_count integer DEFAULT 1,
    description text,
    status unit_status DEFAULT 'available',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    created_by uuid REFERENCES users(id),
    UNIQUE(property_id, unit_number)
);

-- Create indexes
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

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view units in their tenant" ON units;
DROP POLICY IF EXISTS "Admins can create units" ON units;
DROP POLICY IF EXISTS "Admins can update units" ON units;
DROP POLICY IF EXISTS "Owner can delete units" ON units;

-- RLS Policies
CREATE POLICY "Users can view units in their tenant"
ON units FOR SELECT
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Admins can create units"
ON units FOR INSERT
WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Admins can update units"
ON units FOR UPDATE
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role IN ('owner', 'admin')));

CREATE POLICY "Owner can delete units"
ON units FOR DELETE
USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid() AND role = 'owner'));
`;

// SQL to create storage bucket
const CREATE_STORAGE_SQL = `
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'units',
  'units',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;
`;

const CREATE_STORAGE_POLICIES_SQL = `
-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public read access for units bucket" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can upload to units bucket" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can update files in units bucket" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Authenticated users can delete files in units bucket" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Create new policies
CREATE POLICY "Public read access for units bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'units');

CREATE POLICY "Authenticated users can upload to units bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'units' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update files in units bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'units' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete files in units bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'units' AND auth.role() = 'authenticated');
`;

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => rl.question(query, ans => {
    rl.close();
    resolve(ans);
  }));
}

async function main() {
  console.log('\n========================================');
  console.log('  CHATEAU Platform - Create Units Table');
  console.log('========================================\n');

  // Get database password
  const password = await askQuestion('Enter your Supabase database password: ');

  if (!password) {
    console.log('\n❌ Password is required');
    console.log('You can find it in Supabase Dashboard > Settings > Database > Database password');
    process.exit(1);
  }

  // Connection string
  const connectionString = `postgres://postgres.${PROJECT_REF}:${password}@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Step 1: Create units table
    console.log('📦 Step 1: Creating units table...');
    await client.query(CREATE_UNITS_SQL);
    console.log('✅ Units table created!\n');

    // Step 2: Create storage bucket
    console.log('📦 Step 2: Creating storage bucket...');
    await client.query(CREATE_STORAGE_SQL);
    console.log('✅ Storage bucket created!\n');

    // Step 3: Create storage policies
    console.log('📦 Step 3: Creating storage policies...');
    await client.query(CREATE_STORAGE_POLICIES_SQL);
    console.log('✅ Storage policies created!\n');

    console.log('========================================');
    console.log('🎉 All migrations completed successfully!');
    console.log('========================================\n');
    console.log('You can now use the "Add Unit" form to save data to the database.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);

    if (error.message.includes('password authentication failed')) {
      console.log('\n💡 Tip: Make sure you are using the correct database password.');
      console.log('   Find it at: Supabase Dashboard > Settings > Database > Database password');
    } else if (error.message.includes('connection refused') || error.message.includes('timeout')) {
      console.log('\n💡 Tip: Check your internet connection and try again.');
    }

    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
