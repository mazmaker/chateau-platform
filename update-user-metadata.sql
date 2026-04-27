-- ============================================
-- UPDATE USER METADATA TO SHOW ROLE IN DASHBOARD
-- ============================================

-- อัปเดต auth.users.raw_user_meta_data ให้มี role
-- เพื่อให้เห็น role ในหน้า Authentication -> Users

UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(u.role)
)
FROM public.users u
WHERE auth.users.id = u.id;

-- ตรวจสอบผลลัพธ์
SELECT
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;
