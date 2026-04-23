-- Fixed version - only insert columns that exist
CREATE OR REPLACE FUNCTION recreate_auth_user_properly(p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_instance_id uuid;
    v_hashed_password text;
BEGIN
    -- Get user data
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id
    LIMIT 1;

    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found in public.users');
    END IF;

    -- Get instance_id from existing auth users
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;

    -- Delete existing auth user and identity if any
    DELETE FROM auth.identities WHERE user_id = v_user.id;
    DELETE FROM auth.users WHERE id = v_user.id;

    -- Hash password using bcrypt
    v_hashed_password := crypt(p_password, gen_salt('bf', 10));

    -- Insert into auth.users with minimal required fields
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        raw_app_meta_data,
        created_at,
        updated_at
    )
    VALUES (
        v_user.id,
        v_instance_id,
        v_user.email,
        v_hashed_password,
        now(),
        jsonb_build_object(
            'full_name', v_user.full_name,
            'tenant_id', v_user.tenant_id::text,
            'role', v_user.role
        ),
        '{"provider":"email","providers":["email"],"email_confirmed":true}'::jsonb,
        now(),
        now()
    );

    -- Insert into auth.identities table
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
        v_user.id,
        jsonb_build_object(
            'sub', v_user.id::text,
            'email', v_user.email
        ),
        'email',
        v_user.id::text,
        now(),
        now()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Auth user recreated',
        'auth_id', v_user.id,
        'email', v_user.email
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM || ' - ' || SQLSTATE);
END;
$$;

-- Drop old function
DROP FUNCTION IF EXISTS create_auth_user_for_existing(uuid, text);

-- Grant execute
GRANT EXECUTE ON FUNCTION recreate_auth_user_properly(uuid, text) TO authenticated;
