import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function createOwner() {
  try {
    console.log('🔐 Creating Owner Account...')

    const tempPassword = 'TempOWNER123!'
    const email = 'owner@chateau.test'
    const fullName = 'Super Admin'

    // Create auth user
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'owner'
      }
    })

    if (authError) {
      console.error('❌ Auth error:', authError.message)
      return
    }

    console.log('✅ Auth user created:', authUser.user.id)

    // Get or create default tenant
    let { data: tenants } = await supabaseAdmin
      .from('tenants')
      .select('*')
      .limit(1)

    let tenantId
    if (!tenants || tenants.length === 0) {
      // Create default tenant
      const { data: newTenant, error: tenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          name: 'CHATEAU Platform',
          slug: 'chateau-platform',
          status: 'active'
        })
        .select()
        .single()

      if (tenantError) {
        console.error('❌ Tenant error:', tenantError.message)
        return
      }
      tenantId = newTenant.id
      console.log('✅ Tenant created:', tenantId)
    } else {
      tenantId = tenants[0].id
      console.log('✅ Using existing tenant:', tenantId)
    }

    // Create user profile
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: email,
        full_name: fullName,
        tenant_id: tenantId,
        role: 'owner',
        password_set_at: null,
        is_active: true
      })

    if (userError) {
      console.error('❌ User profile error:', userError.message)
      return
    }

    console.log('✅ User profile created')

    // Link to tenant
    const { error: linkError } = await supabaseAdmin
      .from('user_tenants')
      .insert({
        user_id: authUser.user.id,
        tenant_id: tenantId,
        is_active: true,
        joined_at: new Date().toISOString()
      })

    if (linkError) {
      console.error('❌ Link error:', linkError.message)
      return
    }

    console.log('✅ Linked to tenant')

    console.log('')
    console.log('🎉 OWNER ACCOUNT CREATED!')
    console.log('========================')
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 Temporary Password: ${tempPassword}`)
    console.log(`💼 Role: OWNER`)
    console.log('')
    console.log('🔗 Login URL: http://localhost:5173/login')

  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

createOwner()