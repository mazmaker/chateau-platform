#!/usr/bin/env node
/**
 * Fix Users Without Auth (Direct)
 *
 * This script directly creates auth.users for users missing auth_user_id
 * Run with: node scripts/fix-users-direct.cjs YOUR_SERVICE_ROLE_KEY
 */

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = process.argv[2];

if (!serviceRoleKey) {
  console.error('❌ Usage: node scripts/fix-users-direct.cjs YOUR_SERVICE_ROLE_KEY');
  console.log('\nGet your service_role key from:');
  console.log('Supabase Dashboard → Project Settings → API → service_role (secret)');
  process.exit(1);
}

async function fixUsers() {
  console.log('🔧 Fetching users without auth_user_id...\n');

  // First, fetch users from public.users table
  const usersResponse = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceRoleKey,
      'Authorization': `Bearer ${serviceRoleKey}`,
      'Prefer': 'params=single-object'
    },
    body: JSON.stringify({
      select: 'id,email,full_name,role,tenant_id',
      and: {
        'auth_user_id': { is: null },
        'is_active': { is: true }
      }
    })
  });

  if (!usersResponse.ok) {
    const errorText = await usersResponse.text();
    console.error('❌ Error fetching users:', errorText);
    process.exit(1);
  }

  const users = await usersResponse.json();
  console.log(`Found ${users.length} users without auth_user_id\n`);

  const results = [];

  for (const user of users) {
    console.log(`Processing: ${user.email}...`);

    // Generate temp password
    const tempPassword = crypto.randomUUID().slice(0, 16);

    try {
      // Try to create auth user via Admin API
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            tenant_id: user.tenant_id,
            role: user.role,
          },
        }),
      });

      const authResult = await authResponse.json();

      if (!authResponse.ok) {
        // Check if auth user already exists
        const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          method: 'GET',
          headers: {
            'apikey': serviceRoleKey,
            'Authorization': `Bearer ${serviceRoleKey}`,
          },
        });

        const listResult = await listResponse.json();
        const existingUser = listResult.users?.find(u => u.email === user.email);

        if (existingUser) {
          // Link to existing auth user
          await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'apikey': serviceRoleKey,
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ auth_user_id: existingUser.id }),
          });

          console.log(`  ✓ Linked to existing auth user`);
          results.push({ email: user.email, status: 'linked' });
        } else {
          console.log(`  ✗ Failed: ${authResult.message || authResult.error_description || 'Unknown error'}`);
          results.push({ email: user.email, status: 'failed', error: authResult.message || authResult.error_description });
        }
        continue;
      }

      // Update user with auth_user_id
      await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ auth_user_id: authResult.id }),
      });

      console.log(`  ✓ Created auth user`);
      console.log(`  🔑 Temp password: ${tempPassword}`);
      results.push({
        email: user.email,
        status: 'created',
        tempPassword,
        userId: user.id
      });

    } catch (err) {
      console.log(`  ✗ Error: ${err.message}`);
      results.push({ email: user.email, status: 'error', error: err.message });
    }
  }

  console.log('\n=== RESULTS ===');
  results.forEach((r, i) => {
    console.log(`\n${i + 1}. ${r.email}`);
    console.log(`   Status: ${r.status}`);
    if (r.tempPassword) {
      console.log(`   Temp Password: ${r.tempPassword}`);
    }
  });

  console.log('\n✅ Fix complete!');
  console.log('\n⚠️  Users with temp passwords should reset them after first login.');
}

fixUsers().catch(console.error);
