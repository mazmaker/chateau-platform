#!/usr/bin/env node
/**
 * Delete User: viewer@chateau.com
 */

const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const email = 'viewer@chateau.com';
const userId = '529a671c-fa1e-47ee-83cd-042b84dc6e87';

async function deleteUser() {
  console.log('========================================');
  console.log('DELETE USER: viewer@chateau.com');
  console.log('========================================');
  console.log('');

  // Step 1: เช็คว่า user ยังอยู่ไหม
  console.log('Step 1: Checking if user exists...');
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (checkError) {
    console.log('Error checking user:', checkError.message);
    return;
  }

  if (!existingUser) {
    console.log('ℹ️  User not found in public.users');
  } else {
    console.log('Found:', existingUser.email, '| Role:', existingUser.role);
  }

  // Step 2: ลบจาก public.users
  console.log('');
  console.log('Step 2: Deleting from public.users...');
  const { data: deleteResult, error: deleteError } = await supabase
    .from('users')
    .delete()
    .eq('email', email);

  if (deleteError) {
    console.log('❌ Error:', deleteError.message);
    return;
  }

  console.log('✅ Deleted from public.users');

  // Step 3: Verify
  console.log('');
  console.log('Step 3: Verifying deletion...');
  const { data: verifyUser, error: verifyError } = await supabase
    .from('users')
    .select('email, role')
    .eq('email', email)
    .maybeSingle();

  if (verifyError && verifyError.code !== 'PGRST116') {
    console.log('Error verifying:', verifyError.message);
  } else if (verifyUser) {
    console.log('⚠️  User still exists!');
  } else {
    console.log('✅ Verified - User removed from public.users');
  }

  console.log('');
  console.log('========================================');
  console.log('✅ DELETION COMPLETED!');
  console.log('========================================');
  console.log('');
  console.log('Note: To remove from auth.users completely:');
  console.log('https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/auth/users');
  console.log('Search: viewer@chateau.com');
}

deleteUser();
