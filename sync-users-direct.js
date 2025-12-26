// Direct SQL execution using Supabase PostgREST
// This bypasses RLS by using service_role key

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

async function executeSQL() {
  console.log('=== Direct SQL Execution ===\n');

  // First, create a temporary SQL file to execute
  const sqlCommands = `
-- Step 1: Ensure default tenant exists
INSERT INTO tenants (id, name, slug, status, subscription_plan, max_properties, max_users)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Company',
    'default-company',
    'active',
    'professional',
    100,
    50
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Get auth users and insert/update in public.users
-- This will be done via direct SQL
  `;

  try {
    // Step 1: Get all auth users
    console.log('1. Fetching auth.users...');
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const authData = await authResponse.json();
    const authUsers = authData.users || [];
    console.log(`   Found ${authUsers.length} users\n`);

    // Step 2: Use RPC to execute raw SQL
    // First, let's try to insert each user individually using the REST API with proper headers

    for (let i = 0; i < authUsers.length; i++) {
      const authUser = authUsers[i];

      // Determine role - first user is owner
      let role = i === 0 ? 'owner' : 'admin';

      // mazmakerv2.sup@gmail.com is always owner
      if (authUser.email === 'mazmakerv2.sup@gmail.com') {
        role = 'owner';
      }

      console.log(`   [${i+1}/${authUsers.length}] Processing: ${authUser.email} as ${role}`);

      // Try POST with explicit return representation
      const insertResponse = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
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
          tenant_id: '00000000-0000-0000-0000-000000000001',
          is_active: true,
          created_at: authUser.created_at || new Date().toISOString()
        })
      });

      if (insertResponse.ok) {
        const result = await insertResponse.json();
        console.log(`      ✅ Success: ${JSON.stringify(result)}`);
      } else {
        const errorText = await insertResponse.text();
        console.log(`      ❌ Failed: ${insertResponse.status} ${errorText}`);

        // Try update instead
        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${authUser.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            email: authUser.email,
            role: role,
            tenant_id: '00000000-0000-0000-0000-000000000001',
            is_active: true
          })
        });

        if (updateResponse.ok) {
          console.log(`      ✅ Updated successfully`);
        }
      }

      // Update auth metadata
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

    // Step 3: Verify
    console.log('\n2. Verifying results...');
    const verifyResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const users = await verifyResponse.json();
    console.log(`\n   Total users in public.users: ${Array.isArray(users) ? users.length : 0}`);

    if (Array.isArray(users) && users.length > 0) {
      console.log('\n   Users:');
      users.forEach((u, idx) => {
        const icon = u.role === 'owner' ? '👑' : u.role === 'admin' ? '🔧' : '💼';
        console.log(`   ${idx + 1}. ${icon} ${u.email} - Role: ${u.role}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

executeSQL();
