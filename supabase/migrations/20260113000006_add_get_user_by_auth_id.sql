-- RPC function to get user by auth_user_id (bypasses RLS for the current user)
CREATE OR REPLACE FUNCTION get_user_by_auth_id(p_auth_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_record users%ROWTYPE;
BEGIN
    -- Get user by auth_user_id
    SELECT * INTO v_user_record
    FROM users
    WHERE auth_user_id = p_auth_id
    LIMIT 1;

    IF v_user_record IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'User not found');
    END IF;

    RETURN json_build_object(
        'success', true,
        'id', v_user_record.id,
        'email', v_user_record.email,
        'full_name', v_user_record.full_name,
        'role', v_user_record.role,
        'tenant_id', v_user_record.tenant_id
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_user_by_auth_id(uuid) TO authenticated;
