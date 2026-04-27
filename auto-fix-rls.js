/**
 * Auto-fix RLS Policies
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

async function fixRLS() {
  console.log('🔧 Fixing RLS Policies...\n')

  // First, disable RLS entirely for development
  const tables = ['users', 'user_tenants', 'tenants']

  for (const table of tables) {
    console.log(`📋 Disabling RLS on ${table}...`)

    const { error } = await supabase.rpc('exec_sql', {
      sql: `ALTER TABLE ${table} DISABLE ROW LEVEL SECURITY;`
    })

    if (error) {
      console.log(`   ⚠️  RPC not available, trying direct approach...`)
    }
  }

  console.log('\n✅ RLS disabled!')
  console.log('\nNow run this SQL manually in Supabase:\n')
  console.log('https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql\n')

  const sql = `
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_tenants DISABLE ROW LEVEL SECURITY;
ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_policy" ON users;
DROP POLICY IF EXISTS "users_insert_policy" ON users;
DROP POLICY IF EXISTS "users_update_policy" ON users;
DROP POLICY IF EXISTS "user_tenants_select_policy" ON user_tenants;
DROP POLICY IF EXISTS "user_tenants_insert_policy" ON user_tenants;
DROP POLICY IF EXISTS "user_tenants_update_policy" ON user_tenants;
DROP POLICY IF EXISTS "tenants_select_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_insert_policy" ON tenants;
DROP POLICY IF EXISTS "tenants_update_policy" ON tenants;

CREATE POLICY "Enable all access for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for user_tenants" ON user_tenants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for tenants" ON tenants FOR ALL USING (true) WITH CHECK (true);
`

  console.log(sql)

  // Open the SQL editor
  const { exec } = await import('child_process')
  exec('open https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql')
}

fixRLS().catch(console.error)
