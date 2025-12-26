#!/usr/bin/env node
/**
 * Update sales@chateau.com role from ADMIN to SALES
 */

const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cXFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function updateSalesRole() {
  console.log('\n' + '='.repeat(60));
  console.log('  UPDATE ROLE: sales@chateau.com');
  console.log('  FROM: ADMIN → TO: SALES');
  console.log('='.repeat(60));
  console.log('');

  const email = 'sales@chateau.com';

  // Step 1: Check current role
  console.log('Step 1: Checking current role...');
  const { data: currentUser, error: checkError } = await supabase
    .from('users')
    .select('email, role')
    .eq('email', email)
    .single();

  if (checkError) {
    console.log('Error:', checkError.message);
    return;
  }

  console.log(`Current: ${currentUser.email} | Role: ${currentUser.role.toUpperCase()}`);
  console.log('');

  // Step 2: Update to SALES
  console.log('Step 2: Updating role to SALES...');
  const { data: updateResult, error: updateError } = await supabase
    .from('users')
    .update({ role: 'sales' })
    .eq('email', email)
    .select();

  if (updateError) {
    console.log('❌ Error:', updateError.message);
    return;
  }

  console.log('✅ Role updated successfully!');
  console.log('');

  // Step 3: Verify
  console.log('Step 3: Verifying...');
  const { data: verifyUser, error: verifyError } = await supabase
    .from('users')
    .select('email, role')
    .eq('email', email)
    .single();

  if (verifyError) {
    console.log('Error:', verifyError.message);
  } else {
    console.log(`✅ Verified: ${verifyUser.email} | Role: ${verifyUser.role.toUpperCase()}`);
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('✅ ROLE UPDATE COMPLETED!');
  console.log('='.repeat(60));

  // Show all users
  console.log('');
  console.log('CURRENT USERS:');
  const { data: allUsers } = await supabase
    .from('users')
    .select('email, role');

  const roleIcons = { 'owner': '👑', 'admin': '🔧', 'sales': '💼' };
  allUsers.forEach(u => {
    console.log(`  ${roleIcons[u.role] || '❓'} ${u.email.padEnd(35)} ${u.role.toUpperCase()}`);
  });
  console.log('');
}

updateSalesRole();
