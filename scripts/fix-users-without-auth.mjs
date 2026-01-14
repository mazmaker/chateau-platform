// Script to fix users without auth_user_id
// This will create auth.users for existing users that don't have one

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseServiceKey = 'YOUR_SERVICE_ROLE_KEY'; // Replace with actual key

async function fixUsersWithoutAuth() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

  // Use service role key for admin operations
  const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('Fetching users without auth_user_id...');

  // Get users that don't have auth_user_id
  const { data: users, error } = await adminSupabase
    .from('users')
    .select('id, email, full_name, role, tenant_id')
    .is('auth_user_id', null)
    .is('is_active', true);

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users without auth_user_id`);

  for (const user of users) {
    console.log(`\nProcessing: ${user.email}`);

    // Generate a temporary password (user will need to reset)
    const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8);

    try {
      // Create auth user
      const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: user.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: user.full_name,
          tenant_id: user.tenant_id,
          role: user.role,
        },
      });

      if (authError) {
        // User might already exist in auth.users with different email
        console.error(`  ✗ Failed to create auth user: ${authError.message}`);

        // Try to find existing auth user by email
        const { data: existingUsers } = await adminSupabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(u => u.email === user.email);

        if (existingUser) {
          console.log(`  ! Found existing auth user: ${existingUser.id}`);
          // Update the user record with existing auth_user_id
          await adminSupabase
            .from('users')
            .update({ auth_user_id: existingUser.id })
            .eq('id', user.id);
          console.log(`  ✓ Updated auth_user_id`);
        }
        continue;
      }

      // Update user record with auth_user_id
      await adminSupabase
        .from('users')
        .update({ auth_user_id: authData.user.id })
        .eq('id', user.id);

      console.log(`  ✓ Created auth user and updated record`);
      console.log(`    Temp password: ${tempPassword}`);
      console.log(`    User should reset password after first login`);

    } catch (err) {
      console.error(`  ✗ Error: ${err.message}`);
    }
  }

  console.log('\n✅ Fix complete!');
  console.log('Users can now login with their email.');
  console.log('They should reset their password after first login.');
}

// Run the fix
fixUsersWithoutAuth().catch(console.error);
