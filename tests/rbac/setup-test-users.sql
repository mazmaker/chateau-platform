-- RBAC Test Users Setup Script
-- This script creates test users for E2E testing
--
-- IMPORTANT: This is for TESTING/DEVELOPMENT only
-- DO NOT run this in production!

-- ============================================
-- 1. OWNER USER (Platform Owner)
-- ============================================
-- Email: mazmakerv2.sup@gmail.com
-- Role: owner
-- Access: All pages (owner, tenants, billing, etc.)

-- Create auth user for owner
-- (You'll need to set the password via Supabase dashboard or auth API)

-- Insert owner user record
INSERT INTO public.users (
  id,
  email,
  full_name,
  tenant_id,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001', -- Replace with actual auth UUID
  'mazmakerv2.sup@gmail.com',
  'Platform Owner',
  '00000000-0000-0000-0000-000000000001', -- Should match a tenant ID
  'owner',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'owner',
  is_active = true,
  updated_at = NOW();

-- ============================================
-- 2. ADMIN USER (Company Admin)
-- ============================================
-- Email: admin@chateau.com
-- Password: Chateau@2024
-- Role: admin
-- Access: Properties, Leads, Customization, Users, Projects

-- Create auth user for admin
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@chateau.com',
  crypt('Chateau@2024', gen_salt('bf')),
  NOW(),
  '{"full_name": "Admin User"}',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Insert admin user record (replace UUID with actual auth user ID)
INSERT INTO public.users (
  id,
  email,
  full_name,
  tenant_id,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'admin@chateau.com'),
  'admin@chateau.com',
  'Admin User',
  (SELECT id FROM public.tenants LIMIT 1), -- Use first tenant or create specific one
  'admin',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'admin',
  is_active = true,
  updated_at = NOW();

-- ============================================
-- 3. SALES USER (Sales Staff)
-- ============================================
-- Email: sales@chateau.com
-- Password: Chateau@2024
-- Role: sales
-- Access: Properties, Leads, Customization, Projects

-- Create auth user for sales
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'sales@chateau.com',
  crypt('Chateau@2024', gen_salt('bf')),
  NOW(),
  '{"full_name": "Sales User"}',
  NOW(),
  NOW()
)
ON CONFLICT (email) DO NOTHING;

-- Insert sales user record (replace UUID with actual auth user ID)
INSERT INTO public.users (
  id,
  email,
  full_name,
  tenant_id,
  role,
  is_active,
  created_at,
  updated_at
) VALUES (
  (SELECT id FROM auth.users WHERE email = 'sales@chateau.com'),
  'sales@chateau.com',
  'Sales User',
  (SELECT id FROM public.tenants LIMIT 1), -- Use same tenant as admin
  'sales',
  true,
  NOW(),
  NOW()
)
ON CONFLICT (email) DO UPDATE SET
  role = 'sales',
  is_active = true,
  updated_at = NOW();

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all test users
SELECT
  u.id,
  u.email,
  u.full_name,
  u.role,
  u.is_active,
  t.name as tenant_name
FROM public.users u
LEFT JOIN public.tenants t ON u.tenant_id = t.id
WHERE u.email IN (
  'mazmakerv2.sup@gmail.com',
  'admin@chateau.com',
  'sales@chateau.com'
)
ORDER BY u.role;

-- Expected output:
-- | email | role | is_active | tenant_name |
-- |-------|------|-----------|-------------|
-- | mazmakerv2.sup@gmail.com | owner | true | [Tenant Name] |
-- | admin@chateau.com | admin | true | [Tenant Name] |
-- | sales@chateau.com | sales | true | [Tenant Name] |

-- ============================================
-- CLEANUP (Use with caution!)
-- ============================================
-- Uncomment to delete test users
-- DELETE FROM public.users WHERE email IN (
--   'mazmakerv2.sup@gmail.com',
--   'admin@chateau.com',
--   'sales@chateau.com'
-- );
-- DELETE FROM auth.users WHERE email IN (
--   'admin@chateau.com',
--   'sales@chateau.com'
-- );

-- ============================================
-- MANUAL SETUP INSTRUCTIONS
-- ============================================

-- If you prefer to create users manually via Supabase Dashboard:

-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" for each:
--
--    ADMIN USER:
--    - Email: admin@chateau.com
--    - Password: Chateau@2024
--    - Auto Confirm User: YES
--
--    SALES USER:
--    - Email: sales@chateau.com
--    - Password: Chateau@2024
--    - Auto Confirm User: YES
--
-- 3. Go to SQL Editor and run:
--
--    -- Update admin role
--    UPDATE public.users
--    SET role = 'admin', is_active = true
--    WHERE email = 'admin@chateau.com';
--
--    -- Update sales role
--    UPDATE public.users
--    SET role = 'sales', is_active = true
--    WHERE email = 'sales@chateau.com';

-- ============================================
-- OWNER USER SPECIAL INSTRUCTIONS
-- ============================================

-- The owner user (mazmakerv2.sup@gmail.com) should already exist
-- if you've been using the platform. Just verify their role:

SELECT
  email,
  role,
  is_active
FROM public.users
WHERE email = 'mazmakerv2.sup@gmail.com';

-- If role is not 'owner', update it:
UPDATE public.users
SET role = 'owner', is_active = true
WHERE email = 'mazmakerv2.sup@gmail.com';

-- ============================================
-- NOTES
-- ============================================

-- 1. Password encryption: This script uses PostgreSQL's crypt() function
--    In production, Supabase Auth handles this automatically
--
-- 2. Tenant ID: Users need a valid tenant_id
--    Create one first if needed:
--
--    INSERT INTO public.tenants (id, name, slug, status, subscription_plan)
--    VALUES (
--      gen_random_uuid(),
--      'Test Company',
--      'test-company',
--      'active',
--      'professional'
--    );
--
-- 3. Owner user: The owner email should be your actual Supabase auth email
--    Update the script accordingly
--
-- 4. Security: Never commit real passwords to version control
--    Use environment variables for production credentials

-- End of setup script
