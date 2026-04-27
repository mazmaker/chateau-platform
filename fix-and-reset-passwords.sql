-- Fix Admin and Sales User Passwords
-- This script updates passwords for admin@chateau.com and sales@chateau.com

-- First, let's check if users exist in auth.users
-- Note: We can't directly modify auth.users through SQL, but we can verify public.users

SELECT 'Current users in public.users:' as info;
SELECT id, email, role, tenant_id, is_active, created_at
FROM users
WHERE email IN ('admin@chateau.com', 'sales@chateau.com')
ORDER BY email;

-- To reset passwords, we need to use Supabase CLI or Dashboard
-- Run these commands instead:

-- For local development, use:
-- supabase db reset --db-url "postgresql://postgres:postgres@localhost:54322/postgres"

-- Or create new test users with admin API
