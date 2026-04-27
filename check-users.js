import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function checkUsers() {
  try {
    console.log('🔍 Checking existing users...')
    console.log('')

    // Get all users from database
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('❌ Error fetching users:', error.message)
      return
    }

    console.log(`📊 Found ${users.length} users in database:`)
    console.log('==========================================')

    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`)
      console.log(`   👤 Name: ${user.full_name || 'No name'}`)
      console.log(`   💼 Role: ${user.role?.toUpperCase() || 'No role'}`)
      console.log(`   🔒 Password Status: ${user.password_set_at ? 'Permanent' : 'Temporary'}`)
      console.log(`   ✅ Active: ${user.is_active ? 'Yes' : 'No'}`)
      console.log('')
    })

    // Check for owner/admin specifically
    const ownerUsers = users.filter(u => u.role === 'owner')
    const adminUsers = users.filter(u => u.role === 'admin')

    if (ownerUsers.length > 0) {
      console.log('👑 OWNER ACCOUNTS:')
      ownerUsers.forEach(user => {
        console.log(`   📧 ${user.email}`)
        console.log(`   🔒 Password: ${user.password_set_at ? 'Set' : 'Temporary needed'}`)
      })
      console.log('')
    }

    if (adminUsers.length > 0) {
      console.log('🛡️  ADMIN ACCOUNTS:')
      adminUsers.forEach(user => {
        console.log(`   📧 ${user.email}`)
        console.log(`   🔒 Password: ${user.password_set_at ? 'Set' : 'Temporary needed'}`)
      })
      console.log('')
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkUsers()