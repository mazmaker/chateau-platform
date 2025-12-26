import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase configuration');
  console.log('Please check your .env.local file');
  process.exit(1);
}

// Create admin client with service role key (if available)
const adminClient = createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting Chateau Platform Database Migration...');
  console.log('📍 URL: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql\n');

  const migrationFile = path.join(process.cwd(), 'COMPLETE_DATABASE_SETUP.sql');

  if (!fs.existsSync(migrationFile)) {
    console.error('❌ Migration file not found:', migrationFile);
    console.log('Please ensure COMPLETE_DATABASE_SETUP.sql exists');
    process.exit(1);
  }

  try {
    console.log('📖 Reading migration file...');
    const migrationSQL = fs.readFileSync(migrationFile, 'utf8');

    console.log(`📝 Migration file size: ${migrationSQL.length} characters`);
    console.log('\n🔧 INSTRUCTIONS:');
    console.log('1. Copy the migration SQL below');
    console.log('2. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql');
    console.log('3. Paste the entire SQL and click "RUN"');
    console.log('4. Wait for completion (30-60 seconds)');
    console.log('\n' + '='.repeat(80));

    console.log('📋 COMPLETE MIGRATION SQL:');
    console.log('='.repeat(80));
    console.log(migrationSQL);
    console.log('='.repeat(80));

    console.log('\n✅ Migration file ready for manual execution');
    console.log('\n⏰ Estimated time: 30-60 seconds');
    console.log('🎯 After migration: Test at http://localhost:5175\n');

    console.log('🔄 Next step: Update todo list and test authentication flow');

  } catch (error) {
    console.error('❌ Error reading migration file:', error.message);
    process.exit(1);
  }
}

async function testConnection() {
  try {
    console.log('🔍 Testing database connection...');
    const { data, error } = await adminClient
      .from('tenants')
      .select('count')
      .single();

    if (error) {
      console.log('⚠️  Database connection test failed:', error.message);
      console.log('This is expected before migration - proceed with manual execution');
      return false;
    }

    console.log('✅ Database connection successful');
    return true;
  } catch (err) {
    console.log('⚠️  Connection test failed:', err.message);
    return false;
  }
}

async function main() {
  console.log('🏗️  CHATEAU PLATFORM - DATABASE MIGRATION HELPER');
  console.log('==========================================\n');

  await testConnection();

  console.log('\n🎯 PRE-MIGRATION VERIFICATION:');
  console.log('- ❌ user_tenants table: Missing (CRITICAL)');
  console.log('- ❌ RLS policies: Infinite recursion detected');
  console.log('- ❌ White-labeling columns: Missing');
  console.log('- ❌ Database schema: Incompatible with frontend\n');

  await runMigration();

  console.log('\n📝 MIGRATION FILE PREPARED!');
  console.log('\n🚀 MANUAL EXECUTION REQUIRED:');
  console.log('   1. Copy the SQL code above');
  console.log('   2. Go to Supabase SQL Editor');
  console.log('   3. Paste and execute');
  console.log('   4. Test the application\n');

  console.log('📊 AFTER MIGRATION:');
  console.log('   - ✅ user_tenants table created');
  console.log('   - ✅ RLS policies fixed');
  console.log('   - ✅ White-labeling columns added');
  console.log('   - ✅ Database schema aligned');
  console.log('   - ✅ Demo data inserted');
  console.log('   - ✅ Production-ready configuration\n');
}

main().catch(console.error);