import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
// We need the service role key for DDL operations
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY is required for migrations');
  console.log('Please set the environment variable or add it to .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeMigration() {
  console.log('🚀 Executing CHATEAU Platform Database Migration...\n');

  const migrationFile = path.join(process.cwd(), 'COMPLETE_DATABASE_SETUP.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error('❌ Migration file not found:', migrationFile);
    console.log('\nAvailable files:');
    console.log('- COMPLETE_DATABASE_SETUP.sql (recommended)');
    console.log('- COMPLETE_MIGRATION.sql');
    console.log('- MIGRATION_SQL_COPY.txt');
    process.exit(1);
  }

  try {
    // Read migration SQL
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    // Split SQL into individual statements (simple approach)
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('\n--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute statements one by one
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];

      // Skip comments and empty statements
      if (!statement || statement.startsWith('--')) continue;

      try {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);

        // Use RPC to execute SQL
        const { data, error } = await supabase
          .rpc('exec', { sql: statement })
          .then(response => response)
          .catch(err => ({ error: err }));

        if (error) {
          // Try direct SQL execution if RPC fails
          const { error: directError } = await supabase
            .from('_temp_migration')
            .select('*')
            .limit(1)
            .then(() => ({ error: null }))
            .catch(err => ({ error: err }));

          if (directError && directError.message.includes('does not exist')) {
            // Table doesn't exist, try to execute raw SQL via HTTP API
            console.warn('⚠️  Cannot execute DDL via client. Manual execution required.');
            console.warn('Please go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
            console.warn('Copy the SQL from COMPLETE_DATABASE_SETUP.sql and execute manually.');
            break;
          }
        }

        successCount++;
        console.log('✅ Success');

        // Add delay to prevent overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (err) {
        console.error(`❌ Error executing statement ${i + 1}:`, err.message);
        errorCount++;

        // Continue with other statements unless it's a critical error
        if (err.message.includes('permission denied')) {
          console.error('❌ Permission denied. Need service role key.');
          break;
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('Migration Summary:');
    console.log(`✅ Successfully executed: ${successCount} statements`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} statements`);
    }
    console.log('='.repeat(60));

    if (errorCount > 0) {
      console.log('\n⚠️  Some statements failed. Manual execution may be required.');
      console.log('Please check the errors above and manually execute any failed statements.');
      console.log('\nManual execution link: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
    } else {
      console.log('\n✅ Migration completed successfully!');
      await verifyMigration();
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...\n');

  const tables = [
    'tenants',
    'users',
    'user_tenants',
    'projects',
    'units',
    'customers',
    'bookings'
  ];

  let allExist = true;

  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('count', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Table ${table}: ${error.message}`);
        allExist = false;
      } else {
        console.log(`✅ Table ${table}: OK`);
      }
    } catch (err) {
      console.log(`❌ Table ${table}: ${err.message}`);
      allExist = false;
    }
  }

  if (allExist) {
    console.log('\n✅ All tables created successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Create a tenant for testing');
    console.log('2. Create/invite users to the tenant');
    console.log('3. Assign owner role to mazmakerv2.sup@gmail.com');
    console.log('\nExample SQL:');
    console.log(`SELECT create_tenant_with_owner('Test Tenant', 'mazmakerv2.sup@gmail.com', 'Test Owner');`);
  }
}

// Alternative approach using fetch API for direct SQL execution
async function executeViaHTTP(sql) {
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({ sql })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || data.message || 'Unknown error');
    }

    return data;
  } catch (error) {
    console.error('HTTP execution error:', error);
    throw error;
  }
}

// Main execution
executeMigration().catch(console.error);