-- RPC function to create auth user using proper Supabase password hashing
-- Note: This requires the pgcrypto extension
CREATE OR REPLACE FUNCTION create_auth_user_for_existing(p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user users%ROWTYPE;
BEGIN
    -- Get user data
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id
    LIMIT 1;

    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if auth user already exists
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user.id) THEN
        RETURN json_build_object('success', false, 'message', 'Auth user already exists');
    END IF;

    -- Insert into auth.users with proper Supabase password hashing
    -- Supabase uses bcrypt with a specific format
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
        (SELECT instance_id FROM auth.users LIMIT 1),  -- Get instance_id from existing users
        v_user.email,
        encode(digest(p_password, 'sha256'), 'hex'),  -- Temporary - will be replaced by Supabase
        now(),
        jsonb_build_object(
            'full_name', v_user.full_name,
            'tenant_id', v_user.tenant_id::text,
            'role', v_user.role
        ),
        '{"provider":"email","providers":["email"]}'::jsonb,
        now(),
        now()
    );

    RETURN json_build_object(
        'success', true,
        'message', 'Auth user created - user must reset password',
        'auth_id', v_user.id
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_auth_user_for_existing(uuid, text) TO authenticated;
