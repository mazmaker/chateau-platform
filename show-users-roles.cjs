#!/usr/bin/env node
/**
 * Show All Users with Roles
 * Displays user permissions table
 */

const { createClient } = require('@supabase/supabase-js');

const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(
  'https://pqnjvcbmnatrtvpqnrdx.supabase.co',
  SERVICE_ROLE,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function showUsers() {
  console.log('\n' + '='.repeat(100));
  console.log('                    CHATEAU PLATFORM - USER PERMISSIONS TABLE');
  console.log('='.repeat(100));
  console.log('');

  // Fetch all users with tenant info
  const { data: users, error } = await supabase
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      is_active,
      created_at,
      last_sign_in_at,
      tenants (
        id,
        name,
        slug,
        status,
        subscription_plan
      )
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.log('Error fetching users:', error.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users found.');
    return;
  }

  // Display table
  const roleIcons = {
    'owner': '👑',
    'admin': '🔧',
    'sales': '💼'
  };

  const statusIcons = {
    'true': '✅',
    'false': '❌'
  };

  // Table Header
  console.log(
    '  #  ' +
    'EMAIL'.padEnd(35) +
    'ROLE'.padEnd(12) +
    'STATUS'.padEnd(8) +
    'TENANT'.padEnd(25) +
    'PLAN'.padEnd(12) +
    'LAST SIGN-IN'
  );
  console.log('-'.repeat(100));

  // Table Rows
  users.forEach((user, index) => {
    const num = (index + 1).toString().padStart(2, '0');
    const email = (user.email || '').padEnd(35);
    const roleIcon = roleIcons[user.role] || '❓';
    const role = `${roleIcon} ${(user.role || '').toUpperCase()}`.padEnd(12);
    const status = `${statusIcons[user.is_active?.toString()] || '?'} ${(user.is_active ? 'Active' : 'Inactive')}`.padEnd(8);
    const tenantName = (user.tenants?.name || 'No Tenant').padEnd(25);
    const plan = (user.tenants?.subscription_plan || '').toUpperCase().padEnd(12);
    const lastSignIn = user.last_sign_in_at
      ? new Date(user.last_sign_in_at).toLocaleDateString('th-TH', {
          day: '2-digit',
          month: 'short',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Never';

    console.log(`${num}.  ${email}${role}${status}${tenantName}${plan}${lastSignIn}`);
  });

  console.log('-'.repeat(100));

  // Summary
  const summary = {
    total: users.length,
    owner: users.filter(u => u.role === 'owner').length,
    admin: users.filter(u => u.role === 'admin').length,
    sales: users.filter(u => u.role === 'sales').length,
    active: users.filter(u => u.is_active).length
  };

  console.log('');
  console.log('SUMMARY:');
  console.log(`  Total Users:     ${summary.total}`);
  console.log(`  👑 Owners:        ${summary.owner}`);
  console.log(`  🔧 Admins:        ${summary.admin}`);
  console.log(`  💼 Sales:         ${summary.sales}`);
  console.log(`  ✅ Active:        ${summary.active}`);
  console.log(`  ❌ Inactive:      ${summary.total - summary.active}`);
  console.log('');

  // Legend
  console.log('LEGEND:');
  console.log('  👑 OWNER  - Full access, billing, tenant management');
  console.log('  🔧 ADMIN  - Manage properties, customers, bookings');
  console.log('  💼 SALES  - View properties, create bookings');
  console.log('  ✅ Active - User can login');
  console.log('  ❌ Inactive - User suspended');
  console.log('');

  // Tenant breakdown
  console.log('TENANT BREAKDOWN:');
  const tenants = {};
  users.forEach(user => {
    const tenantId = user.tenant_id;
    if (!tenants[tenantId]) {
      tenants[tenantId] = {
        name: user.tenants?.name || 'Unknown',
        slug: user.tenants?.slug || 'unknown',
        users: []
      };
    }
    tenants[tenantId].users.push(user);
  });

  Object.values(tenants).forEach(tenant => {
    console.log(`\n  🏢 ${tenant.name} (${tenant.slug})`);
    console.log(`     Owner: ${tenant.users.find(u => u.role === 'owner')?.email || 'None'}`);
    console.log(`     Admins: ${tenant.users.filter(u => u.role === 'admin').map(u => u.email).join(', ') || 'None'}`);
    console.log(`     Sales: ${tenant.users.filter(u => u.role === 'sales').map(u => u.email).join(', ') || 'None'}`);
  });

  console.log('\n' + '='.repeat(100));
  console.log(`Dashboard: https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/auth/users`);
  console.log('='.repeat(100) + '\n');
}

showUsers();
