#!/usr/bin/env node
/**
 * Delete User Completely
 *
 * Deletes a user from both auth.users and public.users
 * Run with: node scripts/delete-user-completely.cjs YOUR_SERVICE_ROLE_KEY email@example.com
 */

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = process.argv[2];
const targetEmail = process.argv[3];

if (!serviceRoleKey || !targetEmail) {
  console.error('❌ Usage: node scripts/delete-user-completely.cjs YOUR_SERVICE_ROLE_KEY email@example.com');
  console.log('\nGet your service_role key from:');
  console.log('Supabase Dashboard → Project Settings → API → service_role (secret)');
  process.exit(1);
}

async function deleteUser() {
  console.log(`🔍 Looking for user: ${targetEmail}\n`);

  // First, get the auth user ID
  const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'GET',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
  });

  const listResult = await listResponse.json();
  const targetAuthUser = listResult.users?.find(u => u.email === targetEmail);

  let authUserId = null;
  if (targetAuthUser) {
    authUserId = targetAuthUser.id;
    console.log(`Found auth user: ${authUserId}`);
  } else {
    console.log(`No auth user found for ${targetEmail}`);
  }

  // Check public.users
  const publicResponse = await fetch(`${supabaseUrl}/rest/v1/users?email=eq.${targetEmail}`, {
    method: 'GET',
    headers: {
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
    },
  });

  const publicUsers = await publicResponse.json();
  let publicUserId = null;
  if (publicUsers && publicUsers.length > 0) {
    publicUserId = publicUsers[0].id;
    console.log(`Found public user: ${publicUserId}`);
  } else {
    console.log(`No public user found for ${targetEmail}`);
  }

  // Delete from auth.users
  if (authUserId) {
    console.log(`\nDeleting from auth.users...`);
    const deleteAuthResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users/${authUserId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (deleteAuthResponse.ok) {
      console.log(`✅ Deleted from auth.users`);
    } else {
      const errorText = await deleteAuthResponse.text();
      console.log(`❌ Failed to delete from auth.users: ${errorText}`);
    }
  }

  // Delete from public.users
  if (publicUserId) {
    console.log(`\nDeleting from public.users...`);
    const deletePublicResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${publicUserId}`, {
      method: 'DELETE',
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
      },
    });

    if (deletePublicResponse.ok) {
      console.log(`✅ Deleted from public.users`);
    } else {
      const errorText = await deletePublicResponse.text();
      console.log(`❌ Failed to delete from public.users: ${errorText}`);
    }
  }

  console.log('\n✅ Delete operation complete!');
}

deleteUser().catch(console.error);
