import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Target user email
const TARGET_EMAIL = 'mazmakerv2.sup@gmail.com'

async function createOwnerTenant() {
  console.log('🚀 Creating tenant with owner for:', TARGET_EMAIL)
  console.log('=' .repeat(50))

  try {
    // Step 1: Check if user exists in auth
    console.log('\n1️⃣ Checking if user exists...')
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers()

    if (listError) {
      // Try alternative method
      console.log('   ⚠️  Admin API not available, checking via database...')
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', TARGET_EMAIL)
        .single()

      if (userError || !userData) {
        console.log('   ❌ User not found in database')
        console.log(`   📝 User ${TARGET_EMAIL} needs to register first`)
        return
      }

      console.log('   ✅ User found in database:', userData.id)
      await createTenantForUser(userData.id)
      return
    }

    const existingUser = users.find(u => u.email === TARGET_EMAIL)

    if (!existingUser) {
      console.log('   ❌ User not found in auth.users')
      console.log(`\n   Please create user first:`)
      console.log(`   1. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users`)
      console.log(`   2. Click "Add user"`)
      console.log(`   3. Email: ${TARGET_EMAIL}`)
      console.log(`   4. Set a password`)
      console.log(`   5. Click "Auto Confirm User"`)
      console.log(`   6. Click "Create user"`)
      console.log(`   7. Run this script again\n`)
      return
    }

    console.log('   ✅ User found:', existingUser.id)

    // Step 2: Check if user already has tenants
    console.log('\n2️⃣ Checking existing tenants...')
    const { data: existingTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', existingUser.id)

    if (!tenantsError && existingTenants && existingTenants.length > 0) {
      console.log(`   ℹ️  User already has ${existingTenants.length} tenant(s):`)
      existingTenants.forEach(ut => {
        console.log(`      - ${ut.tenants.name} (${ut.role})`)
      })

      // Check if already has owner role
      const hasOwner = existingTenants.some(ut => ut.role === 'owner')
      if (hasOwner) {
        console.log('\n   ✅ User ALREADY HAS OWNER ROLE!')
        console.log('\n   🎯 You can login with:')
        console.log(`      Email: ${TARGET_EMAIL}`)
        console.log(`      Role: OWNER`)
        return
      }

      console.log('\n   Adding owner role...')
    }

    // Step 3: Create tenant with owner
    console.log('\n3️⃣ Creating tenant with owner role...')
    const { data: tenantData, error: tenantError } = await supabase.rpc('create_tenant_with_owner', {
      tenant_name: 'CHATEAU Platform',
      owner_email: TARGET_EMAIL,
      owner_full_name: 'Platform Owner'
    })

    if (tenantError) {
      console.log('   ❌ Error:', tenantError.message)
      console.log('\n   Trying manual creation...')

      // Try manual insertion
      await createTenantManually(existingUser.id)
      return
    }

    console.log('   ✅ Tenant created successfully!')
    console.log('\n' + '='.repeat(50))
    console.log('🎉 SETUP COMPLETE!')
    console.log('=' .repeat(50))
    console.log('\n   📧 Email:', TARGET_EMAIL)
    console.log('   🏢 Tenant: CHATEAU Platform')
    console.log('   👤 Role: OWNER')
    console.log('\n   🔗 Login: http://localhost:5174/auth/login\n')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

async function createTenantForUser(userId) {
  console.log('\n3️⃣ Creating tenant...')

  try {
    // Create tenant
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'CHATEAU Platform',
        slug: 'chateau-platform'
      })
      .select()
      .single()

    if (tenantError) {
      // Try to use existing
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', 'chateau-platform')
        .single()

      if (existingTenant) {
        console.log('   ℹ️  Using existing tenant')
        await linkUserToTenant(userId, existingTenant.id)
        return
      }
      throw tenantError
    }

    console.log('   ✅ Tenant created:', newTenant.id)
    await linkUserToTenant(userId, newTenant.id)

  } catch (error) {
    console.error('   ❌ Error creating tenant:', error.message)
  }
}

async function createTenantManually(userId) {
  console.log('\n   Creating tenant manually...')

  try {
    // Create tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({
        name: 'CHATEAU Platform',
        slug: 'chateau-platform-' + Date.now()
      })
      .select()
      .single()

    if (tenant) {
      // Create user_tenants record
      const { error: linkError } = await supabase
        .from('user_tenants')
        .insert({
          user_id: userId,
          tenant_id: tenant.id,
          role: 'owner',
          is_active: true
        })

      if (linkError) {
        console.log('   ❌ Error linking user:', linkError.message)
      } else {
        console.log('   ✅ Owner role assigned!')
      }
    }
  } catch (error) {
    console.error('   ❌ Manual creation failed:', error.message)
  }
}

async function linkUserToTenant(userId, tenantId) {
  try {
    const { error: linkError } = await supabase
      .from('user_tenants')
      .insert({
        user_id: userId,
        tenant_id: tenantId,
        role: 'owner',
        is_active: true
      })

    if (linkError) {
      console.log('   ❌ Error linking user to tenant:', linkError.message)
    } else {
      console.log('   ✅ User linked to tenant as OWNER!')
      console.log('\n   🎯 You can now login as OWNER!')
    }
  } catch (error) {
    console.error('   ❌ Error:', error.message)
  }
}

createOwnerTenant()