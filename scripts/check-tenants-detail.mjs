import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenants() {
  console.log('\n' + '='.repeat(100));
  console.log('TENANTS DETAILED CHECK');
  console.log('='.repeat(100) + '\n');

  // 1. Check ALL tenants (without filters)
  console.log('📦 ALL TENANTS IN DATABASE:');
  console.log('-'.repeat(100));
  const { data: allTenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('*');

  if (tenantsError) {
    console.log('❌ Error fetching tenants:', tenantsError.message);
    console.log('   Hint: This might be an RLS policy issue\n');
  } else {
    if (!allTenants || allTenants.length === 0) {
      console.log('⚠️  No tenants found (or RLS blocking access)\n');
    } else {
      console.log(`Found: ${allTenants.length} tenant(s)\n`);
      allTenants.forEach(t => {
        console.log(`  • ${t.name}`);
        console.log(`    ID: ${t.id}`);
        console.log(`    Status: ${t.is_active ? 'Active' : 'Inactive'}`);
        console.log(`    Plan: ${t.plan || 'N/A'}`);
        console.log(`    Created: ${t.created_at}`);
        console.log('');
      });
    }
  }

  // 2. Check tenant IDs from users
  const { data: users } = await supabase
    .from('users')
    .select('id, email, full_name, tenant_id, role');

  const tenantIds = [...new Set(users?.map(u => u.tenant_id).filter(Boolean))];

  console.log('🔍 TENANT IDS FROM USERS:');
  console.log('-'.repeat(100));
  console.log(`Found ${tenantIds.length} unique tenant IDs:\n`);

  for (const id of tenantIds) {
    // Find users with this tenant
    const usersWithTenant = users?.filter(u => u.tenant_id === id);

    console.log(`Tenant ID: ${id}`);
    console.log(`  Users (${usersWithTenant?.length || 0}):`);
    usersWithTenant?.forEach(u => {
      console.log(`    • ${u.full_name || u.email} (${u.role?.toUpperCase()})`);
    });

    // Try to get tenant details
    const { data: tenant } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (tenant) {
      console.log(`  ✓ Tenant Name: ${tenant.name}`);
    } else {
      console.log(`  ✗ Tenant NOT FOUND in tenants table!`);
    }
    console.log('');
  }

  // 3. Users grouped by tenant
  console.log('👥 USERS GROUPED BY TENANT:');
  console.log('-'.repeat(100));

  const usersByTenant = {};
  users?.forEach(u => {
    const tid = u.tenant_id || 'no-tenant';
    if (!usersByTenant[tid]) {
      usersByTenant[tid] = { owner: [], admin: [], sales: [] };
    }
    if (usersByTenant[tid][u.role]) {
      usersByTenant[tid][u.role].push(u);
    }
  });

  Object.entries(usersByTenant).forEach(([tenantId, roles]) => {
    console.log(`\nTenant: ${tenantId}`);
    console.log(`  Owners: ${roles.owner.length}`);
    roles.owner.forEach(u => console.log(`    • ${u.email}`));
    console.log(`  Admins: ${roles.admin.length}`);
    roles.admin.forEach(u => console.log(`    • ${u.email}`));
    console.log(`  Sales: ${roles.sales.length}`);
    roles.sales.forEach(u => console.log(`    • ${u.email}`));
  });

  // 4. Summary
  console.log('\n\n' + '='.repeat(100));
  console.log('SUMMARY');
  console.log('='.repeat(100));
  console.log(`Tenants in DB:    ${allTenants?.length || 0}`);
  console.log(`Unique Tenant IDs from users: ${tenantIds.length}`);
  console.log(`Total Users:      ${users?.length || 0}`);
  console.log('='.repeat(100) + '\n');
}

checkTenants().then(() => process.exit(0));
