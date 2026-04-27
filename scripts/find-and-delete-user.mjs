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

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanupUser() {
  const email = 'somrutai.kongsri@gmail.com';

  console.log(`=== Cleaning up user: ${email} ===\n`);

  // 1. Find user in public.users
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('Error finding user:', error);
    return;
  }

  console.log(`Found ${users?.length || 0} user(s) in public.users:`);
  users?.forEach(user => {
    console.log(`  - ID: ${user.id}, Tenant: ${user.tenant_id}, Active: ${user.is_active}`);
  });

  // 2. Delete from auth.users
  console.log('\nDeleting from auth.users...');
  const { data: deleteResult, error: deleteError } = await supabase.rpc('delete_auth_user_by_email', {
    p_email: email
  });

  if (deleteError) {
    console.error('Error deleting from auth.users:', deleteError);
  } else {
    console.log('Deleted from auth.users:', deleteResult);
  }

  // 3. Delete from public.users
  console.log('\nDeleting from public.users...');
  const { error: publicDeleteError } = await supabase
    .from('users')
    .delete()
    .eq('email', email);

  if (publicDeleteError) {
    console.error('Error deleting from public.users:', publicDeleteError);
  } else {
    console.log('Deleted from public.users');
  }

  // 4. Verify
  console.log('\n=== Verification ===');
  const { data: remainingUsers } = await supabase
    .from('users')
    .select('email')
    .eq('email', email);

  console.log(`Remaining users with this email: ${remainingUsers?.length || 0}`);
}

cleanupUser().then(() => {
  console.log('\nDone! Now you can invite this user again.');
});
