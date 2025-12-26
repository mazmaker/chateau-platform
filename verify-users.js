// Verify users in public.users table

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

async function verifyUsers() {
  console.log('=== Verifying Users ===\n');

  // Get all users from public.users
  const response = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=created_at.asc`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  const users = await response.json();

  console.log(`Total users in public.users: ${users.length}\n`);

  if (users.length === 0) {
    console.log('❌ No users found! Something went wrong.');
    return;
  }

  users.forEach((user, index) => {
    const roleIcon = user.role === 'owner' ? '👑' : user.role === 'admin' ? '🔧' : '💼';
    const activeStatus = user.is_active ? '✅' : '❌';
    console.log(`${index + 1}. ${roleIcon} ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Tenant: ${user.tenant_id}`);
    console.log(`   Active: ${activeStatus}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('');
  });

  // Check auth.users metadata
  console.log('=== Checking auth.users metadata ===\n');
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  const authData = await authResponse.json();
  const authUsers = authData.users || [];

  authUsers.forEach(user => {
    const role = user.user_metadata?.role || 'NOT SET';
    const roleIcon = role === 'owner' ? '👑' : role === 'admin' ? '🔧' : role === 'sales' ? '💼' : '❓';
    console.log(`${roleIcon} ${user.email} -> role: ${role}`);
  });

  console.log('\n✅ Verification complete!');
}

verifyUsers();
