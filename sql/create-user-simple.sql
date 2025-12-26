-- ✨ วิธีง่ายๆ สร้าง User ในระบบ Supabase
-- ใช้งานได้แน่นอน

-- 1. สร้าง tenant ก่อน
INSERT INTO public.tenants (name, slug, created_at)
VALUES
    ('MAZ Maker V2 Company', 'maz-maker-v2-company', NOW())
ON CONFLICT (slug) DO NOTHING;

-- 2. สร้าง user ใน auth.users
INSERT INTO auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_app_meta_data,
    phone
) VALUES (
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'mazmakerv2.sup@gmail.com',
    crypt('aa112233', gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "full_name": "MAZ Maker V2"}',
    '+66812345678'
)
ON CONFLICT (email) DO NOTHING;

-- 3. ดึง user_id ที่เพิ่งสร้าง
DO $$
DECLARE
    user_uuid UUID;
    tenant_uuid UUID;
BEGIN
    -- หา user_id จาก email
    SELECT id INTO user_uuid FROM auth.users WHERE email = 'mazmakerv2.sup@gmail.com';

    -- หา tenant_id
    SELECT id INTO tenant_uuid FROM public.tenants WHERE slug = 'maz-maker-v2-company';

    -- สร้าง user ใน public.users
    INSERT INTO public.users (id, email, full_name, created_at, updated_at)
    VALUES (user_uuid, 'mazmakerv2.sup@gmail.com', 'MAZ Maker V2', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;

    -- สร้าง user_tenants relationship
    INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active, created_at)
    VALUES (user_uuid, tenant_uuid, 'owner', true, NOW())
    ON CONFLICT (user_id, tenant_id) DO NOTHING;

    RAISE NOTICE '✅ สร้าง user สำเร็จ: %', user_uuid;
END $$;

-- 4. ตรวจสอบผลลัพธ์
SELECT
    '✅ สร้าง User สำเร็จ!' as status,
    u.email,
    u.full_name,
    t.name as tenant_name,
    ut.role,
    '🔑 Login: mazmakerv2.sup@gmail.com / aa112233' as login_info
FROM public.users u
JOIN public.user_tenants ut ON u.id = ut.user_id
JOIN public.tenants t ON ut.tenant_id = t.id
WHERE u.email = 'mazmakerv2.sup@gmail.com';