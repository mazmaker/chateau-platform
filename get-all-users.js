// Script to get all users from database using direct SQL
// Run with: node get-all-users.js

const sql = `
-- ============================================
-- GET ALL USERS WITH PASSWORDS (hashed)
-- ============================================

SELECT
    id,
    email,
    role,
    tenant_id,
    created_at,
    updated_at,
    'Password is in auth.users table (encrypted)' as password_info
FROM public.users
ORDER BY role, email;

-- ============================================
-- TO SEE AUTH USERS WITH PASSWORD HASH
-- ============================================
-- Run this in Supabase Dashboard SQL Editor:

/*
SELECT
    id,
    email,
    encrypted_password,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;
*/

-- ============================================
-- TO RESET PASSWORD FOR SPECIFIC USER
-- ============================================
-- Run this in Supabase Dashboard SQL Editor:

/*
-- 1. First get the user ID:
SELECT id, email FROM auth.users WHERE email = 'mazmakerv2.sup@gmail.com';

-- 2. Then update password (replace USER_ID and NEW_PASSWORD):
-- Note: You cannot directly update encrypted_password
-- Use the Supabase Auth API or Dashboard instead
*/

console.log(`
========================================
INSTRUCTIONS TO VIEW ALL USERS
========================================

1. Go to Supabase Dashboard:
   https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx

2. Go to SQL Editor (左侧菜单)

3. Run this query:

SELECT
    id,
    email,
    role,
    tenant_id,
    created_at
FROM public.users
ORDER BY role, email;

4. To see auth users with password hashes:

SELECT
    id,
    email,
    raw_user_meta_data,
    created_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;

========================================
INSTRUCTIONS TO RESET PASSWORD
========================================

Method 1 - Via Dashboard:
1. Go to Authentication -> Users
2. Find the user
3. Click "..." -> "Reset Password"

Method 2 - Via SQL (send reset email):
1. In SQL Editor, run:
SELECT auth.send_magic_link('mazmakerv2.sup@gmail.com');

========================================
`);
`;

console.log(sql);
