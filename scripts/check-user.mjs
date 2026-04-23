import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

// Get email from command line argument
const searchEmail = process.argv[2] || '';

async function checkUsers() {
  try {
    // Use RPC function to bypass RLS
    const { data: users, error } = await supabase.rpc('get_all_users_for_admin', {
      p_search_email: searchEmail || null
    });

    if (error) {
      console.error('RPC Error:', error.message);
      console.log('\nTrying direct query...');
      // Fallback to direct query
      const { data: directUsers, error: directError } = await supabase
        .from('users')
        .select('*')
        .ilike('email', `%${searchEmail}%`)
        .limit(20);

      if (directError) {
        console.error('Direct query error:', directError);
        process.exit(1);
      }

      displayUsers(directUsers, searchEmail);
      return;
    }

    displayUsers(users, searchEmail);

  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

function displayUsers(users, searchEmail) {
  console.log(`\n${searchEmail ? `Users matching "${searchEmail}":` : 'All users:'}\n`);
  console.log('='.repeat(100));

  if (!users || users.length === 0) {
    console.log('No users found.\n');
  } else {
    console.log(`Total: ${users.length} user(s)\n`);
    console.log(
      'ID'.padEnd(38) +
      'EMAIL'.padEnd(35) +
      'NAME'.padEnd(25) +
      'ROLE'.padEnd(10) +
      'ACTIVE'
    );
    console.log('-'.repeat(100));

    users.forEach(user => {
      console.log(
        (user.id || '').substring(0, 36).padEnd(38) +
        (user.email || '').substring(0, 33).padEnd(35) +
        (user.full_name || '-').substring(0, 23).padEnd(25) +
        (user.role || '').toUpperCase().padEnd(10) +
        (user.is_active ? '✓' : '✗')
      );
    });
    console.log('\n');

    // Show details for each user
    users.forEach((user, index) => {
      console.log(`[${index + 1}] Full Details:`);
      console.log(`  ID:        ${user.id}`);
      console.log(`  Email:     ${user.email}`);
      console.log(`  Name:      ${user.full_name || '-'}`);
      console.log(`  Role:      ${user.role?.toUpperCase()}`);
      console.log(`  Tenant:    ${user.tenant_id}`);
      console.log(`  Active:    ${user.is_active ? 'Yes' : 'No'}`);
      console.log(`  Created:   ${user.created_at}`);
      console.log('');
    });
  }
}

// Run the check
checkUsers().then(() => process.exit(0));
