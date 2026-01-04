// Script to add billing columns using Supabase client via direct HTTP
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function addBillingColumns() {
  try {
    console.log('🔄 Adding billing columns to tenants table...\n');

    // Step 1: Create a temporary RPC function to execute SQL
    console.log('Step 1: Creating SQL executor function...');

    const createFunctionSQL = `
      CREATE OR REPLACE FUNCTION execute_sql(sql_query text)
      RETURNS text
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        result text;
      BEGIN
        EXECUTE sql_query;
        RETURN 'OK';
      END;
      $$;
    `;

    // Try using the postgres schema directly via REST
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        query: createFunctionSQL
      })
    });

    if (response.ok) {
      console.log('✅ Function created');
    } else {
      console.log('⚠️ Could not create function, trying direct approach...');
    }

    // Step 2: Now try to create each column individually
    console.log('\nStep 2: Adding billing columns...\n');

    const columns = [
      { name: 'billing_address', type: 'text' },
      { name: 'billing_email', type: 'text' },
      { name: 'billing_phone', type: 'text' },
      { name: 'tax_id', type: 'text' }
    ];

    for (const col of columns) {
      console.log(`Adding ${col.name}...`);

      const alterSQL = `
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'tenants' AND column_name = '${col.name}'
          ) THEN
            ALTER TABLE tenants ADD COLUMN ${col.name} ${col.type};
          END IF;
        END $$;
      `;

      // Use Supabase RPC to execute the SQL
      const { data, error } = await supabase.rpc('execute_sql', {
        sql_query: alterSQL
      });

      if (error) {
        // If RPC doesn't exist, try creating it first with a different approach
        console.log(`  ⚠️ RPC failed, trying direct table modification...`);

        // Try using the REST API to modify the table schema
        // This won't work directly, so we'll need to use a different method
        console.log(`  ❌ Could not add ${col.name}:`, error.message);
      } else {
        console.log(`  ✅ Added ${col.name}`);
      }
    }

    // Step 3: Verify columns were added
    console.log('\nStep 3: Verifying columns...\n');

    const { data: tenantsData, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, billing_address, billing_email, billing_phone, tax_id')
      .limit(1);

    if (tenantsError) {
      if (tenantsError.message.includes('column')) {
        console.log('❌ Columns still not added. Error:', tenantsError.message);
        console.log('\n📋 SQL to run manually in Supabase Dashboard:');
        console.log('==========================================\n');
        console.log(`ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS billing_address text,
ADD COLUMN IF NOT EXISTS billing_email text,
ADD COLUMN IF NOT EXISTS billing_phone text,
ADD COLUMN IF NOT EXISTS tax_id text;\n`);
        console.log('==========================================');
        console.log('\nGo to: https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql\n');
      } else {
        console.log('Error:', tenantsError.message);
      }
    } else {
      console.log('✅ SUCCESS! Billing columns are now available.');
      console.log('Sample data:', tenantsData);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

addBillingColumns();
