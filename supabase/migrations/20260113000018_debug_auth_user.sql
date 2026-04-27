-- Debug auth user details
CREATE OR REPLACE FUNCTION debug_auth_user(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user auth.users%ROWTYPE;
    v_identity auth.identities%ROWTYPE;
BEGIN
    SELECT * INTO v_user FROM auth.users WHERE email = p_email;
    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    SELECT * INTO v_identity FROM auth.identities WHERE user_id = v_user.id;

    RETURN json_build_object(
        'success', true,
        'user_id', v_user.id,
        'email', v_user.email,
        'instance_id', v_user.instance_id,
        'password_hash_prefix', substring(v_user.encrypted_password, 1, 10),
        'email_confirmed', v_user.email_confirmed_at IS NOT NULL,
        'created_at', v_user.created_at,
        'identity_exists', v_identity IS NOT NULL,
        'identity_provider', CASE WHEN v_identity IS NOT NULL THEN v_identity.provider ELSE NULL END,
        'identity_provider_id', CASE WHEN v_identity IS NOT NULL THEN v_identity.provider_id ELSE NULL END
    );
END;
$$;

GRANT EXECUTE ON FUNCTION debug_auth_user(text) TO authenticated;
