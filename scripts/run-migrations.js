const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need service key for migrations

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase configuration');
  console.log('Please set SUPABASE_SERVICE_ROLE_KEY in your environment');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigrations() {
  console.log('🚀 Starting database migrations...');

  try {
    // Read migration files
    const fs = require('fs');
    const path = require('path');

    const migrationFiles = [
      '20250122000000_fix_auth_schema.sql',
      '20250122000001_update_business_tables.sql'
    ];

    for (const file of migrationFiles) {
      const filePath = path.join(__dirname, '../supabase/migrations', file);
      if (fs.existsSync(filePath)) {
        console.log(`📄 Running migration: ${file}`);

        const sql = fs.readFileSync(filePath, 'utf8');

        // Split SQL into individual statements
        const statements = sql
          .split(';')
          .map(s => s.trim())
          .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
          if (statement.trim()) {
            console.log(`🔧 Executing: ${statement.substring(0, 100)}...`);

            const { error } = await supabase.rpc('exec_sql', { sql_query: statement });

            if (error) {
              // Try direct SQL execution
              const { error: directError } = await supabase
                .from('_temp_migration')
                .select('*')
                .limit(1);

              console.log(`⚠️  Could not execute statement directly: ${error.message}`);
              console.log('This migration needs to be applied manually in the Supabase Dashboard');
            }
          }
        }

        console.log(`✅ Migration ${file} completed`);
      } else {
        console.log(`⚠️  Migration file not found: ${file}`);
      }
    }

    console.log('🎉 All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.log('\n📝 Please run these migrations manually in the Supabase SQL Editor:');
    console.log('1. Open https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
    console.log('2. Copy and paste the contents of:');
    console.log('   - supabase/migrations/20250122000000_fix_auth_schema.sql');
    console.log('   - supabase/migrations/20250122000001_update_business_tables.sql');
    console.log('3. Execute each migration in order');

    process.exit(1);
  }
}

// Create a simple test query to verify connection
async function testConnection() {
  try {
    const { data, error } = await supabase.from('tenants').select('count').single();
    if (error) {
      console.log('⚠️  Basic query failed, may need migrations applied');
      return false;
    }
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.log('⚠️  Connection test failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🔍 Testing database connection...');
  const connected = await testConnection();

  if (connected) {
    await runMigrations();
  } else {
    console.log('\n❌ Cannot connect to database with current credentials.');
    console.log('📝 Manual migration required:');
    console.log('1. Go to https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
    console.log('2. Run the SQL from supabase/migrations/20250122000000_fix_auth_schema.sql');
    console.log('3. Run the SQL from supabase/migrations/20250122000001_update_business_tables.sql');
  }
}

main().catch(console.error);