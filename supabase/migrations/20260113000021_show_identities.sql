-- Show all identities
CREATE OR REPLACE FUNCTION show_all_identities()
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
            'user_id', user_id,
            'provider', provider,
            'provider_id', provider_id
        )
    ) INTO v_result
    FROM auth.identities;

    RETURN json_build_object('success', true, 'identities', v_result);
END;
$$;

GRANT EXECUTE ON FUNCTION show_all_identities() TO authenticated;
