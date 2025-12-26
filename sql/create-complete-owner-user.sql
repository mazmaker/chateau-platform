-- Create COMPLETE OWNER user for mazmakerv2.sup@gmail.com
-- This creates user in BOTH auth.users and public.users tables
-- Role: OWNER
-- Password: aa112233

-- Enable the auth extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create tenant for the user
INSERT INTO public.tenants (name, slug, created_at)
VALUES
    ('MAZ Maker V2 Company', 'maz-maker-v2-company', NOW()),
    ('MAZ Demo', 'maz-demo', NOW())
ON CONFLICT (slug) DO NOTHING;

-- Step 2: Generate UUID for the user
DO $$
DECLARE
    user_uuid UUID;
BEGIN
    -- Generate a new UUID
    user_uuid := uuid_generate_v4();

    -- Insert into auth.users (this will be used by Supabase Auth)
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
        is_super_admin,
        phone,
        phone_confirmed_at,
        confirmed_at
    ) VALUES (
        user_uuid,
        'authenticated',
        'authenticated',
        'mazmakerv2.sup@gmail.com',
        crypt('aa112233', gen_salt('bf')),
        NOW(),
        NOW(),
        NOW(),
        NOW() - INTERVAL '1 hour', -- last_sign_in_at
        '{"provider": "email", "full_name": "MAZ Maker V2"}',
        false,
        '+66812345678',
        NULL,
        NOW()
    )
    ON CONFLICT (id) DO NOTHING;

    -- Insert into public.users
    INSERT INTO public.users (
        id,
        email,
        full_name,
        phone,
        created_at,
        updated_at
    ) VALUES (
        user_uuid,
        'mazmakerv2.sup@gmail.com',
        'MAZ Maker V2',
        '+66812345678',
        NOW(),
        NOW()
    )
    ON CONFLICT (email) DO NOTHING;

    -- Create user-tenant relationships (OWNER role)
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

    -- Create sample data for testing
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

    -- Create sample units
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

    RAISE NOTICE '✅ Created complete user system for mazmakerv2.sup@gmail.com';
END $$;

-- Return success message
SELECT
    '✅ สร้าง OWNER user สำเร็จทั้งระบบ!' as status,
    'Email: mazmakerv2.sup@gmail.com' as email,
    'Password: aa112233' as password,
    'Role: OWNER' as role,
    'Tenant: MAZ Maker V2 Company' as primary_tenant,
    'Authentication: auth.users + public.users' as auth_type,
    'Created: ' || NOW() as created_time;