-- RPC function to remove auth user by email
CREATE OR REPLACE FUNCTION remove_auth_user_by_email(p_email text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_auth_id uuid;
BEGIN
    -- Get auth user ID from auth.users
    SELECT id INTO v_auth_id
    FROM auth.users
    WHERE email = p_email
    LIMIT 1;

    IF v_auth_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Auth user not found');
    END IF;

    -- Delete from auth.users
    DELETE FROM auth.users WHERE id = v_auth_id;

    RETURN json_build_object('success', true, 'message', 'Auth user deleted', 'auth_id', v_auth_id);
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION remove_auth_user_by_email(text) TO authenticated;
