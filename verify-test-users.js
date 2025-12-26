// ====================================================================
// BYPASS EMAIL VERIFICATION FOR TEST USERS
// ====================================================================

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Test users to verify
const testUsers = [
  'admin@chateau.com',
  'sales@chateau.com',
  'viewer@chateau.com'
]

async function verifyEmails() {
  console.log('🔧 Bypassing email verification for test users...\n')

  for (const email of testUsers) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`📧 Processing: ${email}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    try {
      // Step 1: Get user by email
      const { data: { users } } = await supabase.auth.admin.listUsers()
      const user = users.find(u => u.email === email)

      if (!user) {
        console.log(`  ❌ User not found: ${email}`)
        continue
      }

      console.log(`  ✅ Found user: ${user.id}`)

      // Step 2: Update email confirmation using admin API
      const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
        email_confirm: true,
        user_metadata: {
          ...user.user_metadata,
          email_verified: true
        }
      })

      if (error) {
        console.log(`  ⚠️  Admin API error: ${error.message}`)

        // Fallback: Try direct database update
        console.log(`  🔧 Trying direct database update...`)
        const { error: dbError } = await supabase
          .from('users')
          .update({
            email_verified: true,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)

        if (dbError) {
          console.log(`  ❌ Database update failed: ${dbError.message}`)
        } else {
          console.log(`  ✅ Email verified via database!`)
        }
      } else {
        console.log(`  ✅ Email confirmed successfully!`)
      }

    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`)
    }

    console.log() // Empty line for readability
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Email verification bypass complete!')
  console.log('\n📋 You can now login with:')
  console.log('┌─────────────────────────────────────────────────────────────┐')
  console.log('│ Role  │ Email              │ Password      │')
  console.log('├─────────────────────────────────────────────────────────────┤')
  console.log('│ 👑 Owner  │ mazmakerv2.sup@... │ Chateau2025!  │')
  console.log('│ 🛡️ Admin  │ admin@chateau.com │ Admin123!     │ ✅ Ready')
  console.log('│ 💼 Sales  │ sales@chateau.com │ Sales123!     │ ✅ Ready')
  console.log('│ 👁️ Viewer │ viewer@chateau.com│ Viewer123!    │ ✅ Ready')
  console.log('└─────────────────────────────────────────────────────────────┘')
}

verifyEmails().catch(console.error)
