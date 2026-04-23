-- Check and fix password hash
CREATE OR REPLACE FUNCTION check_and_fix_password(p_user_id uuid, p_password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user auth.users%ROWTYPE;
    v_new_hash text;
BEGIN
    -- Get current auth user
    SELECT * INTO v_user FROM auth.users WHERE id = p_user_id;

    IF v_user IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Auth user not found');
    END IF;

    -- Check if password matches
    IF (v_user.encrypted_password = crypt(p_password, v_user.encrypted_password)) THEN
        RETURN json_build_object('success', true, 'message', 'Password matches');
    END IF;

    -- Password doesn't match, re-hash it
    v_new_hash := crypt(p_password, gen_salt('bf', 10));

    UPDATE auth.users
    SET encrypted_password = v_new_hash,
        updated_at = now()
    WHERE id = p_user_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Password rehashed',
        'old_hash', substring(v_user.encrypted_password, 1, 20) || '...',
        'new_hash', substring(v_new_hash, 1, 20) || '...'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION check_and_fix_password(uuid, text) TO authenticated;
