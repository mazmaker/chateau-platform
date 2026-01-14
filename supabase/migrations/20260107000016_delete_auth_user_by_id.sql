-- Create function to delete auth user by ID (better than by email)

CREATE OR REPLACE FUNCTION delete_auth_user_by_id(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  -- Check if user exists
  SELECT COUNT(*) INTO v_deleted_count
  FROM auth.users
  WHERE id = p_user_id;

  -- Delete from auth.users by ID
  DELETE FROM auth.users
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'user_id', p_user_id::text
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION delete_auth_user_by_id TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_auth_user_by_id IS 'Delete user from auth.users by ID. Used when deleting user from application.';
