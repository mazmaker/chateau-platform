import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0'
)

const TENANT_ID = '53d49104-c674-4bbd-9a82-20e6a278f7f9'

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const testUsers = [
  { email: 'admin@chateau.com', full_name: 'Test Admin', role: 'admin' },
  { email: 'sales@chateau.com', full_name: 'Test Sales', role: 'sales' },
  { email: 'viewer@chateau.com', full_name: 'Test Viewer', role: 'viewer' }
]

async function createUsersDirectly() {
  console.log('Creating test users directly in database...\n')

  for (const testUser of testUsers) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Creating:', testUser.full_name, '(' + testUser.role + ')')
    console.log('Email:', testUser.email)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    const userId = generateUUID()

    try {
      // Create user in users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: userId,
          email: testUser.email,
          full_name: testUser.full_name,
          email_verified: true,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (userError) {
        if (userError.code === '23505') {
          console.log('User already exists, finding existing...')
          const { data: existingUser } = await supabase
            .from('users')
            .select('*')
            .eq('email', testUser.email)
            .single()
          if (existingUser) {
            console.log('Found existing user:', existingUser.id)
            await linkUserToTenant(existingUser.id, testUser)
          }
        } else {
          console.log('Error creating user:', userError.message)
        }
        continue
      }

      console.log('User created:', userData.id)
      await linkUserToTenant(userId, testUser)

    } catch (error) {
      console.log('Error:', error.message)
    }
  }

  console.log('\n\n✅ Test users creation complete!')
  console.log('\n⚠️  Note: These users bypass Supabase Auth email verification')
  console.log('   They are created directly in the database.')
}

async function linkUserToTenant(userId, testUser) {
  try {
    console.log('Linking user to tenant...')
    
    const { error } = await supabase
      .from('user_tenants')
      .insert({
        id: generateUUID(),
        user_id: userId,
        tenant_id: TENANT_ID,
        role: testUser.role,
        is_active: true,
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })

    if (error) {
      if (error.code === '23505') {
        console.log('User already linked to tenant')
      } else {
        console.log('Error linking:', error.message)
      }
    } else {
      console.log('✅ User linked to tenant with role:', testUser.role)
    }
  } catch (error) {
    console.log('Error:', error.message)
  }
}

createUsersDirectly().catch(console.error)
