#!/usr/bin/env node

/**
 * One-Click User Sync Script
 * Run: node run-sync.cjs
 */

const https = require('https');

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      port: 443
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject({ status: res.statusCode, ...parsed });
          } else {
            resolve(parsed);
          }
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function main() {
  console.log('\n========================================');
  console.log('   CHATEAU Platform - User Sync Tool');
  console.log('========================================\n');

  try {
    // Step 1: Get auth users
    console.log('Step 1: Fetching auth.users...');
    const authData = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const users = authData.users || [];
    console.log(`  Found ${users.length} users\n`);

    // Step 2: Create tenant (try, skip if fails)
    console.log('Step 2: Creating default tenant...');
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/tenants`, {
        method: 'POST',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default Company',
          slug: 'default-company',
          status: 'active',
          subscription_plan: 'professional',
          max_properties: 100
        })
      });
      console.log('  Tenant created/exists\n');
    } catch (e) {
      console.log('  Tenant might already exist\n');
    }

    // Step 3: Sync each user
    console.log('Step 3: Syncing users...\n');

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      let role = (i === 0 || user.email === 'mazmakerv2.sup@gmail.com') ? 'owner' : 'admin';

      const roleIcon = role === 'owner' ? '👑' : '🔧';
      console.log(`  [${i+1}/${users.length}] ${roleIcon} ${user.email} -> ${role}`);

      // Insert/Update user
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/users`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id: user.id,
            email: user.email,
            role: role,
            tenant_id: '00000000-0000-0000-0000-000000000001',
            is_active: true,
            created_at: user.created_at
          })
        });
        console.log(`     ✅ Inserted\n`);
      } catch (e) {
        // Try update instead
        try {
          await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${user.id}`, {
            method: 'PATCH',
            headers: {
              'apikey': SERVICE_ROLE_KEY,
              'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              email: user.email,
              role: role,
              tenant_id: '00000000-0000-0000-0000-000000000001',
              is_active: true
            })
          });
          console.log(`     ✅ Updated\n`);
        } catch (e2) {
          console.log(`     ⚠️ Skipped (might exist)\n`);
        }
      }

      // Update auth metadata
      try {
        await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
          method: 'PUT',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_metadata: {
              ...user.user_metadata,
              role: role
            }
          })
        });
      } catch (e) {
        // Ignore metadata errors
      }
    }

    // Step 4: Verify
    console.log('Step 4: Verification...');
    const usersData = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    console.log(`  Total users in public.users: ${usersData.length}\n`);

    if (usersData.length > 0) {
      console.log('  Users:');
      usersData.forEach((u, idx) => {
        const icon = u.role === 'owner' ? '👑' : u.role === 'admin' ? '🔧' : '💼';
        console.log(`    ${idx + 1}. ${icon} ${u.email} (${u.role})`);
      });
    }

    console.log('\n========================================');
    console.log('  ✅ Sync Complete!');
    console.log('========================================\n');
    console.log('You can now login with your credentials.\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message || error);
    console.error(error);
  }
}

main();
