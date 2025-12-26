// Sync auth.users to public.users with roles
// This creates or updates records in public.users table

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

async function syncUsers() {
  console.log('=== Syncing auth.users to public.users ===\n');

  try {
    // Step 1: Get all auth users
    console.log('1. Fetching all auth.users...');
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const authData = await authResponse.json();
    const authUsers = authData.users || [];
    console.log(`   Found ${authUsers.length} users in auth.users\n`);

    // Step 2: Get existing public users
    console.log('2. Checking existing public.users...');
    const publicResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const publicUsers = await publicResponse.json();
    console.log(`   Found ${publicUsers.length} users in public.users\n`);

    // Step 3: Get or create default tenant
    console.log('3. Checking/Creating default tenant...');
    const tenantResponse = await fetch(`${SUPABASE_URL}/rest/v1/tenants?id=eq.00000000-0000-0000-0000-000000000001&select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    let tenants = await tenantResponse.json();

    if (!tenants || tenants.length === 0) {
      console.log('   Creating default tenant...');
      const createTenantResponse = await fetch(`${SUPABASE_URL}/rest/v1/tenants`, {
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
          max_properties: 100,
          max_users: 50
        })
      });

      tenants = await createTenantResponse.json();
      console.log('   Default tenant created!\n');
    } else {
      console.log('   Default tenant exists.\n');
    }

    const defaultTenantId = tenants[0]?.id || '00000000-0000-0000-0000-000000000001';
    console.log(`   Using tenant ID: ${defaultTenantId}\n`);

    // Step 4: Sync users
    console.log('4. Syncing users...');
    let syncCount = 0;
    let updateCount = 0;

    for (let i = 0; i < authUsers.length; i++) {
      const authUser = authUsers[i];
      const existingUser = publicUsers.find(u => u.id === authUser.id);

      // Determine role - first user is owner, others admin by default
      // If user already has role in metadata, use that
      let role = authUser.user_metadata?.role || (i === 0 ? 'owner' : 'admin');

      // Override for mazmakerv2.sup@gmail.com to be owner
      if (authUser.email === 'mazmakerv2.sup@gmail.com') {
        role = 'owner';
      }

      if (existingUser) {
        // Update existing user
        console.log(`   [${i+1}/${authUsers.length}] UPDATE: ${authUser.email} -> role: ${role}`);
        await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${authUser.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: authUser.email,
            role: role,
            tenant_id: defaultTenantId,
            is_active: true
          })
        });
        updateCount++;
      } else {
        // Insert new user
        console.log(`   [${i+1}/${authUsers.length}] INSERT: ${authUser.email} -> role: ${role}`);
        await fetch(`${SUPABASE_URL}/rest/v1/users`, {
          method: 'POST',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            id: authUser.id,
            email: authUser.email,
            role: role,
            tenant_id: defaultTenantId,
            is_active: true,
            created_at: authUser.created_at
          })
        });
        syncCount++;
      }

      // Update auth metadata with role
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${authUser.id}`, {
        method: 'PUT',
        headers: {
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          user_metadata: {
            ...authUser.user_metadata,
            role: role
          }
        })
      });
    }

    console.log('\n=== SUMMARY ===');
    console.log(`✅ Synced ${syncCount} new users`);
    console.log(`✅ Updated ${updateCount} existing users`);
    console.log(`✅ Total users processed: ${authUsers.length}\n`);

    // Step 5: Verify final state
    console.log('5. Verifying final state...');
    const finalResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.desc`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const finalUsers = await finalResponse.json();
    console.log('\n=== FINAL USERS IN public.users ===');
    finalUsers.forEach(u => {
      console.log(`📧 ${u.email}`);
      console.log(`   ID: ${u.id}`);
      console.log(`   Role: ${u.role}`);
      console.log(`   Tenant: ${u.tenant_id}`);
      console.log(`   Active: ${u.is_active}`);
      console.log('');
    });

    console.log('✅ Sync complete! You can now login with your credentials.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the function
syncUsers();
