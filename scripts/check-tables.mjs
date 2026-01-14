import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  // Initialize role summary outside try block for scope
  let roleSummary = { owner: 0, admin: 0, sales: 0 };

  try {
    console.log('\n' + '='.repeat(100));
    console.log('SUPABASE TABLES OVERVIEW');
    console.log('='.repeat(100) + '\n');

    // 1. Check TENANTS table
    console.log('📦 TABLE: TENANTS');
    console.log('-'.repeat(100));
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('name');

    if (tenantsError) {
      console.log('❌ Error:', tenantsError.message);
    } else {
      console.log(`Total: ${tenants?.length || 0} tenant(s)\n`);
      tenants?.forEach(t => {
        console.log(`  • ${t.name} (ID: ${t.id.substring(0, 8)}...)`);
        console.log(`    Status: ${t.is_active ? '✓ Active' : '✗ Inactive'}`);
        console.log(`    Plan: ${t.plan || 'N/A'}`);
        console.log('');
      });
    }

    // 2. Check USERS table with role breakdown
    console.log('\n👥 TABLE: USERS (By Role)');
    console.log('-'.repeat(100));
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('*, tenants(name)');

    if (usersError) {
      console.log('❌ Error:', usersError.message);
    } else {
      console.log(`Total: ${users?.length || 0} user(s)\n`);

      // Group by role
      const byRole = { owner: [], admin: [], sales: [] };
      users?.forEach(u => {
        if (byRole[u.role]) {
          byRole[u.role].push(u);
        }
      });

      // Update role summary for final section
      users?.forEach(u => {
        if (roleSummary[u.role] !== undefined) {
          roleSummary[u.role]++;
        }
      });

      // Display Owners
      console.log('  🎭 OWNERS:');
      if (byRole.owner.length === 0) console.log('    None');
      byRole.owner.forEach(u => {
        console.log(`    • ${u.full_name || u.email} (${u.email})`);
        console.log(`      Tenant: ${u.tenants?.name || 'N/A'}`);
      });

      // Display Admins
      console.log('\n  🛡️  ADMINS:');
      if (byRole.admin.length === 0) console.log('    None');
      byRole.admin.forEach(u => {
        console.log(`    • ${u.full_name || u.email} (${u.email})`);
        console.log(`      Tenant: ${u.tenants?.name || 'N/A'} | Active: ${u.is_active ? '✓' : '✗'}`);
      });

      // Display Sales
      console.log('\n  💼 SALES:');
      if (byRole.sales.length === 0) console.log('    None');
      byRole.sales.forEach(u => {
        console.log(`    • ${u.full_name || u.email} (${u.email})`);
        console.log(`      Tenant: ${u.tenants?.name || 'N/A'} | Active: ${u.is_active ? '✓' : '✗'}`);
      });

      // Full user list
      console.log('\n  📋 FULL USER LIST:');
      console.log('  ' + 'EMAIL'.padEnd(35) + 'NAME'.padEnd(25) + 'ROLE'.padEnd(10) + 'TENANT');
      console.log('  ' + '-'.repeat(90));
      users?.forEach(u => {
        console.log(
          '  ' +
          (u.email || '').substring(0, 33).padEnd(35) +
          (u.full_name || '-').substring(0, 23).padEnd(25) +
          (u.role || '').toUpperCase().padEnd(10) +
          (u.tenants?.name || 'N/A')
        );
      });
    }

    // 3. Check PROJECTS table
    console.log('\n\n🏢 TABLE: PROJECTS');
    console.log('-'.repeat(100));
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('*, tenants(name)')
      .order('name');

    if (projectsError) {
      console.log('❌ Error:', projectsError.message);
    } else {
      console.log(`Total: ${projects?.length || 0} project(s)\n`);
      projects?.forEach(p => {
        console.log(`  • ${p.name} (${p.code || 'N/A'})`);
        console.log(`    Tenant: ${p.tenants?.name || 'N/A'} | Status: ${p.status || 'N/A'}`);
        console.log(`    Location: ${p.location || 'N/A'}`);
      });
    }

    // 4. Check UNITS table
    console.log('\n\n🏠 TABLE: UNITS');
    console.log('-'.repeat(100));
    const { data: units, error: unitsError } = await supabase
      .from('units')
      .select('*, projects(name, code)')
      .order('unit_number')
      .limit(20);

    if (unitsError) {
      console.log('❌ Error:', unitsError.message);
    } else {
      console.log(`Total: ${units?.length || 0} units (showing first 20)\n`);
      units?.forEach(u => {
        console.log(`  • ${u.unit_number} - ${u.projects?.name}`);
        console.log(`    Type: ${u.type || 'N/A'} | Status: ${u.status || 'N/A'} | Price: ฿${(u.price || 0).toLocaleString()}`);
      });
    }

    // 5. Check LEADS table
    console.log('\n\n🎯 TABLE: LEADS');
    console.log('-'.repeat(100));
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false })
      .limit(15);

    if (leadsError) {
      console.log('❌ Error:', leadsError.message);
    } else {
      console.log(`Total: ${leads?.length || 0} leads (showing latest 15)\n`);
      leads?.forEach(l => {
        console.log(`  • ${l.name || 'Anonymous'} (${l.email || l.phone || 'No contact'})`);
        console.log(`    Tenant: ${l.tenants?.name || 'N/A'} | Status: ${l.status || 'N/A'} | Source: ${l.source || 'N/A'}`);
      });
    }

    // 6. Check CAMPAIGNS table
    console.log('\n\n📣 TABLE: CAMPAIGNS');
    console.log('-'.repeat(100));
    const { data: campaigns, error: campaignsError } = await supabase
      .from('campaigns')
      .select('*, tenants(name)')
      .order('created_at', { ascending: false });

    if (campaignsError) {
      console.log('❌ Error:', campaignsError.message);
    } else {
      console.log(`Total: ${campaigns?.length || 0} campaign(s)\n`);
      campaigns?.forEach(c => {
        console.log(`  • ${c.name}`);
        console.log(`    Tenant: ${c.tenants?.name || 'N/A'} | Status: ${c.status || 'N/A'} | Budget: ฿${(c.budget || 0).toLocaleString()}`);
      });
    }

    // 7. Check ACTIVITY_LOGS table
    console.log('\n\n📊 TABLE: ACTIVITY_LOGS');
    console.log('-'.repeat(100));
    const { data: activities, error: activitiesError } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activitiesError) {
      console.log('❌ Error:', activitiesError.message);
    } else {
      console.log(`Total: ${activities?.length || 0} activities (showing latest 10)\n`);
      activities?.forEach(a => {
        console.log(`  • ${a.activity_type}: ${a.description}`);
        console.log(`    At: ${new Date(a.created_at).toLocaleString('th-TH')}`);
      });
    }

    // Summary
    console.log('\n\n' + '='.repeat(100));
    console.log('SUMMARY');
    console.log('='.repeat(100));
    console.log(`Tenants:     ${tenants?.length || 0}`);
    console.log(`Users:        ${users?.length || 0} (Owners: ${roleSummary?.owner || 0}, Admins: ${roleSummary?.admin || 0}, Sales: ${roleSummary?.sales || 0})`);
    console.log(`Projects:     ${projects?.length || 0}`);
    console.log(`Units:        ${units?.length || 0}`);
    console.log(`Leads:        ${leads?.length || 0}`);
    console.log(`Campaigns:    ${campaigns?.length || 0}`);
    console.log('='.repeat(100) + '\n');

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkAllTables().then(() => process.exit(0));
