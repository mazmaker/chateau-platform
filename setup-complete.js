/**
 * CHATEAU Platform - Complete Setup Script
 * Run this to create user with OWNER role
 */

import { createClient } from '@supabase/supabase-js'
import readline from 'readline'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

const supabase = createClient(supabaseUrl, supabaseKey)

// Default values
const DEFAULT_EMAIL = 'mazmakerv2.sup@gmail.com'
const DEFAULT_PASSWORD = 'Chateau2025!'
const DEFAULT_NAME = 'Platform Owner'
const DEFAULT_COMPANY = 'CHATEAU Platform'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function createUser() {
  console.log('\n' + '='.repeat(60))
  console.log('🏰 CHATEAU Platform - Complete Setup')
  console.log('='.repeat(60) + '\n')

  console.log('ค่าเริ่มต้น (Default values):')
  console.log(`  อีเมล: ${DEFAULT_EMAIL}`)
  console.log(`  รหัสผ่าน: ${DEFAULT_PASSWORD}`)
  console.log(`  ชื่อ: ${DEFAULT_NAME}`)
  console.log(`  บริษัท: ${DEFAULT_COMPANY}\n`)

  const useDefault = await question('ใช้ค่าเริ่มต้นหรือไม่? (Y/n): ')

  let email = DEFAULT_EMAIL
  let password = DEFAULT_PASSWORD
  let fullName = DEFAULT_NAME
  let companyName = DEFAULT_COMPANY

  if (useDefault.toLowerCase() !== 'y' && useDefault !== '') {
    email = await question('อีเมล: ') || email
    password = await question('รหัสผ่าน: ') || password
    fullName = await question('ชื่อ-นามสกุล: ') || fullName
    companyName = await question('ชื่อบริษัท: ') || companyName
  }

  console.log('\n' + '-'.repeat(60))
  console.log('เริ่มกระบวนการ...\n')

  try {
    // Step 1: Sign up user
    console.log('1️⃣  สร้างบัญชีผู้ใช้...')
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: {
          full_name: fullName
        }
      }
    })

    if (signUpError) {
      if (signUpError.message.includes('already been registered') || signUpError.message.includes('already registered')) {
        console.log('   ℹ️  บัญชีนี้มีอยู่แล้ว กำลังล็อกอิน...')

        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: password
        })

        if (signInError) {
          console.log('   ❌ ล็อกอินไม่ได้ อาจเป็นเพราะรหัสผ่านผิด')
          console.log('\n   💡 วิธีแก้:')
          console.log('      1. ไปที่ Supabase Dashboard → Authentication → Users')
          console.log('      2. ค้นหาอีเมลนี้')
          console.log('      3. กด Reset Password')
          throw new Error('รหัสผ่านผิด หรือบัญชีถูกล็อค')
        }

        console.log('   ✅ ล็อกอินสำเร็จ')

        // Wait for session
        await new Promise(resolve => setTimeout(resolve, 2000))

        // Create tenant
        await createTenantForUser(signInData.user.id, email, fullName, companyName)
        return
      }
      throw signUpError
    }

    console.log('   ✅ สร้างบัญชีสำเร็จ:', signUpData.user?.id)

    // Wait for trigger
    console.log('\n2️⃣  รอสร้างโปรไฟล์...')
    await new Promise(resolve => setTimeout(resolve, 3000))

    // Create tenant
    await createTenantForUser(signUpData.user.id, email, fullName, companyName)

  } catch (error) {
    console.log('\n' + '='.repeat(60))
    console.log('❌ เกิดข้อผิดพลาด')
    console.log('='.repeat(60))
    console.error(error.message)
    console.log('\nถ้าต้องการลองใหม่ ให้รัน script นี้อีกครั้ง')
  } finally {
    rl.close()
  }
}

async function createTenantForUser(userId, email, fullName, companyName) {
  try {
    console.log('\n3️⃣  สร้าง Tenant และกำหนดสิทธิ์ OWNER...')

    // Method 1: Try RPC function
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_tenant_with_owner', {
      tenant_name: companyName,
      owner_email: email,
      owner_full_name: fullName
    })

    if (!rpcError && rpcData) {
      console.log('   ✅ สร้าง Tenant สำเร็จ (RPC)')
      printSuccess(email, companyName)
      return
    }

    console.log('   ⚠️  RPC ไม่สำเร็จ ลองวิธีอื่น...')

    // Method 2: Manual creation
    // First create tenant
    const { data: newTenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: companyName,
        slug: companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now()
      })
      .select()
      .single()

    if (tenantError) {
      // Try to get existing tenant
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('slug', companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-'))
        .single()

      if (existingTenant) {
        console.log('   ℹ️  ใช้ Tenant ที่มีอยู่แล้ว')
        await linkUserToTenant(userId, existingTenant.id, email, companyName)
        return
      }

      throw new Error('ไม่สามารถสร้าง Tenant: ' + tenantError.message)
    }

    console.log('   ✅ สร้าง Tenant สำเร็จ:', newTenant.id)

    // Create user profile if not exists
    await supabase
      .from('users')
      .upsert({
        id: userId,
        email: email,
        full_name: fullName
      })

    // Link user to tenant
    await linkUserToTenant(userId, newTenant.id, email, companyName)

  } catch (error) {
    console.log('\n' + '='.repeat(60))
    console.log('❌ เกิดข้อผิดพลาดขณะสร้าง Tenant')
    console.log('='.repeat(60))
    console.error(error)

    // Try alternative method
    console.log('\n💡 ลองวิธีสุดท้าย...')
    await manualSetup(userId, email, fullName, companyName)
  }
}

async function linkUserToTenant(userId, tenantId, email, companyName) {
  try {
    const { error: linkError } = await supabase
      .from('user_tenants')
      .upsert({
        user_id: userId,
        tenant_id: tenantId,
        role: 'owner',
        is_active: true,
        joined_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,tenant_id'
      })

    if (linkError) {
      throw new Error('ไม่สามารถกำหนดสิทธิ์: ' + linkError.message)
    }

    console.log('   ✅ กำหนดสิทธิ์ OWNER สำเร็จ')
    printSuccess(email, companyName)

  } catch (error) {
    throw error
  }
}

async function manualSetup(userId, email, fullName, companyName) {
  console.log('\n📝 รัน SQL นี้ใน Supabase SQL Editor:')
  console.log('   https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql\n')
  console.log('-- Copy and run this SQL:')
  console.log(`INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at)`)
  console.log(`VALUES ('${userId}',`)
  console.log(`        (SELECT id FROM tenants ORDER BY created_at DESC LIMIT 1),`)
  console.log(`        'owner', true, now())`)
  console.log(`ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'owner';\n`)
}

function printSuccess(email, company) {
  console.log('\n' + '='.repeat(60))
  console.log('🎉 สำเร็จ! (Setup Complete!)')
  console.log('='.repeat(60))
  console.log('\n📋 ข้อมูลของคุณ:')
  console.log(`   อีเมล: ${email}`)
  console.log(`   บริษัท: ${company}`)
  console.log(`   สิทธิ์: OWNER ✅`)
  console.log('\n🔗 เข้าสู่ระบบ:')
  console.log('   http://localhost:5174/auth/login')
  console.log('\n')
}

// Run
createUser().catch(console.error)