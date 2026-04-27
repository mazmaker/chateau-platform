// ====================================================================
// CREATE TEST USERS FOR CHATEAU PLATFORM
// ====================================================================
// This script creates test users with different roles
// Roles: Owner (exists), Admin, Sales, Viewer
// ====================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

// Tenant ID for CHATEAU Platform
const TENANT_ID = '53d49104-c674-4bbd-9a82-20e6a278f7f9'

// Test users to create
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

async function createTestUsers() {
  console.log('🔧 Creating test users for CHATEAU Platform...\n')

  for (const testUser of testUsers) {
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`👤 Creating: ${testUser.full_name} (${testUser.role})`)
    console.log(`📧 Email: ${testUser.email}`)
    console.log(`🔑 Password: ${testUser.password}`)
    console.log(`📝 ${testUser.description}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      // Step 1: Create auth user
      console.log('  1️⃣ Creating auth user...')
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: testUser.email,
        password: testUser.password,
        options: {
          data: {
            full_name: testUser.full_name
          }
        }
      })

      if (authError) {
        // User might already exist, try to get existing user
        if (authError.message.includes('already registered')) {
          console.log('  ⚠️  User already exists, fetching existing user...')
          const { data: { user } } = await supabase.auth.signInWithPassword({
            email: testUser.email,
            password: testUser.password
          })
          if (user) {
            console.log(`  ✅ Found existing user: ${user.id}`)
            await linkUserToTenant(user.id, testUser)
          }
        } else {
          console.log(`  ❌ Auth error: ${authError.message}`)
          continue
        }
      } else if (authData.user) {
        console.log(`  ✅ Auth user created: ${authData.user.id}`)

        // Step 2: Wait a bit for user to be created in users table
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Step 3: Link user to tenant
        await linkUserToTenant(authData.user.id, testUser)
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
    }
  }

  console.log('\n\n✅ Test users creation complete!')
  console.log('\n📋 Summary of test users:')
  console.log('┌─────────────────────────────────────────────────────────────┐')
  console.log('│ Role  │ Email              │ Password      │ Name          │')
  console.log('├─────────────────────────────────────────────────────────────┤')
  console.log('│ 👑 Owner  │ mazmakerv2.sup@... │ Chateau2025! │ Owner         │')
  console.log('│ 🛡️ Admin  │ admin@chateau.com │ Admin123!    │ Test Admin    │')
  console.log('│ 💼 Sales  │ sales@chateau.com │ Sales123!    │ Test Sales    │')
  console.log('│ 👁️ Viewer │ viewer@chateau.com│ Viewer123!   │ Test Viewer   │')
  console.log('└─────────────────────────────────────────────────────────────┘')
}

async function linkUserToTenant(userId, testUser) {
  try {
    console.log('  2️⃣ Linking user to tenant...')

    // Check if user_tenant already exists
    const { data: existing, error: checkError } = await supabase
      .from('user_tenants')
      .select('*')
      .eq('user_id', userId)
      .eq('tenant_id', TENANT_ID)
      .single()

    if (existing) {
      console.log(`  ℹ️  User already linked to tenant (role: ${existing.role})`)

      // Update role if different
      if (existing.role !== testUser.role) {
        const { error: updateError } = await supabase
          .from('user_tenants')
          .update({ role: testUser.role })
          .eq('id', existing.id)

        if (updateError) {
          console.log(`  ⚠️  Could not update role: ${updateError.message}`)
        } else {
          console.log(`  ✅ Role updated to: ${testUser.role}`)
        }
      }
      return
    }

    // Create new user_tenant record
    const { data, error } = await supabase
      .from('user_tenants')
      .insert({
        user_id: userId,
        tenant_id: TENANT_ID,
        role: testUser.role,
        is_active: true,
        joined_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      console.log(`  ❌ Error linking to tenant: ${error.message}`)
      console.log(`     Details: ${error.hint || error.details || 'No additional details'}`)
    } else {
      console.log(`  ✅ User linked to tenant with role: ${testUser.role}`)
    }

  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`)
  }
}

// Run the script
createTestUsers().catch(console.error)
