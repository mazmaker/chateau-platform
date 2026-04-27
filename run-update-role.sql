-- Update auth.users to show role in Dashboard
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(u.role)
)
FROM public.users u
WHERE auth.users.id = u.id;

-- Show results
SELECT
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data,
    created_at
FROM auth.users
ORDER BY created_at DESC;
