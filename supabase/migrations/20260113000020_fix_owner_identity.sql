-- Fix: Update existing identity for Owner user
DO $$
BEGIN
    -- Update the identity that has wrong user_id
    UPDATE auth.identities
    SET user_id = 'cb6d6df0-3987-467d-b47f-7cbb90c3fab0'::uuid,
        identity_data = jsonb_build_object(
            'sub', 'cb6d6df0-3987-467d-b47f-7cbb90c3fab0',
            'email', 'mazmakerv2.sup@gmail.com',
            'email_verified', true
        ),
        updated_at = now()
    WHERE provider_id = 'cb6d6df0-3987-467d-b47f-7cbb90c3fab0'
    AND provider = 'email';

    RAISE NOTICE 'Owner identity updated';
END $$;
