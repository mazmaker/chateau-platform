import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'

const supabase = createClient(supabaseUrl, supabaseKey)

const EMAIL = 'mazmakerv2.sup@gmail.com'
const PASSWORD = 'Chateau2025!'
const FULL_NAME = 'Platform Owner'
const COMPANY = 'CHATEAU Platform'

async function fixAndSetup() {
  console.log('🔧 แก้ไขและติดตั้งระบบ...\n')

  try {
    // Step 1: Check if user exists in auth
    console.log('1️⃣  ตรวจสอบผู้ใช้...')

    // Try to sign in first
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: EMAIL,
      password: PASSWORD
    })

    let userId

    if (!signInError && signInData.user) {
      userId = signInData.user.id
      console.log('   ✅ พบผู้ใช้:', userId)
    } else {
      console.log('   ℹ️  ไม่พบผู้ใช้ ต้องสร้างใหม่')
      console.log('   กรุณาไปสร้างที่ Supabase Dashboard:')
      console.log('   https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users')
      console.log('\n   หรือรัน script นี้หลังจากสร้าง user เสร็จ')
      return
    }

    // Step 2: Ensure user profile exists
    console.log('\n2️⃣  ตรวจสอบโปรไฟล์...')
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      console.log('   ⚠️  ไม่พบโปรไฟล์ กำลังสร้าง...')

      // Create profile manually
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: EMAIL,
          full_name: FULL_NAME
        })

      if (insertError) {
        console.log('   ⚠️  ไม่สามารถสร้างโปรไฟล์:', insertError.message)
      } else {
        console.log('   ✅ สร้างโปรไฟล์สำเร็จ')
      }
    } else {
      console.log('   ✅ พบโปรไฟล์')
    }

    // Step 3: Check existing tenants
    console.log('\n3️⃣  ตรวจสอบ Tenant...')

    const { data: userTenants, error: tenantsError } = await supabase
      .from('user_tenants')
      .select('*, tenants(*)')
      .eq('user_id', userId)

    if (!tenantsError && userTenants && userTenants.length > 0) {
      console.log(`   ℹ️  มี Tenant อยู่แล้ว ${userTenants.length} แห่ง:`)

      const hasOwner = userTenants.some(ut => ut.role === 'owner')
      if (hasOwner) {
        console.log('\n   ✅ มีสิทธิ์ OWNER อยู่แล้ว!\n')
        userTenants.forEach(ut => {
          console.log(`      - ${ut.tenants?.name} (${ut.role})`)
        })
        return
      }

      console.log('   ยังไม่มีสิทธิ์ OWNER กำลังเพิ่ม...')
    }

    // Step 4: Find or create tenant
    console.log('\n4️⃣  สร้าง/หา Tenant...')

    let tenantId = null

    // Try to find existing tenant with same name
    const { data: existingTenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('name', COMPANY)
      .single()

    if (existingTenant) {
      tenantId = existingTenant.id
      console.log('   ✅ พบ Tenant ที่มีอยู่:', tenantId)
    } else {
      // Create new tenant
      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: COMPANY,
          slug: COMPANY.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        })
        .select()
        .single()

      if (createError) {
        console.log('   ❌ ไม่สามารถสร้าง Tenant:', createError.message)
        throw createError
      }

      tenantId = newTenant.id
      console.log('   ✅ สร้าง Tenant สำเร็จ:', tenantId)
    }

    // Step 5: Link user to tenant with owner role
    console.log('\n5️⃣  กำหนดสิทธิ์ OWNER...')

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
      console.log('   ❌ ไม่สามารถกำหนดสิทธิ์:', linkError.message)

      // Provide SQL fallback
      console.log('\n📝 รัน SQL นี้ใน Supabase SQL Editor:')
      console.log('   https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql\n')
      console.log(`INSERT INTO user_tenants (user_id, tenant_id, role, is_active, joined_at)`)
      console.log(`VALUES ('${userId}', '${tenantId}', 'owner', true, now())`)
      console.log(`ON CONFLICT (user_id, tenant_id) DO UPDATE SET role = 'owner';\n`)
      return
    }

    console.log('   ✅ กำหนดสิทธิ์สำเร็จ')

    // Success!
    console.log('\n' + '='.repeat(60))
    console.log('🎉 สำเร็จ! (Setup Complete!)')
    console.log('='.repeat(60))
    console.log('\n📋 ข้อมูลของคุณ:')
    console.log(`   อีเมล: ${EMAIL}`)
    console.log(`   รหัสผ่าน: ${PASSWORD}`)
    console.log(`   บริษัท: ${COMPANY}`)
    console.log(`   สิทธิ์: OWNER ✅`)
    console.log(`   Tenant ID: ${tenantId}`)
    console.log('\n🔗 เข้าสู่ระบบ:')
    console.log('   http://localhost:5174/auth/login')
    console.log('\n')

  } catch (error) {
    console.error('\n❌ Error:', error.message)
  }
}

fixAndSetup()