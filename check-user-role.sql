-- ตรวจสอบ Role ของ user mazmakerv2.sup@gmail.com

-- 1. ดูข้อมูลใน public.users
SELECT
    id,
    email,
    role,
    tenant_id,
    is_active,
    created_at
FROM public.users
WHERE email = 'mazmakerv2.sup@gmail.com';

-- 2. ดูข้อมูลใน auth.users (metadata)
SELECT
    id,
    email,
    raw_user_meta_data->>'role' as role_in_metadata,
    raw_user_meta_data,
    created_at
FROM auth.users
WHERE email = 'mazmakerv2.sup@gmail.com';

-- 3. ถ้า role ไม่ถูกต้อง รันคำสั่งนี้เพื่ออัปเดต:
UPDATE public.users
SET role = 'owner'
WHERE email = 'mazmakerv2.sup@gmail.com';

-- 4. อัปเดต metadata ด้วย
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"owner"'::jsonb
)
WHERE email = 'mazmakerv2.sup@gmail.com';

-- 5. ตรวจสอบอีกครั้ง
SELECT
    u.id,
    u.email,
    u.role as public_role,
    a.raw_user_meta_data->>'role' as metadata_role
FROM public.users u
LEFT JOIN auth.users a ON u.id = a.id
WHERE u.email = 'mazmakerv2.sup@gmail.com';
