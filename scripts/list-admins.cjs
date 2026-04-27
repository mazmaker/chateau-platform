require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role, is_active, full_name, created_at')
    .in('role', ['owner', 'admin'])
    .order('role', { ascending: true })
    .order('email', { ascending: true });

  if (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
})();
