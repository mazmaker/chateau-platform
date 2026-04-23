-- Create missing identities for all auth users
DO $$
DECLARE
    v_count int;
BEGIN
    INSERT INTO auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
    )
    SELECT
        gen_random_uuid(),
        u.id,
        jsonb_build_object(
            'sub', u.id::text,
            'email', u.email,
            'email_verified', u.email_confirmed_at IS NOT NULL
        ),
        'email',
        u.id::text,
        u.last_sign_in_at,
        u.created_at,
        COALESCE(u.updated_at, u.created_at)
    FROM auth.users u
    WHERE NOT EXISTS (
        SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
    );

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Created % identities', v_count;
END $$;
