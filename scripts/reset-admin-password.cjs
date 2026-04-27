require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const TARGET_EMAIL = 'sales@chateau.com';
const NEW_PASSWORD = 'Admin@2026!';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

(async () => {
  const { data: list, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) {
    console.error('LIST ERROR:', listErr.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email === TARGET_EMAIL);
  if (!user) {
    console.error('USER NOT FOUND in auth.users:', TARGET_EMAIL);
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
    password: NEW_PASSWORD,
  });

  if (error) {
    console.error('UPDATE ERROR:', error.message);
    process.exit(1);
  }

  console.log('SUCCESS — Password reset:');
  console.log('  Email:   ', user.email);
  console.log('  AuthID:  ', user.id);
  console.log('  Password:', NEW_PASSWORD);
})();
