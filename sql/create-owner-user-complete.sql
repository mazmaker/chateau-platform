-- Create OWNER user for mazmakerv2.sup@gmail.com
-- Role: OWNER
-- Password: aa112233

-- Step 1: Create tenant for the user
INSERT INTO public.tenants (name, slug, created_at)
VALUES
    ('MAZ Maker V2 Company', 'maz-maker-v2-company', NOW()),
    ('MAZ Demo', 'maz-demo', NOW())
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Create user record
INSERT INTO public.users (email, full_name, phone, created_at)
VALUES ('mazmakerv2.sup@gmail.com', 'MAZ Maker V2', '+66812345678', NOW())
ON CONFLICT (email) DO NOTHING;

-- Step 3: Create user-tenant relationships (OWNER role)
-- First tenant as primary (owner)
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

-- Second tenant as owner too (demo access)
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

-- Step 4: Create sample data for testing
-- Sample project
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
ON CONFLICT DO NOTHING;

-- Sample units for the project
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
ON CONFLICT DO NOTHING;

-- Return success message
SELECT
    '✅ สร้าง OWNER user สำเร็จ!' as status,
    'Email: mazmakerv2.sup@gmail.com' as email,
    'Password: aa112233' as password,
    'Role: OWNER' as role,
    'Tenant: MAZ Maker V2 Company' as primary_tenant,
    'Created: ' || NOW() as created_time;