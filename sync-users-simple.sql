-- Simple SQL to sync users
-- Copy and paste this in Supabase SQL Editor: https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql

-- Step 1: Create Default Tenant (without max_users column)
INSERT INTO tenants (id, name, slug, status, subscription_plan, max_properties)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Default Company',
    'default-company',
    'active',
    'professional',
    100
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Insert users directly
INSERT INTO public.users (id, email, role, tenant_id, is_active, created_at)
VALUES ('cb6d6df0-3987-467d-b47f-7cbb90c3fab0', 'mazmakerv2.sup@gmail.com', 'owner', '00000000-0000-0000-0000-000000000001', true, '2025-12-23T04:33:04.263678Z')
ON CONFLICT (id) DO UPDATE SET role = 'owner', tenant_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.users (id, email, role, tenant_id, is_active, created_at)
VALUES ('529a671c-fa1e-47ee-83cd-042b84dc6e87', 'viewer@chateau.com', 'owner', '00000000-0000-0000-0000-000000000001', true, '2025-12-23T08:41:24.649813Z')
ON CONFLICT (id) DO UPDATE SET role = 'owner', tenant_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.users (id, email, role, tenant_id, is_active, created_at)
VALUES ('eef3579e-70eb-411d-b5ce-c2c254c3c936', 'sales@chateau.com', 'admin', '00000000-0000-0000-0000-000000000001', true, '2025-12-23T08:41:18.894478Z')
ON CONFLICT (id) DO UPDATE SET role = 'admin', tenant_id = '00000000-0000-0000-0000-000000000001';

INSERT INTO public.users (id, email, role, tenant_id, is_active, created_at)
VALUES ('1b8bc7d7-d642-411d-b7c2-7f599f4c3c8f', 'admin@chateau.com', 'admin', '00000000-0000-0000-0000-000000000001', true, '2025-12-23T08:41:12.706689Z')
ON CONFLICT (id) DO UPDATE SET role = 'admin', tenant_id = '00000000-0000-0000-0000-000000000001';

-- Step 3: Update auth.users metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', 'owner'::jsonb)
WHERE email = 'mazmakerv2.sup@gmail.com';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', 'owner'::jsonb)
WHERE email = 'viewer@chateau.com';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', 'admin'::jsonb)
WHERE email = 'sales@chateau.com';

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{role}', 'admin'::jsonb)
WHERE email = 'admin@chateau.com';

-- Step 4: Verify
SELECT 'TENANTS' as source, id, name, slug, status FROM tenants
UNION ALL
SELECT 'USERS' as source, id::text, email, role::text, tenant_id::text FROM public.users;
