import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

async function testConnection() {
  console.log('🔍 Testing database connection...\n')

  // 1. Try to query tenants
  console.log('1️⃣ Testing tenants table...')
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*')

  if (tenantsError) {
    console.log('❌ Tenants error:', tenantsError.message)
    console.log('   Code:', tenantsError.code)
    console.log('   Details:', tenantsError.hint)
  } else {
    console.log('✅ Tenants work! Found:', tenants?.length || 0)
    console.log('   Data:', tenants)
  }

  // 2. Try to query users
  console.log('\n2️⃣ Testing users table...')
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('*')

  if (usersError) {
    console.log('❌ Users error:', usersError.message)
  } else {
    console.log('✅ Users work! Found:', users?.length || 0)
  }

  // 3. Try to query user_tenants
  console.log('\n3️⃣ Testing user_tenants table...')
  const { data: userTenants, error: utError } = await supabase
    .from('user_tenants')
    .select('*, tenants(*)')

  if (utError) {
    console.log('❌ User_tenants error:', utError.message)
    console.log('\n   Trying without join...')
    const { data: simpleUT, error: simpleUTError } = await supabase
      .from('user_tenants')
      .select('*')
    if (simpleUTError) {
      console.log('❌ Still error:', simpleUTError.message)
    } else {
      console.log('✅ Without join works!:', simpleUT)
    }
  } else {
    console.log('✅ User_tenants work! Found:', userTenants?.length || 0)
    console.log('   Data:', userTenants)
  }

  // 4. Sign in and test
  console.log('\n4️⃣ Testing with login...')
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: 'mazmakerv2.sup@gmail.com',
    password: 'Chateau2025!'
  })

  if (signInError) {
    console.log('❌ Login error:', signInError.message)
  } else {
    console.log('✅ Login success! User ID:', signInData.user.id)

    // Now test queries with auth
    console.log('\n5️⃣ Testing queries with authenticated session...')

    const { data: authTenants, error: authTenantsError } = await supabase
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', signInData.user.id)

    if (authTenantsError) {
      console.log('❌ Auth tenants error:', authTenantsError.message)
      console.log('   This means RLS is STILL blocking!')
    } else {
      console.log('✅ Auth tenants work!:', authTenants)
    }
  }
}

testConnection().catch(console.error)
