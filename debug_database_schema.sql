-- 🔍 Debug Database Schema - ตรวจสอบปัญหา Database Error
-- รันนี้ใน Supabase SQL Editor ครับ

-- 1. ตรวจสอบตารางหลักที่เกี่ยวข้อง
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND (table_name LIKE '%user%' OR table_name = 'tenants' OR table_name = 'auth%')
ORDER BY table_name;

-- 2. ดู structure ของตาราง users
\d+ public.users

-- 3. ดู structure ของตาราง user_tenants
\d+ public.user_tenants

-- 4. ดู structure ของตาราง tenants
\d+ public.tenants

-- 5. ตรวจสอบ constraints ของตาราง users
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'public.users';

-- 6. ตรวจสอบ constraints ของตาราง user_tenants
SELECT
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'public.user_tenants';

-- 7. ดูว่ามี trigger บนตาราง users หรือไม่
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_condition,
    action_orientation,
    action_reference_new_table,
    action_reference_old_table,
    action_reference_new_row,
    action_reference_old_row,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('public.users', 'auth.users');

-- 8. ตรวจสอบค่า UUID column ในตาราง users
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'public.users'
AND column_name = 'id';

-- 9. ตรวจสอบ user ที่มีอยู่
SELECT COUNT(*) as total_users FROM public.users;
SELECT id, email, created_at FROM public.users ORDER BY created_at DESC LIMIT 5;

-- 10. ตรวจสอบ user_tenants ที่มีอยู่
SELECT COUNT(*) as total_user_tenants FROM public.user_tenants;
SELECT
    ut.id,
    ut.user_id,
    ut.tenant_id,
    ut.role,
    u.email,
    t.name as tenant_name,
    ut.created_at
FROM public.user_tenants ut
JOIN public.users u ON ut.user_id = u.id
JOIN public.tenants t ON ut.tenant_id = t.id
ORDER BY ut.created_at DESC
LIMIT 5;

-- 11. ตรวจสอบ tenant ที่มีอยู่
SELECT COUNT(*) as total_tenants FROM public.tenants;
SELECT id, name, slug, created_at FROM public.tenants ORDER BY created_at DESC LIMIT 5;

-- 12. ดู Supabase Extensions ที่ใช้งาน
SELECT extname, extversion FROM pg_extension;

-- 13. ตรวจสอบ Row Level Security (RLS) Policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE (tablename LIKE '%user%' OR tablename = 'tenants')
ORDER BY schemaname, tablename;

-- 14. ดูว่า auth schema มีอยู่หรือไม่
SELECT
    table_schema,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 15. ถ้ามี auth schema ให้ดู structure แบบละเอียด
-- \d auth.users

-- 16. ลองทดสอบการสร้าง user แบบง่ายๆ
-- สร้าง user ผ่าน RPC ถ้ามีฟังก์ชัน
-- DO $$
-- BEGIN
-- INSERT INTO public.users (id, email, full_name, created_at)
-- VALUES (gen_random_uuid(), 'test@example.com', 'Test User', NOW());
-- END $$;

-- SELECT 'Test user created' as result;