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

async function debugSignup() {
  const email = 'somrutai.kongsri@gmail.com';

  console.log(`=== Debugging Signup for: ${email} ===\n`);

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

  // Step 2: Try to call the RPC function to see what it returns
  if (publicUsers && publicUsers.length > 0 && publicUsers[0].invite_token) {
    console.log(`\n2. Testing accept_invite_and_create_user RPC...`);
    const { data: rpcData, error: rpcError } = await supabase.rpc('accept_invite_and_create_user', {
      p_invite_token: publicUsers[0].invite_token,
      p_password: 'test1234'
    });

    console.log(`   RPC Result:`, JSON.stringify(rpcData, null, 2));
    if (rpcError) {
      console.log(`   RPC Error: ${rpcError.message}`);
    }
  }

  // Step 3: Try to signup directly (this will tell us if user exists in auth.users)
  console.log(`\n3. Testing supabase.auth.signUp()...`);
  const testPassword = 'testPassword123!';
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: email,
    password: testPassword,
    options: {
      emailRedirectTo: 'http://localhost:5175/'
    }
  });

  console.log(`   Sign Up Error: ${signUpError?.message || 'None'}`);
  console.log(`   User Created: ${signUpData.user ? 'Yes' : 'No'}`);
  if (signUpData.user) {
    console.log(`   User ID: ${signUpData.user.id}`);
    console.log(`   Email: ${signUpData.user.email}`);
    console.log(`   Confirmed At: ${signUpData.user.confirmed_at || 'Not confirmed'}`);
  }

  // Step 4: Check if we can sign in
  console.log(`\n4. Testing supabase.auth.signInWithPassword()...`);
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: email,
    password: testPassword
  });

  console.log(`   Sign In Error: ${signInError?.message || 'None'}`);
  if (signInData.user) {
    console.log(`   Sign In Successful! User ID: ${signInData.user.id}`);
  }

  // Solution: If user exists but can't sign in, we need to reset
  console.log(`\n=== ANALYSIS ===`);
  if (signUpError?.message?.includes('already')) {
    console.log('User already exists in auth.users');
    console.log('Options:');
    console.log('1. Use the password reset flow');
    console.log('2. Delete from auth.users and recreate');
    console.log('3. Check if email confirmation is blocking');
  } else if (signUpError?.message?.includes('Email')) {
    console.log('Email sending failed (expected - SMTP not configured)');
    if (signUpData.user) {
      console.log('BUT user was created successfully!');
      console.log('The issue is just email confirmation.');
    }
  } else if (!signUpError && !signUpData.user) {
    console.log('No error but no user created - likely email confirmation required');
    console.log('Check Supabase Dashboard for the user');
  } else {
    console.log('Unknown state - check Supabase Dashboard');
  }
}

debugSignup().catch(console.error);
