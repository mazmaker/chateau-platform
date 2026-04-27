-- Reset all passwords to known values
CREATE OR REPLACE FUNCTION reset_all_passwords()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Owner
    UPDATE auth.users
    SET encrypted_password = crypt('Owner2025!', gen_salt('bf', 10)),
        updated_at = now()
    WHERE email = 'mazmakerv2.sup@gmail.com';

    -- Admin
    UPDATE auth.users
    SET encrypted_password = crypt('Admin2025!', gen_salt('bf', 10)),
        updated_at = now()
    WHERE email = 'admin@chateau.com';

    -- Sales
    UPDATE auth.users
    SET encrypted_password = crypt('Admin2025!', gen_salt('bf', 10)),
        updated_at = now()
    WHERE email = 'sales@chateau.com';

    RETURN json_build_object('success', true, 'message', 'All passwords reset');
END;
$$;

GRANT EXECUTE ON FUNCTION reset_all_passwords() TO authenticated;
