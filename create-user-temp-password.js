import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

/**
 * สร้าง temporary password แบบ random
 */
function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ไม่มี O, 0, I, 1 เพื่อป้องกันความสับสน
  const length = 8
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * สร้างผู้ใช้ใหม่พร้อม temporary password
 * ผู้ใช้จะต้องเปลี่ยนรหัสผ่านในครั้งแรกที่ล็อกอิน
 */
async function createUserWithTempPassword(email, fullName, role = 'sales', tenantId = null) {
  console.log('🔐 Creating User with Temporary Password')
  console.log('========================================')
  console.log(`📧 Email: ${email}`)
  console.log(`👤 Name: ${fullName}`)
  console.log(`💼 Role: ${role}`)
  console.log('')

  try {
    // Step 1: Generate temporary password
    const tempPassword = `Temp${generateTempPassword()}!`
    console.log('1️⃣ Generated temporary password...')

    // Step 2: Get default tenant if not provided
    if (!tenantId) {
      const { data: tenants } = await supabase
        .from('tenants')
        .select('*')
        .eq('status', 'active')
        .limit(1)

      if (!tenants || tenants.length === 0) {
        throw new Error('No active tenant found')
      }
      tenantId = tenants[0].id
      console.log(`🏢 Using tenant: ${tenants[0].name}`)
    }

    // Step 3: Create auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        full_name: fullName,
        role: role
      }
    })

    if (authError) {
      throw authError
    }

    console.log('✅ Auth user created')

    // Step 4: Create user profile (temporary password indicator using password_set_at as NULL)
    const { data: publicUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email,
        full_name: fullName,
        tenant_id: tenantId,
        role: role,
        password_set_at: null  // NULL indicates temporary password - user must change it
      })
      .select()
      .single()

    if (userError) {
      throw userError
    }

    console.log('✅ User profile created')

    // Step 5: Link to tenant
    const { error: linkError } = await supabase
      .from('user_tenants')
      .insert({
        user_id: authUser.user.id,
        tenant_id: tenantId,
        role: role,
        is_active: true,
        joined_at: new Date().toISOString()
      })

    if (linkError) {
      throw linkError
    }

    console.log('✅ Linked to tenant')

    // Success
    console.log('')
    console.log('🎉 User Created Successfully!')
    console.log('============================')
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 Temporary Password: ${tempPassword}`)
    console.log(`👤 Name: ${fullName}`)
    console.log(`💼 Role: ${role.toUpperCase()}`)
    console.log('')
    console.log('🔒 Security Features:')
    console.log('   ✅ Must change password on first login')
    console.log('   ✅ Email auto-confirmed')
    console.log('   ✅ Account ready to use')
    console.log('')
    console.log('📋 Next Steps:')
    console.log('   1. Give user these login credentials')
    console.log('   2. User logs in at: http://localhost:5173')
    console.log('   3. System will force password change')
    console.log('   4. User sets new password')
    console.log('   5. Access granted to dashboard')

    return {
      success: true,
      tempPassword: tempPassword,
      userId: authUser.user.id
    }

  } catch (error) {
    console.error('')
    console.error('❌ Error creating user:', error.message)
    return {
      success: false,
      error: error.message
    }
  }
}

// Example usage
if (import.meta.url === `file://${process.argv[1]}`) {
  // Get command line arguments
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.log('📋 Usage: node create-user-temp-password.js <email> <fullName> [role] [tenantId]')
    console.log('')
    console.log('Examples:')
    console.log('  node create-user-temp-password.js "newuser@company.com" "พนักงานใหม่"')
    console.log('  node create-user-temp-password.js "admin@company.com" "ผู้ดูแล" "admin"')
    console.log('  node create-user-temp-password.js "sales@company.com" "พนักงานขาย" "sales"')
    process.exit(1)
  }

  const [email, fullName, role = 'sales', tenantId = null] = args
  createUserWithTempPassword(email, fullName, role, tenantId)
}

export { createUserWithTempPassword, generateTempPassword }