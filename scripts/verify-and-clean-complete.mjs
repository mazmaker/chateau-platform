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

async function verifyAndClean() {
  const email = 'somrutai.kongsri@gmail.com';

  console.log(`=== Complete Cleanup for: ${email} ===\n`);

  // Step 1: Check public.users
  const { data: publicUsers } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  console.log(`1. Public Users: Found ${publicUsers?.length || 0}`);
  if (publicUsers && publicUsers.length > 0) {
    publicUsers.forEach(u => {
      console.log(`   - ID: ${u.id}, Active: ${u.is_active}, Token: ${u.invite_token || 'None'}`);
    });
  }

  // Step 2: Delete from public.users completely
  console.log('\n2. Deleting from public.users...');
  const { error: delError } = await supabase
    .from('users')
    .delete()
    .eq('email', email);

  if (delError) {
    console.log('   ❌ Error:', delError.message);
  } else {
    console.log('   ✅ Deleted from public.users');
  }

  // Step 3: Delete from auth.users using RPC
  console.log('\n3. Deleting from auth.users...');
  const { data: delResult, error: rpcError } = await supabase.rpc('delete_auth_user_by_email', {
    p_email: email
  });

  if (rpcError) {
    console.log('   ❌ RPC Error:', rpcError.message);
  } else {
    console.log('   Result:', delResult);
    if (delResult?.deleted_count > 0) {
      console.log('   ✅ Deleted from auth.users');
    } else {
      console.log('   ⚠️ No user found in auth.users');
    }
  }

  // Step 4: Verify cleanup
  console.log('\n4. Verification...');
  const { data: remaining } = await supabase
    .from('users')
    .select('email')
    .eq('email', email);

  console.log(`   Remaining in public.users: ${remaining?.length || 0}`);

  console.log('\n✅ Cleanup complete! Now you can invite this user fresh.');
  console.log('\nTo invite, go to: http://localhost:5175/users');
}

verifyAndClean();
