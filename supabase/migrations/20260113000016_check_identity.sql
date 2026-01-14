-- Check and fix auth.identities
CREATE OR REPLACE FUNCTION check_and_fix_identity(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_identity auth.identities%ROWTYPE;
    v_user auth.users%ROWTYPE;
BEGIN
    -- Get auth user
    SELECT * INTO v_user FROM auth.users WHERE id = p_user_id;
    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Auth user not found');
    END IF;

    -- Check existing identity
    SELECT * INTO v_identity FROM auth.identities WHERE user_id = p_user_id;

    IF v_identity IS NULL THEN
        -- Create identity
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            created_at,
            updated_at
        )
        VALUES (
            gen_random_uuid(),
            p_user_id,
            jsonb_build_object(
                'sub', p_user_id::text,
                'email', v_user.email
            ),
            'email',
            p_user_id::text,
            now(),
            now()
        );

        RETURN json_build_object('success', true, 'message', 'Identity created');
    ELSE
        RETURN json_build_object(
            'success', true,
            'message', 'Identity exists',
            'provider', v_identity.provider,
            'provider_id', v_identity.provider_id
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_fix_identity(uuid) TO authenticated;
