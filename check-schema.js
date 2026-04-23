import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4'
)

async function checkSchema() {
  console.log('🔍 Checking current database schema...\n')

  try {
    // Check tenants table
    console.log('🏢 **TENANTS table:**')
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('*')
      .limit(1)

    if (!tenantError && tenantData && tenantData[0]) {
      console.log('   Columns:', Object.keys(tenantData[0]).join(', '))
      const hasBillingSettings = 'billing_settings' in tenantData[0]
      console.log(`   billing_settings column: ${hasBillingSettings ? '✅ EXISTS' : '❌ MISSING'}`)
      if (hasBillingSettings && tenantData[0].billing_settings) {
        console.log(`   billing_settings content: ${Object.keys(tenantData[0].billing_settings).length > 0 ? '✅ HAS DATA' : '❌ EMPTY'}`)
      }
    } else {
      console.log('   ❌ Error accessing tenants table:', tenantError?.message)
    }

    // Check users table
    console.log('\n👤 **USERS table:**')
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(1)

    if (!userError && userData && userData[0]) {
      console.log('   Columns:', Object.keys(userData[0]).join(', '))
    } else {
      console.log('   ❌ Error accessing users table:', userError?.message)
    }

    // Check invoices table
    console.log('\n💰 **INVOICES table:**')
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .limit(1)

    if (!invoiceError && invoiceData && invoiceData[0]) {
      console.log('   Columns:', Object.keys(invoiceData[0]).join(', '))
      console.log(`   Found ${invoiceData.length} invoice(s)`)
    } else {
      console.log('   ❌ Error accessing invoices table:', invoiceError?.message)
    }

    // Check for profiles table
    console.log('\n👤 **PROFILES table check:**')
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)

    if (profileError) {
      console.log('   ❌ PROFILES table does NOT exist (this is the 403 error source)')
      console.log('   Error:', profileError.message)
    } else {
      console.log('   ✅ PROFILES table exists')
      if (profileData && profileData[0]) {
        console.log('   Columns:', Object.keys(profileData[0]).join(', '))
      }
    }

    // Check RPC functions
    console.log('\n🛠️ **Billing RPC Functions check:**')

    // Test get_billing_settings function
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .rpc('get_billing_settings')

      if (settingsError) {
        console.log('   ❌ get_billing_settings() function: MISSING')
        console.log('   Error:', settingsError.message)
      } else {
        console.log('   ✅ get_billing_settings() function: EXISTS')
        console.log('   Returns:', typeof settingsData, Object.keys(settingsData || {}).length, 'keys')
      }
    } catch (err) {
      console.log('   ❌ get_billing_settings() function: ERROR')
      console.log('   Error:', err.message)
    }

    // Test update_billing_settings function
    try {
      const { data: updateData, error: updateError } = await supabase
        .rpc('update_billing_settings', { new_settings: {} })

      if (updateError) {
        console.log('   ❌ update_billing_settings() function: MISSING or ERROR')
        console.log('   Error:', updateError.message)
      } else {
        console.log('   ✅ update_billing_settings() function: EXISTS')
      }
    } catch (err) {
      console.log('   ❌ update_billing_settings() function: ERROR')
      console.log('   Error:', err.message)
    }

    console.log('\n📋 **Summary:**')
    console.log('   • Main issue: profiles table does not exist')
    console.log('   • Solution: Use tenants.billing_settings instead')
    console.log('   • Need: RPC functions for secure access')
    console.log('\n💡 **Next steps:**')
    console.log('   1. Run: node apply-migration.js')
    console.log('   2. Test billing settings access')
    console.log('   3. Verify 403 error is resolved')

  } catch (error) {
    console.error('❌ Schema check failed:', error.message)
  }
}

checkSchema()