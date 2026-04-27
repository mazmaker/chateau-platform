import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

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

async function cleanupUsers() {
  console.log('=== Checking for users to cleanup ===\n');

  // Get users from public.users that are pending (is_active = false)
  const { data: pendingUsers, error: pendingError } = await supabase
    .from('users')
    .select('id, email, full_name, is_active, invite_token')
    .eq('is_active', false);

  if (pendingError) {
    console.error('Error fetching pending users:', pendingError);
    return;
  }

  console.log(`Found ${pendingUsers?.length || 0} pending users in public.users:`);
  pendingUsers?.forEach(u => {
    console.log(`  - ${u.email} (${u.full_name || 'No name'})`);
  });

  // Note: We can't directly query auth.users from client
  // But we can try to check by attempting operations

  console.log('\n=== Action Required ===');
  console.log('To cleanup orphaned auth.users records, you need to:');
  console.log('1. Go to Supabase Dashboard → Authentication → Users');
  console.log('2. Find users with the same email');
  console.log('3. Delete them manually');
  console.log('\nOr run this SQL in Supabase SQL Editor:');
  console.log(`
-- Delete from auth.users where email exists but not in public.users
DELETE FROM auth.users
WHERE email IN (
  SELECT email FROM (VALUES ${pendingUsers?.map(u => `('${u.email}')`).join(', ') || ('')}) AS tmp(email)
);
  `);
}

cleanupUsers().then(() => {
  console.log('\nDone!');
});
