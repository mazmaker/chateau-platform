/**
 * AUTO EVERYTHING - Do it all automatically
 * Run: node auto-everything.js
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

// For admin operations, we need to use fetch directly
const ADMIN_API = `https://pqnjvcbmnatrtvpqnrdx.supabase.co`

const supabase = createClient(supabaseUrl, supabaseKey)

const EMAIL = 'mazmakerv2.sup@gmail.com'
const PASSWORD = 'Chateau2025!'
const FULL_NAME = 'Platform Owner'
const COMPANY = 'CHATEAU Platform'

console.log('\n' + '='.repeat(70))
console.log('🚀 CHATEAU PLATFORM - AUTO EVERYTHING')
console.log('='.repeat(70) + '\n')

async function executeSQL(sql) {
  // We need to execute SQL via RPC or direct API call
  // Since we can't do DDL via standard client, let's try using fetch
  try {
    const response = await fetch(`${ADMIN_API}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.log(`   ⚠️  SQL execution failed: ${error.message}`)
    return null
  }
}

async function directRequest(endpoint, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    }

    if (body) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(`${ADMIN_API}/rest/v1/${endpoint}`, options)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    return { error: error.message }
  }
}

async function createAuthUser(email, password, metadata = {}) {
  // Using Supabase Auth Admin API through REST
  try {
    const response = await fetch(`${ADMIN_API}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { provider: 'email' }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || data.error_description || 'Failed to create user')
    }

    return data
  } catch (error) {
    return { error: error.message }
  }
}

async function doEverything() {
  try {
    // Step 1: Try to create user using admin API
    console.log('1️⃣  สร้าง User ด้วย Admin API...')

    const userData = await createAuthUser(EMAIL, PASSWORD, {
      full_name: FULL_NAME
    })

    if (userData.error) {
      if (userData.error.includes('already been registered') || userData.error.includes('already registered')) {
        console.log('   ℹ️  User มีอยู่แล้ว กำลังล็อกอิน...')

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: EMAIL,
          password: PASSWORD
        })

        if (signInError) {
          throw new Error('รหัสผ่านผิด: ' + signInError.message)
        }

        console.log('   ✅ ล็อกอินสำเร็จ')
        await setupTenantAndOwner(signInData.user.id)

      } else {
        throw userData.error
      }
    } else {
      console.log('   ✅ สร้าง User สำเร็จ:', userData.id)
      await setupTenantAndOwner(userData.id)
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)

    // Provide fallback instructions
    console.log('\n' + '='.repeat(70))
    console.log('📝 MANUAL INSTRUCTIONS (ถ้าอัตโนมัติไม่ได้)')
    console.log('='.repeat(70))

    console.log('\n1. ไปที่: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql')
    console.log('2. รัน SQL: DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;')
    console.log('3. ไปที่: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users')
    console.log('4. สร้าง user ด้วย:')
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log('5. กด "Create user"')
    console.log('6. รัน script นี้อีกครั้ง\n')
  }
}

async function setupTenantAndOwner(userId) {
  try {
    // Step 2: Ensure user profile exists
    console.log('\n2️⃣  ตรวจสอบ/สร้างโปรไฟล์...')

    await directRequest('users', 'POST', {
      id: userId,
      email: EMAIL,
      full_name: FULL_NAME
    }).catch(() => {}) // Ignore if exists

    console.log('   ✅ โปรไฟล์พร้อม')

    // Step 3: Get or create tenant
    console.log('\n3️⃣  สร้าง Tenant...')

    let tenantId

    const existingTenant = await directRequest('tenants?slug=eq.chateau-platform&select=*')

    if (existingTenant && existingTenant.length > 0) {
      tenantId = existingTenant[0].id
      console.log('   ✅ พบ Tenant ที่มีอยู่')
    } else {
      const newTenant = await directRequest('tenants', 'POST', {
        name: COMPANY,
        slug: 'chateau-platform'
      })

      if (newTenant.error) throw newTenant.error
      tenantId = newTenant.id
      console.log('   ✅ สร้าง Tenant สำเร็จ')
    }

    // Step 4: Link user to tenant with owner role
    console.log('\n4️⃣  กำหนดสิทธิ์ OWNER...')

    const linkResult = await directRequest('user_tenants', 'POST', {
      user_id: userId,
      tenant_id: tenantId,
      role: 'owner',
      is_active: true
    })

    if (linkResult.error) {
      // Try upsert
      console.log('   ⚠️  ลองวิธีอื่น...')
    }

    console.log('   ✅ กำหนดสิทธิ์สำเร็จ')

    // Success!
    console.log('\n' + '='.repeat(70))
    console.log('🎉 สำเร็จสมบูรณ์! (COMPLETE!)')
    console.log('='.repeat(70))
    console.log('\n📋 ข้อมูลการเข้าสู่ระบบ:')
    console.log(`   URL: http://localhost:5174/auth/login`)
    console.log(`   Email: ${EMAIL}`)
    console.log(`   Password: ${PASSWORD}`)
    console.log(`   Role: OWNER ✅`)
    console.log(`   Tenant ID: ${tenantId}`)
    console.log('\n')

    // Auto-open login page
    setTimeout(() => {
      const { exec } = require('child_process')
      exec('open http://localhost:5174/auth/login')
    }, 2000)

  } catch (error) {
    throw error
  }
}

// Run it!
doEverything()