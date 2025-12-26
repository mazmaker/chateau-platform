/**
 * FINAL SETUP - Run this AFTER running the SQL in Supabase
 */
import { createClient } from '@supabase/supabase-js'
import { exec } from 'child_process'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

async function finalSetup() {
  console.log('\n🚀 FINAL SETUP...\n')

  // Sign in
  console.log('1️⃣  Signing in...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'mazmakerv2.sup@gmail.com',
    password: 'Chateau2025!'
  })

  if (signInError) {
    console.log('❌ Login failed. Did you create the user in Supabase?')
    return
  }

  console.log('   ✅ Logged in:', signInData.user.id)

  // Create profile
  console.log('\n2️⃣  Creating profile...')
  await supabase.from('users').upsert({
    id: signInData.user.id,
    email: 'mazmakerv2.sup@gmail.com',
    full_name: 'Platform Owner'
  })
  console.log('   ✅ Profile created')

  // Get tenant
  console.log('\n3️⃣  Getting tenant...')
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .select('*')
    .eq('slug', 'chateau-platform')
    .single()

  if (tenantError || !tenant) {
    console.log('❌ Tenant not found!')
    console.log('\n⚠️  DID YOU RUN THE SQL IN SUPABASE?')
    console.log('\n1. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql')
    console.log('2. Run the SQL from RUN_THIS_SQL.txt')
    console.log('3. Run this script again\n')
    return
  }

  console.log('   ✅ Tenant found:', tenant.id)

  // Link user to tenant
  console.log('\n4️⃣  Assigning OWNER role...')
  const { error: linkError } = await supabase
    .from('user_tenants')
    .upsert({
      user_id: signInData.user.id,
      tenant_id: tenant.id,
      role: 'owner',
      is_active: true
    })

  if (linkError) {
    console.log('❌ Error:', linkError.message)
    return
  }

  console.log('   ✅ Owner role assigned!')

  // Success!
  console.log('\n' + '='.repeat(60))
  console.log('🎉 SETUP COMPLETE!')
  console.log('='.repeat(60))
  console.log('\n📝 Login info:')
  console.log('   URL:   http://localhost:5174/auth/login')
  console.log('   Email: mazmakerv2.sup@gmail.com')
  console.log('   Pass:  Chateau2025!')
  console.log('   Role:  OWNER ✅')
  console.log('\n')

  // Open login page
  exec('open http://localhost:5174/auth/login')
}

finalSetup().catch(console.error)
