import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

// Parse .env.local
const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuthUsers() {
  console.log('=== Checking Auth Users ===\n');

  // Get users from public.users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, full_name, is_active, role, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users:\n`);

  for (const user of users) {
    console.log(`📧 ${user.email}`);
    console.log(`   Name: ${user.full_name || 'No name'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active ? '✅ Yes' : '❌ No'}`);
    console.log(`   ID: ${user.id}`);

    // Try to sign in to verify if user exists in auth.users
    if (user.is_active) {
      console.log(`   Testing login...`);

      // We can't really test without password, but we can explain
      console.log(`   ℹ️  To verify auth.users exists, check Supabase Dashboard`);
    }
    console.log('');
  }

  console.log('\n=== How to Check Auth Users ===');
  console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Authentication → Users');
  console.log('4. Compare the list with above\n');

  console.log('=== Expected ===');
  console.log(`- Users with is_active=true should exist in auth.users`);
  console.log(`- Their IDs should match between public.users and auth.users`);
}

checkAuthUsers().then(() => {
  console.log('\nDone!');
});
