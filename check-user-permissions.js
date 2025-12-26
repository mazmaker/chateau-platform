import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Try with service role key if available, otherwise use anon key
const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkUserPermissions() {
  const targetEmail = 'mazmakerv2.sup@gmail.com';

  try {
    console.log(`Checking permissions for user: ${targetEmail}\n`);

    // 1. Get user from auth.users (direct query)
    console.log('1. Checking auth.users table...');
    const { data: authUser, error: authError } = await supabase.rpc('execute_sql', {
      sql: `SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE email = '${targetEmail}'`
    });

    if (authError) {
      console.log('Cannot directly access auth.users (expected for security)');
    } else {
      console.log('Auth user found:', authUser);
    }

    // 2. Check if user exists in our users table
    console.log('\n2. Checking public.users table...');
    const { data: publicUser, error: publicUserError } = await supabase
      .from('users')
      .select('*')
      .eq('email', targetEmail)
      .single();

    if (publicUserError && publicUserError.code !== 'PGRST116') {
      console.error('Error checking public.users:', publicUserError);
    } else if (publicUser) {
      console.log('✓ User found in public.users:', {
        id: publicUser.id,
        email: publicUser.email,
        full_name: publicUser.full_name,
        is_active: publicUser.is_active,
        email_verified: publicUser.email_verified
      });
    } else {
      console.log('✗ User not found in public.users table');
    }

    // 3. Check user_tenants for Owner role
    console.log('\n3. Checking user_tenants for Owner role...');
    if (publicUser) {
      const { data: userTenants, error: tenantError } = await supabase
        .from('user_tenants')
        .select(`
          *,
          tenants:tenant_id (
            id,
            name,
            slug,
            status
          )
        `)
        .eq('user_id', publicUser.id)
        .eq('role', 'owner');

      if (tenantError) {
        console.error('Error checking user_tenants:', tenantError);
      } else {
        if (userTenants.length > 0) {
          console.log('✓ FOUND OWNER PERMISSIONS:');
          userTenants.forEach(ut => {
            console.log(`  - Tenant: ${ut.tenants.name} (${ut.tenants.slug})`);
            console.log(`    Role: ${ut.role}`);
            console.log(`    Active: ${ut.is_active}`);
            console.log(`    Joined: ${ut.joined_at}`);
          });
        } else {
          console.log('✗ No Owner role found for this user');

          // Check for other roles
          const { data: allRoles, error: allRolesError } = await supabase
            .from('user_tenants')
            .select(`
              *,
              tenants:tenant_id (
                name,
                slug
              )
            `)
            .eq('user_id', publicUser.id);

          if (!allRolesError && allRoles.length > 0) {
            console.log('\nOther roles found:');
            allRoles.forEach(ar => {
              console.log(`  - ${ar.tenants.name}: ${ar.role} (active: ${ar.is_active})`);
            });
          }
        }
      }
    }

    // 4. Try to get all tenants to see available tenants
    console.log('\n4. Checking all available tenants...');
    const { data: allTenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name, slug, status')
      .limit(10);

    if (tenantsError) {
      console.error('Error listing tenants:', tenantsError);
    } else {
      console.log(`Found ${allTenants.length} tenants in the system:`);
      allTenants.forEach(t => {
        console.log(`  - ${t.name} (${t.slug}) - ${t.status}`);
      });
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

checkUserPermissions();