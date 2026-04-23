import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function debugUsers() {
  try {
    console.log('🔍 Checking user password status...')
    console.log('')

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, password_set_at, created_at, updated_at')
      .order('email')

    if (error) {
      console.error('❌ Error fetching users:', error.message)
      return
    }

    console.log(`📊 Found ${users.length} users:`)
    console.log('='.repeat(80))

    users.forEach((user, index) => {
      const passwordStatus = user.password_set_at ? 'PERMANENT' : 'TEMPORARY'
      const statusColor = user.password_set_at ? '✅' : '⚠️'

      console.log(`${index + 1}. ${statusColor} ${user.email}`)
      console.log(`   🔒 password_set_at: ${user.password_set_at || 'NULL (temporary)'}`)
      console.log(`   📅 created_at: ${user.created_at}`)
      console.log(`   📝 updated_at: ${user.updated_at}`)
      console.log(`   ⭐ Status: ${passwordStatus}`)
      console.log('')
    })

    // Summary
    const tempUsers = users.filter(u => !u.password_set_at)
    const permUsers = users.filter(u => u.password_set_at)

    console.log('📋 SUMMARY:')
    console.log('='.repeat(40))
    console.log(`⚠️  Temporary passwords: ${tempUsers.length}`)
    console.log(`✅ Permanent passwords: ${permUsers.length}`)
    console.log('')

    if (tempUsers.length > 0) {
      console.log('⚠️  Users with temporary passwords:')
      tempUsers.forEach(user => {
        console.log(`   • ${user.email}`)
      })
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

debugUsers()