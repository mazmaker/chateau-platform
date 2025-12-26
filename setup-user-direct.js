/**
 * Direct User Setup - Bypass trigger issue
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

const supabase = createClient(supabaseUrl, supabaseKey)

const EMAIL = 'mazmakerv2.sup@gmail.com'
const PASSWORD = 'Chateau2025!'

console.log('\n🚀 Auto Setup Starting...\n')

async function run() {
  try {
    // First, try to sign in (user might already exist)
    console.log('Checking if user exists...')

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD
    })

    if (signInError) {
      console.log('User not found or wrong password')
      console.log('\n⚠️  ต้องสร้าง user ด้วยตัวเองก่อน (1 ครั้งเท่านั้น!)')
      console.log('\n📝 ทำอย่างเดียว:')
      console.log('1. เปิด: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users')
      console.log('2. กด "Add user"')
      console.log(`3. Email: ${EMAIL}`)
      console.log(`4. Password: ${PASSWORD}`)
      console.log('5. ✅ ติ๊ก "Auto Confirm User"')
      console.log('6. กด "Create user"')
      console.log('7. รัน script นี้อีกครั้ง\n')
      return
    }

    console.log('✅ Found user:', signInData.user.id)

    // Get the user ID
    const userId = signInData.user.id

    // Directly create/insert into users table
    console.log('Creating user profile...')

    const { error: profileError } = await supabase
      .from('users')
      .upsert({
        id: userId,
        email: EMAIL,
        full_name: 'Platform Owner'
      })

    if (profileError) {
      console.log('Profile error (might be OK):', profileError.message)
    } else {
      console.log('✅ Profile created')
    }

    // Create tenant
    console.log('Creating/getting tenant...')

    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('slug', 'chateau-platform')
      .single()

    let tenantId

    if (existingTenant) {
      tenantId = existingTenant.id
      console.log('✅ Found existing tenant')
    } else {
      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: 'CHATEAU Platform',
          slug: 'chateau-platform'
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      tenantId = newTenant.id
      console.log('✅ Tenant created')
    }

    // Link user to tenant
    console.log('Setting up OWNER role...')

    const { error: linkError } = await supabase
      .from('user_tenants')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: 'owner',
        is_active: true
      }, {
        onConflict: 'user_id,tenant_id'
      })

    if (linkError) {
      throw linkError
    }

    console.log('✅ Owner role assigned!')

    // Success!
    console.log('\n' + '='.repeat(60))
    console.log('🎉 SUCCESS!')
    console.log('='.repeat(60))
    console.log('\n📝 Login credentials:')
    console.log(`   URL: http://localhost:5174/auth/login`)
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log(`   Role: OWNER`)
    console.log('\n')

    // Open browser
    setTimeout(() => {
      const { exec } = require('child_process')
      exec('open http://localhost:5174/auth/login')
    }, 1000)

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.log('\nIf you still have issues, run this SQL in Supabase SQL Editor:')
    console.log(`
-- Get your user ID from the Users page, then:
INSERT INTO user_tenants (user_id, tenant_id, role, is_active)
SELECT 'YOUR_USER_ID', id, 'owner', true
FROM tenants WHERE slug = 'chateau-platform';
    `)
  }
}

run()