// Script to create leads table using pg package
import pg from 'pg';

const { Client } = pg;

// Database connection - you need to provide the password
// Get it from: Supabase Dashboard > Settings > Database > Connection string
const connectionString = process.env.DATABASE_URL ||
  'postgresql://postgres.pqnjvcbmnatrtvpqnrdx:YOUR_DB_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const sql = `
-- Create leads table for tracking potential customers
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiating', 'won', 'lost')),
    source VARCHAR(255),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    estimated_value DECIMAL(15,2),
    expected_close_date DATE,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for leads table
DROP POLICY IF EXISTS "Service role has full access" ON leads;
CREATE POLICY "Service role has full access" ON leads FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view tenant leads" ON leads;
CREATE POLICY "Users view tenant leads" ON leads FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users insert tenant leads" ON leads;
CREATE POLICY "Users insert tenant leads" ON leads FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users update tenant leads" ON leads;
CREATE POLICY "Users update tenant leads" ON leads FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users delete tenant leads" ON leads;
CREATE POLICY "Users delete tenant leads" ON leads FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Storage policies for 'leads' bucket
DROP POLICY IF EXISTS "Allow authenticated uploads to leads" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to leads" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'leads');

DROP POLICY IF EXISTS "Allow public read from leads" ON storage.objects;
CREATE POLICY "Allow public read from leads" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'leads');

DROP POLICY IF EXISTS "Allow authenticated updates to leads" ON storage.objects;
CREATE POLICY "Allow authenticated updates to leads" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'leads');

DROP POLICY IF EXISTS "Allow authenticated deletes from leads" ON storage.objects;
CREATE POLICY "Allow authenticated deletes from leads" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'leads');
`;

async function runMigration() {
  if (connectionString.includes('YOUR_DB_PASSWORD')) {
    console.log('❌ Please provide DATABASE_URL environment variable');
    console.log('');
    console.log('Get your database password from:');
    console.log('Supabase Dashboard > Settings > Database > Connection string');
    console.log('');
    console.log('Then run:');
    console.log('DATABASE_URL="postgresql://postgres.pqnjvcbmnatrtvpqnrdx:YOUR_PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" node scripts/run-leads-migration.mjs');
    return;
  }

  const client = new Client({ connectionString });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();

    console.log('📝 Running migration...');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('The leads table has been created with:');
    console.log('- All required columns and indexes');
    console.log('- RLS policies for multi-tenant security');
    console.log('- Storage policies for file uploads');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  } finally {
    await client.end();
  }
}

runMigration();
