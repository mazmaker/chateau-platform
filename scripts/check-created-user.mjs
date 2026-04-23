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

async function checkUser() {
  console.log('=== Checking User Creation ===\n');

  // Get all users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log(`Found ${users.length} users in public.users:\n`);

  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email}`);
    console.log(`   ID: ${user.id}`);
    console.log(`   Name: ${user.full_name || 'No name'}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Active: ${user.is_active ? 'Yes' : 'No'}`);
    console.log(`   Tenant: ${user.tenant_id}`);
    console.log(`   Invite Token: ${user.invite_token || 'None'}`);
    console.log(`   Created: ${user.created_at}`);
    console.log('');
  });

  // Check auth.users via RPC (we can't query directly)
  console.log('\n=== Note ===');
  console.log('Cannot directly query auth.users from client.');
  console.log('To check auth.users, go to Supabase Dashboard → Authentication → Users');
}

checkUser().then(() => {
  console.log('\nDone!');
});
