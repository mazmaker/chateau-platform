// ====================================================================
// CREATE TEST USERS WITH SUPABASE ADMIN API (BYPASS EMAIL VERIFICATION)
// ====================================================================
// This script uses the service_role key to create users with auto-confirmed emails
// ====================================================================

import { createClient } from '@supabase/supabase-js'

// Use service_role key for admin operations
// NOTE: Replace with actual service_role key from Supabase Dashboard
// https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/settings/api
const supabaseAdmin = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY_HERE',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

const TENANT_ID = '53d49104-c674-4bbd-9a82-20e6a278f7f9'

const testUsers = [
  {
    email: 'admin@chateau.com',
    password: 'Admin123!',
    full_name: 'Test Admin',
    role: 'admin',
    description: 'Admin user - can manage users and all data'
  },
  {
    email: 'sales@chateau.com',
    password: 'Sales123!',
    full_name: 'Test Sales',
    role: 'sales',
    description: 'Sales user - can manage customers and bookings'
  },
  {
    email: 'viewer@chateau.com',
    password: 'Viewer123!',
    full_name: 'Test Viewer',
    role: 'viewer',
    description: 'Viewer user - read only access'
  }
]

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function createTestUsers() {
  console.log('🔧 Creating test users with Admin API (email auto-confirmed)...\n')

  for (const testUser of testUsers) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('👤 Creating:', testUser.full_name + ' (' + testUser.role + ')')
    console.log('📧 Email:', testUser.email)
    console.log('🔑 Password:', testUser.password)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    try {
      // Step 1: Check if user already exists in auth
      console.log('  1️⃣ Checking if user exists in auth...')
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()

      if (listError) {
        console.log('  ❌ Error listing users:', listError.message)
        continue
      }

      const existingUser = users.find(u => u.email === testUser.email)
      let userId

      if (existingUser) {
        console.log('  ℹ️  User already exists in auth:', existingUser.id)
        userId = existingUser.id

        // Update user to ensure email is confirmed
        console.log('  2️⃣ Updating email confirmation...')
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          email_confirm: true,
          user_metadata: {
            full_name: testUser.full_name,
            email_verified: true
          }
        })

        if (updateError) {
          console.log('  ⚠️  Could not update user:', updateError.message)
        } else {
          console.log('  ✅ Email confirmed!')
        }
      } else {
        // Step 2: Create user with admin API (auto-confirms email)
        console.log('  2️⃣ Creating new auth user with admin API...')

        const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: testUser.email,
          password: testUser.password,
          email_confirm: true, // This bypasses email verification!
          user_metadata: {
            full_name: testUser.full_name,
            email_verified: true
          }
        })

        if (createError) {
          console.log('  ❌ Error creating auth user:', createError.message)
          continue
        }

        console.log('  ✅ Auth user created:', newUserData.user.id)
        userId = newUserData.user.id
      }

      // Step 3: Ensure user exists in users table
      console.log('  3️⃣ Ensuring user exists in users table...')

      // Check if user exists in users table
      const { data: existingDbUser, error: checkError } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (existingDbUser) {
        console.log('  ℹ️  User already in users table')
      } else if (checkError && checkError.code === 'PGRST116') {
        // User doesn't exist, create it
        console.log('  Creating user in users table...')
        const { error: insertError } = await supabaseAdmin
          .from('users')
          .insert({
            id: userId,
            email: testUser.email,
            full_name: testUser.full_name,
            email_verified: true,
            is_active: true,
            created_at: new Date().toISOString()
          })

        if (insertError) {
          console.log('  ⚠️  Could not insert into users table:', insertError.message)
        } else {
          console.log('  ✅ User added to users table')
        }
      } else {
        console.log('  ⚠️  Error checking users table:', checkError?.message)
      }

      // Step 4: Link user to tenant
      console.log('  4️⃣ Linking user to tenant...')

      const { data: existingLink, error: linkCheckError } = await supabaseAdmin
        .from('user_tenants')
        .select('*')
        .eq('user_id', userId)
        .eq('tenant_id', TENANT_ID)
        .single()

      if (existingLink) {
        console.log('  ℹ️  User already linked to tenant (role:', existingLink.role + ')')

        // Update role if needed
        if (existingLink.role !== testUser.role) {
          const { error: updateRoleError } = await supabaseAdmin
            .from('user_tenants')
            .update({ role: testUser.role })
            .eq('id', existingLink.id)

          if (updateRoleError) {
            console.log('  ⚠️  Could not update role:', updateRoleError.message)
          } else {
            console.log('  ✅ Role updated to:', testUser.role)
          }
        }
      } else if (linkCheckError && linkCheckError.code === 'PGRST116') {
        // Create new link
        const { error: linkError } = await supabaseAdmin
          .from('user_tenants')
          .insert({
            id: generateUUID(),
            user_id: userId,
            tenant_id: TENANT_ID,
            role: testUser.role,
            is_active: true,
            joined_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })

        if (linkError) {
          console.log('  ❌ Error linking to tenant:', linkError.message)
        } else {
          console.log('  ✅ User linked to tenant with role:', testUser.role)
        }
      } else {
        console.log('  ⚠️  Error checking user_tenants:', linkCheckError?.message)
      }

      console.log('  ✅', testUser.email, 'setup complete!')

    } catch (error) {
      console.log('  ❌ Error:', error.message)
    }
  }

  console.log('\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Test users setup complete!')
  console.log('\n📋 You can now login with:')
  console.log('┌─────────────────────────────────────────────────────────────┐')
  console.log('│ Role   │ Email              │ Password      │')
  console.log('├─────────────────────────────────────────────────────────────┤')
  console.log('│ 👑 Owner │ mazmakerv2.sup@... │ Chateau2025!  │')
  console.log('│ 🛡️ Admin │ admin@chateau.com │ Admin123!     │ ✅ Ready')
  console.log('│ 💼 Sales │ sales@chateau.com │ Sales123!     │ ✅ Ready')
  console.log('│ 👁️ Viewer│ viewer@chateau.com│ Viewer123!    │ ✅ Ready')
  console.log('└─────────────────────────────────────────────────────────────┘')
  console.log('\n   All emails are auto-confirmed. No verification needed!')
}

createTestUsers().catch(console.error)
