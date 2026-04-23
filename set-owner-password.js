import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function setOwnerPassword() {
  try {
    console.log('👑 Setting OWNER permanent password...')
    console.log('')

    const email = 'admin@chateau.com'
    const permanentPassword = 'ChateauOwner2024!'

    // Get user ID
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (userError) {
      console.error('❌ User not found:', userError.message)
      return
    }

    console.log('👤 Found user:', user.id)

    // Update password in Auth
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: permanentPassword
    })

    if (authError) {
      console.error('❌ Auth update error:', authError.message)
      return
    }

    console.log('✅ Password updated in Auth')

    // Mark as permanent password (set password_set_at to current time)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        password_set_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (updateError) {
      console.error('❌ Profile update error:', updateError.message)
      return
    }

    console.log('✅ Marked as permanent password')
    console.log('')
    console.log('🎉 OWNER PASSWORD SET!')
    console.log('======================')
    console.log(`📧 Email: ${email}`)
    console.log(`🔒 Password: ${permanentPassword}`)
    console.log(`👑 Role: OWNER`)
    console.log(`🔗 Login: http://localhost:5173/login`)
    console.log('')
    console.log('⚡ Ready to use - no password change required!')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

setOwnerPassword()