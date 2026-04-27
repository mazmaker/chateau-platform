-- First, let's check what's in auth.users and understand the structure
-- This function will help us see the issue

CREATE OR REPLACE FUNCTION debug_auth_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count int;
    v_instance_id uuid;
BEGIN
    SELECT COUNT(*) INTO v_count FROM auth.users;
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;

    RETURN json_build_object(
        'auth_users_count', v_count,
        'instance_id', v_instance_id
    );
END;
$$;

-- Function to properly create auth user using Supabase's internal hashing
-- Note: This mimics what Supabase does internally
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

    -- Get instance_id
    SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1;

    -- Delete existing auth user if any
    DELETE FROM auth.users WHERE id = v_user.id;

    -- Hash password using bcrypt (pgcrypto)
    -- Supabase uses bcrypt with a cost factor of 10
    v_hashed_password := crypt(p_password, gen_salt('bf', 10));

    -- Insert into auth.users with all required fields
    INSERT INTO auth.users (
        id,
        instance_id,
        email,
        encrypted_password,
        email_confirmed_at,
        raw_user_meta_data,
        raw_app_meta_data,
        is_super_admin,
        created_at,
        updated_at,
        last_sign_in_at,
        phone,
        phone_confirmed_at,
        phone_changed_at,
        email_change_sent_at,
        confirmed_at,
        recovery_token_sent_at,
        email_change_token_new,
        email_change,
        new_email
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
        false,
        now(),
        now(),
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        NULL,
        now(),
        NULL,
        NULL,
        NULL
    );

    -- Also insert into auth.identities table
    DELETE FROM auth.identities WHERE user_id = v_user.id;
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
        now(),
        now()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Auth user recreated',
        'auth_id', v_user.id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM || ' - ' || SQLSTATE);
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION debug_auth_users() TO authenticated;
GRANT EXECUTE ON FUNCTION recreate_auth_user_properly(uuid, text) TO authenticated;
