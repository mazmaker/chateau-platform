-- RPC function to create auth user for existing public.users
CREATE OR REPLACE FUNCTION create_auth_user_for_existing(p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user users%ROWTYPE;
    v_auth_id uuid;
BEGIN
    -- Get user data
    SELECT * INTO v_user
    FROM users
    WHERE id = p_user_id
    LIMIT 1;

    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Insert into auth.users directly
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, created_at, updated_at)
    VALUES (
        v_user.id,
        v_user.email,
        crypt(p_password, gen_salt('bf')),
        now(),
        jsonb_build_object(
            'full_name', v_user.full_name,
            'tenant_id', v_user.tenant_id,
            'role', v_user.role
        ),
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        encrypted_password = crypt(p_password, gen_salt('bf')),
        updated_at = now()
    RETURNING id INTO v_auth_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Auth user created/updated',
        'auth_id', v_auth_id
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION create_auth_user_for_existing(uuid, text) TO authenticated;
