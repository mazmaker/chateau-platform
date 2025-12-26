// Fix: Create tenant first, then sync users
const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

async function fixAndSync() {
  console.log('=== Step 1: Create Default Tenant ===\n');

  // Create tenant using SQL directly via psql command style
  const tenantData = {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Default Company',
    slug: 'default-company',
    status: 'active',
    subscription_plan: 'professional',
    max_properties: 100,
    max_users: 50
  };

  // Use PostgreSQL via Supabase connection string
  // But we can't execute raw SQL via REST API easily
  // Let's try a different approach - use the Supabase client with service role

  // First, try to use the Supabase TypeScript Edge Function approach
  // or just prepare the SQL for manual execution

  console.log('SQL to execute manually in Supabase SQL Editor:\n');
  console.log('-- Create Default Tenant');
  console.log(`INSERT INTO tenants (id, name, slug, status, subscription_plan, max_properties, max_users)`);
  console.log(`VALUES ('${tenantData.id}', '${tenantData.name}', '${tenantData.slug}', '${tenantData.status}', '${tenantData.subscription_plan}', ${tenantData.max_properties}, ${tenantData.max_users})`);
  console.log(`ON CONFLICT (id) DO NOTHING;\n`);

  // Get auth users
  console.log('=== Getting Auth Users ===\n');
  const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    }
  });

  const authData = await authResponse.json();
  const authUsers = authData.users || [];

  console.log('-- Sync Users to public.users\n');
  console.log('DO $$\nDECLARE\n    user_record RECORD;\n    counter INTEGER := 0;\nBEGIN\n');

  authUsers.forEach((user, i) => {
    const role = user.email === 'mazmakerv2.sup@gmail.com' ? 'owner' : (i === 0 ? 'owner' : 'admin');
    console.log(`    -- ${user.email} -> ${role}`);
    console.log(`    INSERT INTO public.users (id, email, role, tenant_id, is_active, created_at)`);
    console.log(`    VALUES ('${user.id}', '${user.email}', '${role}', '00000000-0000-0000-0000-000000000001', true, '${user.created_at}')`);
    console.log(`    ON CONFLICT (id) DO UPDATE SET role = '${role}';\n`);
  });

  console.log('END $$;\n');

  // Update metadata
  console.log('-- Update auth.users metadata\n');
  authUsers.forEach((user, i) => {
    const role = user.email === 'mazmakerv2.sup@gmail.com' ? 'owner' : (i === 0 ? 'owner' : 'admin');
    console.log(`UPDATE auth.users`);
    console.log(`SET raw_user_meta_data = jsonb_set(`);
    console.log(`    COALESCE(raw_user_meta_data, '{}'::jsonb),`);
    console.log(`    '{role}',`);
    console.log(`    '${role}'::jsonb`);
    console.log(`)`);
    console.log(`WHERE email = '${user.email}';\n`);
  });

  console.log('-- Verify\n');
  console.log('SELECT u.email, u.role, u.tenant_id FROM public.users u;\n');

  console.log('\n=== SUMMARY ===');
  console.log('Copy the SQL above and paste it in Supabase SQL Editor:');
  console.log('https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql\n');
}

fixAndSync();
