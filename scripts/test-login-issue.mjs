import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf-8');

const env = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function testLogin() {
  const email = 'somrutai.kongsri@gmail.com';

  console.log(`=== Testing Login for: ${email} ===\n`);

  // Try to get user info from public.users
  const { data: users } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (users) {
    console.log('✅ Found in public.users:');
    console.log(`   ID: ${users.id}`);
    console.log(`   Email: ${users.email}`);
    console.log(`   Active: ${users.is_active}`);
    console.log(`   Role: ${users.role}`);
    console.log(`   Tenant: ${users.tenant_id}`);
  }

  // Check if user exists in auth.users by trying to sign up with same email
  // (this will tell us if email is already registered)
  console.log('\n=== Checking auth.users ===');
  console.log('Note: Cannot directly query auth.users from client');
  console.log('To check, go to Supabase Dashboard → Authentication → Users');
  console.log(`Look for user with email: ${email}`);
  console.log(`Or ID: ${users?.id}`);

  // Solution: Reset password for this user
  console.log('\n=== Solution ===');
  console.log('If user exists in auth.users but password is wrong:');
  console.log('Option 1: Reset password via Supabase Dashboard');
  console.log('Option 2: Delete and recreate user');
  console.log('\nTo delete and recreate:');
  console.log(`1. Delete from auth.users (email: ${email})`);
  console.log(`2. Update public.users: set is_active=false, add new invite_token`);
  console.log(`3. User can accept invite again`);
}

testLogin();
