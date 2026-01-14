import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
// Using anon key - will delete via RPC function
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteUserCompletely() {
  const email = process.argv[2];

  if (!email) {
    console.log('\nUsage: node scripts/delete-user.mjs <email>');
    console.log('Example: node scripts/delete-user.mjs somrutai.kongsri@gmail.com\n');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log(`DELETE USER: ${email}`);
  console.log('='.repeat(80) + '\n');

  // 1. Check if user exists in public.users
  const { data: publicUser, error: publicError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (publicError) {
    console.log('❌ Error checking public.users:', publicError.message);
  } else if (publicUser) {
    console.log('Found in public.users:');
    console.log(`  ID: ${publicUser.id}`);
    console.log(`  Name: ${publicUser.full_name || 'N/A'}`);
    console.log(`  Role: ${publicUser.role}`);
    console.log(`  Tenant: ${publicUser.tenant_id}\n`);
  } else {
    console.log('⚠️  User NOT found in public.users\n');
  }

  // 2. Try to delete using RPC function (server-side with service_role)
  console.log('Attempting to delete user...');
  console.log('');

  const { data: result, error: deleteError } = await supabase.rpc('delete_user_completely', {
    p_email: email
  });

  if (deleteError) {
    console.log('❌ RPC Error:', deleteError.message);
    console.log('\nThe RPC function might not exist. Trying alternative method...\n');

    // Alternative: Delete from public.users only (what we can access)
    const { error: directDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('email', email);

    if (directDeleteError) {
      console.log('❌ Direct delete error:', directDeleteError.message);
      console.log('\n⚠️  Could not delete user automatically.');
      console.log('Please delete manually from Supabase Dashboard:');
      console.log('  1. Go to Table Editor → users');
      console.log(`  2. Find ${email}`);
      console.log('  3. Click Delete\n');
    } else {
      console.log('✓ Deleted from public.users');
      console.log('⚠️  Note: auth.users entry may still exist.');
      console.log('   Go to Authentication → Users to delete from auth.users if needed.\n');
    }
  } else {
    console.log('✓ User deleted successfully!');
    console.log(`   Result: ${JSON.stringify(result)}\n`);
  }

  console.log('='.repeat(80) + '\n');
}

deleteUserCompletely().then(() => process.exit(0));
