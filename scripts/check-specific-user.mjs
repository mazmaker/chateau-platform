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

async function checkUser() {
  const email = 'somrutai.kongsri@gmail.com';

  console.log(`=== Checking User: ${email} ===\n`);

  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Found in public.users:');
  users.forEach(user => {
    console.log(`  ID: ${user.id}`);
    console.log(`  Email: ${user.email}`);
    console.log(`  Name: ${user.full_name}`);
    console.log(`  Active: ${user.is_active}`);
    console.log(`  Invite Token: ${user.invite_token || 'None'}`);
    console.log(`  Invited At: ${user.invited_at}`);
    console.log(`  Accepted At: ${user.invite_accepted_at || 'Not yet'}`);
  });

  console.log('\n=== Issue ===');
  console.log('User is already active (is_active=true), so the invite is invalid.');
  console.log('You need to:');
  console.log('1. Either reset this user to pending, OR');
  console.log('2. Create a new invite with a different email, OR');
  console.log('3. Delete this user and invite again');
}

checkUser();
