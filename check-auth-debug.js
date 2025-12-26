import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

async function checkAuth() {
  console.log('🔍 Checking authentication...\n')

  // 1. Check session
  console.log('1️⃣ Checking session...')
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()

  if (sessionError) {
    console.log('❌ Session error:', sessionError.message)
    return
  }

  if (!session) {
    console.log('❌ No session found. User not logged in.')
    return
  }

  console.log('✅ Session found:', session.user.email)
  console.log('   User ID:', session.user.id)

  // 2. Check user profile
  console.log('\n2️⃣ Checking user profile...')
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('*')
    .eq('id', session.user.id)
    .single()

  if (profileError) {
    console.log('❌ Profile error:', profileError.message)
    console.log('   Details:', profileError)
  } else {
    console.log('✅ Profile found:', profile)
  }

  // 3. Check user_tenants
  console.log('\n3️⃣ Checking user_tenants...')
  const { data: userTenants, error: tenantsError } = await supabase
    .from('user_tenants')
    .select(`
      *,
      tenants (*)
    `)
    .eq('user_id', session.user.id)

  if (tenantsError) {
    console.log('❌ User_tenants error:', tenantsError.message)
    console.log('   Details:', tenantsError)
    console.log('\n   Trying simple query without join...')

    const { data: simpleTenants, error: simpleError } = await supabase
      .from('user_tenants')
      .select('*')
      .eq('user_id', session.user.id)

    if (simpleError) {
      console.log('❌ Simple query also failed:', simpleError.message)
    } else {
      console.log('✅ Simple query works:', simpleTenants)
    }
  } else {
    console.log('✅ User_tenants found:', userTenants)
    console.log('   Count:', userTenants?.length || 0)
  }

  // 4. Check tenants table directly
  console.log('\n4️⃣ Checking tenants table...')
  const { data: allTenants, error: allTenantsError } = await supabase
    .from('tenants')
    .select('*')

  if (allTenantsError) {
    console.log('❌ Tenants error:', allTenantsError.message)
  } else {
    console.log('✅ All tenants:', allTenants)
  }
}

checkAuth().catch(console.error)
