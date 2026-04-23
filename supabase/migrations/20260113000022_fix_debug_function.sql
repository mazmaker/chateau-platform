-- Fix debug function to properly check identity
CREATE OR REPLACE FUNCTION debug_auth_user(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user auth.users%ROWTYPE;
    v_identity_exists bool;
BEGIN
    SELECT * INTO v_user FROM auth.users WHERE email = p_email;
    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    -- Check if identity exists by looking up by user_id
    SELECT EXISTS(
        SELECT 1 FROM auth.identities WHERE user_id = v_user.id
    ) INTO v_identity_exists;

    RETURN json_build_object(
        'success', true,
        'user_id', v_user.id,
        'email', v_user.email,
        'instance_id', v_user.instance_id,
        'password_hash_prefix', substring(v_user.encrypted_password, 1, 10),
        'email_confirmed', v_user.email_confirmed_at IS NOT NULL,
        'created_at', v_user.created_at,
        'identity_exists', v_identity_exists
    );
END;
$$;
