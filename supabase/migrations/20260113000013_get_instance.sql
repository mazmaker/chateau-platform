-- Check instance_id from existing users
CREATE OR REPLACE FUNCTION get_instance_info()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result jsonb;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'email', email,
            'instance_id', instance_id
        )
    ) INTO v_result
    FROM auth.users
    LIMIT 5;

    RETURN json_build_object('success', true, 'users', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION get_instance_info() TO authenticated;
