-- ✨ แก้ไขปัญหา Database Constraints และสร้าง User ถาวร
-- แก้ไขปัญหา foreign key constraints และ authentication system

-- Step 1: ตรวจสอบว่า tenants มีข้อมูลหรือไม่
INSERT INTO public.tenants (name, slug, created_at)
VALUES
    ('MAZ Maker V2 Company', 'maz-maker-v2-company', NOW())
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    created_at = NOW();

-- Step 2: สร้าง trigger สำหรับจัดการ user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- ตรวจสอบว่ามี user ใน public.users หรือไม่
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
        INSERT INTO public.users (id, email, full_name, created_at, updated_at)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_app_meta_data->>'full_name', NEW.email),
            NOW(),
            NOW()
        );
    END IF;

    -- สร้าง tenant relationship ถ้ายังไม่มี
    IF NOT EXISTS (
        SELECT 1 FROM public.user_tenants
        WHERE user_id = NEW.id
        AND tenant_id = (SELECT id FROM public.tenants WHERE slug = 'maz-maker-v2-company')
    ) THEN
        INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active, created_at)
        SELECT
            NEW.id,
            t.id,
            'owner',
            true,
            NOW()
        FROM public.tenants t
        WHERE t.slug = 'maz-maker-v2-company';
    END IF;

    RETURN NEW;
END;
$$;

-- Step 3: สร้าง trigger สำหรับ auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Step 4: สร้าง User ผ่าน System ที่ถูกต้อง (ถ้ายังไม่มี)
SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM auth.users WHERE email = 'mazmakerv2.sup@gmail.com')
        THEN 'User already exists in auth.users'
        ELSE 'Creating new user in auth.users...'
    END as status;

-- Step 5: ตรวจสอบว่ามี user อยู่แล้วหรือไม่
DO $$
DECLARE
    user_exists BOOLEAN;
    auth_user_exists BOOLEAN;
BEGIN
    -- ตรวจสองในระบบ auth
    SELECT EXISTS (SELECT 1 FROM auth.users WHERE email = 'mazmakerv2.sup@gmail.com') INTO auth_user_exists;

    IF NOT auth_user_exists THEN
        -- สร้างในระบบ auth.users ถ้ายังไม่มี
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
        );

        RAISE NOTICE '✅ สร้าง user ใน auth.users สำเร็จ';
    ELSE
        RAISE NOTICE 'ℹ️ User มีอยู่แล้วใน auth.users';
    END IF;

    -- ตรวจสอบว่า trigger ทำงานแล้วมี user ใน public.users หรือไม่
    SELECT EXISTS (SELECT 1 FROM public.users WHERE email = 'mazmakerv2.sup@gmail.com') INTO user_exists;

    IF user_exists THEN
        RAISE NOTICE '✅ User มีอยู่ใน public.users พร้อม tenant relationships';
    ELSE
        RAISE NOTICE '⚠️ ไม่พบ user ใน public.users - อาจต้องตรวจสอบ trigger';
    END IF;
END $$;

-- Step 6: สร้าง sample data ถ้าจำเป็น
-- สร้าง project ถ้ายังไม่มี
INSERT INTO public.projects (tenant_id, name, description, status, total_units, created_at)
SELECT
    t.id,
    'CHATEAU Residence',
    'โครงการคอนโดมิเนียมหรูแบบใหม่',
    'planning',
    120,
    NOW()
FROM public.tenants t
WHERE t.slug = 'maz-maker-v2-company'
AND NOT EXISTS (
    SELECT 1 FROM public.projects
    WHERE name = 'CHATEAU Residence'
    AND tenant_id = t.id
);

-- Step 7: สร้าง units สำหรับทดสอบ
INSERT INTO public.units (tenant_id, project_id, unit_number, unit_type, bedrooms, bathrooms, area_sqm, price, status, created_at)
SELECT
    t.id,
    p.id,
    'A-' || generate_series,
    CASE WHEN generate_series <= 5 THEN 'condo' ELSE 'penthouse' END,
    CASE WHEN generate_series <= 5 THEN 2 ELSE 4 END,
    CASE WHEN generate_series <= 5 THEN 2 ELSE 3 END,
    80 + (generate_series * 20),
    5000000 + (generate_series * 500000),
    'available',
    NOW()
FROM public.tenants t
CROSS JOIN (SELECT id FROM public.projects WHERE name = 'CHATEAU Residence' LIMIT 1) p
CROSS JOIN generate_series(1, 10)
WHERE t.slug = 'maz-maker-v2-company'
AND NOT EXISTS (
    SELECT 1 FROM public.units
    WHERE project_id = p.id
    AND unit_number LIKE 'A-%'
);

-- Step 8: ตรวจสอบผลลัพธ์สุดท้าย
SELECT
    '🔍 FINAL STATUS CHECK' as section,
    u.email,
    u.full_name,
    t.name as tenant_name,
    ut.role as user_role,
    CASE WHEN u.id IS NOT NULL THEN '✅ User OK' ELSE '❌ User Missing' END as user_status,
    CASE WHEN ut.id IS NOT NULL THEN '✅ Tenant OK' ELSE '❌ Tenant Missing' END as tenant_status,
    COUNT(p.id) as projects_count,
    COUNT(un.id) as units_count
FROM public.tenants t
LEFT JOIN public.user_tenants ut ON t.id = ut.tenant_id AND ut.role = 'owner'
LEFT JOIN public.users u ON ut.user_id = u.id AND u.email = 'mazmakerv2.sup@gmail.com'
LEFT JOIN public.projects p ON t.id = p.tenant_id
LEFT JOIN public.units un ON p.id = un.project_id
WHERE t.slug = 'maz-maker-v2-company'
GROUP BY t.id, u.id, u.email, u.full_name, t.name, ut.id, ut.role;

-- Instructions
SELECT
    '📋 LOGIN INSTRUCTIONS' as section,
    'Email: mazmakerv2.sup@gmail.com' as login_email,
    'Password: aa112233' as login_password,
    'Role: Owner' as login_role,
    'ควรจะ login ผ่านระบบได้' as notes;