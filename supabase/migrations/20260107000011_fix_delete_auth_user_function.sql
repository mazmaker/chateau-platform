-- Fix delete_auth_user_by_email function

CREATE OR REPLACE FUNCTION delete_auth_user_by_email(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Count first
  SELECT COUNT(*) INTO v_deleted_count
  FROM auth.users
  WHERE email = p_email;

  -- Delete from auth.users
  DELETE FROM auth.users
  WHERE email = p_email;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'email', p_email
  );
END;
$$;

-- Grant execute to authenticated (for admin use)
GRANT EXECUTE ON FUNCTION delete_auth_user_by_email TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_auth_user_by_email IS 'Delete user from auth.users by email. Use only for cleanup during development.';
