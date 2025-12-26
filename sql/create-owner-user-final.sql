-- ✨ FINAL VERSION - Create COMPLETE OWNER user for mazmakerv2.sup@gmail.com
-- Role: OWNER
-- Password: aa112233

-- Step 1: Create tenant for the user
INSERT INTO public.tenants (name, slug, created_at)
VALUES
    ('MAZ Maker V2 Company', 'maz-maker-v2-company', NOW()),
    ('MAZ Demo', 'maz-demo', NOW())
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Insert into public.users table first
INSERT INTO public.users (id, email, full_name, phone, created_at, updated_at)
SELECT
    gen_random_uuid() as id,
    'mazmakerv2.sup@gmail.com' as email,
    'MAZ Maker V2' as full_name,
    '+66812345678' as phone,
    NOW() as created_at,
    NOW() as updated_at
WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'mazmakerv2.sup@gmail.com'
);

-- Step 3: Create user-tenant relationships (OWNER role)
INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active, created_at)
SELECT
    u.id,
    t.id,
    'owner',
    true,
    NOW()
FROM public.users u
CROSS JOIN public.tenants t
WHERE u.email = 'mazmakerv2.sup@gmail.com'
AND t.slug = 'maz-maker-v2-company'
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Step 4: Second tenant as owner too (demo access)
INSERT INTO public.user_tenants (user_id, tenant_id, role, is_active, created_at)
SELECT
    u.id,
    t.id,
    'owner',
    true,
    NOW()
FROM public.users u
CROSS JOIN public.tenants t
WHERE u.email = 'mazmakerv2.sup@gmail.com'
AND t.slug = 'maz-demo'
ON CONFLICT (user_id, tenant_id) DO NOTHING;

-- Step 5: Create sample project
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
    SELECT 1 FROM public.projects WHERE name = 'CHATEAU Residence' AND tenant_id = t.id
);

-- Step 6: Create sample units
INSERT INTO public.units (tenant_id, project_id, unit_number, unit_type, bedrooms, bathrooms, area_sqm, price, status, created_at)
SELECT
    t.id,
    p.id,
    'A-' || generate_series(1, 10),
    CASE WHEN generate_series(1, 10) <= 5 THEN 'condo' ELSE 'penthouse' END,
    CASE WHEN generate_series(1, 10) <= 5 THEN 2 ELSE 4 END,
    CASE WHEN generate_series(1, 10) <= 5 THEN 2 ELSE 3 END,
    80 + (generate_series(1, 10) * 20),
    5000000 + (generate_series(1, 10) * 500000),
    'available',
    NOW()
FROM public.tenants t
CROSS JOIN (SELECT id FROM public.projects WHERE name = 'CHATEAU Residence' LIMIT 1) p
WHERE t.slug = 'maz-maker-v2-company'
AND NOT EXISTS (
    SELECT 1 FROM public.units WHERE project_id = p.id AND unit_number LIKE 'A-%'
);

-- Return verification data
SELECT
    '✅ สร้าง user ในระบบฐานข้อมูลสำเร็จ!' as status,
    u.email,
    u.full_name,
    u.id as user_id,
    t.name as tenant_name,
    t.id as tenant_id,
    ut.role as user_role,
    '✅ เข้าสู่ระบบด้วย: mazmakerv2.sup@gmail.com / aa112233' as login_info,
    '✅ สร้าง sample project: ' || COUNT(p.id) FILTER (WHERE p.name = 'CHATEAU Residence') || ' project(s)' as projects_count,
    '✅ สร้าง sample units: ' || COUNT(u.id) FILTER (WHERE u.unit_number LIKE 'A-%') || ' unit(s)' as units_count
FROM public.users u
CROSS JOIN public.user_tenants ut ON u.id = ut.user_id
CROSS JOIN public.tenants t ON ut.tenant_id = t.id
WHERE u.email = 'mazmakerv2.sup@gmail.com'
AND ut.role = 'owner'
GROUP BY u.id, u.email, u.full_name, t.id, t.name, ut.role;

-- Instructions for next step
SELECT
    '📝 ถ้ายัง login ไม่ได้, ให้ไปสร้าง user ใน Supabase Auth ด้วย:' as next_step,
    '1. Supabase Dashboard → Authentication → Invite users' as step1,
    '2. Email: mazmakerv2.sup@gmail.com' as step2,
    '3. รับ invite email แล้วตั้งรหัสผ่าน: aa112233' as step3;