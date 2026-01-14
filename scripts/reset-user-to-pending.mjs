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

async function resetUserToPending() {
  const email = 'somrutai.kongsri@gmail.com';

  // Generate new invite token
  const inviteToken = Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15) +
                      Math.random().toString(36).substring(2, 15);

  console.log(`=== Resetting user to pending: ${email} ===\n`);

  // Update user to pending with new invite token
  const { data, error } = await supabase
    .from('users')
    .update({
      is_active: false,
      invite_token: inviteToken,
      invite_accepted_at: null
    })
    .eq('email', email)
    .select();

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('✅ User reset to pending!');
  console.log(`   User ID: ${data[0].id}`);
  console.log(`   New Invite Token: ${inviteToken}`);

  const inviteLink = `http://localhost:5175/auth/accept-invite?token=${inviteToken}`;
  console.log(`\n📋 Invite Link:\n${inviteLink}\n`);
}

resetUserToPending();
