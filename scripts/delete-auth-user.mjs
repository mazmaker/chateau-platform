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

// Get email from command line
const emailToDelete = process.argv[2];

if (!emailToDelete) {
  console.log('Usage: node delete-auth-user.mjs <email>');
  console.log('\nExample: node delete-auth-user.mjs somrutai.kongsri@gmail.com');
  process.exit(1);
}

async function deleteUser() {
  console.log(`Deleting auth user: ${emailToDelete}\n`);

  const { data, error } = await supabase.rpc('delete_auth_user_by_email', {
    p_email: emailToDelete
  });

  if (error) {
    console.error('Error deleting user:', error);
    process.exit(1);
  }

  const result = data;
  console.log('Result:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log(`\n✓ Successfully deleted ${result.deleted_count} user(s)`);
  }
}

deleteUser().then(() => {
  console.log('\nDone!');
});
