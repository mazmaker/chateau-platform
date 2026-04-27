#!/usr/bin/env node
/**
 * Fix Users Without Auth
 *
 * This script fixes users that exist in public.users but not in auth.users
 * It calls the fix-users Edge Function which:
 * 1. Creates auth.users for missing users
 * 2. Links existing auth users if found
 * 3. Returns temp passwords for newly created users
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

async function fixUsers() {
  console.log('🔧 Fixing users without auth_user_id...\n');

  if (!anonKey) {
    console.error('❌ VITE_SUPABASE_ANON_KEY not found in environment');
    console.log('Please run with: VITE_SUPABASE_ANON_KEY=your-key node scripts/fix-users.cjs');
    process.exit(1);
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/fix-users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`,
      },
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      console.error('❌ Error:', result.error || 'Unknown error');
      process.exit(1);
    }

    console.log(`✅ Processed ${result.results.length} users:\n`);

    result.results.forEach((r, i) => {
      console.log(`${i + 1}. ${r.email}`);
      console.log(`   Status: ${r.status}`);

      if (r.status === 'created' && r.tempPassword) {
        console.log(`   ⚠️  TEMP PASSWORD: ${r.tempPassword}`);
        console.log(`   User should change password after first login!`);
      } else if (r.status === 'linked_to_existing') {
        console.log(`   ✓ Linked to existing auth user`);
      } else if (r.error) {
        console.log(`   ❌ Error: ${r.error}`);
      }
      console.log('');
    });

    console.log('✅ Fix complete!');
    console.log('\nNext steps:');
    console.log('1. Users can now login with their email');
    console.log('2. They should reset their password after first login');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run
fixUsers();
