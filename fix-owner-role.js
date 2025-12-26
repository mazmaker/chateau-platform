// Fix Owner Role for mazmakerv2.sup@gmail.com
// This script uses service_role key to update user role

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

async function fixOwnerRole() {
  console.log('=== Checking and Fixing Owner Role ===\n');

  try {
    // Step 1: Check current role in public.users
    console.log('1. Checking current role in public.users...');
    const checkResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?email=mazmakerv2.sup@gmail.com&select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const publicUser = await checkResponse.json();
    console.log('   public.users data:', JSON.stringify(publicUser, null, 2));

    // Step 2: Check auth.users metadata
    console.log('\n2. Checking auth.users metadata...');
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const authData = await authResponse.json();
    const targetAuthUser = authData.users?.find(u => u.email === 'mazmakerv2.sup@gmail.com');

    if (targetAuthUser) {
      console.log('   auth.users found:');
      console.log('   - ID:', targetAuthUser.id);
      console.log('   - Email:', targetAuthUser.email);
      console.log('   - Metadata:', JSON.stringify(targetAuthUser.user_metadata, null, 2));
    }

    // Step 3: Update role in public.users
    console.log('\n3. Updating role to "owner" in public.users...');

    // First, get the user ID
    const userId = targetAuthUser?.id || publicUser?.[0]?.id;

    if (!userId) {
      console.error('   ERROR: Could not find user ID!');
      return;
    }

    const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ role: 'owner' })
    });

    const updatedUser = await updateResponse.json();
    console.log('   Update result:', JSON.stringify(updatedUser, null, 2));

    // Step 4: Update metadata in auth.users using Admin API
    console.log('\n4. Updating role in auth.users metadata...');

    const updateMetadataResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
      method: 'PUT',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        user_metadata: {
          ...targetAuthUser?.user_metadata,
          role: 'owner'
        }
      })
    });

    const updatedAuth = await updateMetadataResponse.json();
    console.log('   Metadata update result:', JSON.stringify(updatedAuth, null, 2));

    // Step 5: Verify final state
    console.log('\n5. Verifying final state...');

    const finalCheckResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${userId}&select=*`, {
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
      }
    });

    const finalUser = await finalCheckResponse.json();
    console.log('\n=== FINAL RESULT ===');
    console.log('Role in public.users:', finalUser[0]?.role);
    console.log('User ID:', userId);
    console.log('\n✅ Role update complete! Please try logging in again.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error);
  }
}

// Run the function
fixOwnerRole();
