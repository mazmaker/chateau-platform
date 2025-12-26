// Fix and Reset Passwords for Admin and Sales users
const { createClient } = require('@supabase/supabase-js');

// Supabase configuration
const SUPABASE_URL = 'https://mxojqptwjgqzgahcsdjs.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im14b2pxcHR3amdxcmdhaGNzZGpzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDU5MzQxOSwiZXhwIjoyMDUwMTY5NDE5fQ.PZUYXRhKIzW-A1i_bvuJmKpYu5Dl4ON4HNhJHJEY7TU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function fixPasswords() {
  console.log('🔧 Checking and fixing user passwords...\n');

  const users = [
    { email: 'admin@chateau.com', password: 'Chateau@2024', role: 'admin' },
    { email: 'sales@chateau.com', password: 'Chateau@2024', role: 'sales' }
  ];

  for (const user of users) {
    console.log(`Checking ${user.email} (${user.role})...`);

    // Check if user exists in auth.users
    const { data: { users: authUsers }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error(`❌ Error listing users:`, listError.message);
      continue;
    }

    const existingUser = authUsers.find(u => u.email === user.email);

    if (existingUser) {
      console.log(`  ✅ User exists in auth.users`);
      console.log(`  📧 Email: ${existingUser.email}`);
      console.log(`  🆔 ID: ${existingUser.id}`);
      console.log(`  ✉️ Email confirmed: ${existingUser.email_confirmed_at ? 'Yes' : 'No'}`);

      // Update password
      const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
        existingUser.id,
        { password: user.password }
      );

      if (updateError) {
        console.error(`  ❌ Error updating password:`, updateError.message);
      } else {
        console.log(`  ✅ Password updated to: ${user.password}`);
      }
    } else {
      console.log(`  ⚠️ User NOT found in auth.users`);
      console.log(`  🔨 Creating user...`);

      // Create user in auth.users
      const { data: createData, error: createError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { role: user.role }
      });

      if (createError) {
        console.error(`  ❌ Error creating user:`, createError.message);
      } else {
        console.log(`  ✅ User created with ID: ${createData.user.id}`);

        // Update public.users with new ID
        const { error: updateError } = await supabase
          .from('users')
          .update({ id: createData.user.id })
          .eq('email', user.email);

        if (updateError) {
          console.error(`  ⚠️ Warning: Could not update public.users ID:`, updateError.message);
        } else {
          console.log(`  ✅ Synced ID to public.users`);
        }
      }
    }

    // Verify user in public.users
    const { data: publicUser, error: publicError } = await supabase
      .from('users')
      .select('*')
      .eq('email', user.email)
      .single();

    if (publicError) {
      console.error(`  ❌ Error checking public.users:`, publicError.message);
    } else {
      console.log(`  ✅ Found in public.users with role: ${publicUser.role}`);
    }

    console.log('');
  }

  console.log('✅ Password fix completed!');
  console.log('\n📋 Updated Credentials:');
  console.log('┌─────────────────────────────────────────┐');
  console.log('│ Admin User                              │');
  console.log('│ Email: admin@chateau.com                │');
  console.log('│ Password: Chateau@2024                  │');
  console.log('├─────────────────────────────────────────┤');
  console.log('│ Sales User                              │');
  console.log('│ Email: sales@chateau.com                │');
  console.log('│ Password: Chateau@2024                  │');
  console.log('└─────────────────────────────────────────┘');
}

fixPasswords().catch(console.error);
