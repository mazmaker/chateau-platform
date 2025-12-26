import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function verifySchema() {
  console.log('🔍 Verifying database schema for Epic 0 Authentication...\n');

  const requiredTables = [
    'tenants',
    'users',
    'user_tenants',
    'properties',
    'customers',
    'bookings'
  ];

  const schemaIssues = [];

  // Check if required tables exist and have correct columns
  for (const tableName of requiredTables) {
    try {
      console.log(`📋 Checking table: ${tableName}`);

      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (error) {
        console.log(`❌ Error accessing ${tableName}: ${error.message}`);

        if (error.code === 'PGRST116') {
          schemaIssues.push(`Table '${tableName}' does not exist or no permissions`);
        } else {
          schemaIssues.push(`Error accessing ${tableName}: ${error.message}`);
        }
      } else {
        console.log(`✅ Table ${tableName} is accessible`);

        // Check specific fields for important tables
        if (tableName === 'users') {
          const user = data[0];
          if (!user || !('metadata' in user)) {
            schemaIssues.push("Table 'users' missing 'metadata' column");
          } else {
            console.log("  ✅ 'metadata' column exists");
          }
        }

        if (tableName === 'tenants') {
          const tenant = data[0];
          if (!tenant || !('primary_color' in tenant)) {
            schemaIssues.push("Table 'tenants' missing white-labeling columns");
          } else {
            console.log("  ✅ White-labeling columns exist");
          }
        }
      }
    } catch (err) {
      console.log(`❌ Unexpected error checking ${tableName}: ${err.message}`);
      schemaIssues.push(`Unexpected error with ${tableName}: ${err.message}`);
    }
  }

  // Check if user_tenants table exists specifically
  console.log('\n🎯 Critical check: user_tenants table');
  try {
    const { data: userTenants, error } = await supabase
      .from('user_tenants')
      .select('*')
      .limit(1);

    if (error) {
      console.log(`❌ user_tenants table error: ${error.message}`);
      schemaIssues.push("user_tenants table does not exist - THIS IS REQUIRED for multi-tenant authentication");
    } else {
      console.log("✅ user_tenants table exists");
      if (userTenants.length > 0) {
        const ut = userTenants[0];
        console.log(`  ✅ Sample record: user_id=${ut.user_id?.substring(0, 8)}..., tenant_id=${ut.tenant_id?.substring(0, 8)}..., role=${ut.role}`);
      }
    }
  } catch (err) {
    console.log(`❌ Critical error checking user_tenants: ${err.message}`);
    schemaIssues.push("Critical error with user_tenants table");
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 SCHEMA VERIFICATION SUMMARY');
  console.log('='.repeat(50));

  if (schemaIssues.length === 0) {
    console.log('🎉 All schema checks PASSED! Database is ready for Epic 0.');
    console.log('\n✅ Next steps:');
    console.log('1. Test user registration at http://localhost:5175/auth/register');
    console.log('2. Test login at http://localhost:5175/auth/login');
    console.log('3. Verify dashboard loads correctly');
  } else {
    console.log('❌ Schema issues found:');
    schemaIssues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });

    console.log('\n🔧 TO FIX THESE ISSUES:');
    console.log('1. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
    console.log('2. Run the migration files in order:');
    console.log('   - supabase/migrations/20250122000000_fix_auth_schema.sql');
    console.log('   - supabase/migrations/20250122000001_update_business_tables.sql');
    console.log('3. Refer to MIGRATIONS.md for detailed instructions');
  }

  return schemaIssues.length === 0;
}

// Run verification
verifySchema()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Verification script failed:', error);
    process.exit(1);
  });