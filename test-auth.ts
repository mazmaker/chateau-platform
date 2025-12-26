import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUserAuth() {
  const email = 'mazmakerv2.sup@gmail.com';

  console.log(`Testing authentication for: ${email}`);
  console.log('='.repeat(50));

  // Try to get current session
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

  if (sessionError) {
    console.error('Error getting session:', sessionError);
    return;
  }

  if (sessionData.session) {
    console.log('✓ Current user logged in:');
    console.log(`  Email: ${sessionData.session.user.email}`);
    console.log(`  ID: ${sessionData.session.user.id}`);
    console.log(`  Role: ${sessionData.session.user.role}`);
    console.log(`  Metadata:`, sessionData.session.user.user_metadata);
  } else {
    console.log('✗ No user is currently logged in');
  }

  // Try to get user info
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error('Error getting user:', userError);
    return;
  }

  if (userData.user) {
    console.log('\n✓ User data retrieved:');
    console.log(`  Email: ${userData.user.email}`);
    console.log(`  ID: ${userData.user.id}`);
    console.log(`  Role: ${userData.user.role}`);
    console.log(`  Confirmed at: ${userData.user.email_confirmed_at}`);
    console.log(`  Created at: ${userData.user.created_at}`);

    // Check if this is the user we're looking for
    if (userData.user.email === email) {
      console.log('\n✅ USER MATCHES! This is the user we are checking');

      // Check if they can access admin functions
      console.log('\nChecking for admin/owner access...');

      // Try to access user_tenants table
      const { data: tenantData, error: tenantError } = await supabase
        .from('user_tenants')
        .select('*')
        .eq('user_id', userData.user.id);

      if (tenantError) {
        console.log('✗ Cannot access user_tenants table');
        console.log('  Error:', tenantError.message);

        // Try to check if table exists
        console.log('\nChecking available tables...');
        const { data: tablesData, error: tablesError } = await supabase
          .rpc('get_table_names');

        if (tablesError) {
          console.log('Cannot get table names');
        }
      } else {
        if (tenantData && tenantData.length > 0) {
          console.log('✓ User has tenant memberships:');
          tenantData.forEach(t => {
            console.log(`  - Tenant ID: ${t.tenant_id}`);
            console.log(`    Role: ${t.role}`);
            console.log(`    Active: ${t.is_active}`);
          });

          // Check if any have owner role
          const ownerTenants = tenantData.filter(t => t.role === 'owner');
          if (ownerTenants.length > 0) {
            console.log(`\n✅ USER HAS OWNER ROLE in ${ownerTenants.length} tenant(s)`);
          } else {
            console.log('\n❌ User does NOT have owner role in any tenant');
          }
        } else {
          console.log('\n❌ User has no tenant memberships');
        }
      }
    } else {
      console.log(`\n❌ Current user (${userData.user.email}) is NOT the target user (${email})`);
    }
  } else {
    console.log('\n✗ No user data available');
  }
}

testUserAuth();